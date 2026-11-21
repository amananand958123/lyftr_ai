import React, { useState, useEffect, useRef, useMemo } from 'react';
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

  const [temperature, setTemperature] = useState(0.7);
  const [maxTokens, setMaxTokens] = useState(2048);
  const [simulateRule, setSimulateRule] = useState('');
  const [health, setHealth] = useState<HealthStatus | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  // Real-time Heartbeat Polling (US-011)
  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout>;
    let isMounted = true;

    const checkHealth = () => {
      fetchHealth()
        .then((h) => {
          if (!isMounted) return;
          setHealth(h);
          timeoutId = setTimeout(checkHealth, 30000);
        })
        .catch(() => {
          if (!isMounted) return;
          timeoutId = setTimeout(checkHealth, 10000);
        });
    };

    checkHealth();
    return () => {
      isMounted = false;
      clearTimeout(timeoutId);
    };
  }, []);

  // Global Keyboard Shortcuts (Cmd+K, Cmd+T, Cmd+N, Cmd+D, etc.)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isCmdOrCtrl = e.metaKey || e.ctrlKey;
      if (!isCmdOrCtrl) return;

      if (e.key === 'k') {
        e.preventDefault();
        setShowCommandPalette((prev) => !prev);
      } else if (e.key === 't') {
        e.preventDefault();
        setShowTelemetryHUD((prev) => !prev);
      } else if (e.key === 'n') {
        e.preventDefault();
        handleNewSession();
      } else if (e.key === 'd') {
        e.preventDefault();
        toggleTheme();
      } else if (e.key === 'e') {
        e.preventDefault();
        exportSessionMarkdown(sessionId, messages);
      } else if (e.key === 'j') {
        e.preventDefault();
        exportSessionJSON(sessionId, messages);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [sessionId, messages, handleNewSession, toggleTheme]);

  const handleSend = (e?: React.FormEvent, customPrompt?: string) => {
    if (e) e.preventDefault();
    const text = customPrompt !== undefined ? customPrompt : inputText.trim();
    if (!text) return;
    if (customPrompt === undefined) setInputText('');

    sendMessage(text, {
      systemPrompt,
      simulateRule,
      temperature,
      maxTokens,
    });
  };

  const handleRegenerate = () => {
    regenerateLast({
      systemPrompt,
      simulateRule,
      temperature,
      maxTokens,
    });
  };

  const commandList: CommandItem[] = useMemo(() => [
    { id: 'view-telemetry', title: 'Open Gateway Telemetry & Cache HUD', category: 'Gateway', shortcut: '⌘T', action: () => setShowTelemetryHUD(true) },
    { id: 'new-sess', title: 'Start New Session', category: 'Session', shortcut: '⌘N', action: handleNewSession },
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
    { id: 'clear-cache', title: 'Purge Gateway Cache', category: 'Cache', action: () => clearCache() },
  ], [sessionId, messages, isDark, handleNewSession, toggleTheme]);

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

      <main className="flex-1 overflow-y-auto my-3 sm:my-4 pr-1 sm:pr-2 space-y-4">
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
              <button
                type="button"
                onClick={() => handleSend(undefined, "What is the capital of France?")}
                className="p-3 rounded-[10px] bg-paper-2/60 border border-rule-subtle hover:border-rule text-left text-ink-muted hover:text-ink transition-[background-color,border-color,transform] duration-150 active:scale-[0.98]"
              >
                What is the capital of France?
              </button>
              <button
                type="button"
                onClick={() => handleSend(undefined, "Write a Python binary search function.")}
                className="p-3 rounded-[10px] bg-paper-2/60 border border-rule-subtle hover:border-rule text-left text-ink-muted hover:text-ink transition-[background-color,border-color,transform] duration-150 active:scale-[0.98]"
              >
                Write a Python binary search function.
              </button>
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

      <ChatInput
        inputText={inputText}
        setInputText={setInputText}
        onSubmit={handleSend}
        isLoading={isLoading}
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
    </div>
  );
}

export default App;
