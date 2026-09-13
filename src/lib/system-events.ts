/**
 * Contextual System events — ambient "[SYSTEM]" notices triggered by real state the app
 * already tracks (fatigue, HP, streaks, rank progress), not a new mechanic of their own.
 * Each event is deduped so it surfaces once per day (vitals-based) or once ever
 * (one-time milestones like a streak threshold or an approaching rank-up).
 */
import { getHunterVitals, getActivityLedger, getTodayKeyLocal, PENDING_HP_PENALTY_KEY } from '@/lib/storage';
import type { UserProfile } from '@/lib/types';

const SEEN_KEY = 'wrp_system_events_seen';

type SeenState = Record<string, string>;

const getSeenState = (): SeenState => {
  try {
    const raw = localStorage.getItem(SEEN_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
};

const markSeen = (state: SeenState, key: string, marker: string): SeenState => {
  const next = { ...state, [key]: marker };
  try {
    localStorage.setItem(SEEN_KEY, JSON.stringify(next));
  } catch {
    // ignore — a missed dedupe write just means an event might repeat once, not load-bearing
  }
  return next;
};

export interface SystemEvent {
  key: string;
  severity: 'critical' | 'notice' | 'milestone';
  title: string;
  description: string;
}

const STREAK_MILESTONES = [3, 7, 14, 30, 60, 100, 200, 365];
const RANK_THRESHOLDS = [10, 20, 30, 40, 50];

/**
 * Current directive streak: consecutive calendar days (local time) with at least one
 * logged XP gain, counting backward from today if today is active, or from yesterday
 * if today has no activity yet (the day isn't over — the streak isn't broken until a
 * full day passes with nothing logged).
 */
export const getCurrentStreak = (): number => {
  const ledger = getActivityLedger();
  if (ledger.length === 0) return 0;

  const activeDays = new Set(ledger.map((e) => getTodayKeyLocal(new Date(e.timestamp))));
  const todayKey = getTodayKeyLocal();
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayKey = getTodayKeyLocal(yesterday);

  if (!activeDays.has(todayKey) && !activeDays.has(yesterdayKey)) return 0;

  let count = 0;
  const cursor = activeDays.has(todayKey) ? new Date() : yesterday;
  while (activeDays.has(getTodayKeyLocal(cursor))) {
    count++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return count;
};

/** Evaluates all event rules against current state and returns any newly-triggered events. */
export const checkSystemEvents = (profile: UserProfile): SystemEvent[] => {
  const events: SystemEvent[] = [];
  let seen = getSeenState();
  const todayKey = getTodayKeyLocal();
  const vitals = getHunterVitals(profile);
  const streak = getCurrentStreak();
  const hpPct = vitals.hp.max > 0 ? vitals.hp.current / vitals.hp.max : 1;

  const shownToday = (key: string) => seen[key] === todayKey;

  // Nightly missed-quest HP penalty (storage.ts) previously applied with zero feedback —
  // surface it once, then clear the marker so it never repeats.
  try {
    const pendingPenaltyRaw = localStorage.getItem(PENDING_HP_PENALTY_KEY);
    if (pendingPenaltyRaw) {
      const pending = JSON.parse(pendingPenaltyRaw) as { amount: number; date: string };
      if (pending?.amount > 0) {
        events.push({
          key: 'hp-penalty',
          severity: 'critical',
          title: '[SYSTEM: PENALTY APPLIED]',
          description: `Incomplete directives from the previous cycle. -${pending.amount} HP.`,
        });
      }
      localStorage.removeItem(PENDING_HP_PENALTY_KEY);
    }
  } catch {
    // ignore
  }

  if (vitals.fatigue >= 85 && !shownToday('fatigue-critical')) {
    events.push({
      key: 'fatigue-critical',
      severity: 'critical',
      title: '[SYSTEM: INSTABILITY DETECTED]',
      description: `Fatigue at ${Math.round(vitals.fatigue)}%. A rest cycle is strongly advised before further exertion.`,
    });
    seen = markSeen(seen, 'fatigue-critical', todayKey);
  }

  if (hpPct <= 0.2 && !shownToday('hp-critical')) {
    events.push({
      key: 'hp-critical',
      severity: 'critical',
      title: '[SYSTEM: VITALITY CRITICAL]',
      description: 'Hit points critically low. A recovery protocol is recommended before your next directive.',
    });
    seen = markSeen(seen, 'hp-critical', todayKey);
  }

  // Surfaces the existing (otherwise invisible) +10% EXP bonus for sustaining high HP.
  if (hpPct >= 0.9 && !shownToday('peak-vitality')) {
    events.push({
      key: 'peak-vitality',
      severity: 'notice',
      title: '[SYSTEM: PEAK VITALITY CONFIRMED]',
      description: 'HP sustained above 90%. EXP acquisition rate is optimized (+10%) while this state holds.',
    });
    seen = markSeen(seen, 'peak-vitality', todayKey);
  }

  const nextThreshold = RANK_THRESHOLDS.find((t) => t > profile.level);
  if (nextThreshold && nextThreshold - profile.level === 1) {
    const key = `rank-approach-${nextThreshold}`;
    if (!seen[key]) {
      events.push({
        key,
        severity: 'notice',
        title: '[SYSTEM: AWAKENING THRESHOLD APPROACHING]',
        description: 'One level remains before your next Rank advancement. The System is watching, Hunter.',
      });
      seen = markSeen(seen, key, todayKey);
    }
  }

  if (STREAK_MILESTONES.includes(streak)) {
    const key = `streak-${streak}`;
    if (!seen[key]) {
      events.push({
        key,
        severity: 'milestone',
        title: '[SYSTEM: DIRECTIVE STREAK SUSTAINED]',
        description: `${streak}-day unbroken streak recorded. The System takes note of your consistency.`,
      });
      seen = markSeen(seen, key, todayKey);
    }
  }

  const lastKnownStreak = Number(seen.__lastStreak || 0);
  if (lastKnownStreak >= 3 && streak === 0 && !shownToday('streak-broken')) {
    events.push({
      key: 'streak-broken',
      severity: 'notice',
      title: '[SYSTEM: CONTINUITY INTERRUPTED]',
      description: `Your ${lastKnownStreak}-day streak has reset. The System does not dwell on the past — begin again, Hunter.`,
    });
    seen = markSeen(seen, 'streak-broken', todayKey);
  }

  if (streak !== lastKnownStreak) {
    markSeen(seen, '__lastStreak', String(streak));
  }

  return events;
};
