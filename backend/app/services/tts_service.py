import os
import asyncio
import hashlib
import logging
import random
import re
import threading
import time
import weakref
from concurrent.futures import ThreadPoolExecutor
from typing import Iterable, Optional
import edge_tts
from app.config import settings

logger = logging.getLogger("opic_tts")

_synth_locks_guard = threading.Lock()
_synth_locks: "weakref.WeakValueDictionary[str, threading.Lock]" = weakref.WeakValueDictionary()
_prefetch_executor = ThreadPoolExecutor(max_workers=1, thread_name_prefix="eva_tts")

EDGE_SYNTH_TIMEOUT_SEC = 30.0
EDGE_SYNTH_MAX_RETRIES = 4

_MD_DECORATION_RE = re.compile(r"[*_`#<>]+")
_WHITESPACE_RE = re.compile(r"\s+")
_SPEAKABLE_RE = re.compile(r"[A-Za-z0-9]")


def sanitize_tts_text(text: str) -> str:
    """
    Cleans markdown/control artifacts and collapses whitespace before sending to Edge TTS.
    Returns an empty string when there are no speakable alphanumeric characters (prevents
    edge-tts `NoAudioReceived` errors on punctuation-only fragments).
    """
    if not text:
        return ""
    cleaned = _MD_DECORATION_RE.sub("", str(text))
    cleaned = "".join(ch for ch in cleaned if ch >= " " or ch in "\t\n\r")
    cleaned = _WHITESPACE_RE.sub(" ", cleaned).strip()
    if not _SPEAKABLE_RE.search(cleaned):
        return ""
    return cleaned


def _lock_for(filepath: str) -> threading.Lock:
    with _synth_locks_guard:
        lock = _synth_locks.get(filepath)
        if lock is None:
            lock = threading.Lock()
            _synth_locks[filepath] = lock
        return lock


def get_effective_tts_provider() -> str:
    """Returns the active TTS provider: 'edge' (default) or 'browser'."""
    if settings.ENVIRONMENT == "production":
        return "edge"
    configured = (settings.TTS_PROVIDER or "edge").lower().strip()
    return configured if configured in ("edge", "browser") else "edge"


def get_audio_hash(text: str, voice: str) -> str:
    combined = f"{text.strip().lower()}_{voice}_edge"
    return hashlib.md5(combined.encode("utf-8")).hexdigest()


def _cache_paths(text: str) -> tuple:
    voice = getattr(settings, "EDGE_VOICE", "en-US-AvaNeural")
    filename = f"eva_{get_audio_hash(text, voice)}.mp3"
    return os.path.join(settings.AUDIO_CACHE_DIR, filename), f"/data/audio_cache/{filename}"


def cached_speech_url(text: str) -> Optional[str]:
    """Returns the cached audio URL for `text` if it has already been synthesized, without synthesizing."""
    clean = sanitize_tts_text(text)
    if get_effective_tts_provider() == "browser" or not clean:
        return None
    filepath, url = _cache_paths(clean)
    if os.path.exists(filepath) and os.path.getsize(filepath) > 0:
        return url
    # Backwards-compat: check legacy raw-text hash if sanitization altered punctuation/markdown
    if clean != (text or "").strip():
        legacy_path, legacy_url = _cache_paths(text)
        if os.path.exists(legacy_path) and os.path.getsize(legacy_path) > 0:
            return legacy_url
    return None


def warm_up_tts():
    """No-op for edge-tts as it streams on-demand without local model RAM overhead."""
    pass


def _synthesize_edge(text: str, filepath: str) -> bool:
    """
    Synthesizes text using Microsoft Edge Neural Voice (free, 0 MB server RAM, streaming MP3)
    with bounded timeout and exponential backoff + jitter retries so bulk playlists (50-350 segments)
    recover cleanly from transient WebSocket / 429 / datacenter-IP hiccups on Render.
    """
    voice = getattr(settings, "EDGE_VOICE", "en-US-AvaNeural")
    rate = getattr(settings, "EDGE_RATE", "-4%")
    temp_path = f"{filepath}.{threading.get_ident()}.tmp"

    async def _do_synth():
        comm = edge_tts.Communicate(text, voice, rate=rate)
        await asyncio.wait_for(comm.save(temp_path), timeout=EDGE_SYNTH_TIMEOUT_SEC)

    def _run_once():
        try:
            loop = asyncio.get_running_loop()
        except RuntimeError:
            loop = None

        if loop and loop.is_running():
            with ThreadPoolExecutor(max_workers=1) as pool:
                pool.submit(asyncio.run, _do_synth()).result(timeout=EDGE_SYNTH_TIMEOUT_SEC + 5.0)
        else:
            asyncio.run(_do_synth())

    last_error = None
    backoff_delays = (1.0, 2.5, 5.0)
    for attempt in range(1, EDGE_SYNTH_MAX_RETRIES + 1):
        try:
            _run_once()
            if os.path.exists(temp_path) and os.path.getsize(temp_path) > 0:
                os.replace(temp_path, filepath)
                return True
            last_error = RuntimeError("Empty audio received from Edge TTS")
        except Exception as e:
            last_error = e
            logger.warning(f"Edge TTS attempt {attempt}/{EDGE_SYNTH_MAX_RETRIES} failed: {e}")
        finally:
            if os.path.exists(temp_path):
                try:
                    os.remove(temp_path)
                except OSError:
                    pass
        if attempt < EDGE_SYNTH_MAX_RETRIES:
            base = backoff_delays[min(attempt - 1, len(backoff_delays) - 1)]
            time.sleep(base + random.uniform(0.0, 0.4))

    logger.error(f"Edge TTS synthesis failed after {EDGE_SYNTH_MAX_RETRIES} attempts: {last_error}")
    return False


def synthesize_speech(text: str) -> Optional[str]:
    """
    Synthesizes Eva's speech with Microsoft Edge Neural Voice and caches it on disk by hash.
    Returns the relative audio URL, or None when server audio is unavailable
    (the frontend then reads the text aloud with the browser's Web Speech API).
    """
    provider = get_effective_tts_provider()
    clean = sanitize_tts_text(text)
    if provider == "browser" or not clean:
        return None

    url = cached_speech_url(clean)
    if url:
        return url

    os.makedirs(settings.AUDIO_CACHE_DIR, exist_ok=True)
    filepath, url = _cache_paths(clean)
    try:
        with _lock_for(filepath):
            if os.path.exists(filepath) and os.path.getsize(filepath) > 0:
                return url
            ok = _synthesize_edge(clean, filepath)
        return url if ok else None
    except Exception as e:
        logger.error(f"TTS synthesis failed: {e}")
        return None


def prefetch_speech(texts: Iterable[str]):
    """Queues texts for background synthesis (in order) so audio is cached before the learner reaches them."""
    if get_effective_tts_provider() == "browser":
        return
    for text in texts:
        if sanitize_tts_text(text):
            _prefetch_executor.submit(synthesize_speech, text)


def refresh_question_audio(question, db) -> Optional[str]:
    """Points question.audio_path at the current provider's cached audio (synthesizing it if needed)."""
    if get_effective_tts_provider() == "browser" or not question.question_text:
        return None
    url = synthesize_speech(question.question_text)
    if url and question.audio_path != url:
        question.audio_path = url
        db.commit()
    return url
