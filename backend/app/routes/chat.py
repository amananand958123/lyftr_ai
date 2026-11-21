from datetime import datetime, timezone
import json
from typing import Optional
from fastapi import APIRouter, Depends, Header, HTTPException, status
from sqlalchemy.orm import Session
from app.database import get_db
from app.config import settings
from app.models import Message
from app.schemas import ChatRequest, ChatResponse, ChatMetadata
from app.gateway import complete_chat, AllProvidersUnavailableException

router = APIRouter(tags=["Chat"])

@router.post("/chat", response_model=ChatResponse)
def post_chat(
    payload: ChatRequest,
    x_simulate_failure: Optional[str] = Header(None, alias="X-Simulate-Failure"),
    db: Session = Depends(get_db)
):
    """
    Primary chat completion endpoint with SQLite context, LiteLLM gateway, caching, and failover.
    """
    session_id = payload.session_id
    user_message = payload.message
    system_prompt = payload.system_prompt or settings.DEFAULT_SYSTEM_PROMPT

    # 1. Fetch existing session conversation history from SQLite
    existing_messages = (
        db.query(Message)
        .filter(Message.session_id == session_id)
        .order_by(Message.id.asc())
        .all()
    )

    # 2. Construct complete message list for LiteLLM
    # Cache key requirement: model + full message list (system prompt + history + new message)
    llm_messages = [{"role": "system", "content": system_prompt}]
    for msg in existing_messages:
        llm_messages.append({"role": msg.role, "content": msg.content})
    llm_messages.append({"role": "user", "content": user_message})

    # 3. Execute completion with failover and simulation hook
    try:
        result = complete_chat(
            messages=llm_messages,
            simulate_header=x_simulate_failure,
            temperature=payload.temperature,
            max_tokens=payload.max_tokens
        )
    except AllProvidersUnavailableException:
        # Crucial rule: A request that fails (503) must NOT be added to session history
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="all providers unavailable"
        )
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="all providers unavailable"
        )

    # 4. Save successful user and assistant messages into SQLite
    now_iso = datetime.now(timezone.utc).isoformat()

    # User message
    user_db_msg = Message(
        session_id=session_id,
        role="user",
        content=user_message,
        metadata_json=None,
        created_at=now_iso
    )
    db.add(user_db_msg)

    # Assistant metadata
    assistant_meta_dict = {
        "resolution_source": result.resolution_source,
        "input_tokens": result.input_tokens,
        "output_tokens": result.output_tokens
    }

    # Assistant message
    assistant_db_msg = Message(
        session_id=session_id,
        role="assistant",
        content=result.reply,
        metadata_json=json.dumps(assistant_meta_dict),
        created_at=now_iso
    )
    db.add(assistant_db_msg)
    db.commit()

    # 5. Return HTTP 200 with required contract
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
            fallback_attempts=result.fallback_attempts
        )
    )
