from typing import Dict, List

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """App settings, read from environment variables or a .env file."""

    DATABASE_URL: str = "sqlite:///./data/app.db"
    LLM_API_KEYS: str = "key_1:gemini/gemini-2.0-flash:placeholder_key_1,key_2:gemini/gemini-2.0-flash:placeholder_key_2"
    ALLOWED_ORIGINS: str = (
        "http://localhost:3000,http://127.0.0.1:3000,"
        "http://localhost:5173,http://127.0.0.1:5173,"
        "https://lyftr-ai-xi.vercel.app"
    )
    ENABLE_FAILURE_SIMULATION: bool = True
    DEFAULT_MODEL: str = "gemini/gemini-2.0-flash"
    DEFAULT_SYSTEM_PROMPT: str = (
        "You are a helpful and concise AI assistant. "
        "Format answers in Markdown, and always put code inside fenced code blocks with a language tag, like ```sql."
    )

    model_config = SettingsConfigDict(env_file=(".env", "../.env"), extra="ignore")

    def get_cors_origins(self) -> List[str]:
        return [origin.strip() for origin in self.ALLOWED_ORIGINS.split(",") if origin.strip()]

    def get_key_pool(self) -> List[Dict[str, str]]:
        """
        Reads LLM_API_KEYS (comma separated) into an ordered list of keys.
        Each entry can be written three ways:
          key_1:groq/llama3:sk-abc   -> id, model and secret
          key_1:sk-abc               -> id and secret (uses DEFAULT_MODEL)
          sk-abc                     -> secret only (id becomes key_1, key_2, ...)
        """
        pool = []
        entries = [e.strip() for e in self.LLM_API_KEYS.split(",") if e.strip()]
        for position, entry in enumerate(entries, start=1):
            parts = entry.split(":", 2)  # at most 3 parts, so a secret containing ":" stays whole
            if len(parts) == 3:
                key_id, model, api_key = parts
            elif len(parts) == 2:
                key_id, api_key = parts
                model = self.DEFAULT_MODEL
            else:
                key_id, model, api_key = f"key_{position}", self.DEFAULT_MODEL, entry
            pool.append({"key_id": key_id.strip(), "model": model.strip(), "api_key": api_key.strip()})
        return pool


settings = Settings()
