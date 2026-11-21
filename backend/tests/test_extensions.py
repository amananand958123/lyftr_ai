def test_cache_stats_and_clear(client):
    stats = client.get("/cache/stats")
    assert stats.status_code == 200
    data = stats.json()
    assert "cache_enabled" in data
    assert "supported_models" in data

    clear = client.post("/cache/clear")
    assert clear.status_code == 200
    assert clear.json()["status"] == "ok"

def test_deep_health(client):
    deep = client.get("/health/deep")
    assert deep.status_code == 200
    data = deep.json()
    assert data["status"] in ["ok", "degraded"]
    assert data["total_keys"] >= 1
    assert "providers" in data

def test_security_headers_and_request_id(client):
    # Request without X-Request-ID should have one generated
    resp = client.get("/health")
    assert resp.status_code == 200
    assert "X-Request-ID" in resp.headers
    assert "X-Content-Type-Options" in resp.headers
    assert resp.headers["X-Content-Type-Options"] == "nosniff"
    assert "X-Frame-Options" in resp.headers
    assert resp.headers["X-Frame-Options"] == "DENY"

    # Request with custom X-Request-ID should propagate it
    custom_id = "test-custom-req-id-1234"
    resp_custom = client.get("/health", headers={"X-Request-ID": custom_id})
    assert resp_custom.headers.get("X-Request-ID") == custom_id

def test_chat_with_temperature_and_max_tokens(client):
    resp = client.post("/chat", json={
        "session_id": "test-tuning-params",
        "message": "Deterministic prompt",
        "temperature": 0.0,
        "max_tokens": 150
    })
    assert resp.status_code == 200
    data = resp.json()
    assert data["reply"]
    assert data["metadata"]["output_tokens"] > 0
