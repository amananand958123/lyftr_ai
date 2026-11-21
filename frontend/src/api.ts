import { ChatApiResponse, HealthStatus, SessionListResponse, CacheStatsResponse } from './types';

const API_BASE_URL = (
  import.meta.env.VITE_API_URL ||
  (typeof window !== 'undefined' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1'
    ? 'https://lyftr-ai-backend.onrender.com'
    : 'http://localhost:8000')
).replace(/\/+$/, '');

export async function fetchHealth(): Promise<HealthStatus> {
  const res = await fetch(`${API_BASE_URL}/health?_t=${Date.now()}`, {
    cache: 'no-store',
    headers: {
      'Cache-Control': 'no-cache',
    },
  });
  if (!res.ok) {
    throw new Error(`Health check failed: HTTP ${res.status}`);
  }
  return res.json();
}

export async function fetchSessions(limit = 50, offset = 0): Promise<SessionListResponse> {
  const res = await fetch(`${API_BASE_URL}/sessions?limit=${limit}&offset=${offset}`);
  if (!res.ok) {
    throw new Error(`Failed to load sessions: HTTP ${res.status}`);
  }
  return res.json();
}

export async function deleteSession(sessionId: string): Promise<void> {
  const res = await fetch(`${API_BASE_URL}/sessions/${encodeURIComponent(sessionId)}`, {
    method: 'DELETE',
  });
  if (!res.ok && res.status !== 404) {
    throw new Error(`Failed to delete session: HTTP ${res.status}`);
  }
}

export async function fetchSessionMessages(sessionId: string): Promise<any> {
  const res = await fetch(`${API_BASE_URL}/sessions/${encodeURIComponent(sessionId)}/messages`);
  if (!res.ok) {
    throw new Error(`Failed to load session messages: HTTP ${res.status}`);
  }
  return res.json();
}

export async function fetchCacheStats(): Promise<CacheStatsResponse> {
  const res = await fetch(`${API_BASE_URL}/cache/stats`);
  if (!res.ok) {
    throw new Error(`Failed to fetch cache stats: HTTP ${res.status}`);
  }
  return res.json();
}

export async function clearCache(): Promise<void> {
  const res = await fetch(`${API_BASE_URL}/cache/clear`, { method: 'POST' });
  if (!res.ok) {
    throw new Error(`Failed to clear cache: HTTP ${res.status}`);
  }
}

export async function sendChatMessage(
  sessionId: string,
  message: string,
  systemPrompt?: string,
  simulateFailureHeader?: string,
  temperature?: number,
  maxTokens?: number
): Promise<ChatApiResponse> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (simulateFailureHeader && simulateFailureHeader.trim() !== '') {
    headers['X-Simulate-Failure'] = simulateFailureHeader.trim();
  }

  const payload: {
    session_id: string;
    message: string;
    system_prompt?: string;
    temperature?: number;
    max_tokens?: number;
  } = {
    session_id: sessionId,
    message: message.trim(),
  };

  if (systemPrompt && systemPrompt.trim() !== '') {
    payload.system_prompt = systemPrompt.trim();
  }
  if (temperature !== undefined) {
    payload.temperature = temperature;
  }
  if (maxTokens !== undefined) {
    payload.max_tokens = maxTokens;
  }

  const res = await fetch(`${API_BASE_URL}/chat`, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  });

  const data = await res.json();

  if (!res.ok) {
    const errorDetail = typeof data.detail === 'string'
      ? data.detail
      : JSON.stringify(data.detail) || `Request failed with HTTP ${res.status}`;
    const err = new Error(errorDetail);
    (err as any).status = res.status;
    (err as any).data = data;
    throw err;
  }

  return data as ChatApiResponse;
}
