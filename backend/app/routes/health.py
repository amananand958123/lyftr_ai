import time
import litellm
from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.gateway import is_placeholder_key
from app.schemas import DeepHealthResponse, DeepProviderHealth, HealthResponse

router = APIRouter(tags=["Health"])


def check_database(db: Session):
    try:
        db.execute(text("SELECT 1"))
    except Exception:
        raise HTTPException(status_code=503, detail="database unreachable")


@router.get("/health", response_model=HealthResponse)
def get_health(response: Response, db: Session = Depends(get_db)):
    """200 once the app is up, the database answers, and the key pool is loaded."""
    # Stop browsers (Safari especially) from caching a cold-start response.
    response.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"

    check_database(db)
    return HealthResponse(
        status="ok",
        keys_configured=len(settings.get_key_pool()),
        cache_enabled=litellm.cache is not None,
    )


@router.get("/health/deep", response_model=DeepHealthResponse)
def get_deep_health(probe: bool = False, db: Session = Depends(get_db)):
    """
    Lists every key in the pool and whether it is configured.
    If probe=True, tests each configured key with a minimal completion to verify real connectivity.
    """
    check_database(db)

    providers = []
    for key in settings.get_key_pool():
        raw_key = key.get("api_key", "")
        is_mock = is_placeholder_key(raw_key)
        is_configured = bool(raw_key) and not is_mock
        key_preview = (raw_key[:7] + "..." + raw_key[-4:]) if len(raw_key) > 11 else ("mock" if is_mock else "none")

        status_label = "healthy" if is_configured else ("mock" if is_mock else "unconfigured")
        error_msg = None
        latency = None

        if probe and is_configured:
            start = time.perf_counter()
            try:
                litellm.completion(
                    model=key["model"],
                    messages=[{"role": "user", "content": "hi"}],
                    api_key=raw_key,
                    max_tokens=2,
                    timeout=8.0,
                )
                latency = max(1, int((time.perf_counter() - start) * 1000))
                status_label = "healthy"
            except Exception as e:
                status_label = "error"
                error_msg = f"{type(e).__name__}: {str(e)[:180]}"

        providers.append(
            DeepProviderHealth(
                key_id=key["key_id"],
                model=key["model"],
                status=status_label,
                latency_ms=latency,
                error=error_msg,
                key_preview=key_preview,
            )
        )

    healthy_count = sum(1 for p in providers if p.status in ("healthy", "mock"))
    real_healthy_count = sum(1 for p in providers if p.status == "healthy")
    if healthy_count == 0:
        raise HTTPException(status_code=503, detail="no healthy providers available")

    return DeepHealthResponse(
        status="ok" if (real_healthy_count > 0 or not probe) else ("ok" if healthy_count > 0 else "degraded"),
        total_keys=len(providers),
        healthy_keys=healthy_count,
        providers=providers,
    )
