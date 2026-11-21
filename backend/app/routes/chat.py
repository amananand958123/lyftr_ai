from typing import Optional
from fastapi import APIRouter, Depends, Header
from sqlalchemy.orm import Session
from app.database import get_db
from app.schemas import ChatRequest, ChatResponse
from app.services.chat_service import chat_service

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
    return chat_service.process_chat(
        db=db,
        session_id=payload.session_id,
        message=payload.message,
        system_prompt=payload.system_prompt,
        simulate_header=x_simulate_failure,
        temperature=payload.temperature,
        max_tokens=payload.max_tokens
    )
