import { ChatApiResponse, HealthStatus } from './types';

const API_BASE_URL = (import.meta.env.VITE_API_URL || 'http://localhost:8000').replace(/\/+$/, '');

export async function fetchHealth(): Promise<HealthStatus> {
  const res = await fetch(`${API_BASE_URL}/health`);
  if (!res.ok) {
    throw new Error(`Health check failed: HTTP ${res.status}`);
  }
  return res.json();
}

export async function sendChatMessage(
  sessionId: string,
  message: string,
  systemPrompt?: string,
  simulateFailureHeader?: string
): Promise<ChatApiResponse> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (simulateFailureHeader && simulateFailureHeader.trim() !== '') {
    headers['X-Simulate-Failure'] = simulateFailureHeader.trim();
  }

  const payload: { session_id: string; message: string; system_prompt?: string } = {
    session_id: sessionId,
    message: message.trim(),
  };

  if (systemPrompt && systemPrompt.trim() !== '') {
    payload.system_prompt = systemPrompt.trim();
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

  return data;
}

export async function fetchSessionHistory(sessionId: string) {
  const res = await fetch(`${API_BASE_URL}/sessions/${sessionId}/messages`);
  if (!res.ok) {
    if (res.status === 404) return null;
    throw new Error(`Failed to fetch history: HTTP ${res.status}`);
  }
  return res.json();
}
