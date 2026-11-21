from typing import List, Dict, Optional
from pydantic_settings import BaseSettings, SettingsConfigDict
import os

class Settings(BaseSettings):
    DATABASE_URL: str = "sqlite:///./data/app.db"
    LLM_API_KEYS: str = "key_1:gemini/gemini-2.0-flash:placeholder_key_1,key_2:gemini/gemini-2.0-flash:placeholder_key_2"
    ALLOWED_ORIGINS: str = "http://localhost:3000,http://127.0.0.1:3000"
    ENABLE_FAILURE_SIMULATION: bool = True
    DEFAULT_MODEL: str = "gemini/gemini-2.0-flash"
    DEFAULT_SYSTEM_PROMPT: str = "You are a helpful and concise AI assistant."

    model_config = SettingsConfigDict(
        env_file=(".env", "../.env"),
        env_file_encoding="utf-8",
        extra="ignore"
    )

    def get_cors_origins(self) -> List[str]:
        return [origin.strip() for origin in self.ALLOWED_ORIGINS.split(",") if origin.strip()]

    def get_key_pool(self) -> List[Dict[str, str]]:
        """
        Parses LLM_API_KEYS into an ordered key pool.
        Supports format:
          1. key_1:model:secret,key_2:model:secret
          2. secret_1,secret_2 (auto-maps to key_1, key_2 with DEFAULT_MODEL)
          3. key_1:secret_1,key_2:secret_2
        """
        raw_keys = [k.strip() for k in self.LLM_API_KEYS.split(",") if k.strip()]
        key_pool = []
        for idx, entry in enumerate(raw_keys, start=1):
            parts = entry.split(":")
            if len(parts) >= 3:
                key_id = parts[0].strip()
                model = parts[1].strip()
                api_key = ":".join(parts[2:]).strip()
            elif len(parts) == 2:
                key_id = parts[0].strip()
                model = self.DEFAULT_MODEL
                api_key = parts[1].strip()
            else:
                key_id = f"key_{idx}"
                model = self.DEFAULT_MODEL
                api_key = entry.strip()

            key_pool.append({
                "key_id": key_id,
                "model": model,
                "api_key": api_key
            })
        return key_pool

settings = Settings()
