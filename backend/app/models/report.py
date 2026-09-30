import datetime
from sqlalchemy import Column, Integer, String, Text, Float, DateTime, ForeignKey, JSON
from sqlalchemy.orm import relationship
from app.database import Base

class SessionReport(Base):
    __tablename__ = "session_reports"

    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(Integer, ForeignKey("test_sessions.id"), unique=True, nullable=False, index=True)

    overall_level = Column(String(50), nullable=False) # below_IL, IL, IM, IH
    justification = Column(Text, nullable=False)

    radar_scores = Column(JSON, nullable=False) # {fluency: 3.5, tenses: 4.0, organization: 3.0, vocabulary: 3.8, grammar: 3.2, task_completion: 4.2}
    per_question_summary = Column(JSON, nullable=True) # List of {question_num, topic, level, score_avg}
    frequent_mistakes = Column(JSON, nullable=True) # Top recurring mistakes across all answers
    strengths = Column(JSON, nullable=True) # Key strengths observed
    weaknesses = Column(JSON, nullable=True) # Major barriers to reaching IH
    study_plan = Column(JSON, nullable=True) # Suggested 2-4 week study plan for Vietnamese learners

    pdf_path = Column(String(255), nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    # Relationships
    session = relationship("TestSession", back_populates="report")

    @property
    def passed(self) -> bool:
        return self.overall_level in ["IH", "AL"]

class LLMUsageLog(Base):
    __tablename__ = "llm_usage_logs"

    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(Integer, ForeignKey("test_sessions.id"), nullable=True, index=True)

    call_type = Column(String(100), nullable=False) # "evaluation", "rewrite", "model_answers", "report"
    model = Column(String(100), nullable=False)
    prompt_tokens = Column(Integer, default=0)
    completion_tokens = Column(Integer, default=0)
    total_tokens = Column(Integer, default=0)
    estimated_cost = Column(Float, default=0.0)

    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    # Relationships
    session = relationship("TestSession", back_populates="llm_logs")
