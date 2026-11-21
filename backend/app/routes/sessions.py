import json
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import Message
from app.schemas import HistoryResponse, HistoryMessage, HistoryItemMetadata

router = APIRouter(tags=["Sessions"])

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
