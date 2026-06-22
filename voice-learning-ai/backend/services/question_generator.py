"""
Resume-based question generator — given extracted resume text, uses the LLM
to generate tailored interview questions returned as structured dicts.
"""
import json
import re
from services.llm import chat

SYSTEM_PROMPT = """You are a senior technical interviewer at a top FAANG company.
Generate targeted interview questions based on a candidate's resume.
Analyze the resume carefully and create questions that probe their actual experience.
Always respond with valid JSON only, no extra text."""

GENERATION_PROMPT = """Analyze this resume and generate {count} technical interview questions tailored to this candidate's background.

Resume:
{resume_text}

Generate diverse questions that:
- Test specific skills, frameworks, and technologies mentioned
- Probe projects and real-world experience described
- Cover a mix of Easy, Medium, and Hard difficulties
- Span relevant categories (Algorithm, System Design, Behavioral, Frontend, Backend, Database, DevOps, etc.)

Return ONLY valid JSON:
{{
  "questions": [
    {{
      "topic": "<main skill/technology from resume>",
      "question": "<specific interview question>",
      "difficulty": "<Easy|Medium|Hard>",
      "category": "<category>",
      "expected_keywords": "<comma-separated key concepts expected in a strong answer>"
    }}
  ]
}}"""


async def generate_from_resume(
    resume_text: str,
    count: int = 10,
    model: str | None = None,
) -> list[dict]:
    prompt = GENERATION_PROMPT.format(
        resume_text=resume_text[:6000],
        count=count,
    )
    raw = await chat([
        {"role": "system", "content": SYSTEM_PROMPT},
        {"role": "user", "content": prompt},
    ], model=model)

    json_str = _extract_json(raw)
    data = json.loads(json_str)
    questions = data.get("questions", [])

    result = []
    for q in questions:
        question_text = str(q.get("question", "")).strip()
        if not question_text:
            continue
        diff = q.get("difficulty", "Medium")
        if diff not in {"Easy", "Medium", "Hard"}:
            diff = "Medium"
        result.append({
            "topic": str(q.get("topic", "General")).strip(),
            "question": question_text,
            "difficulty": diff,
            "category": str(q.get("category", "")).strip() or None,
            "expected_keywords": str(q.get("expected_keywords", "")).strip() or None,
        })
    return result


def _extract_json(text: str) -> str:
    match = re.search(r"```(?:json)?\s*([\s\S]+?)\s*```", text)
    if match:
        return match.group(1)
    match = re.search(r"\{[\s\S]+\}", text)
    if match:
        return match.group(0)
    return text
