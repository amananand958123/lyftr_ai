"""All database reads and writes for chat messages live here."""
import json
from typing import List

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models import Message


def get_history(db: Session, session_id: str) -> List[Message]:
    """All messages of one session, oldest first."""
    return (
        db.query(Message)
        .filter(Message.session_id == session_id)
        .order_by(Message.id)
        .all()
    )


def save_turn(
    db: Session,
    session_id: str,
    user_text: str,
    reply: str,
    reply_metadata: dict,
    created_at: str,
    regenerate: bool = False,
):
    """Save the user's message and the assistant's reply together in one commit.
    When regenerating, update the last assistant reply in place instead of duplicating the turn."""
    if regenerate:
        history = get_history(db, session_id)
        if (
            len(history) >= 2
            and history[-1].role == "assistant"
            and history[-2].role == "user"
            and history[-2].content == user_text
        ):
            history[-1].content = reply
            history[-1].metadata_json = json.dumps(reply_metadata)
            history[-1].created_at = created_at
            db.commit()
            return

    db.add(Message(session_id=session_id, role="user", content=user_text, created_at=created_at))
    db.add(Message(
        session_id=session_id,
        role="assistant",
        content=reply,
        metadata_json=json.dumps(reply_metadata),
        created_at=created_at,
    ))
    db.commit()


def list_sessions(db: Session, limit: int, offset: int):
    """Returns (total number of sessions, one summary dict per session on this page)."""
    rows = (
        db.query(
            Message.session_id,
            func.count(Message.id).label("message_count"),
            func.max(Message.created_at).label("last_active_at"),
        )
        .group_by(Message.session_id)
        .order_by(func.max(Message.id).desc())  # most recently used first
        .offset(offset)
        .limit(limit)
        .all()
    )
    total = db.query(func.count(func.distinct(Message.session_id))).scalar() or 0

    summaries = []
    for row in rows:
        # ponytail: one extra query per session (N+1); fine for a page of 50, use a window function if it grows.
        last_message = (
            db.query(Message.content)
            .filter(Message.session_id == row.session_id)
            .order_by(Message.id.desc())
            .first()
        )
        preview = last_message.content if last_message else None
        if preview and len(preview) > 80:
            preview = preview[:80] + "..."

        summaries.append({
            "session_id": row.session_id,
            "message_count": row.message_count,
            "last_message_preview": preview,
            "last_active_at": row.last_active_at,
        })
    return total, summaries


def delete_session(db: Session, session_id: str) -> int:
    """Deletes every message in the session and returns how many were removed."""
    deleted = db.query(Message).filter(Message.session_id == session_id).delete()
    db.commit()
    return deleted
