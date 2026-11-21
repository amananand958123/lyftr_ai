"""The /chat flow: load history -> ask the gateway -> save the turn -> return the reply."""
from datetime import datetime, timezone
from typing import Optional

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.config import settings
from app.gateway import complete_chat
from app.repositories import message_repository
from app.schemas import ChatMetadata, ChatResponse


def process_chat(
    db: Session,
    session_id: str,
    message: str,
    system_prompt: Optional[str] = None,
    simulate_header: Optional[str] = None,
    temperature: Optional[float] = None,
    max_tokens: Optional[int] = None,
) -> ChatResponse:
    # 1. Build the full conversation: system prompt + past messages + the new message.
    #    (The cache key is this whole list, so the same conversation gives a cache hit.)
    conversation = [{"role": "system", "content": system_prompt or settings.DEFAULT_SYSTEM_PROMPT}]
    for past in message_repository.get_history(db, session_id):
        conversation.append({"role": past.role, "content": past.content})
    conversation.append({"role": "user", "content": message})

    # 2. Ask the gateway. If every key fails, return 503 and save nothing.
    try:
        result = complete_chat(conversation, simulate_header, temperature, max_tokens)
    except Exception:
        raise HTTPException(status_code=503, detail="all providers unavailable")

    # 3. Only successful turns are saved to the database.
    message_repository.save_turn(
        db,
        session_id=session_id,
        user_text=message,
        reply=result.reply,
        reply_metadata={
            "resolution_source": result.resolution_source,
            "input_tokens": result.input_tokens,
            "output_tokens": result.output_tokens,
        },
        created_at=datetime.now(timezone.utc).isoformat(),
    )

    return ChatResponse(
        session_id=session_id,
        reply=result.reply,
        metadata=ChatMetadata(
            resolution_source=result.resolution_source,
            model=result.model,
            latency_ms=result.latency_ms,
            input_tokens=result.input_tokens,
            output_tokens=result.output_tokens,
            key_id=result.key_id,
            fallback_attempts=result.fallback_attempts,
        ),
    )
