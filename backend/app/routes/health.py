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
def get_deep_health(db: Session = Depends(get_db)):
    """
    Lists every key in the pool and whether it is configured.
    Note: this checks the config only, it does not call the providers.
    """
    check_database(db)

    providers = []
    for key in settings.get_key_pool():
        is_mock = is_placeholder_key(key.get("api_key", ""))
        is_configured = bool(key.get("api_key")) and not is_mock
        status_label = "healthy" if is_configured else ("mock" if is_mock else "unconfigured")
        providers.append(DeepProviderHealth(
            key_id=key["key_id"],
            model=key["model"],
            status=status_label,
        ))

    healthy_count = sum(1 for p in providers if p.status in ("healthy", "mock"))
    real_healthy_count = sum(1 for p in providers if p.status == "healthy")
    if healthy_count == 0:
        raise HTTPException(status_code=503, detail="no healthy providers available")

    return DeepHealthResponse(
        status="ok" if real_healthy_count > 0 else "degraded",
        total_keys=len(providers),
        healthy_keys=healthy_count,
        providers=providers,
    )
