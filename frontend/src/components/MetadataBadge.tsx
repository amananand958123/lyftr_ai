import React from 'react';
import { Zap, Database, Clock, Cpu, ArrowDownRight, ShieldCheck } from 'lucide-react';
import { ChatMetadata } from '../types';

interface MetadataBadgeProps {
  metadata: ChatMetadata;
}

export const MetadataBadge: React.FC<MetadataBadgeProps> = ({ metadata }) => {
  const isCache = metadata.resolution_source === 'LLM_CACHE';

  return (
    <div className="mt-3 pt-2.5 border-t border-slate-800/80 flex flex-wrap items-center gap-2 text-xs">
      {/* Required meta-source */}
      <span
        data-testid="meta-source"
        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full font-mono text-[11px] font-semibold border ${
          isCache
            ? 'bg-cyan-950/60 text-cyan-400 border-cyan-800/60'
            : 'bg-emerald-950/60 text-emerald-400 border-emerald-800/60'
        }`}
      >
        {isCache ? <Database className="w-3 h-3 text-cyan-400" /> : <Zap className="w-3 h-3 text-emerald-400" />}
        {metadata.resolution_source}
      </span>

      {/* Required meta-model */}
      <span
        data-testid="meta-model"
        className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-slate-900 border border-slate-800 text-slate-300 font-mono text-[11px]"
      >
        <Cpu className="w-3 h-3 text-slate-400" />
        {metadata.model}
      </span>

      {/* Required meta-latency */}
      <span
        data-testid="meta-latency"
        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-900/80 border border-slate-800/60 text-slate-400 font-mono text-[11px]"
      >
        <Clock className="w-3 h-3 text-amber-400/80" />
        {metadata.latency_ms} ms
      </span>

      {/* Required meta-input-tokens */}
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-900/80 border border-slate-800/60 text-slate-400 font-mono text-[11px]">
        <ArrowDownRight className="w-3 h-3 text-indigo-400" />
        In: <span data-testid="meta-input-tokens" className="text-slate-200 font-semibold">{metadata.input_tokens}</span>
      </span>

      {/* Required meta-output-tokens */}
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-900/80 border border-slate-800/60 text-slate-400 font-mono text-[11px]">
        Out: <span data-testid="meta-output-tokens" className="text-slate-200 font-semibold">{metadata.output_tokens}</span>
      </span>

      {/* Key ID and failover attempt indicator */}
      {metadata.key_id && (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-900/80 border border-slate-800/60 text-slate-400 font-mono text-[11px]">
          <ShieldCheck className="w-3 h-3 text-violet-400" />
          {metadata.key_id}
          {metadata.fallback_attempts > 0 && (
            <span className="text-amber-400 font-bold ml-1">
              (failover: {metadata.fallback_attempts})
            </span>
          )}
        </span>
      )}
    </div>
  );
};
