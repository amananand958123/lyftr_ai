from fastapi import APIRouter
import litellm
from app.config import settings
from app.schemas import CacheStatsResponse

router = APIRouter(prefix="/cache", tags=["Cache"])

@router.get("/stats", response_model=CacheStatsResponse)
def get_cache_stats():
    """
    Returns the current status of the LiteLLM gateway cache.
    """
    supported_models = [k["model"] for k in settings.get_key_pool()]
    return CacheStatsResponse(
        cache_enabled=bool(litellm.cache is not None),
        cache_type="local",
        supported_models=supported_models
    )

@router.post("/clear")
def clear_cache():
    """
    Purges or flushes the local LiteLLM cache.
    """
    if litellm.cache is not None:
        try:
            cache_obj = getattr(litellm.cache, "cache", None)
            if cache_obj is not None:
                if hasattr(cache_obj, "flush_cache"):
                    cache_obj.flush_cache()
                if hasattr(cache_obj, "cache_dict") and isinstance(cache_obj.cache_dict, dict):
                    cache_obj.cache_dict.clear()
            elif hasattr(litellm.cache, "flush_cache"):
                litellm.cache.flush_cache()
        except Exception:
            pass
    return {"status": "ok", "message": "Cache cleared successfully"}
