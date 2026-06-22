"""
Interview WebSocket — the main real-time loop.

Flow:
  client connects → server sends first question as TTS audio
  client sends PCM audio chunks → server transcribes → scores → sends feedback + next question
"""
import asyncio
import json
import random
import aiosqlite
import os
from datetime import datetime
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, HTTPException

from config import settings
from models.session import SessionCreate
from services import stt, tts, assessor

router = APIRouter(prefix="/interview", tags=["interview"])

DB_PATH = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", settings.database_path))


@router.post("/start")
async def start_session(body: SessionCreate):
    """Create a new session and return session_id + first question."""
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row

        # Pick questions for this session
        sql = "SELECT * FROM questions WHERE 1=1"
        params: list = []
        if body.topic and body.topic != "random":
            sql += " AND topic LIKE ?"
            params.append(f"%{body.topic}%")
        if body.company and body.company != "all":
            sql += " AND company = ?"
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

        # Create session
        cur = await db.execute(
            "INSERT INTO sessions (title, topic, model_used, status) VALUES (?, ?, ?, 'active')",
            (body.title or f"{body.company or 'All companies'} · {body.topic} — {datetime.now().strftime('%b %d %H:%M')}",
             body.topic, body.model_used or settings.ollama_model),
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
    }


@router.websocket("/ws/{session_id}")
async def interview_ws(websocket: WebSocket, session_id: int):
    await websocket.accept()

    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute("SELECT * FROM sessions WHERE id = ?", (session_id,)) as cur:
            session = await cur.fetchone()

    if not session:
        await websocket.send_json({"type": "error", "message": "Session not found"})
        await websocket.close()
        return

    # Retrieve the exact question list selected when the session was created.
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        topic = dict(session)["topic"]
        async with db.execute(
            """SELECT q.*
               FROM session_questions sq
               JOIN questions q ON q.id = sq.question_id
               WHERE sq.session_id = ?
               ORDER BY sq.question_order""",
            (session_id,),
        ) as cur:
            questions = [dict(r) for r in await cur.fetchall()]

    session_model: str | None = dict(session).get("model_used") or None
    q_index = 0

    try:
        while q_index < len(questions):
            q = questions[q_index]

            # Generate interviewer's spoken introduction for this question
            if q_index == 0:
                spoken_text = await assessor.generate_opening(topic, q["question"], model=session_model)
            else:
                spoken_text = f"Let's move on. {q['question']}"

            # TTS: convert to audio and send to client
            audio_bytes = await tts.speak(spoken_text)
            await websocket.send_bytes(audio_bytes)
            await websocket.send_json({
                "type": "question",
                "index": q_index,
                "total": len(questions),
                "text": q["question"],
                "topic": q["topic"],
                "difficulty": q["difficulty"],
            })

            # Wait for the candidate's audio response
            msg = await websocket.receive()

            if "bytes" not in msg:
                # Control message (e.g., skip, end)
                data = json.loads(msg.get("text", "{}"))
                if data.get("action") == "end":
                    break
                q_index += 1
                continue

            audio_data = msg["bytes"]

            # STT
            await websocket.send_json({"type": "status", "message": "transcribing..."})
            transcript, duration = stt.transcribe(audio_data)

            await websocket.send_json({"type": "transcript", "text": transcript})

            # Score the answer
            await websocket.send_json({"type": "status", "message": "evaluating..."})
            score = await assessor.score_answer(
                question=q["question"],
                transcript=transcript,
                expected_keywords=q.get("expected_keywords") or "",
                model=session_model,
            )

            # Persist response + score
            async with aiosqlite.connect(DB_PATH) as db:
                cur = await db.execute(
                    "INSERT INTO responses (session_id, question_id, question_order, transcript, audio_duration) VALUES (?,?,?,?,?)",
                    (session_id, q["id"], q_index, transcript, duration),
                )
                response_id = cur.lastrowid
                await db.execute(
                    """INSERT INTO scores
                       (response_id, technical_correctness, depth_completeness,
                        communication_clarity, problem_solving, total, llm_feedback, follow_up_asked)
                       VALUES (?,?,?,?,?,?,?,?)""",
                    (
                        response_id,
                        score.technical_correctness, score.depth_completeness,
                        score.communication_clarity, score.problem_solving,
                        score.total, score.llm_feedback, score.follow_up_asked,
                    ),
                )
                # Update topic mastery
                await db.execute(
                    """INSERT INTO topic_mastery (topic, avg_score, attempts, last_practiced)
                       VALUES (?, ?, 1, CURRENT_TIMESTAMP)
                       ON CONFLICT(topic) DO UPDATE SET
                         avg_score = (avg_score * attempts + excluded.avg_score) / (attempts + 1),
                         attempts = attempts + 1,
                         last_practiced = CURRENT_TIMESTAMP""",
                    (q["topic"], score.total),
                )
                await db.commit()

            # Send score to client
            await websocket.send_json({
                "type": "score",
                "score": score.model_dump(),
            })

            # Speak the feedback briefly
            brief_feedback = f"Score: {score.total:.0f} out of 100. {score.llm_feedback[:120]}"
            feedback_audio = await tts.speak(brief_feedback)
            await websocket.send_bytes(feedback_audio)
            await websocket.send_json({
                "type": "status",
                "message": "Reviewing feedback — next question in 10 seconds...",
            })

            # Keep the feedback visible and prevent the next question from
            # replacing it immediately.
            await asyncio.sleep(10)

            q_index += 1

        # Session complete — compute final score
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

        safe_final_score = round(final_score or 0, 1)
        await websocket.send_json({
            "type": "session_complete",
            "final_score": safe_final_score,
            "session_id": session_id,
        })

        closing = await tts.speak(
            f"That wraps up our session. Your overall score was {safe_final_score:.0f} out of 100. Great work today."
        )
        await websocket.send_bytes(closing)

    except WebSocketDisconnect:
        async with aiosqlite.connect(DB_PATH) as db:
            await db.execute(
                """UPDATE sessions
                   SET status='abandoned', ended_at=CURRENT_TIMESTAMP
                   WHERE id=? AND status='active'""",
                (session_id,),
            )
            await db.commit()
