import os
import io
import gc
import math
import json
import logging
import asyncio
import tempfile
import threading
import time
from typing import Dict, Any, List, Optional
import httpx
import websockets
from app.config import settings

logger = logging.getLogger("opic_stt")
logger.setLevel(logging.INFO)

# Prompting Whisper with conversational fillers ensures it transcribes "um", "uh", "like", "you know"
# verbatim instead of stripping them out, so speech_metrics.py can analyse hesitation accurately.
WHISPER_INITIAL_PROMPT = (
    "Umm, uhh, uhm, er, ah, hmm, like, you know, I mean, actually, basically. "
    "Well, to be honest, I would like to talk about my experience."
)

_whisper_model = None
_whisper_model_name: Optional[str] = None
_whisper_lock = threading.Lock()
_transcribe_lock = threading.Lock()


def is_low_memory_env() -> bool:
    """True when explicitly configured or running on Render Free tier (512 MB RAM)."""
    return bool(settings.WHISPER_LOW_MEMORY or os.getenv("RENDER", "").lower() == "true")


def resolve_whisper_model_name() -> str:
    """
    Returns the configured Whisper model name.
    On Render Free (512 MB RAM), defaults to 'tiny.en' if the user left the default 'base.en'
    so the container stays comfortably within memory limits alongside FastAPI.
    """
    configured = (settings.WHISPER_MODEL or "base.en").strip()
    if is_low_memory_env() and configured == "base.en" and not os.getenv("WHISPER_MODEL"):
        return "tiny.en"
    return configured


def _get_whisper_model():
    """Lazily downloads (first run only) and loads the faster-whisper CTranslate2 model."""
    global _whisper_model, _whisper_model_name
    target_name = resolve_whisper_model_name()
    if _whisper_model is not None and _whisper_model_name == target_name:
        return _whisper_model

    with _whisper_lock:
        if _whisper_model is not None and _whisper_model_name == target_name:
            return _whisper_model
        try:
            os.environ.setdefault("HF_HUB_DISABLE_XET", "1")
            from faster_whisper import WhisperModel
            os.makedirs(settings.WHISPER_MODEL_DIR, exist_ok=True)
            low_mem = is_low_memory_env()
            cpu_threads = 2 if low_mem else 4
            logger.info(
                f"Loading faster-whisper model '{target_name}' "
                f"(compute_type={settings.WHISPER_COMPUTE_TYPE}, low_mem={low_mem}) ..."
            )
            _whisper_model = WhisperModel(
                target_name,
                device="cpu",
                compute_type=settings.WHISPER_COMPUTE_TYPE,
                download_root=settings.WHISPER_MODEL_DIR,
                cpu_threads=cpu_threads,
                num_workers=1,
            )
            _whisper_model_name = target_name
            logger.info(f"faster-whisper STT ready (model={target_name}).")
        except Exception as e:
            logger.error(f"Failed to load faster-whisper model '{target_name}': {e}")
            raise TranscriptionError(f"Local Whisper model unavailable: {e}") from e
    return _whisper_model


def warm_up_stt():
    """
    Pre-downloads/loads the local faster-whisper model in the background on startup.
    Skipped during pytest runs, on low-memory environments (Render 512MB), or when Groq is the active provider.
    """
    if "PYTEST_CURRENT_TEST" in os.environ or settings.TTS_PROVIDER == "browser":
        return
    provider = (settings.STT_PROVIDER or "auto").lower()
    has_groq = bool(settings.GROQ_API_KEY and not settings.GROQ_API_KEY.startswith("your_"))
    if provider == "groq" or (provider == "auto" and has_groq):
        return
    if is_low_memory_env():
        return
    try:
        _get_whisper_model()
    except Exception as e:
        logger.warning(f"STT warm-up skipped: {e}")


