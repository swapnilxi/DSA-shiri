"""
Progress tracking — session history, topic mastery, score trends.
"""
import aiosqlite
import json
import os
from fastapi import APIRouter, Body, HTTPException, Query

from config import settings
from services.assessor import analyze_session, faang_feedback

router = APIRouter(prefix="/progress", tags=["progress"])

DB_PATH = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", settings.database_path))


@router.get("/sessions")
async def list_sessions(limit: int = 20):
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute(
            "SELECT * FROM sessions ORDER BY started_at DESC LIMIT ?", (limit,)
        ) as cur:
            rows = await cur.fetchall()
    return [dict(r) for r in rows]


@router.get("/sessions/{session_id}")
async def get_session_detail(session_id: int):
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row

        async with db.execute("SELECT * FROM sessions WHERE id = ?", (session_id,)) as cur:
            session_row = await cur.fetchone()
        if not session_row:
            raise HTTPException(404, "Session not found")
        session = dict(session_row)

        async with db.execute(
            """SELECT r.id, q.topic, q.question, q.difficulty,
                      r.transcript, r.audio_duration,
                      s.total, s.technical_correctness, s.depth_completeness,
                      s.communication_clarity, s.problem_solving, s.llm_feedback,
                      rf.report_json AS followup_report
               FROM responses r
               JOIN questions q ON q.id = r.question_id
               LEFT JOIN scores s ON s.response_id = r.id
               LEFT JOIN response_followups rf ON rf.response_id = r.id
               WHERE r.session_id = ?
               ORDER BY r.question_order""",
            (session_id,),
        ) as cur:
            responses = []
            for row in await cur.fetchall():
                item = dict(row)
                if item.get("followup_report"):
                    try:
                        item["followup_report"] = json.loads(item["followup_report"])
                    except json.JSONDecodeError:
                        item["followup_report"] = None
                responses.append(item)

    return {"session": session, "responses": responses}


@router.post("/sessions/{session_id}/analyze")
async def analyze_session_endpoint(
    session_id: int,
    model: str = Query(default=None),
):
    """Run a deep post-session AI analysis: strengths, weak areas, per-question ideal answers, learning plan."""
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row

        async with db.execute("SELECT * FROM sessions WHERE id = ?", (session_id,)) as cur:
            session_row = await cur.fetchone()
        if not session_row:
            raise HTTPException(404, "Session not found")
        session = dict(session_row)

        async with db.execute(
            """SELECT r.id, q.topic, q.question, q.difficulty,
                      r.transcript,
                      s.total, s.technical_correctness, s.depth_completeness,
                      s.communication_clarity, s.problem_solving, s.llm_feedback
               FROM responses r
               JOIN questions q ON q.id = r.question_id
               LEFT JOIN scores s ON s.response_id = r.id
               WHERE r.session_id = ?
               ORDER BY r.question_order""",
            (session_id,),
        ) as cur:
            responses = [dict(r) for r in await cur.fetchall()]

    if not responses:
        raise HTTPException(400, "No responses found for this session")

    result = await analyze_session(
        topic=session.get("topic", "General"),
        responses=responses,
        model=model or None,
    )
    return result


@router.post("/sessions/{session_id}/faang-feedback")
async def faang_feedback_endpoint(
    session_id: int,
    model: str = Query(default=None),
):
    """Generate a personalised FAANG hiring-manager readiness report using the LLM.

    Reads the same session Q&A as /analyze, but produces a blunt dimension-by-dimension
    gap analysis + a 2-week action plan tailored to the candidate's actual answers.
    """
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row

        async with db.execute("SELECT * FROM sessions WHERE id = ?", (session_id,)) as cur:
            session_row = await cur.fetchone()
        if not session_row:
            raise HTTPException(404, "Session not found")
        session = dict(session_row)

        async with db.execute(
            """SELECT r.id, q.topic, q.question, q.difficulty,
                      r.transcript,
                      s.total, s.technical_correctness, s.depth_completeness,
                      s.communication_clarity, s.problem_solving, s.llm_feedback
               FROM responses r
               JOIN questions q ON q.id = r.question_id
               LEFT JOIN scores s ON s.response_id = r.id
               WHERE r.session_id = ?
               ORDER BY r.question_order""",
            (session_id,),
        ) as cur:
            responses = [dict(r) for r in await cur.fetchall()]

    if not responses:
        raise HTTPException(400, "No responses found for this session")

    result = await faang_feedback(
        topic=session.get("topic", "General"),
        responses=responses,
        model=model or None,
    )
    return result


