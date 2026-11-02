from types import SimpleNamespace
from app.config import settings
from app.routers import answers as answers_router
from app.services import stt_service
from app.services.stt_service import (
    format_whisper_words,
    merge_groq_words,
    resolve_whisper_model_name,
    TranscriptionError,
)


def test_format_faster_whisper_words_with_timings_and_confidence():
    raw_words = [
        SimpleNamespace(word=" Umm,", start=0.12, end=0.45, probability=0.91),
        SimpleNamespace(word=" I", start=0.50, end=0.62, probability=0.99),
        SimpleNamespace(word=" live", start=0.62, end=0.88, probability=0.95),
        SimpleNamespace(word=" in", start=0.88, end=1.02, probability=0.98),
        SimpleNamespace(word=" Hanoi", start=1.05, end=1.48, probability=0.72),
        SimpleNamespace(word=".", start=1.48, end=1.52, probability=0.96),
    ]
    words = format_whisper_words(raw_words)
    assert [w["word"] for w in words] == ["Umm,", "I", "live", "in", "Hanoi."]
    assert words[0]["start_ms"] == 120 and words[0]["end_ms"] == 450
    assert words[-1]["confidence"] == 0.72  # weakest piece preserved when attaching punctuation
    assert words[-1]["end_ms"] == 1520


def test_merge_groq_verbose_json_words():
    raw_words = [
        {"word": "Well,", "start": 0.2, "end": 0.5},
        {"word": "environment", "start": 0.6, "end": 1.3},
    ]
    segments = [{"start": 0.0, "end": 2.0, "avg_logprob": -0.10}]
    words = merge_groq_words(raw_words, segments)
    assert [w["word"] for w in words] == ["Well,", "environment"]
    assert words[0]["start_ms"] == 200 and words[0]["end_ms"] == 500
    assert 0.8 <= words[0]["confidence"] <= 0.99


def test_provider_routing_and_render_low_memory(monkeypatch):
    # On Render Free (RENDER=true), default base.en automatically steps down to tiny.en
    monkeypatch.setenv("RENDER", "true")
    monkeypatch.delenv("WHISPER_MODEL", raising=False)
    monkeypatch.setattr(settings, "WHISPER_MODEL", "base.en")
    assert resolve_whisper_model_name() == "tiny.en"

    # Auto mode without Groq key routes directly to local faster-whisper
    monkeypatch.setattr(settings, "STT_PROVIDER", "auto")
    monkeypatch.setattr(settings, "GROQ_API_KEY", "")
    monkeypatch.setattr(
        stt_service,
        "transcribe_with_faster_whisper",
        lambda *a, **k: {"text": "Local whisper transcript", "words": []},
    )
    res = stt_service.transcribe_audio_file(b"audio", "q2.webm")
    assert res["text"] == "Local whisper transcript"

    # Auto mode with Groq key tries Groq first, then falls back to local faster-whisper on error
    monkeypatch.setattr(settings, "GROQ_API_KEY", "gsk_test_free_key")

    def fail_groq(*a, **k):
        raise TranscriptionError("rate limit")

    monkeypatch.setattr(stt_service, "transcribe_with_groq", fail_groq)
    res_fallback = stt_service.transcribe_audio_file(b"audio", "q2.webm")
    assert res_fallback["text"] == "Local whisper transcript"


def _question(client, email):
    reg = client.post("/api/auth/register", json={"email": email, "password": "Password123!", "full_name": "STT"})
    headers = {"Authorization": f"Bearer {reg.json()['access_token']}"}
    sid = client.post("/api/sessions", json={"mode": "practice"}, headers=headers).json()["id"]
    client.post(f"/api/sessions/{sid}/topics", json={"topics": ["environment", "global_workplace", "communication_media"]}, headers=headers)
    client.post(f"/api/sessions/{sid}/self-assessment", json={"level": 4}, headers=headers)
    q = client.get(f"/api/sessions/{sid}/questions/2", headers=headers).json()
    return sid, q["id"], headers


def test_recording_is_transcribed_after_upload(client, monkeypatch):
    sid, qid, headers = _question(client, "stt_ok@example.com")
    monkeypatch.setattr(answers_router, "transcribe_audio_file", lambda *a, **k: {
        "text": "I live in a small apartment.",
        "words": [{"word": "I", "confidence": 0.99, "start_ms": 0, "end_ms": 100}],
    })
    resp = client.post("/api/answers", data={"question_id": qid, "session_id": sid, "duration_seconds": 42},
                       files={"audio_file": ("q2.webm", b"fake-audio", "audio/webm")}, headers=headers)
    assert resp.status_code == 200
    body = resp.json()
    assert body["transcript_raw"] == "I live in a small apartment."
    assert body["word_confidences"][0]["confidence"] == 0.99
    assert body["duration_seconds"] == 42


def test_recognition_problems_still_save_audio_and_score(client, monkeypatch):
    sid, qid, headers = _question(client, "stt_fail@example.com")

    def fail(*a, **k):
        raise TranscriptionError("down")

    # Provider failure: the recording is kept and the answer is scored by the standard (no error for the learner)
    monkeypatch.setattr(answers_router, "transcribe_audio_file", fail)
    resp = client.post("/api/answers", data={"question_id": qid, "session_id": sid, "duration_seconds": 30},
                       files={"audio_file": ("q2.webm", b"fake-audio", "audio/webm")}, headers=headers)
    assert resp.status_code == 200
    body = resp.json()
    assert body["transcript_raw"] == "" and body["audio_path"].startswith("/data/uploads/")
    assert body["versions"][0]["notes"] == "transcription_failed"
    first_audio = body["versions"][0]["audio_path"]

    ev = client.post(f"/api/answers/{body['id']}/evaluate", headers=headers).json()
    assert ev["estimated_level"] == "below_IL" and ev["score_fluency"] == 1

    # Silence on a re-take: new version with its own recording file (earlier take is not overwritten)
    monkeypatch.setattr(answers_router, "transcribe_audio_file", lambda *a, **k: {"text": "", "words": []})
    resp = client.post("/api/answers", data={"question_id": qid, "session_id": sid},
                       files={"audio_file": ("q2.webm", b"fake-audio-2", "audio/webm")}, headers=headers)
    assert resp.status_code == 200
    versions = resp.json()["versions"]
    assert versions[-1]["notes"] == "no_speech"
    assert versions[-1]["audio_path"] != first_audio

    # No audio and no transcript is still rejected
    assert client.post("/api/answers", data={"question_id": qid, "session_id": sid}, headers=headers).status_code == 422
