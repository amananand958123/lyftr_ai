import React from 'react';
import { ChatMessage } from '../types';
import { MetadataBadge } from './MetadataBadge';
import { CodeBlock } from './CodeBlock';

interface MessageItemProps {
  message: ChatMessage;
  onRegenerate?: () => void;
  cumulativeTokens?: number;
}

export const MessageItem: React.FC<MessageItemProps> = ({ message, onRegenerate, cumulativeTokens }) => {
  const isUser = message.role === 'user';
  const isError = message.isError;

  // Simple, robust helper to format code blocks inside ```
  const renderFormattedContent = (text: string) => {
    if (!text.includes('```')) {
      return <div className="whitespace-pre-wrap break-words">{text}</div>;
    }

    const parts = text.split(/(```[\s\S]*?```)/g);
    return (
      <div className="space-y-1">
        {parts.map((part, index) => {
          if (part.startsWith('```') && part.endsWith('```')) {
            const firstLineEnd = part.indexOf('\n');
            const lang = firstLineEnd !== -1 ? part.substring(3, firstLineEnd).trim() : '';
            const code = firstLineEnd !== -1 ? part.substring(firstLineEnd + 1, part.length - 3) : part.substring(3, part.length - 3);
            return <CodeBlock key={index} language={lang} code={code} />;
          }
          return (
            <div key={index} className="whitespace-pre-wrap break-words">
              {part}
            </div>
          );
        })}
      </div>
    );
  };

  if (isUser) {
    return (
      <div className="flex justify-end mb-4 animate-apple-entrance">
        <div className="max-w-[85%] sm:max-w-[75%]">
          <div className="bg-paper-2 border border-rule-2 text-ink px-4 py-3 rounded-[16px] rounded-br-[4px] shadow-sm text-sm leading-relaxed whitespace-pre-wrap break-words font-body">
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
          <div className="flex items-center justify-between mb-2 pb-1.5 border-b border-rule-subtle">
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-ink-muted">Lyftr Gateway</span>
              <span className="text-[11px] font-mono text-ink-subtle">assistant</span>
            </div>
            {onRegenerate && !isError && (
              <button
                type="button"
                onClick={onRegenerate}
                className="text-[11px] font-mono text-ink-subtle hover:text-ink transition-colors flex items-center gap-1"
                title="Regenerate this response"
              >
                <span>regenerate</span>
              </button>
            )}
          </div>

          <div className="text-sm leading-relaxed font-body">
            {renderFormattedContent(message.content)}
          </div>

          {message.metadata && (
            <MetadataBadge metadata={message.metadata} cumulativeTokens={cumulativeTokens} />
          )}
        </div>
      </div>
    </div>
  );
};
