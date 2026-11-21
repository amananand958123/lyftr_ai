import json
from typing import Optional
from sqlalchemy import Column, Integer, String, Text, Index
from app.database import Base

class Message(Base):
    __tablename__ = "messages"

    id = Column(Integer, primary_key=True, autoincrement=True)
    session_id = Column(String(128), nullable=False, index=True)
    role = Column(String(20), nullable=False)  # 'user' or 'assistant'
    content = Column(Text, nullable=False)
    metadata_json = Column("metadata", Text, nullable=True)  # JSON string for assistant metadata
    created_at = Column(String(50), nullable=False)  # ISO-8601 string

    @property
    def parsed_metadata(self) -> Optional[dict]:
        if not self.metadata_json:
            return None
        try:
            return json.loads(self.metadata_json)
        except Exception:
            return None

    @parsed_metadata.setter
    def parsed_metadata(self, val: Optional[dict]):
        if val is None:
            self.metadata_json = None
        else:
            self.metadata_json = json.dumps(val)

Index("idx_messages_session_id", Message.session_id)
