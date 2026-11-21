import { useState, useCallback, useRef } from 'react';
import { ChatMessage, ChatMetadata } from '../types';
import { streamChatMessage, fetchSessionMessages, StreamCutoffError } from '../api';

export interface SendOptions {
  systemPrompt?: string;
  simulateRule?: string;
  temperature?: number;
  maxTokens?: number;
  regenerate?: boolean;
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

  const abortControllerRef = useRef<AbortController | null>(null);
  const activeSessionIdRef = useRef<string>(sessionId);
  activeSessionIdRef.current = sessionId;

  const addMessage = (msg: ChatMessage) => setMessages((prev) => [...prev, msg]);

  const stopStreaming = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
      setIsLoading(false);
    }
  }, []);

  const handleNewSession = useCallback(() => {
    stopStreaming();
    const newId = newSessionId();
    activeSessionIdRef.current = newId;
    setSessionId(newId);
    setMessages([]);
    setErrorBanner(null);
  }, [stopStreaming]);

  // Open a past session and load its messages from the backend.
  const handleSelectSession = useCallback(async (selectedId: string) => {
    stopStreaming();
    activeSessionIdRef.current = selectedId;
    setSessionId(selectedId);
    setErrorBanner(null);
    try {
      const data = await fetchSessionMessages(selectedId);
      if (activeSessionIdRef.current === selectedId) {
        setMessages(
          data.messages.map((m, index) => ({
            id: `loaded-${index}`,
            role: m.role,
            content: m.content,
            // History only stores part of the metadata; that's all the badge needs from old turns.
            metadata: m.metadata as ChatMetadata | undefined,
          }))
        );
      }
    } catch (err) {
      console.error('Failed to load past messages:', err);
      if (activeSessionIdRef.current === selectedId) {
        setMessages([]);
      }
    }
  }, [stopStreaming]);

  const sendMessage = useCallback(
    async (text: string, options: SendOptions = {}, isRegenerate = false) => {
      if (!text.trim() || isLoading) return;

      stopStreaming();
      setErrorBanner(null);
      const targetSessionId = sessionId;

      // Show the user's message right away, before the server answers.
      if (!isRegenerate) {
        addMessage({ id: `user-${Date.now()}`, role: 'user', content: text });
      }
      setIsLoading(true);

      const abortController = new AbortController();
      abortControllerRef.current = abortController;

      // The reply bubble is added when the first piece of text arrives, then grows piece by piece.
      const replyId = `assistant-${Date.now()}`;
      const updateReply = (change: Partial<ChatMessage>) =>
        setMessages((prev) => prev.map((m) => (m.id === replyId ? { ...m, ...change } : m)));
      let replyText = '';

      try {
        const metadata = await streamChatMessage(
          targetSessionId,
          text,
          { ...options, signal: abortController.signal },
          (piece) => {
            if (activeSessionIdRef.current !== targetSessionId || abortController.signal.aborted) {
              return;
            }
            if (!piece) return; // providers sometimes send empty chunks
            if (replyText === '') {
              addMessage({ id: replyId, role: 'assistant', content: piece, isStreaming: true });
            } else {
              updateReply({ content: replyText + piece });
            }
            replyText += piece;
          }
        );

        if (activeSessionIdRef.current === targetSessionId && !abortController.signal.aborted) {
          updateReply({ metadata, isStreaming: false });
        }
      } catch (err: any) {
        if (abortController.signal.aborted || err.name === 'AbortError') {
          // Streaming was stopped by the user. Drop the unfinished reply because the server
          // never saves interrupted turns, keeping screen state identical to SQLite database.
          setMessages((prev) => prev.filter((m) => m.id !== replyId));
          return;
        }

        if (activeSessionIdRef.current !== targetSessionId) {
          return;
        }

        const isCutoff = err instanceof StreamCutoffError || err.name === 'StreamCutoffError' || err.isStreamCutoff;
        const status = err.status || (isCutoff ? 502 : 500);
        const detail = isCutoff
          ? (err.message || 'The reply was cut off, please try again.')
          : (err.message || 'An unexpected error occurred. Please try again.');
        const displayText = isCutoff ? detail : `Error (${status}): ${detail}`;

        setErrorBanner(isCutoff ? detail : `HTTP ${status}: ${detail}`);
        // Drop half-finished reply (it was not saved on the server either).
        setMessages((prev) => prev.filter((m) => m.id !== replyId));
        // Show error inside the chat
        addMessage({ id: `err-${Date.now()}`, role: 'assistant', content: displayText, isError: true });
      } finally {
        if (abortControllerRef.current === abortController) {
          abortControllerRef.current = null;
        }
        setIsLoading(false);
      }
    },
    [sessionId, isLoading, stopStreaming]
  );

  // Remove the last reply and ask the same question again.
  const regenerateLast = useCallback(
    async (options: SendOptions = {}) => {
      const lastUserMessage = [...messages].reverse().find((m) => m.role === 'user');
      if (!lastUserMessage || isLoading) return;

      setMessages((prev) => (prev[prev.length - 1]?.role === 'assistant' ? prev.slice(0, -1) : prev));
      await sendMessage(lastUserMessage.content, { ...options, regenerate: true }, true);
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
    stopStreaming,
    cumulativeTokens,
    latencyPoints,
  };
}
