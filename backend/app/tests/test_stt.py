from app.routers import answers as answers_router
from app.services.stt_service import merge_soniox_tokens, TranscriptionError


def test_merge_soniox_subword_tokens_into_words():
    tokens = [
        {"text": "T", "start_ms": 90, "end_ms": 150, "confidence": 0.99},
        {"text": "ell", "start_ms": 150, "end_ms": 210, "confidence": 0.62},
        {"text": " me", "start_ms": 210, "end_ms": 270, "confidence": 0.98},
        {"text": ",", "start_ms": 270, "end_ms": 280, "confidence": 0.97},
        {"text": " Eva", "start_ms": 300, "end_ms": 420, "confidence": 0.9},
    ]
    words = merge_soniox_tokens(tokens)
    assert [w["word"] for w in words] == ["Tell", "me,", "Eva"]
    assert words[0]["confidence"] == 0.62  # weakest piece
    assert words[0]["start_ms"] == 90 and words[0]["end_ms"] == 210


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