@router.get("/mastery")
async def get_topic_mastery():
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute(
            "SELECT * FROM topic_mastery ORDER BY avg_score DESC"
        ) as cur:
            rows = await cur.fetchall()
    return [dict(r) for r in rows]


@router.get("/db/{table}")
async def browse_table(table: str, limit: int = 200):
    """Raw table browser — used by the in-app DB viewer."""
    ALLOWED = {"sessions", "questions", "responses", "scores", "topic_mastery", "resumes", "session_questions", "response_followups"}
    if table not in ALLOWED:
        from fastapi import HTTPException
        raise HTTPException(400, f"Unknown table '{table}'. Allowed: {ALLOWED}")

    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute(f"SELECT * FROM {table} ORDER BY rowid DESC LIMIT ?", (limit,)) as cur:
            rows = [dict(r) for r in await cur.fetchall()]
            columns = [d[0] for d in cur.description] if cur.description else []
    return {"table": table, "columns": columns, "rows": rows, "count": len(rows)}


@router.delete("/db/{table}/rows")
async def batch_delete_rows(table: str, ids: list[int] = Body(...)):
    """Delete multiple rows by ID from any allowed table."""
    ALLOWED = {"sessions", "questions", "responses", "scores", "topic_mastery", "resumes", "session_questions", "response_followups"}
    if table not in ALLOWED:
        raise HTTPException(400, f"Unknown table '{table}'")
    if not ids:
        return {"deleted": 0}

    placeholders = ",".join("?" * len(ids))
    async with aiosqlite.connect(DB_PATH) as db:
        if table == "sessions":
            # cascade: scores → responses → session_questions → session
            await db.execute(
                f"DELETE FROM response_followups WHERE response_id IN "
                f"(SELECT id FROM responses WHERE session_id IN ({placeholders}))", ids
            )
            await db.execute(
                f"DELETE FROM scores WHERE response_id IN "
                f"(SELECT id FROM responses WHERE session_id IN ({placeholders}))", ids
            )
            await db.execute(
                f"DELETE FROM responses WHERE session_id IN ({placeholders})", ids
            )
            await db.execute(
                f"DELETE FROM session_questions WHERE session_id IN ({placeholders})", ids
            )
        elif table == "responses":
            await db.execute(
                f"DELETE FROM response_followups WHERE response_id IN ({placeholders})", ids
            )
            await db.execute(
                f"DELETE FROM scores WHERE response_id IN ({placeholders})", ids
            )
        await db.execute(f"DELETE FROM {table} WHERE id IN ({placeholders})", ids)
        await db.commit()
    return {"deleted": len(ids)}


@router.get("/stats")
async def get_overall_stats():
    async with aiosqlite.connect(DB_PATH) as db:
        async with db.execute("SELECT COUNT(*) FROM sessions WHERE status='completed'") as cur:
            (sessions_completed,) = await cur.fetchone()

        async with db.execute("SELECT COUNT(*) FROM responses") as cur:
            (total_answers,) = await cur.fetchone()

        async with db.execute("SELECT AVG(total) FROM scores") as cur:
            (avg_score,) = await cur.fetchone()

        async with db.execute(
            "SELECT topic, avg_score FROM topic_mastery ORDER BY avg_score DESC LIMIT 3"
        ) as cur:
            top_topics = [{"topic": r[0], "avg_score": r[1]} for r in await cur.fetchall()]

        async with db.execute(
            "SELECT topic, avg_score FROM topic_mastery ORDER BY avg_score ASC LIMIT 3"
        ) as cur:
            weak_topics = [{"topic": r[0], "avg_score": r[1]} for r in await cur.fetchall()]

    return {
        "sessions_completed": sessions_completed,
        "total_answers": total_answers,
        "avg_score": round(avg_score or 0, 1),
        "top_topics": top_topics,
        "weak_topics": weak_topics,
    }