def format_whisper_words(raw_words: List[Any]) -> List[Dict[str, Any]]:
    """
    Normalizes faster-whisper word objects (or dicts) into
    [{"word": str, "confidence": float, "start_ms": int, "end_ms": int}].
    """
    words: List[Dict[str, Any]] = []
    for w in raw_words:
        text = (w.get("word") if isinstance(w, dict) else getattr(w, "word", "")) or ""
        start = float((w.get("start") if isinstance(w, dict) else getattr(w, "start", 0.0)) or 0.0)
        end = float((w.get("end") if isinstance(w, dict) else getattr(w, "end", 0.0)) or 0.0)
        prob = float((w.get("probability") if isinstance(w, dict) else getattr(w, "probability", 0.92)) or 0.92)

        stripped = text.strip()
        if not stripped:
            continue
        start_ms = max(0, int(round(start * 1000)))
        end_ms = max(start_ms, int(round(end * 1000)))
        conf = round(max(0.0, min(1.0, prob)), 3)

        # Attach standalone punctuation tokens to the previous word
        if words and all(ch in ".,!?:;\"')]" for ch in stripped):
            prev = words[-1]
            prev["word"] += stripped
            prev["end_ms"] = max(prev["end_ms"], end_ms)
            prev["confidence"] = round(min(prev["confidence"], conf), 3)
        else:
            words.append({
                "word": stripped,
                "confidence": conf,
                "start_ms": start_ms,
                "end_ms": end_ms,
            })
    return words


def transcribe_with_faster_whisper(file_bytes: bytes, filename: str = "audio.webm") -> Dict[str, Any]:
    """
    Transcribes audio locally on CPU using faster-whisper (100% free, no API key).
    Returns {"text": str, "words": [{word, confidence, start_ms, end_ms}]}.
    """
    if not file_bytes:
        return {"text": "", "words": []}

    global _whisper_model
    low_mem = is_low_memory_env()
    with _transcribe_lock:
        model = _get_whisper_model()
        try:
            def _run(audio_source):
                segments_gen, _info = model.transcribe(
                    audio_source,
                    language="en",
                    beam_size=2 if low_mem else 5,
                    word_timestamps=True,
                    vad_filter=True,
                    vad_parameters=dict(min_silence_duration_ms=500),
                    condition_on_previous_text=False,
                    initial_prompt=WHISPER_INITIAL_PROMPT,
                )
                return list(segments_gen)

            try:
                segments = _run(io.BytesIO(file_bytes))
            except Exception:
                # Fallback to a temporary file if in-memory container decoding fails
                ext = os.path.splitext(filename or "")[1] or ".webm"
                with tempfile.NamedTemporaryFile(suffix=ext, delete=True) as tmp:
                    tmp.write(file_bytes)
                    tmp.flush()
                    segments = _run(tmp.name)

            text_parts: List[str] = []
            raw_words: List[Any] = []
            for seg in segments:
                if getattr(seg, "text", None):
                    text_parts.append(seg.text.strip())
                if getattr(seg, "words", None):
                    raw_words.extend(seg.words)

            full_text = " ".join(p for p in text_parts if p).strip()
            words = format_whisper_words(raw_words)
            if full_text and not words:
                words = parse_words_with_confidence(full_text)
            return {"text": full_text, "words": words}
        except Exception as e:
            raise TranscriptionError(f"faster-whisper transcription failed: {e}") from e
        finally:
            if low_mem:
                # Free ~150-250 MB RAM immediately on Render 512MB Free tier
                with _whisper_lock:
                    _whisper_model = None
                gc.collect()


GROQ_API_URL = "https://api.groq.com/openai/v1/audio/transcriptions"


def merge_groq_words(
    raw_words: List[Dict[str, Any]],
    segments: Optional[List[Dict[str, Any]]] = None,
) -> List[Dict[str, Any]]:
    """
    Converts Groq verbose_json word timings + segment avg_logprob into
    [{"word": str, "confidence": float, "start_ms": int, "end_ms": int}].
    """
    seg_confs: List[tuple] = []
    for seg in segments or []:
        avg_lp = seg.get("avg_logprob")
        if isinstance(avg_lp, (int, float)):
            c = max(0.35, min(0.99, math.exp(float(avg_lp))))
            seg_confs.append((float(seg.get("start", 0.0)), float(seg.get("end", 0.0)), c))

    def _conf_at(t_sec: float, word_str: str) -> float:
        base = 0.94
        for s_start, s_end, c in seg_confs:
            if s_start - 0.1 <= t_sec <= s_end + 0.1:
                base = c
                break
        if "confidence" in raw_words[0] if raw_words else False:
            pass
        clean = word_str.lower().strip(".,!?:;\"'")
        if len(clean) >= 11:
            base = min(base, 0.82)
        return round(base, 3)

    formatted: List[Dict[str, Any]] = []
    for w in raw_words or []:
        text = (w.get("word") or w.get("text") or "").strip()
        if not text:
            continue
        start = float(w.get("start", 0.0) or 0.0)
        end = float(w.get("end", start) or start)
        explicit_prob = w.get("probability") if w.get("probability") is not None else w.get("confidence")
        conf = round(float(explicit_prob), 3) if isinstance(explicit_prob, (int, float)) else _conf_at(start, text)
        formatted.append({
            "word": text,
            "confidence": conf,
            "start_ms": max(0, int(round(start * 1000))),
            "end_ms": max(0, int(round(end * 1000))),
        })
    return formatted


