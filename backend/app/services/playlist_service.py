"""
Builds one continuous MP3 "listening playlist" (question audio + model answer audio for each selected item).
A single file keeps playing on phones with the screen off and doubles as the downloadable practice file.

Production architecture (Render Free 512 MB RAM / 0.1 vCPU / ephemeral disk):
  - Synthesizes missing TTS segments with production-safe bounded concurrency (2 workers + gentle
    0.15s pacing on Render/production to prevent Bing datacenter IP rate-limits; 3 locally).
  - Fast path: Microsoft Edge TTS emits uniform CBR MPEG-2 Layer III frames (24 kHz, mono, 48 kbps,
    144 bytes/frame = 24 ms, header 0xFFF364C4). When all segments match, frames are stream-copied
    directly to disk with 144-byte silent CBR frames (< 0.5 MB RAM, ~0.05s for 100+ segments, zero
    re-encoding CPU/quality loss, exact browser seeking).
  - Fallback path: when any input file has a different format/sample rate, audio is streamed in
    5-second chunks into sf.SoundFile (~1-2 MB RAM instead of 700+ MB).
  - Wall-clock guard (10 min max) + LRU disk cache pruning (<= 250 MB per cache tier) keep long-running
    containers healthy without disk exhaustion or hung workers.
"""
import datetime
import gc
import hashlib
import json
import logging
import os
import threading
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import Dict, List, Optional, Set, Tuple

from app.config import settings
from app.services.tts_service import (
    cached_speech_url,
    get_effective_tts_provider,
    sanitize_tts_text,
    synthesize_speech,
)

logger = logging.getLogger("opic_playlist")

PLAYLIST_DIR_NAME = "playlists"
SAMPLE_RATE = 24000
GAP_AFTER_QUESTION_SEC = 1.2
GAP_AFTER_QUESTION_SHADOW_SEC = 5.0
GAP_BETWEEN_SENTENCES_SHADOW_SEC = 3.5
GAP_BETWEEN_ITEMS_SEC = 2.5

# Uniform Edge TTS frame spec: MPEG-2 Layer III, 24 kHz, mono, 48 kbps, no CRC -> 144 bytes / 0.024 s
EDGE_MP3_HEADER = b"\xff\xf3\x64\xc4"
EDGE_FRAME_BYTES = 144
EDGE_FRAME_SEC = 0.024
EDGE_BYTES_PER_SEC = EDGE_FRAME_BYTES / EDGE_FRAME_SEC  # 6000.0 bytes/sec
SILENT_EDGE_FRAME = EDGE_MP3_HEADER + (b"\x00" * (EDGE_FRAME_BYTES - 4))

# Bounded background build pool & production-safe synthesis parameters
_executor = ThreadPoolExecutor(max_workers=1, thread_name_prefix="eva_playlist")
STREAM_BLOCK_FRAMES = SAMPLE_RATE * 5  # 5-second streaming blocks (~480 KB float32)
MAX_BUILD_SECONDS = 600.0  # Safety ceiling so a hung build can never wedge the worker
ERROR_TTL_SEC = 300.0

# Automatic LRU disk caps so Render's ephemeral disk or a VPS never fills up
PLAYLIST_CACHE_MAX_BYTES = 250 * 1024 * 1024  # 250 MB for combined playlists
SEGMENT_CACHE_MAX_BYTES = 250 * 1024 * 1024   # 250 MB for individual eva_*.mp3 clips

_lock = threading.Lock()
_in_progress: Dict[str, Dict[str, object]] = {}
_errors: Dict[str, Dict[str, object]] = {}


def _is_production_runtime() -> bool:
    return (
        settings.ENVIRONMENT == "production"
        or os.getenv("RENDER", "").lower() == "true"
        or bool(settings.WHISPER_LOW_MEMORY)
    )


def _synth_workers() -> int:
    return 2 if _is_production_runtime() else 3


