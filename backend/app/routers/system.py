import time
from fastapi import APIRouter
from app.core.seed_data import SAMPLE_PRE_TEST_QUESTION
from app.services.tts_service import synthesize_speech

router = APIRouter(prefix="/system", tags=["System & Diagnostic Checks"])

@router.get("/ping")
def ping_check():
    """Latency and bandwidth check endpoint."""
    return {
        "status": "ok",
        "timestamp_ms": int(time.time() * 1000),
        "server_region": "local"
    }

@router.get("/sample-question")
def get_sample_question():
    """Returns the pre-test setup question and synthesized Eva speech."""
    audio_path = synthesize_speech(SAMPLE_PRE_TEST_QUESTION["question_text"])
    return {
        **SAMPLE_PRE_TEST_QUESTION,
        "audio_path": audio_path
    }

@router.get("/browser-info-guide")
def get_browser_guide():
    """Returns supported browsers and microphone permission help links."""
    return {
        "supported_browsers": ["Chrome", "Edge", "Firefox", "Safari"],
        "min_bandwidth_kbps": 500,
        "mic_help_links": {
            "Chrome": "chrome://settings/content/microphone",
            "Edge": "edge://settings/content/microphone",
            "Firefox": "about:preferences#privacy",
            "Safari": "https://support.apple.com/guide/safari/websites-ibrwe2159f50/mac"
        }
    }
