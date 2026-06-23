"""
Question bank management — list, filter, upload CSV, and CRUD.
"""
import io
import aiosqlite
import pandas as pd
from fastapi import APIRouter, UploadFile, File, HTTPException, Query
from typing import Optional
from pydantic import BaseModel

from config import settings
from models.question import QuestionOut, QuestionFilter
import os

router = APIRouter(prefix="/questions", tags=["questions"])

DB_PATH = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", settings.database_path))

REQUIRED_COLUMNS = {"topic", "question"}
OPTIONAL_COLUMNS = {"difficulty", "company", "category", "expected_keywords"}

PRACTICE_SET_SLOTS = [
    ("DSA", 1, ["dsa", "algorithms", "arrays", "dynamic programming", "graphs", "linked lists", "trees", "recursion", "tries"]),
    ("System Design", 1, ["system design"]),
    ("Real-Life Scenario-Based", 1, ["real-life scenario-based"]),
    ("Large Scale System", 1, ["large scale system"]),
    ("Leadership / Behavioral", 1, ["leadership", "behavioral"]),
    ("Python", 1, ["python"]),
    ("Computer Vision", 3, ["computer vision"]),
]

RANDOM_FILTER_ALIASES = {
    "dsa": [
        "dsa", "algorithms", "arrays", "dynamic programming", "graphs",
        "linked lists", "trees", "recursion", "tries", "trie",
    ],
    "system design": ["system design"],
    "computer vision": ["computer vision"],
    "real-life scenario-based": ["real-life scenario-based"],
    "large scale system": ["large scale system"],
    "leadership / behavioral": ["leadership", "behavioral"],
    "python": ["python"],
}


class QuestionIn(BaseModel):
    topic: str
    question: str
    difficulty: Optional[str] = "Medium"
    company: Optional[str] = None
    category: Optional[str] = None
    expected_keywords: Optional[str] = None


@router.post("/", response_model=dict)
async def create_question(body: QuestionIn):
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        cur = await db.execute(
            """INSERT INTO questions (topic, question, difficulty, company, category, expected_keywords)
               VALUES (?, ?, ?, ?, ?, ?)""",
            (body.topic, body.question, body.difficulty or "Medium",
             body.company or None, body.category or None, body.expected_keywords or None),
        )
        await db.commit()
        row_id = cur.lastrowid
        async with db.execute("SELECT * FROM questions WHERE id = ?", (row_id,)) as c:
            return dict(await c.fetchone())


@router.put("/{question_id}", response_model=dict)
async def update_question(question_id: int, body: QuestionIn):
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        await db.execute(
            """UPDATE questions
               SET topic=?, question=?, difficulty=?, company=?, category=?, expected_keywords=?
               WHERE id=?""",
            (body.topic, body.question, body.difficulty or "Medium",
             body.company or None, body.category or None, body.expected_keywords or None,
             question_id),
        )
        await db.commit()
        async with db.execute("SELECT * FROM questions WHERE id = ?", (question_id,)) as c:
            row = await c.fetchone()
    if not row:
        raise HTTPException(404, "Question not found")
    return dict(row)


@router.get("/random", response_model=list[dict])
async def random_questions(
    categories: Optional[str] = Query(None),  # comma-separated category names
    limit: int = Query(10, le=50),
):
    """Return N random questions, optionally filtered by category (LIKE match on category or topic)."""
    conditions = ["1=1"]
    params: list = []

    if categories:
        cat_list = [c.strip() for c in categories.split(",") if c.strip()]
        if cat_list:
            cat_conditions = []
            for cat in cat_list:
                aliases = RANDOM_FILTER_ALIASES.get(cat.casefold(), [cat])
                alias_conditions = []
                for alias in aliases:
                    alias_conditions.append(
                        "(LOWER(COALESCE(category,'')) LIKE ? OR LOWER(COALESCE(topic,'')) LIKE ?)"
                    )
                    params.extend([f"%{alias.lower()}%", f"%{alias.lower()}%"])
                cat_conditions.append(f"({' OR '.join(alias_conditions)})")
            conditions.append(f"({' OR '.join(cat_conditions)})")

    sql = f"SELECT * FROM questions WHERE {' AND '.join(conditions)} ORDER BY RANDOM() LIMIT ?"
    params.append(limit)

    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute(sql, params) as cursor:
            rows = await cursor.fetchall()
    return [dict(r) for r in rows]


