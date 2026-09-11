import type { AttributeType, Attributes, UserProfile } from './types';

type ScaleOptions = {
  completionRatio?: number;
  baseMultiplier?: number;
  minCompletionRatio?: number;
};

function getEffectiveStats(profile: UserProfile): Attributes {
  const visible = (profile?.visibleStats || (profile as any)?.stats || {}) as Partial<Attributes>;
  const accum = (profile?.accumulatedPoints || {}) as Partial<Attributes>;
  return {
    STR: (visible.STR || 0) + (accum.STR || 0),
    AGI: (visible.AGI || 0) + (accum.AGI || 0),
    VIT: (visible.VIT || 0) + (accum.VIT || 0),
    INT: (visible.INT || 0) + (accum.INT || 0),
    PER: (visible.PER || 0) + (accum.PER || 0),
    WIS: (visible.WIS || 0) + (accum.WIS || 0),
  };
}

function getHiddenScalingFactor(
  attribute: AttributeType,
  effectiveStats: Attributes,
  currentLevel: number
): number {
  const currentStat = effectiveStats[attribute];

  // Primary diminishing returns by effective stat value.
  let statFactor = 1;
  if (currentStat > 80) statFactor = 0.35;
  else if (currentStat > 60) statFactor = 0.55;
  else if (currentStat > 40) statFactor = 0.75;

  // Light global damping for higher levels.
  const levelFactor =
    currentLevel >= 25 ? 0.85 :
    currentLevel >= 20 ? 0.9 :
    currentLevel >= 15 ? 0.95 : 1;

  // Smart relative balancing across effective stats.
  const values = Object.values(effectiveStats).map((v) => Math.max(0, Number(v) || 0));
  const mean = values.reduce((s, v) => s + v, 0) / Math.max(1, values.length);
  const variance =
    values.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / Math.max(1, values.length);
  const stdDev = Math.sqrt(Math.max(0, variance));
  const zScore = stdDev > 0 ? (currentStat - mean) / stdDev : 0;

  let relativeFactor = 1;
  if (zScore > 1.5) relativeFactor = 0.65;
  else if (zScore > 1.0) relativeFactor = 0.78;
  else if (zScore > 0.5) relativeFactor = 0.9;

  return statFactor * levelFactor * relativeFactor;
}

export function scaleHiddenRewards(
  profile: UserProfile,
  baseRewards: Partial<Attributes>,
  options: ScaleOptions = {}
): Partial<Attributes> {
  if (!profile || !baseRewards) return baseRewards || {};
  const completionRatio = Math.max(0, options.completionRatio ?? 1);
  const baseMultiplier = Math.max(0, options.baseMultiplier ?? 1);
  const minCompletionRatio = Math.max(0, options.minCompletionRatio ?? 0);

  if (completionRatio < minCompletionRatio) return {};

  const effectiveStats = getEffectiveStats(profile);
  const scaled: Partial<Attributes> = {};

  (Object.entries(baseRewards) as Array<[AttributeType, number]>).forEach(([attr, base]) => {
    const safeBase = Math.max(0, Number(base) || 0);
    if (safeBase <= 0) return;
    const factor = getHiddenScalingFactor(attr, effectiveStats, profile.level);
    const raw = safeBase * completionRatio * baseMultiplier * factor;
    const rounded = Math.round(raw);
    if (rounded > 0) scaled[attr] = rounded;
  });

  return scaled;
}

/** Display-only scale for attribute bars (block + width bars). Actual stat values are not capped. */
export const ATTRIBUTE_BAR_VISUAL_MAX = 300;
