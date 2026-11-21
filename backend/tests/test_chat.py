def test_chat_validation_empty_message(client):
    response = client.post("/chat", json={"session_id": "s-1", "message": ""})
    assert response.status_code == 422
    assert "detail" in response.json()

def test_chat_validation_whitespace_message(client):
    response = client.post("/chat", json={"session_id": "s-1", "message": "   "})
    assert response.status_code == 422
    assert "detail" in response.json()

def test_chat_validation_message_too_long(client):
    long_msg = "a" * 4001
    response = client.post("/chat", json={"session_id": "s-1", "message": long_msg})
    assert response.status_code == 422
    assert "detail" in response.json()

def test_chat_validation_empty_session_id(client):
    response = client.post("/chat", json={"session_id": "", "message": "Hello"})
    assert response.status_code == 422
    assert "detail" in response.json()

def test_chat_successful_inference(client):
    response = client.post("/chat", json={
        "session_id": "s-valid-1",
        "message": "What is the capital of France?"
    })
    assert response.status_code == 200
    data = response.json()
    assert data["session_id"] == "s-valid-1"
    assert len(data["reply"]) > 0

    meta = data["metadata"]
    assert meta["resolution_source"] in ["LIVE_INFERENCE", "LLM_CACHE"]
    assert meta["model"] == "gemini/gemini-2.0-flash"
    assert meta["latency_ms"] >= 1
    assert meta["input_tokens"] > 0
    assert meta["output_tokens"] > 0
    assert meta["key_id"] == "key_1"
    assert meta["fallback_attempts"] == 0
