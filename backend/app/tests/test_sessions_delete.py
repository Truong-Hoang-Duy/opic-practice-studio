import pytest

def test_delete_session(client):
    # 1. Register candidate
    reg_resp = client.post("/api/auth/register", json={
        "email": "delete_test@example.com",
        "password": "Password123!",
        "full_name": "Test Delete"
    })
    assert reg_resp.status_code == 200
    token = reg_resp.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # 2. Create Session
    s_resp = client.post("/api/sessions", json={"mode": "practice"}, headers=headers)
    assert s_resp.status_code == 200
    session_id = s_resp.json()["id"]

    # 3. Verify session exists in status
    status_resp = client.get(f"/api/sessions/{session_id}/status", headers=headers)
    assert status_resp.status_code == 200

    # 4. Delete session
    del_resp = client.delete(f"/api/sessions/{session_id}", headers=headers)
    assert del_resp.status_code == 200
    assert del_resp.json()["session_id"] == session_id

    # 5. Verify session no longer exists (404)
    status_after = client.get(f"/api/sessions/{session_id}/status", headers=headers)
    assert status_after.status_code == 404

    # 6. Deleting non-existent session returns 404
    del_again = client.delete(f"/api/sessions/{session_id}", headers=headers)
    assert del_again.status_code == 404


def test_session_ids_and_numbers_reset_after_deletion(client):
    reg = client.post("/api/auth/register", json={
        "email": "renumber@example.com",
        "password": "Password123!",
        "full_name": "Renumber User"
    })
    headers = {"Authorization": f"Bearer {reg.json()['access_token']}"}

    # Create 3 sessions -> 1, 2, 3
    created = [client.post("/api/sessions", json={"mode": "practice"}, headers=headers).json() for _ in range(3)]
    assert [s["id"] for s in created] == [1, 2, 3]
    assert [s["session_number"] for s in created] == [1, 2, 3]

    # Delete all 3 sessions
    for s in created:
        assert client.delete(f"/api/sessions/{s['id']}", headers=headers).status_code == 200

    # Creating new sessions restarts from 1, 2 instead of jumping to 4, 5
    new_sessions = [client.post("/api/sessions", json={"mode": "practice"}, headers=headers).json() for _ in range(2)]
    assert [s["id"] for s in new_sessions] == [1, 2]
    assert [s["session_number"] for s in new_sessions] == [1, 2]

    # Deleting session #1 renumbers the remaining session to #1 in history
    assert client.delete(f"/api/sessions/{new_sessions[0]['id']}", headers=headers).status_code == 200
    history = client.get("/api/history", headers=headers).json()
    assert len(history) == 1
    assert history[0]["session_number"] == 1

    # Deleting all sessions wipes remaining sets while keeping user login intact, and next session is #1
    del_all = client.delete("/api/sessions", headers=headers)
    assert del_all.status_code == 200
    assert del_all.json()["deleted_count"] == 1
    assert client.get("/api/history", headers=headers).json() == []
    assert client.get("/api/auth/me", headers=headers).status_code == 200
    fresh = client.post("/api/sessions", json={"mode": "practice"}, headers=headers).json()
    assert fresh["id"] == 1 and fresh["session_number"] == 1
