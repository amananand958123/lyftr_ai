# Lyftr AI — Resilient LLM Chatbot with Key Failover & Caching

A full-stack, production-grade LLM chatbot built for the **Lyftr AI Full-Stack Assignment**. Architected with React, FastAPI, LiteLLM, and SQLite. Features automatic multi-key failover, native response caching, per-request token metrics, and containerized volume persistence.

---

## 1. Live URLs
- **Frontend Live Application:** `https://lyftr-ai-xi.vercel.app`
- **Backend Live API:** `https://lyftr-ai-backend.onrender.com`
- **Live Health Endpoint:** `https://lyftr-ai-backend.onrender.com/health`

---

## 2. Run Locally

### With Docker (Recommended)
```bash
# 1. Clone repository
git clone https://github.com/amananand958123/lyftr_ai.git
cd lyftr_ai

# 2. Copy and customize environment variables
cp .env.example .env
# Optional: set your actual LLM_API_KEYS (e.g. Gemini, OpenAI, or Groq)

# 3. Spin up full stack (Frontend on :3000, Backend on :8000)
make up

# 4. View logs or tear down
make logs
make down
```

### Without Docker

#### Backend:
```bash
cd backend
python3.11 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```
Backend will be available at `http://localhost:8000`.

#### Frontend:
```bash
cd frontend
npm install
npm run dev
```
Frontend will be available at `http://localhost:3000`.

#### Running Tests:
```bash
make test
# Or directly:
./backend/venv/bin/pytest backend/tests -v
```

---

## 3. Design Decisions

### A. Key Fallback Engine
- **Ordered Key Pool:** Configured via `LLM_API_KEYS` in order of priority (`key_1`, `key_2`, ...).
- **Graceful Failover:** When the primary key encounters HTTP 429 (Rate Limit), quota exhaustion, or 5xx server errors, the gateway catches the exception, increments `fallback_attempts`, and automatically retries with the next available key in the pool. Non-retryable client errors (like 400 Bad Request or token window exceedance) are not retried.
- **Provider Exhaustion:** If all keys in the pool fail, the endpoint returns a clean HTTP 503 `{"detail": "all providers unavailable"}` without crashing, and does not record the failed interaction in SQLite.
- **Failover Test Hook:** Supports `X-Simulate-Failure: <key_id>=<status>` (active when `ENABLE_FAILURE_SIMULATION=true`), allowing evaluators to verify fallback deterministically without burning live provider quotas. Both Swagger UI (`/docs`) and failure simulation are enabled by default for grading and review purposes.

### B. Response Caching
- **LiteLLM Native Caching:** Built strictly on LiteLLM's native local in-memory cache (`litellm.enable_cache(type="local")`). In-memory storage holds up to 200 entries with a 10-minute TTL per entry.
- **Cache Invariant:** Cache keys are derived from the model name and the full message history array `[system, history, current_message]` along with any hyperparameters (`temperature`, `max_tokens`).
- **Cross-Endpoint Cache Synchronization:** Automatically synchronizes cache entries between `/chat` (sync) and `/chat/stream` (SSE), including requests carrying tuning parameters. Asking a question via either endpoint allows the other endpoint to hit the cache immediately.
- **Purge Cache:** `POST /cache/clear` flushes the cache dictionaries directly, allowing instant validation of subsequent fresh live inference.
- **Cache Hit Contract:** Identical prompts in fresh sessions resolve as `resolution_source: "LLM_CACHE"` with sub-millisecond latency, zero `fallback_attempts`, `key_id: null`, and identical token metrics.

### C. SQLite Session Storage & Concurrency
- **Single Database Solution:** Uses SQLite only—no Redis or Postgres.
- **Persistent Docker Volume:** The database file is located at `DATABASE_URL=sqlite:////data/app.db` under a named Docker volume (`sqlite_data:/data`) so conversation history survives container restarts and local re-deployments. Note on cloud hosting: Render's free tier provides an ephemeral filesystem; persistent disk volumes on Render require a paid Starter plan.
- **WAL Mode Optimization:** Enabled `PRAGMA journal_mode=WAL` and `PRAGMA synchronous=NORMAL` to maximize concurrent read/write throughput without table locks.
- **Error Hygiene:** Unsuccessful requests (400 validation/context errors, 422 unprocessable entities, or 503 provider exhaustion) are never written to the database.

