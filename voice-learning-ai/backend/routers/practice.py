"""
Interactive practice endpoints — fetch a single question and generate AI-powered study content.
"""
import json as _json
import os
from typing import Optional

import aiosqlite
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from config import settings
from services.llm import chat

router = APIRouter(prefix="/practice", tags=["practice"])
DB_PATH = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", settings.database_path))


class GenerateRequest(BaseModel):
    type: str  # hints | concepts | approach | sample_answer | followups
    model: Optional[str] = None


class ChatRequest(BaseModel):
    message: str
    history: list[dict] = []
    model: Optional[str] = None


def _strip_fences(raw: str) -> str:
    raw = raw.strip()
    if raw.startswith("```"):
        parts = raw.split("```")
        raw = parts[1] if len(parts) > 1 else raw
        if raw.startswith("json"):
            raw = raw[4:]
    return raw.strip()


async def _get_question(question_id: int) -> dict:
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute("SELECT * FROM questions WHERE id = ?", (question_id,)) as cur:
            row = await cur.fetchone()
    if not row:
        raise HTTPException(404, "Question not found")
    return dict(row)


@router.get("/{question_id}")
async def get_question(question_id: int):
    return await _get_question(question_id)


@router.post("/{question_id}/generate")
async def generate_practice_content(question_id: int, body: GenerateRequest):
    q = await _get_question(question_id)
    question_text = q["question"]
    topic = q.get("topic") or ""
    difficulty = q.get("difficulty") or "Medium"
    category = q.get("category") or ""

    PROMPTS = {
        "hints": f"""You are a concise technical interview tutor.
Generate exactly 3 progressive hints for the question below, going from subtle nudge to near-explicit.
Return ONLY a JSON array of 3 strings — no extra text.

Question: {question_text}
Topic: {topic}, Difficulty: {difficulty}

["hint 1", "hint 2", "hint 3"]""",

        "concepts": f"""You are a technical interview tutor.
List the 5-8 core knowledge areas needed to answer this question.
Return ONLY a JSON array of short concept strings.

Question: {question_text}
Topic: {topic}, Category: {category}

["concept 1", ...]""",

        "approach": f"""You are a technical interview tutor.
Give a structured approach guide for tackling this question — thinking steps, not the full answer.
Return ONLY a JSON object with two keys:
  "steps": array of approach steps (strings)
  "tips": array of short interviewer tips (strings)

Question: {question_text}
Topic: {topic}, Difficulty: {difficulty}

{{"steps": [...], "tips": [...]}}""",

        "sample_answer": f"""You are a technical interview tutor.
Write a comprehensive sample answer. Include relevant examples and, where applicable, time/space complexity.
Return ONLY a JSON object:
  "answer": full answer as markdown string
  "key_points": array of 3-5 bullet-point takeaways

Question: {question_text}
Topic: {topic}, Difficulty: {difficulty}

{{"answer": "...", "key_points": [...]}}""",

        "followups": f"""You are a technical interview tutor.
Generate 4 follow-up questions an interviewer might ask to probe deeper understanding.
Return ONLY a JSON array of 4 question strings.

Question: {question_text}
Topic: {topic}

["follow-up 1?", ...]""",

        "deep_dive": f"""You are a senior engineer and educator who excels at connecting abstract technical concepts to real-world engineering.

Given the interview question below, produce a DEEP DIVE that helps a student truly understand the topic — not just answer the interview question, but genuinely grasp it.

Return ONLY a JSON object with exactly these keys:

{{
  "tldr": "string — one crisp paragraph that nails the essence of this topic",
  "real_world_scenarios": [
    {{
      "title": "string — name of the scenario (e.g. 'Netflix recommendation engine')",
      "context": "string — 1-2 sentences setting the scene",
      "how_it_applies": "string — how the concept from the question is used here, concretely",
      "what_breaks_without_it": "string — what goes wrong if you ignore this concept"
    }}
  ],
  "core_concepts": [
    {{
      "name": "string — concept name",
      "one_liner": "string — one sentence definition",
      "deep_explanation": "string — 3-5 sentences of real depth, not textbook fluff",
      "analogy": "string — an everyday analogy that makes it stick"
    }}
  ],
  "mental_model": "string — a clear mental model or visual metaphor for thinking about this topic (2-3 sentences)",
  "common_misconceptions": ["string — misconception people have", ...],
  "how_experts_think_about_it": "string — how a senior engineer actually reasons about this day-to-day (2-3 sentences)",
  "rabbit_holes": ["string — name of a related deep topic worth exploring if curious", ...]
}}

Include 2-3 real_world_scenarios and 3-4 core_concepts. Make it genuinely educational.

Question: {question_text}
Topic: {topic}, Category: {category}, Difficulty: {difficulty}""",

        "quiz": f"""You are a technical quiz creator.
Generate 4 multiple-choice questions that test the concepts needed to answer this interview question.
Make them educational — test understanding and reasoning, not trivia or memorisation.
Return ONLY a JSON array of 4 objects, each with:
  "question": string
  "options": array of exactly 4 strings (the choices)
  "correct_index": integer 0-3 (index of the correct option)
  "explanation": string (why the correct answer is right, 1-2 sentences)

Interview Question: {question_text}
Topic: {topic}, Category: {category}, Difficulty: {difficulty}

[{{"question":"...","options":["A","B","C","D"],"correct_index":0,"explanation":"..."}}]""",
    }

    if body.type not in PROMPTS:
        raise HTTPException(400, f"Unknown type '{body.type}'. Valid: {list(PROMPTS.keys())}")

    try:
        raw = await chat([{"role": "user", "content": PROMPTS[body.type]}], model=body.model)
        content = _json.loads(_strip_fences(raw))
        return {"type": body.type, "content": content}
    except _json.JSONDecodeError as e:
        raise HTTPException(500, f"LLM returned invalid JSON: {e}")
    except Exception as e:
        raise HTTPException(500, f"Generation failed: {e}")


