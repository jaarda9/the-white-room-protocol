/**
 * Seals — a lightweight sibling to Gates for suppressing a named bad habit/weakness, not a
 * Gate subtype and not a Daily Quest. Distinct philosophy from both: there is no pass/fail.
 *
 * Modeled on the actual cue→craving→response→reward habit loop (Atomic Habits / Gollwitzer's
 * implementation-intention research) rather than a bare streak counter:
 *  - `cue`      — the specific trigger the player names at creation (time/place/emotion), the
 *                 single highest-leverage thing a vague "quit X" tracker skips.
 *  - `ifThenPlan` — an optional pre-committed "when [cue], I will [replacement]" plan, written
 *                 while calm rather than decided in the moment of craving.
 *  - `integrity` — 0-100, NOT a streak that zeroes on a slip. It rises slowly on clean days and
 *                 dips (never to 0) on a logged slip, mirroring the Gate Breach philosophy:
 *                 a slip is recorded honestly, never punished, never locks/stacks.
 *  - `rank`     — E through S, derived from integrity, mirroring Hunter Rank for a consistent
 *                 sense of real mastery over the weakness as it's suppressed.
 *  - `arisen`   — true once integrity has ever reached 100 (S-Rank fully held) — grants "The
 *                 Unshackled" title once, permanently, even if integrity later dips again.
 */
import { getUserProfile, saveUserProfile, getHunterVitals, addXP } from '@/lib/storage';
import { scheduleSyncAfterGeneratedContentSave } from '@/lib/sync-manager';
import { aiGatewayClient } from '@/lib/ai-gateway-client';
import { pushNotification } from '@/lib/notifications';
import { truncateCleanly } from '@/lib/text-utils';
import { assignPenaltyForSealSlip } from '@/lib/penalty-system';
import type { SealXpModifier } from '@/lib/types';

export const SEALS_KEY = 'wrp_seals';
export const SEALS_UPDATED_EVENT = 'wrp:seals-updated';

export type SealRank = 'E' | 'D' | 'C' | 'B' | 'A' | 'S';

/** Mirrors the day-count cadence of STREAK_MILESTONES (system-events.ts) for consistency —
 * kept as a separate local copy since that one isn't exported and Seals milestones are
 * evaluated against a per-Seal streak, not the player's overall daily-quest streak. */
const SEAL_DAY_MILESTONES = [3, 7, 14, 30, 60, 100, 200, 365];

const SEAL_RANK_THRESHOLDS: Array<{ rank: SealRank; min: number }> = [
  { rank: 'S', min: 95 },
  { rank: 'A', min: 80 },
  { rank: 'B', min: 60 },
  { rank: 'C', min: 40 },
  { rank: 'D', min: 20 },
  { rank: 'E', min: 0 },
];

const MAX_EVENTS_KEPT = 40;

export const rankForIntegrity = (integrity: number): SealRank =>
  SEAL_RANK_THRESHOLDS.find((t) => integrity >= t.min)!.rank;

const RANK_ORDER: SealRank[] = ['E', 'D', 'C', 'B', 'A', 'S'];
const isSealRank = (v: unknown): v is SealRank => typeof v === 'string' && RANK_ORDER.includes(v as SealRank);

/**
 * THEIA's Threat Rank — how entrenched the weakness itself is, assessed ONCE at creation and
 * fixed thereafter. This is a different axis from `Seal.rank` (which tracks CURRENT suppression
 * progress and rises toward S as Integrity climbs): Threat Rank instead tunes how hard that
 * climb is for THIS specific Seal, the same way a Gate's THEIA-assessed Rank scales its reward
 * without changing what "cleared" means. A deeply entrenched (S-Threat) habit starts with lower
 * Integrity, regenerates it slower, and costs more per slip than a minor (E-Threat) one — so two
 * Seals at the same displayed Rank don't feel identical if what they're actually holding back
 * isn't. Without this, Threat Rank would be flavor text with no mechanical weight.
 */
