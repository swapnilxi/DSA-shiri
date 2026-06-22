"""
Resume / document → questions router.

  POST /resume/generate
    Accepts a file (PDF, DOCX, TXT) OR a plain-text topics string.
    Sends extracted content to the LLM, parses structured questions,
    deduplicates against the DB, saves, and returns results.

  GET /resume/history
    Returns past generate jobs from the resumes table.
"""
import io
import json
import re
import os
import aiosqlite
from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from typing import Optional

from config import settings
from services.llm import chat

router = APIRouter(prefix="/resume", tags=["resume"])

DB_PATH = os.path.abspath(
    os.path.join(os.path.dirname(__file__), "..", settings.database_path)
)

VALID_DIFFICULTIES = {"Easy", "Medium", "Hard"}


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
        f"Context (first 4000 chars):\n{context[:4000]}"
    )
    return [{"role": "system", "content": system}, {"role": "user", "content": user}]


def _parse_llm_output(raw: str) -> list[dict]:
    match = re.search(r"\[.*\]", raw, re.DOTALL)
    if not match:
        raise ValueError("No JSON array found in LLM output")
    return json.loads(match.group(0))


# ── DB helpers ────────────────────────────────────────────────────────────────

def _company_set(raw: str | None) -> set[str]:
    return {c.strip() for c in (raw or "").split(",") if c.strip()}


# ── endpoints ─────────────────────────────────────────────────────────────────

@router.post("/generate")
async def generate_from_source(
    file: Optional[UploadFile] = File(None),
    topics: Optional[str] = Form(None),
    num_questions: int = Form(10),
    difficulty: str = Form("Mixed"),
    model: Optional[str] = Form(None),
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

    # Clamp question count
    num_questions = max(1, min(num_questions, 30))

    # Call LLM
    messages = _build_messages(context, num_questions, difficulty)
    llm_model = model or settings.ollama_model
    try:
        raw_output = await chat(messages, model=llm_model)
    except Exception as exc:
        raise HTTPException(502, f"LLM error: {exc}")

    try:
        questions = _parse_llm_output(raw_output)
    except Exception:
        raise HTTPException(
            502,
            f"LLM returned unparseable output. Preview: {raw_output[:400]}",
        )

    # Normalise
    clean: list[dict] = []
    for q in questions:
        text = (q.get("question") or "").strip()
        if not text:
            continue
        diff = (q.get("difficulty") or "Medium").strip().capitalize()
        if diff not in VALID_DIFFICULTIES:
            diff = "Medium"
        clean.append(
            {
                "topic": (q.get("topic") or "General").strip(),
                "question": text,
                "difficulty": diff,
                "category": (q.get("category") or "").strip(),
                "expected_keywords": (q.get("expected_keywords") or "").strip(),
            }
        )

    if not clean:
        raise HTTPException(502, "LLM produced no valid questions.")

    # Persist to DB
    inserted = skipped = 0
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute(
            "INSERT INTO resumes (filename, parsed_text, questions_generated) VALUES (?, ?, ?)",
            (source, context[:2000], len(clean)),
        )

        for q in clean:
            cur = await db.execute(
                "SELECT id FROM questions WHERE LOWER(TRIM(question)) = LOWER(TRIM(?))",
                (q["question"],),
            )
            if await cur.fetchone() is None:
                await db.execute(
                    """INSERT INTO questions
                           (topic, question, difficulty, category, expected_keywords, source_file)
                       VALUES (?, ?, ?, ?, ?, ?)""",
                    (
                        q["topic"],
                        q["question"],
                        q["difficulty"],
                        q["category"],
                        q["expected_keywords"],
                        source,
                    ),
                )
                inserted += 1
            else:
                skipped += 1

        await db.commit()

    return {
        "questions": clean,
        "inserted": inserted,
        "skipped": skipped,
        "source": source,
        "model_used": llm_model,
    }


@router.get("/history")
async def generate_history(limit: int = 20):
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute(
            "SELECT id, filename, questions_generated, uploaded_at FROM resumes ORDER BY id DESC LIMIT ?",
            (limit,),
        ) as cur:
            rows = await cur.fetchall()
    return [dict(r) for r in rows]
