"""
Resume / document → questions router.

  POST /resume/generate
    Accepts a file (PDF, DOCX, TXT) OR a plain-text topics string.
    Always saves the resume record to DB when a file is uploaded.
    Sends extracted content to the LLM, parses structured questions,
    deduplicates against the DB, saves questions only when save=True.

  POST /resume/generate-from-ids
    Accepts a JSON body with resume_ids, generates questions from stored text.

  POST /resume/save
    Persist a pre-generated list of questions to the DB.

  GET /resume/history
    Returns all saved resumes (newest first).

  DELETE /resume/{resume_id}
    Delete a resume record from the DB.
"""
import io
import json
import re
import os
import aiosqlite
from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from pydantic import BaseModel
from typing import Optional

from config import settings
from services.llm import chat

router = APIRouter(prefix="/resume", tags=["resume"])

DB_PATH = os.path.abspath(
    os.path.join(os.path.dirname(__file__), "..", settings.database_path)
)

VALID_DIFFICULTIES = {"Easy", "Medium", "Hard"}
MAX_STORED_CHARS = 8000   # stored in DB for future regeneration
MAX_CONTEXT_CHARS = 8000  # sent to LLM


# ── text extraction ──────────────────────────────────────────────────────────

def _extract_pdf(data: bytes) -> str:
    try:
        import pypdf
        reader = pypdf.PdfReader(io.BytesIO(data))
        return "\n".join(page.extract_text() or "" for page in reader.pages)
    except ImportError:
        raise HTTPException(500, "pypdf not installed — run: pip install pypdf")


def _extract_docx(data: bytes) -> str:
    try:
        import docx
        doc = docx.Document(io.BytesIO(data))
        return "\n".join(p.text for p in doc.paragraphs)
    except ImportError:
        raise HTTPException(500, "python-docx not installed — run: pip install python-docx")


def _extract_text(filename: str, data: bytes) -> str:
    ext = filename.lower().rsplit(".", 1)[-1]
    if ext == "pdf":
        return _extract_pdf(data)
    if ext in ("docx", "doc"):
        return _extract_docx(data)
    if ext in ("txt", "md"):
        return data.decode("utf-8", errors="replace")
    raise HTTPException(400, f"Unsupported file type: .{ext}  (use PDF, DOCX, or TXT)")


# ── LLM prompt ───────────────────────────────────────────────────────────────

def _build_messages(context: str, num_questions: int, difficulty: str) -> list[dict]:
    diff_line = (
        f"All questions must be {difficulty} difficulty."
        if difficulty != "Mixed"
        else "Use a mix of Easy, Medium, and Hard difficulties."
    )
    system = (
        "You are an expert technical interviewer. "
        "Return ONLY a valid JSON array — no markdown, no extra text.\n"
        "Each element must have exactly these keys:\n"
        '  "topic"            – broad category (e.g. "System Design", "Algorithms", "Behavioral")\n'
        '  "question"         – the interview question\n'
        '  "difficulty"       – "Easy" | "Medium" | "Hard"\n'
        '  "category"         – specific sub-topic\n'
        '  "expected_keywords"– comma-separated key concepts the answer should cover\n'
        "Example: "
        '[{"topic":"Algorithms","question":"...","difficulty":"Medium",'
        '"category":"Dynamic Programming","expected_keywords":"memoization,DP table"}]'
    )
    user = (
        f"Generate exactly {num_questions} interview questions based on the context below. "
        f"{diff_line}\n\n"
        f"Context:\n{context[:MAX_CONTEXT_CHARS]}"
    )
    return [{"role": "system", "content": system}, {"role": "user", "content": user}]


def _parse_llm_output(raw: str) -> list[dict]:
    match = re.search(r"\[.*\]", raw, re.DOTALL)
    if not match:
        raise ValueError("No JSON array found in LLM output")
    return json.loads(match.group(0))


