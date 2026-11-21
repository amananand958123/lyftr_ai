import React, { useState } from 'react';
import { Sun, Moon } from 'lucide-react';
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
              <span className={`w-2 h-2 rounded-full ${health ? 'bg-ok animate-apple-pulse' : 'bg-ink-subtle'} group-hover:scale-125 transition-transform`} />
              <span className="text-ink-muted group-hover:text-ink font-mono text-[11px] underline decoration-rule-subtle group-hover:decoration-ink">
                {health ? `${health.keys_configured} keys active` : 'connecting...'}
              </span>
            </button>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-1.5">
        <HeaderButton onClick={onOpenSessionDrawer} title="Browse past stored sessions (⌘S)">
          history
        </HeaderButton>
        <HeaderButton onClick={() => setShowTuning((open) => !open)} active={showTuning} title="Adjust Temperature & Max Tokens">
          tuning
        </HeaderButton>
        <HeaderButton onClick={() => setShowSystemPrompt((open) => !open)} active={showSystemPrompt} title="Configure System Prompt">
          system prompt
        </HeaderButton>
        <HeaderButton onClick={onNewSession} title="Start New Session (⌘N)">
          new
        </HeaderButton>

        <HeaderButton onClick={onToggleTheme} title={isDark ? 'Switch to Light Mode (⌘D)' : 'Switch to Dark Mode (⌘D)'}>
          {isDark ? <Sun className="w-3.5 h-3.5 text-accent" /> : <Moon className="w-3.5 h-3.5 text-accent" />}
          <span>{isDark ? 'light' : 'dark'}</span>
        </HeaderButton>

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

// One small toolbar button. `active` = highlighted, for the toggles that open a panel.
function HeaderButton({ onClick, title, active = false, children }: {
  onClick: () => void;
  title: string;
  active?: boolean;
  children: React.ReactNode;
}) {
  const colors = active
    ? 'bg-paper-2 border-rule-2 text-ink shadow-sm'
    : 'bg-paper-2/60 border-rule-subtle hover:border-rule text-ink-muted hover:text-ink';
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={`px-2.5 py-1.5 rounded-[8px] border text-xs font-medium flex items-center gap-1.5 transition-[background-color,border-color,transform] duration-150 active:scale-[0.98] ${colors}`}
    >
      {children}
    </button>
  );
}
