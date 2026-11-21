def test_caching_behavior(client):
    # Unique message to avoid collision with previous test runs
    prompt = "Unique prompt for caching test: 981249812"

    # Turn 1: Fresh session A -> LIVE_INFERENCE
    resp1 = client.post("/chat", json={"session_id": "sess-cache-A", "message": prompt})
    assert resp1.status_code == 200
    data1 = resp1.json()
    assert data1["metadata"]["resolution_source"] == "LIVE_INFERENCE"
    assert data1["metadata"]["key_id"] == "key_1"
    assert data1["metadata"]["fallback_attempts"] == 0

    # Turn 2: Fresh session B with identical prompt -> LLM_CACHE
    resp2 = client.post("/chat", json={"session_id": "sess-cache-B", "message": prompt})
    assert resp2.status_code == 200
    data2 = resp2.json()
    assert data2["metadata"]["resolution_source"] == "LLM_CACHE"
    assert data2["metadata"]["key_id"] is None
    assert data2["metadata"]["fallback_attempts"] == 0
    assert data2["reply"] == data1["reply"]

    # Turn 3: Fresh session C with different prompt -> LIVE_INFERENCE
    resp3 = client.post("/chat", json={"session_id": "sess-cache-C", "message": "Completely different query"})
    assert resp3.status_code == 200
    data3 = resp3.json()
    assert data3["metadata"]["resolution_source"] == "LIVE_INFERENCE"