### D. Real-Time Streaming (`POST /chat/stream`)
- **Server-Sent Events (SSE):** Provides real-time token delivery via standard `text/event-stream` chunks (`data: {"type": "delta", "text": "..."}`).
- **Failover Preflight:** Evaluates the primary key and tests the first chunk before committing to a stream. If a provider fails at initialization, the gateway automatically rolls over to the fallback key before any tokens reach the client.
- **Completion Metadata:** Delivers a finalized `data: {"type": "done", "metadata": {...}}` event with token usage, resolution source, model, and latency.

### E. In-Place Reply Regeneration
- **Duplicate-Free Redo:** Supports `"regenerate": true` in the JSON request body (or `X-Regenerate: true` header).
- **History & Context Hygiene:** When regenerating, the last turn is dropped from the prompt context so questions are never duplicated, and the assistant's reply is updated in-place in SQLite.
- **Cache Bypass:** Regenerate requests bypass the cache (`skip_cache=True`) to ensure a fresh live inference from the model.

---

## 4. Verification

### 1. Failover Demonstration
Simulate rate limiting on `key_1` to watch `key_2` handle the request:
```bash
curl -i -X POST http://localhost:8000/chat \
  -H "Content-Type: application/json" \
  -H "X-Simulate-Failure: key_1=429" \
  -d '{"session_id": "verify-failover", "message": "Test failover"}'
```
**Expected Response:** HTTP 200, `metadata.key_id: "key_2"`, `metadata.fallback_attempts: 1`.

### 2. Provider Exhaustion Demonstration
Simulate all providers failing:
```bash
curl -i -X POST http://localhost:8000/chat \
  -H "Content-Type: application/json" \
  -H "X-Simulate-Failure: *=429" \
  -d '{"session_id": "verify-503", "message": "Test exhaustion"}'
```
**Expected Response:** HTTP 503, `{"detail": "all providers unavailable"}`.

### 3. Response Caching Demonstration
Send the same message in two separate sessions:
```bash
# Call 1 (Session A -> Live Inference)
curl -s -X POST http://localhost:8000/chat \
  -H "Content-Type: application/json" \
  -d '{"session_id": "sess-a", "message": "What is the speed of light?"}' | jq .metadata

# Call 2 (Session B -> Cache Hit)
curl -s -X POST http://localhost:8000/chat \
  -H "Content-Type: application/json" \
  -d '{"session_id": "sess-b", "message": "What is the speed of light?"}' | jq .metadata
```
**Expected Call 2 Result:** `resolution_source: "LLM_CACHE"`, `key_id: null`, `fallback_attempts: 0`, and latency under 10ms.

### 4. Per-Request Token Usage
Every response returns `input_tokens` and `output_tokens` extracted from LiteLLM usage metrics for that single completion, never an aggregated conversation total.

### 5. SSE Streaming Demonstration
Stream tokens in real time via Server-Sent Events:
```bash
curl -N -X POST http://localhost:8000/chat/stream \
  -H "Content-Type: application/json" \
  -d '{"session_id": "sess-stream", "message": "Explain quantum computing in one sentence."}'
```
**Expected Stream:** Multiple `data: {"type": "delta", "text": "..."}` events followed by a final `data: {"type": "done", "metadata": {...}}` payload.

### 6. Reply Regeneration Demonstration
Regenerate a turn without duplicating questions in SQLite history:
```bash
curl -s -X POST http://localhost:8000/chat \
  -H "Content-Type: application/json" \
  -d '{"session_id": "sess-stream", "message": "Explain quantum computing in one sentence.", "regenerate": true}' | jq .
```

---

## 5. Setup Used
- **Editor & IDE:** VS Code & Terminal
- **AI Tools & Assistants:** Antigravity / Claude Code
- **Testing & Verification:** Pytest, HTTPX, Postman, and Playwright

---

## 6. Bonus Features
1. **Interactive Evaluator Test Bar:** A UI tool in the header allowing one-click selection of `X-Simulate-Failure` headers (`key_1=429`, `key_1=500`, `*=429`) directly in the browser.
2. **SQLite Write-Ahead Logging (WAL):** Prevents database lock contention under rapid multi-turn requests.
3. **Live Metadata HUD:** Responsive badges for model, latency in ms, prompt/completion tokens, and failover attempt counters.
4. **Resilient Error Recovery:** Client gracefully renders 422 and 503 errors as readable chat messages without crashing.
