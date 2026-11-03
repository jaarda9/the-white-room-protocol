/**
 * Declared Absences — the fair half of missed-day counting (storage.ts applyVitalsRegeneration).
 *
 * A Hunter may tell the System in ADVANCE that they will be away (travel, illness…). Declared days
 * never count toward the missed-quest streak, and api/push.ts stays silent on them. Declared before
 * the day begins it is legitimate; after the fact it would be an excuse — so a declaration can only
 * start tomorrow or later, and can only be withdrawn before it starts.
 *
 * Synced (synced-localstorage-keys.ts) so the server's tick sees the same declarations.
 */
import { scheduleSyncAfterGeneratedContentSave } from '@/lib/sync-manager';

// Local copy of storage.ts's getTodayKeyLocal — storage.ts imports this module, so importing
// back from it would be circular.
const getTodayKeyLocal = (d: Date = new Date()): string =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export const ABSENCES_KEY = 'wrp_declared_absences';
export const ABSENCES_UPDATED_EVENT = 'wrp:absences-updated';

export const MAX_ABSENCE_DAYS = 7;
/** Declaring this far ahead is plenty; prevents parking a permanent "absence" far in the future. */
export const MAX_ABSENCE_LEAD_DAYS = 30;

export type AbsenceReason = 'travel' | 'illness' | 'family' | 'other';

export const ABSENCE_REASON_LABEL: Record<AbsenceReason, string> = {
  travel: 'Travel',
  illness: 'Illness / Recovery',
  family: 'Family Matter',
  other: 'Other',
};

export interface DeclaredAbsence {
  id: string;
  /** Local YYYY-MM-DD, inclusive. */
  from: string;
  /** Local YYYY-MM-DD, inclusive. */
  to: string;
  reason: AbsenceReason;
  declaredAt: string;
}

const addDays = (key: string, n: number): string => {
  const d = new Date(+key.slice(0, 4), +key.slice(5, 7) - 1, +key.slice(8, 10));
  d.setDate(d.getDate() + n);
  return getTodayKeyLocal(d);
};

export const getDeclaredAbsences = (): DeclaredAbsence[] => {
  try {
    const raw = localStorage.getItem(ABSENCES_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const saveDeclaredAbsences = (list: DeclaredAbsence[]): void => {
  // Old, finished absences carry no information the streak logic still needs after a while.
  const cutoff = addDays(getTodayKeyLocal(), -MAX_ABSENCE_LEAD_DAYS);
  const kept = list.filter((a) => a.to >= cutoff).sort((a, b) => a.from.localeCompare(b.from));
  localStorage.setItem(ABSENCES_KEY, JSON.stringify(kept));
  window.dispatchEvent(new CustomEvent(ABSENCES_UPDATED_EVENT));
  scheduleSyncAfterGeneratedContentSave(); // the push tick reads declarations from the synced blob
};

export const isDeclaredAbsentOn = (dateKey: string, list: DeclaredAbsence[] = getDeclaredAbsences()): boolean =>
  list.some((a) => a.from <= dateKey && dateKey <= a.to);

/** Upcoming or ongoing declarations, soonest first. */
export const getActiveAbsences = (): DeclaredAbsence[] => {
  const today = getTodayKeyLocal();
  return getDeclaredAbsences().filter((a) => a.to >= today);
};

export const declareAbsence = (from: string, days: number, reason: AbsenceReason): DeclaredAbsence => {
  const today = getTodayKeyLocal();
  const tomorrow = addDays(today, 1);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || from < tomorrow) {
    throw new Error('An absence must be declared in advance — it can start tomorrow at the earliest.');
  }
  if (from > addDays(today, MAX_ABSENCE_LEAD_DAYS)) {
    throw new Error(`An absence can be declared at most ${MAX_ABSENCE_LEAD_DAYS} days ahead.`);
  }
  const length = Math.max(1, Math.min(MAX_ABSENCE_DAYS, Math.floor(days)));
  const to = addDays(from, length - 1);

  const list = getDeclaredAbsences();
  if (list.some((a) => a.from <= to && from <= a.to)) {
    throw new Error('This period overlaps an absence already declared.');
  }

  const absence: DeclaredAbsence = {
    id: `abs-${Date.now()}`,
    from,
    to,
    reason,
    declaredAt: new Date().toISOString(),
  };
  saveDeclaredAbsences([...list, absence]);
  return absence;
};

/** Only before it begins — once the absence has started, it stands. */
export const withdrawAbsence = (id: string): void => {
  const today = getTodayKeyLocal();
  const list = getDeclaredAbsences();
  const target = list.find((a) => a.id === id);
  if (!target) return;
  if (target.from <= today) throw new Error('An absence already in effect cannot be withdrawn.');
  saveDeclaredAbsences(list.filter((a) => a.id !== id));
};

export const getTomorrowKey = (): string => addDays(getTodayKeyLocal(), 1);
export const getAbsenceEndKey = (from: string, days: number): string =>
  addDays(from, Math.max(1, Math.min(MAX_ABSENCE_DAYS, Math.floor(days))) - 1);