interface ThreatTuning {
  startingIntegrity: number;
  regenPerDay: number;
  slipPenalty: number;
  /** One-time Fatigue added the moment a slip is logged — mirrors Gate Breach's real (if
   * modest) cost, scaled down since a Seal slip is a far more frequent, smaller event than a
   * months-long Gate failing. */
  slipFatigue: number;
  /** One-time HP lost on slip — 0 for the lowest Threat Ranks, since a minor quirk slipping
   * shouldn't cost health, only a truly entrenched habit should. */
  slipHpLoss: number;
  /** Strength of the temporary XP debuff applied on slip (e.g. 0.88 = -12%) — fades back to
   * 1.0 (no effect) over slipDebuffHours, see seal-xp-modifier.ts. */
  slipDebuffMultiplier: number;
  slipDebuffHours: number;
}

const THREAT_TUNING: Record<SealRank, ThreatTuning> = {
  E: { startingIntegrity: 25, regenPerDay: 4, slipPenalty: 10, slipFatigue: 3, slipHpLoss: 0, slipDebuffMultiplier: 0.95, slipDebuffHours: 12 },
  D: { startingIntegrity: 20, regenPerDay: 3.5, slipPenalty: 12, slipFatigue: 5, slipHpLoss: 0, slipDebuffMultiplier: 0.92, slipDebuffHours: 18 },
  C: { startingIntegrity: 15, regenPerDay: 3, slipPenalty: 15, slipFatigue: 7, slipHpLoss: 2, slipDebuffMultiplier: 0.88, slipDebuffHours: 24 },
  B: { startingIntegrity: 12, regenPerDay: 2.5, slipPenalty: 18, slipFatigue: 9, slipHpLoss: 4, slipDebuffMultiplier: 0.84, slipDebuffHours: 30 },
  A: { startingIntegrity: 10, regenPerDay: 2, slipPenalty: 20, slipFatigue: 11, slipHpLoss: 6, slipDebuffMultiplier: 0.80, slipDebuffHours: 36 },
  S: { startingIntegrity: 8, regenPerDay: 1.5, slipPenalty: 25, slipFatigue: 14, slipHpLoss: 8, slipDebuffMultiplier: 0.75, slipDebuffHours: 48 },
};
const INTEGRITY_MIN_FLOOR = 5;
/** Seals created before Threat Rank existed get this — a fair mid-point, not the most lenient. */
const DEFAULT_THREAT_RANK: SealRank = 'C';

/** Rank-Up/Arisen rewards — flat XP plus a temporary fading buff, alongside the existing WIS
 * point, so holding a Seal pays off in more than one currency instead of just a number that
 * only shows up on this one page. */
const RANK_UP_XP = 15;
const RANK_UP_BUFF_MULTIPLIER = 1.10;
const RANK_UP_BUFF_HOURS = 24;
const ARISEN_XP = 50;
const ARISEN_BUFF_MULTIPLIER = 1.20;
const ARISEN_BUFF_HOURS = 48;

const applySealXpModifier = (multiplier: number, hours: number): void => {
  const profile = getUserProfile();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + hours * 3_600_000);
  const modifier: SealXpModifier = { multiplier, startedAt: now.toISOString(), expiresAt: expiresAt.toISOString() };
  saveUserProfile({ ...profile, sealXpModifier: modifier });
};

/** What logging a slip will actually cost for a Seal at this Threat Rank — exposed so the UI
 * can tell the player honestly, in the confirmation prompt, before they commit to it. */
export const getSlipConsequencePreview = (threatRank: SealRank) => {
  const t = THREAT_TUNING[threatRank];
  return {
    fatigue: t.slipFatigue,
    hpLoss: t.slipHpLoss,
    debuffPct: Math.round((1 - t.slipDebuffMultiplier) * 100),
    debuffHours: t.slipDebuffHours,
  };
};

