"""
Builds one continuous MP3 "listening playlist" (question audio + model answer audio for each selected item).
A single file keeps playing on phones with the screen off and doubles as the downloadable practice file.
"""
import hashlib
import json
import logging
import os
import threading
from concurrent.futures import ThreadPoolExecutor
from typing import Dict, List, Optional

from app.config import settings
from app.services.tts_service import cached_speech_url, synthesize_speech

logger = logging.getLogger("opic_playlist")

PLAYLIST_DIR_NAME = "playlists"
SAMPLE_RATE = 24000
GAP_AFTER_QUESTION_SEC = 1.2
GAP_BETWEEN_ITEMS_SEC = 2.5

_executor = ThreadPoolExecutor(max_workers=1, thread_name_prefix="eva_playlist")
_in_progress: Dict[str, bool] = {}
_lock = threading.Lock()


def _playlist_dir() -> str:
    path = os.path.join(settings.AUDIO_CACHE_DIR, PLAYLIST_DIR_NAME)
    os.makedirs(path, exist_ok=True)
    return path


def playlist_key(segments: List[Dict[str, str]]) -> str:
    """Stable id for an ordered list of segments ({"kind": "question"|"answer", "text": ...})."""
    voice = settings.KOKORO_VOICE if settings.TTS_PROVIDER != "openai" else settings.TTS_VOICE
    payload = json.dumps({"segments": segments, "voice": voice, "provider": settings.TTS_PROVIDER}, sort_keys=True)
    return hashlib.md5(payload.encode("utf-8")).hexdigest()


def _paths(key: str):
    filename = f"playlist_{key}.mp3"
    return os.path.join(_playlist_dir(), filename), f"/data/audio_cache/{PLAYLIST_DIR_NAME}/{filename}"


def _url_to_path(url: str) -> str:
    return os.path.join(settings.AUDIO_CACHE_DIR, os.path.basename(url))


def _load_mono(path: str):
    import numpy as np
    import soundfile as sf
    data, sr = sf.read(path, dtype="float32", always_2d=True)
    mono = data.mean(axis=1)
    if sr != SAMPLE_RATE and len(mono) > 1:
        # Simple linear resample (all Eva audio is 24 kHz already; this only guards other providers)
        target_len = int(len(mono) * SAMPLE_RATE / sr)
        mono = np.interp(np.linspace(0, len(mono) - 1, target_len), np.arange(len(mono)), mono).astype("float32")
    return mono


def _build(key: str, segments: List[Dict[str, str]]):
    import numpy as np
    import soundfile as sf
    try:
        parts = []
        for seg in segments:
            url = synthesize_speech(seg["text"])
            if not url:
                raise RuntimeError("Server TTS unavailable")
            parts.append(_load_mono(_url_to_path(url)))
            gap = GAP_AFTER_QUESTION_SEC if seg["kind"] == "question" else GAP_BETWEEN_ITEMS_SEC
            parts.append(np.zeros(int(SAMPLE_RATE * gap), dtype="float32"))
        filepath, _ = _paths(key)
        tmp = filepath + ".tmp.mp3"
        sf.write(tmp, np.concatenate(parts), SAMPLE_RATE)
        os.replace(tmp, filepath)
        logger.info(f"Playlist {key} ready ({len(segments)} segments).")
    except Exception as e:
        logger.error(f"Playlist {key} failed: {e}")
    finally:
        with _lock:
            _in_progress.pop(key, None)


def request_playlist(segments: List[Dict[str, str]]) -> Dict[str, object]:
    """
    Returns {"ready": True, "url": ...} when the MP3 exists; otherwise queues the build (once) and
    returns progress so the client can poll the same request.
    """
    if settings.TTS_PROVIDER == "browser":
        raise RuntimeError("Server audio is disabled (TTS_PROVIDER=browser).")

    key = playlist_key(segments)
    filepath, url = _paths(key)
    total = len(segments)
    if os.path.exists(filepath) and os.path.getsize(filepath) > 0:
        return {"ready": True, "url": url, "done": total, "total": total}

    with _lock:
        if key not in _in_progress:
            _in_progress[key] = True
            _executor.submit(_build, key, segments)

    done = sum(1 for seg in segments if cached_speech_url(seg["text"]))
    return {"ready": False, "url": None, "done": done, "total": total}
