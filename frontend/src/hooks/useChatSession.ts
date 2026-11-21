import { useState, useMemo, useCallback } from 'react';
import { ChatMessage } from '../types';
import { sendChatMessage, fetchSessionMessages } from '../api';

export function useChatSession() {
  const [sessionId, setSessionId] = useState<string>(() => {
    return `s-${Math.random().toString(36).substring(2, 9)}`;
  });

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);

  const handleNewSession = useCallback(() => {
    const newId = `s-${Math.random().toString(36).substring(2, 9)}`;
    setSessionId(newId);
    setMessages([]);
    setErrorBanner(null);
  }, []);

  const handleSelectSession = useCallback(async (selectedId: string) => {
    setSessionId(selectedId);
    setErrorBanner(null);
    try {
      const data = await fetchSessionMessages(selectedId);
      const loaded: ChatMessage[] = data.messages.map((m: any, idx: number) => ({
        id: `loaded-${idx}-${Date.now()}`,
        role: m.role,
        content: m.content,
        metadata: m.metadata || undefined,
      }));
      setMessages(loaded);
    } catch (err: any) {
      console.error('Failed to load past messages:', err);
      setMessages([]);
    }
  }, []);

  const sendMessage = useCallback(async (
    textToSend: string,
    options?: {
      systemPrompt?: string;
      simulateRule?: string;
      temperature?: number;
      maxTokens?: number;
      isRegenerate?: boolean;
    }
  ) => {
    if (!textToSend.trim() || isLoading) return;

    setErrorBanner(null);

    // Optimistically append user message if not regenerating
    if (!options?.isRegenerate) {
      const userMsg: ChatMessage = {
        id: `user-${Date.now()}`,
        role: 'user',
        content: textToSend,
      };
      setMessages((prev) => [...prev, userMsg]);
    }

    setIsLoading(true);

    try {
      const response = await sendChatMessage(
        sessionId,
        textToSend,
        options?.systemPrompt || undefined,
        options?.simulateRule || undefined,
        options?.temperature,
        options?.maxTokens
      );

      const assistantMsg: ChatMessage = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: response.reply,
        metadata: response.metadata,
      };
      setMessages((prev) => [...prev, assistantMsg]);
      setErrorBanner(null);
    } catch (err: any) {
      console.error('Chat error:', err);
      const errorMsgText = err.message || 'An unexpected error occurred. Please try again.';
      setErrorBanner(`HTTP ${err.status || 500}: ${errorMsgText}`);

      // Add error message cleanly in chat stream so UI never crashes or goes blank
      const errorMsg: ChatMessage = {
        id: `err-${Date.now()}`,
        role: 'assistant',
        content: `Error (${err.status || 500}): ${errorMsgText}`,
        isError: true,
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  }, [sessionId, isLoading]);

  const regenerateLast = useCallback(async (options?: {
    systemPrompt?: string;
    simulateRule?: string;
    temperature?: number;
    maxTokens?: number;
  }) => {
    if (messages.length === 0 || isLoading) return;
    const lastUserMsg = [...messages].reverse().find((m) => m.role === 'user');
    if (!lastUserMsg) return;

    setMessages((prev) => {
      const copy = [...prev];
      if (copy[copy.length - 1]?.role === 'assistant') {
        copy.pop();
      }
      return copy;
    });

    await sendMessage(lastUserMsg.content, { ...options, isRegenerate: true });
  }, [messages, isLoading, sendMessage]);

  const cumulativeTokens = useMemo(() => {
    return messages.reduce((acc, m) => {
      if (m.metadata) {
        return acc + (m.metadata.input_tokens || 0) + (m.metadata.output_tokens || 0);
      }
      return acc;
    }, 0);
  }, [messages]);

  const latencyPoints = useMemo(() => {
    return messages
      .filter((m) => m.metadata !== undefined)
      .map((m) => ({
        latency_ms: m.metadata!.latency_ms,
        is_cache: m.metadata!.resolution_source === 'LLM_CACHE',
      }));
  }, [messages]);

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