/** Removing the cue is a legitimate, well-supported lever on its own — capped so stacking many
 * trivial wards can't dwarf the actual work of holding clean days. */
const WARD_BONUS_PER_ACTIVE_DAY = 0.3;
const MAX_WARDS_COUNTED = 3;

const URGE_TIMER_MINUTES = 10;
/** A weathered urge is real progress, not a clean day — small compared to a day of regen. */
const URGE_HELD_INTEGRITY_BONUS = 2;

export interface SealEvent {
  id: string;
  type: 'created' | 'slip' | 'milestone' | 'rankUp' | 'arisen' | 'urgeHeld';
  at: string;
  message: string;
}

/** A named environment/friction change the player has put in place against this Seal's cue —
 * removing the cue itself is one of the most effective habit-change levers there is, so an
 * active Ward earns a small Integrity regen bonus, not just a checklist for its own sake. */
export interface SealWard {
  id: string;
  label: string;
  active: boolean;
}

export interface Seal {
  id: string;
  /** The named weakness/bad habit, e.g. "Doomscrolling after midnight". */
  name: string;
  /** The specific trigger — time, place, or emotional state — that precedes it. */
  cue: string;
  /** Optional pre-committed "when [cue], I will [replacement]" plan. */
  ifThenPlan?: string;
  /** THEIA's one-time assessment of how entrenched this weakness is — see THREAT_TUNING. */
  threatRank: SealRank;
  createdAt: string;
  integrity: number;
  rank: SealRank;
  streakStartedAt: string;
  longestStreakDays: number;
  totalSlips: number;
  lastSlipAt?: string;
  lastCheckedAt: string;
  /** True forever once integrity has ever reached 100 — grants "The Unshackled" title once. */
  arisen: boolean;
  events: SealEvent[];
  wards: SealWard[];
  /** Set while an urge-surfing timer (the 10-minute rule) is running — an ISO timestamp, not a
   * client-side countdown, so it survives a reload or the app being closed mid-urge. */
  activeUrgeStartedAt?: string;
  /** id of the last event this Seal's card has shown the player a toast for — lives on the
   * synced Seal itself (not a separate local-only "seen" key) specifically so a Rank-Up/Arisen
   * celebration can't replay on a new device or a reinstalled PWA the way a local-only marker
   * did earlier this session for the Hunter Rank ceremony. */
  lastAcknowledgedEventId?: string;
}

const daysBetween = (fromIso: string, toMs: number): number =>
  Math.max(0, Math.floor((toMs - new Date(fromIso).getTime()) / 86_400_000));

const pushEvent = (seal: Seal, type: SealEvent['type'], message: string): void => {
  seal.events = [...seal.events, { id: crypto.randomUUID(), type, at: new Date().toISOString(), message }].slice(
    -MAX_EVENTS_KEPT
  );
};

/** Idempotent — safe to call every time a Seal Arises, only ever adds the title once. */
const grantUnshackledTitleIfNeeded = (): void => {
  const profile = getUserProfile();
  if ((profile.unlockedTitles || []).includes('The Unshackled')) return;
  saveUserProfile({
    ...profile,
    unlockedTitles: [...(profile.unlockedTitles || []), 'The Unshackled'],
  });
};

/** Small hidden WIS reward on rank-up (bigger on Arisen) — WIS is this app's existing
 * discipline/habit-building attribute (see ATTRIBUTE_KEYWORDS in gates.ts), so mastering a
 * Seal training it is thematically exact, not arbitrary. Mirrors how a Gate Wave's completion
 * grants a hidden attribute point rather than the reward being purely cosmetic. */
const grantWisdomPoint = (amount: number): void => {
  const profile = getUserProfile();
  saveUserProfile({
    ...profile,
    visibleStats: { ...profile.visibleStats, WIS: (profile.visibleStats?.WIS || 10) + amount },
  });
};

