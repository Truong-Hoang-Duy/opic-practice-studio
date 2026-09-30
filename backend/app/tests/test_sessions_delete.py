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
