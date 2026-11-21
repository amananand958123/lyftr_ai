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
  const [sessionTitles, setSessionTitles] = useState<Record<string, string>>(() => {
    try {
      const stored = localStorage.getItem('lyftr_session_titles');
      return stored ? JSON.parse(stored) : {};
    } catch {
      return {};
    }
  });

  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [editTitleInput, setEditTitleInput] = useState('');

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

  const handleStartRename = (e: React.MouseEvent, id: string, currentTitle: string) => {
    e.stopPropagation();
    setEditingSessionId(id);
    setEditTitleInput(currentTitle || id);
  };

  const handleSaveRename = (e: React.FormEvent, id: string) => {
    e.preventDefault();
    e.stopPropagation();
    const updated = { ...sessionTitles, [id]: editTitleInput.trim() || id };
    setSessionTitles(updated);
    try {
      localStorage.setItem('lyftr_session_titles', JSON.stringify(updated));
    } catch (err) {
      console.error('Failed to persist session title:', err);
    }
    setEditingSessionId(null);
  };

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    try {
      await deleteSession(id);
      setSessions((prev) => prev.filter((s) => s.session_id !== id));
      const updated = { ...sessionTitles };
      delete updated[id];
      setSessionTitles(updated);
      localStorage.setItem('lyftr_session_titles', JSON.stringify(updated));
    } catch (err) {
      console.error('Failed to delete session:', err);
    }
  };

  const formatRelativeTime = (isoString?: string) => {
    if (!isoString) return 'recently';
    const date = new Date(isoString);
    const now = new Date();
    const diffSec = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diffSec < 60) return 'just now';
    if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
    if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  };

  const filtered = sessions.filter((s) => {
    const q = filterQuery.toLowerCase();
    const customTitle = (sessionTitles[s.session_id] || '').toLowerCase();
    return (
      s.session_id.toLowerCase().includes(q) ||
      customTitle.includes(q) ||
      (s.last_message_preview || '').toLowerCase().includes(q)
    );
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
            <p className="text-[11px] text-ink-subtle font-mono">SQLite ./data/app.db</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-ink-muted hover:text-ink px-2 py-1 text-xs rounded hover:bg-paper-3 transition-colors"
            aria-label="Close session drawer"
          >
            ✕
          </button>
        </div>

        <div className="p-3 border-b border-rule-subtle">
          <input
            type="text"
            placeholder="Search sessions or topics..."
            value={filterQuery}
            onChange={(e) => setFilterQuery(e.target.value)}
            className="w-full bg-paper-3 border border-rule-subtle rounded-[8px] px-3 py-1.5 text-xs text-ink placeholder-ink-subtle focus:outline-none focus:border-rule transition-colors"
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
              const title = sessionTitles[s.session_id] || s.session_id;
              const isEditing = editingSessionId === s.session_id;

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
                      : 'bg-paper-3/40 border-rule-subtle hover:border-rule text-ink-muted hover:text-ink'
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    {isEditing ? (
                      <form onSubmit={(e) => handleSaveRename(e, s.session_id)} className="flex items-center gap-1 mb-1">
                        <input
                          type="text"
                          value={editTitleInput}
                          onChange={(e) => setEditTitleInput(e.target.value)}
                          className="bg-paper-2 border border-rule px-1.5 py-0.5 rounded text-xs text-ink font-mono w-full"
                          autoFocus
                          onBlur={(e) => handleSaveRename(e, s.session_id)}
                        />
                        <button type="submit" className="text-[10px] text-ok px-1">✓</button>
                      </form>
                    ) : (
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono text-xs font-semibold text-ink truncate">
                          {title}
                        </span>
                        <button
                          type="button"
                          onClick={(e) => handleStartRename(e, s.session_id, title)}
                          className="text-[10px] text-ink-subtle hover:text-ink opacity-0 group-hover:opacity-100 transition-opacity"
                          title="Rename session"
                        >
                          ✎
                        </button>
                      </div>
                    )}

                    <div className="text-[11px] text-ink-subtle truncate mt-0.5">
                      {s.last_message_preview || 'No messages'}
                    </div>

                    <div className="flex items-center gap-2 mt-1.5 text-[10px] text-ink-subtle font-mono">
                      <span>{s.message_count} msgs</span>
                      <span>·</span>
                      <span>{formatRelativeTime(s.last_active_at || undefined)}</span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={(e) => handleDelete(e, s.session_id)}
                    className="text-ink-subtle hover:text-bad p-1 rounded hover:bg-paper-2 transition-colors text-xs"
                    title="Delete session"
                    aria-label={`Delete session ${s.session_id}`}
                  >
                    🗑
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
