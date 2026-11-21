from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from app.database import get_db
from app.repositories.message_repository import message_repo
from app.schemas import (
    HistoryResponse,
    HistoryMessage,
    HistoryItemMetadata,
    SessionListResponse,
    SessionSummary,
    SessionDeleteResponse
)

router = APIRouter(tags=["Sessions"])

@router.get("/sessions", response_model=SessionListResponse)
def list_sessions(
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db)
):
    """
    Returns a paginated list of all active sessions, message counts, and last active timestamp.
    """
    total_count, summaries = message_repo.list_sessions_summary(db, limit=limit, offset=offset)
    return SessionListResponse(
        total=total_count,
        sessions=[SessionSummary(**s) for s in summaries]
    )

@router.delete("/sessions/{session_id}", response_model=SessionDeleteResponse)
def delete_session(session_id: str, db: Session = Depends(get_db)):
    """
    Deletes all messages for a specific session from SQLite.
    Returns 404 if the session does not exist.
    """
    deleted_count = message_repo.delete_session(db, session_id)
    if deleted_count == 0:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="session not found"
        )

    return SessionDeleteResponse(
        session_id=session_id,
        deleted=True,
        messages_deleted=deleted_count
    )

@router.get("/sessions/{session_id}/messages", response_model=HistoryResponse, response_model_exclude_none=True)
def get_session_messages(session_id: str, db: Session = Depends(get_db)):
    """
    Returns the stored history of one session from SQLite, oldest first, without the system prompt.
    Returns 404 if the session has no stored messages.
    """
    messages = message_repo.get_history(db, session_id)
    if not messages:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="session not found"
        )

    history_items = []
    for msg in messages:
        if msg.role == "system":
            continue

        item_meta = None
        if msg.role == "assistant" and msg.parsed_metadata:
            meta_dict = msg.parsed_metadata
            item_meta = HistoryItemMetadata(
                resolution_source=meta_dict.get("resolution_source", "LIVE_INFERENCE"),
                input_tokens=meta_dict.get("input_tokens", 0),
                output_tokens=meta_dict.get("output_tokens", 0)
            )

        history_items.append(
            HistoryMessage(
                role=msg.role,
                content=msg.content,
                metadata=item_meta
            )
        )

    return HistoryResponse(
        session_id=session_id,
        messages=history_items
    )
