import React from 'react';

interface FailoverTesterProps {
  currentRule: string;
  onSelectRule: (rule: string) => void;
}

// Each step in the routing diagram: what to show and whether it is a success or a failure.
type Step = { text: string; failed?: boolean };

// The 4 buttons. `pipeline` is the path a request takes when that rule is active.
const OPTIONS: Array<{ label: string; value: string; desc: string; pipeline: Step[] }> = [
  {
    label: 'Normal (Direct)',
    value: '',
    desc: 'Direct execution on primary key_1',
    pipeline: [{ text: 'key_1 (Primary)' }, { text: '200 OK' }],
  },
  {
    label: 'key_1=429',
    value: 'key_1=429',
    desc: 'Simulate rate limit on primary -> fallback to key_2',
    pipeline: [{ text: 'key_1 (429 RateLimit)', failed: true }, { text: 'key_2 (Fallback)' }, { text: '200 OK' }],
  },
  {
    label: 'key_1=500',
    value: 'key_1=500',
    desc: 'Simulate 500 error on primary -> fallback to key_2',
    pipeline: [{ text: 'key_1 (500 Error)', failed: true }, { text: 'key_2 (Fallback)' }, { text: '200 OK' }],
  },
  {
    label: '*=429',
    value: '*=429',
    desc: 'Exhaust all keys -> clean HTTP 503 response',
    pipeline: [
      { text: 'key_1 (429)', failed: true },
      { text: 'key_2 (429)', failed: true },
      { text: '503 Service Unavailable', failed: true },
    ],
  },
];

export const FailoverTester: React.FC<FailoverTesterProps> = ({ currentRule, onSelectRule }) => {
  const pipeline = OPTIONS.find((opt) => opt.value === currentRule)?.pipeline ?? [];

  return (
    <div className="bg-paper-2/60 border border-rule-subtle rounded-[12px] p-2.5 transition-colors">
      <div className="flex items-center justify-between mb-2 px-1">
        <div className="flex items-center gap-2">
          <span className="text-xs text-ink font-medium">Failover Simulation Testbench</span>
          <span className="text-[10px] font-mono text-ink-subtle bg-paper-3 px-1.5 py-0.5 rounded border border-rule-subtle">
            X-Simulate-Failure
          </span>
        </div>
        {currentRule ? (
          <span className="inline-flex items-center gap-1.5 text-[11px] font-mono text-accent bg-accent-soft px-2 py-0.5 rounded-full border border-accent/20">
            <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
            <span>active: {currentRule}</span>
          </span>
        ) : (
          <span className="text-[11px] text-ink-subtle font-mono">live routing</span>
        )}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 mb-2">
        {OPTIONS.map((opt) => {
          const isActive = currentRule === opt.value;
          return (
            <button
              key={opt.label}
              type="button"
              onClick={() => onSelectRule(opt.value)}
              className={`px-3 py-2 rounded-[8px] border text-left transition-[background-color,border-color,transform] duration-150 active:scale-[0.98] ${
                isActive
                  ? 'bg-paper-3 border-rule-2 text-ink shadow-sm ring-1 ring-rule-2'
                  : 'bg-paper-3/40 border-rule-subtle hover:border-rule text-ink-muted hover:text-ink hover:bg-paper-3/70'
              }`}
              title={opt.desc}
            >
              <div className="font-mono text-xs font-semibold leading-none mb-1">
                {opt.label}
              </div>
              <div className="text-[10px] text-ink-subtle truncate">
                {opt.desc}
              </div>
            </button>
          );
        })}
      </div>

      {/* Visual routing trace */}
      <div className="px-2 py-1.5 rounded-[6px] bg-paper-3/60 border border-rule-subtle/60 flex items-center justify-between">
        <span className="text-[10px] font-mono text-ink-subtle uppercase">Routing Pipeline:</span>
        <div className="flex items-center gap-1.5 text-[10px] font-mono flex-wrap">
          <span className="text-ink">Client</span>
          {pipeline.map((step) => (
            <React.Fragment key={step.text}>
              <span className="text-ink-subtle">➔</span>
              <span className={step.failed ? 'text-bad line-through decoration-bad font-semibold' : 'text-ok font-semibold'}>
                {step.text}
              </span>
            </React.Fragment>
          ))}
        </div>
      </div>
    </div>
  );
};
