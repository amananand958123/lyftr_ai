import json


def read_events(response):
    """Turns the 'data: {...}' lines of a Server-Sent Events response into a list of dicts."""
    return [json.loads(line[len("data: "):]) for line in response.text.splitlines() if line.startswith("data: ")]


def test_stream_sends_text_then_metadata_and_saves_turn(client):
    response = client.post("/chat/stream", json={"session_id": "sess-stream-1", "message": "Stream please"})
    assert response.status_code == 200
    assert response.headers["content-type"].startswith("text/event-stream")

    events = read_events(response)
    deltas = [e["text"] for e in events if e["type"] == "delta"]
    done = events[-1]
    assert len(deltas) > 1  # really arrived in pieces
    assert done["type"] == "done"
    assert done["metadata"]["resolution_source"] == "LIVE_INFERENCE"
    assert done["metadata"]["key_id"] == "key_1"
    assert done["metadata"]["input_tokens"] > 0 and done["metadata"]["output_tokens"] > 0

    history = client.get("/sessions/sess-stream-1/messages").json()["messages"]
    assert [m["role"] for m in history] == ["user", "assistant"]
    assert history[1]["content"] == "".join(deltas)


def test_stream_fails_over_to_second_key(client):
    response = client.post(
        "/chat/stream",
        headers={"X-Simulate-Failure": "key_1=429"},
        json={"session_id": "sess-stream-2", "message": "Failover while streaming"},
    )
    done = read_events(response)[-1]
    assert done["metadata"]["key_id"] == "key_2"
    assert done["metadata"]["fallback_attempts"] == 1


def test_stream_all_keys_fail_is_503_and_saves_nothing(client):
    response = client.post(
        "/chat/stream",
        headers={"X-Simulate-Failure": "*=429"},
        json={"session_id": "sess-stream-3", "message": "Everything is down"},
    )
    assert response.status_code == 503
    assert response.json() == {"detail": "all providers unavailable"}
    assert client.get("/sessions/sess-stream-3/messages").status_code == 404


def test_stream_validates_input(client):
    response = client.post("/chat/stream", json={"session_id": "sess-stream-4", "message": "   "})
    assert response.status_code == 422
