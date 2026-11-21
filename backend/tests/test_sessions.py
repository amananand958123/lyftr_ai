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


def test_regenerate_no_duplicate_history(client):
    sess_id = "sess-regen-test"

    # Turn 1: initial message
    resp1 = client.post("/chat", json={
        "session_id": sess_id,
        "message": "What is 2+2?"
    })
    assert resp1.status_code == 200

    hist1 = client.get(f"/sessions/{sess_id}/messages").json()
    assert len(hist1["messages"]) == 2
    assert hist1["messages"][0]["role"] == "user"
    assert hist1["messages"][0]["content"] == "What is 2+2?"
    assert hist1["messages"][1]["role"] == "assistant"

    # Regenerate Turn 1 (via JSON body regenerate: true)
    resp_regen = client.post("/chat", json={
        "session_id": sess_id,
        "message": "What is 2+2?",
        "regenerate": True
    })
    assert resp_regen.status_code == 200
    # A regenerate must ask the model again, not replay the cached answer.
    assert resp_regen.json()["metadata"]["resolution_source"] == "LIVE_INFERENCE"

    hist2 = client.get(f"/sessions/{sess_id}/messages").json()
    assert len(hist2["messages"]) == 2, f"Expected 2 messages, got {len(hist2['messages'])} (duplicate history bug!)"
    assert hist2["messages"][0]["role"] == "user"
    assert hist2["messages"][0]["content"] == "What is 2+2?"
    assert hist2["messages"][1]["role"] == "assistant"

    # Regenerate again
    resp_regen2 = client.post(
        "/chat",
        json={"session_id": sess_id, "message": "What is 2+2?", "regenerate": True}
    )
    assert resp_regen2.status_code == 200

    hist3 = client.get(f"/sessions/{sess_id}/messages").json()
    assert len(hist3["messages"]) == 2, f"Expected 2 messages, got {len(hist3['messages'])}"

    # Turn 2: new question
    resp2 = client.post("/chat", json={
        "session_id": sess_id,
        "message": "What is 3+3?"
    })
    assert resp2.status_code == 200

    hist4 = client.get(f"/sessions/{sess_id}/messages").json()
    assert len(hist4["messages"]) == 4

    # Regenerate Turn 2
    resp_regen3 = client.post("/chat", json={
        "session_id": sess_id,
        "message": "What is 3+3?",
        "regenerate": True
    })
    assert resp_regen3.status_code == 200

    hist5 = client.get(f"/sessions/{sess_id}/messages").json()
    assert len(hist5["messages"]) == 4, f"Expected 4 messages, got {len(hist5['messages'])}"
    assert hist5["messages"][2]["content"] == "What is 3+3?"
    assert hist5["messages"][3]["role"] == "assistant"
