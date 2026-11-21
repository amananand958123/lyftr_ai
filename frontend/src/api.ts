import { ChatMetadata, HealthStatus, SessionListResponse, CacheStatsResponse, HistoryResponse } from './types';
import type { SendOptions } from './hooks/useChatSession';

// Persistent client ID to guarantee session isolation and safe deletion scoping
export function getClientId(): string {
  if (typeof window === 'undefined') return 'server';
  let id = localStorage.getItem('lyftr_client_id');
  if (!id) {
    id = 'c' + Math.random().toString(36).substring(2, 10);
    try {
      localStorage.setItem('lyftr_client_id', id);
    } catch {
      // storage blocked in private browsing
    }
  }
  return id;
}

function getApiBaseUrl(): string {
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL.replace(/\/+$/, '');
  }
  if (typeof window !== 'undefined') {
    const host = window.location.hostname;
    if (['localhost', '127.0.0.1', '0.0.0.0'].includes(host) || host.startsWith('192.168.') || host.startsWith('10.')) {
      if (window.location.port === '8000') return '';
      return `http://${host === '0.0.0.0' ? 'localhost' : host}:8000`;
    }
  }
  return '';
}

const API_BASE_URL = getApiBaseUrl();

// An Error that also remembers the HTTP status (the chat shows "Error (503): ...").
function httpError(status: number, detail: string) {
  const error: any = new Error(detail);
  error.status = status;
  return error;
}

export class StreamCutoffError extends Error {
  constructor(message = 'The reply was cut off, please try again.') {
    super(message);
    this.name = 'StreamCutoffError';
    Object.setPrototypeOf(this, StreamCutoffError.prototype);
  }
}

// Builds an error from a failed response, using FastAPI's {"detail": ...} body when there is one.
async function errorFrom(res: Response) {
  const data = await res.json().catch(() => ({}));
  const detail = typeof data.detail === 'string' ? data.detail : JSON.stringify(data.detail);
  return httpError(res.status, detail || `Request failed with HTTP ${res.status}`);
}

// Small fetch wrapper: returns the JSON body, or throws when the response is not 2xx.
async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  // Only attach X-Client-ID for session-scoped endpoints, never for public health checks
  if (!path.startsWith('/health') && !headers.has('X-Client-ID')) {
    headers.set('X-Client-ID', getClientId());
  }
  const res = await fetch(`${API_BASE_URL}${path}`, { ...init, headers });
  if (!res.ok) throw await errorFrom(res);
  return res.json() as Promise<T>;
}

export async function fetchHealth(): Promise<HealthStatus> {
  const path = `/health?_t=${Date.now()}`;

  // 1. Try configured API_BASE_URL (direct backend or custom env)
  if (API_BASE_URL) {
    try {
      const res = await fetch(`${API_BASE_URL}${path}`);
      if (res.ok) return await res.json();
    } catch (err) {
      console.warn('[Lyftr] fetchHealth via API_BASE_URL failed:', err);
    }
  }

  // 2. Try relative path (proxied by Vite in dev/preview or by Vercel in production)
  try {
    const res = await fetch(path);
    if (res.ok) return await res.json();
  } catch (err) {
    console.warn('[Lyftr] fetchHealth via relative proxy failed:', err);
  }

  // 3. Fallback to direct local backend (only on http: origins to avoid mixed content errors in browser)
  if (typeof window !== 'undefined' && window.location.protocol === 'http:') {
    try {
      const res = await fetch(`http://localhost:8000${path}`);
      if (res.ok) return await res.json();
    } catch {
      // ignore
    }
  }

  // 4. Fallback to direct production Render deployment
  try {
    const res = await fetch(`https://lyftr-ai-backend.onrender.com${path}`);
    if (res.ok) return await res.json();
  } catch {
    // ignore
  }

  throw new Error('All health check endpoints unreachable');
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
  options: SendOptions & { signal?: AbortSignal },
  onText: (text: string) => void
): Promise<ChatMetadata> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-Client-ID': getClientId(),
  };
  if (options.simulateRule?.trim()) {
    headers['X-Simulate-Failure'] = options.simulateRule.trim();
  }
  const body = {
    session_id: sessionId,
    message: message.trim(),
    system_prompt: options.systemPrompt?.trim() || undefined, // undefined fields are dropped by JSON.stringify
    temperature: options.temperature,
    max_tokens: options.maxTokens,
    regenerate: options.regenerate || undefined,
  };

  const res = await fetch(`${API_BASE_URL}/chat/stream`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
    signal: options.signal,
  });
  if (!res.ok) throw await errorFrom(res); // 400 / 422 / 503 come back as normal JSON errors

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
      if (data.type === 'error') {
        throw new StreamCutoffError(data.detail ? `The reply was cut off: ${data.detail}` : undefined);
      }
    }
  }
  throw new StreamCutoffError('The reply was cut off, please try again.');
}