def _synth_pacing_sec() -> float:
    # Small polite gap between Edge TTS calls on datacenter IPs prevents 429/403 bursts on 100+ segments
    return 0.15 if _is_production_runtime() else 0.0


def _playlist_dir() -> str:
    path = os.path.join(settings.AUDIO_CACHE_DIR, PLAYLIST_DIR_NAME)
    os.makedirs(path, exist_ok=True)
    return path


def playlist_key(segments: List[Dict[str, str]]) -> str:
    """Stable id for an ordered list of segments ({"kind": "question"|"answer", "text": ...})."""
    voice = getattr(settings, "EDGE_VOICE", "en-US-AvaNeural")
    provider = get_effective_tts_provider()
    payload = json.dumps({"segments": segments, "voice": voice, "provider": provider}, sort_keys=True)
    return hashlib.md5(payload.encode("utf-8")).hexdigest()


def _paths(key: str) -> Tuple[str, str]:
    filename = f"playlist_{key}.mp3"
    return os.path.join(_playlist_dir(), filename), f"/data/audio_cache/{PLAYLIST_DIR_NAME}/{filename}"


def _url_to_path(url: str) -> str:
    return os.path.join(settings.AUDIO_CACHE_DIR, os.path.basename(url))


def _segment_gap_sec(seg: Dict[str, object]) -> float:
    if "gap_sec" in seg and seg["gap_sec"] is not None:
        return max(0.0, float(seg["gap_sec"]))
    kind = seg.get("kind")
    if kind == "question":
        return GAP_AFTER_QUESTION_SEC
    if kind == "sentence":
        return GAP_BETWEEN_SENTENCES_SHADOW_SEC
    return GAP_BETWEEN_ITEMS_SEC


def _is_uniform_edge_mp3(path: str) -> bool:
    """Checks whether `path` is a clean Edge TTS 24kHz mono 48kbps CBR MP3 without ID3/Xing headers."""
    try:
        size = os.path.getsize(path)
        if size < EDGE_FRAME_BYTES or (size % EDGE_FRAME_BYTES) != 0:
            return False
        with open(path, "rb") as f:
            head = f.read(min(size, 512))
        if not head.startswith(EDGE_MP3_HEADER):
            return False
        if b"Xing" in head or b"Info" in head or b"VBRI" in head:
            return False
        if size >= EDGE_FRAME_BYTES * 2 and head[EDGE_FRAME_BYTES:EDGE_FRAME_BYTES + 4] != EDGE_MP3_HEADER:
            return False
        return True
    except OSError:
        return False


def _probe_audio_meta(filepath: str) -> Tuple[Optional[float], Optional[int]]:
    """Returns (duration_seconds, file_size_bytes) with zero heavy RAM allocation."""
    if not os.path.exists(filepath):
        return None, None
    try:
        size = os.path.getsize(filepath)
        if size <= 0:
            return None, None
        if _is_uniform_edge_mp3(filepath):
            return round(size / EDGE_BYTES_PER_SEC, 2), size
        import soundfile as sf
        info = sf.info(filepath)
        return round(float(info.duration), 2), size
    except Exception:
        try:
            return None, os.path.getsize(filepath)
        except OSError:
            return None, None


def get_playlist_file_meta(key: str) -> Dict[str, object]:
    """Returns disk availability and metadata for a playlist key."""
    filepath, url = _paths(key)
    exists = os.path.exists(filepath) and os.path.getsize(filepath) > 0
    if not exists:
        return {"exists": False, "url": None, "duration_seconds": None, "file_size_bytes": None}
    dur, size = _probe_audio_meta(filepath)
    return {"exists": True, "url": url, "duration_seconds": dur, "file_size_bytes": size}


def delete_playlist_file(key: str) -> bool:
    """Removes the generated MP3 file for `key` from disk if present."""
    filepath, _ = _paths(key)
    if os.path.exists(filepath):
        try:
            os.remove(filepath)
            return True
        except OSError:
            return False
    return False


