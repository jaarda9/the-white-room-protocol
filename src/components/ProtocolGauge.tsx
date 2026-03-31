interface ProtocolGaugeProps {
  completed: number;
  total: number;
  label: string;
  size?: number;
}

export const ProtocolGauge = ({ completed, total, label, size = 80 }: ProtocolGaugeProps) => {
  const percentage = total > 0 ? (completed / total) * 100 : 0;
  const radius = (size - 10) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (percentage / 100) * circumference;
  const center = size / 2;
  const ticks = 12;

  return (
    <div className="flex flex-col items-center gap-1.5">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          {Array.from({ length: ticks }).map((_, i) => {
            const angle = (i / ticks) * 2 * Math.PI;
            const inner = radius - 3;
            const outer = radius + 1;
            return (
              <line
                key={i}
                x1={center + inner * Math.cos(angle)}
                y1={center + inner * Math.sin(angle)}
                x2={center + outer * Math.cos(angle)}
                y2={center + outer * Math.sin(angle)}
                stroke="hsl(var(--border))"
                strokeWidth={1}
              />
            );
          })}
          <circle
            cx={center}
            cy={center}
            r={radius}
            className="gauge-ring"
            stroke="hsl(var(--border))"
            strokeWidth={2}
          />
          <circle
            cx={center}
            cy={center}
            r={radius}
            className="gauge-ring"
            stroke="hsl(var(--primary))"
            strokeWidth={2.5}
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            style={{ filter: 'drop-shadow(0 0 4px hsl(var(--terminal-glow) / 0.6))' }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="data-readout text-lg font-bold text-primary text-glow">
            {completed}
          </span>
          <span className="data-readout text-xs text-muted-foreground">/{total}</span>
        </div>
      </div>
      <span className="text-xs tracking-[0.15em] text-muted-foreground data-readout">{label}</span>
    </div>
  );
};
