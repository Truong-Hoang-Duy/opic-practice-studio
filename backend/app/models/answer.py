import datetime
from sqlalchemy import Column, Integer, String, Text, Float, DateTime, ForeignKey, JSON
from sqlalchemy.orm import relationship
from app.database import Base

class Answer(Base):
    __tablename__ = "answers"

    id = Column(Integer, primary_key=True, index=True)
    question_id = Column(Integer, ForeignKey("questions.id"), nullable=False, index=True)
    session_id = Column(Integer, ForeignKey("test_sessions.id"), nullable=False, index=True)

    audio_path = Column(String(255), nullable=True) # Uploaded raw user audio file
    duration_seconds = Column(Float, default=0.0)

    # Transcripts
    transcript_raw = Column(Text, nullable=True) # Direct from Soniox
    transcript_edited = Column(Text, nullable=True) # Latest active transcript
    word_confidences = Column(JSON, nullable=True) # List of {word, confidence, start_ms, end_ms}

    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    # Relationships
    question = relationship("Question", back_populates="answers")
    session = relationship("TestSession", back_populates="answers")
    versions = relationship("AnswerVersion", back_populates="answer", cascade="all, delete-orphan", order_by="AnswerVersion.version_number")

class AnswerVersion(Base):
    __tablename__ = "answer_versions"

    id = Column(Integer, primary_key=True, index=True)
    answer_id = Column(Integer, ForeignKey("answers.id"), nullable=False, index=True)
    version_number = Column(Integer, nullable=False, default=1)
    
    transcript = Column(Text, nullable=False)
    source = Column(String(50), default="stt") # "stt", "user_edit", "rewrite_applied"
    notes = Column(String(255), nullable=True)
    audio_path = Column(String(255), nullable=True)  # recording of this take (each take keeps its own file)
    duration_seconds = Column(Float, nullable=True)
    # Speech flow analysis of this take's audio (WPM, pauses, fillers); None for typed/rewritten text
    speech_metrics = Column(JSON, nullable=True)

    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    # Relationships
    answer = relationship("Answer", back_populates="versions")
    evaluations = relationship("Evaluation", back_populates="answer_version", cascade="all, delete-orphan")
