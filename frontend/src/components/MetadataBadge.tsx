import React from 'react';
import { ChatMetadata } from '../types';

interface MetadataBadgeProps {
  metadata: ChatMetadata;
  cumulativeTokens?: number;
}

export const MetadataBadge: React.FC<MetadataBadgeProps> = ({ metadata, cumulativeTokens }) => {
  const isCache = metadata.resolution_source === 'LLM_CACHE';

  // Rough estimation: blended ~$0.15 per million tokens for lightweight models
  const totalTokens = metadata.input_tokens + metadata.output_tokens;
  const estimatedCost = (totalTokens * 0.00000015).toFixed(6);

  return (
    <div className="mt-3 pt-2.5 border-t border-rule-subtle flex flex-wrap items-center gap-2 text-xs font-mono">
      {/* Required meta-source */}
      <span
        data-testid="meta-source"
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-[6px] text-[11px] font-medium border transition-colors ${
          isCache
            ? 'bg-cool-soft text-cool border-cool/30'
            : 'bg-ok-soft text-ok border-ok/30'
        }`}
      >
        <span className={`w-1.5 h-1.5 rounded-full ${isCache ? 'bg-cool' : 'bg-ok'}`} />
        <span>{metadata.resolution_source}</span>
      </span>

      {/* Required meta-model */}
      <span
        data-testid="meta-model"
        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-[6px] bg-paper-3 border border-rule text-ink-2 text-[11px] font-mono tracking-tight"
      >
        <span className="text-ink-subtle">model</span>
        <span className="text-ink">{metadata.model}</span>
      </span>

      {/* Required meta-latency */}
      <span
        data-testid="meta-latency"
        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-[6px] bg-paper-3 border border-rule text-ink-2 text-[11px] tabular-nums"
      >
        <span className="text-ink-subtle">latency</span>
        <span className="text-ink font-medium">{metadata.latency_ms} ms</span>
      </span>

      {/* Required meta-input-tokens */}
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-[6px] bg-paper-3 border border-rule text-ink-2 text-[11px] tabular-nums">
        <span className="text-ink-subtle">in</span>
        <span data-testid="meta-input-tokens" className="text-ink font-medium">
          {metadata.input_tokens}
        </span>
      </span>

      {/* Required meta-output-tokens */}
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-[6px] bg-paper-3 border border-rule text-ink-2 text-[11px] tabular-nums">
        <span className="text-ink-subtle">out</span>
        <span data-testid="meta-output-tokens" className="text-ink font-medium">
          {metadata.output_tokens}
        </span>
      </span>

      {/* Key ID and failover indicator */}
      {metadata.key_id && (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-[6px] bg-paper-3 border border-rule text-[11px]">
          <span className="text-ink-subtle">key</span>
          <span className="text-accent font-medium">{metadata.key_id}</span>
          {metadata.fallback_attempts > 0 && (
            <span className="ml-1 text-bad font-semibold">
              (failover: {metadata.fallback_attempts})
            </span>
          )}
        </span>
      )}

      {/* Cost & Token HUD (US-009) */}
      <span className="inline-flex items-center gap-1 px-2 py-1 text-[10px] text-ink-subtle">
        <span>est: ${estimatedCost}</span>
        {cumulativeTokens !== undefined && (
          <span>· session: {cumulativeTokens} tok</span>
        )}
      </span>
    </div>
  );
};
