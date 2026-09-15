/**
 * Rank/Job/Title advancement — currently a silent number change (getHunterRank/getHunterJob/
 * getHunterTitle recompute fresh from level everywhere, with no ceremony). This detects when
 * a player has just crossed a Rank threshold since the last check, so the Dashboard can show
 * a one-time full-screen ceremony instead.
 *
 * The "last seen rank" marker lives on `profile.lastSeenRank` — part of the synced profile,
 * not a local-only localStorage key. A local-only marker never travels with the account: a new
 * device/browser, a reinstalled PWA, or iOS's own periodic site-data eviction all start with no
 * marker at all, so the very next correct (already-guarded) check reads a fresh Level-1 default
 * as the "previous" rank and replays the ceremony for a rank the player reached long ago. Syncing
 * it via MongoDB alongside level/xp closes that for good.
 */
import { getHunterRank, getHunterJob, getHunterTitle, saveUserProfile } from '@/lib/storage';
import type { UserProfile } from '@/lib/types';

const RANK_ORDER = ['E', 'D', 'C', 'B', 'A', 'S'] as const;

export interface RankAdvancement {
  previousRank: string;
  rank: string;
  job: string;
  title: string;
  level: number;
}

export const checkRankAdvancement = (profile: UserProfile): RankAdvancement | null => {
  const currentRank = getHunterRank(profile.level);
  const lastSeenRank = profile.lastSeenRank ?? null;

  const remember = (rank: string) => {
    if (profile.lastSeenRank === rank) return;
    saveUserProfile({ ...profile, lastSeenRank: rank });
  };

  // First-ever check (no marker yet): seed silently rather than firing a ceremony — an
  // existing/returning player who is already Rank C, say, didn't just "advance" to it.
  if (lastSeenRank === null) {
    remember(currentRank);
    return null;
  }

  if (lastSeenRank === currentRank) return null;

  const prevIndex = RANK_ORDER.indexOf(lastSeenRank as (typeof RANK_ORDER)[number]);
  const currIndex = RANK_ORDER.indexOf(currentRank);
  remember(currentRank);

  // Only celebrate genuine advancement (a downgrade shouldn't normally happen, but if the
  // recorded rank is unrecognized or current isn't strictly higher, don't show a ceremony).
  if (prevIndex === -1 || currIndex <= prevIndex) return null;

  return {
    previousRank: lastSeenRank,
    rank: currentRank,
    job: getHunterJob(profile.level, profile.job),
    title: getHunterTitle(profile.level, profile.title),
    level: profile.level,
  };
};
