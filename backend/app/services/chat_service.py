"""The /chat flow: load history -> ask the gateway -> save the turn -> return the reply."""
import json
import time
from datetime import datetime, timezone
from typing import Dict, Iterator, List, Optional

import litellm
from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.config import settings
from app.gateway import complete_chat, open_stream
from app.repositories import message_repository
from app.schemas import ChatMetadata, ChatResponse


def build_conversation(db: Session, session_id: str, message: str, system_prompt: Optional[str]) -> List[Dict[str, str]]:
    """System prompt + past messages + the new message.
    (The cache key is this whole list, so the same conversation gives a cache hit.)"""
    conversation = [{"role": "system", "content": system_prompt or settings.DEFAULT_SYSTEM_PROMPT}]
    for past in message_repository.get_history(db, session_id):
        conversation.append({"role": past.role, "content": past.content})
    conversation.append({"role": "user", "content": message})
    return conversation


def save_turn(db: Session, session_id: str, message: str, reply: str, metadata: ChatMetadata):
    """Only successful turns reach this point, so failed requests are never saved."""
    message_repository.save_turn(
        db,
        session_id=session_id,
        user_text=message,
        reply=reply,
        reply_metadata={
            "resolution_source": metadata.resolution_source,
            "input_tokens": metadata.input_tokens,
            "output_tokens": metadata.output_tokens,
        },
        created_at=datetime.now(timezone.utc).isoformat(),
    )


def process_chat(
    db: Session,
    session_id: str,
    message: str,
    system_prompt: Optional[str] = None,
    simulate_header: Optional[str] = None,
    temperature: Optional[float] = None,
    max_tokens: Optional[int] = None,
) -> ChatResponse:
    conversation = build_conversation(db, session_id, message, system_prompt)

    # If every key fails, return 503 and save nothing.
    try:
        result = complete_chat(conversation, simulate_header, temperature, max_tokens)
    except Exception:
        raise HTTPException(status_code=503, detail="all providers unavailable")

    metadata = ChatMetadata(
        resolution_source=result.resolution_source,
        model=result.model,
        latency_ms=result.latency_ms,
        input_tokens=result.input_tokens,
        output_tokens=result.output_tokens,
        key_id=result.key_id,
        fallback_attempts=result.fallback_attempts,
    )
    save_turn(db, session_id, message, result.reply, metadata)
    return ChatResponse(session_id=session_id, reply=result.reply, metadata=metadata)


def sse_event(data: dict) -> str:
    """One Server-Sent Event: a 'data:' line followed by a blank line."""
    return f"data: {json.dumps(data)}\n\n"


def stream_chat(
    db: Session,
    session_id: str,
    message: str,
    system_prompt: Optional[str] = None,
    simulate_header: Optional[str] = None,
    temperature: Optional[float] = None,
    max_tokens: Optional[int] = None,
) -> Iterator[str]:
    """
    Like process_chat, but sends the reply piece by piece as Server-Sent Events:
      {"type": "delta", "text": "..."}       many times, one per chunk
      {"type": "done", "metadata": {...}}    once at the end (same metadata as /chat)
      {"type": "error", "detail": "..."}     if the provider breaks mid-reply (nothing is saved)
    """
    conversation = build_conversation(db, session_id, message, system_prompt)

    # Pick a working key BEFORE streaming starts, so "all keys failed" is still a real HTTP 503.
    try:
        opened = open_stream(conversation, simulate_header, temperature, max_tokens)
    except Exception:
        raise HTTPException(status_code=503, detail="all providers unavailable")

    def events():
        chunks = [opened.first_chunk]
        try:
            yield sse_event({"type": "delta", "text": opened.first_chunk.choices[0].delta.content or ""})
            for chunk in opened.stream:
                chunks.append(chunk)
                yield sse_event({"type": "delta", "text": chunk.choices[0].delta.content or ""})
        except Exception:
            yield sse_event({"type": "error", "detail": "provider failed during the reply"})
            return

        # Glue the chunks back into one full response (LiteLLM also estimates token counts here).
        full = litellm.stream_chunk_builder(chunks, messages=conversation)
        reply = full.choices[0].message.content or ""
        from_cache = opened.from_cache
        metadata = ChatMetadata(
            resolution_source="LLM_CACHE" if from_cache else "LIVE_INFERENCE",
            model=opened.model,
            latency_ms=max(1, int((time.perf_counter() - opened.start_time) * 1000)),
            input_tokens=full.usage.prompt_tokens,
            output_tokens=full.usage.completion_tokens,
            key_id=None if from_cache else opened.key_id,
            fallback_attempts=0 if from_cache else opened.fallback_attempts,
        )
        save_turn(db, session_id, message, reply, metadata)
        yield sse_event({"type": "done", "metadata": metadata.model_dump()})

    return events()
