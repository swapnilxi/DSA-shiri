"""
Question bank management — list, filter, and upload CSV question banks.
"""
import io
import aiosqlite
import pandas as pd
from fastapi import APIRouter, UploadFile, File, HTTPException, Query
from typing import Optional

from config import settings
from models.question import QuestionOut, QuestionFilter
import os

router = APIRouter(prefix="/questions", tags=["questions"])

DB_PATH = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", settings.database_path))

REQUIRED_COLUMNS = {"topic", "question"}
OPTIONAL_COLUMNS = {"difficulty", "company", "category", "expected_keywords"}


@router.get("/", response_model=list[dict])
async def list_questions(
    topic: Optional[str] = Query(None),
    difficulty: Optional[str] = Query(None),
    company: Optional[str] = Query(None),
    limit: int = Query(50, le=200),
):
    conditions = ["1=1"]
    params: list = []

    if topic:
        conditions.append("topic LIKE ?")
        params.append(f"%{topic}%")
    if difficulty:
        conditions.append("difficulty = ?")
        params.append(difficulty)
    if company:
        conditions.append("company LIKE ?")
        params.append(f"%{company}%")

    sql = f"SELECT * FROM questions WHERE {' AND '.join(conditions)} LIMIT ?"
    params.append(limit)

    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute(sql, params) as cursor:
            rows = await cursor.fetchall()
    return [dict(r) for r in rows]


@router.get("/topics")
async def list_topics():
    async with aiosqlite.connect(DB_PATH) as db:
        async with db.execute("SELECT DISTINCT topic, COUNT(*) as count FROM questions GROUP BY topic ORDER BY topic") as cur:
            rows = await cur.fetchall()
    return [{"topic": r[0], "count": r[1]} for r in rows]


@router.get("/companies")
async def list_companies():
    async with aiosqlite.connect(DB_PATH) as db:
        async with db.execute(
            """SELECT company, COUNT(*) AS count
               FROM questions
               WHERE company IS NOT NULL AND TRIM(company) != ''
               GROUP BY company
               ORDER BY company"""
        ) as cur:
            rows = await cur.fetchall()
    return [{"company": r[0], "count": r[1]} for r in rows]


@router.post("/upload")
async def upload_question_bank(file: UploadFile = File(...)):
    if not file.filename.endswith(".csv"):
        raise HTTPException(400, "Only CSV files are supported")

    contents = await file.read()
    try:
        df = pd.read_csv(io.StringIO(contents.decode("utf-8")))
    except Exception as e:
        raise HTTPException(400, f"Could not parse CSV: {e}")

    missing = REQUIRED_COLUMNS - set(df.columns.str.lower())
    if missing:
        raise HTTPException(400, f"CSV missing required columns: {missing}")

    df.columns = df.columns.str.lower()

    # Fill optional columns with defaults
    for col in OPTIONAL_COLUMNS:
        if col not in df.columns:
            df[col] = None
    if "difficulty" in df.columns:
        df["difficulty"] = df["difficulty"].fillna("Medium")

    rows = df[["topic", "question", "difficulty", "company", "category", "expected_keywords"]].to_dict("records")
    inserted = 0

    async with aiosqlite.connect(DB_PATH) as db:
        for row in rows:
            await db.execute(
                """INSERT INTO questions (topic, question, difficulty, company, category, expected_keywords, source_file)
                   VALUES (?, ?, ?, ?, ?, ?, ?)""",
                (
                    row["topic"], row["question"], row["difficulty"],
                    row["company"], row["category"], row["expected_keywords"],
                    file.filename,
                ),
            )
            inserted += 1
        await db.commit()

    # Save the file for reference
    save_path = os.path.join(os.path.dirname(__file__), "..", "..", "data", "question_banks", file.filename)
    with open(save_path, "wb") as f:
        f.write(contents)

    return {"inserted": inserted, "filename": file.filename}


@router.delete("/{question_id}")
async def delete_question(question_id: int):
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute("DELETE FROM questions WHERE id = ?", (question_id,))
        await db.commit()
    return {"deleted": question_id}
