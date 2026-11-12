/**
 * Field Mastery study progress (Phase C) — the synced side: bookmark, learned pace, sections,
 * mastery and the day's session. Small, so it follows the player across devices; the file text
 * itself stays on the device (study-material.ts).
 *
 * The bookmark is the fairness rule: questions only ever come from pages at or before it.
 */

export const STUDY_PROGRESS_KEY = 'wrp_study_progress';
import { requestSync } from '@/lib/sync-signal';
export const STUDY_UPDATED_EVENT = 'wrp:study-updated';

/** Default reading pace for dense study material: one page every 3 minutes. */
const DEFAULT_PACE_PPM = 1 / 3;
const MIN_PACE = 0.05;
const MAX_PACE = 3;
const PACE_WEIGHT = 0.4;
const MAX_PORTION = 40;
const MAX_SESSIONS = 20;

export interface Section {
  title: string;
  start: number;
  end: number;
}

export interface QuizQuestion {
  question: string;
  /** 'today' = from today's pages; 'review' = from earlier covered pages. */
  source: 'today' | 'review';
  page: number;
  /** What a complete answer contains — hidden until graded. */
  keyPoints: string[];
}

export interface QuizResult {
  score: number; // 0, 0.5 or 1
  feedback: string;
}

export interface StudySession {
  date: string;
  materialId: string;
  from: number;
  to: number;
  minutes: number;
  quiz?: {
    questions: QuizQuestion[];
    answers?: string[];
    results?: QuizResult[];
    rewarded?: boolean;
  };
}

export interface MaterialProgress {
  id: string;
  name: string;
  kind: 'pdf' | 'text';
  pageCount: number;
  sections: Section[];
  sectionSource: 'ai' | 'auto';
  /** Last page covered (0 = not started). */
  bookmark: number;
  pacePpm: number;
  /** Section index → 0..1 */
  mastery: Record<string, number>;
  addedAt: string;
}

export interface StudyProgress {
  activeId: string | null;
  materials: Record<string, MaterialProgress>;
  sessions: StudySession[];
}

const empty = (): StudyProgress => ({ activeId: null, materials: {}, sessions: [] });

export function getStudyProgress(): StudyProgress {
  try {
    const p = JSON.parse(localStorage.getItem(STUDY_PROGRESS_KEY) || 'null');
    if (!p || typeof p !== 'object') return empty();
    return {
      activeId: typeof p.activeId === 'string' ? p.activeId : null,
      materials: p.materials && typeof p.materials === 'object' ? p.materials : {},
      sessions: Array.isArray(p.sessions) ? p.sessions : [],
    };
  } catch {
    return empty();
  }
}

export function saveStudyProgress(p: StudyProgress): void {
  const trimmed: StudyProgress = { ...p, sessions: p.sessions.slice(-MAX_SESSIONS) };
  try {
    localStorage.setItem(STUDY_PROGRESS_KEY, JSON.stringify(trimmed));
  } catch {
    // ignore
  }
  requestSync();
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(STUDY_UPDATED_EVENT));
}

/** A heading-like first line of a page, or ''. */
function headingOf(text: string): string {
  const line = (text || '')
    .split('\n')
    .map((l) => l.trim())
    .find((l) => l.length >= 4 && l.length <= 80 && /[A-Za-z]/.test(l));
  return line ? line.replace(/\s+/g, ' ') : '';
}

/** Code-only sections (fallback when THEIA is unavailable): even page groups. */
export function autoSections(pages: string[]): Section[] {
  const count = pages.length;
  if (count === 0) return [];
  const size = Math.max(3, Math.ceil(count / 12));
  const out: Section[] = [];
  for (let start = 1; start <= count; start += size) {
    const end = Math.min(count, start + size - 1);
    const heading = headingOf(pages[start - 1]);
    out.push({ title: heading || `Pages ${start}–${end}`, start, end });
  }
  return out;
}

/**
 * Validates THEIA's section list: ascending start pages inside the file, first section at
 * page 1, ends derived from the next start. Null when unusable.
 */
export function normalizeSections(raw: any, pageCount: number): Section[] | null {
  const list = Array.isArray(raw) ? raw : [];
  const starts: Array<{ title: string; start: number }> = [];
  for (const s of list.slice(0, 40)) {
    const start = Math.round(Number(s?.startPage ?? s?.start));
    const title = String(s?.title || '')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 80);
    if (!Number.isFinite(start) || start < 1 || start > pageCount || !title) continue;
    if (starts.length && start <= starts[starts.length - 1].start) continue;
    starts.push({ title, start });
  }
  if (starts.length === 0) return null;
  if (starts[0].start !== 1) starts.unshift({ title: 'Opening pages', start: 1 });
  return starts.map((s, i) => ({ ...s, end: i + 1 < starts.length ? starts[i + 1].start - 1 : pageCount }));
}

