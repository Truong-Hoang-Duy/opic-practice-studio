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

    assert qset["questions"][1]["category"] == "home"
    assert qset["questions"][1]["timing"]["time_limit_sec"] > 0

    # Q1 (fixed self-introduction) is never part of a listening playlist
    q1 = qset["questions"][0]["id"]
    assert client.post("/api/library/playlist", json={"question_ids": [q1]}, headers=headers).status_code == 422

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
    monkeypatch.setattr(playlist_service.settings, "TTS_PROVIDER", "edge")

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


def test_library_returns_existing_answer_and_reuses_first_model_answers(client):
    sid1, headers = _session_with_questions(client, "library_reuse@example.com")
    lib1 = client.get("/api/library", headers=headers).json()
    q2_s1 = lib1[0]["questions"][1]

    # Submit an answer for Q2 in Session 1
    ans_res = client.post("/api/answers", data={
        "question_id": q2_s1["id"],
        "session_id": sid1,
        "duration_seconds": 65,
        "transcript_raw": "I live in a bright apartment with my parents.",
    }, headers=headers)
    assert ans_res.status_code == 200

    # Generate model answers for Q2 in Session 1
    models_s1 = client.get(f"/api/questions/{q2_s1['id']}/model-answers", headers=headers).json()
    assert len(models_s1) == 3

    # Create a second session for the same user (shares Q1 self-intro and any matching questions)
    sid2 = client.post("/api/sessions", json={"mode": "practice"}, headers=headers).json()["id"]
    client.post(f"/api/sessions/{sid2}/survey", json={
        "occupation": "Working professional", "student_status": "Graduated", "living_situation": "Apartment alone",
        "leisure_activities": ["Going to cafes"], "hobbies": ["Cooking"], "sports": ["Jogging"], "travel": ["Domestic trips"]
    }, headers=headers)
    client.post(f"/api/sessions/{sid2}/topics", json={"topics": ["environment", "global_workplace", "communication_media"]}, headers=headers)
    client.post(f"/api/sessions/{sid2}/self-assessment", json={"level": 5, "strict_mode": False, "use_ai": False}, headers=headers)

    lib2 = client.get("/api/library", headers=headers).json()
    s1_in_lib = next(s for s in lib2 if s["session_id"] == sid1)
    assert s1_in_lib["questions"][1]["existing_answer"] is not None
    assert s1_in_lib["questions"][1]["existing_answer"]["id"] == ans_res.json()["id"]

    # Calling get_model_answers with regenerate=true replaces the model answers
    regenerated = client.get(f"/api/questions/{q2_s1['id']}/model-answers?regenerate=true", headers=headers).json()
    assert len(regenerated) == 3
