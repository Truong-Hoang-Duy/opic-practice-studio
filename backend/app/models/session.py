import datetime
from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, JSON, Boolean
from sqlalchemy.orm import relationship
from app.database import Base

class TestSession(Base):
    __tablename__ = "test_sessions"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    
    # Setup Data
    survey_data = Column(JSON, nullable=True) # occupation, living, leisure, hobbies, sports, travel
    self_assessment_level = Column(Integer, nullable=True) # 1-6
    topics = Column(JSON, nullable=True) # List of exactly 3 chosen topics
    mode = Column(String(50), default="exam") # "exam" or "practice"
    dev_mock = Column(Boolean, default=False) # local UI testing: every AI/STT call is simulated (ignored in production)
    status = Column(String(50), default="setup") # "setup", "in_progress", "completed"

    # Token and Cost Tracking
    total_tokens = Column(Integer, default=0)
    estimated_cost = Column(Float, default=0.0)

    # Timestamps
    started_at = Column(DateTime, default=datetime.datetime.utcnow)
    completed_at = Column(DateTime, nullable=True)

    # Relationships
    user = relationship("User", back_populates="sessions")
    questions = relationship("Question", back_populates="session", cascade="all, delete-orphan", order_by="Question.order_index")
    answers = relationship("Answer", back_populates="session", cascade="all, delete-orphan")
    report = relationship("SessionReport", back_populates="session", uselist=False, cascade="all, delete-orphan")
    llm_logs = relationship("LLMUsageLog", back_populates="session", cascade="all, delete-orphan")
