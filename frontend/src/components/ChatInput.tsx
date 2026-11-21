import React, { useRef, useEffect } from 'react';
import { LatencySparkline } from './LatencySparkline';
import { exportSessionMarkdown, exportSessionJSON } from '../utils/export';
import { ChatMessage } from '../types';

interface ChatInputProps {
  inputText: string;
  setInputText: (v: string) => void;
  onSubmit: (e?: React.FormEvent) => void;
  isLoading: boolean;
  sessionId: string;
  messages: ChatMessage[];
  latencyPoints: Array<{ latency_ms: number; is_cache: boolean }>;
}

export const ChatInput: React.FC<ChatInputProps> = ({
  inputText,
  setInputText,
  onSubmit,
  isLoading,
  sessionId,
  messages,
  latencyPoints,
}) => {
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!isLoading) {
      inputRef.current?.focus();
    }
  }, [isLoading]);

  // Auto-grow textarea smoothly up to 5 lines (approx 120px)
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.style.height = 'auto';
      const scrollHeight = inputRef.current.scrollHeight;
      inputRef.current.style.height = `${Math.min(Math.max(scrollHeight, 52), 140)}px`;
    }
  }, [inputText]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onSubmit();
    }
  };

  const charCount = inputText.length;

  return (
    <footer className="pt-2.5 border-t border-rule-subtle shrink-0">
      <form onSubmit={onSubmit} className="relative flex items-end">
        <textarea
          ref={inputRef}
          data-testid="chat-input"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Send a prompt to the gateway... (Enter to send, Shift+Enter for newline)"
          rows={1}
          maxLength={4000}
          className="w-full bg-paper-2 border border-rule hover:border-rule-2 rounded-[16px] pl-4 pr-16 py-3 text-sm text-ink placeholder-ink-subtle focus:outline-none focus:border-rule-2 focus:ring-0 resize-none transition-[border-color,background-color] duration-150 leading-relaxed font-body"
        />

        <div className="absolute right-3 bottom-3 flex items-center gap-1.5">
          {inputText && (
            <button
              type="button"
              onClick={() => setInputText('')}
              className="text-ink-subtle hover:text-ink text-xs px-1.5 py-1 rounded hover:bg-paper-3 transition-colors"
              title="Clear text"
            >
              ✕
            </button>
          )}

          <button
            type="submit"
            data-testid="send-button"
            disabled={!inputText.trim() || isLoading}
            className="w-8 h-8 rounded-full bg-accent disabled:bg-paper-3 text-accent-ink disabled:text-ink-subtle border border-accent disabled:border-rule-subtle flex items-center justify-center transition-[transform,background-color,opacity] duration-150 active:scale-90 disabled:opacity-40 shadow-sm shrink-0"
            title="Send Message (Enter)"
            aria-label="Send message"
          >
            <svg
              aria-hidden="true"
              className="w-4 h-4 translate-y-[-0.5px]"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="12" y1="19" x2="12" y2="5" />
              <polyline points="5 12 12 5 19 12" />
            </svg>
          </button>
        </div>
      </form>

      <div className="flex items-center justify-between mt-2 text-[11px] text-ink-subtle px-1 font-mono">
        <div className="flex items-center gap-3">
          <span>SQLite ./data/app.db</span>
          {latencyPoints.length > 1 && (
            <LatencySparkline points={latencyPoints} />
          )}
        </div>

        <div className="flex items-center gap-2">
          {charCount > 0 && (
            <>
              <span className="text-ink-subtle">{charCount}/4000</span>
              <span>·</span>
            </>
          )}
          <button
            type="button"
            onClick={() => exportSessionMarkdown(sessionId, messages)}
            className="hover:text-ink transition-colors"
            title="Export session as Markdown"
          >
            export md
          </button>
          <span>·</span>
          <button
            type="button"
            onClick={() => exportSessionJSON(sessionId, messages)}
            className="hover:text-ink transition-colors"
            title="Export session as JSON"
          >
            export json
          </button>
        </div>
      </div>
    </footer>
  );
};
