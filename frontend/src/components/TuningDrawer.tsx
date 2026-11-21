import React from 'react';

interface TuningDrawerProps {
  temperature: number;
  maxTokens: number;
  onTemperatureChange: (val: number) => void;
  onMaxTokensChange: (val: number) => void;
}

export const TuningDrawer: React.FC<TuningDrawerProps> = ({
  temperature,
  maxTokens,
  onTemperatureChange,
  onMaxTokensChange,
}) => {
  return (
    <div className="mt-2 p-3 bg-paper-2/90 border border-rule-subtle rounded-[12px] text-xs">
      <div className="flex items-center justify-between mb-3 pb-1 border-b border-rule-subtle">
        <span className="text-ink-muted">Inference Hyperparameters</span>
        <span className="text-[11px] font-mono text-ink-subtle">gateway tuning</span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <div className="flex justify-between items-center mb-1">
            <label className="text-ink-muted">Temperature</label>
            <span className="font-mono text-ink font-medium">{temperature.toFixed(2)}</span>
          </div>
          <input
            type="range"
            min="0.0"
            max="1.0"
            step="0.05"
            value={temperature}
            onChange={(e) => onTemperatureChange(parseFloat(e.target.value))}
            className="w-full accent-[var(--color-accent)] cursor-pointer"
          />
          <div className="flex justify-between text-[10px] text-ink-subtle mt-0.5 font-mono">
            <span>deterministic (0.0)</span>
            <span>creative (1.0)</span>
          </div>
        </div>

        <div>
          <div className="flex justify-between items-center mb-1">
            <label className="text-ink-muted">Max Tokens</label>
            <span className="font-mono text-ink font-medium">{maxTokens}</span>
          </div>
          <input
            type="range"
            min="256"
            max="4096"
            step="128"
            value={maxTokens}
            onChange={(e) => onMaxTokensChange(parseInt(e.target.value, 10))}
            className="w-full accent-[var(--color-accent)] cursor-pointer"
          />
          <div className="flex justify-between text-[10px] text-ink-subtle mt-0.5 font-mono">
            <span>256</span>
            <span>4096</span>
          </div>
        </div>
      </div>
    </div>
  );
};
