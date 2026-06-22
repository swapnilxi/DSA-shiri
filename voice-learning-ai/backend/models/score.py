from pydantic import BaseModel
from typing import Optional


class ScoreBreakdown(BaseModel):
    technical_correctness: float   # 0-40
    depth_completeness: float      # 0-25
    communication_clarity: float   # 0-20
    problem_solving: float         # 0-15
    total: float                   # 0-100
    llm_feedback: str
    follow_up_asked: Optional[str] = None


class TopicMastery(BaseModel):
    topic: str
    avg_score: float
    attempts: int
    last_practiced: Optional[str]
