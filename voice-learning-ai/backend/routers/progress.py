"""
Progress tracking — session history, topic mastery, score trends.
"""
import aiosqlite
import os
from fastapi import APIRouter

from config import settings

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
            session = dict(await cur.fetchone())

        async with db.execute(
            """SELECT r.id, q.topic, q.question, q.difficulty,
                      r.transcript, r.audio_duration,
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

    return {"session": session, "responses": responses}


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
    ALLOWED = {"sessions", "questions", "responses", "scores", "topic_mastery"}
    if table not in ALLOWED:
        from fastapi import HTTPException
        raise HTTPException(400, f"Unknown table '{table}'. Allowed: {ALLOWED}")

    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute(f"SELECT * FROM {table} ORDER BY rowid DESC LIMIT ?", (limit,)) as cur:
            rows = [dict(r) for r in await cur.fetchall()]
            columns = [d[0] for d in cur.description] if cur.description else []
    return {"table": table, "columns": columns, "rows": rows, "count": len(rows)}


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
