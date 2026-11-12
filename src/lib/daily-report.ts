/**
 * Daily Report (Phase A4): shown when the clear reward is claimed. No AI — THEIA's personal
 * verdict arrives in Phase B; until then the verdict is the System's rotating clear line.
 */
import type { Attributes, Quest, UserProfile } from '@/lib/types';
import { calculateXPForLevel, getPhysicalDayPlan, getAllStoredQuests, getTodayKeyLocal } from '@/lib/storage';
import { combinedStats, getDaySnapshot } from '@/lib/day-snapshot';
import { getFieldNotes } from '@/lib/field-notes';
import { detectRecord } from '@/lib/overload';
import { getClearLine } from '@/lib/quest-content';
import { getStoredVerdict, nextDateKey } from '@/lib/theia-evening';
import { getVariable } from '@/lib/daily-variable';
import { requestSync } from '@/lib/sync-signal';

export const CLEAR_STREAK_KEY = 'wrp_clear_streak';

const STATS: (keyof Attributes)[] = ['STR', 'AGI', 'VIT', 'INT', 'PER', 'WIS'];

const totalXp = (level: number, xp: number) => {
  let total = 0;
  for (let l = 1; l < Math.max(1, level); l++) total += calculateXPForLevel(l);
  return total + Math.max(0, xp || 0);
};

const previousDay = (ymd: string) => {
  const d = new Date(Date.UTC(+ymd.slice(0, 4), +ymd.slice(5, 7) - 1, +ymd.slice(8, 10)));
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
};

/** Called when the clear reward is claimed. Returns the updated consecutive-clear count. */
export function recordClear(today: string): number {
  let count = 1;
  try {
    const prev = JSON.parse(localStorage.getItem(CLEAR_STREAK_KEY) || 'null');
    if (prev?.lastDate === today) return Number(prev.count) || 1;
    if (prev?.lastDate === previousDay(today)) count = (Number(prev.count) || 0) + 1;
    localStorage.setItem(CLEAR_STREAK_KEY, JSON.stringify({ lastDate: today, count }));
  } catch {
    // ignore
  }
  requestSync();
  return count;
}

export function getClearStreak(today: string): number {
  try {
    const prev = JSON.parse(localStorage.getItem(CLEAR_STREAK_KEY) || 'null');
    if (prev?.lastDate === today || prev?.lastDate === previousDay(today)) return Number(prev.count) || 0;
  } catch {
    // ignore
  }
  return 0;
}

export interface DailyReport {
  expGained: number;
  levelFrom: number;
  levelTo: number;
  statGains: { stat: keyof Attributes; gain: number }[];
  clearStreak: number;
  highlight: string;
  tomorrow: string;
  verdict: string;
  /** 'ai' once THEIA's evening review has run today; 'system' otherwise. */
  verdictSource: 'ai' | 'system';
  /** Tomorrow's Daily Variable, when already set by the evening review. */
  tomorrowVariable: { directive: string; text: string; bonusXp: number } | null;
}

/** The day's best moment, in priority order. */
function highlightFor(quests: Quest[], today: string): string {
  // A personal record logged today.
  // The workout log dates its sessions in UTC (DailyPhysicalLab: toISOString), so "today" there
  // is the UTC date, not the local one.
  const logDay = new Date().toISOString().slice(0, 10);
  try {
    const logs = JSON.parse(localStorage.getItem('whiteroom_physical_quest_logs') || '{}');
    for (const entry of Object.values(logs) as any[]) {
      if (!entry?.rows || entry.date !== logDay) continue;
      for (const row of entry.rows) {
        const weight = detectRecord(row, logDay);
        if (weight !== null) return `New record: ${row.exercise}, ${weight} kg.`;
      }
    }
  } catch {
    // ignore
  }
  const bonus = quests.filter((q) => q.origin === 'system' && q.isChainBonus && q.completed);
  if (bonus.length > 0) return `You went beyond the quest: ${bonus.length} bonus directive${bonus.length === 1 ? '' : 's'} cleared.`;
  const note = getFieldNotes().find((n) => n.date === today && n.kind === 'reading');
  if (note) return `Archive extract: "${note.lines[0]}"`;
  const longest = quests
    .filter((q) => q.origin === 'system' && q.completed)
    .sort((a, b) => (b.duration || 0) - (a.duration || 0))[0];
  return longest ? `${longest.title}: ${longest.duration} minutes held without breaking.` : 'Every directive answered.';
}

function tomorrowLine(today: string): string {
  const d = new Date(Date.UTC(+today.slice(0, 4), +today.slice(5, 7) - 1, +today.slice(8, 10), 12));
  d.setUTCDate(d.getUTCDate() + 1);
  const local = new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 12);
  const plan = getPhysicalDayPlan(local);
  return `Tomorrow: ${plan.title.replace(/^.*?—\s*/, '')}. Your directives arrive at midnight.`;
}

/**
 * The report for today. `clearXp` is the reward just paid (already in `profile`).
 * Without a snapshot (first day after this feature shipped) EXP falls back to today's directives.
 */
export function buildDailyReport(profile: UserProfile, clearXp: number, today = getTodayKeyLocal()): DailyReport {
  const quests = getAllStoredQuests();
  const snap = getDaySnapshot(today);
  const stored = getStoredVerdict(today);
  const tomorrowVar = getVariable(nextDateKey(today));
  let expGained: number;
  let levelFrom = Number(profile.level) || 1;
  const statGains: DailyReport['statGains'] = [];
  if (snap) {
    expGained = Math.max(0, totalXp(profile.level, profile.xp) - totalXp(snap.level, snap.xp));
    levelFrom = snap.level;
    const now = combinedStats(profile);
    for (const k of STATS) {
      const gain = Math.round((now[k] - (snap.stats?.[k] || 0)) * 10) / 10;
      if (gain > 0) statGains.push({ stat: k, gain });
    }
  } else {
    expGained =
      clearXp + quests.filter((q) => q.origin === 'system' && q.completed).reduce((s, q) => s + (Number(q.xp) || 0), 0);
  }
  return {
    expGained,
    levelFrom,
    levelTo: Number(profile.level) || 1,
    statGains,
    clearStreak: getClearStreak(today),
    highlight: highlightFor(quests, today),
    tomorrow: tomorrowLine(today),
    verdict: stored?.text || getClearLine(today),
    verdictSource: stored?.source || 'system',
    tomorrowVariable: tomorrowVar
      ? { directive: tomorrowVar.directive, text: tomorrowVar.text, bonusXp: tomorrowVar.bonusXp }
      : null,
  };
}
