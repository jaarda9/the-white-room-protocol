/**
 * Intel courses (Phase D) — the client side.
 *
 * One course at a time, on any niche. The course and its lessons live in a shared server
 * library (api/ai.ts course-*), written from Wikipedia with the player's own key the first time
 * anyone reaches them. This file keeps the player's own progress (synced): which lessons are
 * done, scores, mastery level, mastered courses.
 *
 * The daily "Intel Briefing" directive = today's lesson + its check. The check is multiple
 * choice and graded here (no AI request): the lesson's questions plus one review question from
 * an earlier lesson when there is one.
 */
import { aiGatewayClient } from '@/lib/ai-gateway-client';
import { requestSync } from '@/lib/sync-signal';

export const INTEL_KEY = 'wrp_intel';
export const INTEL_UPDATED_EVENT = 'wrp:intel-updated';
export const MAX_BONUS_LESSONS_PER_DAY = 3;
export const BONUS_LESSON_XP = 15;
export const ARCHIVIST_TITLE = 'The Archivist';

export const NICHE_SUGGESTIONS = [
  'Ancient Rome',
  'World War II',
  'Geography of Africa',
  'Personal finance',
  'Human anatomy',
  'Astronomy',
  'Stoicism',
  'Cognitive psychology',
  'Climate science',
  'History of Japan',
  'Microeconomics',
  'Nutrition science',
];

export interface SyllabusItem {
  n: number;
  title: string;
  summary: string;
}

export interface LessonQuestion {
  question: string;
  options: string[];
  answer: number;
  explanation: string;
}

export interface Lesson {
  key: string;
  n: number;
  title: string;
  body: string;
  questions: LessonQuestion[];
  source: { title: string; url: string };
}

export interface CourseInfo {
  key: string;
  niche: string;
  syllabus: SyllabusItem[];
  sources: { title: string; url: string }[];
}

export interface LessonRecord {
  date: string;
  correct: number;
  total: number;
  /** Counted for the daily directive (vs. a bonus lesson). */
  directive: boolean;
}

export interface IntelState {
  active: (CourseInfo & { startedAt: string; done: Record<string, LessonRecord> }) | null;
  mastered: { key: string; niche: string; date: string; accuracy: number }[];
}

const empty = (): IntelState => ({ active: null, mastered: [] });

export function getIntelState(): IntelState {
  try {
    const s = JSON.parse(localStorage.getItem(INTEL_KEY) || 'null');
    if (!s || typeof s !== 'object') return empty();
    return {
      active: s.active && Array.isArray(s.active.syllabus) ? { ...s.active, done: s.active.done || {} } : null,
      mastered: Array.isArray(s.mastered) ? s.mastered : [],
    };
  } catch {
    return empty();
  }
}

export function saveIntelState(state: IntelState): void {
  try {
    localStorage.setItem(INTEL_KEY, JSON.stringify(state));
  } catch {
    // ignore
  }
  requestSync();
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(INTEL_UPDATED_EVENT));
}

// ---------------------------------------------------------------------------
// Server calls (api/ai.ts) — the player's own Gemini keys go along, as for every AI call.
// ---------------------------------------------------------------------------

async function courseCall<T>(body: Record<string, unknown>): Promise<T> {
  const keys = aiGatewayClient.getActiveCandidateKeys();
  const res = await fetch('/api/ai', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...body, userApiKeys: keys, userApiKey: keys[0] }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err: any = new Error(String(data?.error || `The course uplink failed (${res.status}).`));
    err.status = res.status;
    throw err;
  }
  return data as T;
}

export async function startCourse(niche: string): Promise<CourseInfo> {
  const { course } = await courseCall<{ course: CourseInfo & Record<string, unknown> }>({ action: 'course-start', niche });
  const info: CourseInfo = {
    key: course.key,
    niche: course.niche,
    syllabus: (course.syllabus || []).map((s: any) => ({ n: s.n, title: s.title, summary: s.summary })),
    sources: course.sources || [],
  };
  const state = getIntelState();
  saveIntelState({ ...state, active: { ...info, startedAt: new Date().toISOString(), done: {} } });
  return info;
}

export function abandonCourse(): void {
  const state = getIntelState();
  saveIntelState({ ...state, active: null });
}

