import React, { useState, useRef, useEffect } from 'react';
import { Sun, Moon, MoreHorizontal } from 'lucide-react';
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
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMobileMenuOpen(false);
      }
    };
    if (mobileMenuOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
    }
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [mobileMenuOpen]);

  const handleCopySession = () => {
    if (!navigator.clipboard?.writeText) return;
    navigator.clipboard.writeText(sessionId).then(() => {
      setCopiedSession(true);
      setTimeout(() => setCopiedSession(false), 1500);
    }).catch((err) => {
      console.warn('Failed to copy session id to clipboard:', err);
    });
  };

  return (
    <header className="flex items-center justify-between pb-3 border-b border-rule shrink-0 relative">
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
              <span className="text-ink underline decoration-rule hover:decoration-ink truncate max-w-[120px] sm:max-w-none">
                {sessionId}
              </span>
              {copiedSession && <span className="text-[10px] text-ok">copied</span>}
            </button>
            <span className="text-ink-subtle">·</span>
            <button
              type="button"
              onClick={onOpenTelemetryHUD}
              className="flex items-center gap-1.5 hover:opacity-80 transition-opacity group cursor-pointer"
              title="Click to view Gateway Observability & Telemetry HUD (⌥T or ⌘T)"
            >
              <span className={`w-2 h-2 rounded-full ${health ? 'bg-ok animate-apple-pulse' : 'bg-ink-subtle'} group-hover:scale-125 transition-transform`} />
              <span className="text-ink-muted group-hover:text-ink font-mono text-[11px] underline decoration-rule-subtle group-hover:decoration-ink">
                {health ? `${health.keys_configured} keys active` : 'connecting...'}
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* Desktop navigation buttons */}
      <div className="hidden sm:flex items-center gap-1.5">
        <HeaderButton onClick={onOpenSessionDrawer} title="Browse past stored sessions (⌘S)">
          history
        </HeaderButton>
        <HeaderButton onClick={() => setShowTuning((open) => !open)} active={showTuning} title="Adjust Temperature & Max Tokens">
          tuning
        </HeaderButton>
        <HeaderButton onClick={() => setShowSystemPrompt((open) => !open)} active={showSystemPrompt} title="Configure System Prompt">
          system prompt
        </HeaderButton>
        <HeaderButton onClick={onNewSession} title="Start New Session (⌥N or ⌘N)">
          new
        </HeaderButton>

        <HeaderButton onClick={onToggleTheme} title={isDark ? 'Switch to Light Mode (⌘D)' : 'Switch to Dark Mode (⌘D)'}>
          {isDark ? <Sun className="w-3.5 h-3.5 text-accent" /> : <Moon className="w-3.5 h-3.5 text-accent" />}
          <span>{isDark ? 'light' : 'dark'}</span>
        </HeaderButton>

        <button
          type="button"
          onClick={onOpenCommandPalette}
          className="inline-flex px-2 py-1.5 rounded-[8px] bg-paper-3 border border-rule-subtle text-[11px] font-mono text-ink-subtle hover:text-ink hover:border-rule"
          title="Open Command Palette (⌘K)"
        >
          ⌘K
        </button>
      </div>

      {/* Mobile navigation with ⋯ menu (Item 53) */}
      <div className="flex sm:hidden items-center gap-1.5" ref={menuRef}>
        <HeaderButton onClick={onNewSession} title="Start New Session (⌥N)">
          new
        </HeaderButton>
        <HeaderButton onClick={onToggleTheme} title="Toggle Theme">
          {isDark ? <Sun className="w-3.5 h-3.5 text-accent" /> : <Moon className="w-3.5 h-3.5 text-accent" />}
        </HeaderButton>
        <button
          type="button"
          onClick={() => setMobileMenuOpen((p) => !p)}
          className={`p-1.5 rounded-[8px] border text-xs font-medium transition-[background-color,border-color] ${
            mobileMenuOpen ? 'bg-paper-2 border-rule-2 text-ink' : 'bg-paper-2/60 border-rule-subtle text-ink-muted'
          }`}
          title="More actions"
          aria-label="More actions"
          aria-expanded={mobileMenuOpen}
        >
          <MoreHorizontal className="w-4 h-4" />
        </button>

        {mobileMenuOpen && (
          <div className="absolute right-0 top-12 z-50 w-48 bg-paper-2 border border-rule rounded-[10px] shadow-xl p-1.5 flex flex-col gap-1 text-xs animate-apple-entrance">
            <button
              type="button"
              onClick={() => {
                setMobileMenuOpen(false);
                onOpenSessionDrawer();
              }}
              className="w-full text-left px-2.5 py-1.5 rounded-[6px] hover:bg-paper-3 text-ink flex items-center justify-between"
            >
              <span>Stored History</span>
              <span className="text-[10px] font-mono text-ink-subtle">⌘S</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setMobileMenuOpen(false);
                setShowTuning((p) => !p);
              }}
              className="w-full text-left px-2.5 py-1.5 rounded-[6px] hover:bg-paper-3 text-ink"
            >
              Tuning Settings
            </button>
            <button
              type="button"
              onClick={() => {
                setMobileMenuOpen(false);
                setShowSystemPrompt((p) => !p);
              }}
              className="w-full text-left px-2.5 py-1.5 rounded-[6px] hover:bg-paper-3 text-ink"
            >
              System Prompt
            </button>
            <button
              type="button"
              onClick={() => {
                setMobileMenuOpen(false);
                onOpenTelemetryHUD();
              }}
              className="w-full text-left px-2.5 py-1.5 rounded-[6px] hover:bg-paper-3 text-ink"
            >
              Telemetry HUD
            </button>
            <button
              type="button"
              onClick={() => {
                setMobileMenuOpen(false);
                onOpenCommandPalette();
              }}
              className="w-full text-left px-2.5 py-1.5 rounded-[6px] hover:bg-paper-3 text-ink flex items-center justify-between border-t border-rule-subtle pt-1 mt-0.5"
            >
              <span>Command Palette</span>
              <span className="text-[10px] font-mono text-ink-subtle">⌘K</span>
            </button>
          </div>
        )}
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
