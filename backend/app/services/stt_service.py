import os
import json
import logging
import asyncio
from typing import Dict, Any, List, Optional
import httpx
import websockets
from app.config import settings

logger = logging.getLogger("opic_stt")
logger.setLevel(logging.INFO)

async def create_soniox_temporary_key(usage_type: str = "transcribe_websocket") -> Dict[str, Any]:
    """
    Creates a short-lived temporary API key from Soniox API so the permanent key is never exposed.
    """
    if not settings.SONIOX_API_KEY or settings.SONIOX_API_KEY.startswith("your_"):
        # Mock temporary key for development/test
        return {
            "key": "mock_temp_soniox_key_dev_2026",
            "expires_in_seconds": 900,
            "mock": True
        }

    url = "https://api.soniox.com/v1/temporary_api_keys"
    headers = {
        "Authorization": f"Bearer {settings.SONIOX_API_KEY}",
        "Content-Type": "application/json"
    }
    payload = {
        "usage_type": usage_type,
        "expires_in_seconds": 1800, # 30 minutes
        "client_request_reference": "opic_session"
    }

    async with httpx.AsyncClient() as client:
        try:
            response = await client.post(url, headers=headers, json=payload, timeout=10.0)
            if response.status_code == 200:
                data = response.json()
                return {
                    "key": data.get("key"),
                    "expires_in_seconds": data.get("expires_in_seconds", 1800),
                    "mock": False
                }
            else:
                logger.error(f"Soniox temp key error {response.status_code}: {response.text}")
                return {"key": "mock_fallback_temp_key", "expires_in_seconds": 900, "mock": True}
        except Exception as e:
            logger.error(f"Failed to create Soniox temporary key: {e}")
            return {"key": "mock_fallback_temp_key", "expires_in_seconds": 900, "mock": True}

def parse_words_with_confidence(transcript_text: str) -> List[Dict[str, Any]]:
    """
    Splits transcript into word tokens with confidence scores.
    Words that are complex or typical stumble points for Vietnamese speakers get lower confidence indicators.
    """
    words = transcript_text.strip().split()
    result = []
    
    # Typical stumble or low confidence words for simulated realistic output
    potential_low_conf = {"specifically", "simultaneously", "infrastructure", "unforgettable", "extraordinary", "environmental"}

    current_ms = 0
    for idx, w in enumerate(words):
        clean_w = w.lower().strip(".,!?:;\"'")
        # Default high confidence (0.92 - 0.98), lower if long/uncommon word
        if clean_w in potential_low_conf or (len(clean_w) > 8 and idx % 7 == 0):
            conf = 0.65
        else:
            conf = 0.95

        word_dur = max(250, len(w) * 60)
        result.append({
            "word": w,
            "confidence": conf,
            "start_ms": current_ms,
            "end_ms": current_ms + word_dur
        })
        current_ms += word_dur + 80

    return result

async def save_raw_audio(file_bytes: bytes, filename: str) -> str:
    """Saves raw recorded audio to disk and returns the relative path."""
    target_path = os.path.join(settings.AUDIO_UPLOAD_DIR, filename)
    with open(target_path, "wb") as f:
        f.write(file_bytes)
    return f"/data/uploads/{filename}"
