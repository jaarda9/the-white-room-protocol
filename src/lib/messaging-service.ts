/**
 * Player-to-player messaging service.
 * Backed by the existing MongoDB serverless API (`/api/messages`).
 */
import type { CustomDayPlan } from '@/lib/storage';

/** Other players are addressed by public handle (H-XXXXXXXX), never by Subject ID: the
 * Subject ID is a login credential. `from`/`to` are handles; `mine` marks the caller's own. */
export interface PlayerMessage {
  from: string;
  to: string;
  content: string;
  read: boolean;
  createdAt: string;
  mine?: boolean;
}

export interface MessageThread {
  /** The peer's public handle. */
  peerId: string;
  peerName: string;
  lastMessage: string;
  lastFromMe: boolean;
  lastAt: string;
  unread: number;
  blocked?: boolean;
}

export interface ConversationPeer {
  handle: string;
  name: string;
  blocked: boolean;
  muted: boolean;
}

export interface UnreadSummary {
  unreadCount: number;
  senders: { from: string; name: string; count: number }[];
  latest: PlayerMessage | null;
}

export interface CommsPrefs {
  blocked: { handle: string; name: string }[];
  muted: { handle: string; name: string }[];
}

const API = '/api/messages';

const headers = (): Record<string, string> => ({
  'Content-Type': 'application/json',
  'Cache-Control': 'no-cache',
});

// The session token (attached by session-token.ts) identifies the caller; `userId` is sent
// only so the server can reject a mismatch.

export async function fetchThreads(userId: string): Promise<MessageThread[]> {
  try {
    const res = await fetch(`${API}?userId=${encodeURIComponent(userId)}&_t=${Date.now()}`, {
      headers: headers(),
    });
    if (!res.ok) return [];
    const data = await res.json();
    return data.threads || [];
  } catch {
    return [];
  }
}

export async function fetchConversation(
  userId: string,
  peerHandle: string
): Promise<{ messages: PlayerMessage[]; peer: ConversationPeer | null }> {
  try {
    const res = await fetch(
      `${API}?userId=${encodeURIComponent(userId)}&with=${encodeURIComponent(peerHandle)}&_t=${Date.now()}`,
      { headers: headers() }
    );
    if (!res.ok) return { messages: [], peer: null };
    const data = await res.json();
    return { messages: data.messages || [], peer: data.peer || null };
  } catch {
    return { messages: [], peer: null };
  }
}

/** Flat shape so it narrows the same without strict mode. */
export interface SendResult {
  ok: boolean;
  error?: string;
}

export async function sendMessage(peerHandle: string, content: string): Promise<SendResult> {
  try {
    const res = await fetch(API, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({ to: peerHandle, content }),
    });
    if (res.ok) return { ok: true };
    const data = await res.json().catch(() => ({}));
    return { ok: false, error: String(data?.error || 'Transmission failed — try again.') };
  } catch {
    return { ok: false, error: 'Transmission failed — try again.' };
  }
}

export async function fetchUnreadSummary(userId: string): Promise<UnreadSummary> {
  try {
    const res = await fetch(
      `${API}?userId=${encodeURIComponent(userId)}&action=unread&_t=${Date.now()}`,
      { headers: headers() }
    );
    if (!res.ok) return { unreadCount: 0, senders: [], latest: null };
    const data = await res.json();
    return {
      unreadCount: data.unreadCount || 0,
      senders: data.senders || [],
      latest: data.latest || null,
    };
  } catch {
    return { unreadCount: 0, senders: [], latest: null };
  }
}

export async function fetchCommsPrefs(): Promise<CommsPrefs> {
  try {
    const res = await fetch(`${API}?action=comms-prefs&_t=${Date.now()}`, { headers: headers() });
    if (!res.ok) return { blocked: [], muted: [] };
    const data = await res.json();
    return { blocked: data.blocked || [], muted: data.muted || [] };
  } catch {
    return { blocked: [], muted: [] };
  }
}

/** block: they can no longer message you. mute: their messages arrive, but no notification. */
export async function setCommsRelation(
  action: 'block' | 'unblock' | 'mute' | 'unmute',
  handle: string
): Promise<boolean> {
  try {
    const res = await fetch(API, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({ action, handle }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export interface HunterEntry {
  /** Public handle. */
  handle: string;
  fullName: string;
  level: number;
  isYou: boolean;
}

/**
 * Gym routine sharing — piggybacks entirely on the plain-text `content` field above instead
 * of needing a new message type/API shape. A shared routine is just a normal PlayerMessage
 * whose content happens to start with this marker followed by JSON; anything that doesn't
 * match is rendered as an ordinary chat bubble, so this is fully backward-compatible with
 * every message sent before this existed.
 */
const ROUTINE_SHARE_PREFIX = '##WRP_ROUTINE_SHARE##';

/** sessionStorage key used to hand a routine off from ProtocolCalibrationModal (wherever it's
 * opened from) to the Messages page's compose flow, since they don't share React state. */
export const PENDING_ROUTINE_SHARE_KEY = 'wrp_pending_routine_share';

export interface SharedRoutinePayload {
  name: string;
  weeklySplit: Record<number, CustomDayPlan>;
}

export function encodeRoutineShare(payload: SharedRoutinePayload): string {
  return ROUTINE_SHARE_PREFIX + JSON.stringify(payload);
}

export function decodeRoutineShare(content: string): SharedRoutinePayload | null {
  if (!content.startsWith(ROUTINE_SHARE_PREFIX)) return null;
  try {
    const parsed = JSON.parse(content.slice(ROUTINE_SHARE_PREFIX.length));
    if (parsed && typeof parsed.name === 'string' && parsed.weeklySplit) {
      return parsed as SharedRoutinePayload;
    }
    return null;
  } catch {
    return null;
  }
}

export async function fetchHunters(): Promise<HunterEntry[]> {
  try {
    const res = await fetch(`/api/leaderboard?_t=${Date.now()}`);
    if (!res.ok) return [];
    const data = await res.json();
    return (data.leaderboard || [])
      .filter((h: any) => typeof h.handle === 'string' && h.handle)
      .map((h: any) => ({
        handle: String(h.handle).toUpperCase(),
        fullName: h.fullName,
        level: h.level,
        isYou: Boolean(h.isYou),
      }));
  } catch {
    return [];
  }
}
