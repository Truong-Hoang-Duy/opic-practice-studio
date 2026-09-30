from app.routers import answers as answers_router
from app.services import llm_service


def test_dev_session_simulates_every_ai_and_stt_call(client, monkeypatch):
    def boom(*args, **kwargs):
        raise AssertionError("DEV sessions must not call external AI/STT services")

    monkeypatch.setattr(answers_router, "transcribe_audio_file", boom)
    monkeypatch.setattr(llm_service, "get_openai_client", boom)

    reg = client.post("/api/auth/register", json={"email": "devmock@example.com", "password": "Password123!", "full_name": "Dev"})
    headers = {"Authorization": f"Bearer {reg.json()['access_token']}"}
    sid = client.post("/api/sessions", json={"mode": "practice"}, headers=headers).json()["id"]
    client.post(f"/api/sessions/{sid}/topics", json={"topics": ["environment", "global_workplace", "communication_media"]}, headers=headers)
    assess = client.post(f"/api/sessions/{sid}/self-assessment", json={"level": 4, "use_ai": False}, headers=headers).json()
    assert assess["question_source"] == "bank"
    assert client.get(f"/api/sessions/{sid}/status", headers=headers).json()["dev_mock"] is True

    q2 = client.get(f"/api/sessions/{sid}/questions/2", headers=headers).json()
    q3 = client.get(f"/api/sessions/{sid}/questions/3", headers=headers).json()

    # Short take -> simulated silence (scored by the standard lowest level)
    short = client.post("/api/answers", data={"question_id": q2["id"], "session_id": sid, "duration_seconds": 1},
                        files={"audio_file": ("q2.webm", b"audio", "audio/webm")}, headers=headers).json()
    assert short["transcript_raw"] == "" and short["versions"][0]["notes"] == "no_speech"
    assert client.post(f"/api/answers/{short['id']}/evaluate", headers=headers).json()["estimated_level"] == "below_IL"

    # Normal take -> sample transcript with low-confidence words, mock scoring / rewrite / model answers
    normal = client.post("/api/answers", data={"question_id": q3["id"], "session_id": sid, "duration_seconds": 20},
                         files={"audio_file": ("q3.webm", b"audio", "audio/webm")}, headers=headers).json()
    assert normal["transcript_raw"]
    assert any(w["confidence"] < 0.8 for w in normal["word_confidences"])
    ev = client.post(f"/api/answers/{normal['id']}/evaluate", headers=headers)
    assert ev.status_code == 200 and ev.json()["estimated_level"] in ("IL", "IM", "IH")
    rw = client.post(f"/api/answers/{normal['id']}/rewrite", json={"answer_version_id": normal["versions"][0]["id"], "target_level": "IH"}, headers=headers)
    assert rw.status_code == 200
    assert len(client.get(f"/api/questions/{q3['id']}/model-answers", headers=headers).json()) == 3

    client.post(f"/api/sessions/{sid}/finish", headers=headers)
    report = client.get(f"/api/sessions/{sid}/report", headers=headers)
    assert report.status_code == 200
    rows = {r["question_num"]: r for r in report.json()["per_question_summary"]}
    assert rows[2]["status"] == "scored" and rows[2]["audio_path"]
    assert rows[3]["status"] == "scored" and rows[3]["transcript"]