@router.post("/{question_id}/chat")
async def practice_chat(question_id: int, body: ChatRequest):
    q = await _get_question(question_id)

    system = (
        "You are a friendly AI study assistant helping a student prepare for technical interviews.\n\n"
        f"The student is working on this question:\n"
        f"Question: {q['question']}\n"
        f"Topic: {q.get('topic') or ''}\n"
        f"Category: {q.get('category') or ''}\n"
        f"Difficulty: {q.get('difficulty') or 'Medium'}\n\n"
        "Your role:\n"
        "- Explain concepts clearly; give hints without revealing the full answer unless asked.\n"
        "- Answer follow-up questions about the topic.\n"
        "- Encourage good problem-solving habits.\n"
        "- Be concise. Use markdown for code and structured content."
    )

    messages = [{"role": "system", "content": system}]
    for msg in body.history[-12:]:
        messages.append({"role": msg["role"], "content": msg["content"]})
    messages.append({"role": "user", "content": body.message})

    try:
        reply = await chat(messages, model=body.model)
        return {"reply": reply}
    except Exception as e:
        raise HTTPException(500, f"Chat failed: {e}")


class AnalyseAnswerRequest(BaseModel):
    transcript: str
    scores: dict = {}
    model: Optional[str] = None


@router.post("/{question_id}/analyse-answer")
async def analyse_answer(question_id: int, body: AnalyseAnswerRequest):
    """Deep-analyse a student's recorded answer and return a teaching breakdown."""
    q = await _get_question(question_id)

    score_context = ""
    if body.scores:
        score_context = (
            "\nScores received:\n"
            f"  Technical Correctness : {body.scores.get('technical_correctness', '?')}/40\n"
            f"  Depth & Completeness  : {body.scores.get('depth_completeness', '?')}/25\n"
            f"  Communication Clarity : {body.scores.get('communication_clarity', '?')}/20\n"
            f"  Problem Solving       : {body.scores.get('problem_solving', '?')}/15\n"
            f"  Total                 : {body.scores.get('total', '?')}/100\n"
        )

    prompt = f"""You are an expert technical interview coach doing a deep analysis of a student's answer.

Question: {q['question']}
Topic: {q.get('topic') or ''}, Category: {q.get('category') or ''}, Difficulty: {q.get('difficulty') or 'Medium'}
{score_context}
Student's answer (verbatim transcript):
\"\"\"{body.transcript}\"\"\"

Give a THOROUGH, EDUCATIONAL analysis. Be specific to their actual words — do not give generic advice.
Return ONLY a JSON object with these keys:
{{
  "what_you_got_right": "string — specific things in their answer that were correct or on the right track",
  "key_gaps": ["array of specific things they missed, were incomplete on, or could have said better"],
  "misconceptions": ["array of incorrect statements or wrong reasoning; empty array [] if none found"],
  "mini_lesson": "string — a focused markdown mini-lesson that fills exactly the gaps identified. Use ## headers, bullet points, code blocks where relevant. Teach, don't just list.",
  "next_steps": ["array of 3-4 specific, actionable practice suggestions tailored to their weaknesses"],
  "stronger_answer_outline": "string — a brief outline of what a strong answer to this question would include"
}}"""

    try:
        raw = await chat([{"role": "user", "content": prompt}], model=body.model)
        content = _json.loads(_strip_fences(raw))
        return content
    except _json.JSONDecodeError as e:
        raise HTTPException(500, f"LLM returned invalid JSON: {e}")
    except Exception as e:
        raise HTTPException(500, f"Analysis failed: {e}")
