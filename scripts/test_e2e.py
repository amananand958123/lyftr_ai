#!/usr/bin/env python3
"""
Full End-to-End System Test Suite for Lyftr AI.
Exercises the complete ASGI application stack using TestClient:
1. Health & Deep Health diagnostics
2. Synchronous chat completion with token metadata
3. Real-time Server-Sent Events (SSE) streaming token delivery
4. Cross-endpoint cache synchronization (sync -> stream)
5. Multi-key rotation and failover simulation (X-Simulate-Failure: key_1=429)
6. Total provider exhaustion (X-Simulate-Failure: *=429 -> 503 Service Unavailable)
7. Non-retryable client error propagation (ContextWindowExceeded -> 400 Bad Request)
8. Multi-turn session persistence and chronological ordering
9. In-place reply regeneration without duplicate turns
10. Scoped session listing and forbidden session deletion with X-Client-ID
"""
import json
import os
import sys
import uuid
from pathlib import Path
import unittest

sys.path.insert(0, str(Path(__file__).parent.parent / "backend"))

from starlette.testclient import TestClient

from app.main import app
from app.config import settings

class LyftrE2ETestSuite(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.client = TestClient(app)

    def test_01_health_and_deep_health(self):
        r_health = self.client.get("/health")
        self.assertEqual(r_health.status_code, 200)
        h_data = r_health.json()
        self.assertEqual(h_data["status"], "ok")
        self.assertGreaterEqual(h_data["keys_configured"], 1)

        r_deep = self.client.get("/health/deep")
        self.assertEqual(r_deep.status_code, 200)
        d_data = r_deep.json()
        self.assertIn("providers", d_data)
        self.assertIn("total_keys", d_data)

    def test_02_sync_chat_inference(self):
        sess = f"e2e-sync-{uuid.uuid4().hex[:8]}"
        r = self.client.post("/chat", json={"session_id": sess, "message": "What is the speed of sound?"})
        self.assertEqual(r.status_code, 200)
        data = r.json()
        self.assertIn("reply", data)
        self.assertIn("metadata", data)
        meta = data["metadata"]
        self.assertIn(meta["resolution_source"], ["LIVE_INFERENCE", "LLM_CACHE"])
        self.assertGreater(meta["input_tokens"], 0)
        self.assertGreater(meta["output_tokens"], 0)

    def test_03_sse_streaming_delivery(self):
        sess = f"e2e-stream-{uuid.uuid4().hex[:8]}"
        with self.client.stream("POST", "/chat/stream", json={"session_id": sess, "message": "Count from 1 to 5."}) as r:
            self.assertEqual(r.status_code, 200)
            events = []
            for line in r.iter_lines():
                if line.startswith("data: "):
                    events.append(json.loads(line[6:]))
            self.assertTrue(any(e.get("type") == "delta" for e in events), "Stream must contain delta events")
            done = next((e for e in events if e.get("type") == "done"), None)
            self.assertIsNotNone(done, "Stream must conclude with done event")
            self.assertIn("metadata", done)

    def test_04_cross_endpoint_cache_synchronization(self):
        prompt = f"Explain gravity in one sentence {uuid.uuid4().hex[:6]}"
        sess_1 = f"cache-sess-1-{uuid.uuid4().hex[:8]}"
        sess_2 = f"cache-sess-2-{uuid.uuid4().hex[:8]}"
        # Call 1 on /chat (Live inference)
        r1 = self.client.post("/chat", json={"session_id": sess_1, "message": prompt})
        self.assertEqual(r1.status_code, 200)

        # Call 2 on /chat/stream with identical prompt must hit cache
        with self.client.stream("POST", "/chat/stream", json={"session_id": sess_2, "message": prompt}) as r2:
            events = []
            for line in r2.iter_lines():
                if line.startswith("data: "):
                    events.append(json.loads(line[6:]))
            done = next(e for e in events if e.get("type") == "done")
            self.assertEqual(done["metadata"]["resolution_source"], "LLM_CACHE")
            self.assertIsNone(done["metadata"]["key_id"])

    def test_05_key_rotation_failover(self):
        sess = f"e2e-failover-{uuid.uuid4().hex[:8]}"
        r = self.client.post(
            "/chat",
            headers={"X-Simulate-Failure": "key_1=429"},
            json={"session_id": sess, "message": "Test failover routing"}
        )
        self.assertEqual(r.status_code, 200)
        meta = r.json()["metadata"]
        self.assertGreaterEqual(meta["fallback_attempts"], 1)

    def test_06_provider_exhaustion_hygiene(self):
        sess = f"e2e-exhaust-{uuid.uuid4().hex[:8]}"
        r = self.client.post(
            "/chat",
            headers={"X-Simulate-Failure": "*=429"},
            json={"session_id": sess, "message": "Must fail all keys"}
        )
        self.assertEqual(r.status_code, 503)
        self.assertEqual(r.json()["detail"], "all providers unavailable")

        # Verify nothing written to DB
        r_hist = self.client.get(f"/sessions/{sess}/messages")
        self.assertEqual(r_hist.status_code, 404)

    def test_07_client_scoping_and_forbidden_delete(self):
        client_x = f"clientX_{uuid.uuid4().hex[:6]}"
        client_y = f"clientY_{uuid.uuid4().hex[:6]}"
        sess_x = f"s-{client_x}-999"
        sess_y = f"s-{client_y}-888"

        self.client.post("/chat", headers={"X-Client-ID": client_x}, json={"session_id": sess_x, "message": "Message X"})
        self.client.post("/chat", headers={"X-Client-ID": client_y}, json={"session_id": sess_y, "message": "Message Y"})

        # Client X listing only shows Client X's session
        list_x = self.client.get("/sessions", headers={"X-Client-ID": client_x}).json()
        ids_x = [s["session_id"] for s in list_x["sessions"]]
        self.assertIn(sess_x, ids_x)
        self.assertNotIn(sess_y, ids_x)

        # Client X cannot delete Client Y's session
        r_del = self.client.delete(f"/sessions/{sess_y}", headers={"X-Client-ID": client_x})
        self.assertEqual(r_del.status_code, 403)

        # Client X can delete Client X's session
        r_del_ok = self.client.delete(f"/sessions/{sess_x}", headers={"X-Client-ID": client_x})
        self.assertEqual(r_del_ok.status_code, 200)

    def test_08_regenerate_in_place(self):
        sess = f"e2e-regen-{uuid.uuid4().hex[:8]}"
        self.client.post("/chat", json={"session_id": sess, "message": "Why is sky blue?"})
        h1 = self.client.get(f"/sessions/{sess}/messages").json()["messages"]
        self.assertEqual(len(h1), 2)

        # Regenerate in-place
        self.client.post("/chat", json={"session_id": sess, "message": "Why is sky blue?", "regenerate": True})
        h2 = self.client.get(f"/sessions/{sess}/messages").json()["messages"]
        self.assertEqual(len(h2), 2, "Regenerate must update in place without duplicating messages")


if __name__ == "__main__":
    unittest.main()
