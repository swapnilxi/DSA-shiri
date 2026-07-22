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

FOLLOWUP_REVIEW_SYSTEM = """You are a rigorous but deeply educational technical interviewer.
You are in follow-up mode: you must stay on the same interview question.
Your dual role is to GRILL and TEACH simultaneously:
- GRILL: push the learner to think harder, expose gaps, ask sharper questions.
- TEACH: after each answer, explain the concept clearly — give the 'why', concrete examples, trade-offs, failure modes.
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
  "coach_feedback": "<2-4 sentences addressed directly to you. First acknowledge what was right. Then be DIRECT about what is wrong or missing and WHY it matters in practice. Be a strict coach, not a cheerleader.>",
  "deeper_explanation": "<2-4 sentences of concrete TEACHING. Explain the concept clearly: give the 'why', a real-world example or analogy, trade-offs, failure modes, or a mental model the learner can use. This is your chance to teach, not just critique.>",
  "hint": "<one focused hint, mental model, or key phrase to remember>",
  "next_question": "<one sharper interviewer-style follow-up question that stays on the same topic and pushes the learner deeper>"
}}

The next question must deepen understanding of the same topic — not introduce a new one."""


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


# ── FAANG AI Feedback ──────────────────────────────────────────────────────

FAANG_FEEDBACK_SYSTEM = """You are a Staff Engineer and hiring manager at a top FAANG company (Google / Meta / Amazon / Apple / Netflix).
You have just watched a candidate's mock technical interview. Your job is to write a blunt, personalised, and actionable
FAANG readiness report — as if you were giving private feedback to a friend you genuinely want to pass.

FAANG rubric thresholds (out of the given max points):
  - Technical Correctness  ≥ 34/40  (85 %)
  - Depth & Completeness   ≥ 21/25  (84 %)
  - Communication Clarity  ≥ 17/20  (85 %)
  - Problem Solving        ≥ 12/15  (80 %)

Address the candidate directly as "you". Never say "the candidate".
Return ONLY valid JSON — no prose outside the JSON block."""

