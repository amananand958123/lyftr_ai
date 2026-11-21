import json
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import Message
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
    Returns a paginated list of all active sessions, their message counts, and last active timestamp.
    """
    results = (
        db.query(
            Message.session_id,
            func.count(Message.id).label("message_count"),
            func.max(Message.created_at).label("last_active_at")
        )
        .group_by(Message.session_id)
        .order_by(func.max(Message.id).desc())
        .offset(offset)
        .limit(limit)
        .all()
    )

    total_count = (
        db.query(func.count(func.distinct(Message.session_id))).scalar() or 0
    )

    session_summaries = []
    for row in results:
        latest_msg = (
            db.query(Message.content)
            .filter(Message.session_id == row.session_id)
            .order_by(Message.id.desc())
            .first()
        )
        preview = None
        if latest_msg and latest_msg[0]:
            preview = latest_msg[0][:80] + "..." if len(latest_msg[0]) > 80 else latest_msg[0]

        session_summaries.append(
            SessionSummary(
                session_id=row.session_id,
                message_count=row.message_count,
                last_message_preview=preview,
                last_active_at=row.last_active_at
            )
        )

    return SessionListResponse(
        total=total_count,
        sessions=session_summaries
    )

@router.delete("/sessions/{session_id}", response_model=SessionDeleteResponse)
def delete_session(session_id: str, db: Session = Depends(get_db)):
    """
    Deletes all messages for a specific session from SQLite.
    Returns 404 if the session does not exist.
    """
    deleted_count = (
        db.query(Message)
        .filter(Message.session_id == session_id)
        .delete(synchronize_session=False)
    )
    db.commit()

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
    messages = (
        db.query(Message)
        .filter(Message.session_id == session_id)
        .order_by(Message.id.asc())
        .all()
    )

    if not messages:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="session not found"
        )

    history_items = []
    for msg in messages:
        # Exclude any system messages from history output
        if msg.role == "system":
            continue

        item_meta = None
        if msg.role == "assistant" and msg.metadata_json:
            try:
                parsed = json.loads(msg.metadata_json)
                item_meta = HistoryItemMetadata(
                    resolution_source=parsed.get("resolution_source", "LIVE_INFERENCE"),
                    input_tokens=parsed.get("input_tokens", 0),
                    output_tokens=parsed.get("output_tokens", 0)
                )
            except Exception:
                pass

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
