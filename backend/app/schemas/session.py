from typing import List, Optional, Dict, Any
from datetime import datetime
from pydantic import BaseModel, Field, field_validator, ConfigDict

ALLOWED_TOPICS = {
    "environment",
    "human_rights",
    "global_workplace",
    "socio_cultural",
    "communication_media"
}

class SessionCreate(BaseModel):
    mode: str = Field(default="exam", pattern="^(exam|practice)$")

class SurveySubmit(BaseModel):
    occupation: str
    student_status: str
    education_experience: Optional[str] = None
    living_situation: str
    leisure_activities: List[str] = Field(default_factory=list)
    hobbies: List[str] = Field(default_factory=list)
    sports: List[str] = Field(default_factory=list)
    travel: List[str] = Field(default_factory=list)

class SelfAssessmentSubmit(BaseModel):
    level: int = Field(ge=1, le=6, description="Self-assessment level from 1 to 6")
    # True -> strict exam ("exam" mode), False -> coached practice ("practice" mode), None -> keep current mode
    strict_mode: Optional[bool] = None

class TopicsSubmit(BaseModel):
    topics: List[str]

    @field_validator("topics")
    @classmethod
    def validate_exactly_three_valid_topics(cls, v: List[str]) -> List[str]:
        if len(v) != 3:
            raise ValueError(f"You must select exactly 3 topics. Received {len(v)}.")
        for topic in v:
            if topic not in ALLOWED_TOPICS:
                raise ValueError(f"Topic '{topic}' is not one of the 5 allowed topics.")
        if len(set(v)) != 3:
            raise ValueError("All 3 selected topics must be unique.")
        return v

class SessionResponse(BaseModel):
    id: int
    user_id: int
    mode: str
    status: str
    self_assessment_level: Optional[int] = None
    topics: Optional[List[str]] = None
    total_tokens: int = 0
    estimated_cost: float = 0.0
    started_at: datetime
    completed_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)
