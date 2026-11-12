/**
 * Adaptive durations (Phase A3): directives that grow with the Hunter.
 *
 * Reading, study and meditation move in 5-minute steps around the player's calibrated value:
 *   7 completed days in a row → +5 min (at most +15)    "[DIRECTIVE UPGRADED]"
 *   3 missed days in a row    → −5 min (at most −10, never under 5 min)
 * Judged once per day at the reset, from the outgoing day's quests, and only on days the
 * directive was mandatory (a rank-bonus directive is optional, so it is not judged).
 */
import type { Quest } from '@/lib/types';
import { getDirectiveKey } from '@/lib/quest-content';
import { requestSync } from '@/lib/sync-signal';

export const ADAPTIVE_KEY = 'wrp_adaptive_durations';

export type AdaptiveDirective = 'reading' | 'study' | 'meditation';
const DIRECTIVES: AdaptiveDirective[] = ['reading', 'study', 'meditation'];

const STEP_MIN = 5;
const MAX_LEVEL = 3;
const MIN_LEVEL = -2;
const FLOOR_MIN = 5;
const UPGRADE_STREAK = 7;
const DOWNGRADE_MISSES = 3;

interface Track {
  level: number;
  streak: number;
  misses: number;
}

interface AdaptiveState {
  lastEvaluated: string | null;
  tracks: Record<AdaptiveDirective, Track>;
}

const fresh = (): AdaptiveState => ({
  lastEvaluated: null,
  tracks: {
    reading: { level: 0, streak: 0, misses: 0 },
    study: { level: 0, streak: 0, misses: 0 },
    meditation: { level: 0, streak: 0, misses: 0 },
  },
});

const clampInt = (v: unknown, lo: number, hi: number) => Math.min(hi, Math.max(lo, Math.round(Number(v) || 0)));

export function getAdaptiveState(): AdaptiveState {
  const base = fresh();
  try {
    const parsed = JSON.parse(localStorage.getItem(ADAPTIVE_KEY) || 'null');
    if (!parsed || typeof parsed !== 'object') return base;
    for (const d of DIRECTIVES) {
      const t = parsed.tracks?.[d];
      if (t) {
        base.tracks[d] = {
          level: clampInt(t.level, MIN_LEVEL, MAX_LEVEL),
          streak: clampInt(t.streak, 0, 365),
          misses: clampInt(t.misses, 0, 365),
        };
      }
    }
    base.lastEvaluated = typeof parsed.lastEvaluated === 'string' ? parsed.lastEvaluated : null;
  } catch {
    // corrupted: start fresh
  }
  return base;
}

/** Today's minutes for a directive whose calibrated value is `base`. */
export function effectiveMinutes(directive: AdaptiveDirective, base: number, state = getAdaptiveState()): number {
  const level = state.tracks[directive].level;
  return Math.max(FLOOR_MIN, Math.round(base) + level * STEP_MIN);
}

export interface AdaptiveChange {
  directive: AdaptiveDirective;
  direction: 'up' | 'down';
  level: number;
}

/**
 * Judges the outgoing day. Pure with respect to its inputs; returns the new state and any
 * level changes. Idempotent per day via `lastEvaluated`.
 */
export function evaluateDay(
  previousQuests: Quest[],
  todayKey: string,
  state: AdaptiveState
): { state: AdaptiveState; changes: AdaptiveChange[] } {
  if (state.lastEvaluated === todayKey) return { state, changes: [] };
  const next: AdaptiveState = {
    lastEvaluated: todayKey,
    tracks: { ...state.tracks },
  };
  const changes: AdaptiveChange[] = [];
  for (const d of DIRECTIVES) {
    const quest = previousQuests.find((q) => q && q.origin === 'system' && getDirectiveKey(q) === d);
    if (!quest || quest.isChainBonus) continue; // absent or optional that day: not judged
    const t = { ...next.tracks[d] };
    if (quest.completed) {
      t.streak += 1;
      t.misses = 0;
      if (t.streak >= UPGRADE_STREAK) {
        t.streak = 0;
        if (t.level < MAX_LEVEL) {
          t.level += 1;
          changes.push({ directive: d, direction: 'up', level: t.level });
        }
      }
    } else {
      t.misses += 1;
      t.streak = 0;
      if (t.misses >= DOWNGRADE_MISSES) {
        t.misses = 0;
        if (t.level > MIN_LEVEL) {
          t.level -= 1;
          changes.push({ directive: d, direction: 'down', level: t.level });
        }
      }
    }
    next.tracks[d] = t;
  }
  return { state: next, changes };
}

export function saveAdaptiveState(state: AdaptiveState): void {
  try {
    localStorage.setItem(ADAPTIVE_KEY, JSON.stringify(state));
  } catch {
    // ignore
  }
  requestSync();
}
