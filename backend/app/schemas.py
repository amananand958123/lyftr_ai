from typing import Optional, List, Dict, Any, Literal
from pydantic import BaseModel, Field, field_validator

Role = Literal["user", "assistant", "system"]
ResolutionSource = Literal["LIVE_INFERENCE", "LLM_CACHE"]

class HealthResponse(BaseModel):
    status: str = "ok"
    keys_configured: int
    cache_enabled: bool = True

class DeepProviderHealth(BaseModel):
    key_id: str
    model: str
    status: str
    latency_ms: Optional[int] = None

class DeepHealthResponse(BaseModel):
    status: str
    total_keys: int
    healthy_keys: int
    providers: List[DeepProviderHealth]

class ChatRequest(BaseModel):
    session_id: str = Field(..., min_length=1, max_length=128)
    message: str = Field(..., min_length=1, max_length=4000)
    system_prompt: Optional[str] = Field(None, max_length=4000)
    temperature: Optional[float] = Field(None, ge=0.0, le=2.0)
    max_tokens: Optional[int] = Field(None, gt=0, le=8192)
    regenerate: bool = False  # True = replace the last reply instead of adding a new turn

    @field_validator("system_prompt")
    @classmethod
    def validate_system_prompt(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return None
        trimmed = v.strip()
        if len(trimmed) > 4000:
            raise ValueError("system_prompt must not exceed 4000 characters")
        return trimmed or None

    @field_validator("message")
    @classmethod
    def validate_message(cls, v: str) -> str:
        trimmed = v.strip()
        if len(trimmed) < 1:
            raise ValueError("message must not be empty or whitespace only")
        if len(trimmed) > 4000:
            raise ValueError("message must not exceed 4000 characters after trimming")
        return trimmed

    @field_validator("session_id")
    @classmethod
    def validate_session_id(cls, v: str) -> str:
        trimmed = v.strip()
        if len(trimmed) < 1 or len(trimmed) > 128:
            raise ValueError("session_id must be between 1 and 128 characters")
        return trimmed

class ChatMetadata(BaseModel):
    resolution_source: ResolutionSource = Field(..., description="LIVE_INFERENCE or LLM_CACHE")
    model: str
    latency_ms: int
    input_tokens: int
    output_tokens: int
    key_id: Optional[str] = None
    fallback_attempts: int = 0

class ChatResponse(BaseModel):
    session_id: str
    reply: str
    metadata: ChatMetadata

class HistoryItemMetadata(BaseModel):
    resolution_source: ResolutionSource
    input_tokens: int
    output_tokens: int
    model: Optional[str] = None
    latency_ms: Optional[int] = None
    key_id: Optional[str] = None
    fallback_attempts: Optional[int] = 0

class HistoryMessage(BaseModel):
    role: Role
    content: str
    metadata: Optional[HistoryItemMetadata] = None

class HistoryResponse(BaseModel):
    session_id: str
    messages: List[HistoryMessage]

class SessionSummary(BaseModel):
    session_id: str
    message_count: int
    first_message_preview: Optional[str] = None
    last_message_preview: Optional[str] = None
    last_active_at: Optional[str] = None

class SessionListResponse(BaseModel):
    total: int
    sessions: List[SessionSummary]

class SessionDeleteResponse(BaseModel):
    session_id: str
    deleted: bool = True
    messages_deleted: int

class CacheStatsResponse(BaseModel):
    cache_enabled: bool
    cache_type: str = "local"
    supported_models: List[str]
