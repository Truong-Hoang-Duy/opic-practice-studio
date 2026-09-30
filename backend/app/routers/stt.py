import logging
from fastapi import APIRouter
from app.services.stt_service import create_soniox_temporary_key

logger = logging.getLogger("opic_stt_router")
router = APIRouter(prefix="/stt", tags=["Speech-to-Text"])

@router.post("/token")
async def get_stt_token():
    """Returns a short-lived temporary token so the permanent key is never exposed to the client."""
    result = await create_soniox_temporary_key()
    return result
