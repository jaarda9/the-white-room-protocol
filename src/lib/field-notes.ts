/**
 * Field notes — the optional proof at the end of a session (Phase A1).
 *
 *   Archive Access (reading)       → one-line takeaway
 *   Combat Log Review (reflection) → victory / error / adjustment
 *   Ally Registry (gratitude)      → three lines
 *
 * Optional by design: the directive is complete without a note. Writing one pays a small hidden
 * stat bonus, once per directive per day. Notes are synced (small, capped) and read back by the
 * monthly Codex and, later, THEIA's weekly analysis.
 */
import type { Attributes, Quest } from '@/lib/types';
import { getDirectiveKey, type DirectiveKey } from '@/lib/quest-content';
import { requestSync } from '@/lib/sync-signal';

export const FIELD_NOTES_KEY = 'wrp_field_notes';
export const FIELD_NOTES_UPDATED_EVENT = 'wrp:field-notes-updated';

/** Kept for this many days; older notes are dropped on the next write (sync payload stays small). */
const RETENTION_DAYS = 60;
export const NOTE_LIMITS = { line: 200 } as const;

export type FieldNoteKind = 'reading' | 'reflection' | 'gratitude';

export interface FieldNote {
  id: string;
  /** Local day (YYYY-MM-DD). */
  date: string;
  kind: FieldNoteKind;
  /** reading: [takeaway] · reflection: [victory, error, adjustment] · gratitude: [1, 2, 3] */
  lines: string[];
  /** Context, e.g. the book title for a reading takeaway. */
  context?: string;
  createdAt: string;
  /** THEIA's reading companion (theia-companion.ts): asked once per note. */
  companion?: { kind: 'question' | 'connection'; text: string };
  /** The Hunter's one-line answer to the companion (no AI). */
  reply?: string;
}

export interface FieldNoteSpec {
  kind: FieldNoteKind;
  title: string;
  prompt: string;
  fields: { label: string; placeholder: string }[];
  /** Hidden stat bonus for writing it (once per day). */
  bonus: Partial<Attributes>;
}

export const FIELD_NOTE_SPECS: Record<FieldNoteKind, FieldNoteSpec> = {
  reading: {
    kind: 'reading',
    title: 'ARCHIVE EXTRACT',
    prompt: 'One idea from today’s pages. If you cannot name one, you did not read.',
    fields: [{ label: 'TAKEAWAY', placeholder: 'The one idea worth keeping…' }],
    bonus: { INT: 1 },
  },
  reflection: {
    kind: 'reflection',
    title: 'COMBAT LOG',
    prompt: 'Record the battle, not the feelings about it.',
    fields: [
      { label: 'VICTORY', placeholder: 'What went right today' },
      { label: 'ERROR', placeholder: 'Where you chose comfort over growth' },
      { label: 'ADJUSTMENT', placeholder: 'One specific change for tomorrow' },
    ],
    bonus: { WIS: 1 },
  },
  gratitude: {
    kind: 'gratitude',
    title: 'ALLY REGISTRY',
    prompt: 'Three allies — people or things — that made you stronger today.',
    fields: [
      { label: 'I', placeholder: 'First' },
      { label: 'II', placeholder: 'Second' },
      { label: 'III', placeholder: 'Third' },
    ],
    bonus: { PER: 1 },
  },
};

const KIND_BY_DIRECTIVE: Partial<Record<DirectiveKey, FieldNoteKind>> = {
  reading: 'reading',
  reflection: 'reflection',
  gratitude: 'gratitude',
};

/** The note this directive takes, or null (most directives take none). */
export function fieldNoteKindFor(quest: Pick<Quest, 'id' | 'type'>): FieldNoteKind | null {
  const key = getDirectiveKey(quest);
  return key ? KIND_BY_DIRECTIVE[key] || null : null;
}

const dayNumber = (ymd: string) =>
  Math.round(Date.UTC(+ymd.slice(0, 4), +ymd.slice(5, 7) - 1, +ymd.slice(8, 10)) / 86_400_000);

export function getFieldNotes(): FieldNote[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(FIELD_NOTES_KEY) || '[]');
    return Array.isArray(parsed)
      ? parsed.filter((n) => n && typeof n.date === 'string' && Array.isArray(n.lines) && typeof n.kind === 'string')
      : [];
  } catch {
    return [];
  }
}