/** Flat, immediate XP on top of the WIS point — so holding a Seal pays out in more than one
 * currency, not just a number on this one page. */
const grantXpReward = (amount: number): void => {
  const profile = getUserProfile();
  saveUserProfile(addXP(profile, amount, 'general'));
};

/** One-time Fatigue/HP cost the moment a slip is logged — the same real-but-modest-consequence
 * pattern as checkAndApplyGateBreaches() in gates.ts, scaled down since a Seal slip is a far
 * more frequent, smaller event than a months-long Gate failing. Floors mirror that function's
 * own floors so a slip (or several) can never be lethal on its own. */
const applySlipVitalsCost = (tuning: ThreatTuning): void => {
  const profile = getUserProfile();
  const vitals = getHunterVitals(profile);
  const fatigue = Math.min(100, (profile.fatigue ?? 0) + tuning.slipFatigue);
  const hpFloor = Math.max(15, Math.floor(vitals.hp.max * 0.15));
  const hp = Math.max(hpFloor, vitals.hp.current - tuning.slipHpLoss);
  saveUserProfile({ ...profile, fatigue, hp: { current: hp, max: vitals.hp.max } });
};

/** Applies clean-day Integrity regen and milestone/rank-up detection for every whole day
 * elapsed since `lastCheckedAt`. Mutates the Seal in place; returns whether anything changed
 * (so the caller only persists when needed). Mirrors getGates()'s lazy self-heal-on-read. */
const tickSeal = (seal: Seal, nowMs: number): boolean => {
  const daysSinceChecked = daysBetween(seal.lastCheckedAt, nowMs);
  if (daysSinceChecked <= 0) return false;

  const tuning = THREAT_TUNING[seal.threatRank];
  const activeWardCount = Math.min(MAX_WARDS_COUNTED, (seal.wards || []).filter((w) => w.active).length);
  const wardBonus = activeWardCount * WARD_BONUS_PER_ACTIVE_DAY;
  const prevRank = seal.rank;
  seal.integrity = Math.min(100, seal.integrity + daysSinceChecked * (tuning.regenPerDay + wardBonus));
  seal.rank = rankForIntegrity(seal.integrity);
  seal.lastCheckedAt = new Date(nowMs).toISOString();

  const daysClean = daysBetween(seal.streakStartedAt, nowMs);
  seal.longestStreakDays = Math.max(seal.longestStreakDays, daysClean);

  // .filter (not .find) — a long gap between opens can cross several milestones in one tick,
  // and each deserves its own logged line rather than only the first being recorded.
  const crossedMilestones = SEAL_DAY_MILESTONES.filter(
    (m) => daysClean >= m && daysClean - daysSinceChecked < m
  );
  crossedMilestones.forEach((m) => {
    pushEvent(seal, 'milestone', `[SYSTEM]: ${m} days held. The Seal grows steadier.`);
  });

  if (seal.rank !== prevRank && RANK_ORDER.indexOf(seal.rank) > RANK_ORDER.indexOf(prevRank)) {
    const msg = `[SYSTEM]: Seal reinforced — Restraint Rank ${prevRank} → ${seal.rank}. +${RANK_UP_XP} XP, +1 WIS, and a ${Math.round((RANK_UP_BUFF_MULTIPLIER - 1) * 100)}% EXP surge for ${RANK_UP_BUFF_HOURS}h.`;
    pushEvent(seal, 'rankUp', msg);
    grantWisdomPoint(1);
    grantXpReward(RANK_UP_XP);
    applySealXpModifier(RANK_UP_BUFF_MULTIPLIER, RANK_UP_BUFF_HOURS);
    // Pushed here (not left to SealsPanel's own toast) specifically so this surfaces even if
    // the player is nowhere near the Seals tab when it happens, not just when they open it.
    pushNotification({
      key: `seal-rankup-${seal.id}-${seal.rank}`,
      severity: 'milestone',
      title: `[ SEAL RANK UP: ${seal.name.toUpperCase()} ]`,
      description: msg,
    });
  }

  if (seal.integrity >= 100 && !seal.arisen) {
    seal.arisen = true;
    const msg = `[SYSTEM]: The weakness no longer commands you. It has Arisen as yours to command. +${ARISEN_XP} XP, +3 WIS, and a ${Math.round((ARISEN_BUFF_MULTIPLIER - 1) * 100)}% EXP surge for ${ARISEN_BUFF_HOURS}h.`;
    pushEvent(seal, 'arisen', msg);
    grantUnshackledTitleIfNeeded();
    grantWisdomPoint(3);
    grantXpReward(ARISEN_XP);
    applySealXpModifier(ARISEN_BUFF_MULTIPLIER, ARISEN_BUFF_HOURS);
    pushNotification({
      key: `seal-arisen-${seal.id}`,
      severity: 'milestone',
      title: `[ SEAL ARISEN: ${seal.name.toUpperCase()} ]`,
      description: msg,
    });
  }

  return true;
};

