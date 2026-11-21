import { ChatMetadata, HealthStatus, SessionListResponse, CacheStatsResponse, HistoryResponse } from './types';
import type { SendOptions } from './hooks/useChatSession';

// Use VITE_API_URL if set; otherwise localhost in dev and the Render backend in production.
const isLocal = ['localhost', '127.0.0.1'].includes(window.location.hostname);
const API_BASE_URL = (
  import.meta.env.VITE_API_URL || (isLocal ? 'http://localhost:8000' : 'https://lyftr-ai-backend.onrender.com')
).replace(/\/+$/, '');

// An Error that also remembers the HTTP status (the chat shows "Error (503): ...").
function httpError(status: number, detail: string) {
  const error: any = new Error(detail);
  error.status = status;
  return error;
}

// Builds an error from a failed response, using FastAPI's {"detail": ...} body when there is one.
async function errorFrom(res: Response) {
  const data = await res.json().catch(() => ({}));
  const detail = typeof data.detail === 'string' ? data.detail : JSON.stringify(data.detail);
  return httpError(res.status, detail || `Request failed with HTTP ${res.status}`);
}

// Small fetch wrapper: returns the JSON body, or throws when the response is not 2xx.
async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${path}`, init);
  if (!res.ok) throw await errorFrom(res);
  return res.json() as Promise<T>;
}

export function fetchHealth() {
  // Timestamp in the URL + no-store so the browser never shows a cached health result.
  return request<HealthStatus>(`/health?_t=${Date.now()}`, { cache: 'no-store' });
}

export function fetchSessions(limit = 50, offset = 0) {
  return request<SessionListResponse>(`/sessions?limit=${limit}&offset=${offset}`);
}

export function fetchSessionMessages(sessionId: string) {
  return request<HistoryResponse>(`/sessions/${encodeURIComponent(sessionId)}/messages`);
}

export async function deleteSession(sessionId: string) {
  try {
    await request(`/sessions/${encodeURIComponent(sessionId)}`, { method: 'DELETE' });
  } catch (err: any) {
    if (err.status !== 404) throw err; // already gone is fine
  }
}

export function fetchCacheStats() {
  return request<CacheStatsResponse>('/cache/stats');
}

export function clearCache() {
  return request('/cache/clear', { method: 'POST' });
}

/*
 * Sends a message to /chat/stream and calls onText() with each piece of the reply as it arrives.
 * Resolves with the reply's metadata when it is finished.
 *
 * The server sends Server-Sent Events: lines like `data: {"type": "delta", "text": "Hel"}`,
 * each followed by a blank line. Network chunks don't line up with events, so we keep
 * a buffer and only handle events once their blank line has arrived.
 */
export async function streamChatMessage(
  sessionId: string,
  message: string,
  options: SendOptions,
  onText: (text: string) => void
): Promise<ChatMetadata> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (options.simulateRule?.trim()) {
    headers['X-Simulate-Failure'] = options.simulateRule.trim();
  }
  const body = {
    session_id: sessionId,
    message: message.trim(),
    system_prompt: options.systemPrompt?.trim() || undefined, // undefined fields are dropped by JSON.stringify
    temperature: options.temperature,
    max_tokens: options.maxTokens,
  };

  const res = await fetch(`${API_BASE_URL}/chat/stream`, { method: 'POST', headers, body: JSON.stringify(body) });
  if (!res.ok) throw await errorFrom(res); // 422 / 503 come back as normal JSON errors

  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const events = buffer.split('\n\n');
    buffer = events.pop()!; // the last piece may be cut in half, keep it for the next round

    for (const event of events) {
      if (!event.startsWith('data: ')) continue;
      const data = JSON.parse(event.slice('data: '.length));
      if (data.type === 'delta') onText(data.text);
      if (data.type === 'done') return data.metadata;
      if (data.type === 'error') throw httpError(502, data.detail);
    }
  }
  throw httpError(502, 'connection closed before the reply finished');
}