def transcribe_with_groq(
    file_bytes: bytes,
    filename: str,
    content_type: Optional[str] = None,
    timeout_sec: float = 60.0,
) -> Dict[str, Any]:
    """
    Transcribes audio via Groq Cloud's free Whisper API (whisper-large-v3-turbo).
    Uses 0 MB of local RAM and finishes in < 1s.
    """
    if not settings.GROQ_API_KEY or settings.GROQ_API_KEY.startswith("your_"):
        raise TranscriptionError("GROQ_API_KEY is not configured.")

    headers = {"Authorization": f"Bearer {settings.GROQ_API_KEY}"}
    data = {
        "model": settings.GROQ_WHISPER_MODEL,
        "language": "en",
        "response_format": "verbose_json",
        "timestamp_granularities[]": ["word", "segment"],
        "prompt": WHISPER_INITIAL_PROMPT,
    }
    files = {"file": (filename or "audio.webm", file_bytes, content_type or "audio/webm")}
    try:
        with httpx.Client(timeout=timeout_sec) as client:
            resp = client.post(GROQ_API_URL, headers=headers, data=data, files=files)
            resp.raise_for_status()
            payload = resp.json()
    except httpx.HTTPError as e:
        raise TranscriptionError(f"Groq Whisper request failed: {e}") from e

    text = (payload.get("text") or "").strip()
    words = merge_groq_words(payload.get("words") or [], payload.get("segments") or [])
    if text and not words:
        words = parse_words_with_confidence(text)
    return {"text": text, "words": words}


class TranscriptionError(Exception):
    pass


def transcribe_audio_file(file_bytes: bytes, filename: str, content_type: Optional[str] = None, timeout_sec: float = 180.0) -> Dict[str, Any]:
    """
    Batch (non-streaming) transcription of a finished recording using the configured STT provider:
      - "auto" (default): Groq Whisper Free API if GROQ_API_KEY is set (with local faster-whisper fallback),
                          otherwise local open-source faster-whisper on CPU.
      - "faster_whisper": local open-source Whisper (CTranslate2 int8), 100% free & offline.
      - "groq":           Groq Cloud Whisper Free API (whisper-large-v3-turbo).
    Returns {"text": str, "words": [{word, confidence, start_ms, end_ms}]}.
    """
    provider = (settings.STT_PROVIDER or "auto").strip().lower()
    has_groq = bool(settings.GROQ_API_KEY and not settings.GROQ_API_KEY.startswith("your_"))

    if provider == "groq":
        return transcribe_with_groq(file_bytes, filename, content_type, timeout_sec)

    if provider == "auto" and has_groq:
        try:
            return transcribe_with_groq(file_bytes, filename, content_type, timeout_sec)
        except TranscriptionError as e:
            logger.warning(f"Groq STT failed ({e}), falling back to local faster-whisper...")
            return transcribe_with_faster_whisper(file_bytes, filename)

    return transcribe_with_faster_whisper(file_bytes, filename)


MOCK_TRANSCRIPT = (
    "Well, to be honest, I really enjoy spending my weekends at home with my family. "
    "Last month something unforgettable happened when our environmental group organised a clean-up, "
    "and I think I will join again next year because it was extraordinary."
)
MOCK_MIN_SPEECH_SEC = 3.0


def mock_transcribe(duration_seconds: float) -> Dict[str, Any]:
    """DEV sessions: no STT call. Takes under 3 s simulate silence, longer ones return a sample transcript."""
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
