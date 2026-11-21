import { ChatMessage } from '../types';

// Rough blended price of ~$0.15 per million tokens, used only for the "est: $" labels.
export const COST_PER_TOKEN = 0.00000015;

// Makes the browser download a text file.
function downloadFile(fileName: string, content: string, mimeType: string) {
  const url = URL.createObjectURL(new Blob([content], { type: mimeType }));
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}

export function exportSessionMarkdown(sessionId: string, messages: ChatMessage[]) {
  let md = `# Conversation Transcript — Session: ${sessionId}\n\n`;
  md += `*Exported on ${new Date().toISOString()}*\n\n---\n\n`;

  for (const msg of messages) {
    md += `### ${msg.role === 'user' ? 'User' : 'Assistant'}\n\n${msg.content}\n\n`;
    if (msg.metadata) {
      const m = msg.metadata;
      md += `> Source: ${m.resolution_source} | Model: ${m.model} | Latency: ${m.latency_ms}ms | In: ${m.input_tokens} | Out: ${m.output_tokens} | Key: ${m.key_id || 'cache'}\n\n`;
    }
    md += `---\n\n`;
  }

  downloadFile(`session-${sessionId}.md`, md, 'text/markdown');
}

export function exportSessionJSON(sessionId: string, messages: ChatMessage[]) {
  const data = {
    session_id: sessionId,
    exported_at: new Date().toISOString(),
    messages: messages.map((m) => ({
      role: m.role,
      content: m.content,
      metadata: m.metadata || null,
      isError: m.isError || false,
    })),
  };
  downloadFile(`session-${sessionId}.json`, JSON.stringify(data, null, 2), 'application/json');
}
