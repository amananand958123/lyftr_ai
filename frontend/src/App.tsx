import React, { useState, useEffect, useRef } from 'react';
import { ChatMessage, HealthStatus } from './types';
import { fetchHealth, sendChatMessage } from './api';
import { MessageItem } from './components/MessageItem';
import { FailoverTester } from './components/FailoverTester';

export function App() {
  // Generate a dynamic session_id on page load
  const [sessionId, setSessionId] = useState<string>(() => {
    return `s-${Math.random().toString(36).substring(2, 9)}`;
  });

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [systemPrompt, setSystemPrompt] = useState('');
  const [showSystemPrompt, setShowSystemPrompt] = useState(false);
  const [simulateRule, setSimulateRule] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);
  const [copiedSession, setCopiedSession] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  // Check health on mount
  useEffect(() => {
    fetchHealth()
      .then(setHealth)
      .catch((err) => {
        console.warn('Backend /health unreachable:', err);
      });
  }, []);

  // Handle starting a new session
  const handleNewSession = () => {
    const newId = `s-${Math.random().toString(36).substring(2, 9)}`;
    setSessionId(newId);
    setMessages([]);
    setErrorBanner(null);
    inputRef.current?.focus();
  };

  const handleCopySession = () => {
    navigator.clipboard.writeText(sessionId);
    setCopiedSession(true);
    setTimeout(() => setCopiedSession(false), 1500);
  };

  // Submit message
  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = inputText.trim();
    if (!trimmed || isLoading) return;

    setErrorBanner(null);

    // 1. Optimistically append user message to UI
    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: trimmed,
    };
    setMessages((prev) => [...prev, userMsg]);

    // Clear input immediately as required by assignment contract
    setInputText('');
    setIsLoading(true);

    try {
      // 2. Call backend POST /chat
      const response = await sendChatMessage(
        sessionId,
        trimmed,
        systemPrompt || undefined,
        simulateRule || undefined
      );

      // 3. Append assistant reply with metadata
      const assistantMsg: ChatMessage = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: response.reply,
        metadata: response.metadata,
      };
      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err: any) {
      console.error('Chat error:', err);
      const errorMsgText = err.message || 'An unexpected error occurred. Please try again.';
      setErrorBanner(`HTTP ${err.status || 500}: ${errorMsgText}`);

      // Add error message directly in chat flow so UI never crashes or goes blank
      const errorMsg: ChatMessage = {
        id: `err-${Date.now()}`,
        role: 'assistant',
        content: `Error (${err.status || 500}): ${errorMsgText}`,
        isError: true,
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <div className="flex flex-col h-screen max-w-4xl mx-auto px-4 py-3 sm:py-6 text-ink">
      {/* Top Header - Apple Frosted Mast */}
      <header className="flex items-center justify-between pb-4 border-b border-rule-subtle shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-[8px] bg-paper-2 border border-rule flex items-center justify-center shadow-sm">
            <span className="font-mono text-accent font-semibold text-sm">λ</span>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-display font-medium text-base text-ink tracking-tight">
                Lyftr AI
              </h1>
              <span className="text-[11px] font-mono text-ink-muted bg-paper-2 px-2 py-0.5 rounded-[6px] border border-rule-subtle">
                gateway
              </span>
            </div>
            <div className="flex items-center gap-2 text-xs text-ink-muted font-mono mt-0.5">
              <button
                type="button"
                onClick={handleCopySession}
                className="hover:text-ink transition-colors flex items-center gap-1"
                title="Click to copy session ID"
              >
                <span>session:</span>
                <span className="text-ink underline decoration-rule hover:decoration-ink">
                  {sessionId}
                </span>
                {copiedSession && <span className="text-[10px] text-ok">copied</span>}
              </button>
              <span className="text-ink-subtle">·</span>
              <span className="flex items-center gap-1.5">
                <span className={`w-2 h-2 rounded-full ${health?.status === 'ok' ? 'bg-ok animate-apple-pulse' : 'bg-accent'}`} />
                <span>{health?.status === 'ok' ? `${health.keys_configured} keys active` : 'connecting...'}</span>
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowSystemPrompt(!showSystemPrompt)}
            className={`px-3 py-1.5 rounded-[8px] border text-xs font-medium transition-[background-color,border-color,transform] duration-150 active:scale-[0.98] ${
              showSystemPrompt
                ? 'bg-paper-2 border-rule-2 text-ink shadow-sm'
                : 'bg-paper-2/60 border-rule-subtle hover:border-rule text-ink-muted hover:text-ink'
            }`}
            title="Configure System Prompt"
          >
            <span>system prompt</span>
          </button>

          <button
            type="button"
            onClick={handleNewSession}
            className="px-3 py-1.5 rounded-[8px] bg-paper-2/60 border border-rule-subtle hover:border-rule text-ink-muted hover:text-ink transition-[background-color,border-color,transform] duration-150 active:scale-[0.98] text-xs font-medium flex items-center gap-1.5"
            title="Start New Session"
          >
            <span>new session</span>
          </button>
        </div>
      </header>

      {/* Optional System Prompt Collapsible Panel */}
      {showSystemPrompt && (
        <div className="mt-3 p-3 bg-paper-2/80 border border-rule-subtle rounded-[12px] animate-apple-entrance text-xs">
          <label className="block text-ink-muted font-medium mb-1.5">
            System prompt override:
          </label>
          <input
            data-testid="system-prompt-input"
            type="text"
            value={systemPrompt}
            onChange={(e) => setSystemPrompt(e.target.value)}
            placeholder="e.g. You are a concise geography professor."
            className="w-full bg-paper-3 border border-rule rounded-[8px] px-3 py-2 text-ink placeholder-ink-subtle focus:outline-none focus:border-rule-2 font-mono text-xs transition-colors"
          />
        </div>
      )}

      {/* Evaluator Failover Simulation Bar */}
      <div className="mt-3">
        <FailoverTester currentRule={simulateRule} onSelectRule={setSimulateRule} />
      </div>

      {/* Global Error Banner if any */}
      {errorBanner && (
        <div className="mt-3 px-3.5 py-2.5 bg-bad-soft/60 border border-bad/40 rounded-[10px] text-xs text-ink flex items-center justify-between animate-apple-entrance">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-bad shrink-0" />
            <span>{errorBanner}</span>
          </div>
          <button
            type="button"
            onClick={() => setErrorBanner(null)}
            className="text-ink-muted hover:text-ink px-1"
          >
            ✕
          </button>
        </div>
      )}

      {/* Chat Messages Feed */}
      <main className="flex-1 overflow-y-auto py-4 px-1 space-y-2">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-6 animate-apple-entrance">
            <div className="w-12 h-12 rounded-[14px] bg-paper-2 border border-rule-subtle flex items-center justify-center mb-4 shadow-sm">
              <span className="font-mono text-accent text-lg">λ</span>
            </div>
            <h2 className="text-xl font-display font-medium text-ink tracking-tight mb-1.5">
              Resilient intelligence.
            </h2>
            <p className="text-xs max-w-md text-ink-muted leading-relaxed mb-6">
              Fault-tolerant multi-provider gateway with autonomous key rotation, local caching, and SQLite session persistence.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-w-lg w-full text-xs">
              <button
                type="button"
                onClick={() => setInputText("What is the capital of France?")}
                className="p-3 rounded-[10px] bg-paper-2/60 border border-rule-subtle hover:border-rule text-left text-ink-muted hover:text-ink transition-[background-color,border-color,transform] duration-150 active:scale-[0.98]"
              >
                What is the capital of France?
              </button>
              <button
                type="button"
                onClick={() => setInputText("Explain REST APIs in two sentences.")}
                className="p-3 rounded-[10px] bg-paper-2/60 border border-rule-subtle hover:border-rule text-left text-ink-muted hover:text-ink transition-[background-color,border-color,transform] duration-150 active:scale-[0.98]"
              >
                Explain REST APIs in two sentences.
              </button>
            </div>
          </div>
        ) : (
          messages.map((msg) => (
            <MessageItem key={msg.id} message={msg} />
          ))
        )}

        {isLoading && (
          <div className="flex justify-start mb-4 animate-apple-entrance">
            <div className="flex gap-2.5 max-w-[85%] items-center bg-paper-2/90 border border-rule px-4 py-3 rounded-[14px] rounded-bl-[4px] text-xs text-ink-muted">
              <span className="w-2 h-2 rounded-full bg-accent animate-apple-blink" />
              <span>Resolving response via LiteLLM gateway...</span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </main>

      {/* Message Input Footer - Apple Dock */}
      <footer className="pt-3 border-t border-rule-subtle shrink-0">
        <form onSubmit={handleSendMessage} className="relative flex items-center">
          <textarea
            ref={inputRef}
            data-testid="chat-input"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Send a prompt to the gateway... (Enter to send, Shift+Enter for newline)"
            rows={2}
            className="w-full bg-paper-2 border border-rule hover:border-rule-2 rounded-[16px] pl-4 pr-14 py-3 text-sm text-ink placeholder-ink-subtle focus:outline-none focus:border-rule-2 focus:ring-0 resize-none transition-[border-color,background-color] duration-150"
          />

          <button
            type="submit"
            data-testid="send-button"
            disabled={!inputText.trim() || isLoading}
            className="absolute right-3 bottom-3.5 w-8 h-8 rounded-full bg-accent disabled:bg-paper-3 text-accent-ink disabled:text-ink-subtle border border-accent disabled:border-rule-subtle flex items-center justify-center transition-[transform,background-color,opacity] duration-150 active:scale-90 disabled:opacity-40 shadow-sm"
            title="Send Message"
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
        </form>

        <div className="flex items-center justify-between mt-2.5 text-[11px] text-ink-subtle px-1 font-mono">
          <span>SQLite persistence ./data/app.db</span>
          <span>LiteLLM gateway key rotation & cache</span>
        </div>
      </footer>
    </div>
  );
}

export default App;
