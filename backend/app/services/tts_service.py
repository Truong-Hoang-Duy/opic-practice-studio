import os
import hashlib
import logging
import threading
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from typing import Iterable, Optional
from app.config import settings

logger = logging.getLogger("opic_tts")

# Kokoro model files (open-source Kokoro-82M, Apache-2.0, ONNX build from thewh1teagle/kokoro-onnx)
KOKORO_MODEL_FILE = "kokoro-v1.0.onnx"
KOKORO_VOICES_FILE = "voices-v1.0.bin"
KOKORO_MODEL_ID = "kokoro-v1.0"

_kokoro = None
_kokoro_failed = False
_kokoro_lock = threading.Lock()   # guards model loading
_synth_lock = threading.Lock()    # serialises CPU-heavy synthesis
# Single worker so background pre-synthesis never competes with itself for CPU
_prefetch_executor = ThreadPoolExecutor(max_workers=1, thread_name_prefix="eva_tts")


def get_audio_hash(text: str, voice: str, model: str) -> str:
    combined = f"{text.strip().lower()}_{voice}_{model}"
    return hashlib.md5(combined.encode("utf-8")).hexdigest()


def _voice_and_model() -> tuple:
    if settings.TTS_PROVIDER == "openai":
        return settings.TTS_VOICE, settings.TTS_MODEL
    return settings.KOKORO_VOICE, KOKORO_MODEL_ID


def _cache_paths(text: str) -> tuple:
    voice, model = _voice_and_model()
    filename = f"eva_{get_audio_hash(text, voice, model)}.mp3"
    return os.path.join(settings.AUDIO_CACHE_DIR, filename), f"/data/audio_cache/{filename}"


def cached_speech_url(text: str) -> Optional[str]:
    """Returns the cached audio URL for `text` if it has already been synthesized, without synthesizing."""
    if settings.TTS_PROVIDER == "browser" or not text:
        return None
    filepath, url = _cache_paths(text)
    if os.path.exists(filepath) and os.path.getsize(filepath) > 0:
        return url
    return None


def _download(url: str, dest: str):
    tmp = dest + ".part"
    logger.info(f"Downloading Kokoro TTS file {url} ...")
    urllib.request.urlretrieve(url, tmp)
    os.replace(tmp, dest)


def _get_kokoro():
    """Lazily downloads (first run only) and loads the Kokoro ONNX model. Returns None if unavailable."""
    global _kokoro, _kokoro_failed
    if _kokoro is not None or _kokoro_failed:
        return _kokoro
    with _kokoro_lock:
        if _kokoro is not None or _kokoro_failed:
            return _kokoro
        try:
            from kokoro_onnx import Kokoro
            os.makedirs(settings.KOKORO_MODEL_DIR, exist_ok=True)
            model_path = os.path.join(settings.KOKORO_MODEL_DIR, KOKORO_MODEL_FILE)
            voices_path = os.path.join(settings.KOKORO_MODEL_DIR, KOKORO_VOICES_FILE)
            if not os.path.exists(model_path):
                _download(settings.KOKORO_MODEL_URL, model_path)
            if not os.path.exists(voices_path):
                _download(settings.KOKORO_VOICES_URL, voices_path)
            _kokoro = Kokoro(model_path, voices_path)
            logger.info(f"Kokoro TTS ready (voice={settings.KOKORO_VOICE}).")
        except Exception as e:
            _kokoro_failed = True
            logger.error(f"Kokoro TTS unavailable, frontend will fall back to browser speech: {e}")
    return _kokoro


def warm_up_tts():
    """Downloads/loads the local TTS model ahead of the first request. Safe to call from a background thread."""
    if settings.TTS_PROVIDER == "kokoro":
        _get_kokoro()


def _synthesize_kokoro(text: str, filepath: str) -> bool:
    kokoro = _get_kokoro()
    if kokoro is None:
        return False
    import soundfile as sf
    samples, sample_rate = kokoro.create(text, voice=settings.KOKORO_VOICE, speed=settings.KOKORO_SPEED, lang="en-us")
    tmp = filepath + ".tmp.mp3"
    sf.write(tmp, samples, sample_rate)
    os.replace(tmp, filepath)
    return True


def _synthesize_openai(text: str, filepath: str) -> bool:
    if not settings.OPENAI_API_KEY or settings.OPENAI_API_KEY.startswith("your_"):
        return False
    from openai import OpenAI
    client = OpenAI(api_key=settings.OPENAI_API_KEY, timeout=30.0)
    response = client.audio.speech.create(
        model=settings.TTS_MODEL,
        voice=settings.TTS_VOICE,
        input=text,
        speed=0.95  # Slightly slower for warm, professional test interviewer pacing
    )
    response.write_to_file(filepath)
    return True


def synthesize_speech(text: str) -> Optional[str]:
    """
    Synthesizes Eva's speech with the configured provider and caches it on disk by hash(text+voice+model).
    Returns the relative audio URL, or None when server audio is unavailable
    (the frontend then reads the text aloud with the browser's Web Speech API).
    """
    if settings.TTS_PROVIDER == "browser" or not text or not text.strip():
        return None

    url = cached_speech_url(text)
    if url:
        return url

    filepath, url = _cache_paths(text)
    try:
        with _synth_lock:
            # Another thread may have produced it while we waited
            if os.path.exists(filepath) and os.path.getsize(filepath) > 0:
                return url
            if settings.TTS_PROVIDER == "openai":
                ok = _synthesize_openai(text, filepath)
            else:
                ok = _synthesize_kokoro(text, filepath)
        return url if ok else None
    except Exception as e:
        logger.error(f"TTS synthesis failed ({settings.TTS_PROVIDER}): {e}")
        return None


def prefetch_speech(texts: Iterable[str]):
    """Queues texts for background synthesis (in order) so audio is cached before the learner reaches them."""
    if settings.TTS_PROVIDER == "browser":
        return
    for text in texts:
        _prefetch_executor.submit(synthesize_speech, text)


def refresh_question_audio(question, db) -> Optional[str]:
    """
    Points question.audio_path at the current provider's cached audio (synthesizing it if needed).
    Also replaces stale paths left by older providers, e.g. the former chime fallback files.
    """
    url = synthesize_speech(question.question_text)
    if url != question.audio_path:
        question.audio_path = url
        db.commit()
    return url
