import { ChatMessage } from '../types';

export function exportSessionMarkdown(sessionId: string, messages: ChatMessage[]): void {
  let md = `# Conversation Transcript — Session: ${sessionId}\n\n`;
  md += `*Exported on ${new Date().toISOString()} via Lyftr AI Resilient Gateway*\n\n---\n\n`;

  messages.forEach((msg) => {
    const roleTitle = msg.role === 'user' ? 'User' : 'Assistant (Lyftr Gateway)';
    md += `### ${roleTitle}\n\n`;
    md += `${msg.content}\n\n`;
    if (msg.metadata) {
      md += `> **Telemetry**: Source: \`${msg.metadata.resolution_source}\` | Model: \`${msg.metadata.model}\` | Latency: \`${msg.metadata.latency_ms}ms\` | In: \`${msg.metadata.input_tokens}\` | Out: \`${msg.metadata.output_tokens}\` | Key: \`${msg.metadata.key_id || 'cache'}\`\n\n`;
    }
    md += `---\n\n`;
  });

  const blob = new Blob([md], { type: 'text/markdown;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `session-${sessionId}.md`;
  a.click();
  URL.revokeObjectURL(url);
}

export function exportSessionJSON(sessionId: string, messages: ChatMessage[]): void {
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

  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `session-${sessionId}.json`;
  a.click();
  URL.revokeObjectURL(url);
}
