import React, { useState, useEffect, useRef } from 'react';
import { HealthStatus } from './types';
import { fetchHealth, clearCache } from './api';
import { useTheme } from './hooks/useTheme';
import { useChatSession } from './hooks/useChatSession';
import { Header } from './components/Header';
import { ChatInput } from './components/ChatInput';
import { MessageItem } from './components/MessageItem';
import { FailoverTester } from './components/FailoverTester';
import { PromptPresets } from './components/PromptPresets';
import { TuningDrawer } from './components/TuningDrawer';
import { SessionDrawer } from './components/SessionDrawer';
import { TelemetryHUD } from './components/TelemetryHUD';
import { CommandPalette, CommandItem } from './components/CommandPalette';
import { exportSessionMarkdown, exportSessionJSON } from './utils/export';

const STARTER_PROMPTS = ['What is the capital of France?', 'Write a Python binary search function.'];

export function App() {
  const { isDark, toggleTheme } = useTheme();
  const {
    sessionId,
    messages,
    isLoading,
    errorBanner,
    setErrorBanner,
    handleNewSession,
    handleSelectSession,
    sendMessage,
    regenerateLast,
    stopStreaming,
    cumulativeTokens,
    latencyPoints,
  } = useChatSession();

  const [inputText, setInputText] = useState('');
  const [systemPrompt, setSystemPrompt] = useState('');
  const [showSystemPrompt, setShowSystemPrompt] = useState(true);
  const [showTuning, setShowTuning] = useState(false);
  const [showSessionDrawer, setShowSessionDrawer] = useState(false);
  const [showCommandPalette, setShowCommandPalette] = useState(false);
  const [showTelemetryHUD, setShowTelemetryHUD] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const [temperature, setTemperature] = useState(0.7);
  const [maxTokens, setMaxTokens] = useState(2048);
  const [simulateRule, setSimulateRule] = useState('');
  const [health, setHealth] = useState<HealthStatus | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const mainRef = useRef<HTMLElement>(null);
  const isAtBottomRef = useRef(true);

  const handleScroll = () => {
    if (mainRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = mainRef.current;
      isAtBottomRef.current = scrollHeight - scrollTop - clientHeight < 40;
    }
  };

  useEffect(() => {
    if (isAtBottomRef.current && mainRef.current) {
      mainRef.current.scrollTop = mainRef.current.scrollHeight;
    }
  }, [messages, isLoading]);

  // Ask the backend for /health now and then every 30 seconds.
  // Pause polling when document.hidden to prevent draining Render free hours.
  useEffect(() => {
    let intervalId: any = null;

    const checkHealth = () => {
      if (!document.hidden) {
        fetchHealth().then(setHealth).catch(() => setHealth(null));
      }
    };

    const startPolling = () => {
      checkHealth();
      if (!intervalId) {
        intervalId = setInterval(checkHealth, 30000);
      }
    };

    const stopPolling = () => {
      if (intervalId) {
        clearInterval(intervalId);
        intervalId = null;
      }
    };

    const handleVisibilityChange = () => {
      if (document.hidden) {
        stopPolling();
      } else {
        startPolling();
      }
    };

    startPolling();
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      stopPolling();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  // Keyboard shortcuts: Cmd/Ctrl/Option + letter runs an action, Escape closes any open panel.
  useEffect(() => {
    const shortcuts: Record<string, () => void> = {
      k: () => setShowCommandPalette((open) => !open),
      t: () => setShowTelemetryHUD((open) => !open),
      s: () => setShowSessionDrawer(true),
      n: handleNewSession,
      d: toggleTheme,
      e: () => exportSessionMarkdown(sessionId, messages),
      j: () => exportSessionJSON(sessionId, messages),
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowTelemetryHUD(false);
        setShowSessionDrawer(false);
        setShowCommandPalette(false);
        return;
      }
      const isAlt = e.altKey;
      const isCmdOrCtrl = e.metaKey || e.ctrlKey;
      const key = e.key.toLowerCase();

      // Chrome steals ⌘T and ⌘N for browser tabs/windows; support ⌥T / Alt+T and ⌥N / Alt+N
      if ((isCmdOrCtrl || isAlt) && key === 'n') {
        e.preventDefault();
        handleNewSession();
      } else if ((isCmdOrCtrl || isAlt) && key === 't') {
        e.preventDefault();
        setShowTelemetryHUD((open) => !open);
      } else if (isCmdOrCtrl && shortcuts[key]) {
        e.preventDefault();
        shortcuts[key]();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [sessionId, messages, handleNewSession, toggleTheme]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handlePurgeCache = async () => {
    try {
      await clearCache();
      showToast('Gateway cache successfully purged');
    } catch (err: any) {
      setErrorBanner(`Failed to purge cache: ${err.message || 'unknown error'}`);
    }
  };

  const sendOptions = { systemPrompt, simulateRule, temperature, maxTokens };

  // Sends the typed text, or `presetText` when a starter prompt button is clicked.
  const handleSend = (e?: React.FormEvent, presetText?: string) => {
    e?.preventDefault();
    const text = presetText ?? inputText.trim();
    if (!text) return;
    if (presetText === undefined) setInputText('');
    sendMessage(text, sendOptions);
  };

  const handleRegenerate = () => regenerateLast(sendOptions);

  const commandList: CommandItem[] = [
    { id: 'view-telemetry', title: 'Open Gateway Telemetry & Cache HUD', category: 'Gateway', shortcut: '⌥T / ⌘T', action: () => setShowTelemetryHUD(true) },
    { id: 'new-sess', title: 'Start New Session', category: 'Session', shortcut: '⌥N / ⌘N', action: handleNewSession },
    { id: 'view-sess', title: 'Open Stored Sessions', category: 'Session', shortcut: '⌘S', action: () => setShowSessionDrawer(true) },
    { id: 'toggle-theme', title: isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode', category: 'Theme', shortcut: '⌘D', action: toggleTheme },
    { id: 'export-md', title: 'Export Transcript (Markdown)', category: 'Export', shortcut: '⌘E', action: () => exportSessionMarkdown(sessionId, messages) },
    { id: 'export-json', title: 'Export Transcript (JSON)', category: 'Export', shortcut: '⌘J', action: () => exportSessionJSON(sessionId, messages) },
    { id: 'toggle-sys', title: 'Toggle System Prompt', category: 'Config', action: () => setShowSystemPrompt((p) => !p) },
    { id: 'toggle-tune', title: 'Toggle Hyperparameters Tuning', category: 'Config', action: () => setShowTuning((p) => !p) },
    { id: 'sim-norm', title: 'Failover: Normal Direct Execution', category: 'Failover', action: () => setSimulateRule('') },
    { id: 'sim-429', title: 'Failover: Simulate Rate Limit (key_1=429)', category: 'Failover', action: () => setSimulateRule('key_1=429') },
    { id: 'sim-500', title: 'Failover: Simulate Internal Error (key_1=500)', category: 'Failover', action: () => setSimulateRule('key_1=500') },
    { id: 'sim-all', title: 'Failover: Simulate Total Outage (*=429)', category: 'Failover', action: () => setSimulateRule('*=429') },
    { id: 'clear-cache', title: 'Purge Gateway Cache', category: 'Cache', action: handlePurgeCache },
  ];

  return (
    <div className="flex flex-col h-screen max-w-4xl mx-auto px-4 py-3 sm:py-6 text-ink">
      <Header
        sessionId={sessionId}
        health={health}
        showTuning={showTuning}
        setShowTuning={setShowTuning}
        showSystemPrompt={showSystemPrompt}
        setShowSystemPrompt={setShowSystemPrompt}
        onNewSession={handleNewSession}
        onOpenSessionDrawer={() => setShowSessionDrawer(true)}
        onOpenCommandPalette={() => setShowCommandPalette(true)}
        onOpenTelemetryHUD={() => setShowTelemetryHUD(true)}
        isDark={isDark}
        onToggleTheme={toggleTheme}
      />

      {showTuning && (
        <TuningDrawer
          temperature={temperature}
          maxTokens={maxTokens}
          onTemperatureChange={setTemperature}
          onMaxTokensChange={setMaxTokens}
        />
      )}

      {showSystemPrompt && (
        <div className="mt-2.5 p-3 bg-paper-2/80 border border-rule-subtle rounded-[12px] animate-apple-entrance text-xs">
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
          <PromptPresets onSelectPreset={setSystemPrompt} />
        </div>
      )}

      <div className="mt-2.5">
        <FailoverTester currentRule={simulateRule} onSelectRule={setSimulateRule} />
      </div>

      {errorBanner && (
        <div className="mt-2.5 px-3.5 py-2.5 bg-bad-soft/60 border border-bad/40 rounded-[10px] text-xs text-ink flex items-center justify-between animate-apple-entrance">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-bad shrink-0" />
            <span>{errorBanner}</span>
          </div>
          <button
            type="button"
            onClick={() => setErrorBanner(null)}
            className="text-[11px] font-mono text-ink-subtle hover:text-ink transition-colors"
          >
            dismiss
          </button>
        </div>
      )}

      <main
        ref={mainRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto my-3 sm:my-4 pr-1 sm:pr-2 space-y-4"
      >
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-6 sm:p-10 text-ink-muted max-w-md mx-auto animate-apple-entrance">
            <div className="w-12 h-12 rounded-2xl bg-paper-2 border border-rule flex items-center justify-center mb-4 shadow-sm">
              <span className="font-mono text-accent text-xl font-semibold">λ</span>
            </div>
            <h2 className="text-base font-semibold text-ink mb-1.5 tracking-tight font-display">
              Resilient intelligence.
            </h2>
            <p className="text-xs text-ink-subtle leading-relaxed mb-6 font-body">
              Fault-tolerant multi-provider gateway with autonomous key rotation, local caching, and SQLite session persistence.
            </p>

            <div className="grid grid-cols-1 gap-2 w-full text-xs font-mono">
              {STARTER_PROMPTS.map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  onClick={() => handleSend(undefined, prompt)}
                  className="p-3 rounded-[10px] bg-paper-2/60 border border-rule-subtle hover:border-rule text-left text-ink-muted hover:text-ink transition-[background-color,border-color,transform] duration-150 active:scale-[0.98]"
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((msg, idx) => (
            <MessageItem
              key={msg.id}
              message={msg}
              cumulativeTokens={cumulativeTokens}
              onRegenerate={idx === messages.length - 1 && msg.role === 'assistant' ? handleRegenerate : undefined}
            />
          ))
        )}

        {/* "Thinking" indicator until the first words of the reply arrive */}
        {isLoading && !messages.some((m) => m.isStreaming) && (
          <div className="flex justify-start mb-4 animate-apple-entrance">
            <div className="flex gap-2.5 max-w-[85%] items-center bg-paper-2/90 border border-rule px-4 py-3 rounded-[14px] rounded-bl-[4px] text-xs text-ink-muted">
              <span className="w-2 h-2 rounded-full bg-accent animate-apple-blink" />
              <span>Resolving response via LiteLLM gateway...</span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </main>

      <ChatInput
        inputText={inputText}
        setInputText={setInputText}
        onSubmit={handleSend}
        isLoading={isLoading}
        onStop={stopStreaming}
        sessionId={sessionId}
        messages={messages}
        latencyPoints={latencyPoints}
      />

      <SessionDrawer
        isOpen={showSessionDrawer}
        activeSessionId={sessionId}
        onClose={() => setShowSessionDrawer(false)}
        onSelectSession={handleSelectSession}
      />

      <TelemetryHUD
        isOpen={showTelemetryHUD}
        onClose={() => setShowTelemetryHUD(false)}
        health={health}
        messages={messages}
        cumulativeTokens={cumulativeTokens}
      />

      <CommandPalette
        isOpen={showCommandPalette}
        onClose={() => setShowCommandPalette(false)}
        commands={commandList}
      />

      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 px-4 py-2.5 bg-paper-2 border border-rule shadow-lg rounded-[10px] text-xs font-mono text-ok flex items-center gap-2 animate-apple-entrance">
          <span className="w-2 h-2 rounded-full bg-ok" />
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
}

export default App;
