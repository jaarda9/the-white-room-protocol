/**
 * Local-only calendar events (no Supabase). Keyed by subject `user.id` like other whiteroom_* storage.
 */

import { scheduleSyncAfterGeneratedContentSave } from "@/lib/sync-manager";

const STORAGE_PREFIX = "whiteroom_calendar_events:";

export interface StoredCalendarEvent {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  event_type: string;
  event_date: string;
  event_time: string | null;
  reminder_minutes: number | null;
  is_completed: boolean;
  priority: string;
  created_at: string;
  updated_at: string;
}

function keyForUser(userId: string): string {
  return `${STORAGE_PREFIX}${userId}`;
}

export function loadCalendarEvents(userId: string): StoredCalendarEvent[] {
  try {
    const raw = localStorage.getItem(keyForUser(userId));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((e): e is StoredCalendarEvent => e != null && typeof e === "object" && typeof (e as StoredCalendarEvent).id === "string")
      .sort((a, b) => a.event_date.localeCompare(b.event_date));
  } catch {
    return [];
  }
}

export function saveCalendarEvents(userId: string, events: StoredCalendarEvent[]): void {
  try {
    localStorage.setItem(keyForUser(userId), JSON.stringify(events));
    scheduleSyncAfterGeneratedContentSave();
  } catch (e) {
    console.error("[calendar-events-storage] save failed:", e);
  }
}

/** Call on sign-out so calendar data is cleared with the session (same idea as other `whiteroom_*` keys). */
export function clearCalendarEventsForUser(userId: string): void {
  try {
    localStorage.removeItem(keyForUser(userId));
    scheduleSyncAfterGeneratedContentSave();
  } catch {
    /* ignore */
  }
}
