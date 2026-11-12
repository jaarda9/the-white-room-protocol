/**
 * Rank-scaled Daily Quest: the mandatory load grows with the Hunter's rank.
 *
 *   E (1-9)   Workout · Instant Dungeon I · Archive Access · Mana Stabilization
 *   D (10-19) + Field Mastery
 *   C (20-29) + Combat Log Review · Intel Briefing (today's course lesson + check)
 *   B (30-39) + Ally Registry
 *   A (40-49) + Instant Dungeon II
 *   S (50+)   + Instant Dungeon III            (Instant Dungeon IV always stays a bonus floor)
 *
 * Directives above the Hunter's rank are not removed: they stay as optional bonus directives
 * (EXP and hidden stats, no penalty). Optional is expressed with the existing `isChainBonus`
 * flag, which every penalty rule already excludes — client (storage.ts), failure memory
 * (quest-content.ts) and the push server (api/push.ts) — so all three stay in agreement without
 * a second flag to keep in sync. `rankOptional` only labels them.
 *
 * The rank is fixed per calendar day (the first load of the day records it), so a level-up in
 * the middle of a day never adds a mandatory directive that same day.
 */
import type { Quest } from '@/lib/types';
import { getDirectiveKey, type DirectiveKey } from '@/lib/quest-content';
import { requestSync } from '@/lib/sync-signal';

export type HunterRank = 'E' | 'D' | 'C' | 'B' | 'A' | 'S';
export const RANK_ORDER: HunterRank[] = ['E', 'D', 'C', 'B', 'A', 'S'];

export const rankForLevel = (level: number): HunterRank =>
  RANK_ORDER[Math.min(5, Math.max(0, Math.floor((Math.max(1, Number(level) || 1) - 1) / 10)))];

const rankIndex = (r: HunterRank) => RANK_ORDER.indexOf(r);

/** First rank at which each directive is mandatory (null = never: always a bonus). */
const MANDATORY_FROM: Record<DirectiveKey, HunterRank | null> = {
  physical: 'E',
  work1: 'E',
  reading: 'E',
  meditation: 'E',
  study: 'D',
  reflection: 'C',
  intel: 'C',
  // Retired by the Intel Briefing (Phase D): a leftover from an older quest list is a bonus.
  geography: null,
  history: null,
  gratitude: 'B',
  work2: 'A',
  work3: 'S',
  work4: null, // always a bonus floor
};

/** True when this directive is mandatory for `rank` on `dateKey`. */
export function isMandatoryAtRank(key: DirectiveKey, rank: HunterRank, dateKey: string): boolean {
  const from = MANDATORY_FROM[key];
  return Boolean(from) && rankIndex(rank) >= rankIndex(from as HunterRank);
}

/** The rank at which an optional directive becomes mandatory (for its label). */
export function mandatoryFrom(key: DirectiveKey, rank: HunterRank): HunterRank | null {
  return MANDATORY_FROM[key] || null;
}

/**
 * Marks each system directive mandatory or optional for today's rank. Idempotent. Work
 * Sessions keep their chain unlock (filterVisibleQuests); only their bonus status changes.
 */
export function applyRankLoad(quests: Quest[], rank: HunterRank, dateKey: string): Quest[] {
  return quests.map((q) => {
    if (q.origin !== 'system') return q;
    const key = getDirectiveKey(q);
    if (!key) return q;
    const mandatory = isMandatoryAtRank(key, rank, dateKey);
    const isWorkFloor = key === 'work2' || key === 'work3' || key === 'work4';
    const next: Quest = { ...q, isChainBonus: mandatory ? undefined : true };
    // Bonus Instant Dungeon floors are the classic "extra session"; every other optional
    // directive is optional because of rank, and says when it becomes required.
    const from = !mandatory && !isWorkFloor ? mandatoryFrom(key, rank) : null;
    if (from) next.rankOptional = from as Quest['rankOptional'];
    else delete next.rankOptional;
    if (!next.isChainBonus) delete next.isChainBonus;
    return next;
  });
}

// ---------------------------------------------------------------------------
// The rank of the day
// ---------------------------------------------------------------------------

export const QUEST_RANK_KEY = 'wrp_quest_rank_load';

interface DayRankRecord {
  date: string;
  rank: HunterRank;
}

const readDayRank = (): DayRankRecord | null => {
  try {
    const parsed = JSON.parse(localStorage.getItem(QUEST_RANK_KEY) || 'null');
    return parsed && typeof parsed.date === 'string' && RANK_ORDER.includes(parsed.rank) ? parsed : null;
  } catch {
    return null;
  }
};

/**
 * Today's quest rank: recorded on the first load of the day from the current level, then fixed.
 * Returns `advancedFrom` when today's rank is higher than the last recorded day's (rank-up).
 */
export function resolveDayRank(level: number, dateKey: string): { rank: HunterRank; advancedFrom?: HunterRank } {
  const stored = readDayRank();
  if (stored?.date === dateKey) return { rank: stored.rank };
  const rank = rankForLevel(level);
  try {
    localStorage.setItem(QUEST_RANK_KEY, JSON.stringify({ date: dateKey, rank }));
  } catch {
    // ignore
  }
  requestSync();
  const advancedFrom = stored && rankIndex(rank) > rankIndex(stored.rank) ? stored.rank : undefined;
  return { rank, advancedFrom };
}

/** Today's recorded rank without recording anything (UI reads). */
export function peekDayRank(level: number, dateKey: string): HunterRank {
  const stored = readDayRank();
  return stored?.date === dateKey ? stored.rank : rankForLevel(level);
}

export const DIRECTIVE_NAMES: Record<DirectiveKey, string> = {
  physical: 'Physical Training',
  work1: 'Instant Dungeon I',
  work2: 'Instant Dungeon II',
  work3: 'Instant Dungeon III',
  work4: 'Instant Dungeon IV',
  reading: 'Archive Access',
  study: 'Field Mastery',
  geography: 'Cartography Briefing',
  history: 'Chronicle Study',
  meditation: 'Mana Stabilization',
  reflection: 'Combat Log Review',
  gratitude: 'Ally Registry',
  intel: 'Intel Briefing',
};

/** Directive names newly made mandatory between two ranks (for the rank-advancement notice). */
export function newlyMandatory(from: HunterRank, to: HunterRank): DirectiveKey[] {
  return (Object.keys(MANDATORY_FROM) as DirectiveKey[]).filter((k) => {
    const r = MANDATORY_FROM[k];
    return r !== null && rankIndex(r) > rankIndex(from) && rankIndex(r) <= rankIndex(to);
  });
}

// ---------------------------------------------------------------------------
// Daily clear reward
// ---------------------------------------------------------------------------

/** A heavier mandatory load pays more. +3 AP and Full Recovery stay the same at every rank. */
export const DAILY_CLEAR_XP: Record<HunterRank, number> = { E: 150, D: 200, C: 250, B: 300, A: 350, S: 400 };

export const DAILY_CLEAR_KEY = 'wrp_daily_clear_claimed';

/** True if today's clear reward was already claimed (synced, so it holds across devices). */
export function isDailyClearClaimed(dateKey: string): boolean {
  try {
    return localStorage.getItem(DAILY_CLEAR_KEY) === dateKey;
  } catch {
    return false;
  }
}

export function markDailyClearClaimed(dateKey: string): void {
  try {
    localStorage.setItem(DAILY_CLEAR_KEY, dateKey);
  } catch {
    // ignore
  }
  requestSync();
}
