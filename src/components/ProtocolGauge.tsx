interface ProtocolGaugeProps {
  completed: number;
  total: number;
  label: string;
  size?: number;
}

export const ProtocolGauge = ({ completed, total, label, size = 80 }: ProtocolGaugeProps) => {
  const percentage = total > 0 ? (completed / total) * 100 : 0;
  const radius = (size - 8) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (percentage / 100) * circumference;

  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            className="gauge-ring"
            stroke="hsl(var(--border))"
            strokeWidth={3}
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            className="gauge-ring"
            stroke="hsl(var(--primary))"
            strokeWidth={3}
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            style={{ filter: 'drop-shadow(0 0 4px hsl(var(--terminal-glow) / 0.5))' }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="data-readout text-lg font-bold text-primary text-glow">
            {completed}
          </span>
          <span className="data-readout text-[0.5rem] text-muted-foreground">/{total}</span>
        </div>
      </div>
      <span className="text-[0.6rem] uppercase tracking-widest text-muted-foreground">{label}</span>
    </div>
  );
};
