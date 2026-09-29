import datetime
from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, JSON
from sqlalchemy.orm import relationship
from app.database import Base

class Question(Base):
    __tablename__ = "questions"

    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(Integer, ForeignKey("test_sessions.id"), nullable=False, index=True)
    order_index = Column(Integer, nullable=False) # 1 to 15
    
    question_text = Column(Text, nullable=False)
    question_type = Column(String(100), nullable=False) # self_intro, description, routine, past_experience, comparison, role_play_ask, role_play_problem, unexpected_situation
    topic = Column(String(100), nullable=False) # topic key or survey category
    difficulty = Column(String(50), default="IM") # target difficulty based on self-assessment (IL, IM, IH)
    audio_path = Column(String(255), nullable=True) # Cached audio file for Eva TTS

    # Guide with steps, outline, and Vietnamese tips
    vietnamese_guide = Column(JSON, nullable=True)

    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    # Relationships
    session = relationship("TestSession", back_populates="questions")
    answers = relationship("Answer", back_populates="question", cascade="all, delete-orphan")
    model_answers = relationship("ModelAnswer", back_populates="question", cascade="all, delete-orphan")

class ModelAnswer(Base):
    __tablename__ = "model_answers"

    id = Column(Integer, primary_key=True, index=True)
    question_id = Column(Integer, ForeignKey("questions.id"), nullable=False, index=True)
    level = Column(String(50), nullable=False) # "IL", "IM", "IH"
    text = Column(Text, nullable=False)
    rationale = Column(Text, nullable=False) # Why it belongs to that level
    audio_path = Column(String(255), nullable=True) # TTS synthesized audio
    sentences = Column(JSON, nullable=True) # List of sentence strings for shadowing mode

    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    # Relationships
    question = relationship("Question", back_populates="model_answers")
