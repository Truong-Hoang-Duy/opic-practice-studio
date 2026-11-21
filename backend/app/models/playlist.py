import datetime
from sqlalchemy import Boolean, Column, DateTime, Float, ForeignKey, Integer, JSON, String, Text
from app.database import Base


class SavedPlaylist(Base):
    """Persisted listening playlist metadata so learners can find, replay, download, or rebuild audio anytime."""
    __tablename__ = "saved_playlists"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    session_id = Column(Integer, nullable=True, index=True)  # Optional source session; no hard FK so deleting a session never fails

    title = Column(String(200), nullable=False)
    level = Column(String(20), default="IM")
    include_question = Column(Boolean, default=True)
    shadowing_pause = Column(Boolean, default=False)

    question_ids = Column(JSON, nullable=False)  # Ordered list of question IDs
    question_count = Column(Integer, default=0)
    segment_count = Column(Integer, default=0)

    playlist_key = Column(String(64), nullable=False, index=True)
    audio_path = Column(String(255), nullable=True)
    duration_seconds = Column(Float, nullable=True)
    file_size_bytes = Column(Integer, nullable=True)

    status = Column(String(20), default="building")  # "building" | "ready" | "error"
    error_message = Column(Text, nullable=True)

    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)
