/**
 * Progressive overload (Phase A2): today's target for each exercise, from the player's own set
 * log — no AI. Double progression: add a rep each session at the same weight; once the top set
 * reaches the rep ceiling, add weight and drop back to the rep floor.
 *
 * Reads whiteroom_physical_quest_logs (storage.ts), which keeps every logged day.
 */
import type { PhysicalExerciseLog } from '@/lib/storage';

const LOGS_KEY = 'whiteroom_physical_quest_logs';
const REP_CEILING = 12;
const REP_FLOOR = 8;

export const normalizeExercise = (name: string) => String(name || '').toLowerCase().replace(/[^a-z0-9]/g, '');

/** First number in "40", "40kg", "88 lbs", "40,5" → 40.5. NaN when none. */
export const parseNum = (v: unknown): number => {
  const m = String(v ?? '').replace(',', '.').match(/\d+(\.\d+)?/);
  return m ? Number(m[0]) : NaN;
};

export interface SessionSummary {
  date: string;
  /** Heaviest weight lifted for at least one rep (NaN = bodyweight / not logged). */
  topWeight: number;
  /** Most reps at that top weight. */
  topReps: number;
  /** Number of sets with reps logged. */
  sets: number;
  /** Cardio / flexibility minutes. */
  minutes: number;
}

function summarize(date: string, row: PhysicalExerciseLog): SessionSummary | null {
  if (row.kind === 'strength') {
    const done = (row.sets || [])
      .map((s) => ({ reps: parseNum(s.reps), weight: parseNum(s.weightKg) }))
      .filter((s) => s.reps > 0);
    if (done.length === 0) return null;
    const weights = done.map((s) => s.weight).filter((w) => Number.isFinite(w) && w > 0);
    const topWeight = weights.length ? Math.max(...weights) : NaN;
    const atTop = Number.isFinite(topWeight) ? done.filter((s) => s.weight === topWeight) : done;
    return { date, topWeight, topReps: Math.max(...atTop.map((s) => s.reps)), sets: done.length, minutes: NaN };
  }
  const minutes = parseNum(row.timeMinutes);
  if (!(minutes > 0)) return null;
  return { date, topWeight: NaN, topReps: NaN, sets: 0, minutes };
}

/** Every past session of this exercise before `beforeDate`, newest first. */
export function exerciseHistory(exercise: string, beforeDate: string): SessionSummary[] {
  const target = normalizeExercise(exercise);
  if (!target) return [];
  let all: Record<string, { date?: string; rows?: PhysicalExerciseLog[] }> = {};
  try {
    all = JSON.parse(localStorage.getItem(LOGS_KEY) || '{}') || {};
  } catch {
    return [];
  }
  const out: SessionSummary[] = [];
  for (const entry of Object.values(all)) {
    const date = entry?.date;
    if (typeof date !== 'string' || date >= beforeDate || !Array.isArray(entry.rows)) continue;
    for (const row of entry.rows) {
      if (!row || normalizeExercise(row.exercise) !== target) continue;
      const s = summarize(date, row);
      if (s) out.push(s);
    }
  }
  return out.sort((a, b) => b.date.localeCompare(a.date));
}

const fmtWeight = (w: number) => `${Number.isInteger(w) ? w : w.toFixed(1)} kg`;

export interface OverloadTarget {
  last: string;
  target: string;
}

/** "LAST: 8 reps @ 40 kg → TODAY: 9 reps @ 40 kg", or null without history. */
export function overloadTarget(row: PhysicalExerciseLog, today: string): OverloadTarget | null {
  if (row.kind === 'flexibility') return null;
  const [last] = exerciseHistory(row.exercise, today);
  if (!last) return null;
  if (row.kind === 'cardio' || !Number.isFinite(last.topReps)) {
    if (!(last.minutes > 0)) return null;
    // Endurance: about +5%, at least one more minute, never more than 5 minutes at once.
    const next = Math.round(last.minutes + Math.min(5, Math.max(1, last.minutes * 0.05)));
    return { last: `${last.minutes} min`, target: `${next} min` };
  }
  if (!Number.isFinite(last.topWeight)) {
    return { last: `${last.topReps} reps`, target: `${last.topReps + 1} reps` };
  }
  if (last.topReps >= REP_CEILING) {
    const step = last.topWeight >= 40 ? 2.5 : 1;
    return {
      last: `${last.topReps} reps @ ${fmtWeight(last.topWeight)}`,
      target: `${REP_FLOOR} reps @ ${fmtWeight(last.topWeight + step)}`,
    };
  }
  return {
    last: `${last.topReps} reps @ ${fmtWeight(last.topWeight)}`,
    target: `${last.topReps + 1} reps @ ${fmtWeight(last.topWeight)}`,
  };
}

/** Heaviest weight ever lifted for this exercise before today (NaN when none). */
export function bestWeightBefore(exercise: string, today: string): number {
  const weights = exerciseHistory(exercise, today)
    .map((s) => s.topWeight)
    .filter((w) => Number.isFinite(w));
  return weights.length ? Math.max(...weights) : NaN;
}

/**
 * A new personal record set today: a weight above every earlier session (needs at least one
 * earlier weighted session — the very first log is a baseline, not a record).
 */
export function detectRecord(row: PhysicalExerciseLog, today: string): number | null {
  if (row.kind !== 'strength') return null;
  const previous = bestWeightBefore(row.exercise, today);
  if (!Number.isFinite(previous)) return null;
  const todayTop = summarize(today, row)?.topWeight;
  return todayTop !== undefined && Number.isFinite(todayTop) && todayTop > previous ? todayTop : null;
}
