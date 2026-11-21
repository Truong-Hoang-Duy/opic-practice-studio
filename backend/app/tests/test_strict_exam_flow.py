def _setup_session(client, email: str, strict: bool):
    reg = client.post("/api/auth/register", json={"email": email, "password": "Password123!", "full_name": "Strict Tester"})
    assert reg.status_code == 200
    headers = {"Authorization": f"Bearer {reg.json()['access_token']}"}

    session_id = client.post("/api/sessions", json={"mode": "practice"}, headers=headers).json()["id"]
    client.post(f"/api/sessions/{session_id}/survey", json={
        "occupation": "Working professional", "student_status": "Graduated", "living_situation": "Apartment alone",
        "leisure_activities": ["Going to cafes"], "hobbies": ["Cooking"], "sports": ["Jogging"], "travel": ["Domestic trips"]
    }, headers=headers)
    # Real flow: topics first, then self-assessment (with the strict toggle) generates the questions
    client.post(f"/api/sessions/{session_id}/topics", json={"topics": ["environment", "global_workplace", "communication_media"]}, headers=headers)
    assess = client.post(f"/api/sessions/{session_id}/self-assessment", json={"level": 4, "strict_mode": strict}, headers=headers)
    assert assess.status_code == 200
    return session_id, headers, assess.json()


def test_strict_mode_skips_are_final_and_report_lists_all_questions(client):
    session_id, headers, assess = _setup_session(client, "strict_on@example.com", strict=True)
    assert assess["mode"] == "exam"
    assert assess["total_questions"] == 15

    # Skip Q1 and Q2 without recording
    for order in (1, 2):
        assert client.post(f"/api/sessions/{session_id}/questions/{order}/skip", headers=headers).json()["skipped"] is True

    # "Exit and resume": no after_order -> continues at Q3, skipped questions never come back
    q3 = client.get(f"/api/sessions/{session_id}/next-question", headers=headers).json()
    assert q3["order_index"] == 3
    assert q3["category"] == "home" and q3["timing"]["time_limit_sec"] == 90

    ans = client.post("/api/answers", data={
        "question_id": q3["id"], "session_id": session_id, "duration_seconds": 70,
        "transcript_raw": "On weekdays I usually wake up at six, make coffee and cook breakfast for myself before work."
    }, headers=headers)
    assert ans.status_code == 200

    assert client.post(f"/api/sessions/{session_id}/finish", headers=headers).status_code == 200
    report = client.get(f"/api/sessions/{session_id}/report", headers=headers).json()

    rows = {r["question_num"]: r for r in report["per_question_summary"]}
    assert sorted(rows) == list(range(1, 16))
    assert rows[1]["status"] == "unscored"
    assert rows[2]["status"] == "skipped"
    assert rows[3]["status"] == "scored"  # evaluated at report time
    assert rows[3]["question_text"] and rows[3]["transcript"]
    assert rows[4]["status"] == "unanswered"


def test_practice_mode_skip_keeps_question_open(client):
    session_id, headers, assess = _setup_session(client, "strict_off@example.com", strict=False)
    assert assess["mode"] == "practice"

    assert client.post(f"/api/sessions/{session_id}/questions/2/skip", headers=headers).json()["skipped"] is False
    # Moving on from Q2 goes to Q3; Q2 stays unanswered and can be revisited
    nxt = client.get(f"/api/sessions/{session_id}/next-question?after_order=2", headers=headers).json()
    assert nxt["order_index"] == 3
    q2 = client.get(f"/api/sessions/{session_id}/questions/2", headers=headers)
    assert q2.status_code == 200
    assert q2.json()["existing_answer"] is None

    # Answer Q2 with a minimal first take, jump back to Q2: Q2 must return its existing_answer & versions
    q2_data = q2.json()
    ans1 = client.post("/api/answers", data={
        "question_id": q2_data["id"], "session_id": session_id, "duration_seconds": 5,
        "transcript_raw": "Yes."
    }, headers=headers)
    assert ans1.status_code == 200

    q2_revisited = client.get(f"/api/sessions/{session_id}/questions/2", headers=headers).json()
    assert q2_revisited["existing_answer"] is not None
    assert q2_revisited["existing_answer"]["id"] == ans1.json()["id"]
    assert len(q2_revisited["existing_answer"]["versions"]) == 1

    status = client.get(f"/api/sessions/{session_id}/status", headers=headers).json()
    assert status["answered_orders"] == [2]

    # Evaluate minimal first take -> below_IL
    ev1 = client.post(f"/api/answers/{ans1.json()['id']}/evaluate", headers=headers)
    assert ev1.status_code == 200
    assert ev1.json()["estimated_level"] == "below_IL"

    # Re-record Q2 with a full answer: replaces previous take cleanly (keeps only latest take) and requires fresh re-evaluation
    ans2 = client.post("/api/answers", data={
        "question_id": q2_data["id"], "session_id": session_id, "duration_seconds": 80,
        "transcript_raw": (
            "I live in a modern apartment on the eighth floor with a sunny balcony overlooking a quiet park. "
            "Usually I relax there every evening after work and cook dinner with my family. "
            "Last month our air conditioner broke down during a heat wave, so we stayed on the balcony and ordered cold drinks until the technician fixed it."
        ),
    }, headers=headers)
    assert ans2.status_code == 200
    q2_after_retry = client.get(f"/api/sessions/{session_id}/questions/2", headers=headers).json()
    assert len(q2_after_retry["existing_answer"]["versions"]) == 1
    assert q2_after_retry["existing_answer"]["versions"][0]["version_number"] == 1
    assert "balcony" in q2_after_retry["existing_answer"]["transcript_raw"]

    # Re-evaluating after re-record runs a brand-new evaluation (old below_IL evaluation was purged)
    ev2 = client.post(f"/api/answers/{ans2.json()['id']}/evaluate", headers=headers)
    assert ev2.status_code == 200
    assert ev2.json()["estimated_level"] != "below_IL"


def test_levels_1_and_2_are_no_longer_accepted(client):
    reg = client.post("/api/auth/register", json={"email": "levels@example.com", "password": "Password123!", "full_name": "L"})
    headers = {"Authorization": f"Bearer {reg.json()['access_token']}"}
    sid = client.post("/api/sessions", json={"mode": "practice"}, headers=headers).json()["id"]
    for level in (1, 2):
        assert client.post(f"/api/sessions/{sid}/self-assessment", json={"level": level}, headers=headers).status_code == 422
    assert client.post(f"/api/sessions/{sid}/self-assessment", json={"level": 3}, headers=headers).status_code == 200
