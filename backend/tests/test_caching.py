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


def test_cross_endpoint_cache_sharing(client):
    """Answers cached by /chat should be hit by /chat/stream, and vice-versa."""
    import json

    # 1. Ask via /chat (sync)
    p1 = "Cross-endpoint test 1: speed of sound"
    r1 = client.post("/chat", json={"session_id": "sess-sync-1", "message": p1})
    assert r1.status_code == 200
    assert r1.json()["metadata"]["resolution_source"] == "LIVE_INFERENCE"

    # 2. Ask identical question via /chat/stream (SSE) -> should HIT cache!
    with client.stream("POST", "/chat/stream", json={"session_id": "sess-stream-1", "message": p1}) as stream_res:
        assert stream_res.status_code == 200
        events = [line for line in stream_res.iter_lines() if line.startswith("data: ")]
        done_event = json.loads(events[-1][len("data: "):])
        assert done_event["type"] == "done"
        assert done_event["metadata"]["resolution_source"] == "LLM_CACHE"

    # 3. Ask a fresh question via /chat/stream
    p2 = "Cross-endpoint test 2: boiling point of water"
    with client.stream("POST", "/chat/stream", json={"session_id": "sess-stream-2", "message": p2}) as stream_res2:
        assert stream_res2.status_code == 200
        events2 = [line for line in stream_res2.iter_lines() if line.startswith("data: ")]
        done_event2 = json.loads(events2[-1][len("data: "):])
        assert done_event2["type"] == "done"
        assert done_event2["metadata"]["resolution_source"] == "LIVE_INFERENCE"

    # 4. Ask identical question via /chat (sync) -> should HIT cache!
    r2 = client.post("/chat", json={"session_id": "sess-sync-2", "message": p2})
    assert r2.status_code == 200
    assert r2.json()["metadata"]["resolution_source"] == "LLM_CACHE"


def test_cache_clear_actually_purges_cache(client):
    """Verify POST /cache/clear truly flushes the cache and subsequent requests trigger live inference."""
    prompt = "Unique prompt for purge cache test: 7728192"

    # Turn 1: Live inference
    r1 = client.post("/chat", json={"session_id": "sess-purge-1", "message": prompt})
    assert r1.status_code == 200
    assert r1.json()["metadata"]["resolution_source"] == "LIVE_INFERENCE"

    # Turn 2: Cache hit
    r2 = client.post("/chat", json={"session_id": "sess-purge-2", "message": prompt})
    assert r2.status_code == 200
    assert r2.json()["metadata"]["resolution_source"] == "LLM_CACHE"

    # Purge cache
    clr = client.post("/cache/clear")
    assert clr.status_code == 200
    assert clr.json()["status"] == "ok"

    # Turn 3: Must trigger LIVE_INFERENCE again since cache was flushed
    r3 = client.post("/chat", json={"session_id": "sess-purge-3", "message": prompt})
    assert r3.status_code == 200
    assert r3.json()["metadata"]["resolution_source"] == "LIVE_INFERENCE"


def test_cross_endpoint_cache_with_tuning_parameters(client):
    """Verify cache sharing works when temperature and max_tokens are sent by frontend."""
    import json
    import uuid

    uid = uuid.uuid4().hex[:8]
    prompt = f"Cross-endpoint with params: circumference of Earth {uid}"
    params = {"temperature": 0.7, "max_tokens": 2048}

    # 1. Sync call with parameters
    r1 = client.post("/chat", json={"session_id": f"sess-params-1-{uid}", "message": prompt, **params})
    assert r1.status_code == 200
    assert r1.json()["metadata"]["resolution_source"] == "LIVE_INFERENCE"

    # 2. Stream call with identical parameters -> should HIT cache!
    with client.stream("POST", "/chat/stream", json={"session_id": f"sess-params-2-{uid}", "message": prompt, **params}) as s_res:
        assert s_res.status_code == 200
        events = [line for line in s_res.iter_lines() if line.startswith("data: ")]
        done_event = json.loads(events[-1][len("data: "):])
        assert done_event["type"] == "done"
        assert done_event["metadata"]["resolution_source"] == "LLM_CACHE"
