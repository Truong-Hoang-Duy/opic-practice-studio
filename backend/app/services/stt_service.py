import os
import json
import logging
import asyncio
import time
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

SONIOX_API_BASE = "https://api.soniox.com/v1"


class TranscriptionError(Exception):
    pass


def merge_soniox_tokens(tokens: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """
    Soniox returns sub-word pieces ("T", "ell", " me"). A piece starting with a space opens a new word;
    other pieces (incl. punctuation) join the current word. Word confidence = its weakest piece.
    """
    words: List[Dict[str, Any]] = []
    for tok in tokens:
        text = tok.get("text") or ""
        if not text or tok.get("is_audio_event"):
            continue
        conf = float(tok.get("confidence", 1.0))
        if not words or text[0].isspace():
            stripped = text.strip()
            if not stripped:
                continue
            words.append({"word": stripped, "confidence": conf, "start_ms": tok.get("start_ms", 0), "end_ms": tok.get("end_ms", 0)})
        else:
            w = words[-1]
            w["word"] += text
            w["confidence"] = min(w["confidence"], conf)
            w["end_ms"] = tok.get("end_ms", w["end_ms"])
    for w in words:
        w["confidence"] = round(w["confidence"], 3)
    return words


def transcribe_audio_file(file_bytes: bytes, filename: str, content_type: Optional[str] = None, timeout_sec: float = 180.0) -> Dict[str, Any]:
    """
    Batch (non-streaming) transcription of a finished recording with the Soniox async API:
    upload file -> create transcription -> poll -> fetch transcript -> delete remote copies.
    Returns {"text": str, "words": [{word, confidence, start_ms, end_ms}]}.
    """
    if not settings.SONIOX_API_KEY or settings.SONIOX_API_KEY.startswith("your_"):
        raise TranscriptionError("SONIOX_API_KEY is not configured.")

    headers = {"Authorization": f"Bearer {settings.SONIOX_API_KEY}"}
    file_id = transcription_id = None
    with httpx.Client(base_url=SONIOX_API_BASE, headers=headers, timeout=60.0) as client:
        try:
            up = client.post("/files", files={"file": (filename, file_bytes, content_type or "application/octet-stream")})
            up.raise_for_status()
            file_id = up.json()["id"]

            created = client.post("/transcriptions", json={
                "file_id": file_id,
                "model": settings.SONIOX_ASYNC_MODEL,
                "language_hints": ["en"],
            })
            created.raise_for_status()
            transcription_id = created.json()["id"]

            deadline = time.time() + timeout_sec
            while True:
                status = client.get(f"/transcriptions/{transcription_id}").json()
                if status.get("status") == "completed":
                    break
                if status.get("status") == "error":
                    raise TranscriptionError(status.get("error_message") or "Soniox transcription failed.")
                if time.time() > deadline:
                    raise TranscriptionError("Soniox transcription timed out.")
                time.sleep(1.0)

            transcript = client.get(f"/transcriptions/{transcription_id}/transcript").json()
            return {"text": (transcript.get("text") or "").strip(), "words": merge_soniox_tokens(transcript.get("tokens") or [])}
        except httpx.HTTPError as e:
            raise TranscriptionError(f"Soniox request failed: {e}") from e
        finally:
            # Don't keep learners' recordings on the provider side
            for path in ([f"/transcriptions/{transcription_id}"] if transcription_id else []) + ([f"/files/{file_id}"] if file_id else []):
                try:
                    client.delete(path)
                except Exception:
                    pass


MOCK_TRANSCRIPT = (
    "Well, to be honest, I really enjoy spending my weekends at home with my family. "
    "Last month something unforgettable happened when our environmental group organised a clean-up, "
    "and I think I will join again next year because it was extraordinary."
)
MOCK_MIN_SPEECH_SEC = 3.0


def mock_transcribe(duration_seconds: float) -> Dict[str, Any]:
    """DEV sessions: no Soniox call. Takes under 3 s simulate silence, longer ones return a sample transcript."""
    if (duration_seconds or 0) < MOCK_MIN_SPEECH_SEC:
        return {"text": "", "words": []}
    return {"text": MOCK_TRANSCRIPT, "words": parse_words_with_confidence(MOCK_TRANSCRIPT)}


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
