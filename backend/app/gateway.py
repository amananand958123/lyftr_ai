"""
The LLM gateway: sends a chat to the first API key that works.

How it works:
  1. Loop over the keys in order (key_1, key_2, ...).
  2. Try calling the model with that key.
  3. If it fails (rate limit, server error, anything), move on to the next key.
  4. If every key fails, raise AllProvidersUnavailableException (the route turns it into HTTP 503).

LiteLLM's in-memory cache sits in front of this, so asking the exact same
conversation twice returns the saved answer instead of calling the provider.
"""
import logging
import time
from dataclasses import dataclass
from typing import Any, Dict, Iterator, List, Optional, Tuple

import litellm

litellm.suppress_debug_info = True  # hide LiteLLM's "Provider List" banner in logs

from app.config import settings

logger = logging.getLogger("lyftr.gateway")

LAST_GATEWAY_ERRORS: List[Dict[str, Any]] = []

# Turn on LiteLLM's built-in in-memory cache once, when the app starts.
litellm.enable_cache(type="local", max_messages=None)

MOCK_REPLY = (
    "This is an automated response from Lyftr AI Assistant. "
    "The system architecture incorporates key failover, response caching, and SQLite persistence."
)


class NonRetryableProviderError(Exception):
    """Client-induced deterministic error (e.g. context length exceeded, bad request). Not eligible for failover."""


class AllProvidersUnavailableException(Exception):
    """Every key in the pool failed."""


def sync_cache_keys(
    model: str,
    messages: List[Dict[str, str]],
    temperature: Optional[float] = None,
    max_tokens: Optional[int] = None,
):
    """
    Ensure cached replies are shared between /chat (sync) and /chat/stream (streaming).
    LiteLLM hashes kwargs into cache keys in insertion order, so parameters must be passed
    in consistent order with stream=True appended at the end.
    """
    if not litellm.cache or not getattr(litellm.cache, "cache", None):
        return
    try:
        req_sync: Dict[str, Any] = {"model": model, "messages": messages}
        if temperature is not None:
            req_sync["temperature"] = temperature
        if max_tokens is not None:
            req_sync["max_tokens"] = max_tokens

        req_stream = dict(req_sync)
        req_stream["stream"] = True

        k_sync = litellm.cache.get_cache_key(**req_sync)
        k_stream = litellm.cache.get_cache_key(**req_stream)
        sync_val = litellm.cache.cache.get_cache(k_sync)
        stream_val = litellm.cache.cache.get_cache(k_stream)
        if sync_val and not stream_val:
            litellm.cache.cache.set_cache(k_stream, sync_val)
        elif stream_val and not sync_val:
            litellm.cache.cache.set_cache(k_sync, stream_val)
    except Exception as e:
        logger.debug(f"Failed to sync cache keys: {e}")


def is_failover_eligible(error: Exception) -> bool:
    """
    True only for transient provider failures (rate limits, 5xx errors, timeouts, network drops).
    Deterministic client errors like 400 Bad Request or ContextWindowExceeded should not fail over.
    """
    if isinstance(error, (litellm.exceptions.ContextWindowExceededError,)):
        return False
    status_code = getattr(error, "status_code", None)
    if status_code == 400:
        return False
    return True


@dataclass
class GatewayResult:
    reply: str
    resolution_source: str  # "LIVE_INFERENCE" or "LLM_CACHE"
    model: str
    latency_ms: int
    input_tokens: int
    output_tokens: int
    key_id: Optional[str]  # None when the answer came from the cache
    fallback_attempts: int  # how many keys failed before we got an answer


def is_placeholder_key(api_key: str) -> bool:
    """True for dummy keys like 'placeholder_key_1' used in tests and local dev."""
    return not api_key or api_key.startswith("placeholder") or api_key.startswith("YOUR_")


def parse_simulate_failure_header(header: Optional[str]) -> Dict[str, int]:
    """
    Turns the X-Simulate-Failure header into a dict.
      'key_1=429,key_2=500' -> {'key_1': 429, 'key_2': 500}
      '*=429'               -> {'*': 429}   (fail every key)
    """
    if not header or not settings.ENABLE_FAILURE_SIMULATION:
        return {}

    rules = {}
    for part in header.split(","):
        if "=" not in part:
            continue
        key_id, status_code = part.split("=", 1)
        if status_code.strip().isdigit():
            rules[key_id.strip()] = int(status_code.strip())
    return rules


def build_request(key, messages, simulated_failures, temperature, max_tokens, skip_cache=False) -> dict:
    """The arguments for litellm.completion() for one key."""
    request = {
        "model": key["model"],
        "messages": messages,
        # Skip the cache while simulating (so we really test the backup key)
        # and on "regenerate" (otherwise the user just gets the same saved answer back).
        "caching": not simulated_failures and not skip_cache,
        "timeout": 30.0,
    }
    if temperature is not None:
        request["temperature"] = temperature
    if max_tokens is not None:
        request["max_tokens"] = max_tokens

    if is_placeholder_key(key["api_key"]):
        # No real key configured: LiteLLM returns this fake reply without any network call.
        request["mock_response"] = MOCK_REPLY
    else:
        request["api_key"] = key["api_key"]
    return request


