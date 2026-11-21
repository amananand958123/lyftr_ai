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
  isStreaming?: boolean; // true while the reply is still arriving
  timestamp?: string;
}

export interface HealthStatus {
  status: string;
  keys_configured: number;
  cache_enabled: boolean;
}

export interface SessionSummary {
  session_id: string;
  message_count: number;
  first_message_preview?: string | null;
  last_message_preview?: string | null;
  last_active_at?: string | null;
}

export interface SessionListResponse {
  total: number;
  sessions: SessionSummary[];
}

export interface HistoryResponse {
  session_id: string;
  messages: Array<{
    role: 'user' | 'assistant';
    content: string;
    metadata?: Partial<ChatMetadata>;
  }>;
}

export interface CacheStatsResponse {
  cache_enabled: boolean;
  cache_type: string;
  supported_models: string[];
}
