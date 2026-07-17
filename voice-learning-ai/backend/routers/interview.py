"""
Interview WebSocket with optional follow-up mode per question.
"""
import asyncio
import json
import os
from datetime import datetime

import aiosqlite
from fastapi import APIRouter, HTTPException, WebSocket, WebSocketDisconnect

from config import settings
from models.session import SessionCreate
from services import assessor, stt, tts

router = APIRouter(prefix="/interview", tags=["interview"])

DB_PATH = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", settings.database_path))
MAX_FOLLOWUP_ROUNDS = 30


@router.post("/start")
async def start_session(body: SessionCreate):
    """Create a new session and return session_id + first question."""
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row

        sql = "SELECT * FROM questions WHERE 1=1"
        params: list = []
        if body.topic and body.topic != "random":
            sql += " AND topic LIKE ?"
            params.append(f"%{body.topic}%")
        if body.company and body.company != "all":
            sql += (
                " AND (',' || REPLACE(LOWER(company), ' ', '') || ',') "
                "LIKE ('%,' || REPLACE(LOWER(?), ' ', '') || ',%')"
            )
            params.append(body.company)
        sql += " ORDER BY RANDOM() LIMIT ?"
        params.append(settings.max_questions_per_session)

        async with db.execute(sql, params) as cur:
            questions = [dict(r) for r in await cur.fetchall()]

        if not questions:
            filters = [f"topic '{body.topic}'"]
            if body.company and body.company != "all":
                filters.append(f"company '{body.company}'")
            raise HTTPException(404, f"No questions found for {' and '.join(filters)}")

        cur = await db.execute(
            "INSERT INTO sessions (title, topic, model_used, follow_up_mode, status) VALUES (?, ?, ?, ?, 'active')",
            (
                body.title or f"{body.company or 'All companies'} · {body.topic} — {datetime.now().strftime('%b %d %H:%M')}",
                body.topic,
                body.model_used or settings.ollama_model,
                1 if body.follow_up_mode else 0,
            ),
        )
        session_id = cur.lastrowid
        await db.executemany(
            "INSERT INTO session_questions (session_id, question_id, question_order) VALUES (?, ?, ?)",
            [(session_id, question["id"], index) for index, question in enumerate(questions)],
        )
        await db.commit()

    return {
        "session_id": session_id,
        "questions": questions,
        "total": len(questions),
        "follow_up_mode": body.follow_up_mode,
    }


@router.websocket("/ws/{session_id}")
async def interview_ws(websocket: WebSocket, session_id: int):
    await websocket.accept()

    try:
        session = await _get_session(session_id)
        if not session:
            await websocket.send_json({"type": "error", "message": "Session not found"})
            await websocket.close()
            return

        topic = session["topic"]
        session_model: str | None = session.get("model_used") or None
        follow_up_mode = bool(session.get("follow_up_mode"))
        questions = await _get_session_questions(session_id)

        await websocket.send_json({"type": "session_config", "follow_up_mode": follow_up_mode})

        q_index = 0

        while q_index < len(questions):
            q = questions[q_index]

            if q_index == 0:
                spoken_text = await assessor.generate_opening(topic, q["question"], model=session_model)
            else:
                spoken_text = f"Let's move on. {q['question']}"

            await _speak_and_display(
                websocket,
                spoken_text,
                mode="question",
                question_index=q_index,
                round_number=None,
            )
            await websocket.send_json(
                {
                    "type": "question",
                    "index": q_index,
                    "total": len(questions),
                    "text": q["question"],
                    "topic": q["topic"],
                    "difficulty": q["difficulty"],
                }
            )

            msg = await _receive_msg(websocket)
            if "bytes" not in msg:
                try:
                    data = json.loads(msg.get("text", "{}"))
                except json.JSONDecodeError:
                    continue
                action = data.get("action")
                if action == "end":
                    raise WebSocketDisconnect()
                elif action == "next":
                    await websocket.send_json({"type": "status", "message": "Skipping to the next question..."})
                    q_index += 1
                    continue
                else:
                    continue

            await websocket.send_json({"type": "status", "message": "transcribing..."})
            transcript, duration = await stt.transcribe(msg["bytes"])
            await websocket.send_json({"type": "transcript", "text": transcript})

            await websocket.send_json({"type": "status", "message": "evaluating..."})
            score = await assessor.score_answer(
                question=q["question"],
                transcript=transcript,
                expected_keywords=q.get("expected_keywords") or "",
                model=session_model,
            )

            response_id = await _save_response_and_score(
                session_id=session_id,
                question=q,
                question_index=q_index,
                transcript=transcript,
                duration=duration,
                score=score,
            )

            await websocket.send_json({"type": "score", "score": score.model_dump()})

            brief_feedback = f"Score: {score.total:.0f} out of 100. {score.llm_feedback[:160]}"
            await _speak_and_display(
                websocket,
                brief_feedback,
                mode="feedback",
                question_index=q_index,
                round_number=None,
            )

            if follow_up_mode:
                await websocket.send_json(
                    {
                        "type": "status",
                        "message": "Follow-up mode is on. Staying on this question and digging deeper...",
                    }
                )
                report, advance_requested = await _run_followup_mode(
                    websocket=websocket,
                    question=q,
                    original_answer=transcript,
                    initial_feedback=score.llm_feedback,
                    question_index=q_index,
                    model=session_model,
                )
                await _save_followup_report(response_id, report)
                await websocket.send_json({"type": "followup_report", "report": report})
                if advance_requested:
                    await websocket.send_json(
                        {
                            "type": "status",
                            "message": "Saved follow-up progress. Moving to the next question...",
                        }
                    )
                else:
                    await websocket.send_json(
                        {
                            "type": "status",
                            "message": "Saved follow-up report. Click Next question when you are ready.",
                        }
                    )
                    if not await _wait_for_next_question(websocket):
                        break
            else:
                await websocket.send_json(
                    {
                        "type": "status",
                        "message": "Reviewing feedback — next question in 10 seconds...",
                    }
                )
                await asyncio.sleep(10)

            q_index += 1

        final_score = await _complete_session(session_id)
        safe_final_score = round(final_score or 0, 1)
        await websocket.send_json(
            {
                "type": "session_complete",
                "final_score": safe_final_score,
                "session_id": session_id,
            }
        )
        await _speak_and_display(
            websocket,
            f"That wraps up our session. Your overall score was {safe_final_score:.0f} out of 100. Great work today.",
            mode="closing",
            question_index=None,
            round_number=None,
        )

    except WebSocketDisconnect:
        await _abandon_session(session_id)


