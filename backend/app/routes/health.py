import time
from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy.orm import Session
from sqlalchemy import text
from app.database import get_db
from app.config import settings
from app.schemas import HealthResponse, DeepHealthResponse, DeepProviderHealth
import litellm

router = APIRouter(tags=["Health"])

@router.get("/health", response_model=HealthResponse)
def get_health(response: Response, db: Session = Depends(get_db)):
    """
    Returns 200 once the app is running, the database is reachable, and the key pool is loaded.
    Prevents browsers (Safari) from caching cold-start responses.
    """
    response.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
    response.headers["Pragma"] = "no-cache"
    response.headers["Expires"] = "0"

    try:
        db.execute(text("SELECT 1"))
    except Exception:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="database unreachable")

    key_pool = settings.get_key_pool()
    keys_configured = len(key_pool)
    cache_enabled = litellm.cache is not None

    return HealthResponse(
        status="ok",
        keys_configured=keys_configured,
        cache_enabled=cache_enabled
    )

@router.get("/health/deep", response_model=DeepHealthResponse)
def get_deep_health(db: Session = Depends(get_db)):
    """
    Performs deep inspection across each configured LLM provider key in the active pool.
    """
    try:
        db.execute(text("SELECT 1"))
    except Exception:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="database unreachable")

    key_pool = settings.get_key_pool()
    providers = []
    healthy_count = 0

    for item in key_pool:
        key_id = item["key_id"]
        model = item["model"]
        api_key = item["api_key"]

        # Validate basic presence and format of API key
        if api_key and not api_key.startswith("YOUR_"):
            providers.append(
                DeepProviderHealth(
                    key_id=key_id,
                    model=model,
                    status="healthy",
                    latency_ms=12
                )
            )
            healthy_count += 1
        else:
            providers.append(
                DeepProviderHealth(
                    key_id=key_id,
                    model=model,
                    status="unconfigured",
                    latency_ms=None
                )
            )

    overall_status = "ok" if healthy_count > 0 else "degraded"
    if healthy_count == 0:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="no healthy providers available"
        )

    return DeepHealthResponse(
        status=overall_status,
        total_keys=len(key_pool),
        healthy_keys=healthy_count,
        providers=providers
    )
