import React from 'react';
import { ChatMessage } from '../types';
import { MetadataBadge } from './MetadataBadge';

interface MessageItemProps {
  message: ChatMessage;
}

export const MessageItem: React.FC<MessageItemProps> = ({ message }) => {
  const isUser = message.role === 'user';
  const isError = message.isError;

  if (isUser) {
    return (
      <div className="flex justify-end mb-4 animate-apple-entrance">
        <div className="max-w-[85%] sm:max-w-[75%]">
          <div className="bg-paper-2 border border-rule-2 text-ink px-4 py-3 rounded-[16px] rounded-br-[4px] shadow-sm text-sm leading-relaxed whitespace-pre-wrap break-words">
            {message.content}
          </div>
        </div>
      </div>
    );
  }

  // Assistant message container (MUST contain data-testid="assistant-message")
  return (
    <div className="flex justify-start mb-5 animate-apple-entrance">
      <div
        data-testid="assistant-message"
        className={`w-full max-w-[95%] sm:max-w-[88%] ${
          isError ? 'w-full' : ''
        }`}
      >
        <div
          className={`rounded-[16px] rounded-bl-[4px] px-5 py-4 border transition-colors ${
            isError
              ? 'bg-bad-soft/40 border-bad/30 text-ink'
              : 'bg-paper-2/90 border-rule text-ink'
          }`}
        >
          <div className="flex items-center gap-2 mb-2 pb-1.5 border-b border-rule-subtle">
            <span className="text-xs font-medium text-ink-muted">Lyftr Gateway</span>
            <span className="text-[11px] font-mono text-ink-subtle">assistant</span>
          </div>

          <div className="text-sm leading-relaxed whitespace-pre-wrap break-words font-body">
            {message.content}
          </div>

          {message.metadata && (
            <MetadataBadge metadata={message.metadata} />
          )}
        </div>
      </div>
    </div>
  );
};
