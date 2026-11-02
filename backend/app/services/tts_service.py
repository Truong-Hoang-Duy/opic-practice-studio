import os
import asyncio
import hashlib
import logging
import threading
from concurrent.futures import ThreadPoolExecutor
from typing import Iterable, Optional
import edge_tts
from app.config import settings

logger = logging.getLogger("opic_tts")

_synth_lock = threading.Lock()
_prefetch_executor = ThreadPoolExecutor(max_workers=1, thread_name_prefix="eva_tts")


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
    if get_effective_tts_provider() == "browser" or not text:
        return None
    filepath, url = _cache_paths(text)
    if os.path.exists(filepath) and os.path.getsize(filepath) > 0:
        return url
    return None


def warm_up_tts():
    """No-op for edge-tts as it streams on-demand without local model RAM overhead."""
    pass


def _synthesize_edge(text: str, filepath: str) -> bool:
    """Synthesizes text using Microsoft Edge Neural Voice (free, 0 MB server RAM, streaming MP3)."""
    voice = getattr(settings, "EDGE_VOICE", "en-US-AvaNeural")
    rate = getattr(settings, "EDGE_RATE", "-4%")
    temp_path = filepath + ".tmp"

    async def _do_synth():
        comm = edge_tts.Communicate(text, voice, rate=rate)
        await comm.save(temp_path)

    try:
        try:
            loop = asyncio.get_running_loop()
        except RuntimeError:
            loop = None

        if loop and loop.is_running():
            import concurrent.futures
            with concurrent.futures.ThreadPoolExecutor(max_workers=1) as pool:
                pool.submit(asyncio.run, _do_synth()).result()
        else:
            asyncio.run(_do_synth())

        if os.path.exists(temp_path) and os.path.getsize(temp_path) > 0:
            os.replace(temp_path, filepath)
            return True
        return False
    except Exception as e:
        logger.error(f"Edge TTS synthesis error: {e}")
        if os.path.exists(temp_path):
            try:
                os.remove(temp_path)
            except OSError:
                pass
        return False


def synthesize_speech(text: str) -> Optional[str]:
    """
    Synthesizes Eva's speech with Microsoft Edge Neural Voice and caches it on disk by hash.
    Returns the relative audio URL, or None when server audio is unavailable
    (the frontend then reads the text aloud with the browser's Web Speech API).
    """
    provider = get_effective_tts_provider()
    if provider == "browser" or not text or not text.strip():
        return None

    url = cached_speech_url(text)
    if url:
        return url

    filepath, url = _cache_paths(text)
    try:
        with _synth_lock:
            if os.path.exists(filepath) and os.path.getsize(filepath) > 0:
                return url
            ok = _synthesize_edge(text, filepath)
        return url if ok else None
    except Exception as e:
        logger.error(f"TTS synthesis failed: {e}")
        return None


def prefetch_speech(texts: Iterable[str]):
    """Queues texts for background synthesis (in order) so audio is cached before the learner reaches them."""
    if get_effective_tts_provider() == "browser":
        return
    for text in texts:
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