def _normalise(questions: list[dict]) -> list[dict]:
    clean = []
    for q in questions:
        text = (q.get("question") or "").strip()
        if not text:
            continue
        diff = (q.get("difficulty") or "Medium").strip().capitalize()
        if diff not in VALID_DIFFICULTIES:
            diff = "Medium"
        clean.append({
            "topic": (q.get("topic") or "General").strip(),
            "question": text,
            "difficulty": diff,
            "category": (q.get("category") or "").strip(),
            "expected_keywords": (q.get("expected_keywords") or "").strip(),
        })
    return clean


async def _run_llm(context: str, num_questions: int, difficulty: str, model: str) -> list[dict]:
    messages = _build_messages(context, num_questions, difficulty)
    try:
        raw_output = await chat(messages, model=model)
    except Exception as exc:
        raise HTTPException(502, f"LLM error: {exc}")
    try:
        questions = _parse_llm_output(raw_output)
    except Exception:
        raise HTTPException(502, f"LLM returned unparseable output. Preview: {raw_output[:400]}")
    clean = _normalise(questions)
    if not clean:
        raise HTTPException(502, "LLM produced no valid questions.")
    return clean


async def _save_questions_to_db(db: aiosqlite.Connection, questions: list[dict], source: str) -> tuple[int, int]:
    inserted = skipped = 0
    for q in questions:
        cur = await db.execute(
            "SELECT id FROM questions WHERE LOWER(TRIM(question)) = LOWER(TRIM(?))",
            (q["question"],),
        )
        if await cur.fetchone() is None:
            await db.execute(
                """INSERT INTO questions
                       (topic, question, difficulty, category, expected_keywords, source_file)
                   VALUES (?, ?, ?, ?, ?, ?)""",
                (q["topic"], q["question"], q["difficulty"],
                 q["category"], q["expected_keywords"], source),
            )
            inserted += 1
        else:
            skipped += 1
    return inserted, skipped


# ── endpoints ─────────────────────────────────────────────────────────────────

@router.get("/history")
async def list_resumes(limit: int = 50):
    """All saved resumes, newest first."""
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute(
            """SELECT id, filename, questions_generated, uploaded_at,
                      SUBSTR(parsed_text, 1, 200) AS preview
               FROM resumes ORDER BY id DESC LIMIT ?""",
            (limit,),
        ) as cur:
            rows = await cur.fetchall()
    return [dict(r) for r in rows]


@router.delete("/history/{resume_id}")
async def delete_resume(resume_id: int):
    async with aiosqlite.connect(DB_PATH) as db:
        cur = await db.execute("SELECT id FROM resumes WHERE id = ?", (resume_id,))
        if not await cur.fetchone():
            raise HTTPException(404, "Resume not found.")
        await db.execute("DELETE FROM resumes WHERE id = ?", (resume_id,))
        await db.commit()
    return {"deleted": resume_id}


@router.post("/save")
async def save_questions(questions: list[dict]):
    """Persist a list of already-generated questions to the DB."""
    if not questions:
        raise HTTPException(400, "No questions provided.")

    inserted = skipped = 0
    async with aiosqlite.connect(DB_PATH) as db:
        for q in questions:
            text = (q.get("question") or "").strip()
            if not text:
                continue
            diff = (q.get("difficulty") or "Medium").strip().capitalize()
            if diff not in VALID_DIFFICULTIES:
                diff = "Medium"
            cur = await db.execute(
                "SELECT id FROM questions WHERE LOWER(TRIM(question)) = LOWER(TRIM(?))",
                (text,),
            )
            if await cur.fetchone() is None:
                await db.execute(
                    """INSERT INTO questions
                           (topic, question, difficulty, category, expected_keywords, source_file)
                       VALUES (?, ?, ?, ?, ?, ?)""",
                    (
                        (q.get("topic") or "General").strip(),
                        text,
                        diff,
                        (q.get("category") or "").strip(),
                        (q.get("expected_keywords") or "").strip(),
                        (q.get("source") or "manual"),
                    ),
                )
                inserted += 1
            else:
                skipped += 1
        await db.commit()
    return {"inserted": inserted, "skipped": skipped}


