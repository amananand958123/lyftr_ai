from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import text
from app.database import get_db
from app.config import settings
from app.schemas import HealthResponse
import litellm

router = APIRouter(tags=["Health"])

@router.get("/health", response_model=HealthResponse)
def get_health(db: Session = Depends(get_db)):
    """
    Returns 200 once the app is running, the database is reachable, and the key pool is loaded.
    """
    # 1. Verify database connectivity
    try:
        db.execute(text("SELECT 1"))
    except Exception as exc:
        raise HTTPException(status_code=503, detail="database unreachable")

    # 2. Count configured keys
    key_pool = settings.get_key_pool()
    keys_configured = len(key_pool)

    # 3. Check LiteLLM cache status
    cache_enabled = litellm.cache is not None

    return HealthResponse(
        status="ok",
        keys_configured=keys_configured,
        cache_enabled=cache_enabled
    )
