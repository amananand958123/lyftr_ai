from typing import List, Tuple, Dict, Any, Optional
from sqlalchemy import func
from sqlalchemy.orm import Session
from app.models import Message

class MessageRepository:
    @staticmethod
    def get_history(db: Session, session_id: str) -> List[Message]:
        return (
            db.query(Message)
            .filter(Message.session_id == session_id)
            .order_by(Message.id.asc())
            .all()
        )

    @staticmethod
    def save_messages(
        db: Session,
        session_id: str,
        user_content: str,
        assistant_content: str,
        assistant_metadata: dict,
        created_at: str
    ) -> Tuple[Message, Message]:
        user_msg = Message(
            session_id=session_id,
            role="user",
            content=user_content,
            metadata_json=None,
            created_at=created_at
        )
        db.add(user_msg)

        assistant_msg = Message(
            session_id=session_id,
            role="assistant",
            content=assistant_content,
            created_at=created_at
        )
        assistant_msg.parsed_metadata = assistant_metadata
        db.add(assistant_msg)
        db.commit()
        return user_msg, assistant_msg

    @staticmethod
    def list_sessions_summary(db: Session, limit: int = 50, offset: int = 0) -> Tuple[int, List[Dict[str, Any]]]:
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

        summaries = []
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

            summaries.append({
                "session_id": row.session_id,
                "message_count": row.message_count,
                "last_message_preview": preview,
                "last_active_at": row.last_active_at
            })

        return total_count, summaries

    @staticmethod
    def delete_session(db: Session, session_id: str) -> int:
        deleted_count = (
            db.query(Message)
            .filter(Message.session_id == session_id)
            .delete(synchronize_session=False)
        )
        db.commit()
        return deleted_count

message_repo = MessageRepository()