export const getSeals = (): Seal[] => {
  try {
    const raw = localStorage.getItem(SEALS_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed)) return [];

    const now = Date.now();
    let changed = false;
    const ticked = (parsed as Seal[]).map((seal) => {
      // threatRank migration: Seals forged before THEIA assessment existed default to a fair
      // mid-point rather than the most lenient tuning.
      const copy: Seal = {
        ...seal,
        events: seal.events || [],
        wards: seal.wards || [],
        threatRank: isSealRank(seal.threatRank) ? seal.threatRank : DEFAULT_THREAT_RANK,
      };
      if (tickSeal(copy, now)) changed = true;
      return copy;
    });

    if (changed) {
      try {
        localStorage.setItem(SEALS_KEY, JSON.stringify(ticked));
      } catch {
        // ignore — in-memory copy below is still correct for this session
      }
    }

    return ticked;
  } catch {
    return [];
  }
};

export const saveSeals = (seals: Seal[]): void => {
  try {
    localStorage.setItem(SEALS_KEY, JSON.stringify(seals));
    scheduleSyncAfterGeneratedContentSave();
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent(SEALS_UPDATED_EVENT));
    }
  } catch {
    // ignore
  }
};

export const createSeal = (name: string, cue: string, threatRank: SealRank, ifThenPlan?: string): Seal => {
  const now = new Date().toISOString();
  const startingIntegrity = THREAT_TUNING[threatRank].startingIntegrity;
  const seal: Seal = {
    id: crypto.randomUUID(),
    name: name.trim(),
    cue: cue.trim(),
    ifThenPlan: ifThenPlan?.trim() || undefined,
    threatRank,
    createdAt: now,
    integrity: startingIntegrity,
    rank: rankForIntegrity(startingIntegrity),
    streakStartedAt: now,
    longestStreakDays: 0,
    totalSlips: 0,
    lastCheckedAt: now,
    arisen: false,
    events: [],
    wards: [],
  };
  pushEvent(
    seal,
    'created',
    `[SYSTEM]: Seal forged against "${seal.name}". THEIA reads it as Threat Rank ${threatRank} — Restraint Rank ${seal.rank}, hold the line.`
  );

  const seals = getSeals();
  saveSeals([...seals, seal]);
  return seal;
};

/** Honest self-report, never punishing: dents Integrity (floored, never destroyed) and resets
 * the current clean streak, but the Seal itself is never locked, deleted, or reset to E-Rank
 * from scratch — same non-punishing philosophy as a Gate Breach. */
