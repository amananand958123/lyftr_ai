import React from 'react';

interface PromptPresetsProps {
  onSelectPreset: (presetText: string) => void;
}

export const PRESETS = [
  {
    title: 'Concise Explainer',
    prompt: 'You are a concise engineering explainer. Give crisp, direct answers in 2-3 sentences max.',
  },
  {
    title: 'Code Reviewer',
    prompt: 'You are a principal staff engineer. Critique code for correctness, time complexity, and edge cases.',
  },
  {
    title: 'Root Cause Debugger',
    prompt: 'You are a systems reliability engineer. Diagnose failures with step-by-step root cause analysis.',
  },
  {
    title: 'LaTeX Specialist',
    prompt: 'You are an academic researcher. Formulate mathematical responses with formal notation and LaTeX.',
  },
];

export const PromptPresets: React.FC<PromptPresetsProps> = ({ onSelectPreset }) => {
  return (
    <div className="flex flex-wrap items-center gap-1.5 mt-2">
      <span className="text-[11px] text-ink-subtle mr-1">presets:</span>
      {PRESETS.map((p) => (
        <button
          key={p.title}
          type="button"
          onClick={() => onSelectPreset(p.prompt)}
          className="px-2 py-0.5 rounded-[6px] bg-paper-3 border border-rule-subtle hover:border-rule text-ink-muted hover:text-ink text-[11px] transition-[background-color,border-color] duration-150"
        >
          {p.title}
        </button>
      ))}
    </div>
  );
};
