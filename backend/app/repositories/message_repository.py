"""All database reads and writes for chat messages live here."""
import json
from typing import List, Optional

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


def is_redo_of_last_turn(history: List[Message], user_text: str) -> bool:
    """True when the session ends with this same question + an answer (what "regenerate" replaces)."""
    return (
        len(history) >= 2
        and history[-2].role == "user"
        and history[-2].content == user_text
        and history[-1].role == "assistant"
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
        if is_redo_of_last_turn(history, user_text):
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


def list_sessions(db: Session, limit: int, offset: int, client_id: Optional[str] = None):
    """Returns (total number of sessions, one summary dict per session on this page).
    Executes in O(1) queries instead of N+1."""
    query = (
        db.query(
            Message.session_id,
            func.count(Message.id).label("message_count"),
            func.max(Message.created_at).label("last_active_at"),
            func.max(Message.id).label("max_id"),
        )
    )
    if client_id:
        query = query.filter(Message.session_id.like(f"s-{client_id}-%"))

    rows = (
        query
        .group_by(Message.session_id)
        .order_by(func.max(Message.id).desc())
        .offset(offset)
        .limit(limit)
        .all()
    )

    total_query = db.query(func.count(func.distinct(Message.session_id)))
    if client_id:
        total_query = total_query.filter(Message.session_id.like(f"s-{client_id}-%"))
    total = total_query.scalar() or 0

    # Fetch all last message previews in a single query (eliminating N+1 query loop)
    max_ids = [row.max_id for row in rows if row.max_id is not None]
    previews = {}
    if max_ids:
        last_messages = db.query(Message.session_id, Message.content).filter(Message.id.in_(max_ids)).all()
        for sid, content in last_messages:
            previews[sid] = content[:80] + "..." if len(content) > 80 else content

    summaries = []
    for row in rows:
        summaries.append({
            "session_id": row.session_id,
            "message_count": row.message_count,
            "last_message_preview": previews.get(row.session_id),
            "last_active_at": row.last_active_at,
        })
    return total, summaries


def delete_session(db: Session, session_id: str) -> int:
    """Deletes every message in the session and returns how many were removed."""
    deleted = db.query(Message).filter(Message.session_id == session_id).delete()
    db.commit()
    return deleted
