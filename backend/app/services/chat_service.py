from datetime import datetime, timezone
from typing import Optional, List, Dict
from sqlalchemy.orm import Session
from fastapi import HTTPException, status
from app.config import settings
from app.repositories.message_repository import message_repo
from app.gateway import complete_chat, AllProvidersUnavailableException
from app.schemas import ChatResponse, ChatMetadata

class ChatService:
    @staticmethod
    def process_chat(
        db: Session,
        session_id: str,
        message: str,
        system_prompt: Optional[str] = None,
        simulate_header: Optional[str] = None,
        temperature: Optional[float] = None,
        max_tokens: Optional[int] = None
    ) -> ChatResponse:
        effective_system_prompt = system_prompt or settings.DEFAULT_SYSTEM_PROMPT

        # 1. Fetch conversation history from repository
        history = message_repo.get_history(db, session_id)

        # 2. Build full message array for LiteLLM
        # Cache key invariant: model + full message list (system + history + new_message)
        llm_messages: List[Dict[str, str]] = [{"role": "system", "content": effective_system_prompt}]
        for msg in history:
            llm_messages.append({"role": msg.role, "content": msg.content})
        llm_messages.append({"role": "user", "content": message})

        # 3. Complete chat via LiteLLM gateway
        try:
            result = complete_chat(
                messages=llm_messages,
                simulate_header=simulate_header,
                temperature=temperature,
                max_tokens=max_tokens
            )
        except AllProvidersUnavailableException:
            # Crucial rule: 503 errors must NOT be recorded to SQLite session history
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="all providers unavailable"
            )
        except Exception:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="all providers unavailable"
            )

        # 4. Save both messages to repository
        now_iso = datetime.now(timezone.utc).isoformat()
        assistant_meta = {
            "resolution_source": result.resolution_source,
            "input_tokens": result.input_tokens,
            "output_tokens": result.output_tokens
        }

        message_repo.save_messages(
            db=db,
            session_id=session_id,
            user_content=message,
            assistant_content=result.reply,
            assistant_metadata=assistant_meta,
            created_at=now_iso
        )

        # 5. Return schema-compliant ChatResponse
        return ChatResponse(
            session_id=session_id,
            reply=result.reply,
            metadata=ChatMetadata(
                resolution_source=result.resolution_source,
                model=result.model,
                latency_ms=result.latency_ms,
                input_tokens=result.input_tokens,
                output_tokens=result.output_tokens,
                key_id=result.key_id,
                fallback_attempts=result.fallback_attempts
            )
        )

chat_service = ChatService()
