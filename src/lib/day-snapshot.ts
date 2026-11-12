/**
 * Profile snapshot at the day's reset, so the Daily Report can show what today added (EXP,
 * levels, stat progress). Kept separate from daily-report.ts because storage.ts writes it and
 * daily-report.ts reads storage.ts — this file imports neither.
 */
import type { Attributes, UserProfile } from '@/lib/types';

export const DAY_SNAPSHOT_KEY = 'wrp_day_snapshot';

export interface DaySnapshot {
  date: string;
  level: number;
  xp: number;
  /** visible + hidden (accumulated) points per stat — level-ups move hidden into visible. */
  stats: Attributes;
}

const STATS: (keyof Attributes)[] = ['STR', 'AGI', 'VIT', 'INT', 'PER', 'WIS'];

export function combinedStats(profile: Pick<UserProfile, 'visibleStats' | 'accumulatedPoints'>): Attributes {
  const out = { STR: 0, AGI: 0, VIT: 0, INT: 0, PER: 0, WIS: 0 } as Attributes;
  for (const k of STATS) {
    out[k] = (Number(profile.visibleStats?.[k]) || 0) + (Number(profile.accumulatedPoints?.[k]) || 0);
  }
  return out;
}

/** Records the snapshot once per day (the first reset of `date` wins). */
export function saveDaySnapshot(profile: UserProfile, date: string): void {
  try {
    const existing = JSON.parse(localStorage.getItem(DAY_SNAPSHOT_KEY) || 'null');
    if (existing?.date === date) return;
    const snap: DaySnapshot = {
      date,
      level: Number(profile.level) || 1,
      xp: Number(profile.xp) || 0,
      stats: combinedStats(profile),
    };
    localStorage.setItem(DAY_SNAPSHOT_KEY, JSON.stringify(snap));
  } catch {
    // ignore
  }
}

export function getDaySnapshot(date: string): DaySnapshot | null {
  try {
    const parsed = JSON.parse(localStorage.getItem(DAY_SNAPSHOT_KEY) || 'null');
    return parsed?.date === date ? (parsed as DaySnapshot) : null;
  } catch {
    return null;
  }
}
