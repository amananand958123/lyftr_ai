#!/usr/bin/env python3
"""
Lyftr AI Adversarial Verification Harness
Executes all 10 evaluator test scenarios and outputs an evidence-backed scorecard.
"""

import sys
import os
import time

# Ensure backend directory is in sys.path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "backend"))

from fastapi.testclient import TestClient
from app.main import app
from app.config import settings

def run_adversarial_suite():
    print("=" * 70)
    print("LYFTR AI — 10-POINT ADVERSARIAL ACCEPTANCE AUDIT")
    print("=" * 70)

    client = TestClient(app)
    results = []
    run_id = int(time.time() * 1000)

    # TEST 1: Normal Live Inference
    try:
        s1 = f"audit-s1-{run_id}"
        prompt = f"What is the capital of France? ({run_id})"
        r1 = client.post("/chat", json={"session_id": s1, "message": prompt})
        assert r1.status_code == 200, f"Expected 200, got {r1.status_code}"
        d1 = r1.json()
        assert d1["metadata"]["resolution_source"] == "LIVE_INFERENCE", f"Expected LIVE_INFERENCE, got {d1['metadata']['resolution_source']}"
        assert d1["metadata"]["key_id"] == "key_1", f"Expected key_1, got {d1['metadata']['key_id']}"
        assert d1["metadata"]["fallback_attempts"] == 0
        assert d1["metadata"]["input_tokens"] > 0
        assert d1["metadata"]["output_tokens"] > 0
        results.append(("TEST 1: Normal live inference", "PASS", f"Reply received with key_1, {d1['metadata']['latency_ms']}ms"))
    except Exception as e:
        results.append(("TEST 1: Normal live inference", "FAIL", str(e)))

    # TEST 2: Response Cache Hit (Identical prompt in fresh session)
    try:
        s2 = f"audit-s2-{run_id}"
        r2 = client.post("/chat", json={"session_id": s2, "message": prompt})
        assert r2.status_code == 200, f"Expected 200, got {r2.status_code}"
        d2 = r2.json()
        assert d2["metadata"]["resolution_source"] == "LLM_CACHE", f"Expected LLM_CACHE, got {d2['metadata']['resolution_source']}"
        assert d2["metadata"]["key_id"] is None, f"Expected key_id None, got {d2['metadata']['key_id']}"
        assert d2["metadata"]["fallback_attempts"] == 0
        assert d2["reply"] == d1["reply"]
        results.append(("TEST 2: Response caching accuracy", "PASS", "Cache hit verified, key_id is null, identical reply"))
    except Exception as e:
        results.append(("TEST 2: Response caching accuracy", "FAIL", str(e)))

    # TEST 3: Different messages do not hit cache
    try:
        s3 = f"audit-s3-{run_id}"
        r3 = client.post("/chat", json={"session_id": s3, "message": f"What is the speed of sound in air? ({run_id})"})
        assert r3.status_code == 200
        d3 = r3.json()
        assert d3["metadata"]["resolution_source"] == "LIVE_INFERENCE"
        results.append(("TEST 3: Cache non-collision", "PASS", "Different message triggers live inference"))
    except Exception as e:
        results.append(("TEST 3: Cache non-collision", "FAIL", str(e)))

    # TEST 4: Multi-turn Conversation Memory
    try:
        sess_multi = f"audit-multi-{run_id}"
        client.post("/chat", json={"session_id": sess_multi, "message": "My lucky number is 42."})
        r4 = client.post("/chat", json={"session_id": sess_multi, "message": "What is my lucky number?"})
        assert r4.status_code == 200
        hist4 = client.get(f"/sessions/{sess_multi}/messages").json()
        assert len(hist4["messages"]) == 4, f"Expected 4 messages, got {len(hist4['messages'])}"
        results.append(("TEST 4: Multi-turn conversation state", "PASS", "4 messages recorded chronologically in SQLite"))
    except Exception as e:
        results.append(("TEST 4: Multi-turn conversation state", "FAIL", str(e)))

    # TEST 5: Session Isolation
    try:
        hist_other = client.get(f"/sessions/{s3}/messages").json()
        other_contents = [m["content"] for m in hist_other["messages"]]
        assert "My lucky number is 42." not in other_contents
        results.append(("TEST 5: Session isolation", "PASS", "Messages strictly isolated per session_id"))
    except Exception as e:
        results.append(("TEST 5: Session isolation", "FAIL", str(e)))

    # TEST 6: Failover Demonstration (key_1=429)
    try:
        s_fail = f"audit-fail-1-{run_id}"
        r6 = client.post(
            "/chat",
            headers={"X-Simulate-Failure": "key_1=429"},
            json={"session_id": s_fail, "message": "Demonstrate single key failover"}
        )
        assert r6.status_code == 200
        d6 = r6.json()
        assert d6["metadata"]["key_id"] == "key_2", f"Expected key_2, got {d6['metadata']['key_id']}"
        assert d6["metadata"]["fallback_attempts"] == 1
        results.append(("TEST 6: Key failover on 429", "PASS", "key_1 failed over to key_2 with fallback_attempts=1"))
    except Exception as e:
        results.append(("TEST 6: Key failover on 429", "FAIL", str(e)))

    # TEST 7: Multi-key Failure (key_1=429,key_2=500)
    try:
        s_multi_fail = f"audit-fail-multi-{run_id}"
        r7 = client.post(
            "/chat",
            headers={"X-Simulate-Failure": "key_1=429,key_2=500"},
            json={"session_id": s_multi_fail, "message": "Both fail"}
        )
        assert r7.status_code == 503
        assert r7.json() == {"detail": "all providers unavailable"}
        results.append(("TEST 7: Multiple provider failure", "PASS", "HTTP 503 returned when all keys fail"))
    except Exception as e:
        results.append(("TEST 7: Multiple provider failure", "FAIL", str(e)))

    # TEST 8: Total Provider Exhaustion (*=429) & No DB Insertion
    try:
        s_exhaust = f"audit-exhaust-{run_id}"
        r8 = client.post(
            "/chat",
            headers={"X-Simulate-Failure": "*=429"},
            json={"session_id": s_exhaust, "message": "Exhaust all"}
        )
        assert r8.status_code == 503
        h8 = client.get(f"/sessions/{s_exhaust}/messages")
        assert h8.status_code == 404
        results.append(("TEST 8: Exhaustion (*=429) & DB hygiene", "PASS", "Clean 503 returned and nothing written to SQLite"))
    except Exception as e:
        results.append(("TEST 8: Exhaustion (*=429) & DB hygiene", "FAIL", str(e)))

    # TEST 9: Strict Input Validation (422)
    try:
        r9_empty = client.post("/chat", json={"session_id": f"audit-v1-{run_id}", "message": ""})
        r9_space = client.post("/chat", json={"session_id": f"audit-v2-{run_id}", "message": "   "})
        r9_long = client.post("/chat", json={"session_id": f"audit-v3-{run_id}", "message": "a" * 4001})
        assert r9_empty.status_code == 422
        assert r9_space.status_code == 422
        assert r9_long.status_code == 422
        results.append(("TEST 9: Input validation (422)", "PASS", "Empty, whitespace, and 4001 chars rejected"))
    except Exception as e:
        results.append(("TEST 9: Input validation (422)", "FAIL", str(e)))

    # TEST 10: Health Endpoint & Database Connectivity
    try:
        r10 = client.get("/health")
        assert r10.status_code == 200
        d10 = r10.json()
        assert d10["status"] == "ok"
        assert d10["keys_configured"] >= 2
        assert d10["cache_enabled"] is True
        results.append(("TEST 10: Health & key pool status", "PASS", f"Status ok, {d10['keys_configured']} keys active, cache enabled"))
    except Exception as e:
        results.append(("TEST 10: Health & key pool status", "FAIL", str(e)))

    # Summary Display
    print("\n" + "-" * 70)
    print(f"{'TEST NAME':<45} | {'STATUS':<8} | {'EVIDENCE'}")
    print("-" * 70)
    passes = 0
    for name, status, evidence in results:
        if status == "PASS":
            passes += 1
            print(f"\033[92m{name:<45} | {status:<8}\033[0m | {evidence}")
        else:
            print(f"\033[91m{name:<45} | {status:<8}\033[0m | {evidence}")
    print("-" * 70)
    print(f"SCORE: {passes}/{len(results)} ACCEPTANCE SCENARIOS PASSED")
    print("=" * 70)

    if passes == len(results):
        print("ALL 10 EVALUATION CRITERIA COMPLIANT — 10/10 READY FOR SUBMISSION!")
        return 0
    else:
        print("SOME TESTS FAILED. PLEASE AUDIT.")
        return 1

if __name__ == "__main__":
    sys.exit(run_adversarial_suite())
