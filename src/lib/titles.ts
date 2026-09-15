/**
 * Hunter Titles — definitions, unlock conditions, and equipped effects.
 *
 * Kept as a leaf module (no imports from storage.ts / gates.ts / achievements.ts) so those
 * files can all import FROM here (for effect multipliers) without any circular dependency.
 * Unlock conditions take pre-computed primitives via TitleUnlockContext rather than fetching
 * data themselves, for the same reason — the caller (Profile.tsx) already has to read gates/
 * achievements/vitals anyway to build the context.
 */
import type { HunterRank } from '@/lib/types';

export interface TitleEffect {
  /** Multiplies HP regen in applyVitalsRegeneration (both the trickle and the sleep curve). */
  hpRegenMultiplier?: number;
  /** Multiplies STM regen the same way. */
  stmRegenMultiplier?: number;
  /** Multiplies MP regen the same way. */
  mpRegenMultiplier?: number;
  /** Multiplies XP from addXP(). For Peak Vitality this only applies while HP is actually
   * ≥90% at the moment — checked separately in addXP, not baked into this flat multiplier. */
  xpMultiplier?: number;
  /** Multiplies the EXTRA fatigue penalty specifically from pushing an action through
   * Overdrive (not the normal fatigue gain) — <1 softens the crash. */
  overdriveFatigueMultiplier?: number;
  /** Multiplies the XP payout from clearing a Gate Wave (grantWaveReward in gates.ts). */
  gateWaveXpMultiplier?: number;
  /** Extra flat attribute points added on top of the normal Blessing when a Gate clears. */
  gateClearBonusAttributePoint?: number;
}

export interface TitleUnlockContext {
  /** Index into RANK_ORDER (E=0 .. S=5) of the player's current Hunter Rank. */
  hunterRankIndex: number;
  /** Current HP as a percentage of max (0-100). */
  hpPct: number;
  /** Total recorded Overdrive Protocol activations (achievements.ts stats). */
  overdriveCompletions: number;
  /** Total Gates the player has cleared. */
  clearedGatesCount: number;
}

export interface TitleDefinition {
  name: string;
  rank: HunterRank;
  desc: string;
  /** Plain-language summary of the mechanical effect, shown next to the description. */
  effectDescription: string;
  /** Compact one-line version for tight UI (the Status window's active-effect banner). */
  shortEffect: string;
  requirement: string;
  isUnlocked: (ctx: TitleUnlockContext) => boolean;
}

const RANK_INDEX: Record<HunterRank, number> = { E: 0, D: 1, C: 2, B: 3, A: 4, S: 5 };
const meetsRank = (ctx: TitleUnlockContext, r: HunterRank) => ctx.hunterRankIndex >= RANK_INDEX[r];

export const TITLE_DEFINITIONS: TitleDefinition[] = [
  {
    name: 'The Awakened',
    rank: 'E',
    desc: 'One who stepped into the hunter world.',
    effectDescription: 'No mechanical effect — the entry marker every Hunter starts with.',
    shortEffect: 'No effect',
    requirement: 'Reach Rank E.',
    isUnlocked: (ctx) => meetsRank(ctx, 'E'),
  },
  {
    name: 'Wolf Slayer',
    rank: 'D',
    desc: 'Conqueror of the Lycan dungeon packs.',
    effectDescription: '+15% Stamina regeneration while equipped.',
    shortEffect: '+15% STM Regen',
    requirement: 'Reach Rank D.',
    isUnlocked: (ctx) => meetsRank(ctx, 'D'),
  },
  {
    name: 'Peak Vitality',
    rank: 'C',
    desc: 'Maintains 90%+ health (+10% EXP Gain).',
    effectDescription: '+20% HP / +10% STM regeneration while equipped, and +10% EXP whenever HP is actually at 90%+.',
    shortEffect: '+10% EXP Gain Active',
    requirement: 'Reach Rank C and hold 90%+ HP.',
    isUnlocked: (ctx) => meetsRank(ctx, 'C') && ctx.hpPct >= 90,
  },
  {
    name: 'Dungeon Conqueror',
    rank: 'C',
    desc: 'Master of instant dungeon trials.',
    effectDescription: '+25% XP from clearing Gate Waves.',
    shortEffect: '+25% Gate Wave XP',
    requirement: 'Reach Rank C.',
    isUnlocked: (ctx) => meetsRank(ctx, 'C'),
  },
  {
    name: 'The Indomitable Will',
    rank: 'B',
    desc: 'Pushed through zero stamina/mana in Overdrive Protocol.',
    effectDescription: '-30% extra fatigue penalty from Overdrive Protocol.',
    shortEffect: '-30% Overdrive Strain',
    requirement: 'Reach Rank B and trigger Overdrive Protocol at least once.',
    isUnlocked: (ctx) => meetsRank(ctx, 'B') && ctx.overdriveCompletions >= 1,
  },
  {
    name: 'Demon Slayer',
    rank: 'B',
    desc: 'Breaker of demonic gates.',
    effectDescription: '+1 bonus attribute point on top of the Blessing whenever a Gate clears.',
    shortEffect: '+1 Gate Clear Bonus',
    requirement: 'Reach Rank B and clear at least one Gate.',
    isUnlocked: (ctx) => meetsRank(ctx, 'B') && ctx.clearedGatesCount >= 1,
  },
  {
    name: 'Ruler of the Dead',
    rank: 'A',
    desc: 'Commander of lingering shadow souls.',
    effectDescription: '+20% Mana regeneration while equipped.',
    shortEffect: '+20% MP Regen',
    requirement: 'Reach Rank A.',
    isUnlocked: (ctx) => meetsRank(ctx, 'A'),
  },
  {
    name: 'Supreme Sovereign',
    rank: 'S',
    desc: 'The absolute monarch of the shadow realm.',
    effectDescription: '+10% HP / STM / MP regeneration while equipped.',
    shortEffect: '+10% All Regen',
    requirement: 'Reach Rank S.',
    isUnlocked: (ctx) => meetsRank(ctx, 'S'),
  },
];

export const TITLE_EFFECTS: Record<string, TitleEffect> = {
  'Wolf Slayer': { stmRegenMultiplier: 1.15 },
  'Peak Vitality': { hpRegenMultiplier: 1.2, stmRegenMultiplier: 1.1, xpMultiplier: 1.1 },
  'Dungeon Conqueror': { gateWaveXpMultiplier: 1.25 },
  'The Indomitable Will': { overdriveFatigueMultiplier: 0.7 },
  'Demon Slayer': { gateClearBonusAttributePoint: 1 },
  'Ruler of the Dead': { mpRegenMultiplier: 1.2 },
  'Supreme Sovereign': { hpRegenMultiplier: 1.1, stmRegenMultiplier: 1.1, mpRegenMultiplier: 1.1 },
  // Earned by bringing any Seal (seals.ts) to full Integrity. NOTE: xpMultiplier would be a
  // silent no-op here — addXP() only ever reads it for the literal 'Peak Vitality' title, not
  // generically by equipped title (see addXP in storage.ts) — so this uses stmRegenMultiplier,
  // which applyVitalsRegeneration() genuinely does apply by name for any equipped title.
  'The Unshackled': { stmRegenMultiplier: 1.1 },
};

/** Never throws / never undefined — every caller can spread this safely with `?? 1` fallbacks
 * on the individual multipliers without checking for a missing title first. */
export const getEquippedTitleEffect = (title?: string): TitleEffect =>
  (title && TITLE_EFFECTS[title]) || {};
