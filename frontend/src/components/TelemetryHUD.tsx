import React, { useState, useEffect } from 'react';
import { HealthStatus, CacheStatsResponse, ChatMessage } from '../types';
import { fetchCacheStats, clearCache } from '../api';

interface TelemetryHUDProps {
  isOpen: boolean;
  onClose: () => void;
  health: HealthStatus | null;
  messages: ChatMessage[];
  cumulativeTokens: number;
}

export const TelemetryHUD: React.FC<TelemetryHUDProps> = ({
  isOpen,
  onClose,
  health,
  messages,
  cumulativeTokens,
}) => {
  const [cacheStats, setCacheStats] = useState<CacheStatsResponse | null>(null);
  const [isPurging, setIsPurging] = useState(false);
  const [purgeSuccess, setPurgeSuccess] = useState(false);

  useEffect(() => {
    if (isOpen) {
      fetchCacheStats()
        .then((stats) => setCacheStats(stats))
        .catch((err) => console.error('Failed to load cache stats:', err));
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // Calculate live session cache metrics
  const assistantMessages = messages.filter((m) => m.role === 'assistant' && m.metadata);
  const totalCalls = assistantMessages.length;
  const cacheHits = assistantMessages.filter((m) => m.metadata?.resolution_source === 'LLM_CACHE').length;
  const liveInferences = totalCalls - cacheHits;
  const cacheHitRatio = totalCalls > 0 ? Math.round((cacheHits / totalCalls) * 100) : 0;

  // Latency metrics
  const avgCacheLatency = cacheHits > 0
    ? Math.round(
        assistantMessages
          .filter((m) => m.metadata?.resolution_source === 'LLM_CACHE')
          .reduce((acc, m) => acc + (m.metadata?.latency_ms || 0), 0) / cacheHits
      )
    : 0;

  const avgLiveLatency = liveInferences > 0
    ? Math.round(
        assistantMessages
          .filter((m) => m.metadata?.resolution_source === 'LIVE_INFERENCE')
          .reduce((acc, m) => acc + (m.metadata?.latency_ms || 0), 0) / liveInferences
      )
    : 0;

  const estimatedCost = (cumulativeTokens * 0.00000015).toFixed(6);

  const handlePurgeCache = async () => {
    setIsPurging(true);
    try {
      await clearCache();
      setPurgeSuccess(true);
      const freshStats = await fetchCacheStats();
      setCacheStats(freshStats);
      setTimeout(() => setPurgeSuccess(false), 2000);
    } catch (err) {
      console.error('Failed to purge cache:', err);
    } finally {
      setIsPurging(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      {/* Modal Dialog */}
      <div className="relative w-full max-w-lg bg-paper-2 border border-rule rounded-[16px] shadow-2xl p-5 z-10 animate-apple-entrance text-ink">
        <div className="flex items-center justify-between pb-3 border-b border-rule-subtle mb-4">
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full bg-ok animate-apple-pulse" />
            <h2 className="text-sm font-semibold tracking-tight font-display">
              Gateway Observability & Telemetry HUD
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-ink-subtle hover:text-ink text-xs font-mono px-2 py-1 rounded hover:bg-paper-3 transition-colors"
          >
            esc
          </button>
        </div>

        <div className="space-y-4 text-xs">
          {/* Top stats summary */}
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="p-3 bg-paper-3/60 rounded-[10px] border border-rule-subtle">
              <div className="text-[10px] uppercase font-mono text-ink-subtle mb-1">Cache Hit Ratio</div>
              <div className="text-xl font-bold font-mono text-accent">{cacheHitRatio}%</div>
              <div className="text-[10px] text-ink-muted mt-0.5">{cacheHits} of {totalCalls} calls</div>
            </div>

            <div className="p-3 bg-paper-3/60 rounded-[10px] border border-rule-subtle">
              <div className="text-[10px] uppercase font-mono text-ink-subtle mb-1">Total Tokens</div>
              <div className="text-xl font-bold font-mono text-ink">{cumulativeTokens}</div>
              <div className="text-[10px] text-ink-muted mt-0.5">est: ${estimatedCost}</div>
            </div>

            <div className="p-3 bg-paper-3/60 rounded-[10px] border border-rule-subtle">
              <div className="text-[10px] uppercase font-mono text-ink-subtle mb-1">Active Keys</div>
              <div className="text-xl font-bold font-mono text-ok">{health?.keys_configured || 2}</div>
              <div className="text-[10px] text-ink-muted mt-0.5">Health: 200 OK</div>
            </div>
          </div>

          {/* Visual cache ratio bar */}
          <div className="p-3 bg-paper-3/40 rounded-[10px] border border-rule-subtle space-y-2">
            <div className="flex justify-between text-[11px] font-mono">
              <span className="text-ink-muted">Cache vs Live Inference Distribution</span>
              <span className="text-ink font-medium">{cacheHits} cache / {liveInferences} live</span>
            </div>
            <div className="w-full h-2 rounded-full bg-paper-3 overflow-hidden flex">
              <div
                style={{ width: `${cacheHitRatio}%` }}
                className="bg-cool h-full transition-all duration-300"
                title={`Cache hits: ${cacheHitRatio}%`}
              />
              <div
                style={{ width: `${100 - cacheHitRatio}%` }}
                className="bg-accent h-full transition-all duration-300"
                title={`Live inferences: ${100 - cacheHitRatio}%`}
              />
            </div>
            <div className="flex justify-between text-[10px] font-mono text-ink-subtle">
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-cool" /> LLM_CACHE (avg {avgCacheLatency} ms)
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-accent" /> LIVE_INFERENCE (avg {avgLiveLatency} ms)
              </span>
            </div>
          </div>

          {/* Key Pool Status */}
          <div className="space-y-1.5">
            <div className="text-[11px] font-mono text-ink-muted font-medium">Configured Key Pool & Models</div>
            <div className="space-y-1">
              <div className="p-2.5 bg-paper-3/50 rounded-[8px] border border-rule-subtle flex items-center justify-between font-mono text-[11px]">
                <div className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-ok" />
                  <span className="font-semibold text-ink">key_1</span>
                  <span className="text-ink-subtle">(Primary)</span>
                </div>
                <div className="text-ink-muted">groq/openai/gpt-oss-20b</div>
              </div>

              <div className="p-2.5 bg-paper-3/50 rounded-[8px] border border-rule-subtle flex items-center justify-between font-mono text-[11px]">
                <div className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-ok" />
                  <span className="font-semibold text-ink">key_2</span>
                  <span className="text-ink-subtle">(Secondary Fallback)</span>
                </div>
                <div className="text-ink-muted">gemini/gemini-2.5-flash-lite</div>
              </div>
            </div>
          </div>

          {/* Cache Management */}
          <div className="p-3 bg-paper-3/50 rounded-[10px] border border-rule-subtle flex items-center justify-between">
            <div>
              <div className="font-medium text-ink">Gateway Cache Engine</div>
              <div className="text-[11px] text-ink-subtle font-mono">
                {cacheStats?.cache_type || 'LiteLLM Local In-Memory'} · {cacheStats?.cache_enabled ? 'enabled' : 'disabled'}
              </div>
            </div>

            <button
              type="button"
              onClick={handlePurgeCache}
              disabled={isPurging}
              className="px-3 py-1.5 rounded-[8px] bg-paper-2 border border-rule hover:border-rule-2 text-ink text-xs font-mono font-medium transition-all active:scale-95 disabled:opacity-50"
            >
              {purgeSuccess ? '✓ Purged!' : isPurging ? 'Purging...' : 'Purge Cache'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
