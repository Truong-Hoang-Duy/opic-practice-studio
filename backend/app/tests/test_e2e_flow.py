def test_full_opic_end_to_end_flow(client):
    # 1. Register candidate
    reg_resp = client.post("/api/auth/register", json={
        "email": "candidate_test@example.com",
        "password": "Password123!",
        "full_name": "Nguyen Van A"
    })
    assert reg_resp.status_code == 200
    token = reg_resp.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # 2. System Check / Ping
    ping_resp = client.get("/api/system/ping")
    assert ping_resp.status_code == 200
    assert ping_resp.json()["status"] == "ok"

    # 3. Create Session
    session_resp = client.post("/api/sessions", json={"mode": "practice"}, headers=headers)
    assert session_resp.status_code == 200
    session_id = session_resp.json()["id"]

    # 4. Submit Background Survey
    survey_resp = client.post(f"/api/sessions/{session_id}/survey", json={
        "occupation": "Working professional",
        "student_status": "Graduated",
        "living_situation": "Apartment alone",
        "leisure_activities": ["Going to cafes", "Parks", "Cinema"],
        "hobbies": ["Listening to music", "Cooking"],
        "sports": ["Jogging", "Gym"],
        "travel": ["Domestic trips", "Overseas travel"]
    }, headers=headers)
    assert survey_resp.status_code == 200

    # 5. Submit Self-Assessment (Level 4: Intermediate Mid -> Target IH)
    assess_resp = client.post(f"/api/sessions/{session_id}/self-assessment", json={
        "level": 4
    }, headers=headers)
    assert assess_resp.status_code == 200

    # 6. Submit Exactly 3 Topics
    # Test invalid count rejection
    invalid_topics_resp = client.post(f"/api/sessions/{session_id}/topics", json={
        "topics": ["environment", "global_workplace"]
    }, headers=headers)
    assert invalid_topics_resp.status_code == 422 # validation error for not 3 topics

    # Valid exactly 3 topics
    valid_topics_resp = client.post(f"/api/sessions/{session_id}/topics", json={
        "topics": ["environment", "global_workplace", "communication_media"]
    }, headers=headers)
    assert valid_topics_resp.status_code == 200
    assert valid_topics_resp.json()["total_questions"] == 15

    # 7. Fetch Next Question (Q1)
    q1_resp = client.get(f"/api/sessions/{session_id}/next-question", headers=headers)
    assert q1_resp.status_code == 200
    q1_data = q1_resp.json()
    assert q1_data["order_index"] == 1
    assert "vietnamese_guide" in q1_data

    # 8. Submit Answer for Q1
    ans_resp = client.post("/api/answers", data={
        "question_id": q1_data["id"],
        "session_id": session_id,
        "duration_seconds": 65.5,
        "transcript_raw": "Hello Eva, my name is Alex. I live in a lovely apartment in Hanoi. I work as an engineer and in my free time I love jogging."
    }, headers=headers)
    assert ans_resp.status_code == 200
    answer_id = ans_resp.json()["id"]

    # 9. Edit transcript (creates version 2)
    edit_resp = client.patch(f"/api/answers/{answer_id}/transcript", json={
        "transcript_edited": "Hello Eva, my name is Alex. I currently reside in a cozy apartment in Hanoi. I work as a software engineer, and in my leisure time, I am passionate about jogging around West Lake."
    }, headers=headers)
    assert edit_resp.status_code == 200
    assert edit_resp.json()["version_number"] == 2

    # 10. Evaluate Answer (LLM mock evaluation)
    eval_resp = client.post(f"/api/answers/{answer_id}/evaluate", headers=headers)
    assert eval_resp.status_code == 200
    eval_data = eval_resp.json()
    assert eval_data["estimated_level"] in ["below_IL", "IL", "IM", "IH"]
    assert 1 <= eval_data["score_fluency"] <= 5
    assert len(eval_data["actionable_steps"]) == 3
    assert len(eval_data["feedback_items"]) >= 1

    # 11. Rewrite / Improve Answer
    rewrite_resp = client.post(f"/api/answers/{answer_id}/rewrite", json={
        "answer_version_id": edit_resp.json()["id"],
        "target_level": "IH"
    }, headers=headers)
    assert rewrite_resp.status_code == 200
    rewrite_data = rewrite_resp.json()
    assert rewrite_data["target_level"] == "IH"
    assert len(rewrite_data["diff_chunks"]) > 0

    # 12. Accept Rewrite
    accept_resp = client.post(f"/api/answers/{answer_id}/accept-rewrite", data={
        "improved_text": rewrite_data["improved_text"]
    }, headers=headers)
    assert accept_resp.status_code == 200
    assert accept_resp.json()["version_number"] == 3

    # 13. Model answers for Question 1
    models_resp = client.get(f"/api/questions/{q1_data['id']}/model-answers", headers=headers)
    assert models_resp.status_code == 200
    models_data = models_resp.json()
    assert len(models_data) == 3
    levels = {m["level"] for m in models_data}
    assert "IL" in levels and "IM" in levels and "IH" in levels

    # 14. Finish session & Generate Session Report
    finish_resp = client.post(f"/api/sessions/{session_id}/finish", headers=headers)
    assert finish_resp.status_code == 200

    report_resp = client.get(f"/api/sessions/{session_id}/report", headers=headers)
    assert report_resp.status_code == 200
    report_data = report_resp.json()
    assert "radar_scores" in report_data
    assert "study_plan" in report_data
    assert report_data["pdf_path"] is not None

    # 15. Check User History
    hist_resp = client.get("/api/history", headers=headers)
    assert hist_resp.status_code == 200
    assert len(hist_resp.json()) >= 1