def prune_directory_lru(directory: str, max_bytes: int, prefix: str = "", protect_paths: Optional[Set[str]] = None) -> int:
    """Deletes oldest files (by mtime) in `directory` until total size is <= `max_bytes`. Returns files removed."""
    if max_bytes <= 0 or not os.path.isdir(directory):
        return 0
    protected = {os.path.abspath(p) for p in (protect_paths or set())}
    entries: List[Tuple[float, int, str]] = []
    total_bytes = 0
    try:
        with os.scandir(directory) as it:
            for entry in it:
                if not entry.is_file():
                    continue
                if prefix and not entry.name.startswith(prefix):
                    continue
                if entry.name.endswith(".tmp") or ".tmp." in entry.name:
                    continue
                try:
                    st = entry.stat()
                except OSError:
                    continue
                total_bytes += st.st_size
                entries.append((st.st_mtime, st.st_size, os.path.abspath(entry.path)))
    except OSError:
        return 0

    if total_bytes <= max_bytes:
        return 0

    entries.sort(key=lambda x: x[0])  # oldest first
    removed = 0
    for _, size, fpath in entries:
        if total_bytes <= max_bytes:
            break
        if fpath in protected:
            continue
        try:
            os.remove(fpath)
            total_bytes -= size
            removed += 1
        except OSError:
            pass
    if removed:
        logger.info(f"Pruned {removed} old cache file(s) from {directory} (remaining ~{total_bytes // (1024 * 1024)} MB).")
    return removed


def _stitch_raw_cbr_mp3(seg_paths_and_gaps: List[Tuple[str, float]], out_tmp_path: str):
    """Zero-reencode, ~0.5 MB RAM direct CBR MP3 concatenation with 144-byte silent frames."""
    with open(out_tmp_path, "wb") as out:
        for path, gap in seg_paths_and_gaps:
            with open(path, "rb") as inp:
                while True:
                    chunk = inp.read(65536)
                    if not chunk:
                        break
                    out.write(chunk)
            n_frames = int(round(gap / EDGE_FRAME_SEC))
            if n_frames > 0:
                out.write(SILENT_EDGE_FRAME * n_frames)


def _stitch_streaming_soundfile(seg_paths_and_gaps: List[Tuple[str, float]], out_tmp_path: str):
    """Low-memory (~1-2 MB RAM) chunked streaming fallback via soundfile when inputs aren't uniform CBR MP3."""
    import numpy as np
    import soundfile as sf

    with sf.SoundFile(
        out_tmp_path,
        mode="w",
        samplerate=SAMPLE_RATE,
        channels=1,
        format="MP3",
        subtype="MPEG_LAYER_III",
    ) as out:
        for path, gap in seg_paths_and_gaps:
            with sf.SoundFile(path, mode="r") as inp:
                sr = inp.samplerate
                while True:
                    block = inp.read(STREAM_BLOCK_FRAMES, dtype="float32", always_2d=True)
                    if len(block) == 0:
                        break
                    mono = block.mean(axis=1)
                    if sr != SAMPLE_RATE and len(mono) > 1:
                        target_len = int(len(mono) * SAMPLE_RATE / sr)
                        mono = np.interp(
                            np.linspace(0, len(mono) - 1, target_len),
                            np.arange(len(mono)),
                            mono,
                        ).astype("float32")
                    out.write(mono)
            gap_samples = int(SAMPLE_RATE * gap)
            while gap_samples > 0:
                chunk_len = min(gap_samples, STREAM_BLOCK_FRAMES)
                out.write(np.zeros(chunk_len, dtype="float32"))
                gap_samples -= chunk_len


