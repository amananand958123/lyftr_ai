def test_session_history_lifecycle(client):
    # 1. Unknown session returns 404
    resp_404 = client.get("/sessions/unknown-sess/messages")
    assert resp_404.status_code == 404
    assert resp_404.json() == {"detail": "session not found"}

    # 2. Multi-turn conversation in session
    sess_id = "sess-history-1"
    turn1 = client.post("/chat", json={
        "session_id": sess_id,
        "message": "My name is Alice."
    })
    assert turn1.status_code == 200

    turn2 = client.post("/chat", json={
        "session_id": sess_id,
        "message": "What is my name?"
    })
    assert turn2.status_code == 200

    # 3. Retrieve history
    hist_resp = client.get(f"/sessions/{sess_id}/messages")
    assert hist_resp.status_code == 200
    data = hist_resp.json()
    assert data["session_id"] == sess_id
    messages = data["messages"]
    assert len(messages) == 4  # user, assistant, user, assistant

    # Check chronological ordering
    assert messages[0]["role"] == "user"
    assert messages[0]["content"] == "My name is Alice."
    assert messages[1]["role"] == "assistant"
    assert messages[1]["metadata"]["resolution_source"] in ["LIVE_INFERENCE", "LLM_CACHE"]

    assert messages[2]["role"] == "user"
    assert messages[2]["content"] == "What is my name?"
    assert messages[3]["role"] == "assistant"
