import logging
import time
import uuid
from collections import defaultdict
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.types import ASGIApp, Receive, Scope, Send

from app.config import settings
from app.database import init_db
from app.routes import cache, chat, health, sessions

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("lyftr.api")

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Initialize SQLite database and tables on startup
    init_db()
    yield

app = FastAPI(
    title="Lyftr AI — Resilient LLM Chatbot API",
    version="1.0.0",
    lifespan=lifespan,
)

# Lightweight pure ASGI middleware for Request-ID, security headers, and request logging without buffering SSE
class RequestContextMiddleware:
    def __init__(self, app: ASGIApp):
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send):
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        headers = dict(scope.get("headers", []))
        req_id = headers.get(b"x-request-id", b"").decode("utf-8") or str(uuid.uuid4())
        method = scope.get("method", "")
        path = scope.get("path", "")
        logger.info(f"[{req_id}] {method} {path}")

        async def send_wrapper(message):
            if message["type"] == "http.response.start":
                resp_headers = list(message.get("headers", []))
                resp_headers.append((b"x-request-id", req_id.encode("utf-8")))
                resp_headers.append((b"x-content-type-options", b"nosniff"))
                resp_headers.append((b"x-frame-options", b"DENY"))
                resp_headers.append((b"referrer-policy", b"strict-origin-when-cross-origin"))
                message["headers"] = resp_headers
            await send(message)

        await self.app(scope, receive, send_wrapper)

app.add_middleware(RequestContextMiddleware)

# In-memory sliding window rate limiter: 120 reqs/min per client IP with reverse-proxy support (Item 10)
class RateLimitMiddleware:
    def __init__(self, app: ASGIApp, max_requests: int = 120, window_seconds: int = 60):
        self.app = app
        self.max_requests = max_requests
        self.window_seconds = window_seconds
        self.client_hits: dict[str, list[float]] = defaultdict(list)
        self._request_counter = 0

    async def __call__(self, scope: Scope, receive: Receive, send: Send):
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        path = scope.get("path", "")
        # Don't rate limit health checks, docs, or schema
        if path in ("/health", "/health/deep", "/docs", "/openapi.json", "/favicon.ico"):
            await self.app(scope, receive, send)
            return

        # Extract client IP respecting reverse proxies (X-Forwarded-For)
        headers = dict(scope.get("headers", []))
        forwarded_for = headers.get(b"x-forwarded-for", b"").decode("utf-8")
        if forwarded_for:
            client_ip = forwarded_for.split(",")[0].strip()
        else:
            client = scope.get("client")
            client_ip = client[0] if client else "unknown"

        now = time.time()
        window_start = now - self.window_seconds

        # Periodically prune stale IP buckets to prevent memory leak
        self._request_counter += 1
        if self._request_counter >= 100:
            self._request_counter = 0
            stale_keys = [k for k, timestamps in self.client_hits.items() if not timestamps or timestamps[-1] <= window_start]
            for k in stale_keys:
                del self.client_hits[k]

        # Prune older entries for current client
        hits = [t for t in self.client_hits[client_ip] if t > window_start]
        if len(hits) >= self.max_requests:
            logger.warning(f"Rate limit exceeded for client {client_ip}")
            response = JSONResponse(
                status_code=429,
                content={"detail": "Too many requests. Rate limit is 120 requests per minute."},
                headers={"Retry-After": str(self.window_seconds)},
            )
            await response(scope, receive, send)
            return

        hits.append(now)
        self.client_hits[client_ip] = hits
        await self.app(scope, receive, send)

app.add_middleware(RateLimitMiddleware)

# CORS Middleware (Strict explicit domain control - Item 4)
explicit_origins = {
    "http://localhost:5173",
    "http://localhost:3000",
    "http://127.0.0.1:5173",
    "http://127.0.0.1:3000",
    "http://0.0.0.0:5173",
    "http://0.0.0.0:3000",
    "https://lyftr-ai-xi.vercel.app",
    "https://lyftr-chat.vercel.app",
}
for origin in settings.get_cors_origins():
    if origin and origin.strip():
        explicit_origins.add(origin.strip())

app.add_middleware(
    CORSMiddleware,
    allow_origins=list(explicit_origins),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(health.router)
app.include_router(chat.router)
app.include_router(sessions.router)
app.include_router(cache.router)
