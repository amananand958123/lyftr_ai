import React, { useState, useEffect, useRef } from 'react';
import { Search } from 'lucide-react';

export interface CommandItem {
  id: string;
  title: string;
  category: string;
  shortcut?: string;
  action: () => void;
}

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  commands: CommandItem[];
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({
  isOpen,
  onClose,
  commands,
}) => {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  const filtered = commands.filter((cmd) => {
    const q = query.toLowerCase();
    return (
      cmd.title.toLowerCase().includes(q) ||
      cmd.category.toLowerCase().includes(q)
    );
  });

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % (filtered.length || 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + (filtered.length || 1)) % (filtered.length || 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filtered[selectedIndex]) {
        filtered[selectedIndex].action();
        onClose();
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 px-4">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      {/* Palette Modal */}
      <div className="relative w-full max-w-lg bg-paper-2 border border-rule rounded-[16px] shadow-2xl overflow-hidden z-10 animate-apple-entrance">
        <div className="flex items-center px-4 py-3 border-b border-rule-subtle gap-2.5">
          <Search className="w-4 h-4 text-ink-subtle" />

          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a command or search actions..."
            className="w-full bg-transparent text-ink placeholder-ink-subtle text-sm focus:outline-none font-body"
          />

          <kbd className="hidden sm:inline-block px-1.5 py-0.5 rounded bg-paper-3 border border-rule-subtle text-[10px] font-mono text-ink-subtle">
            ESC
          </kbd>
        </div>

        <div className="max-h-80 overflow-y-auto p-2 space-y-1">
          {filtered.length === 0 ? (
            <div className="text-center py-8 text-xs text-ink-subtle">
              No matching commands
            </div>
          ) : (
            filtered.map((cmd, idx) => {
              const isSelected = idx === selectedIndex;
              return (
                <div
                  key={cmd.id}
                  onClick={() => {
                    cmd.action();
                    onClose();
                  }}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  className={`px-3 py-2.5 rounded-[10px] text-xs flex items-center justify-between cursor-pointer transition-colors ${
                    isSelected
                      ? 'bg-paper-3 text-ink font-medium shadow-sm'
                      : 'text-ink-muted hover:text-ink'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-paper-2 border border-rule-subtle text-ink-subtle">
                      {cmd.category}
                    </span>
                    <span>{cmd.title}</span>
                  </div>

                  {cmd.shortcut && (
                    <kbd className="px-1.5 py-0.5 rounded bg-paper-2 border border-rule-subtle text-[10px] font-mono text-ink-subtle">
                      {cmd.shortcut}
                    </kbd>
                  )}
                </div>
              );
            })
          )}
        </div>

        <div className="px-4 py-2 bg-paper-3/40 border-t border-rule-subtle flex items-center justify-between text-[11px] font-mono text-ink-subtle">
          <span>Navigate with ↑ / ↓</span>
          <span>Select with ↵</span>
        </div>
      </div>
    </div>
  );
};
