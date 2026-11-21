import concurrent.futures

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

def test_chat_validation_exact_4000_chars(client):
    # Exactly 4000 chars should be accepted
    msg_4000 = "x" * 4000
    response = client.post("/chat", json={"session_id": "s-4000", "message": msg_4000})
    assert response.status_code == 200
    assert response.json()["session_id"] == "s-4000"

def test_chat_validation_empty_session_id(client):
    response = client.post("/chat", json={"session_id": "", "message": "Hello"})
    assert response.status_code == 422
    assert "detail" in response.json()

def test_chat_unicode_and_emojis(client):
    response = client.post("/chat", json={
        "session_id": "s-unicode",
        "message": "Hello world 🌍🚀 Special symbols: α β γ ñ"
    })
    assert response.status_code == 200
    data = response.json()
    assert len(data["reply"]) > 0

def test_chat_custom_system_prompt(client):
    response = client.post("/chat", json={
        "session_id": "s-sys-prompt",
        "message": "Who are you?",
        "system_prompt": "You are a specialized mathematical physics assistant."
    })
    assert response.status_code == 200
    data = response.json()
    assert data["session_id"] == "s-sys-prompt"

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

def test_chat_concurrent_requests(client):
    # Verify SQLite WAL handles multiple concurrent requests cleanly
    def send_req(i):
        return client.post("/chat", json={
            "session_id": f"s-concurrent-{i}",
            "message": f"Concurrent message {i}"
        })

    with concurrent.futures.ThreadPoolExecutor(max_workers=5) as executor:
        futures = [executor.submit(send_req, i) for i in range(5)]
        results = [f.result() for f in futures]

    for res in results:
        assert res.status_code == 200
        assert len(res.json()["reply"]) > 0