export function getFieldNote(date: string, kind: FieldNoteKind): FieldNote | null {
  return getFieldNotes().find((n) => n.date === date && n.kind === kind) || null;
}

/** Sanitised lines, or null when nothing meaningful was written. */
export function cleanNoteLines(kind: FieldNoteKind, raw: string[]): string[] | null {
  const count = FIELD_NOTE_SPECS[kind].fields.length;
  const lines = Array.from({ length: count }, (_, i) =>
    String(raw[i] || '')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, NOTE_LIMITS.line)
  );
  // Reading: the one line is required. Reflection/gratitude: at least one line written.
  if (kind === 'reading' ? !lines[0] : lines.every((l) => !l)) return null;
  return lines;
}

/**
 * Saves (or replaces) the day's note of this kind. Returns `firstToday` — true only the first
 * time a note of this kind is written today, which is when the hidden bonus is paid.
 */
export function saveFieldNote(
  date: string,
  kind: FieldNoteKind,
  rawLines: string[],
  context?: string
): { note: FieldNote; firstToday: boolean } | null {
  const lines = cleanNoteLines(kind, rawLines);
  if (!lines) return null;
  const all = getFieldNotes();
  const existing = all.find((n) => n.date === date && n.kind === kind);
  const note: FieldNote = {
    id: existing?.id || `fn-${date}-${kind}`,
    date,
    kind,
    lines,
    context: context ? String(context).slice(0, 120) : existing?.context,
    createdAt: existing?.createdAt || new Date().toISOString(),
    // Editing the note keeps THEIA's companion and the Hunter's answer.
    ...(existing?.companion ? { companion: existing.companion } : {}),
    ...(existing?.reply ? { reply: existing.reply } : {}),
  };
  const today = dayNumber(date);
  const kept = all.filter((n) => !(n.date === date && n.kind === kind) && today - dayNumber(n.date) < RETENTION_DAYS);
  try {
    localStorage.setItem(FIELD_NOTES_KEY, JSON.stringify([...kept, note]));
  } catch {
    return null;
  }
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(FIELD_NOTES_UPDATED_EVENT));
  requestSync();
  return { note, firstToday: !existing };
}

/** Notes within a month (YYYY-MM), for the Codex. */
export function getFieldNotesForMonth(monthKey: string): FieldNote[] {
  return getFieldNotes().filter((n) => n.date.startsWith(monthKey));
}

/** One readable line per note, e.g. for the Codex prompt. */
export function describeNote(n: FieldNote): string {
  if (n.kind === 'reading') return `Reading takeaway${n.context ? ` (${n.context})` : ''}: "${n.lines[0]}"`;
  if (n.kind === 'reflection') {
    const [v, e, a] = n.lines;
    return `Combat log: ${[v && `victory "${v}"`, e && `error "${e}"`, a && `adjustment "${a}"`].filter(Boolean).join(', ')}`;
  }
  return `Gratitude: ${n.lines.filter(Boolean).map((l) => `"${l}"`).join(', ')}`;
}

/** Adds THEIA's companion or the Hunter's reply to an existing note. Returns the note, or null. */
export function saveNoteExtras(
  date: string,
  kind: FieldNoteKind,
  patch: { companion?: FieldNote['companion']; reply?: string }
): FieldNote | null {
  const all = getFieldNotes();
  const idx = all.findIndex((n) => n.date === date && n.kind === kind);
  if (idx < 0) return null;
  const next: FieldNote = { ...all[idx] };
  if (patch.companion) next.companion = { kind: patch.companion.kind, text: String(patch.companion.text).slice(0, 200) };
  if (patch.reply !== undefined) {
    const reply = String(patch.reply).replace(/\s+/g, ' ').trim().slice(0, NOTE_LIMITS.line);
    if (reply) next.reply = reply;
    else delete next.reply;
  }
  all[idx] = next;
  try {
    localStorage.setItem(FIELD_NOTES_KEY, JSON.stringify(all));
  } catch {
    return null;
  }
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(FIELD_NOTES_UPDATED_EVENT));
  requestSync();
  return next;
}
