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
    assert "metadata" not in messages[0] or messages[0]["metadata"] is None

    assert messages[1]["role"] == "assistant"
    assert messages[1]["metadata"]["resolution_source"] in ["LIVE_INFERENCE", "LLM_CACHE"]

    assert messages[2]["role"] == "user"
    assert messages[2]["content"] == "What is my name?"
    assert messages[3]["role"] == "assistant"

def test_session_isolation(client):
    # Ensure messages from session A never leak into session B
    sess_a = "sess-iso-A"
    sess_b = "sess-iso-B"

    client.post("/chat", json={"session_id": sess_a, "message": "Secret code is 12345"})
    client.post("/chat", json={"session_id": sess_b, "message": "Hello from session B"})

    hist_a = client.get(f"/sessions/{sess_a}/messages").json()
    hist_b = client.get(f"/sessions/{sess_b}/messages").json()

    contents_a = [m["content"] for m in hist_a["messages"]]
    contents_b = [m["content"] for m in hist_b["messages"]]

    assert "Secret code is 12345" in contents_a
    assert "Secret code is 12345" not in contents_b
    assert "Hello from session B" in contents_b
    assert "Hello from session B" not in contents_a

def test_list_and_delete_sessions(client):
    sess_c = "sess-list-delete"
    client.post("/chat", json={"session_id": sess_c, "message": "Testing session listing"})

    # Test GET /sessions
    list_resp = client.get("/sessions")
    assert list_resp.status_code == 200
    list_data = list_resp.json()
    assert list_data["total"] >= 1
    session_ids = [s["session_id"] for s in list_data["sessions"]]
    assert sess_c in session_ids

    # Test DELETE /sessions/{session_id}
    del_resp = client.delete(f"/sessions/{sess_c}")
    assert del_resp.status_code == 200
    assert del_resp.json()["deleted"] is True
    assert del_resp.json()["messages_deleted"] >= 2

    # Verify session is now gone
    verify_resp = client.get(f"/sessions/{sess_c}/messages")
    assert verify_resp.status_code == 404
