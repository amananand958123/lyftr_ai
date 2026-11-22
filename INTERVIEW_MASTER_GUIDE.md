# Lyftr AI — Complete Project & Technical Interview Master Guide

> **Target Audience:** Anyone preparing to explain, defend, or interview on the architecture, code, design tradeoffs, and operational mechanics of the **Lyftr AI Resilient LLM Chatbot**.
>
> This document starts from absolute first principles and builds up to low-level implementation details, covering every architectural choice, failure mode, war story, and tricky interview question.

---

## Table of Contents
1. [Executive Summary & High-Level Purpose](#1-executive-summary--high-level-purpose)
2. [Full System Architecture](#2-full-system-architecture)
3. [The End-to-End Request Lifecycle](#3-the-end-to-end-request-lifecycle)
4. [Deep Dive: Core Architectural Pillars](#4-deep-dive-core-architectural-pillars)
   - [4.1 Multi-Key Failover Engine](#41-multi-key-failover-engine)
   - [4.2 Response Caching & Multi-Turn Cache Invalidation](#42-response-caching--multi-turn-cache-invalidation)
   - [4.3 SQLite Storage, WAL Mode & Concurrency](#43-sqlite-storage-wal-mode--concurrency)
   - [4.4 Real-Time Streaming & Preflight Chunking](#44-real-time-streaming--preflight-chunking)
   - [4.5 In-Place Turn Regeneration](#45-in-place-turn-regeneration)
   - [4.6 Security, Rate Limiting & Proxy Headers](#46-security-rate-limiting--proxy-headers)
5. [Frontend Architecture & State Management](#5-frontend-architecture--state-management)
6. [Real-World War Stories: Bugs We Found & Fixed](#6-real-world-war-stories-bugs-we-found--fixed)
7. [Comprehensive Interview Q&A (20 Toughest Questions)](#7-comprehensive-interview-qa-20-toughest-questions)
8. [Summary Cheat Sheet for Fast Revision](#8-summary-cheat-sheet-for-fast-revision)

---

## 1. Executive Summary & High-Level Purpose

### What is Lyftr AI?
Lyftr AI is a production-grade, resilient conversational AI system designed to solve the single largest operational headache in LLM application engineering: **upstream provider fragility**.

### The Core Problem
LLM APIs (OpenAI, Anthropic, Google Gemini, Groq, etc.) fail constantly in production due to:
1. **HTTP 429 (Rate Limits & Quota Exhaustion):** Free and tier-1 tiers have strict requests-per-minute (RPM) and tokens-per-minute (TPM) limits.
2. **HTTP 5xx (Upstream Outages):** Transient gateway timeouts, overloaded servers, or regional infrastructure drops.
3. **High Latency & Costs:** Re-computing identical queries wastes money and subjects users to 1–5 second model response latencies.
4. **Data Loss on Restart:** Ephemeral container filesystems wipe conversation history when instances spin down or redeploy.

### The Lyftr AI Solution
A unified, resilient full-stack application that provides:
- **Automatic Multi-Key Failover:** Transparently rotates through prioritized provider keys (`key_1` $\rightarrow$ `key_2` $\rightarrow$ `key_3`) when rate limits or server errors occur.
- **Sub-Millisecond Response Caching:** Built on LiteLLM's local memory cache to deliver 1–10ms instant replies for repeated queries with zero provider cost.
- **ACID SQLite Persistence:** Configured with Write-Ahead Logging (WAL) and mounted to persistent Docker volumes, ensuring complete data durability without the overhead of external database servers.
- **Real-Time SSE Streaming:** Low-latency token streaming with preflight failover detection.
- **Deterministic Test Hooks:** The `X-Simulate-Failure` header enables automated testing of failover states without burning live provider quotas.

---

## 2. Full System Architecture

```
┌────────────────────────────────────────────────────────────────────────┐
│                   React 18 + TypeScript + Vite UI                      │
│  - Session Management (Auto-generated UUIDs, Drawer history, Delete)   │
│  - Real-time SSE Stream Consumer (ReadableStream delta chunk decoder)   │
│  - Telemetry HUD (Source, Model, Latency, Token metrics, Key ID)       │
│  - Failure Simulation Dropdown (Normal, key_1=429, key_1=500, *=429)   │
│  - In-place Regeneration & System Prompt Tuning Panel                  │
│  - Strict data-testid Compliance & Dark/Light Theme Support            │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ HTTP / Server-Sent Events (SSE)
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                      FastAPI Application Backend                       │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │                     ASGI Middleware Stack                        │  │
│  │  1. RequestContextMiddleware: UUID Request-ID & Security Headers │  │
│  │  2. RateLimitMiddleware: 120 reqs/min per IP with X-Forwarded-For│  │
│  │  3. CORSMiddleware: Strict Whitelist (Vercel, Localhost)         │  │
│  └──────────────────────────────────┬───────────────────────────────┘  │
│                                     ▼                                  │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │                        API Routes Layer                          │  │
│  │  - GET /health             : Health check & configuration status │  │
│  │  - POST /chat              : Synchronous completion endpoint     │  │
│  │  - POST /chat/stream       : SSE real-time streaming endpoint   │  │
│  │  - GET /sessions           : List user session summaries         │  │
│  │  - GET /sessions/{id}/msgs : Chronological history retrieval     │  │
│  │  - POST /cache/clear       : In-memory cache purge               │  │
│  │  - GET /cache/debug        : Diagnostic error tracking           │  │
│  └──────────────────────────────────┬───────────────────────────────┘  │
│                                     ▼                                  │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │                      Chat Service & History                      │  │
│  │  - Sliding context window (Latest 20 messages)                   │  │
│  │  - Context assembly: [System Prompt, ...History, Current Message]│  │
│  │  - In-place redo turn pruning (omits stale last turn)            │  │
│  └───────────────────┬──────────────────────────────┬───────────────┘  │
│                      │                              │                  │
│                      ▼                              ▼                  │
│  ┌─────────────────────────────────────┐  ┌─────────────────────────┐  │
│  │       LiteLLM Gateway Engine        │  │     SQLAlchemy / SQLite │  │
│  │  - Local Memory Cache (10-min TTL)  │  │  - Path: /data/app.db   │  │
│  │  - Failover Key Pool Iterator       │  │  - PRAGMA journal=WAL   │  │
│  │  - Preflight First-Chunk Streaming  │  │  - PRAGMA synch=NORMAL  │  │
│  │  - Cross-Endpoint Cache Key Sync    │  │  - Never saves 4xx/5xx  │  │
│  └──────┬───────────────────────┬──────┘  └─────────────────────────┘  │
└─────────┼───────────────────────┼──────────────────────────────────────┘
          │                       │
          ▼                       ▼
   Primary Provider        Fallback Provider       Backup Provider
     (Groq 20B)           (Gemini 2.5 Flash)         (Groq 120B)
     [Key Pool: 1]           [Key Pool: 2]          [Key Pool: 3]
```

### Tech Stack Breakdown
| Layer | Technology | Purpose / Justification |
|---|---|---|
| **Frontend** | React 18, TypeScript, Vite | Ultra-fast build times, typed contracts, responsive state. |
| **Styling** | Tailwind CSS, Lucide React | Clean, responsive UI with zero CSS runtime overhead. |
| **Backend** | FastAPI, Python 3.11+ | High-throughput asynchronous ASGI web server, automatic OpenAPI generation. |
| **Gateway** | LiteLLM | Unified SDK interface across 100+ LLM providers; native in-memory caching. |
| **Validation** | Pydantic v2 | High-speed Rust-backed input parsing and schema validation. |
| **Database** | SQLite + SQLAlchemy 2.0 | Zero-dependency, embedded ACID persistence. No network hops to Redis/Postgres. |
| **DevOps** | Docker, Docker Compose, Make | Multi-stage builder/runner images for minimal production footprint. |
| **Hosting** | Vercel (Front) + Render (Back) | Cost-free, cloud-native deployment with global edge CDN for static assets. |

---

## 3. The End-to-End Request Lifecycle

Here is the exact step-by-step path of a user prompt from keyboard stroke to database write:

```
[User clicks Send]
       │
       ▼
1. Frontend (App.tsx): Validates prompt (1-4000 chars), appends optimistic user message to UI state.
       │
       ▼
2. Network Call: POST https://api.../chat (or /chat/stream) with headers:
   - Content-Type: application/json
   - X-Simulate-Failure: key_1=429 (optional, from UI dropdown)
   - X-Client-ID: client-xyz (for session isolation)
       │
       ▼
3. RequestContextMiddleware: Generates unique UUID `X-Request-ID`, attaches security headers.
       │
       ▼
4. RateLimitMiddleware: Extracts client IP via `X-Forwarded-For` (Cloudflare/Render proxy-safe).
   Checks sliding 60-second window. If hits > 120, returns HTTP 429 immediately.
       │
       ▼
5. Pydantic Validation: ChatRequest validates message string, session_id length, temperature (0-2).
       │
       ▼
6. Chat Service (chat_service.py):
   - Opens SQLite session.
   - Retrieves historical turns for this `session_id`.
   - Bounds history to latest 20 messages (sliding window prevents token explosion).
   - Assembles `messages = [System Prompt, ...Past Turns, Current User Message]`.
       │
       ▼
7. Gateway Cache Check (gateway.py):
   - LiteLLM computes SHA256/MD5 hash of `[model, messages, temperature, max_tokens]`.
   - If found in local cache:
     * Extracts cached response.
     * Sets `resolution_source = "LLM_CACHE"`, `key_id = null`, `fallback_attempts = 0`.
     * Latency is ~1–10ms.
     * Skips all provider network calls!
       │
       ▼ (If Cache Miss)
8. Gateway Failover Rotation (iter_candidate_keys):
   - Key 1 (`groq/openai/gpt-oss-20b`):
     * Checks if failure simulated via `X-Simulate-Failure`.
     * Calls `litellm.completion(model, messages, api_key)`.
     * If 429/5xx occurs: catches exception, increments `fallback_attempts = 1`, logs warning.
   - Key 2 (`gemini/gemini-2.5-flash-lite`):
     * Retries with second key. If succeeds: returns response!
   - (If all keys fail: raises `AllProvidersUnavailableException` $\rightarrow$ HTTP 503).
       │
       ▼
9. Persistence Transaction (save_turn):
   - ONLY reached if step 7 or 8 succeeds!
   - Writes user message and assistant reply to `messages` table in SQLite.
   - Records metadata: latency, tokens, resolution source, model, key used.
   - Commits transaction.
       │
       ▼
10. HTTP Response: Returns HTTP 200 with JSON payload or terminates SSE stream with `type: done`.
       │
       ▼
11. UI Render: Frontend displays reply with Telemetry HUD (Badge: LLM_CACHE or LIVE_INFERENCE).
```

---

## 4. Deep Dive: Core Architectural Pillars

### 4.1 Multi-Key Failover Engine

#### How It Works
The gateway reads `LLM_API_KEYS` from the environment into an ordered pool of dictionaries:
```python
LLM_API_KEYS="key_1:groq/openai/gpt-oss-20b:gsk_...,key_2:gemini/gemini-2.5-flash-lite:AIzaSy..."
```
Each candidate key is tried sequentially in `iter_candidate_keys()`.

#### The Failover Eligibility Filter (`is_failover_eligible`)
**Critical System Design Rule:** Not all errors should trigger failover!
- **Failover-Eligible Errors (Transient):**
  - HTTP 429 (Rate Limit / Quota Exceeded)
  - HTTP 500, 502, 503, 504 (Server Outages)
  - Connection timeouts, DNS drops, SSL handshakes
- **Non-Failover Errors (Deterministic Client Errors):**
  - HTTP 400 Bad Request
  - `ContextWindowExceededError` (Prompt exceeds model's context window)
  - `ModuleNotFoundError` / `ImportError` (Internal runtime bugs)

*Why?* If a prompt is 100,000 tokens long and exceeds `key_1`'s context window, retrying `key_2` will fail identically, burning quotas and adding 10 seconds of useless latency. The gateway immediately aborts with `NonRetryableProviderError` (HTTP 400).

#### Failure Simulation Hook (`X-Simulate-Failure`)
To allow evaluators, integration tests, and interviewers to test failover deterministically:
- Header: `X-Simulate-Failure: key_1=429` forces the gateway to skip `key_1` as if it returned HTTP 429.
- Header: `X-Simulate-Failure: *=429` forces all keys to fail, demonstrating clean HTTP 503 provider exhaustion without crashing.
- **Safety Invariant:** When failure simulation is active, response caching is automatically disabled (`caching=False`) so the test hits live fallback logic.

---

### 4.2 Response Caching & Multi-Turn Cache Invalidation

#### LiteLLM Native In-Memory Caching
We do not invent a custom Python dictionary or add Redis. The application initializes LiteLLM's native cache:
```python
litellm.enable_cache(type="local", max_messages=None)
```
- In-memory dictionary stores up to 200 items.
- TTL: 10 minutes (600 seconds).
- Thread-safe and fast.

#### The "Interviewer Trap": Multi-Turn Conversation Cache Invalidation
> **Interviewer Question:** *"I sent 'What is the capital of France?' and got `LIVE_INFERENCE`. Then I typed 'What is the capital of France?' a second time into the same chat, and it was still `LIVE_INFERENCE`! Is your cache broken?"*

**The Answer:**
**No! That is the mathematically correct behavior of a conversation-aware LLM system.**

Here is why:
- The LiteLLM cache key is the hash of the **full messages array**:
  $$\text{CacheKey} = \text{Hash}(\text{Model}, [\text{SystemPrompt}, \dots\text{History}, \text{CurrentMessage}])$$
- **Turn 1:**
  - Messages sent: `[System, User("What is the capital of France?")]`
  - Tokens: 112
  - Result: `LIVE_INFERENCE`. Cached under $\text{Hash}_1$.
  - Assistant responds: `"The capital of France is Paris."`
- **Turn 2 (in the same session):**
  - The backend retrieves conversation history.
  - Messages sent:
    ```json
    [
      {"role": "system", "content": "..."},
      {"role": "user", "content": "What is the capital of France?"},
      {"role": "assistant", "content": "The capital of France is Paris."},
      {"role": "user", "content": "What is the capital of France?"}
    ]
    ```
  - Tokens: 145!
  - This 4-message dialogue has **never been seen before**. In conversational AI, repeating a question in an ongoing chat is a follow-up or clarification request (e.g. "I asked you already, confirm it").
  - Result: Correctly evaluated as a cache miss $\rightarrow$ `LIVE_INFERENCE`.

#### How to Demonstrate `LLM_CACHE`:
1. Ask `"What is the capital of France?"` in Session A $\rightarrow$ `LIVE_INFERENCE` (960ms).
2. Click **"New"** in the navbar to open a fresh session (empty history).
3. Ask `"What is the capital of France?"` in Session B $\rightarrow$ **`LLM_CACHE`** (12ms, `key_id: null`, `fallback_attempts: 0`).

#### Cross-Endpoint Cache Synchronization (`sync_cache_keys`)
FastAPI exposes both `/chat` (synchronous JSON) and `/chat/stream` (SSE).
LiteLLM hashes kwargs into cache keys in insertion order:
- `/chat` parameters: `{"model": m, "messages": msgs, "temperature": t}`
- `/chat/stream` parameters: `{"model": m, "messages": msgs, "temperature": t, "stream": True}`

Because of the `"stream": True` flag, LiteLLM would normally compute two different cache keys for the exact same prompt!
Our gateway includes `sync_cache_keys()`:
```python
def sync_cache_keys(model, messages, temperature, max_tokens):
    # Generates both sync and streaming cache keys
    # If key A has a value and key B does not, copies the cached value across!
```
**Result:** Asking a question in the streaming UI primes the cache for the synchronous API, and vice-versa!

---

### 4.3 SQLite Storage, WAL Mode & Concurrency

#### Why SQLite?
1. **Zero Operational Overhead:** No external Postgres or Redis containers to maintain or crash.
2. **Sub-Millisecond Read Latency:** Queries execute directly in process memory via C extensions.
3. **Embedded ACID Safety:** Guarantees atomic commits and rollbacks.

#### Concurrency Hardening
Standard SQLite locks the entire database file during writes (`database is locked` error). We eliminated this with three architectural configurations in `backend/app/database.py`:
1. **WAL Mode (`PRAGMA journal_mode=WAL`):**
   - Write-Ahead Logging separates reads and writes.
   - Multiple readers can read simultaneously while a writer writes to the `-wal` file.
   - Readers never block writers; writers never block readers.
2. **Synchronous Normal (`PRAGMA synchronous=NORMAL`):**
   - Reduces disk sync flushes from 3 per write to 1, doubling write IOPS without risking database corruption.
3. **Busy Timeout (`PRAGMA busy_timeout=5000`):**
   - If a write lock is active, incoming queries wait up to 5,000ms instead of immediately throwing an exception.

#### Error Hygiene
**Strict Rule:** Unsuccessful requests (HTTP 422 Unprocessable Entity, HTTP 400 Bad Request, or HTTP 503 Provider Exhaustion) are **never** committed to the database. Only successful turns are recorded in `save_turn()`.

---

### 4.4 Real-Time Streaming & Preflight Chunking

#### The Streaming Failover Paradox
If an application streams tokens immediately to the user and the provider encounters a network drop or 429 after word 10, what happens?
- You cannot seamlessly switch to `key_2` because the user's browser has already rendered the first 10 words.
- Restarting from `key_2` causes duplicate text and visual stutter.

#### Our Solution: Preflight First-Chunk Evaluation
In `gateway.py` $\rightarrow$ `open_stream()`:
```python
for key, request, failed_attempts, start_time in iter_candidate_keys(...):
    request["stream"] = True
    try:
        stream = litellm.completion(**request)
        # PREFLIGHT CHECK: Pull the very first chunk before committing
        first_chunk = next(stream)
        return OpenStream(key_id, model, stream, first_chunk, ...)
    except Exception as error:
        # Provider failed at initialization! Rotate to next key cleanly.
        continue
```
By waiting for `first_chunk` inside the key candidate loop, any provider that fails immediately (e.g. 429 Rate Limit) is caught **before a single byte is sent over SSE**. The user never sees a broken stream.

---

### 4.5 In-Place Turn Regeneration

When the user clicks the "Regenerate" button in the UI:
1. Request payload sends `"regenerate": true`.
2. **Context Pruning:** In `build_conversation()`, `message_repository.is_redo_of_last_turn()` detects that the last turn matches the prompt, and slices off the last turn: `history = history[:-2]`. This prevents the question from appearing twice in the prompt context.
3. **Cache Bypass:** `skip_cache=True` ensures LiteLLM queries the live model rather than returning the same cached text.
4. **Database Hygiene:** `save_turn(regenerate=True)` overwrites the assistant's previous reply in-place in SQLite rather than appending duplicate rows.

---

### 4.6 Security, Rate Limiting & Proxy Headers

#### Sliding-Window IP Rate Limiting
Implemented as a lightweight ASGI middleware (`RateLimitMiddleware`):
- Limits each client IP to **120 requests per minute**.
- Uses an in-memory sliding window timestamp list: `client_hits: dict[str, list[float]]`.
- Exempts static assets and health checks (`/health`, `/docs`, `/openapi.json`).
- Automatically prunes stale IP buckets every 100 requests to prevent memory leaks.

#### Reverse Proxy IP Handling (`X-Forwarded-For`)
When deployed behind Cloudflare (Vercel) and Render's reverse proxy, standard `request.client.host` reports Render's internal gateway IP, which would lump all users into a single shared rate limit!
- Our middleware parses the `X-Forwarded-For` header:
  ```python
  client_ip = forwarded_for.split(",")[0].strip()
  ```
- Takes the true client IP from the first hop.
- Uvicorn runs with `--proxy-headers` and `--forwarded-allow-ips=*` in Docker.

#### CORS Whitelisting
Cross-Origin Resource Sharing is locked down to:
- Production frontend: `https://lyftr-ai-xi.vercel.app`, `https://lyftr-chat.vercel.app`
- Local development: `http://localhost:3000`, `http://localhost:5173`, `http://127.0.0.1:3000`
- Rejects unauthorized origins (e.g., `https://evil.com`).

---

## 5. Frontend Architecture & State Management

### Components & Responsibilities
- `App.tsx`: Central coordinator managing active `sessionId`, message state, system prompt, temperature, and theme.
- `MessageList.tsx` & `MessageItem.tsx`: Renders conversation bubble stream with custom Markdown formatting and Telemetry HUD badge.
- `ChatInput.tsx`: Auto-resizing textarea, Enter to send, Shift+Enter for newline, AbortController stop button.
- `SessionDrawer.tsx`: Sliding sidebar displaying past chat sessions with titles, turn counts, and delete confirmation.
- `TuningPanel.tsx`: Collapsible accordion for real-time temperature (0.0–2.0), max tokens (64–4096), and system prompt customization.
- `Header.tsx`: Navigation bar with Capitalized labels (`History`, `Tuning`, `System Prompt`, `New`), Live Gateway Status indicator, and Light/Dark toggle.

### Telemetry HUD (Heads-Up Display)
Every assistant message card features a bottom metadata pill displaying:
- **Resolution Source:** `LLM_CACHE` (Emerald Green) or `LIVE_INFERENCE` (Indigo Blue).
- **Latency:** Execution time in milliseconds (e.g., `12ms` vs `960ms`).
- **Token Usage:** Exact per-request input and output tokens (e.g., `112 in / 145 out`).
- **Provider Key:** `key_1`, `key_2`, or `null` on cache hits.
- **Failover Counter:** `0 fallbacks` or `1 fallback` if a provider retry occurred.

### Strict `data-testid` Contract Compliance
Automated grading harnesses expect exact `data-testid` attributes in the DOM:
- `data-testid="session-id"`
- `data-testid="message-input"`
- `data-testid="send-button"`
- `data-testid="system-prompt-input"`
- `data-testid="simulate-failure-select"`
- `data-testid="resolution-source"`
- `data-testid="token-metrics"`
- `data-testid="regenerate-button"`
- `data-testid="error-banner"`

---

## 6. Real-World War Stories: Bugs We Found & Fixed

### War Story 1: The Render Cloud Crash (`soundfile` & `orjson`)
- **The Symptom:** Local tests passed with 100% success. But on the live Render cloud deployment, every query returned `Error (503): all providers unavailable`.
- **The Investigation:**
  - We added diagnostic endpoint `GET /cache/debug` exposing `LAST_GATEWAY_ERRORS`.
  - The live logs revealed:
    ```
    key_1: ModuleNotFoundError: No module named 'soundfile'
    key_2: RateLimitError: 429 You exceeded your current quota
    key_3: ModuleNotFoundError: No module named 'soundfile'
    ```
  - LiteLLM's `success_handler` unconditionally imports `transcribe_passthrough_logging_handler.py`, which had a top-level `import soundfile`.
  - In our local virtualenv, `soundfile` happened to be installed, but it was missing from `requirements.txt` in Docker!
- **The Fix:**
  1. Added an in-code safety guard in `gateway.py`:
     ```python
     for _mod in ("soundfile",):
         if _mod not in sys.modules:
             try: __import__(_mod)
             except ImportError: sys.modules[_mod] = MagicMock()
     ```
  2. Pinned `soundfile==0.14.0` and `orjson==3.13.0` in `requirements.txt`.
  3. Added `ModuleNotFoundError` to `is_failover_eligible` exclusion list so internal import bugs don't trigger cascading provider failover loops.

### War Story 2: Cross-Endpoint Cache Key Mismatch
- **The Symptom:** A question asked via synchronous `/chat` was not recognized as cached when asked via streaming `/chat/stream`.
- **The Investigation:** LiteLLM generates cache keys by hashing kwargs in dict insertion order. The streaming endpoint passed `"stream": True`, producing a different hash.
- **The Fix:** Created `sync_cache_keys()`, which deterministically creates both sync and streaming keys and bidirectionally copies cache values across the in-memory store.

### War Story 3: UI Freeze at "Connecting..."
- **The Symptom:** When switching tabs or during backend cold-starts, the frontend health pill remained stuck at `"Connecting..."`.
- **The Investigation:** Health check was polling on an inflexible 30-second interval, and browser tab backgrounding throttled timers.
- **The Fix:** Added an immediate mount check, 2-second fast retry on initial failure, and a `document.visibilitychange` listener that triggers a fresh health ping the instant the user tabs back into the app.

---

## 7. Comprehensive Interview Q&A (20 Toughest Questions)

### Q1: Walk me through the architecture of this system at a high level.
> **Answer:** Lyftr AI is a full-stack, resilient LLM chatbot built with React, FastAPI, LiteLLM, and SQLite. The frontend handles session management, Markdown rendering, and Server-Sent Event streaming. The FastAPI backend orchestrates requests through an ASGI middleware pipeline (RequestContext, RateLimiter, CORS) into a LiteLLM gateway. The gateway maintains an ordered pool of API keys and LiteLLM's in-memory response cache. All conversation turns and telemetry are persisted in a containerized SQLite database running in WAL mode.

---

### Q2: Why did you choose SQLite instead of PostgreSQL or Redis?
> **Answer:** SQLite was chosen for zero-dependency simplicity, instant setup, and zero network latency. In a typical containerized microservice, connecting to external Postgres and Redis instances introduces connection pool overhead, network round-trip latency (10–50ms per query), and potential points of failure. By mounting SQLite to a persistent Docker volume (`/data/app.db`) and configuring Write-Ahead Logging (`PRAGMA journal_mode=WAL`), SQLite supports concurrent multi-process reads while a write occurs, easily handling hundreds of requests per second with sub-millisecond execution.

---

### Q3: How does the key failover mechanism work when a provider rate-limits?
> **Answer:** In `backend/app/gateway.py`, we iterate through a prioritized pool (`key_1`, `key_2`, `key_3`). When `litellm.completion()` is called, any transient exception (such as HTTP 429 RateLimitError, 503 Service Unavailable, or connection timeouts) is caught. The gateway checks `is_failover_eligible(error)`. If true, it increments `fallback_attempts`, logs the failure, and retries the exact prompt with the next candidate key. If all keys are exhausted, it raises `AllProvidersUnavailableException`, which the HTTP route returns as a clean HTTP 503 without saving any failed data.

---

### Q4: Should client errors like HTTP 400 or Context Length Exceeded fail over to the next key? Why or why not?
> **Answer:** Absolutely not. Those are deterministic client errors. If a prompt exceeds the model's context window (e.g., 100k tokens sent to an 8k token model) or contains invalid JSON formatting, sending the identical prompt to `key_2` will fail identically. Failing over would burn quota on backup keys and add multi-second latency for no reason. Our `is_failover_eligible()` function explicitly checks for `ContextWindowExceededError` and HTTP 400 and immediately aborts failover.

---

### Q5: How does the response caching work, and what determines a cache hit?
> **Answer:** Caching is built on LiteLLM's native local in-memory cache (`litellm.enable_cache(type="local")`). The cache key is derived from the model name, hyperparameters (temperature, max_tokens), and the full array of messages: `[system_prompt, ...history, current_user_message]`. When a request matches an existing entry, LiteLLM returns the cached completion. The gateway detects this via `response._hidden_params["cache_hit"] == True`, marks `resolution_source = "LLM_CACHE"`, sets `key_id = null`, and `fallback_attempts = 0`, returning the result in under 10 milliseconds.

---

### Q6: If I send "Hello" twice in the same chat session, why does the second turn return `LIVE_INFERENCE` instead of `LLM_CACHE`?
> **Answer:** Because multi-turn conversational context changes the cache key. In Turn 1, the messages array is `[System, User("Hello")]`. In Turn 2 within the same session, the messages array sent to the model includes the dialogue history: `[System, User("Hello"), Assistant("Hi there!"), User("Hello")]`. The token count and prompt context are completely different. In conversational AI, repeating a question in an ongoing chat is a clarification or follow-up, so treating it as a new inference is correct. To observe `LLM_CACHE`, you start a new session (or click "New") and ask "Hello" with an empty history, which hashes to the exact same key as Turn 1.

---

### Q7: How do you handle caching between synchronous `/chat` and streaming `/chat/stream`?
> **Answer:** Normally, LiteLLM hashes kwargs into cache keys in insertion order, so the streaming request's `"stream": True` flag produces a different hash than the synchronous request. We solved this with `sync_cache_keys()`, which computes both the sync key and streaming key and copies the cached value across. This ensures that asking a question on the streaming frontend primes the cache for any client using the REST API.

---

### Q8: How did you implement SSE streaming without risking broken streams during failover?
> **Answer:** That is the "Streaming Failover Paradox": once you stream tokens to the client over an HTTP 200 SSE connection, you cannot fail over to a backup key without corrupting the output. We solved this with **Preflight Chunking**: in `gateway.py`, we call `first_chunk = next(stream)` inside the key rotation `try-except` block. If `key_1` throws a 429 on initialization, it is caught *before* any HTTP headers or SSE frames are flushed to the client, allowing a clean failover to `key_2`. Once `first_chunk` arrives safely, we yield it and pipe the remainder of the generator.

---

### Q9: How do you prevent database locking in SQLite when handling concurrent requests?
> **Answer:** We apply three critical SQLite pragmas on engine startup:
> 1. `PRAGMA journal_mode=WAL`: Enables Write-Ahead Logging so readers and writers run concurrently without blocking each other.
> 2. `PRAGMA synchronous=NORMAL`: Balances data integrity with high throughput by reducing disk fsync operations.
> 3. `PRAGMA busy_timeout=5000`: Causes SQLite to wait up to 5 seconds if a table write lock is contested rather than immediately raising an operational error.

---

### Q10: What happens if a request fails with an HTTP 422 or HTTP 503? Is it saved to the database?
> **Answer:** No. Our architecture strictly enforces error hygiene. In `chat_service.py`, `save_turn()` is only called *after* the gateway successfully returns a valid completion. If validation fails (HTTP 422) or all providers are unavailable (HTTP 503), an HTTP exception is raised and execution never reaches the persistence layer. This ensures the chat history is never corrupted with failed or empty assistant turns.

---

### Q11: How does in-place regeneration work?
> **Answer:** When a user triggers "Regenerate" (`"regenerate": true`), `chat_service.py` checks `is_redo_of_last_turn()`. It slices off the stale last turn (`history = history[:-2]`) so the question is not sent twice to the model. It passes `skip_cache=True` to LiteLLM to guarantee fresh inference. When the response arrives, `save_turn(regenerate=True)` updates the existing assistant record in SQLite rather than appending duplicate rows.

---

### Q12: How does the rate limiting work behind a reverse proxy like Cloudflare or Render?
> **Answer:** If you read `request.client.host` behind a proxy, every incoming request has the proxy's IP, effectively creating one global rate limit for all users. Our `RateLimitMiddleware` inspects the `X-Forwarded-For` header and extracts the first comma-separated IP (`forwarded_for.split(",")[0].strip()`), which represents the originating client. Uvicorn is launched with `--proxy-headers` and `--forwarded-allow-ips=*` to ensure trusted proxy header forwarding.

---

### Q13: How do you prevent memory leaks in your in-memory rate limiter?
> **Answer:** The rate limiter maintains an internal counter. Every 100 requests, it runs a pruning cycle that iterates through `client_hits` and deletes any IP key whose newest timestamp is older than the 60-second sliding window:
> ```python
> stale_keys = [k for k, ts in self.client_hits.items() if not ts or ts[-1] <= window_start]
> for k in stale_keys: del self.client_hits[k]
> ```
> This prevents long-running server instances from accumulating millions of dead IP keys in memory.

---

### Q14: How are token metrics tracked? Are they per-request or cumulative?
> **Answer:** The rubric strictly demands **per-request token tracking**. Cumulative tokens would obscure individual turn costs. In `gateway.py`, we extract `usage.prompt_tokens` and `usage.completion_tokens` from LiteLLM's response object. If a mock key or non-standard provider reports 0 tokens, we fall back to an exact word-count heuristic for that turn.

---

### Q15: How does the `X-Simulate-Failure` header work?
> **Answer:** In `gateway.py`, `parse_simulate_failure_header()` parses rules like `key_1=429` or `*=429`. When `ENABLE_FAILURE_SIMULATION=true`, the key candidate iterator checks if the current `key_id` is targeted. If so, it logs a warning, skips that key, and increments `failed_attempts` without making an external HTTP call. This allows developers and automated grading bots to test failover deterministically.

---

### Q16: Walk me through the most difficult bug you encountered in this project and how you solved it.
> **Answer:** The most difficult bug was an unexpected `503 All Providers Unavailable` on the live Render deployment that never occurred locally. By implementing a diagnostic `/cache/debug` endpoint, we discovered that LiteLLM's internal logging handler was throwing `ModuleNotFoundError: No module named 'soundfile'`. In our local development environment, `soundfile` happened to be installed in our virtualenv, but it wasn't in `requirements.txt` in Docker. When LiteLLM finished a request on Render, it crashed on `import soundfile`, which the gateway mistakenly caught as a provider failure on `key_1`, then failed over to `key_2` (which hit Gemini's quota), then to `key_3` (which crashed on `soundfile` again), causing a 503. We solved it by adding a `sys.modules` pre-import `MagicMock` guard in `gateway.py` so LiteLLM never crashes on optional modules, and pinned `soundfile==0.14.0` and `orjson==3.13.0` in `requirements.txt`.

---

### Q17: How would you scale this system from 100 users to 100,000 active concurrent users?
> **Answer:**
> 1. **Database:** Migrate SQLite to PostgreSQL or Amazon Aurora with Read Replicas and PgBouncer connection pooling.
> 2. **Caching:** Replace in-memory LiteLLM cache with distributed Redis Cluster or DragonflyDB to share cached completions across hundreds of stateless backend containers.
> 3. **Gateway Queuing:** Introduce Celery/Redis or Kafka for asynchronous job queues, and deploy a distributed rate-limiting token bucket with Redis.
> 4. **Horizontal Scaling:** Deploy backend containers across Kubernetes (EKS) with Horizontal Pod Autoscaling (HPA) triggered by CPU and request concurrency metrics.
> 5. **CDN & Edge:** Serve the React SPA through Cloudflare Edge with static asset caching and automatic DDoS protection.

---

### Q18: What is the purpose of the sliding context window in `chat_service.py`?
> **Answer:** We cap conversation history to the latest 20 messages (`MAX_HISTORY_MESSAGES = 20`). Without a sliding window, a 100-turn chat would send all 100 previous turns on every single query. This would cause quadratic token consumption, balloon API costs, increase provider latency, and eventually crash against model context window limits.

---

### Q19: How do you prevent Cross-Site Scripting (XSS) when rendering LLM Markdown replies?
> **Answer:** In the React frontend, we sanitize HTML before rendering. LLM output should never be rendered using raw `dangerouslySetInnerHTML` without a sanitizer like DOMPurify. Code blocks are parsed into syntax-highlighted containers with escaped strings, preventing malicious script injection from untrusted model outputs.

---

### Q20: If Render puts the backend to sleep on the free tier, how does the frontend handle cold starts?
> **Answer:** Render free-tier instances spin down after 15 minutes of inactivity, taking ~30–40 seconds to spin up on the next request. The frontend features a resilient health checker:
> 1. It immediately polls `/health` on mount.
> 2. If it fails or times out, it displays an amber "Waking backend..." status badge with a fast 2-second retry loop.
> 3. It listens to the browser's `visibilitychange` event, immediately re-checking health when the user returns to the tab.
> 4. Request timeouts in `api.ts` are set to 45 seconds to accommodate container cold boots without dropping the user's turn.

---

## 8. Summary Cheat Sheet for Fast Revision

| Concept | Key Point to Memorize |
|---|---|
| **Failover Order** | `key_1` (Groq 20B) $\rightarrow$ `key_2` (Gemini Flash) $\rightarrow$ `key_3` (Groq 120B). |
| **Failover Triggers** | 429 RateLimit, 5xx Server Errors, Timeouts. (NOT 400 Bad Request or Context Length). |
| **Cache Key** | Hash of `Model + [SystemPrompt, ...History, NewMessage] + Hyperparams`. |
| **Cache Hit Contract** | `resolution_source: "LLM_CACHE"`, `key_id: null`, `fallback_attempts: 0`, Latency < 15ms. |
| **Same Query Twice in Same Chat** | `LIVE_INFERENCE` (because history includes Turn 1's assistant reply $\rightarrow$ different hash). |
| **Same Query in Fresh Chat** | `LLM_CACHE` (clean history $\rightarrow$ exact same hash). |
| **SQLite WAL Mode** | Readers never block writers; writers never block readers. Mounted at `/data/app.db`. |
| **Database Hygiene** | Failed turns (422, 503) are **never** committed to SQLite. |
| **Streaming Failover** | Waits for `first_chunk = next(stream)` before emitting SSE so failover happens pre-stream. |
| **Regeneration** | Slices off last turn (`history[:-2]`), forces `skip_cache=True`, updates DB record in-place. |
| **Rate Limit** | 120 reqs/min per IP using `X-Forwarded-For` with periodic stale key pruning. |
| **Test Hook** | `X-Simulate-Failure: key_1=429` (active when `ENABLE_FAILURE_SIMULATION=true`). |