def _sync_saved_playlists_db(
    key: str,
    status: str,
    audio_path: Optional[str] = None,
    duration_seconds: Optional[float] = None,
    file_size_bytes: Optional[int] = None,
    error_message: Optional[str] = None,
):
    """
    Updates persisted SavedPlaylist rows matching `key` when a background build completes or fails.
    Retries once on transient Neon PostgreSQL SSL reconnect hiccups.
    """
    if "PYTEST_CURRENT_TEST" in os.environ:
        return
    from app.database import SessionLocal
    from app.models.playlist import SavedPlaylist

    for attempt in range(2):
        db = SessionLocal()
        try:
            rows = db.query(SavedPlaylist).filter(SavedPlaylist.playlist_key == key).all()
            if not rows:
                return
            now = datetime.datetime.utcnow()
            for row in rows:
                row.status = status
                if audio_path is not None:
                    row.audio_path = audio_path
                if duration_seconds is not None:
                    row.duration_seconds = duration_seconds
                if file_size_bytes is not None:
                    row.file_size_bytes = file_size_bytes
                row.error_message = error_message
                row.updated_at = now
            db.commit()
            return
        except Exception as exc:
            db.rollback()
            if attempt == 0:
                time.sleep(1.0)
            else:
                logger.warning(f"Could not sync SavedPlaylist DB for {key}: {exc}")
        finally:
            db.close()