class GenerateFromIdsRequest(BaseModel):
    resume_ids: list[int]
    num_questions: int = 10
    difficulty: str = "Mixed"
    model: Optional[str] = None


@router.post("/upload")
async def upload_to_library(file: UploadFile = File(...)):
    """Extract text from a file and save it to the resume library without generating questions."""
    if not file.filename:
        raise HTTPException(400, "No filename provided.")
    raw_bytes = await file.read()
    context = _extract_text(file.filename, raw_bytes)
    if not context.strip():
        raise HTTPException(400, "Could not extract any text from the file.")
    async with aiosqlite.connect(DB_PATH) as db:
        cursor = await db.execute(
            "INSERT INTO resumes (filename, parsed_text, questions_generated) VALUES (?, ?, ?)",
            (file.filename, context[:MAX_STORED_CHARS], 0),
        )
        resume_id = cursor.lastrowid
        await db.commit()
    return {"id": resume_id, "filename": file.filename}


@router.post("/generate-from-ids")
async def generate_from_saved(req: GenerateFromIdsRequest):
    """Generate questions from one or more saved resumes by their IDs."""
    if not req.resume_ids:
        raise HTTPException(400, "Provide at least one resume_id.")

    num_questions = max(1, min(req.num_questions, 30))
    llm_model = req.model or settings.ollama_model

    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        placeholders = ",".join("?" * len(req.resume_ids))
        async with db.execute(
            f"SELECT id, filename, parsed_text FROM resumes WHERE id IN ({placeholders})",
            req.resume_ids,
        ) as cur:
            rows = [dict(r) for r in await cur.fetchall()]

    if not rows:
        raise HTTPException(404, "None of the provided resume IDs were found.")

    source_names = ", ".join(r["filename"] for r in rows)
    combined_text = "\n\n---\n\n".join(
        f"[{r['filename']}]\n{r['parsed_text'] or ''}" for r in rows
    )

    clean = await _run_llm(combined_text, num_questions, req.difficulty, llm_model)

    return {
        "questions": clean,
        "inserted": 0,
        "skipped": 0,
        "source": source_names,
        "model_used": llm_model,
    }


@router.post("/generate")
async def generate_from_source(
    file: Optional[UploadFile] = File(None),
    topics: Optional[str] = Form(None),
    num_questions: int = Form(10),
    difficulty: str = Form("Mixed"),
    model: Optional[str] = Form(None),
    save: bool = Form(False),
):
    if not file and not (topics and topics.strip()):
        raise HTTPException(400, "Provide a file upload or enter topics text.")

    # Build context string
    if file and file.filename:
        raw_bytes = await file.read()
        context = _extract_text(file.filename, raw_bytes)
        source = file.filename
    else:
        context = (topics or "").strip()
        source = "topics"

    if not context.strip():
        raise HTTPException(400, "Could not extract any text from the input.")

    num_questions = max(1, min(num_questions, 30))
    llm_model = model or settings.ollama_model

    clean = await _run_llm(context, num_questions, difficulty, llm_model)

    inserted = skipped = 0
    async with aiosqlite.connect(DB_PATH) as db:
        # Always store the resume record when a file is uploaded so it appears in the library
        if file and file.filename:
            await db.execute(
                "INSERT INTO resumes (filename, parsed_text, questions_generated) VALUES (?, ?, ?)",
                (source, context[:MAX_STORED_CHARS], len(clean) if save else 0),
            )

        if save:
            if not (file and file.filename):
                # topics-mode: store a record too
                await db.execute(
                    "INSERT INTO resumes (filename, parsed_text, questions_generated) VALUES (?, ?, ?)",
                    (source, context[:MAX_STORED_CHARS], len(clean)),
                )
            inserted, skipped = await _save_questions_to_db(db, clean, source)

        await db.commit()

    return {
        "questions": clean,
        "inserted": inserted,
        "skipped": skipped,
        "source": source,
        "model_used": llm_model,
    }
