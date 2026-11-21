# Lyftr AI Demo Video — 2 to 3 Minute Screen Recording Script

> **Assignment Deliverable:** A 2–3 minute screen recording with your voice, showing the deployed app and all endpoints working, including a cache hit and failover with `X-Simulate-Failure`.

---

## Pre-Recording Setup Checklist
- [ ] Browser window 1: Deployed Frontend App (`http://localhost:3000` or Vercel URL).
- [ ] Browser window 2: Deployed Backend Health (`http://localhost:8000/health` or Render URL).
- [ ] Terminal window: Ready with `scripts/verify_adversarial.py` or curl commands.
- [ ] Screen recorder (Loom, OBS, or ScreenFlow) testing microphone input.

---

## Timed Script & Storyboard

### Segment 1: Introduction & Architecture (0:00 – 0:35)
- **Screen:** Show the React Chat UI side-by-side with the `/health` endpoint tab.
- **Voiceover:**
  > "Hi, I'm Aman. This is my submission for the Lyftr AI Full-Stack Assignment: a resilient, production-ready LLM chatbot with automatic key failover and response caching.
  > On the right, our FastAPI `/health` endpoint shows `status: 'ok'`, 2 API keys loaded in our priority pool, and LiteLLM's local cache enabled.
  > On the left is our React and TypeScript frontend, configured with a dynamic session ID, responsive metadata badges, and full `data-testid` attribute compliance."

---

### Segment 2: Live Inference & Per-Request Token Tracking (0:35 – 1:10)
- **Screen:** In the Chat UI, submit: *"What is the capital of France?"*
- **Voiceover:**
  > "Let's send our first query: 'What is the capital of France?'.
  > The assistant responds instantly. Looking at the metadata badge below the message:
  > - **Resolution source** is `LIVE_INFERENCE`.
  > - **Model** is `gemini/gemini-2.0-flash`.
  > - **Latency** was measured server-side at under 100 milliseconds.
  > - And most importantly, **input tokens** and **output tokens** are tracked strictly for this completion request, not a cumulative conversation running total."

---

### Segment 3: Response Caching Accuracy Demonstration (1:10 – 1:40)
- **Screen:** Click the **"New Session"** button in the header (or open a fresh incognito tab), and send the exact same prompt: *"What is the capital of France?"*
- **Voiceover:**
  > "Now let's demonstrate LiteLLM's native response caching.
  > I'll click 'New Session' to generate a brand new session ID, ensuring clean session isolation.
  > Now I'll send the exact same question.
  > Notice the metadata immediately:
  > - The resolution source has switched to `LLM_CACHE`.
  > - `key_id` is automatically set to `null` as required by the specification.
  > - `fallback_attempts` is 0.
  > - The latency dropped to under 1 millisecond.
  > - And the reply text and token metrics identically mirror the original generation."

---

### Segment 4: Automatic Key Failover & Resilience (1:40 – 2:20)
- **Screen:** Use the interactive **Evaluator Test Bar** at the top of the UI to select `key_1=429`, or run the curl command in terminal:
  ```bash
  curl -X POST http://localhost:8000/chat \
    -H "X-Simulate-Failure: key_1=429" \
    -d '{"session_id": "demo-failover", "message": "Explain quantum computing in one sentence."}'
  ```
- **Voiceover:**
  > "Now let's test system resilience and key failover using the `X-Simulate-Failure` test hook.
  > When I activate `key_1=429`, our LiteLLM gateway simulates an HTTP 429 rate limit on our primary key before invoking the provider.
  > Looking at the response metadata:
  > - The request still succeeds with an HTTP 200 and a genuine completion.
  > - The answering key is now `key_2`.
  > - `fallback_attempts` reports 1.
  > If we simulate all keys failing with `*=429`, the system cleanly returns an HTTP 503 `all providers unavailable` without crashing, and verifies that failed interactions are never saved to the SQLite conversation history."

---

### Segment 5: Docker Containerization & Wrap-Up (2:20 – 2:45)
- **Screen:** Show terminal with `docker-compose.yml` and run `make test`.
- **Voiceover:**
  > "Under the hood, all session history is persisted in SQLite at `/data/app.db` via a named Docker volume, surviving container restarts.
  > The whole application starts up locally with a single `make up` command using multi-stage Dockerfiles for minimal production images, and all 19 automated Pytest and frontend contract tests pass with 100% compliance.
  > Thank you for reviewing my Lyftr AI submission!"
