from typing import Optional

from fastapi import APIRouter, Depends, Header
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas import ChatRequest, ChatResponse
from app.services.chat_service import process_chat, stream_chat

router = APIRouter(tags=["Chat"])


@router.post("/chat", response_model=ChatResponse)
def post_chat(
    payload: ChatRequest,
    x_simulate_failure: Optional[str] = Header(None, alias="X-Simulate-Failure"),
    x_regenerate: Optional[str] = Header(None, alias="X-Regenerate"),
    db: Session = Depends(get_db),
):
    is_regenerate = payload.regenerate or (x_regenerate is not None and x_regenerate.lower() in ("true", "1"))
    return process_chat(
        db=db,
        session_id=payload.session_id,
        message=payload.message,
        system_prompt=payload.system_prompt,
        simulate_header=x_simulate_failure,
        temperature=payload.temperature,
        max_tokens=payload.max_tokens,
        regenerate=is_regenerate,
    )


@router.post("/chat/stream")
def post_chat_stream(
    payload: ChatRequest,
    x_simulate_failure: Optional[str] = Header(None, alias="X-Simulate-Failure"),
    x_regenerate: Optional[str] = Header(None, alias="X-Regenerate"),
    db: Session = Depends(get_db),
):
    """Same as /chat, but the reply arrives word by word as Server-Sent Events."""
    is_regenerate = payload.regenerate or (x_regenerate is not None and x_regenerate.lower() in ("true", "1"))
    events = stream_chat(
        db=db,
        session_id=payload.session_id,
        message=payload.message,
        system_prompt=payload.system_prompt,
        simulate_header=x_simulate_failure,
        temperature=payload.temperature,
        max_tokens=payload.max_tokens,
        regenerate=is_regenerate,
    )
    # X-Accel-Buffering: stop proxies (nginx) from holding the stream back until it ends.
    return StreamingResponse(events, media_type="text/event-stream", headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})
