from typing import Optional
from fastapi import APIRouter, Depends, Header, HTTPException, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.repositories import message_repository
from app.schemas import (
    HistoryItemMetadata,
    HistoryMessage,
    HistoryResponse,
    SessionDeleteResponse,
    SessionListResponse,
    SessionSummary,
)

router = APIRouter(tags=["Sessions"])


@router.get("/sessions", response_model=SessionListResponse)
def list_sessions(
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    x_client_id: Optional[str] = Header(None, alias="X-Client-ID"),
    db: Session = Depends(get_db),
):
    """Paginated list of sessions, most recently active first. Scoped to client when header provided."""
    total, summaries = message_repository.list_sessions(db, limit=limit, offset=offset, client_id=x_client_id)
    return SessionListResponse(total=total, sessions=[SessionSummary(**s) for s in summaries])


@router.delete("/sessions/{session_id}", response_model=SessionDeleteResponse)
def delete_session(session_id: str, db: Session = Depends(get_db)):
    deleted_count = message_repository.delete_session(db, session_id)
    if deleted_count == 0:
        raise HTTPException(status_code=404, detail="session not found")
    return SessionDeleteResponse(session_id=session_id, deleted=True, messages_deleted=deleted_count)


# response_model_exclude_none: user messages have no metadata, so the "metadata" key is left out entirely.
@router.get("/sessions/{session_id}/messages", response_model=HistoryResponse, response_model_exclude_none=True)
def get_session_messages(session_id: str, db: Session = Depends(get_db)):
    """Stored history of one session, oldest first. The system prompt is never stored, so it never shows up."""
    messages = message_repository.get_history(db, session_id)
    if not messages:
        raise HTTPException(status_code=404, detail="session not found")

    history = []
    for msg in messages:
        metadata = msg.get_metadata()
        history.append(HistoryMessage(
            role=msg.role,
            content=msg.content,
            metadata=HistoryItemMetadata(**metadata) if metadata else None,
        ))
    return HistoryResponse(session_id=session_id, messages=history)
