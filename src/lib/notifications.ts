/**
 * A real, persisted Notification Log — every one of the app's existing event sources
 * (system-events, penalty-system, gates, seals, rank-advancement) pushes into this in addition
 * to whatever transient toast it already shows. A toast is a "right now" nudge you'll miss if
 * you're not looking; a notification here is a permanent record you can revisit later. Synced
 * (see synced-localstorage-keys.ts) the same way Seals/Gates are, so read state and history
 * survive a reload or travel across devices instead of resetting on every mount.
 */
import { scheduleSyncAfterGeneratedContentSave } from '@/lib/sync-manager';

export const NOTIFICATIONS_KEY = 'wrp_notifications';
export const NOTIFICATIONS_UPDATED_EVENT = 'wrp:notifications-updated';

export type NotificationSeverity = 'critical' | 'notice' | 'milestone';

export interface AppNotification {
  id: string;
  /** Dedup key for the source event (e.g. 'gate-breach-<id>', 'seal-rankup-<id>-<rank>') —
   * pushing the same key again refreshes the existing entry (new timestamp, unread again)
   * instead of duplicating it, so a re-firing source never spams the list. */
  key: string;
  severity: NotificationSeverity;
  title: string;
  description: string;
  createdAt: string;
  read: boolean;
  /** Set the moment it's actually marked read — the 7-day read-expiry below counts from this,
   * not from `createdAt`, so something read the instant it arrives still gets a full 7 days
   * of visibility rather than none. */
  readAt?: string;
  /** Where clicking this notification should navigate, if anywhere specific. */
  route?: string;
}

const MAX_NOTIFICATIONS = 100;
/** A read notification sticks around long enough to actually reference, then clears itself out
 * — no manual upkeep required for the common case. */
const READ_EXPIRY_MS = 7 * 86_400_000;
/** Safety net for something that's never acknowledged at all — even an unread notice this old
 * is stale enough that surfacing it forever does more harm (clutter) than good. */
const MAX_AGE_MS = 30 * 86_400_000;

/** Drops anything past its read-expiry or max-age window. Pure — callers persist only if the
 * length actually changed, so a plain read never causes a pointless write/sync. */
const pruneStale = (list: AppNotification[], nowMs: number): AppNotification[] =>
  list.filter((n) => {
    const createdMs = new Date(n.createdAt).getTime();
    if (Number.isFinite(createdMs) && nowMs - createdMs > MAX_AGE_MS) return false;
    if (n.read) {
      const readMs = new Date(n.readAt ?? n.createdAt).getTime();
      if (Number.isFinite(readMs) && nowMs - readMs > READ_EXPIRY_MS) return false;
    }
    return true;
  });

export const getNotifications = (): AppNotification[] => {
  try {
    const raw = localStorage.getItem(NOTIFICATIONS_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed)) return [];

    const pruned = pruneStale(parsed as AppNotification[], Date.now());
    if (pruned.length !== parsed.length) {
      // Self-heal-on-read, same pattern as getSeals()/getGates() — silent, no event dispatch,
      // so a plain read never triggers a sync/re-render loop on its own.
      try {
        localStorage.setItem(NOTIFICATIONS_KEY, JSON.stringify(pruned));
      } catch {
        // ignore — the in-memory pruned copy below is still correct for this session
      }
    }
    return pruned;
  } catch {
    return [];
  }
};

export const saveNotifications = (list: AppNotification[]): void => {
  try {
    localStorage.setItem(NOTIFICATIONS_KEY, JSON.stringify(list));
    scheduleSyncAfterGeneratedContentSave();
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent(NOTIFICATIONS_UPDATED_EVENT));
    }
  } catch {
    // ignore
  }
};

export interface PushNotificationInput {
  key: string;
  severity: NotificationSeverity;
  title: string;
  description: string;
  route?: string;
}

/** Safe to call every time a source event fires, even if it fires again before the player has
 * seen the last one — same `key` just refreshes the entry (moves to top, unread) rather than
 * piling up duplicates. */
export const pushNotification = (input: PushNotificationInput): void => {
  const list = getNotifications().filter((n) => n.key !== input.key);
  const entry: AppNotification = {
    id: crypto.randomUUID(),
    key: input.key,
    severity: input.severity,
    title: input.title,
    description: input.description,
    createdAt: new Date().toISOString(),
    read: false,
    route: input.route,
  };
  saveNotifications([entry, ...list].slice(0, MAX_NOTIFICATIONS));
};

export const markNotificationRead = (id: string): void => {
  const now = new Date().toISOString();
  const list = getNotifications().map((n) => (n.id === id ? { ...n, read: true, readAt: n.readAt ?? now } : n));
  saveNotifications(list);
};

export const markAllNotificationsRead = (): void => {
  const now = new Date().toISOString();
  const list = getNotifications();
  if (list.every((n) => n.read)) return;
  saveNotifications(list.map((n) => (n.read ? n : { ...n, read: true, readAt: now })));
};

/** Manual sweep for "clear it now" instead of waiting out the 7-day read-expiry window. */
export const clearReadNotifications = (): void => {
  const list = getNotifications();
  const remaining = list.filter((n) => !n.read);
  if (remaining.length === list.length) return;
  saveNotifications(remaining);
};

export const getUnreadNotificationCount = (): number =>
  getNotifications().filter((n) => !n.read).length;
