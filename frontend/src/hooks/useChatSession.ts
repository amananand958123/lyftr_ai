import { useState, useCallback } from 'react';
import { ChatMessage, ChatMetadata } from '../types';
import { sendChatMessage, fetchSessionMessages } from '../api';

export interface SendOptions {
  systemPrompt?: string;
  simulateRule?: string;
  temperature?: number;
  maxTokens?: number;
}

// e.g. "s-k3j9x2a"
function newSessionId() {
  return `s-${Math.random().toString(36).substring(2, 9)}`;
}

// Holds the chat state (session id, messages, loading, error) and the actions that change it.
export function useChatSession() {
  const [sessionId, setSessionId] = useState(newSessionId);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);

  const addMessage = (msg: ChatMessage) => setMessages((prev) => [...prev, msg]);

  const handleNewSession = useCallback(() => {
    setSessionId(newSessionId());
    setMessages([]);
    setErrorBanner(null);
  }, []);

  // Open a past session and load its messages from the backend.
  const handleSelectSession = useCallback(async (selectedId: string) => {
    setSessionId(selectedId);
    setErrorBanner(null);
    try {
      const data = await fetchSessionMessages(selectedId);
      setMessages(
        data.messages.map((m, index) => ({
          id: `loaded-${index}`,
          role: m.role,
          content: m.content,
          // History only stores part of the metadata; that's all the badge needs from old turns.
          metadata: m.metadata as ChatMetadata | undefined,
        }))
      );
    } catch (err) {
      console.error('Failed to load past messages:', err);
      setMessages([]);
    }
  }, []);

  const sendMessage = useCallback(
    async (text: string, options: SendOptions = {}, isRegenerate = false) => {
      if (!text.trim() || isLoading) return;

      setErrorBanner(null);
      // Show the user's message right away, before the server answers.
      if (!isRegenerate) {
        addMessage({ id: `user-${Date.now()}`, role: 'user', content: text });
      }
      setIsLoading(true);

      try {
        const response = await sendChatMessage(sessionId, text, options);
        addMessage({
          id: `assistant-${Date.now()}`,
          role: 'assistant',
          content: response.reply,
          metadata: response.metadata,
        });
      } catch (err: any) {
        const status = err.status || 500;
        const detail = err.message || 'An unexpected error occurred. Please try again.';
        setErrorBanner(`HTTP ${status}: ${detail}`);
        // Also show the error inside the chat, so the conversation never just goes blank.
        addMessage({ id: `err-${Date.now()}`, role: 'assistant', content: `Error (${status}): ${detail}`, isError: true });
      } finally {
        setIsLoading(false);
      }
    },
    [sessionId, isLoading]
  );

  // Remove the last reply and ask the same question again.
  const regenerateLast = useCallback(
    async (options: SendOptions = {}) => {
      const lastUserMessage = [...messages].reverse().find((m) => m.role === 'user');
      if (!lastUserMessage || isLoading) return;

      setMessages((prev) => (prev[prev.length - 1]?.role === 'assistant' ? prev.slice(0, -1) : prev));
      await sendMessage(lastUserMessage.content, options, true);
    },
    [messages, isLoading, sendMessage]
  );

  // Simple stats derived from the messages (cheap to compute, so no memo needed).
  const repliesWithMetadata = messages.filter((m) => m.metadata);
  const cumulativeTokens = repliesWithMetadata.reduce(
    (total, m) => total + m.metadata!.input_tokens + m.metadata!.output_tokens,
    0
  );
  const latencyPoints = repliesWithMetadata
    .filter((m) => m.metadata!.latency_ms !== undefined) // replies loaded from history have no latency
    .map((m) => ({
      latency_ms: m.metadata!.latency_ms,
      is_cache: m.metadata!.resolution_source === 'LLM_CACHE',
    }));

  return {
    sessionId,
    messages,
    isLoading,
    errorBanner,
    setErrorBanner,
    handleNewSession,
    handleSelectSession,
    sendMessage,
    regenerateLast,
    cumulativeTokens,
    latencyPoints,
  };
}