export const logSlip = (sealId: string): Seal | null => {
  const seals = getSeals();
  let updated: Seal | null = null;
  let tuning: ThreatTuning | null = null;

  const next = seals.map((seal) => {
    if (seal.id !== sealId) return seal;
    const copy: Seal = { ...seal };
    tuning = THREAT_TUNING[copy.threatRank];
    copy.integrity = Math.max(INTEGRITY_MIN_FLOOR, copy.integrity - tuning.slipPenalty);
    copy.rank = rankForIntegrity(copy.integrity);
    copy.totalSlips += 1;
    copy.lastSlipAt = new Date().toISOString();
    copy.streakStartedAt = new Date().toISOString();
    const debuffPct = Math.round((1 - tuning.slipDebuffMultiplier) * 100);
    pushEvent(
      copy,
      'slip',
      `[SYSTEM]: The Seal trembled but held. Integrity down to ${copy.integrity}%. A ${debuffPct}% EXP debuff fades over ${tuning.slipDebuffHours}h. Begin again.`
    );
    updated = copy;
    return copy;
  });

  if (updated && tuning) {
    saveSeals(next);
    // Real but modest consequences outside the Seal's own Integrity number — same spirit as
    // Gate Breach's Fatigue/HP cost, plus a fading XP debuff so a slip is actually felt
    // elsewhere in the game, not just on this one page.
    applySlipVitalsCost(tuning);
    applySealXpModifier(tuning.slipDebuffMultiplier, tuning.slipDebuffHours);
    // Fire-and-forget: an actual assigned Penalty Quest on top of the above, reusing the exact
    // same System-assigned-consequence mechanism a missed Daily Quest uses (same blocking HUD,
    // same generation pattern), scaled by this Seal's own Threat Rank. Not awaited — logging a
    // slip should feel immediate, the quest just appears once THEIA (or the fallback) finishes.
    assignPenaltyForSealSlip(updated.name, updated.threatRank)
      .then((quest) => {
        // Same key convention Dashboard.tsx uses for a Daily-Quest-triggered assignment
        // (penalty-quest-<id>) — no collision risk since each quest gets its own fresh id, and
        // this is the actual persisted Notices-tab entry the Daily Quest flow already gets.
        // Toast/sound are deliberately NOT triggered here — this is a lib module, and every
        // other toast/sound in the app fires from the UI layer that's actually on screen (see
        // SealsPanel.tsx's PENALTY_UPDATED_EVENT listener for the reactive side of this).
        pushNotification({
          key: `penalty-quest-${quest.id}`,
          severity: 'critical',
          title: quest.title,
          description: quest.flavorText,
          route: '/?view=quests',
        });
      })
      .catch((error) => {
        console.warn('Seal-slip Penalty Quest assignment failed silently:', error);
      });
  }
  return updated;
};

export const deleteSeal = (sealId: string): void => {
  saveSeals(getSeals().filter((s) => s.id !== sealId));
};

export const updateSealPlan = (sealId: string, ifThenPlan: string): void => {
  const next = getSeals().map((s) => (s.id === sealId ? { ...s, ifThenPlan: ifThenPlan.trim() || undefined } : s));
  saveSeals(next);
};

export const addWard = (sealId: string, label: string): void => {
  const trimmed = label.trim();
  if (!trimmed) return;
  const next = getSeals().map((s) =>
    s.id === sealId ? { ...s, wards: [...s.wards, { id: crypto.randomUUID(), label: trimmed, active: true }] } : s
  );
  saveSeals(next);
};

export const toggleWard = (sealId: string, wardId: string): void => {
  const next = getSeals().map((s) =>
    s.id === sealId
      ? { ...s, wards: s.wards.map((w) => (w.id === wardId ? { ...w, active: !w.active } : w)) }
      : s
  );
  saveSeals(next);
};

export const removeWard = (sealId: string, wardId: string): void => {
  const next = getSeals().map((s) =>
    s.id === sealId ? { ...s, wards: s.wards.filter((w) => w.id !== wardId) } : s
  );
  saveSeals(next);
};

/** Starts the 10-minute-rule urge-surfing timer. An ISO timestamp, not client-side countdown
 * state, so it survives a reload or the app closing mid-urge — the UI just computes remaining
 * time from `activeUrgeStartedAt` on render. */
