import React, { useState } from 'react';
import { ChatMessage } from '../types';
import { MetadataBadge } from './MetadataBadge';
import { MarkdownRenderer } from './MarkdownRenderer';

interface MessageItemProps {
  message: ChatMessage;
  onRegenerate?: () => void;
  cumulativeTokens?: number;
}

export const MessageItem: React.FC<MessageItemProps> = ({ message, onRegenerate, cumulativeTokens }) => {
  const isUser = message.role === 'user';
  const isError = message.isError;
  const [copiedText, setCopiedText] = useState(false);
  const [copiedJson, setCopiedJson] = useState(false);

  const handleCopyText = () => {
    navigator.clipboard.writeText(message.content);
    setCopiedText(true);
    setTimeout(() => setCopiedText(false), 1600);
  };

  const handleCopyJson = () => {
    const jsonStr = JSON.stringify(
      {
        role: message.role,
        content: message.content,
        metadata: message.metadata,
      },
      null,
      2
    );
    navigator.clipboard.writeText(jsonStr);
    setCopiedJson(true);
    setTimeout(() => setCopiedJson(false), 1600);
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
              : 'bg-paper-2/90 border-rule text-ink shadow-sm'
          }`}
        >
          {/* Header toolbar */}
          <div className="flex items-center justify-between mb-2.5 pb-2 border-b border-rule-subtle">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-accent" />
              <span className="text-xs font-semibold text-ink tracking-tight">Lyftr Gateway</span>
              <span className="text-[10px] uppercase tracking-wider font-mono px-1 py-0.5 rounded bg-paper-3 text-ink-subtle border border-rule-subtle">
                assistant
              </span>
            </div>

            <div className="flex items-center gap-2 text-[11px] font-mono text-ink-subtle">
              <button
                type="button"
                onClick={handleCopyText}
                className="hover:text-ink transition-colors flex items-center gap-1"
                title="Copy markdown content"
              >
                <span>{copiedText ? 'copied text' : 'copy text'}</span>
              </button>

              <span className="text-rule-2">·</span>

              <button
                type="button"
                onClick={handleCopyJson}
                className="hover:text-ink transition-colors flex items-center gap-1"
                title="Copy message and metadata as JSON"
              >
                <span>{copiedJson ? 'copied json' : 'json'}</span>
              </button>

              {onRegenerate && !isError && (
                <>
                  <span className="text-rule-2">·</span>
                  <button
                    type="button"
                    onClick={onRegenerate}
                    className="hover:text-ink transition-colors flex items-center gap-1 text-accent hover:underline"
                    title="Regenerate this response"
                  >
                    <span>regenerate</span>
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Formatted body */}
          <div className="text-sm leading-relaxed font-body">
            {isError ? (
              <div className="text-bad font-mono text-xs whitespace-pre-wrap">{message.content}</div>
            ) : (
              <MarkdownRenderer content={message.content} />
            )}
          </div>

          {/* Metadata badge and telemetry */}
          {message.metadata && (
            <MetadataBadge metadata={message.metadata} cumulativeTokens={cumulativeTokens} />
          )}
        </div>
      </div>
    </div>
  );
};
