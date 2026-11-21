from app.config import settings

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

def test_failover_502_status(client):
    response = client.post(
        "/chat",
        headers={"X-Simulate-Failure": "key_1=502"},
        json={"session_id": "sess-fail-502", "message": "Testing failover 502"}
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

def test_multiple_keys_explicitly_failing(client):
    # key_1=429,key_2=500 means every configured key fails
    response = client.post(
        "/chat",
        headers={"X-Simulate-Failure": "key_1=429,key_2=500"},
        json={"session_id": "sess-fail-multi", "message": "Both fail"}
    )
    assert response.status_code == 503
    assert response.json() == {"detail": "all providers unavailable"}

    hist_resp = client.get("/sessions/sess-fail-multi/messages")
    assert hist_resp.status_code == 404

def test_simulation_disabled_switch(client):
    # When ENABLE_FAILURE_SIMULATION is False, X-Simulate-Failure is ignored
    settings.ENABLE_FAILURE_SIMULATION = False
    try:
        response = client.post(
            "/chat",
            headers={"X-Simulate-Failure": "key_1=429"},
            json={"session_id": "sess-sim-off", "message": "Simulation disabled"}
        )
        assert response.status_code == 200
        data = response.json()
        # Should answer with key_1 since simulation was ignored
        assert data["metadata"]["key_id"] == "key_1"
        assert data["metadata"]["fallback_attempts"] == 0
    finally:
        settings.ENABLE_FAILURE_SIMULATION = True


def test_non_retryable_provider_error_returns_400(client, monkeypatch):
    """Context window exceedance or non-retryable 400 from provider must return 400, not 503."""
    import litellm
    from app import gateway

    def mock_completion(*args, **kwargs):
        raise litellm.exceptions.ContextWindowExceededError(
            message="Context window exceeded: maximum context length is 8192 tokens",
            model="gemini/gemini-2.0-flash",
            llm_provider="gemini",
        )

    monkeypatch.setattr(litellm, "completion", mock_completion)

    response = client.post(
        "/chat",
        json={"session_id": "sess-context-err", "message": "Trigger context error"}
    )
    assert response.status_code == 400
    assert "Provider rejected request" in response.json()["detail"]
