"""
Assessment engine for primary scoring, follow-up coaching, and session analysis.
"""
import json
import re

from models.score import ScoreBreakdown
from services.llm import chat

MIN_FOLLOWUP_SCORE_TO_STOP = 86

SYSTEM_PROMPT = """You are a senior technical interviewer at a top FAANG company.
Your job is to evaluate a candidate's spoken answer and provide structured, constructive feedback.
Be rigorous but fair and always respond with valid JSON only.
Address the learner directly as "you". Do not refer to them as "the candidate", "they", "he", or "she" in feedback."""

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
  "llm_feedback": "<2-3 sentence honest assessment addressed directly to you. What was good, what was missing, what to study>",
  "follow_up_asked": "<a natural follow-up question addressed directly to you>"
}}
"""

OPENING_PROMPT_TEMPLATE = """You are starting a technical interview for the topic: {topic}.
The candidate wants to practice at FAANG level.
Greet them naturally (1-2 sentences), then ask this question in a conversational way:

Question: {question}

Keep it under 3 sentences total. Sound like a human interviewer, not a robot."""

FOLLOWUP_OPENING_SYSTEM = """You are a strong technical interviewer and teacher.
You are starting follow-up mode for a single interview question.
Stay on the same topic, teach briefly, then ask one sharp follow-up question.
Return JSON only."""

FOLLOWUP_OPENING_TEMPLATE = """Interview question: {question}
Topic: {topic}
Category: {category}
Difficulty: {difficulty}
Expected keywords/concepts: {expected_keywords}

Return JSON with this shape:
{{
  "assistant_text": "<2-4 sentences. Give context, frame what matters, then ask the first probing follow-up question>",
  "first_question": "<the exact deeper follow-up question you want answered>",
  "focus_areas": ["<concept 1>", "<concept 2>"]
}}

The follow-up question should stay on the same question and push deeper into trade-offs, failure modes, scale, design choices, or conceptual depth."""

FOLLOWUP_REVIEW_SYSTEM = """You are a rigorous but educational technical interviewer.
You are in follow-up mode, which means you must stay on the same interview question.
Your job is to explain what the candidate now understands, what is still missing, and what deeper question to ask next.
Address the learner directly as "you". Do not refer to them as "the candidate", "they", "he", or "she" in feedback.
Return JSON only."""

FOLLOWUP_REVIEW_TEMPLATE = """Original interview question: {question}
Expected keywords/concepts: {expected_keywords}
Candidate's original answer: {original_answer}

Prior follow-up turns:
{history_block}

Latest candidate answer:
{latest_answer}

Current follow-up round: {round_number}

Return JSON with this shape:
{{
  "understanding_score": <0-100>,
  "what_they_now_understand": ["<specific idea you understand now>", "..."],
  "remaining_gaps": ["<specific gap you still have>", "..."],
  "coach_feedback": "<2-4 sentences speaking directly to you about what is right, what is still weak, and why it matters>",
  "deeper_explanation": "<2-4 sentences of concrete teaching. Add context, trade-offs, examples, or failure modes>",
  "hint": "<one focused hint or mental model>",
  "next_question": "<one deeper interviewer-style question that stays on the same topic>"
}}

The next question must sharpen the same topic rather than switching to a new topic."""

FOLLOWUP_REPORT_SYSTEM = """You are a senior interview coach writing a saved follow-up report for one interview question.
The goal is to judge conceptual depth after a follow-up grilling sequence and give targeted advice.
Address the learner directly as "you". Do not refer to them as "the candidate", "they", "he", or "she" in feedback.
Return JSON only."""

FOLLOWUP_REPORT_TEMPLATE = """Question: {question}
Expected keywords/concepts: {expected_keywords}
Original answer: {original_answer}
Initial rubric feedback: {initial_feedback}

Follow-up turns:
{history_block}

