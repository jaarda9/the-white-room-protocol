/**
 * Pure decay math for UserProfile.sealXpModifier — kept as a zero-dependency leaf module (like
 * titles.ts) specifically so storage.ts's addXP() can apply it without seals.ts needing to
 * import FROM storage.ts's own consumers, avoiding a circular import.
 */
import type { SealXpModifier } from '@/lib/types';

/** Never throws / never undefined — safe to multiply into an XP calculation unconditionally. */
export const getEffectiveSealXpMultiplier = (modifier?: SealXpModifier): number => {
  if (!modifier) return 1;

  const now = Date.now();
  const start = new Date(modifier.startedAt).getTime();
  const end = new Date(modifier.expiresAt).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return 1;
  if (now >= end) return 1;
  if (now <= start) return modifier.multiplier;

  // Linear fade from full strength back to 1.0 (no effect) as time elapses — works the same
  // for a buff (>1, fading down) and a debuff (<1, fading up).
  const progress = (now - start) / (end - start);
  return modifier.multiplier + (1 - modifier.multiplier) * progress;
};
