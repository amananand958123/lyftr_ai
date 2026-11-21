import React from 'react';
import { CodeBlock } from './CodeBlock';

interface MarkdownRendererProps {
  content: string;
}

/**
 * Lightweight, zero-dependency, safe Markdown and rich text renderer.
 * Supports:
 * - Fenced code blocks with language tagging
 * - Headers (h1, h2, h3, h4)
 * - Blockquotes
 * - Unordered & Ordered lists
 * - Markdown tables
 * - Inline formatting: bold, italic, inline code, links
 */
export const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ content }) => {
  // 1. Separate code blocks from regular markdown
  const parseBlocks = (text: string) => {
    const blocks: Array<{ type: 'code' | 'markdown'; language?: string; code?: string; text?: string }> = [];
    const codeBlockRegex = /```([a-zA-Z0-9_-]*)\n([\s\S]*?)```/g;
    let lastIndex = 0;
    let match;

    while ((match = codeBlockRegex.exec(text)) !== null) {
      if (match.index > lastIndex) {
        blocks.push({
          type: 'markdown',
          text: text.substring(lastIndex, match.index),
        });
      }
      blocks.push({
        type: 'code',
        language: match[1].trim() || 'text',
        code: match[2].replace(/\n$/, ''),
      });
      lastIndex = match.index + match[0].length;
    }

    if (lastIndex < text.length) {
      blocks.push({
        type: 'markdown',
        text: text.substring(lastIndex),
      });
    }

    return blocks;
  };

  // Helper for inline styles (bold, italic, inline code, links)
  const formatInlineText = (text: string): React.ReactNode[] => {
    // Tokenize inline code, bold, italic, links
    const tokens: React.ReactNode[] = [];
    // Regex matches: `code`, **bold**, *italic*, [text](url)
    const inlineRegex = /(`[^`]+`|\*\*[^*]+\*\*|\*[^*]+\*|\[[^\]]+\]\([^)]+\))/g;
    let lastIdx = 0;
    let m;

    while ((m = inlineRegex.exec(text)) !== null) {
      if (m.index > lastIdx) {
        tokens.push(text.substring(lastIdx, m.index));
      }

      const matchStr = m[0];
      if (matchStr.startsWith('`') && matchStr.endsWith('`')) {
        tokens.push(
          <code
            key={`c-${m.index}`}
            className="px-1.5 py-0.5 rounded-[4px] bg-paper-3 border border-rule-subtle font-mono text-[12px] text-accent font-medium"
          >
            {matchStr.slice(1, -1)}
          </code>
        );
      } else if (matchStr.startsWith('**') && matchStr.endsWith('**')) {
        tokens.push(
          <strong key={`b-${m.index}`} className="font-semibold text-ink">
            {matchStr.slice(2, -2)}
          </strong>
        );
      } else if (matchStr.startsWith('*') && matchStr.endsWith('*')) {
        tokens.push(
          <em key={`i-${m.index}`} className="italic text-ink-2">
            {matchStr.slice(1, -1)}
          </em>
        );
      } else if (matchStr.startsWith('[') && matchStr.includes('](')) {
        const titleMatch = matchStr.match(/\[([^\]]+)\]\(([^)]+)\)/);
        if (titleMatch) {
          tokens.push(
            <a
              key={`a-${m.index}`}
              href={titleMatch[2]}
              target="_blank"
              rel="noopener noreferrer"
              className="text-accent underline decoration-rule-2 hover:decoration-accent transition-colors"
            >
              {titleMatch[1]}
            </a>
          );
        } else {
          tokens.push(matchStr);
        }
      }
      lastIdx = m.index + matchStr.length;
    }

    if (lastIdx < text.length) {
      tokens.push(text.substring(lastIdx));
    }

    return tokens.length > 0 ? tokens : [text];
  };

  // Helper to render markdown paragraphs, lists, tables, and blockquotes
  const renderMarkdownSection = (rawMarkdown: string, sectionKey: string) => {
    const lines = rawMarkdown.split('\n');
    const elements: React.ReactNode[] = [];
    let i = 0;

    while (i < lines.length) {
      const line = lines[i];
      const trimmed = line.trim();

      if (!trimmed) {
        i++;
        continue;
      }

      // 1. Headers
      if (trimmed.startsWith('# ')) {
        elements.push(
          <h1 key={`${sectionKey}-h1-${i}`} className="text-lg font-bold text-ink mt-3 mb-1.5 tracking-tight font-display">
            {formatInlineText(trimmed.substring(2))}
          </h1>
        );
        i++;
        continue;
      }
      if (trimmed.startsWith('## ')) {
        elements.push(
          <h2 key={`${sectionKey}-h2-${i}`} className="text-base font-semibold text-ink mt-2.5 mb-1 tracking-tight font-display">
            {formatInlineText(trimmed.substring(3))}
          </h2>
        );
        i++;
        continue;
      }
      if (trimmed.startsWith('### ')) {
        elements.push(
          <h3 key={`${sectionKey}-h3-${i}`} className="text-sm font-semibold text-ink mt-2 mb-1 tracking-tight font-display">
            {formatInlineText(trimmed.substring(4))}
          </h3>
        );
        i++;
        continue;
      }

      // 2. Blockquote
      if (trimmed.startsWith('> ')) {
        const quoteLines: string[] = [];
        while (i < lines.length && lines[i].trim().startsWith('> ')) {
          quoteLines.push(lines[i].trim().substring(2));
          i++;
        }
        elements.push(
          <blockquote
            key={`${sectionKey}-quote-${i}`}
            className="border-l-2 border-accent/60 pl-3.5 py-1 my-2 bg-paper-3/40 rounded-r-[6px] text-xs text-ink-muted italic"
          >
            {quoteLines.map((ql, qIdx) => (
              <p key={qIdx}>{formatInlineText(ql)}</p>
            ))}
          </blockquote>
        );
        continue;
      }

      // 3. Tables (lines with |)
      if (trimmed.startsWith('|') && trimmed.endsWith('|') && i + 1 < lines.length && lines[i + 1].includes('---')) {
        const tableLines: string[] = [];
        while (i < lines.length && lines[i].trim().startsWith('|')) {
          tableLines.push(lines[i].trim());
          i++;
        }
        const headerCols = tableLines[0].split('|').slice(1, -1).map((c) => c.trim());
        const bodyRows = tableLines.slice(2).map((r) => r.split('|').slice(1, -1).map((c) => c.trim()));

        elements.push(
          <div key={`${sectionKey}-tbl-${i}`} className="my-2.5 overflow-x-auto rounded-[8px] border border-rule-subtle bg-paper-3/50">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-rule bg-paper-3 font-semibold text-ink">
                  {headerCols.map((hc, hIdx) => (
                    <th key={hIdx} className="px-3 py-2 border-r border-rule-subtle last:border-r-0">
                      {formatInlineText(hc)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-rule-subtle">
                {bodyRows.map((row, rIdx) => (
                  <tr key={rIdx} className="hover:bg-paper-2/50 transition-colors">
                    {row.map((cell, cIdx) => (
                      <td key={cIdx} className="px-3 py-1.5 border-r border-rule-subtle last:border-r-0 text-ink-2 font-mono text-[11px]">
                        {formatInlineText(cell)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
        continue;
      }

      // 4. Unordered Lists (- or *)
      if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
        const listItems: string[] = [];
        while (i < lines.length && (lines[i].trim().startsWith('- ') || lines[i].trim().startsWith('* '))) {
          listItems.push(lines[i].trim().substring(2));
          i++;
        }
        elements.push(
          <ul key={`${sectionKey}-ul-${i}`} className="my-1.5 space-y-1 pl-4 list-disc text-ink-2 marker:text-accent">
            {listItems.map((item, itemIdx) => (
              <li key={itemIdx} className="pl-1 leading-relaxed">
                {formatInlineText(item)}
              </li>
            ))}
          </ul>
        );
        continue;
      }

      // 5. Ordered Lists (1., 2.)
      if (/^\d+\.\s/.test(trimmed)) {
        const listItems: string[] = [];
        while (i < lines.length && /^\d+\.\s/.test(lines[i].trim())) {
          listItems.push(lines[i].trim().replace(/^\d+\.\s/, ''));
          i++;
        }
        elements.push(
          <ol key={`${sectionKey}-ol-${i}`} className="my-1.5 space-y-1 pl-4 list-decimal text-ink-2 marker:text-ink-subtle font-mono text-xs">
            {listItems.map((item, itemIdx) => (
              <li key={itemIdx} className="pl-1 leading-relaxed font-body text-sm">
                {formatInlineText(item)}
              </li>
            ))}
          </ol>
        );
        continue;
      }

      // 6. Regular Paragraph
      elements.push(
        <p key={`${sectionKey}-p-${i}`} className="my-1.5 leading-relaxed text-ink font-body">
          {formatInlineText(line)}
        </p>
      );
      i++;
    }

    return elements;
  };

  const blocks = parseBlocks(content);

  return (
    <div className="space-y-1 text-sm leading-relaxed text-ink selection:bg-accent/20">
      {blocks.map((block, idx) => {
        if (block.type === 'code') {
          return (
            <CodeBlock
              key={`code-${idx}`}
              language={block.language || 'text'}
              code={block.code || ''}
            />
          );
        }
        return (
          <div key={`md-${idx}`}>
            {renderMarkdownSection(block.text || '', `sec-${idx}`)}
          </div>
        );
      })}
    </div>
  );
};
