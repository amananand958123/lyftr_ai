import React, { useState } from 'react';

interface CodeBlockProps {
  language: string;
  code: string;
}

export const CodeBlock: React.FC<CodeBlockProps> = ({ language, code }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };

  return (
    <div className="my-2.5 rounded-[10px] overflow-hidden border border-rule-subtle bg-paper-3 font-mono text-xs">
      <div className="flex items-center justify-between px-3 py-1.5 bg-paper-2/90 border-b border-rule-subtle text-[11px] text-ink-muted">
        <span>{language || 'code'}</span>
        <button
          type="button"
          onClick={handleCopy}
          className="text-ink-muted hover:text-ink transition-[color,transform] active:scale-95 text-[11px]"
          aria-label={copied ? 'Copied code to clipboard' : 'Copy code to clipboard'}
        >
          {copied ? 'copied' : 'copy'}
        </button>
      </div>
      <pre className="p-3 overflow-x-auto text-ink font-mono text-xs leading-relaxed">
        <code>{code}</code>
      </pre>
    </div>
  );
};
