import React, { useState, useMemo } from 'react';

interface CodeBlockProps {
  language: string;
  code: string;
}

export const CodeBlock: React.FC<CodeBlockProps> = ({ language, code }) => {
  const [copied, setCopied] = useState(false);
  const [wrapLines, setWrapLines] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };

  const lines = useMemo(() => code.split('\n'), [code]);

  // Fast, deterministic token highlighter for developer elegance
  const highlightLine = (line: string): React.ReactNode => {
    if (!line) return <span>&nbsp;</span>;

    // Detect single line comments
    if (line.trim().startsWith('#') || line.trim().startsWith('//')) {
      return <span className="text-ink-subtle italic">{line}</span>;
    }

    // Tokenizer matching strings, numbers, and common keywords
    const tokenRegex = /(".*?"|'.*?'|`.*?`|\b(def|class|return|import|from|const|let|var|function|async|await|if|else|for|while|try|catch|except|finally|SELECT|FROM|WHERE|INSERT|UPDATE|DELETE|JOIN|AND|OR|NOT|true|false|null|None|self|this)\b|\b\d+(\.\d+)?\b)/g;
    const elements: React.ReactNode[] = [];
    let lastIdx = 0;
    let match;

    while ((match = tokenRegex.exec(line)) !== null) {
      if (match.index > lastIdx) {
        elements.push(line.substring(lastIdx, match.index));
      }

      const val = match[0];
      if (val.startsWith('"') || val.startsWith("'") || val.startsWith('`')) {
        elements.push(
          <span key={match.index} className="text-ok">
            {val}
          </span>
        );
      } else if (/^\d+(\.\d+)?$/.test(val)) {
        elements.push(
          <span key={match.index} className="text-cool">
            {val}
          </span>
        );
      } else {
        // Keyword
        elements.push(
          <span key={match.index} className="text-accent font-medium">
            {val}
          </span>
        );
      }

      lastIdx = match.index + val.length;
    }

    if (lastIdx < line.length) {
      elements.push(line.substring(lastIdx));
    }

    return elements.length > 0 ? elements : line;
  };

  return (
    <div className="my-2.5 rounded-[10px] overflow-hidden border border-rule-subtle bg-paper-3 font-mono text-xs shadow-sm">
      <div className="flex items-center justify-between px-3 py-1.5 bg-paper-2/95 border-b border-rule-subtle text-[11px] text-ink-muted">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-accent uppercase tracking-wider text-[10px] bg-accent-soft px-1.5 py-0.5 rounded-[4px] border border-accent/20">
            {language || 'text'}
          </span>
          <span className="text-ink-subtle text-[10px]">{lines.length} lines</span>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => setWrapLines((w) => !w)}
            className="text-ink-subtle hover:text-ink transition-colors text-[10px]"
            title="Toggle line wrapping"
          >
            {wrapLines ? 'unwrap' : 'wrap'}
          </button>
          <span className="text-rule-2">·</span>
          <button
            type="button"
            onClick={handleCopy}
            className={`flex items-center gap-1 transition-[color,transform] active:scale-95 text-[11px] font-medium ${
              copied ? 'text-ok font-semibold' : 'text-ink-muted hover:text-ink'
            }`}
            aria-label={copied ? 'Copied code to clipboard' : 'Copy code to clipboard'}
          >
            {copied ? (
              <>
                <svg className="w-3.5 h-3.5 text-ok" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                <span>copied</span>
              </>
            ) : (
              <>
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                </svg>
                <span>copy</span>
              </>
            )}
          </button>
        </div>
      </div>

      <div className={`p-3 overflow-x-auto text-ink font-mono text-xs leading-relaxed ${wrapLines ? 'whitespace-pre-wrap' : 'whitespace-pre'}`}>
        <table className="w-full border-collapse">
          <tbody>
            {lines.map((line, idx) => (
              <tr key={idx} className="hover:bg-paper-2/40 transition-colors">
                <td className="select-none pr-3 text-right text-ink-subtle/50 text-[11px] w-8 align-top font-mono">
                  {idx + 1}
                </td>
                <td className="pl-2 border-l border-rule-subtle/40 align-top">
                  {highlightLine(line)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
