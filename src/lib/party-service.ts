/**
 * Party (co-op) client — api/party.ts. The session token is attached by session-token.ts.
 */
import { addXP, getUserProfile, saveUserProfile } from '@/lib/storage';

export type MemberStatus = 'cleared' | 'active' | 'idle' | 'excused';

export interface PartyMember {
  handle: string;
  name: string;
  rank: string;
  level: number;
  isYou: boolean;
  isLeader: boolean;
  today: { status: MemberStatus; done: number; total: number };
  coveredToday: boolean;
  coveredByYou: boolean;
  coverable: boolean;
}

export interface PartyView {
  name: string;
  isLeader: boolean;
  size: number;
  max: number;
  bond: { streak: number; best: number; lastResult: 'kept' | 'fractured' | null; lastResultDate: string | null };
  coverAvailable: boolean;
  coverProgress: { cleared: boolean; bonusDone: number; bonusRequired: number } | null;
  members: PartyMember[];
}

export interface PartyState {
  party: PartyView | null;
  invites: { id: string; partyName: string; fromName: string }[];
  rewards: { id: string; xp: number; reason: string; date: string }[];
  joinBlockedUntil: string | null;
}

export const PARTY_UPDATED_EVENT = 'wrp:party-updated';

const tz = () => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
};

let cached: PartyState | null = null;
export const getCachedPartyState = () => cached;

export async function fetchPartyState(): Promise<PartyState | null> {
  try {
    const res = await fetch(`/api/party?action=state&tz=${encodeURIComponent(tz())}&_t=${Date.now()}`);
    if (!res.ok) return null;
    cached = (await res.json()) as PartyState;
    return cached;
  } catch {
    return null;
  }
}

export interface ActionResult {
  ok: boolean;
  error?: string;
  state?: PartyState;
  data?: any;
}

export async function partyAction(body: Record<string, unknown>): Promise<ActionResult> {
  try {
    const res = await fetch('/api/party', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...body, tz: tz() }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, error: String(data?.error || 'The party uplink failed. Try again.') };
    if (data && 'party' in data) {
      cached = data as PartyState;
      window.dispatchEvent(new Event(PARTY_UPDATED_EVENT));
      return { ok: true, state: cached, data };
    }
    return { ok: true, data };
  } catch {
    return { ok: false, error: 'The party uplink failed. Check your connection.' };
  }
}

/**
 * Claims every pending Bond reward. The server marks each claimed first (once only), then the
 * EXP is added here — so a reward can never be paid twice, even from two devices.
 */
export async function claimPartyRewards(rewards: PartyState['rewards']): Promise<number> {
  let total = 0;
  for (const r of rewards) {
    const result = await partyAction({ action: 'claim', rewardId: r.id });
    if (result.ok && Number(result.data?.xp) > 0) total += Number(result.data.xp);
  }
  if (total > 0) {
    saveUserProfile(addXP(getUserProfile(), total));
    window.dispatchEvent(new Event('wrp:profile-updated'));
  }
  return total;
}
