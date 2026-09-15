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
  /** Where clicking this notification should navigate, if anywhere specific. */
  route?: string;
}

const MAX_NOTIFICATIONS = 100;

export const getNotifications = (): AppNotification[] => {
  try {
    const raw = localStorage.getItem(NOTIFICATIONS_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
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
  const list = getNotifications().map((n) => (n.id === id ? { ...n, read: true } : n));
  saveNotifications(list);
};

export const markAllNotificationsRead = (): void => {
  const list = getNotifications();
  if (list.every((n) => n.read)) return;
  saveNotifications(list.map((n) => ({ ...n, read: true })));
};

export const getUnreadNotificationCount = (): number =>
  getNotifications().filter((n) => !n.read).length;
