import React from 'react';
import { Sliders, AlertOctagon } from 'lucide-react';

interface FailoverTesterProps {
  currentRule: string;
  onSelectRule: (rule: string) => void;
}

export const FailoverTester: React.FC<FailoverTesterProps> = ({ currentRule, onSelectRule }) => {
  const options = [
    { label: 'Normal (None)', value: '', desc: 'Direct execution on primary key' },
    { label: 'key_1=429', value: 'key_1=429', desc: 'Simulate Rate Limit on Primary -> Fallback to key_2' },
    { label: 'key_1=500', value: 'key_1=500', desc: 'Simulate Internal Error on Primary -> Fallback to key_2' },
    { label: '*=429', value: '*=429', desc: 'Exhaust All Keys -> Expect Clean HTTP 503' },
  ];

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3 mb-4 shadow-sm text-xs">
      <div className="flex items-center justify-between mb-2 pb-1.5 border-b border-slate-800/60">
        <span className="flex items-center gap-1.5 font-semibold text-slate-300">
          <Sliders className="w-3.5 h-3.5 text-indigo-400" />
          Evaluator Test Hook (<code className="text-amber-400 font-mono">X-Simulate-Failure</code>)
        </span>
        {currentRule && (
          <span className="inline-flex items-center gap-1 text-[11px] text-amber-400 bg-amber-950/50 px-2 py-0.5 rounded border border-amber-800/60 font-mono">
            <AlertOctagon className="w-3 h-3" />
            Active: {currentRule}
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {options.map((opt) => {
          const isActive = currentRule === opt.value;
          return (
            <button
              key={opt.label}
              onClick={() => onSelectRule(opt.value)}
              className={`px-2.5 py-1.5 rounded-lg border text-left transition-all ${
                isActive
                  ? 'bg-indigo-600/20 border-indigo-500 text-indigo-200 shadow-sm'
                  : 'bg-slate-950/60 border-slate-800 hover:border-slate-700 text-slate-400'
              }`}
              title={opt.desc}
            >
              <div className="font-mono font-medium text-[11px] text-slate-200">
                {opt.label}
              </div>
              <div className="text-[10px] text-slate-500 truncate mt-0.5">
                {opt.desc}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};