def iter_candidate_keys(
    messages: List[Dict[str, str]],
    simulate_header: Optional[str] = None,
    temperature: Optional[float] = None,
    max_tokens: Optional[int] = None,
    skip_cache: bool = False,
) -> Iterator[Tuple[dict, dict, int, float]]:
    """
    Shared key rotation loop for both complete_chat and open_stream.
    Yields (key, request_dict, current_failed_attempts, start_time).
    """
    key_pool = settings.get_key_pool()
    simulated_failures = parse_simulate_failure_header(simulate_header)
    failed_attempts = 0
    start_time = time.perf_counter()

    for key in key_pool:
        key_id = key["key_id"]
        if "*" in simulated_failures or key_id in simulated_failures:
            logger.warning(f"Simulating failure for {key_id}")
            failed_attempts += 1
            continue

        request = build_request(key, messages, simulated_failures, temperature, max_tokens, skip_cache)
        yield key, request, failed_attempts, start_time
        failed_attempts += 1


def complete_chat(
    messages: List[Dict[str, str]],
    simulate_header: Optional[str] = None,
    temperature: Optional[float] = None,
    max_tokens: Optional[int] = None,
    skip_cache: bool = False,
) -> GatewayResult:
    # Ensure cache keys are synchronized between sync and streaming endpoints
    if not skip_cache and not simulate_header:
        for key in settings.get_key_pool():
            sync_cache_keys(key["model"], messages, temperature, max_tokens)

    for key, request, failed_attempts, start_time in iter_candidate_keys(
        messages, simulate_header, temperature, max_tokens, skip_cache
    ):
        key_id = key["key_id"]
        try:
            logger.info(f"Calling {key['model']} with {key_id}")
            response = litellm.completion(**request)
            if not skip_cache and not simulate_header:
                sync_cache_keys(key["model"], messages, temperature, max_tokens)
        except Exception as error:
            LAST_GATEWAY_ERRORS.append({
                "time": time.time(),
                "key_id": key_id,
                "model": key["model"],
                "error_type": type(error).__name__,
                "error": str(error)[:300],
            })
            if len(LAST_GATEWAY_ERRORS) > 50:
                LAST_GATEWAY_ERRORS.pop(0)
            if not is_failover_eligible(error):
                logger.warning(f"{key_id} received non-retryable client error: {error}. Not failing over.")
                raise NonRetryableProviderError(f"Provider rejected request: {error}")
            logger.error(f"{key_id} failed: {error}. Trying the next key.")
            continue

        latency_ms = max(1, int((time.perf_counter() - start_time) * 1000))
        reply = response.choices[0].message.content or ""
        hidden_params = getattr(response, "_hidden_params", None) or {}
        from_cache = hidden_params.get("cache_hit") is True

        # Some providers (and the mock) report 0 tokens, so fall back to a rough word count.
        usage = getattr(response, "usage", None)
        input_tokens = getattr(usage, "prompt_tokens", 0) or count_words(messages) + 10
        output_tokens = getattr(usage, "completion_tokens", 0) or len(reply.split()) + 5

        return GatewayResult(
            reply=reply,
            resolution_source="LLM_CACHE" if from_cache else "LIVE_INFERENCE",
            model=key["model"],
            latency_ms=latency_ms,
            input_tokens=input_tokens,
            output_tokens=output_tokens,
            key_id=None if from_cache else key_id,
            fallback_attempts=0 if from_cache else failed_attempts,
        )

    logger.error("All keys failed.")
    raise AllProvidersUnavailableException("all providers unavailable")


@dataclass
class OpenStream:
    """A live reply stream from the first key that worked."""
    key_id: str
    model: str
    stream: Iterator  # the remaining chunks
    first_chunk: object
    fallback_attempts: int
    start_time: float
    temperature: Optional[float] = None
    max_tokens: Optional[int] = None

    @property
    def from_cache(self) -> bool:
        hidden_params = getattr(self.stream, "_hidden_params", None) or {}
        return hidden_params.get("cache_hit") is True


def open_stream(
    messages: List[Dict[str, str]],
    simulate_header: Optional[str] = None,
    temperature: Optional[float] = None,
    max_tokens: Optional[int] = None,
    skip_cache: bool = False,
) -> OpenStream:
    """
    Same failover as complete_chat, but for streaming.
    We wait for the FIRST chunk before picking a key: errors like 429 show up there,
    and once text has reached the user we can't switch to another key anymore.
    """
    if not skip_cache and not simulate_header:
        for key in settings.get_key_pool():
            sync_cache_keys(key["model"], messages, temperature, max_tokens)

    for key, request, failed_attempts, start_time in iter_candidate_keys(
        messages, simulate_header, temperature, max_tokens, skip_cache
    ):
        key_id = key["key_id"]
        request["stream"] = True
        try:
            logger.info(f"Streaming {key['model']} with {key_id}")
            stream = litellm.completion(**request)
            first_chunk = next(stream)
        except Exception as error:
            LAST_GATEWAY_ERRORS.append({
                "time": time.time(),
                "key_id": key_id,
                "model": key["model"],
                "error_type": type(error).__name__,
                "error": str(error)[:300],
            })
            if len(LAST_GATEWAY_ERRORS) > 50:
                LAST_GATEWAY_ERRORS.pop(0)
            if not is_failover_eligible(error):
                logger.warning(f"{key_id} received non-retryable client error: {error}. Not failing over.")
                raise NonRetryableProviderError(f"Provider rejected request: {error}")
            logger.error(f"{key_id} failed: {error}. Trying the next key.")
            continue

        return OpenStream(key_id, key["model"], stream, first_chunk, failed_attempts, start_time, temperature, max_tokens)

    logger.error("All keys failed.")
    raise AllProvidersUnavailableException("all providers unavailable")


def count_words(messages: List[Dict[str, str]]) -> int:
    return sum(len(m.get("content", "").split()) for m in messages)