Return JSON with this shape:
{{
  "understanding_score": <0-100>,
  "overall_assessment": "<2-4 sentence summary of your depth on this exact question>",
  "strengths": ["<strength>", "..."],
  "remaining_gaps": ["<gap>", "..."],
  "concepts_mastered": ["<concept>", "..."],
  "concepts_to_review": ["<concept>", "..."],
  "recommended_drills": ["<concrete practice action>", "..."],
  "ideal_answer_extension": "<what a stronger deeper answer would have added beyond the original response>"
}}
"""

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

    raw = await chat(
        [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": prompt},
        ],
        model=model,
    )

    data = json.loads(_extract_json(raw))
    return ScoreBreakdown(
        technical_correctness=float(data.get("technical_correctness", 0)),
        depth_completeness=float(data.get("depth_completeness", 0)),
        communication_clarity=float(data.get("communication_clarity", 0)),
        problem_solving=float(data.get("problem_solving", 0)),
        total=float(data.get("total", 0)),
        llm_feedback=_personalize_text(data.get("llm_feedback", "")),
        follow_up_asked=_personalize_text(data.get("follow_up_asked")),
    )


async def generate_opening(topic: str, question: str, model: str | None = None) -> str:
    prompt = OPENING_PROMPT_TEMPLATE.format(topic=topic, question=question)
    return await chat(
        [
            {"role": "system", "content": "You are a friendly but rigorous FAANG interviewer."},
            {"role": "user", "content": prompt},
        ],
        model=model,
    )


async def generate_followup_opening(
    question: str,
    topic: str,
    category: str,
    difficulty: str,
    expected_keywords: str = "",
    model: str | None = None,
) -> dict:
    raw = await chat(
        [
            {"role": "system", "content": FOLLOWUP_OPENING_SYSTEM},
            {
                "role": "user",
                "content": FOLLOWUP_OPENING_TEMPLATE.format(
                    question=question,
                    topic=topic or "General",
                    category=category or "General",
                    difficulty=difficulty or "Medium",
                    expected_keywords=expected_keywords or "not specified",
                ),
            },
        ],
        model=model,
    )
    data = json.loads(_extract_json(raw))
    return {
        "assistant_text": _personalize_text(data.get("assistant_text", "")),
        "first_question": _personalize_text(data.get("first_question", "")),
        "focus_areas": _personalize_list(data.get("focus_areas")),
    }


async def review_followup_answer(
    question: str,
    original_answer: str,
    latest_answer: str,
    turns: list[dict],
    round_number: int,
    expected_keywords: str = "",
    model: str | None = None,
) -> dict:
    raw = await chat(
        [
            {"role": "system", "content": FOLLOWUP_REVIEW_SYSTEM},
            {
                "role": "user",
                "content": FOLLOWUP_REVIEW_TEMPLATE.format(
                    question=question,
                    expected_keywords=expected_keywords or "not specified",
                    original_answer=original_answer or "(no answer given)",
                    history_block=_history_block(turns),
                    latest_answer=latest_answer or "(no answer given)",
                    round_number=round_number,
                ),
            },
        ],
        model=model,
    )
    data = json.loads(_extract_json(raw))
    return {
        "understanding_score": float(data.get("understanding_score", 0)),
        "what_they_now_understand": _personalize_list(data.get("what_they_now_understand")),
        "remaining_gaps": _personalize_list(data.get("remaining_gaps")),
        "coach_feedback": _personalize_text(data.get("coach_feedback", "")),
        "deeper_explanation": _personalize_text(data.get("deeper_explanation", "")),
        "hint": _personalize_text(data.get("hint", "")),
        "next_question": _personalize_text(data.get("next_question", "")),
    }


async def generate_followup_report(
    question: str,
    original_answer: str,
    initial_feedback: str,
    turns: list[dict],
    expected_keywords: str = "",
    model: str | None = None,
) -> dict:
    raw = await chat(
        [
            {"role": "system", "content": FOLLOWUP_REPORT_SYSTEM},
            {
                "role": "user",
                "content": FOLLOWUP_REPORT_TEMPLATE.format(
                    question=question,
                    expected_keywords=expected_keywords or "not specified",
                    original_answer=original_answer or "(no answer given)",
                    initial_feedback=initial_feedback or "(none)",
                    history_block=_history_block(turns),
                ),
            },
        ],
        model=model,
    )
    data = json.loads(_extract_json(raw))
    return {
        "understanding_score": float(data.get("understanding_score", 0)),
        "overall_assessment": _personalize_text(data.get("overall_assessment", "")),
        "strengths": _personalize_list(data.get("strengths")),
        "remaining_gaps": _personalize_list(data.get("remaining_gaps")),
        "concepts_mastered": _personalize_list(data.get("concepts_mastered")),
        "concepts_to_review": _personalize_list(data.get("concepts_to_review")),
        "recommended_drills": _personalize_list(data.get("recommended_drills")),
        "ideal_answer_extension": _personalize_text(data.get("ideal_answer_extension", "")),
    }


def should_continue_followup(understanding_score: float, round_number: int, max_rounds: int = 3) -> bool:
    if round_number >= max_rounds:
        return False
    return understanding_score < MIN_FOLLOWUP_SCORE_TO_STOP


def compose_followup_message(review: dict, continue_loop: bool) -> str:
    parts = [review.get("coach_feedback", "").strip(), review.get("deeper_explanation", "").strip()]
    hint = review.get("hint", "").strip()
    next_question = review.get("next_question", "").strip()

    if hint:
        parts.append(f"Hint: {hint}")
    if continue_loop and next_question:
        parts.append(f"Follow-up question: {next_question}")
    else:
        parts.append("You've improved the depth on this question. When you're ready, click Next question.")
    return " ".join(part for part in parts if part)


async def generate_encouragement(score: float, model: str | None = None) -> str:
    if score >= 80:
        context = "excellent answer"
    elif score >= 60:
        context = "decent answer with some gaps"
    else:
        context = "incomplete answer"

    return await chat(
        [
            {
                "role": "system",
                "content": "You are a FAANG interviewer. Give a 1-sentence neutral transition to the next question.",
            },
            {"role": "user", "content": f"The candidate gave a {context} (score: {score:.0f}/100). Transition naturally."},
        ],
        model=model,
    )


async def analyze_session(
    topic: str,
    responses: list[dict],
    model: str | None = None,
) -> dict:
    qa_lines = []
    for i, r in enumerate(responses):
        score_str = f"{r.get('total', '?')}/100" if r.get("total") is not None else "not scored"
        qa_lines.append(
            f"Q{i+1} [{r.get('topic', topic)} | {r.get('difficulty', '?')} | {score_str}]:\n"
            f"  Question: {r.get('question', '')}\n"
            f"  Answer:   {r.get('transcript') or '(no answer given)'}\n"
            f"  Feedback: {r.get('llm_feedback') or '(none)'}"
        )

    raw = await chat(
        [
            {"role": "system", "content": SESSION_ANALYSIS_SYSTEM},
            {
                "role": "user",
                "content": SESSION_ANALYSIS_TEMPLATE.format(
                    topic=topic,
                    qa_block="\n\n".join(qa_lines),
                ),
            },
        ],
        model=model,
    )
    return json.loads(_extract_json(raw))


def _history_block(turns: list[dict]) -> str:
    if not turns:
        return "(none yet)"

    lines = []
    for turn in turns:
        lines.append(
            f"Round {turn.get('round', '?')}:\n"
            f"  Interviewer prompt: {turn.get('interviewer_prompt', '')}\n"
            f"  Candidate answer: {turn.get('candidate_answer', '')}\n"
            f"  Understanding score: {turn.get('understanding_score', '')}\n"
            f"  Coach feedback: {turn.get('coach_feedback', '')}\n"
            f"  Remaining gaps: {', '.join(turn.get('remaining_gaps', []))}"
        )
    return "\n\n".join(lines)


def _clean_list(value) -> list[str]:
    if isinstance(value, list):
        return [str(item).strip() for item in value if str(item).strip()]
    if isinstance(value, str) and value.strip():
        return [value.strip()]
    return []


def _personalize_list(value) -> list[str]:
    return [_personalize_text(item) for item in _clean_list(value)]


def _personalize_text(value) -> str:
    if value is None:
        return ""
    text = str(value).strip()
    replacements = [
        (r"\bThe candidate has\b", "You have"),
        (r"\bThe candidate needs\b", "You need"),
        (r"\bThe candidate should\b", "You should"),
        (r"\bThe candidate can\b", "You can"),
        (r"\bThe candidate did\b", "You did"),
        (r"\bThe candidate\b", "You"),
        (r"\bthe candidate has\b", "you have"),
        (r"\bthe candidate needs\b", "you need"),
        (r"\bthe candidate should\b", "you should"),
        (r"\bthe candidate can\b", "you can"),
        (r"\bthe candidate did\b", "you did"),
        (r"\bthe candidate\b", "you"),
        (r"\bCandidate has\b", "You have"),
        (r"\bcandidate has\b", "you have"),
        (r"\bCandidate needs\b", "You need"),
        (r"\bcandidate needs\b", "you need"),
        (r"\bCandidate should\b", "You should"),
        (r"\bcandidate should\b", "you should"),
        (r"\bCandidate\b", "You"),
        (r"\bcandidate\b", "you"),
        (r"\bThey have\b", "You have"),
        (r"\bThey need\b", "You need"),
        (r"\bThey should\b", "You should"),
        (r"\bThey can\b", "You can"),
        (r"\bThey did\b", "You did"),
        (r"\bthey have\b", "you have"),
        (r"\bthey need\b", "you need"),
        (r"\bthey should\b", "you should"),
        (r"\bthey can\b", "you can"),
        (r"\bthey did\b", "you did"),
        (r"\bTheir\b", "Your"),
        (r"\btheir\b", "your"),
    ]
    for pattern, replacement in replacements:
        text = re.sub(pattern, replacement, text)
    return text


def _extract_json(text: str) -> str:
    match = re.search(r"```(?:json)?\s*([\s\S]+?)\s*```", text)
    if match:
        return match.group(1)
    match = re.search(r"\{[\s\S]+\}", text)
    if match:
        return match.group(0)
    return text