export function addMaterial(progress: StudyProgress, m: MaterialProgress): StudyProgress {
  const existing = progress.materials[m.id];
  // Re-attaching the same file keeps its progress.
  const merged = existing ? { ...existing, name: m.name, pageCount: m.pageCount } : m;
  return { ...progress, activeId: m.id, materials: { ...progress.materials, [m.id]: merged } };
}

export function removeMaterial(progress: StudyProgress, id: string): StudyProgress {
  const materials = { ...progress.materials };
  delete materials[id];
  const activeId = progress.activeId === id ? Object.keys(materials)[0] || null : progress.activeId;
  return { ...progress, activeId, materials };
}

export const sectionIndexOf = (m: MaterialProgress, page: number) =>
  Math.max(0, m.sections.findIndex((s) => page >= s.start && page <= s.end));

export interface Portion {
  from: number;
  to: number;
  title: string;
  finished: boolean;
}

/** Today's suggested pages, sized by the learned pace for a session of `minutes`. */
export function todayPortion(m: MaterialProgress, minutes: number): Portion {
  if (m.bookmark >= m.pageCount) return { from: m.pageCount, to: m.pageCount, title: '', finished: true };
  const from = m.bookmark + 1;
  const count = Math.min(MAX_PORTION, Math.max(1, Math.round((m.pacePpm || DEFAULT_PACE_PPM) * Math.max(5, minutes))));
  const to = Math.min(m.pageCount, from + count - 1);
  const section = m.sections[sectionIndexOf(m, from)];
  return { from, to, title: section?.title || '', finished: false };
}

export function sessionFor(progress: StudyProgress, date: string): StudySession | null {
  return progress.sessions.find((s) => s.date === date) || null;
}

/**
 * "Where did you stop?" — moves the bookmark and learns the pace. One stop per day; returns the
 * updated progress and the session (from > to means nothing new was covered).
 */
export function recordStop(
  progress: StudyProgress,
  materialId: string,
  stopPage: number,
  minutes: number,
  date: string
): { progress: StudyProgress; session: StudySession } | null {
  const m = progress.materials[materialId];
  if (!m || sessionFor(progress, date)) return null;
  const stop = Math.min(m.pageCount, Math.max(m.bookmark, Math.round(stopPage)));
  const covered = stop - m.bookmark;
  let pace = m.pacePpm || DEFAULT_PACE_PPM;
  if (covered > 0 && minutes > 0) {
    const observed = Math.min(MAX_PACE, Math.max(MIN_PACE, covered / minutes));
    pace = pace * (1 - PACE_WEIGHT) + observed * PACE_WEIGHT;
  }
  const session: StudySession = { date, materialId, from: m.bookmark + 1, to: stop, minutes };
  const updated: MaterialProgress = { ...m, bookmark: stop, pacePpm: Math.round(pace * 1000) / 1000 };
  return {
    progress: { ...progress, materials: { ...progress.materials, [m.id]: updated }, sessions: [...progress.sessions, session] },
    session,
  };
}

export function updateSession(progress: StudyProgress, date: string, patch: Partial<StudySession>): StudyProgress {
  return { ...progress, sessions: progress.sessions.map((s) => (s.date === date ? { ...s, ...patch } : s)) };
}

/** Folds graded answers into per-section mastery (moving average, 0..1). */
export function applyResults(
  progress: StudyProgress,
  materialId: string,
  questions: QuizQuestion[],
  results: QuizResult[]
): StudyProgress {
  const m = progress.materials[materialId];
  if (!m) return progress;
  const mastery = { ...m.mastery };
  questions.forEach((q, i) => {
    const r = results[i];
    if (!r) return;
    const idx = String(sectionIndexOf(m, q.page));
    const prev = typeof mastery[idx] === 'number' ? mastery[idx] : r.score;
    mastery[idx] = Math.round((prev * 0.5 + r.score * 0.5) * 100) / 100;
  });
  return { ...progress, materials: { ...progress.materials, [m.id]: { ...m, mastery } } };
}

export function coveragePct(m: MaterialProgress): number {
  return m.pageCount ? Math.round((m.bookmark / m.pageCount) * 100) : 0;
}

/** Average mastery over sections that have been tested; null before the first check. */
export function masteryPct(m: MaterialProgress): number | null {
  const values = Object.values(m.mastery || {}).filter((v) => typeof v === 'number');
  return values.length ? Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 100) : null;
}

/** A review page: from the weakest earlier section that has been covered, else any earlier page. */
export function pickReviewRange(m: MaterialProgress, todayFrom: number, seed: number): { from: number; to: number } | null {
  const earlier = m.sections.filter((s) => s.start < todayFrom);
  if (earlier.length === 0) return null;
  const scored = earlier
    .map((s) => ({ s, mastery: m.mastery[String(m.sections.indexOf(s))] }))
    .sort((a, b) => (a.mastery ?? 0.5) - (b.mastery ?? 0.5));
  const weakest = scored.slice(0, Math.min(3, scored.length));
  const pick = weakest[Math.abs(seed) % weakest.length].s;
  return { from: pick.start, to: Math.min(pick.end, todayFrom - 1) };
}
