"""
Assessment engine — evaluates a spoken answer against a question using the local LLM.
Returns a structured ScoreBreakdown and generates a follow-up question.
"""
import json
import re

from models.score import ScoreBreakdown
from services.llm import chat

SYSTEM_PROMPT = """You are a senior technical interviewer at a top FAANG company (Google/Meta/Amazon level).
Your job is to evaluate a candidate's spoken answer and provide structured, constructive feedback.
Be rigorous but fair — the goal is to help the candidate understand their gaps and improve.
Always respond with valid JSON only, no extra text."""

SCORE_PROMPT_TEMPLATE = """
Question: {question}
Expected keywords/concepts: {expected_keywords}
Candidate's answer: {transcript}

Evaluate the answer on this rubric and return JSON:
{{
  "technical_correctness": <0-40, is the core answer correct?>,
  "depth_completeness": <0-25, edge cases, trade-offs, alternatives covered?>,
  "communication_clarity": <0-20, clear structure, good examples, concise?>,
  "problem_solving": <0-15, logical approach, asked clarifying questions?>,
  "total": <sum of above>,
  "llm_feedback": "<2-3 sentence honest assessment of the answer. What was good, what was missing, what to study>",
  "follow_up_asked": "<a natural follow-up question a real interviewer would ask based on their answer>"
}}
"""

OPENING_PROMPT_TEMPLATE = """You are starting a technical interview for the topic: {topic}.
The candidate wants to practice at FAANG level.
Greet them naturally (1-2 sentences), then ask this question in a conversational way:

Question: {question}

Keep it under 3 sentences total. Sound like a human interviewer, not a robot."""


async def score_answer(
    question: str,
    transcript: str,
    expected_keywords: str = "",
    model: str | None = None,
) -> ScoreBreakdown:
    prompt = SCORE_PROMPT_TEMPLATE.format(
        question=question,
        expected_keywords=expected_keywords or "not specified",
        transcript=transcript or "(no answer given)",
    )

    raw = await chat([
        {"role": "system", "content": SYSTEM_PROMPT},
        {"role": "user", "content": prompt},
    ], model=model)

    # Extract JSON from response (handles models that add markdown fences)
    json_str = _extract_json(raw)
    data = json.loads(json_str)

    return ScoreBreakdown(
        technical_correctness=float(data.get("technical_correctness", 0)),
        depth_completeness=float(data.get("depth_completeness", 0)),
        communication_clarity=float(data.get("communication_clarity", 0)),
        problem_solving=float(data.get("problem_solving", 0)),
        total=float(data.get("total", 0)),
        llm_feedback=data.get("llm_feedback", ""),
        follow_up_asked=data.get("follow_up_asked"),
    )


async def generate_opening(topic: str, question: str, model: str | None = None) -> str:
    """Generate a natural interviewer opening for the first question."""
    prompt = OPENING_PROMPT_TEMPLATE.format(topic=topic, question=question)
    return await chat([
        {"role": "system", "content": "You are a friendly but rigorous FAANG interviewer."},
        {"role": "user", "content": prompt},
    ], model=model)


async def generate_encouragement(score: float, model: str | None = None) -> str:
    """Brief transitional phrase before the next question."""
    if score >= 80:
        context = "excellent answer"
    elif score >= 60:
        context = "decent answer with some gaps"
    else:
        context = "incomplete answer"

    return await chat([
        {"role": "system", "content": "You are a FAANG interviewer. Give a 1-sentence neutral transition to the next question."},
        {"role": "user", "content": f"The candidate gave a {context} (score: {score:.0f}/100). Transition naturally."},
    ], model=model)


SESSION_ANALYSIS_SYSTEM = """You are a senior FAANG engineering coach reviewing a mock interview session.
Analyse ALL questions and answers together and return a single JSON object — no extra text."""

SESSION_ANALYSIS_TEMPLATE = """Session topic: {topic}

Questions and answers:
{qa_block}

Return ONLY valid JSON with this structure:
{{
  "summary": "<2-3 sentences: overall impression, what the candidate did well and where they fell short>",
  "strengths": ["<specific strength 1>", "<specific strength 2>"],
  "weak_areas": [
    {{
      "topic": "<topic name>",
      "reason": "<why this area was weak based on their answers>",
      "study_topics": ["<concept/algo/system to study>", ...],
      "how_to_improve": "<concrete advice: what to practice, what to build>"
    }}
  ],
  "per_question": [
    {{
      "index": <0-based>,
      "score": <total score 0-100>,
      "what_was_good": "<what the candidate got right>",
      "what_was_missing": "<key concepts/points they skipped>",
      "ideal_outline": "<bullet-style outline of a strong answer: point A; point B; point C>"
    }}
  ],
  "learning_plan": [
    {{ "priority": 1, "action": "<most important thing to study/practice next>" }},
    {{ "priority": 2, "action": "<second most important>" }},
    {{ "priority": 3, "action": "<third>" }}
  ],
  "readiness": "Strong" | "Needs Work" | "Not Ready"
}}"""


async def analyze_session(
    topic: str,
    responses: list[dict],
    model: str | None = None,
) -> dict:
    """Generate a comprehensive post-session learning report."""
    qa_lines = []
    for i, r in enumerate(responses):
        score_str = f"{r.get('total', '?')}/100" if r.get('total') is not None else "not scored"
        qa_lines.append(
            f"Q{i+1} [{r.get('topic', topic)} | {r.get('difficulty', '?')} | {score_str}]:\n"
            f"  Question: {r.get('question', '')}\n"
            f"  Answer:   {r.get('transcript') or '(no answer given)'}\n"
            f"  Feedback: {r.get('llm_feedback') or '(none)'}"
        )

    prompt = SESSION_ANALYSIS_TEMPLATE.format(
        topic=topic,
        qa_block="\n\n".join(qa_lines),
    )

    raw = await chat([
        {"role": "system", "content": SESSION_ANALYSIS_SYSTEM},
        {"role": "user", "content": prompt},
    ], model=model)

    return json.loads(_extract_json(raw))


def _extract_json(text: str) -> str:
    match = re.search(r"```(?:json)?\s*([\s\S]+?)\s*```", text)
    if match:
        return match.group(1)
    # Try to find raw JSON object
    match = re.search(r"\{[\s\S]+\}", text)
    if match:
        return match.group(0)
    return text
