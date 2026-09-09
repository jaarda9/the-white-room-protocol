/**
 * Player-to-player messaging service.
 * Backed by the existing MongoDB serverless API (`/api/messages`).
 */

export interface PlayerMessage {
  from: string;
  to: string;
  content: string;
  read: boolean;
  createdAt: string;
}

export interface MessageThread {
  peerId: string;
  lastMessage: string;
  lastFrom: string;
  lastAt: string;
  unread: number;
}

export interface UnreadSummary {
  unreadCount: number;
  senders: { from: string; count: number }[];
  latest: PlayerMessage | null;
}

const API = '/api/messages';

const headers = (userId: string): Record<string, string> => ({
  'Content-Type': 'application/json',
  'x-subject-id': userId,
  'Cache-Control': 'no-cache',
});

export async function fetchThreads(userId: string): Promise<MessageThread[]> {
  try {
    const res = await fetch(`${API}?userId=${encodeURIComponent(userId)}&_t=${Date.now()}`, {
      headers: headers(userId),
    });
    if (!res.ok) return [];
    const data = await res.json();
    return data.threads || [];
  } catch {
    return [];
  }
}

export async function fetchConversation(userId: string, peerId: string): Promise<PlayerMessage[]> {
  try {
    const res = await fetch(
      `${API}?userId=${encodeURIComponent(userId)}&with=${encodeURIComponent(peerId)}&_t=${Date.now()}`,
      { headers: headers(userId) }
    );
    if (!res.ok) return [];
    const data = await res.json();
    return data.messages || [];
  } catch {
    return [];
  }
}

export async function sendMessage(userId: string, peerId: string, content: string): Promise<boolean> {
  try {
    const res = await fetch(API, {
      method: 'POST',
      headers: headers(userId),
      body: JSON.stringify({ from: userId, to: peerId, content }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function fetchUnreadSummary(userId: string): Promise<UnreadSummary> {
  try {
    const res = await fetch(
      `${API}?userId=${encodeURIComponent(userId)}&action=unread&_t=${Date.now()}`,
      { headers: headers(userId) }
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

export interface HunterEntry {
  userId: string;
  fullName: string;
  level: number;
}

export async function fetchHunters(): Promise<HunterEntry[]> {
  try {
    const res = await fetch(`/api/leaderboard?_t=${Date.now()}`);
    if (!res.ok) return [];
    const data = await res.json();
    return (data.leaderboard || []).map((h: any) => ({
      userId: String(h.userId || '').replace(/^SUBJECT-/i, '').trim().toUpperCase(),
      fullName: h.fullName,
      level: h.level,
    }));
  } catch {
    return [];
  }
}