async def _run_followup_mode(
    websocket: WebSocket,
    question: dict,
    original_answer: str,
    initial_feedback: str,
    question_index: int,
    model: str | None,
) -> tuple[dict, bool]:
    seed_review = await assessor.review_followup_answer(
        question=question["question"],
        original_answer=original_answer,
        latest_answer=original_answer,
        turns=[],
        round_number=0,
        expected_keywords=question.get("expected_keywords") or "",
        model=model,
    )
    next_prompt = assessor.compose_followup_message(seed_review, continue_loop=True)
    turns: list[dict] = []
    closing_text = "Let's move on to the next question."
    advance_requested = False
    speak_summary = True

    for round_number in range(1, MAX_FOLLOWUP_ROUNDS + 1):
        await _speak_and_display(
            websocket,
            next_prompt,
            mode="followup",
            question_index=question_index,
            round_number=round_number,
        )
        await websocket.send_json(
            {
                "type": "followup_state",
                "round": round_number,
                "max_rounds": MAX_FOLLOWUP_ROUNDS,
                "question_index": question_index,
            }
        )

        # Keep waiting until we receive audio bytes or an explicit end/next action.
        # Without this inner loop, stray JSON messages (status pings, unknown actions)
        # would cause `continue` to advance `round_number`, silently burning a round
        # and making the agent stop responding after just 2 real answers.
        audio_received = False
        while True:
            msg = await _receive_msg(websocket)
            if "bytes" not in msg:
                try:
                    data = json.loads(msg.get("text", "{}"))
                except json.JSONDecodeError:
                    # Malformed text — keep waiting
                    continue
                action = data.get("action")
                if action == "end":
                    raise WebSocketDisconnect()
                elif action == "next":
                    advance_requested = True
                    speak_summary = False
                    await websocket.send_json({"type": "status", "message": "Saving follow-up progress and moving to the next question..."})
                    closing_text = "We'll stop the follow-up drill here and move on to the next question."
                    break
                else:
                    # Unknown JSON (e.g. status ping) — stay in this round
                    continue
            else:
                audio_received = True
                break

        # User clicked "next" — exit the outer for loop
        if not audio_received:
            break

        await websocket.send_json({"type": "status", "message": f"Transcribing follow-up round {round_number}..."})
        latest_answer, _ = await stt.transcribe(msg["bytes"])
        await websocket.send_json({"type": "transcript", "text": latest_answer})

        review = await assessor.review_followup_answer(
            question=question["question"],
            original_answer=original_answer,
            latest_answer=latest_answer,
            turns=turns,
            round_number=round_number,
            expected_keywords=question.get("expected_keywords") or "",
            model=model,
        )
        should_continue = assessor.should_continue_followup(review["understanding_score"], round_number, MAX_FOLLOWUP_ROUNDS)
        turns.append(
            {
                "round": round_number,
                "interviewer_prompt": next_prompt,
                "candidate_answer": latest_answer,
                "understanding_score": review["understanding_score"],
                "coach_feedback": review["coach_feedback"],
                "deeper_explanation": review["deeper_explanation"],
                "hint": review["hint"],
                "next_question": review["next_question"],
                "what_they_now_understand": review["what_they_now_understand"],
                "remaining_gaps": review["remaining_gaps"],
            }
        )
        await websocket.send_json(
            {
                "type": "status",
                "message": f"Follow-up round {round_number} reviewed. Understanding score: {review['understanding_score']:.0f}/100.",
            }
        )
        if should_continue:
            next_prompt = assessor.compose_followup_message(review, continue_loop=True)
        else:
            closing_text = assessor.compose_followup_message(review, continue_loop=False)
            break

    report = await assessor.generate_followup_report(
        question=question["question"],
        original_answer=original_answer,
        initial_feedback=initial_feedback,
        turns=turns,
        expected_keywords=question.get("expected_keywords") or "",
        model=model,
    )
    report["turns"] = turns
    report["rounds_completed"] = len(turns)
    if speak_summary:
        await _speak_and_display(
            websocket,
            closing_text,
            mode="followup_summary",
            question_index=question_index,
            round_number=len(turns),
        )
    return report, advance_requested


