import json
from typing import Optional

from sqlalchemy import Column, Index, Integer, String, Text

from app.database import Base


class Message(Base):
    __tablename__ = "messages"

    id = Column(Integer, primary_key=True, autoincrement=True)
    session_id = Column(String(128), nullable=False, index=True)
    role = Column(String(20), nullable=False)  # "user" or "assistant"
    content = Column(Text, nullable=False)
    metadata_json = Column("metadata", Text, nullable=True)  # JSON text, only for assistant replies
    created_at = Column(String(50), nullable=False)  # ISO-8601 timestamp

    def get_metadata(self) -> Optional[dict]:
        """The metadata column as a dict (None for user messages)."""
        return json.loads(self.metadata_json) if self.metadata_json else None