def _build(key: str, segments: List[Dict[str, str]]):
    filepath, url = _paths(key)
    tmp = f"{filepath}.{threading.get_ident()}.tmp.mp3"
    started_at = time.monotonic()

    # Sanitize texts upfront so punctuation-only fragments never fail Edge TTS with NoAudioReceived
    clean_segments: List[Tuple[str, float]] = []
    for seg in segments:
        t = sanitize_tts_text(seg.get("text") or "")
        if t:
            clean_segments.append((t, _segment_gap_sec(seg)))

    total = len(clean_segments)
    try:
        if not clean_segments:
            raise RuntimeError("Không có đoạn âm thanh hợp lệ nào để tạo.")

        with _lock:
            if key in _in_progress:
                _in_progress[key]["phase"] = "synthesizing"
                _in_progress[key]["total"] = total

        # Step 1: Synthesize all unique missing texts with production-safe bounded concurrency + pacing
        unique_texts: List[str] = []
        seen: Set[str] = set()
        for t, _ in clean_segments:
            if t not in seen:
                seen.add(t)
                unique_texts.append(t)

        text_to_url: Dict[str, str] = {}
        missing_texts: List[str] = []
        for t in unique_texts:
            cached = cached_speech_url(t)
            if cached:
                text_to_url[t] = cached
            else:
                missing_texts.append(t)

        def _update_done():
            done_count = sum(1 for t, _ in clean_segments if t in text_to_url)
            with _lock:
                if key in _in_progress:
                    _in_progress[key]["done"] = done_count

        _update_done()

        if missing_texts:
            pacing = _synth_pacing_sec()

            def _synth_with_pacing(text_item: str) -> Optional[str]:
                if time.monotonic() - started_at > MAX_BUILD_SECONDS:
                    return None
                res = synthesize_speech(text_item)
                if pacing > 0:
                    time.sleep(pacing)
                return res

            failed_count = 0
            worker_count = min(_synth_workers(), len(missing_texts))
            with ThreadPoolExecutor(max_workers=worker_count, thread_name_prefix="eva_seg_tts") as synth_pool:
                future_map = {synth_pool.submit(_synth_with_pacing, t): t for t in missing_texts}
                for fut in as_completed(future_map):
                    t = future_map[fut]
                    try:
                        res_url = fut.result()
                    except Exception as exc:
                        logger.error(f"Segment TTS raised error: {exc}")
                        res_url = None
                    if res_url:
                        text_to_url[t] = res_url
                        _update_done()
                    else:
                        failed_count += 1

            # Sequential rescue pass with cooldown for any segments throttled under concurrent load
            if failed_count and (time.monotonic() - started_at) < MAX_BUILD_SECONDS:
                still_missing = [t for t in missing_texts if t not in text_to_url]
                if still_missing:
                    time.sleep(2.0 if _is_production_runtime() else 0.5)
                for t in still_missing:
                    if time.monotonic() - started_at > MAX_BUILD_SECONDS:
                        break
                    res_url = synthesize_speech(t)
                    if res_url:
                        text_to_url[t] = res_url
                        _update_done()
                    time.sleep(1.0 if _is_production_runtime() else 0.2)

            unresolvable = [t for t in unique_texts if t not in text_to_url]
            if unresolvable:
                if time.monotonic() - started_at > MAX_BUILD_SECONDS:
                    raise RuntimeError(
                        f"Quá thời gian tạo ({len(unique_texts) - len(unresolvable)}/{len(unique_texts)} đoạn đã lưu). "
                        "Bấm Thử lại để tạo tiếp phần còn lại."
                    )
                raise RuntimeError(
                    f"Không tạo được giọng đọc cho {len(unresolvable)}/{len(unique_texts)} đoạn "
                    "(Edge TTS tạm gián đoạn — bấm Thử lại để tiếp tục từ phần đã lưu)."
                )

        # Step 2: Stitch segments into a single MP3 with < 2 MB peak RAM
        with _lock:
            if key in _in_progress:
                _in_progress[key]["phase"] = "stitching"

        seg_paths_and_gaps: List[Tuple[str, float]] = []
        used_segment_paths: Set[str] = set()
        for t, gap in clean_segments:
            seg_url = text_to_url.get(t)
            if not seg_url:
                raise RuntimeError("Server TTS unavailable")
            seg_path = _url_to_path(seg_url)
            seg_paths_and_gaps.append((seg_path, gap))
            used_segment_paths.add(seg_path)

        all_edge_cbr = all(_is_uniform_edge_mp3(p) for p, _ in seg_paths_and_gaps)
        if all_edge_cbr:
            _stitch_raw_cbr_mp3(seg_paths_and_gaps, tmp)
        else:
            _stitch_streaming_soundfile(seg_paths_and_gaps, tmp)

        os.replace(tmp, filepath)
        dur, size = _probe_audio_meta(filepath)
        logger.info(
            f"Playlist {key} ready ({total} segments, mode={'raw-cbr' if all_edge_cbr else 'stream-sf'}, "
            f"dur={dur}s, size={size}B, elapsed={time.monotonic() - started_at:.1f}s)."
        )
        with _lock:
            _errors.pop(key, None)
        _sync_saved_playlists_db(
            key,
            status="ready",
            audio_path=url,
            duration_seconds=dur,
            file_size_bytes=size,
            error_message=None,
        )

        # Keep ephemeral/local disk usage bounded without touching the just-built playlist or its segments
        prune_directory_lru(_playlist_dir(), PLAYLIST_CACHE_MAX_BYTES, prefix="playlist_", protect_paths={filepath})
        prune_directory_lru(settings.AUDIO_CACHE_DIR, SEGMENT_CACHE_MAX_BYTES, prefix="eva_", protect_paths=used_segment_paths)
    except Exception as e:
        err_msg = str(e) or "Không tạo được file nghe."
        logger.error(f"Playlist {key} failed: {err_msg}")
        with _lock:
            _errors[key] = {"message": err_msg, "ts": time.monotonic()}
        _sync_saved_playlists_db(key, status="error", error_message=err_msg)
    finally:
        if os.path.exists(tmp):
            try:
                os.remove(tmp)
            except OSError:
                pass
        with _lock:
            _in_progress.pop(key, None)
        gc.collect()