export const startUrgeTimer = (sealId: string): void => {
  const next = getSeals().map((s) => (s.id === sealId ? { ...s, activeUrgeStartedAt: new Date().toISOString() } : s));
  saveSeals(next);
};

/** Dismisses a running timer with no consequence either way — e.g. a false start, or the
 * player just wants to close the card without logging an outcome yet. */
export const cancelUrgeTimer = (sealId: string): void => {
  const next = getSeals().map((s) => (s.id === sealId ? { ...s, activeUrgeStartedAt: undefined } : s));
  saveSeals(next);
};

/** Resolves a running urge timer. 'held' is real, if modest, progress — a small Integrity
 * bump, distinct from a full clean day's regen. 'slipped' hands off to logSlip() so the
 * consequence (and its honest, non-punishing framing) stays defined in exactly one place. */
export const resolveUrgeTimer = (sealId: string, outcome: 'held' | 'slipped'): Seal | null => {
  if (outcome === 'slipped') {
    const next = getSeals().map((s) => (s.id === sealId ? { ...s, activeUrgeStartedAt: undefined } : s));
    saveSeals(next);
    return logSlip(sealId);
  }

  const seals = getSeals();
  let updated: Seal | null = null;
  const next = seals.map((seal) => {
    if (seal.id !== sealId) return seal;
    const copy: Seal = { ...seal, activeUrgeStartedAt: undefined };
    copy.integrity = Math.min(100, copy.integrity + URGE_HELD_INTEGRITY_BONUS);
    copy.rank = rankForIntegrity(copy.integrity);
    pushEvent(copy, 'urgeHeld', `[SYSTEM]: The urge passed. You did not act on it. Integrity +${URGE_HELD_INTEGRITY_BONUS}%.`);
    updated = copy;
    return copy;
  });

  if (updated) saveSeals(next);
  return updated;
};

export const getUrgeTimerMinutes = (): number => URGE_TIMER_MINUTES;

/** Marks every current event as seen so the UI's Rank-Up/Arisen toast never replays it — lives
 * on the synced Seal itself, see Seal.lastAcknowledgedEventId. */
export const acknowledgeSealEvents = (sealId: string): void => {
  const seals = getSeals();
  const seal = seals.find((s) => s.id === sealId);
  const lastEvent = seal?.events[seal.events.length - 1];
  if (!lastEvent || seal!.lastAcknowledgedEventId === lastEvent.id) return;
  const next = seals.map((s) => (s.id === sealId ? { ...s, lastAcknowledgedEventId: lastEvent.id } : s));
  saveSeals(next);
};

/**
 * THEIA assessment — same duality pattern as assessGate() (nutrition-lab.ts / codex.ts): an AI
 * path plus a 0-token fallback, neither ever leaving a Seal unassessed. This is what stops a
 * Seal from being a re-skinned streak counter: THEIA reads the actual weakness and cue instead
 * of accepting whatever's typed, pushes back on a cue too vague to ever be actionable ("when
 * stressed" — stressed by what, where, doing what?), and always hands back a real implementation-
 * intention plan crafted from the specific trigger, not a generic template.
 */
export interface SealAssessmentInput {
  name: string;
  cue: string;
  ifThenPlan?: string;
}

export interface SealAssessment {
  /** How entrenched the weakness itself is — see THREAT_TUNING. Independent of Seal.rank. */
  threatRank: SealRank;
  rationale: string;
  cueSpecificEnough: boolean;
  cueFeedback?: string;
  /** THEIA's own crafted if-then plan — always offered, even when the player already wrote
   * one, same as a Gate assessment always offering a refined Boss Condition. */
  suggestedPlan: string;
  origin: 'ai' | 'system';
}

