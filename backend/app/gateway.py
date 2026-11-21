import time
import logging
from typing import List, Dict, Any, Optional
import litellm
from litellm.caching.caching import Cache
from app.config import settings

logger = logging.getLogger("lyftr.gateway")
logging.basicConfig(level=logging.INFO)

# Enable LiteLLM built-in local cache (in-memory)
try:
    litellm.enable_cache(type="local")
    logger.info("LiteLLM built-in local cache enabled successfully.")
except Exception as e:
    logger.error(f"Failed to enable LiteLLM cache: {e}")

class AllProvidersUnavailableException(Exception):
    """Raised when all configured LLM providers fail or are simulated to fail."""
    pass

class GatewayResult:
    def __init__(
        self,
        reply: str,
        resolution_source: str,
        model: str,
        latency_ms: int,
        input_tokens: int,
        output_tokens: int,
        key_id: Optional[str],
        fallback_attempts: int
    ):
        self.reply = reply
        self.resolution_source = resolution_source
        self.model = model
        self.latency_ms = latency_ms
        self.input_tokens = input_tokens
        self.output_tokens = output_tokens
        self.key_id = key_id
        self.fallback_attempts = fallback_attempts

def parse_simulate_failure_header(header: Optional[str]) -> Dict[str, int]:
    """
    Parses X-Simulate-Failure header into a dictionary.
    Example: 'key_1=429,key_2=500' -> {'key_1': 429, 'key_2': 500}
    Example: '*=429' -> {'*': 429}
    """
    if not header or not settings.ENABLE_FAILURE_SIMULATION:
        return {}
    rules = {}
    for part in header.split(","):
        part = part.strip()
        if "=" in part:
            k, v = part.split("=", 1)
            try:
                rules[k.strip()] = int(v.strip())
            except ValueError:
                pass
    return rules

def complete_chat(
    messages: List[Dict[str, str]],
    simulate_header: Optional[str] = None
) -> GatewayResult:
    """
    Executes a chat completion through LiteLLM with response caching and key failover.
    """
    key_pool = settings.get_key_pool()
    if not key_pool:
        raise AllProvidersUnavailableException("No LLM API keys configured.")

    simulation_rules = parse_simulate_failure_header(simulate_header)
    logger.info(f"Initiating completion across key pool ({len(key_pool)} keys). Simulation rules: {simulation_rules}")

    fallback_attempts = 0
    start_time = time.perf_counter()

    for idx, key_info in enumerate(key_pool):
        key_id = key_info["key_id"]
        model = key_info["model"]
        api_key = key_info["api_key"]

        # Check for simulated failure
        simulated_status = None
        if "*" in simulation_rules:
            simulated_status = simulation_rules["*"]
        elif key_id in simulation_rules:
            simulated_status = simulation_rules[key_id]

        if simulated_status is not None:
            logger.warning(f"Simulating failure for {key_id}: HTTP {simulated_status}")
            fallback_attempts += 1
            continue

        try:
            # Bypass cache during failure simulation to ensure failover to key_2 is tested live
            use_caching = not bool(simulation_rules)
            kwargs = {
                "model": model,
                "messages": messages,
                "caching": use_caching,
            }
            # Only pass api_key if not a dummy/mock placeholder
            if api_key and not api_key.startswith("placeholder") and not api_key.startswith("YOUR_"):
                kwargs["api_key"] = api_key
            else:
                # If key is placeholder, use mock_response to allow testing without live API keys
                kwargs["mock_response"] = (
                    "This is an automated response from Lyftr AI Assistant. "
                    "The system architecture incorporates key failover, response caching, and SQLite persistence."
                )

            logger.info(f"Calling LiteLLM model {model} using {key_id}...")
            response = litellm.completion(**kwargs)

            end_time = time.perf_counter()
            latency_ms = max(1, int((end_time - start_time) * 1000))

            hidden_params = getattr(response, "_hidden_params", {}) or {}
            is_cache_hit = hidden_params.get("cache_hit", False) is True

            usage = getattr(response, "usage", None)
            input_tokens = getattr(usage, "prompt_tokens", 0) or 0
            output_tokens = getattr(usage, "completion_tokens", 0) or 0

            # Default token estimation if provider/mock returned 0
            if input_tokens == 0:
                input_tokens = sum(len(m.get("content", "").split()) for m in messages) + 10
            if output_tokens == 0:
                reply_text = response.choices[0].message.content or ""
                output_tokens = len(reply_text.split()) + 5

            reply = response.choices[0].message.content or ""

            if is_cache_hit:
                resolution_source = "LLM_CACHE"
                final_key_id = None
                final_fallback_attempts = 0
            else:
                resolution_source = "LIVE_INFERENCE"
                final_key_id = key_id
                final_fallback_attempts = fallback_attempts

            return GatewayResult(
                reply=reply,
                resolution_source=resolution_source,
                model=model,
                latency_ms=latency_ms,
                input_tokens=input_tokens,
                output_tokens=output_tokens,
                key_id=final_key_id,
                fallback_attempts=final_fallback_attempts
            )

        except Exception as exc:
            logger.error(f"Provider {key_id} failed: {exc}. Failing over to next key.")
            fallback_attempts += 1
            continue

    # If all keys in pool failed
    logger.error("All configured LLM providers failed or were exhausted.")
    raise AllProvidersUnavailableException("all providers unavailable")
