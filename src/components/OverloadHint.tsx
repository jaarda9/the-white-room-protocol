import { useMemo } from 'react';
import { TrendingUp } from 'lucide-react';
import type { PhysicalExerciseLog } from '@/lib/storage';
import { overloadTarget } from '@/lib/overload';

/** "LAST 8 reps @ 40 kg → TODAY 9 reps @ 40 kg", from the player's own log. Nothing without history. */
export default function OverloadHint({ row, today }: { row: PhysicalExerciseLog; today: string }) {
  // History only changes on other days, so the exercise name is the only real dependency.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const target = useMemo(() => overloadTarget(row, today), [row.exercise, row.kind, today]);
  if (!target) return null;
  return (
    <div className="flex items-center gap-1.5 text-[10px] font-mono text-white/60 leading-relaxed">
      <TrendingUp className="w-3 h-3 text-emerald-400 shrink-0" />
      <span>
        LAST {target.last} <span className="text-white/35">→</span>{' '}
        <span className="text-emerald-300 font-bold">TODAY {target.target}</span>
      </span>
    </div>
  );
}
