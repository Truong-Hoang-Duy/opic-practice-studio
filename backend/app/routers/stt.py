import logging
from fastapi import APIRouter
from app.config import settings
from app.services.stt_service import resolve_whisper_model_name

logger = logging.getLogger("opic_stt_router")
router = APIRouter(prefix="/stt", tags=["Speech-to-Text"])

@router.get("/status")
async def get_stt_status():
    """Returns the active free STT provider and model configuration."""
    has_groq = bool(settings.GROQ_API_KEY and not settings.GROQ_API_KEY.startswith("your_"))
    provider = (settings.STT_PROVIDER or "auto").lower()
    active = "groq" if (provider == "groq" or (provider == "auto" and has_groq)) else "faster_whisper"
    model = settings.GROQ_WHISPER_MODEL if active == "groq" else resolve_whisper_model_name()
    return {"provider": active, "model": model}