@router.get("/practice-set", response_model=list[dict])
async def practice_set():
    """Return the fixed 10-question daily practice distribution."""
    selected: list[dict] = []
    selected_ids: set[int] = set()
    missing: list[str] = []

    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row

        for label, count, aliases in PRACTICE_SET_SLOTS:
            conditions = []
            params: list = []
            for alias in aliases:
                conditions.append(
                    "(LOWER(COALESCE(category,'')) LIKE ? OR LOWER(COALESCE(topic,'')) LIKE ?)"
                )
                params.extend([f"%{alias.lower()}%", f"%{alias.lower()}%"])

            excluded = ""
            if selected_ids:
                placeholders = ",".join("?" * len(selected_ids))
                excluded = f" AND id NOT IN ({placeholders})"
                params.extend(selected_ids)
            if label == "System Design":
                excluded += (
                    " AND LOWER(COALESCE(category,'')) NOT LIKE '%large scale%'"
                    " AND LOWER(COALESCE(topic,'')) NOT LIKE '%large scale%'"
                )
            params.append(count)

            async with db.execute(
                f"""SELECT * FROM questions
                    WHERE ({' OR '.join(conditions)}){excluded}
                    ORDER BY RANDOM() LIMIT ?""",
                params,
            ) as cursor:
                rows = [dict(row) for row in await cursor.fetchall()]

            if len(rows) < count:
                missing.append(f"{label} ({count - len(rows)} missing)")
                continue

            for row in rows:
                row["practice_category"] = label
                selected.append(row)
                selected_ids.add(row["id"])

        if missing:
            raise HTTPException(
                409,
                "Cannot build the 10-question Practice Set. Add questions for: "
                + ", ".join(missing),
            )

        placeholders = ",".join("?" * len(selected_ids))
        async with db.execute(
            f"SELECT * FROM questions WHERE id NOT IN ({placeholders}) ORDER BY RANDOM() LIMIT 1",
            list(selected_ids),
        ) as cursor:
            random_row = await cursor.fetchone()

    if not random_row:
        raise HTTPException(409, "Cannot add the final random question.")

    random_question = dict(random_row)
    random_question["practice_category"] = "Random"
    selected.append(random_question)
    return selected


@router.get("/", response_model=list[dict])
async def list_questions(
    topic: Optional[str] = Query(None),
    difficulty: Optional[str] = Query(None),
    company: Optional[str] = Query(None),
    category: Optional[str] = Query(None),
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
        conditions.append(
            "(',' || REPLACE(LOWER(company), ' ', '') || ',') "
            "LIKE ('%,' || REPLACE(LOWER(?), ' ', '') || ',%')"
        )
        params.append(company)
    if category:
        conditions.append("LOWER(COALESCE(category,'')) LIKE ?")
        params.append(f"%{category.lower()}%")

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
            """SELECT company
               FROM questions
               WHERE company IS NOT NULL AND TRIM(company) != ''"""
        ) as cur:
            rows = await cur.fetchall()

    counts: dict[str, dict[str, str | int]] = {}
    for (raw_company,) in rows:
        # A question may target multiple companies, stored as
        # comma-separated tags such as "Apple, Google".
        tags = {tag.strip() for tag in raw_company.split(",") if tag.strip()}
        for tag in tags:
            key = tag.casefold()
            if key not in counts:
                counts[key] = {"company": tag, "count": 0}
            counts[key]["count"] = int(counts[key]["count"]) + 1

    return sorted(counts.values(), key=lambda item: str(item["company"]).casefold())


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

    # Drop rows where required columns are blank
    df["topic"]    = df["topic"].astype(str).str.strip()
    df["question"] = df["question"].astype(str).str.strip()
    df = df[(df["topic"] != "") & (df["topic"] != "nan") & (df["question"] != "") & (df["question"] != "nan")]

    # Fill optional columns with defaults
    for col in OPTIONAL_COLUMNS:
        if col not in df.columns:
            df[col] = None
    if "difficulty" in df.columns:
        df["difficulty"] = df["difficulty"].fillna("Medium").replace("", "Medium")
    else:
        df["difficulty"] = "Medium"

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
