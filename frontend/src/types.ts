export type ResolutionSource = 'LIVE_INFERENCE' | 'LLM_CACHE';

export interface ChatMetadata {
  resolution_source: ResolutionSource;
  model: string;
  latency_ms: number;
  input_tokens: number;
  output_tokens: number;
  key_id: string | null;
  fallback_attempts: number;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  metadata?: ChatMetadata;
  isError?: boolean;
  timestamp?: string;
}

export interface ChatApiResponse {
  session_id: string;
  reply: string;
  metadata: ChatMetadata;
}

export interface HealthStatus {
  status: string;
  keys_configured: number;
  cache_enabled: boolean;
}

export interface SessionSummary {
  session_id: string;
  message_count: number;
  last_message_preview?: string | null;
  last_active_at?: string | null;
}

export interface SessionListResponse {
  total: number;
  sessions: SessionSummary[];
}

export interface CacheStatsResponse {
  cache_enabled: boolean;
  cache_type: string;
  supported_models: string[];
}
