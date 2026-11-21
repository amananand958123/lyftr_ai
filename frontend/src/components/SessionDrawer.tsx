import React, { useState, useEffect } from 'react';
import { SessionSummary } from '../types';
import { fetchSessions, deleteSession } from '../api';

interface SessionDrawerProps {
  isOpen: boolean;
  activeSessionId: string;
  onClose: () => void;
  onSelectSession: (sessionId: string) => void;
}

export const SessionDrawer: React.FC<SessionDrawerProps> = ({
  isOpen,
  activeSessionId,
  onClose,
  onSelectSession,
}) => {
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [filterQuery, setFilterQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setIsLoading(true);
      fetchSessions(50, 0)
        .then((data) => setSessions(data.sessions))
        .catch((err) => console.error('Failed to load sessions:', err))
        .finally(() => setIsLoading(false));
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    try {
      await deleteSession(id);
      setSessions((prev) => prev.filter((s) => s.session_id !== id));
    } catch (err) {
      console.error('Failed to delete session:', err);
    }
  };

  const filtered = sessions.filter((s) => {
    const q = filterQuery.toLowerCase();
    return s.session_id.toLowerCase().includes(q) || (s.last_message_preview || '').toLowerCase().includes(q);
  });

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      {/* Drawer content */}
      <div className="relative w-full max-w-sm bg-paper-2 border-l border-rule h-full flex flex-col shadow-2xl z-10 animate-apple-entrance">
        <div className="p-4 border-b border-rule-subtle flex items-center justify-between">
          <div>
            <h3 className="font-display font-medium text-ink text-sm">Stored Sessions</h3>
            <p className="text-[11px] text-ink-subtle">SQLite ./data/app.db</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-ink-muted hover:text-ink px-2 py-1 text-xs"
            aria-label="Close session drawer"
          >
            ✕
          </button>
        </div>

        <div className="p-3 border-b border-rule-subtle">
          <input
            type="text"
            placeholder="Search sessions..."
            value={filterQuery}
            onChange={(e) => setFilterQuery(e.target.value)}
            className="w-full bg-paper-3 border border-rule-subtle rounded-[8px] px-3 py-1.5 text-xs text-ink placeholder-ink-subtle focus:outline-none focus:border-rule"
          />
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {isLoading ? (
            <div className="text-center p-6 text-xs text-ink-subtle">Loading conversations...</div>
          ) : filtered.length === 0 ? (
            <div className="text-center p-6 text-xs text-ink-subtle">No stored sessions found</div>
          ) : (
            filtered.map((s) => {
              const isActive = s.session_id === activeSessionId;
              return (
                <div
                  key={s.session_id}
                  onClick={() => {
                    onSelectSession(s.session_id);
                    onClose();
                  }}
                  className={`p-2.5 rounded-[10px] border cursor-pointer transition-[background-color,border-color] duration-150 flex items-start justify-between gap-2 ${
                    isActive
                      ? 'bg-paper-3 border-rule-2 text-ink shadow-sm'
                      : 'bg-paper-3/40 border-rule-subtle hover:border-rule text-ink-muted hover:text-ink hover:bg-paper-3/70'
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <span className="font-mono text-[11px] font-medium text-ink truncate">
                        {s.session_id}
                      </span>
                      {isActive && (
                        <span className="text-[9px] font-mono text-accent bg-accent-soft px-1.5 py-0.2 rounded">
                          active
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-ink-subtle truncate">
                      {s.last_message_preview || 'Empty session'}
                    </p>
                    <div className="text-[10px] text-ink-subtle mt-1 flex items-center gap-2">
                      <span>{s.message_count} msgs</span>
                      {s.last_active_at && (
                        <span>{new Date(s.last_active_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      )}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={(e) => handleDelete(e, s.session_id)}
                    className="text-ink-subtle hover:text-bad p-1 rounded text-xs transition-colors"
                    title="Delete session"
                    aria-label={`Delete session ${s.session_id}`}
                  >
                    ✕
                  </button>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