const lessonCache = new Map<string, Lesson>();

export async function fetchLesson(key: string, n: number): Promise<Lesson> {
  const cacheKey = `${key}#${n}`;
  const cached = lessonCache.get(cacheKey);
  if (cached) return cached;
  const { lesson } = await courseCall<{ lesson: Lesson }>({ action: 'course-lesson', key, n });
  lessonCache.set(cacheKey, lesson);
  return lesson;
}

export async function reportLesson(key: string, n: number, reason: string): Promise<void> {
  lessonCache.delete(`${key}#${n}`);
  await courseCall({ action: 'course-report', key, n, reason });
}

// ---------------------------------------------------------------------------
// Progress
// ---------------------------------------------------------------------------

/** The lowest lesson not done yet (null when the course is finished). */
export function nextLessonNumber(state = getIntelState()): number | null {
  const a = state.active;
  if (!a) return null;
  const next = a.syllabus.find((s) => !a.done[String(s.n)]);
  return next ? next.n : null;
}

/** The lesson the daily directive covers today: the one already done today, else the next one. */
export function todaysDirectiveLesson(today: string, state = getIntelState()): number | null {
  const a = state.active;
  if (!a) return null;
  const doneToday = Object.entries(a.done).find(([, r]) => r.date === today && r.directive);
  return doneToday ? Number(doneToday[0]) : nextLessonNumber(state);
}

export function directiveDoneToday(today: string, state = getIntelState()): boolean {
  return Boolean(state.active && Object.values(state.active.done).some((r) => r.date === today && r.directive));
}

export function bonusLessonsToday(today: string, state = getIntelState()): number {
  return state.active ? Object.values(state.active.done).filter((r) => r.date === today && !r.directive).length : 0;
}

export type MasteryLevel = 'Novice' | 'Adept' | 'Expert' | 'Master';

export function masteryOf(state = getIntelState()): { level: MasteryLevel; done: number; total: number; accuracy: number } | null {
  const a = state.active;
  if (!a) return null;
  const records = Object.values(a.done);
  const done = records.length;
  const total = a.syllabus.length;
  const correct = records.reduce((s, r) => s + r.correct, 0);
  const asked = records.reduce((s, r) => s + r.total, 0);
  const accuracy = asked ? Math.round((correct / asked) * 100) : 0;
  const share = total ? done / total : 0;
  const level: MasteryLevel = share >= 1 && accuracy >= 70 ? 'Master' : share >= 0.6 ? 'Expert' : share >= 0.25 ? 'Adept' : 'Novice';
  return { level, done, total, accuracy };
}

export interface CompletionResult {
  state: IntelState;
  /** The course was just finished. */
  finished: boolean;
  mastered: boolean;
}

/**
 * Records a lesson. A lesson counts once (re-taking it does not add EXP or move progress).
 * Finishing the last lesson closes the course: mastered with ≥70% accuracy.
 */
export function recordLesson(
  n: number,
  correct: number,
  total: number,
  today: string,
  directive: boolean
): CompletionResult | null {
  const state = getIntelState();
  const a = state.active;
  if (!a || a.done[String(n)]) return null;
  const done = { ...a.done, [String(n)]: { date: today, correct, total, directive } };
  let next: IntelState = { ...state, active: { ...a, done } };
  const m = masteryOf(next)!;
  const finished = m.done >= m.total;
  const mastered = finished && m.accuracy >= 70;
  if (finished) {
    next = {
      active: next.active,
      mastered: mastered ? [...state.mastered, { key: a.key, niche: a.niche, date: today, accuracy: m.accuracy }] : state.mastered,
    };
  }
  saveIntelState(next);
  return { state: next, finished, mastered };
}

/** Review question from an earlier completed lesson (deterministic per day), or null. */
export function reviewLessonNumber(current: number, today: string, state = getIntelState()): number | null {
  const a = state.active;
  if (!a) return null;
  const earlier = Object.keys(a.done)
    .map(Number)
    .filter((n) => n < current)
    .sort((x, y) => x - y);
  if (earlier.length === 0) return null;
  const seed = today.split('-').reduce((s, p) => s + Number(p), 0) + current;
  return earlier[seed % earlier.length];
}
