import os
import numpy as np
import soundfile as sf
from app.services import playlist_service


def _session_with_questions(client, email: str):
    reg = client.post("/api/auth/register", json={"email": email, "password": "Password123!", "full_name": "Library Tester"})
    headers = {"Authorization": f"Bearer {reg.json()['access_token']}"}
    sid = client.post("/api/sessions", json={"mode": "practice"}, headers=headers).json()["id"]
    client.post(f"/api/sessions/{sid}/survey", json={
        "occupation": "Working professional", "student_status": "Graduated", "living_situation": "Apartment alone",
        "leisure_activities": ["Going to cafes"], "hobbies": ["Cooking"], "sports": ["Jogging"], "travel": ["Domestic trips"]
    }, headers=headers)
    client.post(f"/api/sessions/{sid}/topics", json={"topics": ["environment", "global_workplace", "communication_media"]}, headers=headers)
    client.post(f"/api/sessions/{sid}/self-assessment", json={"level": 5, "strict_mode": False}, headers=headers)
    return sid, headers


def test_library_lists_question_sets_and_requires_model_answers_for_playlist(client):
    sid, headers = _session_with_questions(client, "library@example.com")

    library = client.get("/api/library", headers=headers).json()
    assert len(library) == 1
    qset = library[0]
    assert qset["session_id"] == sid
    assert qset["default_model_level"] == "IH"  # level 5
    assert len(qset["questions"]) == 15
    assert qset["questions"][0]["model_answers"] == []

    q2 = qset["questions"][1]["id"]
    resp = client.post("/api/library/playlist", json={"question_ids": [q2]}, headers=headers)
    assert resp.status_code == 409
    assert resp.json()["detail"]["missing_question_ids"] == [q2]

    # Another learner cannot use these questions
    other = client.post("/api/auth/register", json={"email": "intruder@example.com", "password": "Password123!", "full_name": "X"})
    other_headers = {"Authorization": f"Bearer {other.json()['access_token']}"}
    assert client.post("/api/library/playlist", json={"question_ids": [q2]}, headers=other_headers).status_code == 404


def test_playlist_builder_concatenates_segments(tmp_path, monkeypatch):
    monkeypatch.setattr(playlist_service.settings, "AUDIO_CACHE_DIR", str(tmp_path))
    monkeypatch.setattr(playlist_service.settings, "TTS_PROVIDER", "kokoro")

    def fake_synthesize(text):
        name = f"eva_{abs(hash(text))}.mp3"
        path = os.path.join(str(tmp_path), name)
        if not os.path.exists(path):
            sf.write(path, np.full(24000, 0.1, dtype="float32"), 24000)  # 1 second
        return f"/data/audio_cache/{name}"

    monkeypatch.setattr(playlist_service, "synthesize_speech", fake_synthesize)
    segments = [{"kind": "question", "text": "Question one?"}, {"kind": "answer", "text": "Answer one."}]
    key = playlist_service.playlist_key(segments)
    playlist_service._build(key, segments)

    status = playlist_service.request_playlist(segments)
    assert status["ready"] is True
    data, sr = sf.read(os.path.join(str(tmp_path), "playlists", f"playlist_{key}.mp3"))
    expected = 2 + playlist_service.GAP_AFTER_QUESTION_SEC + playlist_service.GAP_BETWEEN_ITEMS_SEC
    assert abs(len(data) / sr - expected) < 0.3
