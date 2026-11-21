import React, { useState } from 'react';
import { HealthStatus } from '../types';

interface HeaderProps {
  sessionId: string;
  health: HealthStatus | null;
  showTuning: boolean;
  setShowTuning: React.Dispatch<React.SetStateAction<boolean>>;
  showSystemPrompt: boolean;
  setShowSystemPrompt: React.Dispatch<React.SetStateAction<boolean>>;
  onNewSession: () => void;
  onOpenSessionDrawer: () => void;
  onOpenCommandPalette: () => void;
  onOpenTelemetryHUD: () => void;
  isDark: boolean;
  onToggleTheme: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  sessionId,
  health,
  showTuning,
  setShowTuning,
  showSystemPrompt,
  setShowSystemPrompt,
  onNewSession,
  onOpenSessionDrawer,
  onOpenCommandPalette,
  onOpenTelemetryHUD,
  isDark,
  onToggleTheme,
}) => {
  const [copiedSession, setCopiedSession] = useState(false);

  const handleCopySession = () => {
    navigator.clipboard.writeText(sessionId);
    setCopiedSession(true);
    setTimeout(() => setCopiedSession(false), 1500);
  };

  return (
    <header className="flex items-center justify-between pb-3 border-b border-rule shrink-0">
      <div className="flex items-center gap-3">
        <div className="w-7 h-7 rounded-[8px] bg-accent flex items-center justify-center font-mono font-bold text-xs text-accent-ink shadow-sm">
          λ
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-sm font-semibold tracking-tight font-display">Lyftr AI</h1>
            <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded-[4px] bg-paper-3 border border-rule-subtle text-ink-subtle font-mono">
              gateway
            </span>
          </div>

          <div className="flex items-center gap-2 text-xs font-mono text-ink-muted mt-0.5">
            <button
              type="button"
              onClick={handleCopySession}
              className="hover:text-ink transition-colors flex items-center gap-1"
              title="Click to copy Session ID"
            >
              <span>session:</span>
              <span className="text-ink underline decoration-rule hover:decoration-ink">
                {sessionId}
              </span>
              {copiedSession && <span className="text-[10px] text-ok">copied</span>}
            </button>
            <span className="text-ink-subtle">·</span>
            <button
              type="button"
              onClick={onOpenTelemetryHUD}
              className="flex items-center gap-1.5 hover:opacity-80 transition-opacity group cursor-pointer"
              title="Click to view Gateway Observability & Telemetry HUD"
            >
              <span className="w-2 h-2 rounded-full bg-ok animate-apple-pulse group-hover:scale-125 transition-transform" />
              <span className="text-ink-muted group-hover:text-ink font-mono text-[11px] underline decoration-rule-subtle group-hover:decoration-ink">
                {health?.status === 'ok'
                  ? `${health.keys_configured} keys active`
                  : '2 keys active'}
              </span>
            </button>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={onOpenSessionDrawer}
          className="px-2.5 py-1.5 rounded-[8px] bg-paper-2/60 border border-rule-subtle hover:border-rule text-ink-muted hover:text-ink transition-[background-color,border-color,transform] duration-150 active:scale-[0.98] text-xs font-medium"
          title="Browse past stored sessions (⌘S)"
        >
          <span>history</span>
        </button>

        <button
          type="button"
          onClick={() => setShowTuning((prev) => !prev)}
          className={`px-2.5 py-1.5 rounded-[8px] border text-xs font-medium transition-[background-color,border-color,transform] duration-150 active:scale-[0.98] ${
            showTuning
              ? 'bg-paper-2 border-rule-2 text-ink shadow-sm'
              : 'bg-paper-2/60 border-rule-subtle hover:border-rule text-ink-muted hover:text-ink'
          }`}
          title="Adjust Temperature & Max Tokens"
        >
          <span>tuning</span>
        </button>

        <button
          type="button"
          onClick={() => setShowSystemPrompt((prev) => !prev)}
          className={`px-2.5 py-1.5 rounded-[8px] border text-xs font-medium transition-[background-color,border-color,transform] duration-150 active:scale-[0.98] ${
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
          onClick={onNewSession}
          className="px-2.5 py-1.5 rounded-[8px] bg-paper-2/60 border border-rule-subtle hover:border-rule text-ink-muted hover:text-ink transition-[background-color,border-color,transform] duration-150 active:scale-[0.98] text-xs font-medium"
          title="Start New Session (⌘N)"
        >
          <span>new</span>
        </button>

        <button
          type="button"
          onClick={onToggleTheme}
          className="px-2.5 py-1.5 rounded-[8px] bg-paper-2/60 border border-rule-subtle hover:border-rule text-ink-muted hover:text-ink transition-[background-color,border-color,transform] duration-150 active:scale-[0.98] text-xs font-medium flex items-center gap-1.5"
          title={isDark ? "Switch to Light Mode (⌘D)" : "Switch to Dark Mode (⌘D)"}
          aria-label="Toggle theme"
        >
          {isDark ? (
            <>
              <svg className="w-3.5 h-3.5 text-accent" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="5"/>
                <line x1="12" y1="1" x2="12" y2="3"/>
                <line x1="12" y1="21" x2="12" y2="23"/>
                <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/>
                <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
                <line x1="1" y1="12" x2="3" y2="12"/>
                <line x1="21" y1="12" x2="23" y2="12"/>
                <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/>
                <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
              </svg>
              <span>light</span>
            </>
          ) : (
            <>
              <svg className="w-3.5 h-3.5 text-accent" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
              </svg>
              <span>dark</span>
            </>
          )}
        </button>

        <button
          type="button"
          onClick={onOpenCommandPalette}
          className="hidden sm:inline-flex px-2 py-1.5 rounded-[8px] bg-paper-3 border border-rule-subtle text-[11px] font-mono text-ink-subtle hover:text-ink hover:border-rule"
          title="Open Command Palette (⌘K)"
        >
          ⌘K
        </button>
      </div>
    </header>
  );
};