def get_playlist_runtime_status(key: str, total: int = 0) -> Dict[str, object]:
    """Reads disk + in-memory build state for `key` without starting a new build."""
    meta = get_playlist_file_meta(key)
    if meta["exists"]:
        return {
            "ready": True,
            "status": "ready",
            "url": meta["url"],
            "key": key,
            "done": total,
            "total": total,
            "phase": "ready",
            "duration_seconds": meta["duration_seconds"],
            "file_size_bytes": meta["file_size_bytes"],
            "error": None,
        }

    with _lock:
        prog = _in_progress.get(key)
        if prog is not None:
            return {
                "ready": False,
                "status": "building",
                "url": None,
                "key": key,
                "done": int(prog.get("done", 0)),
                "total": int(prog.get("total", total)),
                "phase": prog.get("phase", "synthesizing"),
                "duration_seconds": None,
                "file_size_bytes": None,
                "error": None,
            }
        err = _errors.get(key)
        if err and (time.monotonic() - float(err["ts"])) < ERROR_TTL_SEC:
            return {
                "ready": False,
                "status": "error",
                "url": None,
                "key": key,
                "done": 0,
                "total": total,
                "phase": "error",
                "duration_seconds": None,
                "file_size_bytes": None,
                "error": str(err["message"]),
            }

    return {
        "ready": False,
        "status": "missing",
        "url": None,
        "key": key,
        "done": 0,
        "total": total,
        "phase": None,
        "duration_seconds": None,
        "file_size_bytes": None,
        "error": None,
    }


def request_playlist(segments: List[Dict[str, str]], force_retry: bool = False) -> Dict[str, object]:
    """
    Returns {"ready": True, "url": ...} when the MP3 exists; otherwise queues the build (once) and
    returns progress so the client can poll cleanly. If the previous build failed, surfaces
    the error until the user retries (`force_retry=True`).
    """
    if get_effective_tts_provider() == "browser":
        raise RuntimeError("Server audio is disabled (TTS_PROVIDER=browser).")

    key = playlist_key(segments)
    filepath, url = _paths(key)
    total = len(segments)

    if os.path.exists(filepath) and os.path.getsize(filepath) > 0:
        dur, size = _probe_audio_meta(filepath)
        return {
            "ready": True,
            "status": "ready",
            "url": url,
            "key": key,
            "done": total,
            "total": total,
            "phase": "ready",
            "duration_seconds": dur,
            "file_size_bytes": size,
            "error": None,
        }

    done = sum(1 for seg in segments if cached_speech_url(seg["text"]))

    should_submit = False
    with _lock:
        if force_retry:
            _errors.pop(key, None)

        err = _errors.get(key)
        if err and (time.monotonic() - float(err["ts"])) < ERROR_TTL_SEC and key not in _in_progress:
            return {
                "ready": False,
                "status": "error",
                "url": None,
                "key": key,
                "done": done,
                "total": total,
                "phase": "error",
                "duration_seconds": None,
                "file_size_bytes": None,
                "error": str(err["message"]),
            }

        if key not in _in_progress:
            initial_phase = "queued" if len(_in_progress) > 0 else "synthesizing"
            _in_progress[key] = {
                "done": done,
                "total": total,
                "phase": initial_phase,
                "started_at": time.monotonic(),
            }
            should_submit = True
        else:
            done = max(done, int(_in_progress[key].get("done", 0)))
        phase = _in_progress[key].get("phase", "synthesizing")

    if should_submit:
        _executor.submit(_build, key, segments)
        # If executor ran synchronously (e.g. unit test) and already produced the file, reflect ready immediately
        if os.path.exists(filepath) and os.path.getsize(filepath) > 0:
            dur, size = _probe_audio_meta(filepath)
            return {
                "ready": True,
                "status": "ready",
                "url": url,
                "key": key,
                "done": total,
                "total": total,
                "phase": "ready",
                "duration_seconds": dur,
                "file_size_bytes": size,
                "error": None,
            }

    return {
        "ready": False,
        "status": "building",
        "url": None,
        "key": key,
        "done": done,
        "total": total,
        "phase": phase,
        "duration_seconds": None,
        "file_size_bytes": None,
        "error": None,
    }
