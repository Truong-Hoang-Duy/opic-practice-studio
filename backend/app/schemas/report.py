from typing import List, Optional, Dict, Any
from datetime import datetime
from pydantic import BaseModel, ConfigDict

class RadarScores(BaseModel):
    fluency_and_length: float
    tense_control: float
    organization: float
    vocabulary: float
    grammar: float
    task_completion: float

class SessionReportResponse(BaseModel):
    id: int
    session_id: int
    overall_level: str
    justification: str
    radar_scores: Dict[str, float]
    per_question_summary: List[Dict[str, Any]] = []
    frequent_mistakes: List[Dict[str, Any]] = []
    strengths: List[str] = []
    weaknesses: List[str] = []
    study_plan: Dict[str, Any] = {}
    pdf_path: Optional[str] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
