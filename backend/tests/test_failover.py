def test_failover_single_key(client):
    response = client.post(
        "/chat",
        headers={"X-Simulate-Failure": "key_1=429"},
        json={"session_id": "sess-fail-1", "message": "Testing failover key 1"}
    )
    assert response.status_code == 200
    data = response.json()
    assert data["metadata"]["key_id"] == "key_2"
    assert data["metadata"]["fallback_attempts"] == 1

def test_failover_500_status(client):
    response = client.post(
        "/chat",
        headers={"X-Simulate-Failure": "key_1=500"},
        json={"session_id": "sess-fail-2", "message": "Testing failover 500"}
    )
    assert response.status_code == 200
    data = response.json()
    assert data["metadata"]["key_id"] == "key_2"
    assert data["metadata"]["fallback_attempts"] == 1

def test_all_providers_fail(client):
    response = client.post(
        "/chat",
        headers={"X-Simulate-Failure": "*=429"},
        json={"session_id": "sess-fail-all", "message": "Should fail completely"}
    )
    assert response.status_code == 503
    assert response.json() == {"detail": "all providers unavailable"}

    # Crucial rule: Check that nothing was added to history after 503
    hist_resp = client.get("/sessions/sess-fail-all/messages")
    assert hist_resp.status_code == 404
