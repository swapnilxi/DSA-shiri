from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class QuestionOut(BaseModel):
    id: int
    topic: str
    question: str
    difficulty: str
    company: Optional[str]
    category: Optional[str]
    source_file: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True


class QuestionFilter(BaseModel):
    topic: Optional[str] = None
    difficulty: Optional[str] = None
    company: Optional[str] = None
    category: Optional[str] = None
    limit: int = 50