async def _receive_msg(websocket: WebSocket) -> dict:
    msg = await websocket.receive()
    if msg.get("type") == "websocket.disconnect":
        raise WebSocketDisconnect(code=msg.get("code", 1000))
    return msg


async def _wait_for_next_question(websocket: WebSocket) -> bool:
    while True:
        msg = await _receive_msg(websocket)
        if "bytes" in msg:
            await websocket.send_json(
                {
                    "type": "status",
                    "message": "Follow-up mode is complete for this question. Click Next question when you are ready.",
                }
            )
            continue
        try:
            data = json.loads(msg.get("text", "{}"))
        except json.JSONDecodeError:
            continue
        action = data.get("action")
        if action == "end":
            return False
        if action == "next":
            return True


async def _speak_and_display(
    websocket: WebSocket,
    text: str,
    mode: str,
    question_index: int | None,
    round_number: int | None,
):
    await websocket.send_json(
        {
            "type": "interviewer_message",
            "text": text,
            "mode": mode,
            "question_index": question_index,
            "round": round_number,
        }
    )
    audio_bytes = await tts.speak(text)
    if audio_bytes:
        await websocket.send_bytes(audio_bytes)
    else:
        await websocket.send_json({"type": "audio_end"})


async def _save_response_and_score(
    session_id: int,
    question: dict,
    question_index: int,
    transcript: str,
    duration: float,
    score,
) -> int:
    async with aiosqlite.connect(DB_PATH) as db:
        cur = await db.execute(
            "INSERT INTO responses (session_id, question_id, question_order, transcript, audio_duration) VALUES (?,?,?,?,?)",
            (session_id, question["id"], question_index, transcript, duration),
        )
        response_id = cur.lastrowid
        await db.execute(
            """INSERT INTO scores
               (response_id, technical_correctness, depth_completeness,
                communication_clarity, problem_solving, total, llm_feedback, follow_up_asked)
               VALUES (?,?,?,?,?,?,?,?)""",
            (
                response_id,
                score.technical_correctness,
                score.depth_completeness,
                score.communication_clarity,
                score.problem_solving,
                score.total,
                score.llm_feedback,
                score.follow_up_asked,
            ),
        )
        await db.execute(
            """INSERT INTO topic_mastery (topic, avg_score, attempts, last_practiced)
               VALUES (?, ?, 1, CURRENT_TIMESTAMP)
               ON CONFLICT(topic) DO UPDATE SET
                 avg_score = (avg_score * attempts + excluded.avg_score) / (attempts + 1),
                 attempts = attempts + 1,
                 last_practiced = CURRENT_TIMESTAMP""",
            (question["topic"], score.total),
        )
        await db.commit()
    return response_id


async def _save_followup_report(response_id: int, report: dict):
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute(
            """INSERT INTO response_followups (response_id, turns_json, report_json, understanding_score)
               VALUES (?, ?, ?, ?)
               ON CONFLICT(response_id) DO UPDATE SET
                 turns_json = excluded.turns_json,
                 report_json = excluded.report_json,
                 understanding_score = excluded.understanding_score""",
            (
                response_id,
                json.dumps(report.get("turns", [])),
                json.dumps(report),
                float(report.get("understanding_score", 0)),
            ),
        )
        await db.commit()


async def _get_session(session_id: int):
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute("SELECT * FROM sessions WHERE id = ?", (session_id,)) as cur:
            row = await cur.fetchone()
    return dict(row) if row else None


async def _get_session_questions(session_id: int) -> list[dict]:
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute(
            """SELECT q.*
               FROM session_questions sq
               JOIN questions q ON q.id = sq.question_id
               WHERE sq.session_id = ?
               ORDER BY sq.question_order""",
            (session_id,),
        ) as cur:
            rows = await cur.fetchall()
    return [dict(r) for r in rows]


async def _complete_session(session_id: int):
    async with aiosqlite.connect(DB_PATH) as db:
        async with db.execute(
            "SELECT AVG(s.total) FROM scores s JOIN responses r ON r.id = s.response_id WHERE r.session_id = ?",
            (session_id,),
        ) as cur:
            (final_score,) = await cur.fetchone()
        await db.execute(
            "UPDATE sessions SET status='completed', total_score=?, ended_at=CURRENT_TIMESTAMP WHERE id=?",
            (final_score, session_id),
        )
        await db.commit()
    return final_score


async def _abandon_session(session_id: int):
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute(
            """UPDATE sessions
               SET status='abandoned', ended_at=CURRENT_TIMESTAMP
               WHERE id=? AND status='active'""",
            (session_id,),
        )
        await db.commit()
