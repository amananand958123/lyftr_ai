import React from 'react';
import { CodeBlock } from './CodeBlock';

interface MarkdownRendererProps {
  content: string;
}

/*
 * A small hand-written markdown renderer (no library), enough for chat replies:
 * code blocks, headings, quotes, tables, bullet/numbered lists, and inline bold/italic/code/links.
 * It builds React elements (never raw HTML), so model output can't inject scripts.
 */
const HEADING_STYLES: Record<number, string> = {
  1: 'text-lg font-bold mt-3 mb-1.5',
  2: 'text-base font-semibold mt-2.5 mb-1',
  3: 'text-sm font-semibold mt-2 mb-1',
};

type Block = { type: 'code'; language: string; code: string } | { type: 'markdown'; text: string };

// Some models copy a pattern from web pages: a line "sql", a line "copy", then the code
// with NO ``` around it, so it would show up as plain paragraphs. This puts the fences back.
// The code is taken to run until the next heading, list, table or quote (or the end of the reply).
function fenceBareCode(text: string): string {
  const lines = text.split('\n');
  const result: string[] = [];
  let i = 0;

  while (i < lines.length) {
    const isLanguageLabel = /^[a-z+#-]{1,15}$/i.test(lines[i].trim());
    const isCopyLabel = /^copy( code)?$/i.test(lines[i + 1]?.trim() ?? '');
    if (!isLanguageLabel || !isCopyLabel) {
      result.push(lines[i]);
      i++;
      continue;
    }

    const language = lines[i].trim();
    i += 2; // skip the "sql" and "copy" lines
    const code: string[] = [];
    while (i < lines.length && !/^\s*(#{1,6} |[-*] |\d+\. |\||> )/.test(lines[i])) {
      code.push(lines[i]);
      i++;
    }
    while (code.length > 0 && code[code.length - 1].trim() === '') code.pop(); // no trailing blank lines
    result.push('```' + language, ...code, '```');
  }
  return result.join('\n');
}

// Step 1: cut the text into code blocks (```...```) and normal markdown in between.
function splitCodeBlocks(text: string): Block[] {
  const blocks: Block[] = [];
  const codeBlockRegex = /```([^\n`]*)\n([\s\S]*?)```/g;
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
    const remaining = text.substring(lastIndex);
    // Detect an unclosed trailing code block during streaming: e.g. "```lang\n...code..."
    const unclosedMatch = remaining.match(/^([\s\S]*?)```([^\n`]*)(?:\n([\s\S]*))?$/);
    if (unclosedMatch) {
      const beforeCode = unclosedMatch[1];
      const lang = unclosedMatch[2].trim() || 'text';
      const code = unclosedMatch[3] !== undefined ? unclosedMatch[3] : '';
      if (beforeCode) {
        blocks.push({
          type: 'markdown',
          text: beforeCode,
        });
      }
      blocks.push({
        type: 'code',
        language: lang,
        code: code,
      });
    } else {
      blocks.push({
        type: 'markdown',
        text: remaining,
      });
    }
  }

  return blocks;
}

// Inline styles inside one line: `code`, **bold**, *italic* and [links](url).
function formatInlineText(text: string): React.ReactNode[] {
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
      // Only real web links: a "javascript:" link from the model would otherwise run code on click.
      if (titleMatch && /^(https?:|mailto:)/i.test(titleMatch[2])) {
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
}

// Step 2: go through the markdown line by line and turn it into headings, quotes, tables, lists and paragraphs.
function renderMarkdownSection(rawMarkdown: string, sectionKey: string): React.ReactNode[] {
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

    // 1. Headers: "# ", "## " or "### " (the number of # decides the size)
    const heading = trimmed.match(/^(#{1,3}) (.*)/);
    if (heading) {
      const level = heading[1].length;
      const Tag = `h${level}` as 'h1' | 'h2' | 'h3';
      elements.push(
        <Tag key={`${sectionKey}-h-${i}`} className={`${HEADING_STYLES[level]} text-ink tracking-tight font-display`}>
          {formatInlineText(heading[2])}
        </Tag>
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
              {renderTaskItem(item)}
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
}

// "[ ] text" / "[x] text" inside a bullet list = a checklist item.
function renderTaskItem(item: string): React.ReactNode {
  const task = item.match(/^\[( |x|X)\] (.*)/);
  if (!task) return formatInlineText(item);
  return (
    <>
      <span className="mr-1.5 text-ink-subtle">{task[1] === ' ' ? '☐' : '☑'}</span>
      {formatInlineText(task[2])}
    </>
  );
}

export const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ content }) => {
  // Windows line endings (\r\n) would break the line-based parsing, so normalize them first.
  const blocks = splitCodeBlocks(fenceBareCode(content.replace(/\r\n/g, '\n')));

  return (
    <div className="space-y-1 text-sm leading-relaxed text-ink selection:bg-accent/20">
      {blocks.map((block, idx) => {
        if (block.type === 'code') {
          return (
            <CodeBlock
              key={`code-${idx}`}
              language={block.language}
              code={block.code}
            />
          );
        }
        return (
          <div key={`md-${idx}`}>
            {renderMarkdownSection(block.text, `sec-${idx}`)}
          </div>
        );
      })}
    </div>
  );
};
