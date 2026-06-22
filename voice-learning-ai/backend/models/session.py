from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class SessionCreate(BaseModel):
    model_config = {"protected_namespaces": ()}

    topic: str
    company: Optional[str] = None
    title: Optional[str] = None
    model_used: Optional[str] = None


class SessionOut(BaseModel):
    model_config = {"protected_namespaces": (), "from_attributes": True}

    id: int
    title: Optional[str]
    topic: str
    model_used: Optional[str]
    status: str
    total_score: Optional[float]
    started_at: datetime
    ended_at: Optional[datetime]