FAANG_FEEDBACK_TEMPLATE = """Session topic: {topic}

Dimension scores (your averages across all questions):
  Technical Correctness : {avg_technical:.1f} / 40   (FAANG bar: 34)
  Depth & Completeness  : {avg_depth:.1f}    / 25   (FAANG bar: 21)
  Communication Clarity : {avg_clarity:.1f}  / 20   (FAANG bar: 17)
  Problem Solving       : {avg_process:.1f}  / 15   (FAANG bar: 12)
  Overall average       : {avg_total:.1f}    / 100

Questions, your answers, and the rubric feedback you already received:
{qa_block}

Write a FAANG readiness report as a FAANG hiring manager would deliver it privately. Return ONLY this JSON shape:
{{
  "hiring_verdict": "<one sentence verdict: would you pass this round at FAANG right now and why>",
  "overall_impression": "<3-4 sentences: overall quality, what stood out positively, and what disqualified you from a clear hire>",
  "dimension_feedback": {{
    "technical_correctness": {{
      "passed_bar": <true|false>,
      "assessment": "<2-3 sentences on your technical accuracy across the session>",
      "top_gap": "<the single most critical technical gap exposed>",
      "fix": "<one concrete, specific action to close this gap within 2 weeks>"
    }},
    "depth_completeness": {{
      "passed_bar": <true|false>,
      "assessment": "<2-3 sentences on depth of your answers>",
      "top_gap": "<what key trade-offs, edge cases, or system considerations you consistently skipped>",
      "fix": "<one concrete, specific action>"
    }},
    "communication_clarity": {{
      "passed_bar": <true|false>,
      "assessment": "<2-3 sentences on structure and clarity>",
      "top_gap": "<the clearest communication anti-pattern you showed>",
      "fix": "<one concrete, specific action>"
    }},
    "problem_solving": {{
      "passed_bar": <true|false>,
      "assessment": "<2-3 sentences on your approach and thinking process>",
      "top_gap": "<what process step you consistently skipped or did poorly>",
      "fix": "<one concrete, specific action>"
    }}
  }},
  "interview_specific_gaps": [
    "<a very specific gap from the actual Q&A — reference real things you said or didn't say>",
    "<another specific gap>",
    "<another specific gap>"
  ],
  "two_week_action_plan": [
    {{ "day": "Days 1-3",  "action": "<focused study or practice task>" }},
    {{ "day": "Days 4-7",  "action": "<focused study or practice task>" }},
    {{ "day": "Days 8-11", "action": "<focused study or practice task>" }},
    {{ "day": "Days 12-14","action": "<mock interview / consolidation task>" }}
  ],
  "one_thing_to_do_today": "<the single highest-leverage action you could take today to level up>"
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


def should_continue_followup(understanding_score: float, round_number: int, max_rounds: int = 30) -> bool:
    if round_number >= max_rounds:
        return False
    return True


def compose_followup_message(review: dict, continue_loop: bool) -> str:
    coach = review.get("coach_feedback", "").strip()
    explanation = review.get("deeper_explanation", "").strip()
    hint = review.get("hint", "").strip()
    next_question = review.get("next_question", "").strip()

    # Build coaching block (feedback + teaching)
    coaching_parts = [p for p in [coach, explanation] if p]
    if hint:
        coaching_parts.append(f"💡 Hint: {hint}")
    coaching_block = " ".join(coaching_parts)

    # Append follow-up question on its own line with a blank line separator
    if continue_loop and next_question:
        return f"{coaching_block}\n\nFollow-up question: {next_question}"
    else:
        return f"{coaching_block}\n\nYou've built solid depth on this question. When you're ready, click Next question."



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


async def faang_feedback(
    topic: str,
    responses: list[dict],
    model: str | None = None,
) -> dict:
    """Generate a personalised FAANG-level readiness report using the LLM.

    Takes the full session Q&A (same shape as analyze_session) and the rubric
    dimension scores that are already stored, then asks the LLM to act as a
    FAANG hiring manager writing private, blunt, actionable feedback.
    """
    scored = [r for r in responses if r.get("total") is not None]
    if not scored:
        return {"error": "No scored responses found for this session."}

    def avg(key: str) -> float:
        return sum(float(r.get(key) or 0) for r in scored) / len(scored)

    avg_technical = avg("technical_correctness")
    avg_depth     = avg("depth_completeness")
    avg_clarity   = avg("communication_clarity")
    avg_process   = avg("problem_solving")
    avg_total     = avg("total")

    qa_lines = []
    for i, r in enumerate(responses):
        score_str = f"{r.get('total', '?')}/100" if r.get("total") is not None else "not scored"
        dim_str = (
            f"Technical={r.get('technical_correctness','?')}/40  "
            f"Depth={r.get('depth_completeness','?')}/25  "
            f"Clarity={r.get('communication_clarity','?')}/20  "
            f"Process={r.get('problem_solving','?')}/15"
        )
        qa_lines.append(
            f"Q{i+1} [{r.get('topic', topic)} | {r.get('difficulty', '?')} | {score_str}]\n"
            f"  Scores: {dim_str}\n"
            f"  Question: {r.get('question', '')}\n"
            f"  Your answer: {r.get('transcript') or '(no answer given)'}\n"
            f"  Rubric feedback: {r.get('llm_feedback') or '(none)'}"
        )

    raw = await chat(
        [
            {"role": "system", "content": FAANG_FEEDBACK_SYSTEM},
            {
                "role": "user",
                "content": FAANG_FEEDBACK_TEMPLATE.format(
                    topic=topic,
                    avg_technical=avg_technical,
                    avg_depth=avg_depth,
                    avg_clarity=avg_clarity,
                    avg_process=avg_process,
                    avg_total=avg_total,
                    qa_block="\n\n".join(qa_lines),
                ),
            },
        ],
        model=model,
    )

    data = json.loads(_extract_json(raw))

    # Personalise all text fields
    def _p(v: str) -> str:
        return _personalize_text(v) if isinstance(v, str) else v

    def _pl(v) -> list:
        return _personalize_list(v) if isinstance(v, list) else []

    dim_fb = data.get("dimension_feedback", {})
    for dim_key in ("technical_correctness", "depth_completeness", "communication_clarity", "problem_solving"):
        if dim_key in dim_fb:
            d = dim_fb[dim_key]
            d["assessment"] = _p(d.get("assessment", ""))
            d["top_gap"]    = _p(d.get("top_gap", ""))
            d["fix"]        = _p(d.get("fix", ""))

    return {
        "hiring_verdict":         _p(data.get("hiring_verdict", "")),
        "overall_impression":     _p(data.get("overall_impression", "")),
        "dimension_feedback":     dim_fb,
        "interview_specific_gaps": _pl(data.get("interview_specific_gaps")),
        "two_week_action_plan":   [
            {"day": item.get("day", ""), "action": _p(item.get("action", ""))}
            for item in (data.get("two_week_action_plan") or [])
        ],
        "one_thing_to_do_today":  _p(data.get("one_thing_to_do_today", "")),
    }


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
