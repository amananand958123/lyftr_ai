import { ChatApiResponse, HealthStatus, SessionListResponse, CacheStatsResponse, HistoryResponse } from './types';
import type { SendOptions } from './hooks/useChatSession';

// Use VITE_API_URL if set; otherwise localhost in dev and the Render backend in production.
const isLocal = ['localhost', '127.0.0.1'].includes(window.location.hostname);
const API_BASE_URL = (
  import.meta.env.VITE_API_URL || (isLocal ? 'http://localhost:8000' : 'https://lyftr-ai-backend.onrender.com')
).replace(/\/+$/, '');

// Small fetch wrapper: throws an Error (with .status) when the response is not 2xx.
async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${path}`, init);
  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    const detail = typeof data.detail === 'string' ? data.detail : JSON.stringify(data.detail);
    const error: any = new Error(detail || `Request failed with HTTP ${res.status}`);
    error.status = res.status;
    throw error;
  }
  return data as T;
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

export function sendChatMessage(sessionId: string, message: string, options: SendOptions = {}) {
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

  return request<ChatApiResponse>('/chat', { method: 'POST', headers, body: JSON.stringify(body) });
}
