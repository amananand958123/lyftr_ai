import React from 'react';

interface LatencyPoint {
  latency_ms: number;
  is_cache: boolean;
}

interface LatencySparklineProps {
  points: LatencyPoint[];
}

export const LatencySparkline: React.FC<LatencySparklineProps> = ({ points }) => {
  if (points.length < 2) return null;

  const width = 120;
  const height = 24;
  const padding = 2;

  const latencies = points.map((p) => p.latency_ms);
  const min = Math.min(...latencies, 0);
  const max = Math.max(...latencies, 500);

  const range = max - min || 1;

  const coords = points.map((p, idx) => {
    const x = padding + (idx / (points.length - 1)) * (width - 2 * padding);
    const y = height - padding - ((p.latency_ms - min) / range) * (height - 2 * padding);
    return { x, y, is_cache: p.is_cache, val: p.latency_ms };
  });

  const pathD = coords.reduce((acc, curr, idx) => {
    return `${acc} ${idx === 0 ? 'M' : 'L'} ${curr.x.toFixed(1)} ${curr.y.toFixed(1)}`;
  }, '');

  return (
    <div className="flex items-center gap-2 text-[10px] text-ink-subtle font-mono">
      <span>latency trend:</span>
      <svg
        width={width}
        height={height}
        className="overflow-visible"
        aria-label="Latency history sparkline"
      >
        <path
          d={pathD}
          fill="none"
          stroke="var(--color-rule-2)"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {coords.map((c, i) => (
          <circle
            key={i}
            cx={c.x}
            cy={c.y}
            r="2"
            fill={c.is_cache ? 'var(--color-cool)' : 'var(--color-accent)'}
          />
        ))}
      </svg>
      <span className="text-ink font-medium">{points[points.length - 1].latency_ms}ms</span>
    </div>
  );
};