const buildFallbackSealAssessment = (input: SealAssessmentInput): SealAssessment => {
  const cueWordCount = input.cue.trim().split(/\s+/).filter(Boolean).length;
  const cueSpecificEnough = cueWordCount >= 3;
  return {
    threatRank: DEFAULT_THREAT_RANK,
    rationale: 'Precision estimate — Threat Rank held at a fair mid-point without a full System read.',
    cueSpecificEnough,
    cueFeedback: cueSpecificEnough
      ? undefined
      : 'Too vague to act on in the moment — name the exact time, place, or feeling that precedes it.',
    suggestedPlan: `When ${input.cue || 'the urge strikes'}, I will pause for 10 minutes and do something incompatible with "${input.name}" before deciding anything.`,
    origin: 'system',
  };
};

interface RawSealAssessment {
  threatRank?: string;
  rationale?: string;
  cueSpecificEnough?: boolean;
  cueFeedback?: string;
  suggestedPlan?: string;
}

const buildSealAssessmentPrompt = (input: SealAssessmentInput): string => `
Role: Solo Leveling System Analyst THEIA, assessing a Hunter's self-declared Seal — a suppression
ward against a real-life bad habit/weakness, not a dungeon or a Gate.
Weakness: "${input.name}"
Named trigger (cue): "${input.cue}"
Hunter's own if-then plan (may be blank): "${input.ifThenPlan || '(none written)'}"

Assess three things:
1. Threat Rank (E, D, C, B, A, or S) based on how entrenched/dangerous this weakness actually
   sounds — E is a minor quirk, S is a deeply entrenched, life-limiting pattern. This tunes how
   hard the Seal is to fully hold (slower recovery, costlier slips at higher Threat Rank), so
   judge honestly, not leniently.
2. Whether the named cue is specific enough to act on in the moment (a real time, place, or
   emotional trigger — NOT vague like "when stressed" with no context) — if not, one to two
   sentences saying exactly what specificity is missing, with a concrete example.
3. Craft ONE concrete if-then implementation-intention plan ("When [cue], I will [replacement
   action]") using real behavior-change technique (a delay tactic, a replacement action
   incompatible with the habit, or an environment change) tailored to THIS specific weakness and
   cue — always produce this even if the Hunter already wrote a plan; theirs may still be kept.
   Be concrete and actionable (specific enough to actually follow in the moment), but do not pad
   with filler — every word should earn its place, not stretch the answer longer than it needs
   to be.

Return ONLY valid JSON (no markdown):
{"threatRank":"C","rationale":"one clinical sentence in the System's voice","cueSpecificEnough":true,"cueFeedback":"","suggestedPlan":"When ..., I will ..."}
`.trim();

export const assessSeal = async (
  input: SealAssessmentInput,
  options?: { forceAlgorithmic?: boolean }
): Promise<SealAssessment> => {
  if (options?.forceAlgorithmic) {
    return buildFallbackSealAssessment(input);
  }

  try {
    const prompt = buildSealAssessmentPrompt(input);
    const res = await aiGatewayClient.completeJson<RawSealAssessment>(prompt, {
      temperature: 0.4,
      maxTokens: 600,
      thinkingBudget: 0,
      providerOverride: 'lab',
      // Player watches this via SealsPanel's assessment spinner — fail fast to the 0-token
      // fallback instead of the default 429 backoff (65s+ per retry).
      maxRetries: 1,
    });

    if (!res || !isSealRank(res.threatRank) || !res.rationale || !res.suggestedPlan) {
      throw new Error('Seal assessment response missing required fields');
    }

    return {
      threatRank: res.threatRank,
      rationale: truncateCleanly(String(res.rationale), 500),
      cueSpecificEnough: Boolean(res.cueSpecificEnough),
      cueFeedback: res.cueFeedback ? truncateCleanly(String(res.cueFeedback), 700) : undefined,
      suggestedPlan: truncateCleanly(String(res.suggestedPlan), 900),
      origin: 'ai',
    };
  } catch (error) {
    console.warn('Seal assessment AI fallback to precision estimate:', error);
    return buildFallbackSealAssessment(input);
  }
};
