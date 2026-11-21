import React from 'react';
import { ChatMetadata } from '../types';
import { COST_PER_TOKEN } from '../utils/export';

interface MetadataBadgeProps {
  metadata: ChatMetadata;
  cumulativeTokens?: number;
}

export const MetadataBadge: React.FC<MetadataBadgeProps> = ({ metadata, cumulativeTokens }) => {
  const isCache = metadata.resolution_source === 'LLM_CACHE';

  const inTok = metadata.input_tokens || 0;
  const outTok = metadata.output_tokens || 0;
  const estimatedCost = ((inTok + outTok) * COST_PER_TOKEN).toFixed(6);

  return (
    <div className="mt-3 pt-2.5 border-t border-rule-subtle flex flex-wrap items-center gap-2 text-xs font-mono">
      {/* Required meta-source */}
      <span
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-[6px] text-[11px] font-medium border transition-colors ${
          isCache
            ? 'bg-cool-soft text-cool border-cool/30'
            : 'bg-ok-soft text-ok border-ok/30'
        }`}
      >
        <span className={`w-1.5 h-1.5 rounded-full ${isCache ? 'bg-cool' : 'bg-ok'}`} />
        <span data-testid="meta-source">{metadata.resolution_source}</span>
      </span>

      {/* Required meta-model */}
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-[6px] bg-paper-3 border border-rule text-ink-2 text-[11px] font-mono tracking-tight">
        <span className="text-ink-subtle">model</span>
        <span data-testid="meta-model" className="text-ink">{metadata.model || 'persisted'}</span>
      </span>

      {/* Required meta-latency */}
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-[6px] bg-paper-3 border border-rule text-ink-2 text-[11px] tabular-nums">
        <span className="text-ink-subtle">latency</span>
        <span data-testid="meta-latency" className="text-ink font-medium">
          {metadata.latency_ms !== undefined && metadata.latency_ms !== null
            ? `${metadata.latency_ms} ms`
            : 'persisted'}
        </span>
      </span>

      {/* Required meta-input-tokens */}
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-[6px] bg-paper-3 border border-rule text-ink-2 text-[11px] tabular-nums">
        <span className="text-ink-subtle">in</span>
        <span data-testid="meta-input-tokens" className="text-ink font-medium">
          {inTok}
        </span>
      </span>

      {/* Required meta-output-tokens */}
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-[6px] bg-paper-3 border border-rule text-ink-2 text-[11px] tabular-nums">
        <span className="text-ink-subtle">out</span>
        <span data-testid="meta-output-tokens" className="text-ink font-medium">
          {outTok}
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
