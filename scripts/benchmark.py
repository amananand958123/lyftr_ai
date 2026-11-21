#!/usr/bin/env python3
"""
Lyftr AI — Gateway Performance & Concurrency Benchmark
Measures RPS, P50/P90/P99 latency, and cache acceleration factor.
"""

import argparse
import asyncio
import time
import statistics
import sys
import httpx

async def send_chat_request(client: httpx.AsyncClient, base_url: str, session_id: str, message: str) -> dict:
    start = time.perf_counter()
    resp = await client.post(
        f"{base_url}/chat",
        json={"session_id": session_id, "message": message},
        timeout=30.0
    )
    elapsed = (time.perf_counter() - start) * 1000
    return {
        "status": resp.status_code,
        "elapsed_ms": elapsed,
        "data": resp.json() if resp.status_code == 200 else None
    }

async def run_benchmark(base_url: str, concurrency: int, total_requests: int):
    print("=" * 65)
    print(f"LYFTR AI GATEWAY BENCHMARK")
    print(f"Target: {base_url} | Concurrency: {concurrency} | Total: {total_requests}")
    print("=" * 65)

    async with httpx.AsyncClient() as client:
        # Phase 1: Cache Acceleration Test
        print("\n[Phase 1] Cache Acceleration Factor Test...")
        test_session = f"bench-cache-{int(time.time())}"
        test_msg = "What is the speed of light in vacuum?"

        # Cold request (Live inference)
        res_cold = await send_chat_request(client, base_url, test_session, test_msg)
        cold_time = res_cold["elapsed_ms"]
        cold_source = res_cold["data"]["metadata"]["resolution_source"] if res_cold["data"] else "ERR"

        # Warm request (Cache hit)
        res_warm = await send_chat_request(client, base_url, test_session, test_msg)
        warm_time = res_warm["elapsed_ms"]
        warm_source = res_warm["data"]["metadata"]["resolution_source"] if res_warm["data"] else "ERR"

        speedup = cold_time / warm_time if warm_time > 0 else 1.0
        print(f"  Cold call (Live): {cold_time:.1f}ms (Source: {cold_source})")
        print(f"  Warm call (Cached): {warm_time:.1f}ms (Source: {warm_source})")
        print(f"  Speedup Factor: {speedup:.1f}x acceleration")

        # Phase 2: Concurrent Load Test
        print(f"\n[Phase 2] Concurrent Load Test ({total_requests} requests, pool size {concurrency})...")
        sem = asyncio.Semaphore(concurrency)

        async def worker(idx: int):
            async with sem:
                s_id = f"bench-load-{idx % 4}-{int(time.time())}"
                msg = f"Benchmark message query #{idx}"
                return await send_chat_request(client, base_url, s_id, msg)

        overall_start = time.perf_counter()
        tasks = [worker(i) for i in range(total_requests)]
        results = await asyncio.gather(*tasks)
        overall_duration = time.perf_counter() - overall_start

        successful = [r for r in results if r["status"] == 200]
        latencies = [r["elapsed_ms"] for r in successful]

        if not latencies:
            print("\nError: All benchmark requests failed.")
            sys.exit(1)

        latencies.sort()
        p50 = statistics.median(latencies)
        p90 = latencies[int(len(latencies) * 0.90)]
        p95 = latencies[int(len(latencies) * 0.95)]
        p99 = latencies[int(len(latencies) * 0.99)]
        rps = len(successful) / overall_duration

        print("\n" + "-" * 65)
        print(f"BENCHMARK RESULTS SUMMARY")
        print("-" * 65)
        print(f"Total Requests Sent:    {total_requests}")
        print(f"Successful (HTTP 200):  {len(successful)} ({len(successful)/total_requests*100:.1f}%)")
        print(f"Total Duration:         {overall_duration:.2f}s")
        print(f"Throughput (RPS):       {rps:.2f} requests/sec")
        print("-" * 65)
        print(f"Latency P50 (Median):   {p50:.1f} ms")
        print(f"Latency P90:            {p90:.1f} ms")
        print(f"Latency P95:            {p95:.1f} ms")
        print(f"Latency P99:            {p99:.1f} ms")
        print(f"Min / Max:              {min(latencies):.1f} ms / {max(latencies):.1f} ms")
        print("=" * 65)

def main():
    parser = argparse.ArgumentParser(description="Lyftr AI Benchmark")
    parser.add_argument("--url", default="http://localhost:8000", help="Base URL of gateway")
    parser.add_argument("--concurrency", type=int, default=4, help="Concurrency limit")
    parser.add_argument("--requests", type=int, default=12, help="Total requests to send")
    args = parser.parse_args()

    asyncio.run(run_benchmark(args.url, args.concurrency, args.requests))

if __name__ == "__main__":
    main()
