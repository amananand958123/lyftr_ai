"""All database reads and writes for chat messages live here."""
import json
import re
from datetime import datetime, timezone
from typing import Any, List, Optional, Union

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models import Message


def sanitize_client_id(client_id: Optional[str]) -> Optional[str]:
    """Sanitize client ID to prevent SQL injection or wildcard interpretation."""
    if not client_id:
        return None
    cleaned = re.sub(r"[^a-zA-Z0-9_-]", "", client_id.strip())
    return cleaned or None


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
    created_at: Union[datetime, str],
    regenerate: bool = False,
):
    """Save the user's message and the assistant's reply together in one commit.
    When regenerating, update the last assistant reply in place instead of duplicating the turn."""
    if isinstance(created_at, str):
        try:
            created_dt = datetime.fromisoformat(created_at)
        except Exception:
            created_dt = datetime.now(timezone.utc)
    else:
        created_dt = created_at

    if regenerate:
        history = get_history(db, session_id)
        if is_redo_of_last_turn(history, user_text):
            history[-1].content = reply
            history[-1].metadata_json = json.dumps(reply_metadata)
            history[-1].created_at = created_dt
            db.commit()
            return

    db.add(Message(session_id=session_id, role="user", content=user_text, created_at=created_dt))
    db.add(Message(
        session_id=session_id,
        role="assistant",
        content=reply,
        metadata_json=json.dumps(reply_metadata),
        created_at=created_dt,
    ))
    db.commit()


def list_sessions(db: Session, limit: int, offset: int, client_id: Optional[str] = None):
    """Returns (total number of sessions, one summary dict per session on this page).
    Executes in O(1) queries instead of N+1. Scoped to client when provided."""
    safe_client = sanitize_client_id(client_id)
    query = (
        db.query(
            Message.session_id,
            func.count(Message.id).label("message_count"),
            func.max(Message.created_at).label("last_active_at"),
            func.min(Message.id).label("min_id"),
            func.max(Message.id).label("max_id"),
        )
    )
    if safe_client:
        query = query.filter(Message.session_id.like(f"s-{safe_client}-%"))

    rows = (
        query
        .group_by(Message.session_id)
        .order_by(func.max(Message.id).desc())
        .offset(offset)
        .limit(limit)
        .all()
    )

    total_query = db.query(func.count(func.distinct(Message.session_id)))
    if safe_client:
        total_query = total_query.filter(Message.session_id.like(f"s-{safe_client}-%"))
    total = total_query.scalar() or 0

    # Fetch all first (initial prompt) and last message previews in a single query
    id_targets = []
    for r in rows:
        if r.min_id is not None:
            id_targets.append(r.min_id)
        if r.max_id is not None and r.max_id != r.min_id:
            id_targets.append(r.max_id)

    first_previews = {}
    last_previews = {}
    if id_targets:
        messages = db.query(Message.id, Message.session_id, Message.content).filter(Message.id.in_(id_targets)).all()
        for mid, sid, content in messages:
            preview = content[:80] + "..." if len(content) > 80 else content
            for r in rows:
                if r.session_id == sid:
                    if r.min_id == mid:
                        first_previews[sid] = preview
                    if r.max_id == mid:
                        last_previews[sid] = preview

    summaries = []
    for row in rows:
        last_active = row.last_active_at
        if hasattr(last_active, "isoformat"):
            last_active_str = last_active.isoformat()
        elif last_active is not None:
            last_active_str = str(last_active)
        else:
            last_active_str = None

        summaries.append({
            "session_id": row.session_id,
            "message_count": row.message_count,
            "first_message_preview": first_previews.get(row.session_id),
            "last_message_preview": last_previews.get(row.session_id) or first_previews.get(row.session_id),
            "last_active_at": last_active_str,
        })
    return total, summaries


def delete_session(db: Session, session_id: str) -> int:
    """Deletes every message in the session and returns how many were removed."""
    deleted = db.query(Message).filter(Message.session_id == session_id).delete()
    db.commit()
    return deleted
