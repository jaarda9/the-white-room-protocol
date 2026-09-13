/**
 * Rank/Job/Title advancement — currently a silent number change (getHunterRank/getHunterJob/
 * getHunterTitle recompute fresh from level everywhere, with no ceremony). This detects when
 * a player has just crossed a Rank threshold since the last check, so the Dashboard can show
 * a one-time full-screen ceremony instead.
 */
import { getHunterRank, getHunterJob, getHunterTitle } from '@/lib/storage';
import type { UserProfile } from '@/lib/types';

const LAST_SEEN_RANK_KEY = 'wrp_last_seen_rank';
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

  let lastSeenRank: string | null = null;
  try {
    lastSeenRank = localStorage.getItem(LAST_SEEN_RANK_KEY);
  } catch {
    // ignore
  }

  const remember = (rank: string) => {
    try {
      localStorage.setItem(LAST_SEEN_RANK_KEY, rank);
    } catch {
      // ignore
    }
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
