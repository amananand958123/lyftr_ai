# Lyftr AI Full-Stack Assignment: Master Execution Prompt & Engineering Blueprint

> **Goal:** Build, test, containerize, and deploy a production-grade, resilient LLM Chatbot with LiteLLM Key Failover, Response Caching, SQLite Multi-Turn Persistence, and a React UI.
> **Scoring Target:** 10/10 on the Lyftr AI Evaluation Rubric.
> **Time Limit:** 24 Hours from receipt.
> **Core Deliverables:** Public GitHub Repository, Live Frontend URL, Live Backend URL, 2–3 Minute Demo Video.

---

## Table of Contents
1. [Assignment Specifications & Strict Invariants](#1-assignment-specifications--strict-invariants)
2. [Master Turnkey Prompt (Single-Agent Autonomous Execution)](#2-master-turnkey-prompt-single-agent-autonomous-execution)
3. [Phased Step-by-Step Prompts (Iterative Development)](#3-phased-step-by-step-prompts-iterative-development)
   - [Phase 1: Architecture, Scaffolding & Configuration](#phase-1-architecture-scaffolding--configuration)
   - [Phase 2: FastAPI Backend & LiteLLM Gateway Engine](#phase-2-fastapi-backend--litellm-gateway-engine)
   - [Phase 3: Backend Test Suite & Failover Auditing](#phase-3-backend-test-suite--failover-auditing)
   - [Phase 4: React + TypeScript + Tailwind Chat UI](#phase-4-react--typescript--tailwind-chat-ui)
   - [Phase 5: Multi-Stage Dockerization & Makefile](#phase-5-multi-stage-dockerization--makefile)
   - [Phase 6: Production Cloud Deployment & Persistence Hardening](#phase-6-production-cloud-deployment--persistence-hardening)
   - [Phase 7: Adversarial Verification & Acceptance Testing](#phase-7-adversarial-verification--acceptance-testing)
   - [Phase 8: Submission Documentation & Demo Video Script](#phase-8-submission-documentation--demo-video-script)
4. [Exact Technical Contracts & Specifications](#4-exact-technical-contracts--specifications)
   - [4.1 REST API Contracts (Endpoints, Payloads & Status Codes)](#41-rest-api-contracts-endpoints-payloads--status-codes)
   - [4.2 SQLite Database Schema & Concurrency Rules](#42-sqlite-database-schema--concurrency-rules)
   - [4.3 LiteLLM Failover Engine & Caching Logic](#43-litellm-failover-engine--caching-logic)
   - [4.4 `X-Simulate-Failure` Test Hook Engine](#44-x-simulate-failure-test-hook-engine)
   - [4.5 Frontend Contract & `data-testid` Specifications](#45-frontend-contract--data-testid-specifications)
5. [Critical Pitfalls & Implementation Traps](#5-critical-pitfalls--implementation-traps)
6. [Automated Verification Harness (Copy-Pasteable `curl` Commands)](#6-automated-verification-harness-copy-pasteable-curl-commands)
7. [Official README Template (Mandatory 6 Sections)](#7-official-readme-template-mandatory-6-sections)
8. [2–3 Minute Video Presentation Storyboard & Script](#8-23-minute-video-presentation-storyboard--script)

---

# 1. Assignment Specifications & Strict Invariants

### Architectural Overview
```
┌────────────────────────────────────────────────────────┐
│                   React + Vite UI                      │
│  - Session ID on load      - Metadata display          │
│  - Multi-turn chat         - Error banners (422, 503)  │
│  - data-testid compliance  - System prompt input       │
└───────────────────────────┬────────────────────────────┘
                            │ REST JSON API (CORS enabled)
┌───────────────────────────▼────────────────────────────┐
│                    FastAPI Backend                     │
│  - GET /health                                         │
│  - POST /chat (Validates 1-4000 chars, session_id)    │
│  - GET /sessions/{session_id}/messages                │
│  - Failure Simulation Hook (X-Simulate-Failure)        │
└──────────────┬───────────────────────────┬─────────────┘
               │                           │
┌──────────────▼────────────┐ ┌────────────▼─────────────┐
│   LiteLLM Gateway Engine  │ │  SQLite Database Storage │
│ - Built-in Cache          │ │ - File: /data/app.db     │
│ - Key Pool (key_1, key_2) │ │ - Survives restarts      │
│ - Auto Failover on 429/5xx│ │ - No failed msgs saved   │
└──────────────┬────────────┘ └──────────────────────────┘
               │
      ┌────────┴────────┐
      ▼                 ▼
Primary Provider   Fallback Provider
(API Key 1)        (API Key 2)
```

### Strict Rules to Avoid Disqualification
1. **Never Rename Required Endpoints or Keys:** Endpoints must be strictly `GET /health`, `POST /chat`, and `GET /sessions/{session_id}/messages`. Response JSON structures must match verbatim.
2. **LiteLLM Native Features Only:** Response caching and fallback **must** use LiteLLM's built-in caching mechanism (`litellm.cache` / router cache), **not** a custom Python in-memory `dict` or external Redis.
3. **Database Constraint:** **SQLite only.** External database services (PostgreSQL, Redis, MongoDB) are strictly prohibited. The database path must come from `DATABASE_URL` and mount to a Docker volume at `/data/app.db`.
4. **Failure Simulation Hook:** `X-Simulate-Failure` must be supported on `POST /chat` and active only when `ENABLE_FAILURE_SIMULATION=true`. Simulated failures must return real assistant completions via the remaining valid keys—never an error message wrapped inside a 200 status code.
5. **No Failed Requests in History:** Requests resulting in HTTP 422 or 503 must **never** be saved to the database.
6. **Token Tracking Accuracy:** Input and output tokens must be tracked **per request** (prompt tokens = system prompt + conversation history + new message; completion tokens = assistant reply). Never report a running cumulative total.

---

# 2. Master Turnkey Prompt (Single-Agent Autonomous Execution)

*Use this prompt when delegating the entire project to an autonomous coding agent (Claude Code, Antigravity, Cursor Agent, etc.) in a single session.*

```markdown
You are an elite Principal Full-Stack & AI Systems Architect. Your objective is to build, verify, containerize, and prepare for deployment the complete "Lyftr AI Resilient LLM Chatbot" application strictly adhering to the assignment requirements.

### Core Stack Requirements:
- Backend: Python 3.11+, FastAPI, LiteLLM, SQLite, SQLAlchemy, Pydantic v2, Pytest.
- Frontend: React 18+, TypeScript, Vite, Tailwind CSS, Lucide Icons.
- DevOps: Multi-stage Dockerfiles, docker-compose.yml, Makefile (`make up`, `make down`), Docker volume at `/data`.
- Providers: At least 2 API keys (e.g., Gemini Flash, OpenAI, or Groq) configured via `LLM_API_KEYS`.

### Strict Technical Constraints:
1. Exact API Contracts:
   - GET /health -> {"status": "ok", "keys_configured": 2, "cache_enabled": true}
   - POST /chat -> Input: {"session_id": "str (1-128)", "message": "str (1-4000)", "system_prompt": "str (optional)"}
     Output: {"session_id": "...", "reply": "...", "metadata": {"resolution_source": "LIVE_INFERENCE"|"LLM_CACHE", "model": "...", "latency_ms": int, "input_tokens": int, "output_tokens": int, "key_id": "key_1"|null, "fallback_attempts": int}}
   - GET /sessions/{session_id}/messages -> Returns chronological history without system prompt. Returns 404 {"detail": "session not found"} if unknown.
2. LiteLLM Gateway & Caching:
   - Must use LiteLLM built-in caching. Cache key = model + full message list (system prompt + history + current message).
   - On cache hit: resolution_source must be "LLM_CACHE", key_id must be null, fallback_attempts must be 0, reply and tokens must match original cached output, latency must be lower than live inference.
3. Failover & Resilience:
   - Primary is key_1; fallback is key_2. Fail over automatically on 429, quota limits, and 5xx errors.
   - When all keys fail, return HTTP 503 {"detail": "all providers unavailable"}.
   - Support `X-Simulate-Failure: key_1=429`, `key_1=500`, `*=429` when `ENABLE_FAILURE_SIMULATION=true`.
   - Never persist failed requests (422 or 503) into SQLite.
4. Storage:
   - SQLite table `messages` (id, session_id, role, content, metadata, created_at). Database file at `sqlite:////data/app.db`.
5. Frontend UI & data-testid Attributes:
   - Every assistant message must show resolution source, model, latency, input tokens, output tokens.
   - Must include exact test IDs: `chat-input`, `send-button`, `assistant-message`, `meta-source`, `meta-model`, `meta-latency`, `meta-input-tokens`, `meta-output-tokens`, `system-prompt-input`.
   - Generate a new session_id on each page load. Show human-readable banners for 422 and 503 errors.
6. Docker & Infrastructure:
   - Multi-stage Dockerfiles for minimal image size.
   - Root docker-compose.yml running frontend on port 3000 and backend on port 8000, mounting named volume at `/data`.
   - Root Makefile with `up` and `down` targets.
   - `.env.example` containing placeholder environment variables.

### Execution Plan:
1. Scaffold the project structure (/backend, /frontend, docker-compose.yml, Makefile, .env.example, README.md).
2. Implement backend database models, schemas, LiteLLM gateway, failover handler, and endpoints.
3. Write comprehensive pytest test suite covering validation, caching, failover, simulation hook, and persistence.
4. Implement frontend React application adhering to UI and data-testid contracts.
5. Create Docker configurations and verify local execution with `make up`.
6. Run complete test suite and curl verification scripts. Fix any bugs until 100% compliant.
7. Generate comprehensive README with the 6 mandatory sections.

Do not skip any tests or requirements. Begin implementation immediately.
```

---

# 3. Phased Step-by-Step Prompts (Iterative Development)

Use these sequential prompts when building the project step-by-step or working with human checkpoints between phases.

---

### Phase 1: Architecture, Scaffolding & Configuration
**Prompt Goal:** Set up the monorepo structure, configuration management, and database scaffolding.

```markdown
You are a senior full-stack engineer. We are starting Phase 1 of the Lyftr AI Full-Stack Assignment.

Task: Initialize the project repository with the exact required file structure and environment configurations.

Repository Structure to create:
lyftr-ai/
├── backend/
│   ├── app/
│   │   ├── __init__.py
│   │   ├── main.py
│   │   ├── config.py
│   │   ├── database.py
│   │   ├── models.py
│   │   ├── schemas.py
│   │   ├── gateway.py
│   │   └── routes/
│   │       ├── __init__.py
│   │       ├── health.py
│   │       ├── chat.py
│   │       └── sessions.py
│   ├── tests/
│   │   ├── __init__.py
│   │   ├── conftest.py
│   │   ├── test_health.py
│   │   ├── test_chat.py
│   │   ├── test_caching.py
│   │   ├── test_failover.py
│   │   └── test_sessions.py
│   ├── requirements.txt
│   └── Dockerfile
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── ChatWindow.tsx
│   │   │   ├── MessageItem.tsx
│   │   │   ├── MetadataBadge.tsx
│   │   │   └── ErrorBanner.tsx
│   │   ├── App.tsx
│   │   ├── main.tsx
│   │   ├── api.ts
│   │   └── types.ts
│   ├── package.json
│   ├── tsconfig.json
│   ├── vite.config.ts
│   ├── tailwind.config.js
│   ├── postcss.config.js
│   └── Dockerfile
├── docker-compose.yml
├── Makefile
├── .env.example
├── .gitignore
└── README.md

Requirements:
1. Create `.env.example` with:
   - `LLM_API_KEYS=key_1:gemini/gemini-2.0-flash:YOUR_KEY_1,key_2:gemini/gemini-2.0-flash:YOUR_KEY_2` (or comma-separated keys with clear key_id mapping)
   - `DATABASE_URL=sqlite:////data/app.db`
   - `ALLOWED_ORIGINS=http://localhost:3000,https://*.vercel.app`
   - `ENABLE_FAILURE_SIMULATION=true`
   - `DEFAULT_MODEL=gemini/gemini-2.0-flash`
2. In `backend/app/config.py`, use `pydantic-settings` to parse environment variables with sensible local defaults (e.g. `sqlite:///./app.db` for local non-docker testing).
3. In `backend/app/database.py`, initialize SQLAlchemy with SQLite WAL (Write-Ahead Logging) mode and connection check arguments (`check_same_thread=False`).
4. In `backend/app/models.py`, implement the exact `messages` table specified:
   - `id`: Integer primary key autoincrement
   - `session_id`: String(128), indexed, not null
   - `role`: String(20), not null ('user' or 'assistant')
   - `content`: Text, not null
   - `metadata`: Text (JSON string nullable, for assistant metadata)
   - `created_at`: String(50), not null (ISO-8601 server timestamp)
5. Provide database auto-migration/creation on FastAPI startup.

Output the code for `config.py`, `database.py`, `models.py`, and `.env.example`.
```

---

### Phase 2: FastAPI Backend & LiteLLM Gateway Engine
**Prompt Goal:** Implement the heart of the assignment: LiteLLM caching, key failover, failure simulation, and exact API contracts.

```markdown
Implement the complete backend application logic in `backend/app/` according to the Lyftr AI specification.

Specific Requirements:

1. LiteLLM Gateway (`backend/app/gateway.py`):
   - Configure LiteLLM's built-in in-memory or disk cache (`litellm.enable_cache(type="local")` or `DiskCache`).
   - Implement the Key Pool: Parse `LLM_API_KEYS` into an ordered list: `key_1` (primary), `key_2` (fallback), etc.
   - Implement Failover Loop:
     * Attempt completion with `key_1`.
     * If provider throws RateLimitError (429), AuthenticationError, or 5xx InternalServerError, log the failure, increment `fallback_attempts`, and fail over to `key_2`.
     * If all keys fail, raise an exception that translates to HTTP 503 `{"detail": "all providers unavailable"}`.
   - Implement `X-Simulate-Failure` Handling:
     * Format: `key_1=429`, `key_1=500`, `key_1=429,key_2=500`, `*=429`.
     * Check if `ENABLE_FAILURE_SIMULATION == "true"`. If enabled, intercept the key execution. If the key matches the simulated rule, trigger the simulated error before making the network request, forcing failover.
     * Simulated requests must return a genuine completion from remaining functional keys.
   - Response Caching Detection:
     * Check `response._hidden_params.get("cache_hit")` or LiteLLM's cache indicator.
     * If cache hit: `resolution_source = "LLM_CACHE"`, `key_id = null`, `fallback_attempts = 0`.
     * If live call: `resolution_source = "LIVE_INFERENCE"`, `key_id = <answering_key_id>`, `fallback_attempts = <failed_count>`.
   - Token Tracking:
     * Extract prompt tokens (`input_tokens`) and completion tokens (`output_tokens`) directly from `response.usage`.
     * On cache hit, return the token usage stored with the cached response.
   - Measure `latency_ms` using server-side monotonic timing (`time.perf_counter()`).

2. Endpoints Implementation:
   - `GET /health` (`backend/app/routes/health.py`):
     * Return HTTP 200: `{"status": "ok", "keys_configured": len(keys), "cache_enabled": True}`
     * Verify database connection is alive; return 503 if DB is unreachable.
   - `POST /chat` (`backend/app/routes/chat.py`):
     * Validate request using Pydantic: `session_id` (1-128 chars), `message` (1-4000 chars after strip()). Return 422 if invalid.
     * Query SQLite for chronological conversation history of `session_id`.
     * Build message payload: `[{"role": "system", "content": system_prompt}] + history + [{"role": "user", "content": message}]`.
     * Call LiteLLM gateway with failover and simulation parameters.
     * If successful: Save user message and assistant message + metadata JSON into SQLite within a transaction. Return HTTP 200 with required contract.
     * If failure (422 or 503): Do NOT write user or assistant message to database.
   - `GET /sessions/{session_id}/messages` (`backend/app/routes/sessions.py`):
     * Query all messages for `session_id` ordered by `created_at` ASC.
     * If session has no messages, return HTTP 404 `{"detail": "session not found"}`.
     * Return chronological list excluding any system prompts. Format metadata for assistant messages.

3. Error Handlers & CORS (`backend/app/main.py`):
   - Add standard FastAPI CORS middleware using `ALLOWED_ORIGINS`.
   - Override default RequestValidationError to return clean `{"detail": ...}` JSON without HTML.
   - Global exception handler to guarantee stack traces are never exposed to the client.

Implement clean, typed, modular code for `gateway.py`, `health.py`, `chat.py`, `sessions.py`, and `main.py`.
```

---

### Phase 3: Backend Test Suite & Failover Auditing
**Prompt Goal:** Build an uncompromising test suite verifying every edge case, HTTP status code, and SQLite behavior.

```markdown
Act as a hostile QA engineer. Create a comprehensive Pytest test suite for the FastAPI backend under `backend/tests/`.

Create the following test modules:
1. `conftest.py`:
   - Set environment variables: `ENABLE_FAILURE_SIMULATION=true`, `DATABASE_URL=sqlite:///:memory:`.
   - Provide an async or TestClient fixture with clean database setup per test.
   - Provide mock LLM responses for deterministic offline test runs.

2. `test_health.py`:
   - Verify `GET /health` returns 200 and exact schema `{"status": "ok", "keys_configured": ..., "cache_enabled": true}`.

3. `test_chat.py`:
   - Test empty message -> HTTP 422.
   - Test whitespace-only message -> HTTP 422.
   - Test message > 4000 characters -> HTTP 422.
   - Test invalid/empty session_id -> HTTP 422.
   - Test successful message -> HTTP 200 with all metadata fields (`resolution_source`, `model`, `latency_ms`, `input_tokens`, `output_tokens`, `key_id`, `fallback_attempts`).
   - Test multi-turn conversation: Session remembers previous context in subsequent calls.

4. `test_caching.py`:
   - Send prompt P in session S1 -> Verify `LIVE_INFERENCE`, `key_id == "key_1"`.
   - Send identical prompt P in new session S2 -> Verify `LLM_CACHE`, `key_id == null`, `fallback_attempts == 0`, latency < live latency, identical reply text.
   - Send different prompt P2 -> Verify `LIVE_INFERENCE`.

5. `test_failover.py`:
   - Send `X-Simulate-Failure: key_1=429` -> Verify HTTP 200, `key_id == "key_2"`, `fallback_attempts == 1`.
   - Send `X-Simulate-Failure: key_1=500` -> Verify HTTP 200, `key_id == "key_2"`, `fallback_attempts == 1`.
   - Send `X-Simulate-Failure: *=429` -> Verify HTTP 503 `{"detail": "all providers unavailable"}`.
   - Verify that after HTTP 503, nothing was written to the `messages` table for that session.
   - Send `X-Simulate-Failure: key_1=429` with `ENABLE_FAILURE_SIMULATION=false` -> Verify simulation header is ignored.

6. `test_sessions.py`:
   - Query valid session -> Returns message list in chronological order without system prompt.
   - Query non-existent session -> HTTP 404 `{"detail": "session not found"}`.
   - Verify assistant metadata in history contains `resolution_source`, `input_tokens`, `output_tokens`.

Run `pytest -v` and make sure all tests pass without errors or warnings.
```

---

### Phase 4: React + TypeScript + Tailwind Chat UI
**Prompt Goal:** Build a responsive, clean, professional chatbot frontend that strictly adheres to the `data-testid` contracts.

```markdown
Implement the React frontend under `frontend/` using Vite, TypeScript, and Tailwind CSS.

UI Design Goals:
- Premium, dark/light modern interface inspired by clean engineering tools (e.g. Linear, Vercel).
- Mobile-responsive, fluid layout with smooth auto-scroll to latest messages.
- Clear distinction between User and Assistant chat bubbles.
- Metadata pill/badge displaying latency, token usage, model name, and resolution source.

Mandatory `data-testid` Elements (Must match verbatim):
1. `chat-input`: Text input or textarea for user message (must clear upon sending).
2. `send-button`: Button triggering message submission (disabled while loading or if input is empty).
3. `assistant-message`: Container wrapper for each assistant message.
4. `meta-source`: Inside assistant message container, text must be exactly `LIVE_INFERENCE` or `LLM_CACHE`.
5. `meta-model`: Inside assistant message container, displays model name.
6. `meta-latency`: Inside assistant message container, displays latency (e.g. "812 ms").
7. `meta-input-tokens`: Inside assistant message container, displays integer `input_tokens`.
8. `meta-output-tokens`: Inside assistant message container, displays integer `output_tokens`.
9. `system-prompt-input`: Collapsible or optional input field for setting custom session system prompt.

Functional Requirements:
- On page load, generate a fresh unique session ID (e.g., `s-${crypto.randomUUID().slice(0, 8)}`).
- Client must send ONLY `{ session_id, message, system_prompt }` to `POST /chat`. Never send entire conversation history.
- If backend returns 422 or 503, display a readable, non-crashing error banner in the chat.
- Prevent duplicate submissions while a request is in flight (disable input and button, show loading spinner).
- Support Enter key to send (Shift+Enter for newline).
- Use `VITE_API_URL` environment variable for backend base URL, defaulting to `http://localhost:8000`.

Implement `types.ts`, `api.ts`, `ChatWindow.tsx`, `MessageItem.tsx`, `MetadataBadge.tsx`, and `App.tsx`.
```

---

### Phase 5: Multi-Stage Dockerization & Makefile
**Prompt Goal:** Build production-ready, minimal multi-stage Dockerfiles, Docker Compose with named volume persistence, and a root Makefile.

```markdown
Implement the complete containerization setup for local execution and grading verification.

Requirements:

1. `backend/Dockerfile`:
   - Multi-stage build using `python:3.11-slim`.
   - Build stage: install build dependencies, compile wheels if necessary.
   - Runtime stage: copy installed packages, run as non-root user for security.
   - Expose port 8000. Health check hitting `GET /health`.
   - Start command: `uvicorn app.main:app --host 0.0.0.0 --port 8000`.

2. `frontend/Dockerfile`:
   - Multi-stage build using `node:20-alpine` and `nginx:alpine`.
   - Build stage: install npm dependencies, build Vite production bundle (`npm run build`).
   - Runtime stage: serve static assets via Nginx.
   - Custom `nginx.conf` handling SPA client-side routing (`try_files $uri $uri/ /index.html;`).
   - Expose port 3000.

3. `docker-compose.yml` (Root):
   - Service `backend`:
     * Build context `./backend`.
     * Ports: `8000:8000`.
     * Environment variables passed from root `.env` or defaults.
     * Mount named volume `sqlite_data:/data`.
   - Service `frontend`:
     * Build context `./frontend`.
     * Ports: `3000:3000`.
     * Depends on `backend`.
   - Volumes:
     * `sqlite_data`: named volume for `/data` persistence.

4. `Makefile` (Root):
   - `up`: Build and start containers in the background (`docker compose up --build -d`).
   - `down`: Stop and remove containers (`docker compose down`).
   - `logs`: Tail container logs (`docker compose logs -f`).
   - `test`: Run backend tests inside container or virtualenv (`pytest backend/tests`).

Verify:
- Running `make up` launches backend at `http://localhost:8000` and frontend at `http://localhost:3000`.
- Data stored in SQLite at `/data/app.db` survives `docker compose restart`.
```

---

### Phase 6: Production Cloud Deployment & Persistence Hardening
**Prompt Goal:** Guide deploying frontend to Vercel and backend to Render/Railway/Fly.io with persistent disk and proper CORS.

```markdown
Prepare the project for live public cloud deployment. Both tiers must be publicly reachable and interconnected.

Deployment Strategy:
1. Frontend: Deploy to Vercel (or Netlify / Cloudflare Pages).
   - Set environment variable: `VITE_API_URL=https://your-backend.onrender.com`.
   - Configure rewrite rules in `vercel.json` for SPA routing.

2. Backend: Deploy to Render (or Railway / Fly.io) using Docker.
   - Attach a Persistent Disk mounted at `/data` (e.g. 1GB disk on Render/Railway).
   - Configure Environment Variables:
     * `DATABASE_URL=sqlite:////data/app.db`
     * `LLM_API_KEYS=key_1:...,key_2:...`
     * `ALLOWED_ORIGINS=https://your-frontend.vercel.app,http://localhost:3000`
     * `ENABLE_FAILURE_SIMULATION=true` (MANDATORY on production for evaluator testing)
     * `DEFAULT_MODEL=gemini/gemini-2.0-flash`
   - Health check path: `/health`.

Pre-flight Verification:
- Verify CORS: Make an OPTIONS request from the deployed frontend domain to the backend and ensure `Access-Control-Allow-Origin` matches.
- Verify Persistence: Create a session on the live deployed URL, trigger a deployment restart, and verify message history is preserved.
- Verify Test Hook: Run `curl -H "X-Simulate-Failure: key_1=429"` against the live backend URL and confirm key_2 handles the request.
```

---

### Phase 7: Adversarial Verification & Acceptance Testing
**Prompt Goal:** Subject the application to the exact 10-point evaluation criteria to guarantee zero deductions.

```markdown
Act as the Lyftr AI grading evaluator. Perform an adversarial acceptance audit against the local and deployed systems.

Execute and document the result of the following 10 tests:

1. System Resilience & Failover:
   - Run: `curl -X POST -H "Content-Type: application/json" -H "X-Simulate-Failure: key_1=429" -d '{"session_id":"test-1","message":"Hi"}' http://localhost:8000/chat`
   - Check: HTTP 200, `metadata.key_id == "key_2"`, `metadata.fallback_attempts == 1`.
2. Provider Exhaustion:
   - Run: `curl -X POST -H "Content-Type: application/json" -H "X-Simulate-Failure: *=429" -d '{"session_id":"test-2","message":"Hi"}' http://localhost:8000/chat`
   - Check: HTTP 503, body `{"detail": "all providers unavailable"}`.
3. Database Cleanliness:
   - Check: Ensure no messages were saved for session `test-2` after the 503 failure.
4. Input Validation (422):
   - Send empty message, message with 4001 characters, and missing session_id.
   - Check: HTTP 422 with JSON detail for all three.
5. Caching Accuracy:
   - Send message M in fresh session S_A -> `resolution_source == "LIVE_INFERENCE"`, `key_id == "key_1"`.
   - Send exact message M in fresh session S_B -> `resolution_source == "LLM_CACHE"`, `key_id == null`, `fallback_attempts == 0`, latency < live call.
6. Multi-turn Memory:
   - In session S_C: "My favorite color is Blue".
   - In session S_C: "What is my favorite color?" -> Model correctly responds "Blue".
7. Session Isolation:
   - In session S_D: "What is my favorite color?" -> Model does NOT know the answer.
8. History Endpoint & System Prompt Exclusion:
   - Query `GET /sessions/S_C/messages`.
   - Check: Oldest messages first, assistant metadata present, system prompt omitted.
9. UI data-testid Compliance:
   - Inspect DOM elements on frontend: verify `chat-input`, `send-button`, `assistant-message`, `meta-source`, `meta-model`, `meta-latency`, `meta-input-tokens`, `meta-output-tokens`.
10. Docker Persistence:
    - Run `docker compose down && make up`.
    - Query `GET /sessions/S_C/messages`.
    - Check: History still exists and returns HTTP 200.

Produce a final PASS/FAIL scorecard with evidence logs.
```

---

### Phase 8: Submission Documentation & Demo Video Script
**Prompt Goal:** Generate the required README and write the exact voiceover script for the 2–3 minute submission video.

```markdown
Complete the assignment submission requirements:
1. Write the official `README.md` containing the 6 required sections:
   - 1. Live URLs
   - 2. Run locally: with Docker and without
   - 3. Design decisions: key fallback, caching, SQLite session storage
   - 4. Verification: how to see failover, cache hits and per-message token usage
   - 5. Setup Used: your editor and AI tools
   - 6. Bonus features (if any): what you added beyond the requirements and why
2. Write a timed 2–3 minute presentation script for recording the demo video (Loom / OBS).
```

---

# 4. Exact Technical Contracts & Specifications

## 4.1 REST API Contracts (Endpoints, Payloads & Status Codes)

### 1. `GET /health`
- **Purpose:** Verifies that the service is running, the database is reachable, and API keys are loaded.
- **Status:** `200 OK`
- **Response Body:**
```json
{
  "status": "ok",
  "keys_configured": 2,
  "cache_enabled": true
}
```

### 2. `POST /chat`
- **Purpose:** Primary chat completion endpoint with session tracking, LiteLLM gateway, caching, and failover.
- **Headers:**
  - `Content-Type: application/json`
  - `X-Simulate-Failure: <key_id>=<status>` (Optional test hook)
- **Request Body:**
```json
{
  "session_id": "s-7f3a",
  "message": "What is the capital of France?",
  "system_prompt": "You are a concise geography expert."
}
```
| Field | Type | Constraint | Description |
|---|---|---|---|
| `session_id` | string | Required, 1–128 chars | Client-generated session identifier. New id starts new session. |
| `message` | string | Required, 1–4000 chars | User input (validated after trimming whitespace). |
| `system_prompt` | string | Optional | Overrides session system prompt. |

- **Response `200 OK`:**
```json
{
  "session_id": "s-7f3a",
  "reply": "The capital of France is Paris.",
  "metadata": {
    "resolution_source": "LIVE_INFERENCE",
    "model": "gemini/gemini-2.0-flash",
    "latency_ms": 812,
    "input_tokens": 42,
    "output_tokens": 9,
    "key_id": "key_1",
    "fallback_attempts": 0
  }
}
```

- **Metadata Field Rules:**
  - `resolution_source`: Exactly `"LIVE_INFERENCE"` or `"LLM_CACHE"`.
  - `model`: String identifier of the model used (e.g. `"gemini/gemini-2.0-flash"`).
  - `latency_ms`: Integer, server-side execution duration in milliseconds.
  - `input_tokens`: Integer prompt tokens for this request (system prompt + history + current message).
  - `output_tokens`: Integer completion tokens for this assistant reply.
  - `key_id`: String `"key_1"`, `"key_2"`, etc. On `"LLM_CACHE"`, this **MUST be `null`**. Never leak the actual API key.
  - `fallback_attempts`: Integer count of keys that failed before success. On `"LLM_CACHE"`, this **MUST be `0`**.

### 3. `GET /sessions/{session_id}/messages`
- **Purpose:** Retrieves the full conversation history for a given session.
- **Status:** `200 OK`
- **Response Body:**
```json
{
  "session_id": "s-7f3a",
  "messages": [
    {
      "role": "user",
      "content": "What is the capital of France?"
    },
    {
      "role": "assistant",
      "content": "The capital of France is Paris.",
      "metadata": {
        "resolution_source": "LIVE_INFERENCE",
        "input_tokens": 42,
        "output_tokens": 9
      }
    }
  ]
}
```
- **Constraint:** System prompts must **never** be included in the returned messages array.

### 4. Standard Error Responses
All errors must return a JSON object with a `detail` string or array. Never return HTML or unformatted 500 stack traces.

| Scenario | HTTP Code | Response Body | Storage Action |
|---|---|---|---|
| Empty message, message > 4000 chars, invalid session_id | `422 Unprocessable Entity` | `{"detail": [...]}` | Do not persist |
| All API keys fail (rate limits, 5xx, or simulated failure) | `503 Service Unavailable` | `{"detail": "all providers unavailable"}` | Do not persist |
| Session ID not found in `GET /sessions/{session_id}/messages` | `404 Not Found` | `{"detail": "session not found"}` | N/A |

---

## 4.2 SQLite Database Schema & Concurrency Rules

```sql
CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT NOT NULL,
    role TEXT NOT NULL,           -- 'user' or 'assistant'
    content TEXT NOT NULL,
    metadata TEXT,                -- JSON string for assistant metadata (null for user)
    created_at TEXT NOT NULL      -- Server ISO-8601 timestamp (e.g. 2026-11-21T12:00:00.000Z)
);

CREATE INDEX IF NOT EXISTS idx_messages_session_id ON messages (session_id);
```

### SQLAlchemy Optimization Settings:
- Mount database path from `DATABASE_URL` (e.g. `sqlite:////data/app.db`).
- Set SQLite Pragmas for resilience and concurrency:
  ```python
  @event.listens_for(engine, "connect")
  def set_sqlite_pragma(dbapi_connection, connection_record):
      cursor = dbapi_connection.cursor()
      cursor.execute("PRAGMA journal_mode=WAL")     # Enables concurrent readers & writer
      cursor.execute("PRAGMA synchronous=NORMAL")   # High performance with crash safety
      cursor.close()
  ```

---

## 4.3 LiteLLM Failover Engine & Caching Logic

### Key Pool Architecture:
Parse `LLM_API_KEYS` into a structured list of key configs:
```python
# LLM_API_KEYS format: key_1:model:secret,key_2:model:secret OR comma-separated secrets
keys = [
    {"key_id": "key_1", "model": "gemini/gemini-2.0-flash", "api_key": "..."},
    {"key_id": "key_2", "model": "gemini/gemini-2.0-flash", "api_key": "..."}
]
```

### LiteLLM Caching Setup:
```python
import litellm
from litellm.caching import Cache

# Enable built-in local cache (in-memory or disk)
litellm.cache = Cache(type="local")
```
- **Cache Key Invariant:** Model + complete message payload (`[system] + history + [new_message]`).
- **Cache Hit Verification:**
  ```python
  is_cache_hit = getattr(response, "_hidden_params", {}).get("cache_hit", False)
  if is_cache_hit:
      resolution_source = "LLM_CACHE"
      key_id = None
      fallback_attempts = 0
  else:
      resolution_source = "LIVE_INFERENCE"
  ```

---

## 4.4 `X-Simulate-Failure` Test Hook Engine

The test hook intercepts provider calls **before** hitting external APIs, allowing deterministic testing of error recovery.

```python
def should_simulate_failure(key_id: str, header_value: str | None) -> int | None:
    """
    Parses X-Simulate-Failure header (e.g., 'key_1=429', 'key_1=500,key_2=502', '*=429')
    Returns the HTTP status code to simulate, or None.
    """
    if not header_value or not settings.ENABLE_FAILURE_SIMULATION:
        return None
    
    rules = dict(item.strip().split("=") for item in header_value.split(",") if "=" in item)
    
    if "*" in rules:
        return int(rules["*"])
    if key_id in rules:
        return int(rules[key_id])
    return None
```

---

## 4.5 Frontend Contract & `data-testid` Specifications

| Element | `data-testid` | Type / Content | Condition |
|---|---|---|---|
| User Input Box | `chat-input` | `<textarea>` or `<input>` | Clears immediately on send |
| Submit Button | `send-button` | `<button>` | Disabled during request |
| Assistant Message Box | `assistant-message` | `<div>` | Container for reply + metadata |
| Source Identifier | `meta-source` | `<span>` | Exactly `LIVE_INFERENCE` or `LLM_CACHE` |
| Model Identifier | `meta-model` | `<span>` | Name of model (e.g. `gemini/gemini-2.0-flash`) |
| Latency Display | `meta-latency` | `<span>` | Latency string (e.g. `812 ms`) |
| Input Tokens | `meta-input-tokens`| `<span>` | Integer prompt tokens |
| Output Tokens | `meta-output-tokens`| `<span>` | Integer completion tokens |
| System Prompt Input | `system-prompt-input` | `<input>` | Optional field |

---

# 5. Critical Pitfalls & Implementation Traps

| # | Trap | Why It Happens | Solution |
|---|---|---|---|
| 1 | `key_id` populated on cache hits | Reusing the active key ID variable after a cache return. | Explicitly force `key_id = None` and `fallback_attempts = 0` whenever `resolution_source == "LLM_CACHE"`. |
| 2 | Failed requests stored in database | Writing user message to SQLite before calling the LLM. | Only execute database insertion inside a database transaction **after** LLM completion succeeds. |
| 3 | SQLite database lost on cloud restart | Cloud hosts (Render/Railway) have ephemeral containers by default. | Attach a persistent volume mounted at `/data` and configure `DATABASE_URL=sqlite:////data/app.db`. |
| 4 | Token usage reported as conversation cumulative | Accumulating tokens across multiple turns in state. | LiteLLM returns per-request tokens in `response.usage`. Pass `response.usage.prompt_tokens` directly without adding previous turn tokens. |
| 5 | CORS error on deployed frontend | Backend defaults to `localhost:3000`. | Populate `ALLOWED_ORIGINS` with the production Vercel URL (e.g. `https://your-app.vercel.app`). |
| 6 | Custom dictionary cache used instead of LiteLLM | Candidate creates `cache = {}` in Python. | **Instant deduction.** Must use LiteLLM's native caching mechanism (`litellm.cache`). |
| 7 | Simulation hook returns error inside HTTP 200 | App catches simulated 429 and returns `{ "error": "rate limited" }` with 200 OK. | **Violation.** The remaining valid key must fulfill the request with a genuine answer. Only return 503 if all keys fail. |
| 8 | History includes system prompt | Dumping entire raw LLM message list to `GET /sessions/...`. | Filter out messages where `role == 'system'` before returning history. |

---

# 6. Automated Verification Harness (Copy-Pasteable `curl` Commands)

Run these verification commands against `http://localhost:8000` (or your deployed backend URL).

```bash
#!/usr/bin/env bash
set -e
BASE_URL="http://localhost:8000"

echo "=== 1. Health Check ==="
curl -s "${BASE_URL}/health" | jq .

echo -e "\n=== 2. Normal Live Inference (Turn 1) ==="
curl -s -X POST "${BASE_URL}/chat" \
  -H "Content-Type: application/json" \
  -d '{"session_id": "test-session-1", "message": "What is the capital of Spain?"}' | jq .

echo -e "\n=== 3. Response Caching Hit (Identical message in new session) ==="
curl -s -X POST "${BASE_URL}/chat" \
  -H "Content-Type: application/json" \
  -d '{"session_id": "test-session-2", "message": "What is the capital of Spain?"}' | jq .
# Expectation: resolution_source == "LLM_CACHE", key_id == null, fallback_attempts == 0

echo -e "\n=== 4. Failover Simulation (key_1 returns 429 -> key_2 succeeds) ==="
curl -s -X POST "${BASE_URL}/chat" \
  -H "Content-Type: application/json" \
  -H "X-Simulate-Failure: key_1=429" \
  -d '{"session_id": "test-session-3", "message": "Tell me a 5-word joke."}' | jq .
# Expectation: HTTP 200, key_id == "key_2", fallback_attempts == 1

echo -e "\n=== 5. Complete Provider Exhaustion (*=429 -> HTTP 503) ==="
curl -s -i -X POST "${BASE_URL}/chat" \
  -H "Content-Type: application/json" \
  -H "X-Simulate-Failure: *=429" \
  -d '{"session_id": "test-session-4", "message": "Will fail"}'
# Expectation: HTTP/1.1 503 Service Unavailable, {"detail": "all providers unavailable"}

echo -e "\n=== 6. Verify Session History (System prompt excluded, failed request excluded) ==="
curl -s "${BASE_URL}/sessions/test-session-1/messages" | jq .

echo -e "\n=== 7. Verify 404 on Unknown Session ==="
curl -s -i "${BASE_URL}/sessions/non-existent-session-xyz/messages"
# Expectation: HTTP/1.1 404 Not Found
```

---

# 7. Official README Template (Mandatory 6 Sections)

Save this template as `README.md` in the root of the repository:

```markdown
# Lyftr AI — Resilient LLM Chatbot with Key Failover & Caching

A full-stack, production-grade LLM chatbot built with React, FastAPI, LiteLLM, and SQLite. Features automatic multi-key failover, native response caching, per-request token metrics, and containerized volume persistence.

## 1. Live URLs
- **Frontend App:** [https://lyftr-chat.vercel.app](https://lyftr-chat.vercel.app)
- **Backend API:** [https://lyftr-backend.onrender.com](https://lyftr-backend.onrender.com)
- **Health Check:** [https://lyftr-backend.onrender.com/health](https://lyftr-backend.onrender.com/health)

## 2. Run Locally

### With Docker (Recommended)
```bash
# 1. Clone repo and copy environment config
cp .env.example .env
# Edit .env with your LLM API keys

# 2. Start all services
make up

# 3. Access applications
# Frontend: http://localhost:3000
# Backend:  http://localhost:8000/health

# 4. Stop services
make down
```

### Without Docker
```bash
# Backend
cd backend
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000

# Frontend
cd frontend
npm install
npm run dev
```

## 3. Design Decisions
- **Key Fallback Engine:** LiteLLM is configured with an ordered key pool (`key_1`, `key_2`). When a 429, quota error, or 5xx occurs, the gateway catches the exception, increments `fallback_attempts`, and switches immediately to the next configured key.
- **Response Caching:** Built on LiteLLM's native cache (`litellm.cache`). Cache keys are hashed across model name and the full message array. On cache hits, response latency drops to < 50ms, `key_id` is nulled, and original token counts are reported.
- **SQLite Session Storage:** Persisted in `/data/app.db` with SQLite Write-Ahead Logging (WAL) enabled for high concurrent read/write throughput. Failed requests (422/503) are never committed to the database.

## 4. Verification
- **Failover:** Trigger failover using the test header:
  `curl -H "X-Simulate-Failure: key_1=429" -X POST .../chat` -> Returns HTTP 200 answered by `key_2`.
- **Cache Hit:** Sending the same first prompt in two separate sessions returns `resolution_source: "LLM_CACHE"` on the second call.
- **Token Usage:** Every response returns exact `input_tokens` and `output_tokens` extracted from LiteLLM usage metadata.

## 5. Setup Used
- **Editor:** VS Code & Terminal
- **AI Coding Assistants:** Antigravity / Claude Code (used for architecture planning and test suite generation)

## 6. Bonus Features
- **SQLite WAL Mode & Connection Pooling:** Optimized database concurrency to prevent locking during rapid multi-turn chats.
- **Real-Time Latency & Metadata HUD:** Custom badge UI displaying live vs cached status, response latency, and token breakdown with accessible indicators.
- **Interactive Failover Simulation Toggle:** In-app developer panel to test key failover directly from the UI without manual curl commands.
```

---

# 8. 2–3 Minute Video Presentation Storyboard & Script

Use this exact script for recording your demo video (Loom, OBS, or ScreenFlow):

| Timestamp | Visual Screen | Voiceover Script |
|---|---|---|
| **0:00 – 0:30** | Browser displaying Deployed Frontend & Backend `/health` | "Hi, I'm Aman. This is my submission for the Lyftr AI Full-Stack Assignment. We're looking at the live frontend deployed on Vercel and our FastAPI backend on Render. Checking the `/health` endpoint, we see status ok, 2 API keys configured, and caching enabled." |
| **0:30 – 1:00** | Frontend Chat UI — First Prompt Submission | "Let's test normal inference. I'll send: 'What is the capital of France?'. The bot responds immediately. In the metadata pill below the message, we see `resolution_source: LIVE_INFERENCE`, model name, latency around 800ms, and exact input and output token counts for this request." |
| **1:00 – 1:30** | Open new Incognito Window (New Session) -> Same Prompt | "Now to demonstrate LiteLLM caching. I've refreshed to generate a brand new session ID, and I'll send the identical question. Notice the metadata immediately: `resolution_source` is now `LLM_CACHE`, latency dropped to under 40ms, `key_id` is null, and token counts mirror the original generation." |
| **1:30 – 2:00** | Terminal / Postman executing `X-Simulate-Failure: key_1=429` | "Now let's demonstrate our resilience and key failover. Using the `X-Simulate-Failure` header, I simulate key_1 returning HTTP 429. As you can see, the request completes with HTTP 200, `key_id` automatically failed over to `key_2`, and `fallback_attempts` is 1. If we simulate `*=429`, the app cleanly returns a 503 service unavailable without crashing, and nothing is persisted." |
| **2:00 – 2:30** | VS Code / Docker Compose & SQLite verification | "Under the hood, SQLite stores history in `/data/app.db` via a named Docker volume, surviving restarts. The whole stack spins up locally with a single `make up` command using multi-stage Dockerfiles. All requirements and contracts are 100% met." |
