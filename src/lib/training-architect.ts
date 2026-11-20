/**
 * THEIA Training Architect — turns a goal in the Hunter's own words ("pass the Navy SEAL drills",
 * "become like Green Arrow") into a real training program the app can run:
 *   - a weekly split built ONLY from the exercise library (so logging, progressive overload and
 *     record detection keep working), filtered to the Hunter's place and equipment;
 *   - phases over several weeks and benchmark tests, re-run every few weeks;
 *   - after a benchmark, THEIA can adjust the plan from the results.
 * Every AI answer is validated in code (unknown exercises dropped, day count, volume and rest
 * enforced). If THEIA is unreachable, a System baseline plan is built locally so the feature
 * always works.
 */
import { aiGatewayClient } from '@/lib/ai-gateway-client';
import { EXERCISE_LIBRARY, getExerciseById, type ExerciseDefinition } from '@/lib/exercise-library';
import {
  getHunterProtocolConfig,
  saveHunterProtocolConfig,
  getTodayKeyLocal,
  getHunterRank,
  getUserProfile,
  type CustomDayExercise,
  type CustomDayPlan,
} from '@/lib/storage';
import { createGate, guessAttributeFromText, type GateDuration } from '@/lib/gates';
import { requestSync } from '@/lib/sync-signal';
import { removeSyncedKey } from '@/lib/synced-deletions';

export const TRAINING_PROGRAM_KEY = 'wrp_training_program';
/** Fired on this device whenever the program changes (synced restores fire wrp:quests-updated). */
export const TRAINING_PROGRAM_EVENT = 'wrp:training-program-updated';

export type TrainingPlace = 'gym' | 'home';
export type TrainingGear = 'bands' | 'dumbbells' | 'kettlebell' | 'pullup-bar' | 'pool';
export type TrainingLevel = 'beginner' | 'intermediate' | 'advanced';

export interface TrainingBrief {
  goal: string;
  daysPerWeek: number;
  minutesPerSession: number;
  place: TrainingPlace;
  gear: TrainingGear[];
  level: TrainingLevel;
  limits: string;
}

export interface Benchmark {
  id: string;
  name: string;
  unit: string;
  how: string;
  better: 'higher' | 'lower';
}

export interface ProgramPhase {
  name: string;
  weeks: number;
  focus: string;
}

export interface BenchmarkResult {
  date: string;
  values: Record<string, number>;
}

export interface TrainingProgram {
  id: string;
  goal: string;
  translation: string;
  brief: TrainingBrief;
  phases: ProgramPhase[];
  benchmarks: Benchmark[];
  retestEveryWeeks: number;
  totalWeeks: number;
  startDate: string;
  split: Record<number, CustomDayPlan>;
  results: BenchmarkResult[];
  gateId?: string;
  source: 'ai' | 'system';
  createdAt: string;
}

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
/** Training days per week -> weekday indices (0 = Sunday), rest spread between sessions. */
const DAY_LAYOUT: Record<number, number[]> = {
  2: [1, 4],
  3: [1, 3, 5],
  4: [1, 2, 4, 5],
  5: [1, 2, 3, 5, 6],
  6: [1, 2, 3, 4, 5, 6],
};

const BAR_IDS = new Set(['weighted-pull-ups', 'chin-ups', 'inverted-rows', 'hanging-leg-raises', 'dead-hang']);
const DIP_STATION_IDS = new Set(['chest-dips', 'parallel-bar-dips-tricep']);
const GYM_ONLY_EXTRAS = new Set(['battle-ropes', 'svend-press', 'stability-ball-leg-curl', 'foam-rolling-full', 'ab-wheel-rollout', 'jump-rope-conditioning']);

/** The exercises this Hunter can actually do, given where they train and what they own. */
export function allowedExercises(brief: Pick<TrainingBrief, 'place' | 'gear'>): ExerciseDefinition[] {
  const gear = new Set(brief.gear);
  return EXERCISE_LIBRARY.filter((e) => {
    if (e.id === 'swimming-laps') return gear.has('pool');
    if (brief.place === 'gym') return true;
    // home
    if (BAR_IDS.has(e.id)) return gear.has('pullup-bar');
    if (DIP_STATION_IDS.has(e.id) || GYM_ONLY_EXTRAS.has(e.id)) return false;
    if (e.id === 'rucking') return true; // a backpack
    switch (e.equipment) {
      case 'Bodyweight':
        return true;
      case 'Bands / Other':
        return gear.has('bands');
      case 'Dumbbell':
        return gear.has('dumbbells');
      case 'Kettlebell':
        return gear.has('kettlebell') || (e.id === 'goblet-squats' && gear.has('dumbbells'));
      default:
        return false; // barbell, cable, machine, cardio machines
    }
  });
}

// ---------------------------------------------------------------------------------------------
// Storage
// ---------------------------------------------------------------------------------------------

export function getTrainingProgram(): TrainingProgram | null {
  try {
    const v = JSON.parse(localStorage.getItem(TRAINING_PROGRAM_KEY) || 'null');
    return v && typeof v === 'object' && v.id && v.split ? (v as TrainingProgram) : null;
  } catch {
    return null;
  }
}

function saveTrainingProgram(program: TrainingProgram | null): void {
  try {
    if (program) localStorage.setItem(TRAINING_PROGRAM_KEY, JSON.stringify(program));
    else removeSyncedKey(TRAINING_PROGRAM_KEY);
    requestSync();
    window.dispatchEvent(new CustomEvent(TRAINING_PROGRAM_EVENT));
  } catch {
    // ignore
  }
}

// ---------------------------------------------------------------------------------------------
// Program clock
// ---------------------------------------------------------------------------------------------

const dayKeyToDate = (key: string) => {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
};
const daysBetween = (a: string, b: string) => Math.round((dayKeyToDate(b).getTime() - dayKeyToDate(a).getTime()) / 86_400_000);

export function programWeek(program: TrainingProgram, today = getTodayKeyLocal()): number {
  return Math.max(1, Math.floor(daysBetween(program.startDate, today) / 7) + 1);
}

export function currentPhase(program: TrainingProgram, today = getTodayKeyLocal()): ProgramPhase | null {
  let week = programWeek(program, today);
  for (const ph of program.phases) {
    if (week <= ph.weeks) return ph;
    week -= ph.weeks;
  }
  return null; // program finished
}

/** A benchmark is due at the start (baseline) and then every `retestEveryWeeks` weeks. */
export function benchmarkDue(program: TrainingProgram, today = getTodayKeyLocal()): boolean {
  const last = program.results[program.results.length - 1];
  if (!last) return true;
  return daysBetween(last.date, today) >= program.retestEveryWeeks * 7;
}

export function recordBenchmark(values: Record<string, number>): TrainingProgram | null {
  const program = getTrainingProgram();
  if (!program) return null;
  const today = getTodayKeyLocal();
  const clean: Record<string, number> = {};
  for (const b of program.benchmarks) {
    const v = Number(values[b.id]);
    if (Number.isFinite(v) && v >= 0) clean[b.id] = Math.round(v * 100) / 100;
  }
  if (Object.keys(clean).length === 0) return program;
  const results = program.results.filter((r) => r.date !== today);
  const next = { ...program, results: [...results, { date: today, values: clean }].slice(-24) };
  saveTrainingProgram(next);
  return next;
}

export function endTrainingProgram(): void {
  saveTrainingProgram(null);
}

// ---------------------------------------------------------------------------------------------
// Generation
// ---------------------------------------------------------------------------------------------

const clampInt = (v: unknown, min: number, max: number, dflt: number) => {
  const n = Math.round(Number(v));
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : dflt;
};
const cleanText = (v: unknown, max: number) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
const slug = (s: string) =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || `b-${Math.random().toString(36).slice(2, 7)}`;

function toDayExercise(def: ExerciseDefinition, raw?: any): CustomDayExercise {
  const isTimed = def.kind !== 'strength';
  const reps = cleanText(raw?.reps, 24);
  return {
    id: def.id,
    name: def.name,
    kind: def.kind,
    targetSets: clampInt(raw?.sets, 1, 6, def.defaultSets),
    targetReps: reps || def.defaultReps,
    targetMinutes: isTimed ? clampInt(raw?.minutes, 1, 90, def.defaultMinutes || 10) : undefined,
    category: def.category,
  };
}

const exercisesPerSession = (minutes: number) => Math.min(7, Math.max(4, Math.round(minutes / 9)));

/** Local, deterministic plan used when THEIA can't be reached (and to fill missing days). */
function baselineDay(dayIndex: number, slot: number, brief: TrainingBrief, allowed: ExerciseDefinition[]): CustomDayPlan {
  const blocks: Array<{ focus: string; cats: string[] }> = [
    { focus: 'Upper Body (Push & Pull)', cats: ['Chest', 'Back', 'Shoulders', 'Back', 'Triceps', 'Biceps', 'Core'] },
    { focus: 'Lower Body & Core', cats: ['Quads', 'Hamstrings', 'Glutes', 'Calves', 'Core', 'Quads', 'Core'] },
    { focus: 'Conditioning & Mobility', cats: ['Cardio', 'Core', 'Cardio', 'Mobility', 'Glutes', 'Mobility', 'Core'] },
  ];
  const block = blocks[slot % blocks.length];
  const n = exercisesPerSession(brief.minutesPerSession);
  const used = new Set<string>();
  const picks: CustomDayExercise[] = [];
  for (const cat of block.cats) {
    if (picks.length >= n) break;
    const pool = allowed.filter((e) => e.category === cat && !used.has(e.id));
    if (pool.length === 0) continue;
    const def = pool[(slot * 3 + picks.length) % pool.length];
    used.add(def.id);
    picks.push(toDayExercise(def));
  }
  return { dayIndex, dayName: DAY_NAMES[dayIndex], focus: block.focus, isRestDay: picks.length === 0, exercises: picks };
}

const restDay = (dayIndex: number): CustomDayPlan => ({ dayIndex, dayName: DAY_NAMES[dayIndex], focus: 'Rest & Recovery', isRestDay: true, exercises: [] });

function baselineProgram(brief: TrainingBrief): Omit<TrainingProgram, 'id' | 'startDate' | 'results' | 'createdAt'> {
  const allowed = allowedExercises(brief);
  const days = DAY_LAYOUT[brief.daysPerWeek] || DAY_LAYOUT[3];
  const split: Record<number, CustomDayPlan> = {};
  for (let d = 0; d < 7; d++) split[d] = restDay(d);
  days.forEach((d, i) => (split[d] = baselineDay(d, i, brief, allowed)));
  return {
    goal: brief.goal,
    translation: `A balanced base of strength, endurance and mobility toward: ${brief.goal}`,
    brief,
    phases: [
      { name: 'Foundation', weeks: 3, focus: 'Technique and a steady routine' },
      { name: 'Build', weeks: 3, focus: 'More volume and harder variations' },
      { name: 'Peak', weeks: 2, focus: 'Intensity, then the final test' },
    ],
    benchmarks: [
      { id: 'max-push-ups', name: 'Max push-ups (one set)', unit: 'reps', how: 'Strict form, chest to fist height, stop when form breaks.', better: 'higher' },
      { id: 'plank-hold', name: 'Plank hold', unit: 'seconds', how: 'Forearms down, straight line from head to heels.', better: 'higher' },
      { id: 'squats-60s', name: 'Bodyweight squats in 60 s', unit: 'reps', how: 'Full depth, stand fully up each rep.', better: 'higher' },
    ],
    retestEveryWeeks: 3,
    totalWeeks: 8,
    split,
    source: 'system',
  };
}

function buildPrompt(brief: TrainingBrief, allowed: ExerciseDefinition[], previous?: TrainingProgram): string {
  const catalog = allowed.map((e) => `${e.id}|${e.name}|${e.category}|${e.kind}`).join('\n');
  const prev = previous
    ? `\nThis is an ADJUSTMENT of the Hunter's current program "${previous.translation}" (week ${programWeek(previous)} of ${previous.totalWeeks}).
Benchmark history (oldest first): ${JSON.stringify(previous.results.map((r) => ({ date: r.date, ...r.values })))}
Benchmarks: ${previous.benchmarks.map((b) => `${b.id} = ${b.name} (${b.unit}, ${b.better} is better)`).join('; ')}
Make the plan harder where results improved, keep or ease where they stalled or dropped. Keep the same benchmark ids.\n`
    : '';
  return `
Role: THEIA, the System's training architect. The "Hunter/System" framing is this app's theme; the Hunter is a
REAL person and everything must be real, safe training — no fantasy mechanics.

The Hunter's goal, in their own words: "${brief.goal}"
Training days per week: ${brief.daysPerWeek}. Minutes per session: ${brief.minutesPerSession}. Level: ${brief.level}.
Where: ${brief.place === 'gym' ? 'a gym' : `home (equipment: ${brief.gear.length ? brief.gear.join(', ') : 'none'})`}.
Injuries / limits to respect: ${brief.limits || 'none stated'}.
${prev}
1. TRANSLATE the goal into the real physical capacities it needs. A real test (e.g. a military fitness test) means
   its actual components; a fictional character means the real-world abilities they show (e.g. an archer hero:
   pulling strength, grip, shoulder endurance, agility, sprinting, rotational core). One short sentence.
2. DESIGN one training week with EXACTLY ${brief.daysPerWeek} training days and the other days as rest. Use day
   numbers 0-6 (0 = Sunday, 1 = Monday ... 6 = Saturday) and spread rest between hard days. Each session must fit
   ${brief.minutesPerSession} minutes: 4-7 exercises. Use ONLY exercise ids from the catalog below. Avoid anything
   that conflicts with the injuries/limits.
3. PHASES: 2-4 phases totalling 6-12 weeks (name, weeks, focus).
4. BENCHMARKS: 3-5 measurable tests that show progress toward the goal, doable with the Hunter's equipment
   (name, unit such as reps/seconds/minutes/meters, how to do it in one sentence, better = "higher" or "lower").
   Retest every 2-4 weeks.

Catalog (id|name|category|kind):
${catalog}

Return ONLY valid JSON (no markdown):
{"translation":"...","phases":[{"name":"Foundation","weeks":3,"focus":"..."}],"benchmarks":[{"id":"max-pull-ups","name":"Max pull-ups","unit":"reps","how":"...","better":"higher"}],"retestEveryWeeks":3,"days":[{"day":1,"focus":"...","exercises":[{"id":"...","sets":4,"reps":"8-10","minutes":0}]}]}
`.trim();
}

/** Validates THEIA's answer against the library, the day count and the volume rules. */
export function normalizeProgram(raw: any, brief: TrainingBrief, previous?: TrainingProgram): Omit<TrainingProgram, 'id' | 'startDate' | 'results' | 'createdAt'> | null {
  if (!raw || typeof raw !== 'object') return null;
  const allowed = allowedExercises(brief);
  const allowedIds = new Set(allowed.map((e) => e.id));
  const split: Record<number, CustomDayPlan> = {};
  for (let d = 0; d < 7; d++) split[d] = restDay(d);

  const rawDays: any[] = Array.isArray(raw.days) ? raw.days : [];
  const trainingDays: number[] = [];
  for (const rd of rawDays) {
    const d = Number(rd?.day);
    if (!Number.isInteger(d) || d < 0 || d > 6 || trainingDays.includes(d)) continue;
    const seen = new Set<string>();
    const exercises: CustomDayExercise[] = [];
    for (const rx of Array.isArray(rd?.exercises) ? rd.exercises : []) {
      const id = String(rx?.id || '');
      if (!allowedIds.has(id) || seen.has(id)) continue;
      const def = getExerciseById(id);
      if (!def) continue;
      seen.add(id);
      exercises.push(toDayExercise(def, rx));
      if (exercises.length >= 8) break;
    }
    if (exercises.length === 0) continue;
    if (trainingDays.length >= brief.daysPerWeek) break; // never more sessions than asked for
    trainingDays.push(d);
    split[d] = { dayIndex: d, dayName: DAY_NAMES[d], focus: cleanText(rd?.focus, 60) || 'Training', isRestDay: false, exercises };
  }
  if (trainingDays.length === 0) return null;
  // Too few usable days: fill from the layout with baseline sessions.
  const layout = DAY_LAYOUT[brief.daysPerWeek] || DAY_LAYOUT[3];
  let slot = trainingDays.length;
  for (const d of layout) {
    if (trainingDays.length >= brief.daysPerWeek) break;
    if (trainingDays.includes(d)) continue;
    split[d] = baselineDay(d, slot++, brief, allowed);
    if (!split[d].isRestDay) trainingDays.push(d);
  }

  const phases: ProgramPhase[] = (Array.isArray(raw.phases) ? raw.phases : [])
    .map((p: any) => ({ name: cleanText(p?.name, 30), weeks: clampInt(p?.weeks, 1, 6, 2), focus: cleanText(p?.focus, 120) }))
    .filter((p: ProgramPhase) => p.name)
    .slice(0, 4);
  const finalPhases = phases.length ? phases : baselineProgram(brief).phases;

  const prevIds = new Set((previous?.benchmarks || []).map((b) => b.id));
  const benchmarks: Benchmark[] = (Array.isArray(raw.benchmarks) ? raw.benchmarks : [])
    .map((b: any) => {
      const name = cleanText(b?.name, 60);
      const rawId = slug(String(b?.id || name));
      return {
        id: prevIds.size && previous ? (previous.benchmarks.find((x) => x.id === rawId)?.id ?? rawId) : rawId,
        name,
        unit: cleanText(b?.unit, 16) || 'reps',
        how: cleanText(b?.how, 160),
        better: b?.better === 'lower' ? 'lower' : 'higher',
      } as Benchmark;
    })
    .filter((b: Benchmark) => b.name)
    .filter((b: Benchmark, i: number, arr: Benchmark[]) => arr.findIndex((x) => x.id === b.id) === i)
    .slice(0, 5);

  return {
    goal: brief.goal,
    translation: cleanText(raw.translation, 240) || `Training toward: ${brief.goal}`,
    brief,
    phases: finalPhases,
    // An adjustment keeps tracking the same tests, so progress stays comparable.
    benchmarks: previous ? previous.benchmarks : benchmarks.length >= 2 ? benchmarks : baselineProgram(brief).benchmarks,
    retestEveryWeeks: clampInt(raw.retestEveryWeeks, 2, 4, 3),
    totalWeeks: finalPhases.reduce((s, p) => s + p.weeks, 0),
    split,
    source: 'ai',
  };
}

export function normalizeBrief(b: Partial<TrainingBrief>): TrainingBrief {
  return {
    goal: cleanText(b.goal, 200),
    daysPerWeek: clampInt(b.daysPerWeek, 2, 6, 3),
    minutesPerSession: clampInt(b.minutesPerSession, 20, 120, 45),
    place: b.place === 'gym' ? 'gym' : 'home',
    gear: (Array.isArray(b.gear) ? b.gear : []).filter((g): g is TrainingGear => ['bands', 'dumbbells', 'kettlebell', 'pullup-bar', 'pool'].includes(g)),
    level: b.level === 'intermediate' || b.level === 'advanced' ? b.level : 'beginner',
    limits: cleanText(b.limits, 160),
  };
}

/** Asks THEIA for a program (or an adjustment of `previous`). Never throws: falls back locally. */
export async function designProgram(briefIn: Partial<TrainingBrief>, previous?: TrainingProgram): Promise<TrainingProgram> {
  const brief = normalizeBrief(briefIn);
  const base = {
    id: previous?.id || `prog-${Date.now().toString(36)}`,
    startDate: previous?.startDate || getTodayKeyLocal(),
    results: previous?.results || [],
    gateId: previous?.gateId,
    createdAt: previous?.createdAt || new Date().toISOString(),
  };
  try {
    const raw = await aiGatewayClient.completeJson<any>(buildPrompt(brief, allowedExercises(brief), previous), {
      temperature: 0.5,
      maxTokens: 3500,
      thinkingBudget: 0,
      providerOverride: 'lab',
      maxRetries: 1,
    });
    const program = normalizeProgram(raw, brief, previous);
    if (program) return { ...base, ...program };
  } catch (e) {
    console.warn('[Training Architect] THEIA unreachable, building a System baseline plan:', e);
  }
  const fallback = baselineProgram(brief);
  return { ...base, ...fallback, benchmarks: previous ? previous.benchmarks : fallback.benchmarks };
}

/** Another exercise of the same category the Hunter can do, not already in that day. */
export function swapExercise(program: TrainingProgram, dayIndex: number, exerciseIndex: number): TrainingProgram {
  const day = program.split[dayIndex];
  const current = day?.exercises[exerciseIndex];
  if (!day || !current) return program;
  const def = getExerciseById(current.id || '');
  const inDay = new Set(day.exercises.map((e) => e.id));
  const pool = allowedExercises(program.brief).filter((e) => e.category === (def?.category || current.category) && !inDay.has(e.id));
  if (pool.length === 0) return program;
  const next = pool[Math.floor(Math.random() * pool.length)];
  const exercises = day.exercises.map((e, i) => (i === exerciseIndex ? toDayExercise(next, { sets: e.targetSets }) : e));
  return { ...program, split: { ...program.split, [dayIndex]: { ...day, exercises } } };
}

const durationForWeeks = (weeks: number): GateDuration => (weeks <= 4 ? '2-4w' : weeks <= 12 ? '1-3m' : '3-6m');

/**
 * Makes the program the Hunter's training plan. The plan it replaces is kept as a saved template
 * (nothing is lost). Optionally opens a Gate for the goal: its Waves are the phases, its Boss
 * condition the final benchmark test.
 */
export function acceptProgram(program: TrainingProgram, options: { openGate?: boolean } = {}): TrainingProgram {
  const config = getHunterProtocolConfig();
  const templates = [...(config.savedCustomTemplates || [])];
  const hasCustom = Object.values(config.customWeeklySplit || {}).some((d) => d && !d.isRestDay && d.exercises?.length);
  if (config.physicalPath === 'custom' && hasCustom) {
    templates.push({
      id: `before-theia-${Date.now().toString(36)}`,
      name: `Before THEIA plan (${getTodayKeyLocal()})`,
      savedAt: new Date().toISOString(),
      weeklySplit: config.customWeeklySplit,
    });
  }
  saveHunterProtocolConfig({
    ...config,
    physicalPath: 'custom',
    selectedTemplateId: undefined,
    customWeeklySplit: program.split,
    savedCustomTemplates: templates.slice(-12),
    calibratedAt: new Date().toISOString(),
  });

  let gateId = program.gateId;
  if (options.openGate && !gateId) {
    const milestones = program.phases.map((p) => ({ label: `${p.name}: ${p.focus}`.slice(0, 150) }));
    if (milestones.length < 2) milestones.push({ label: 'Final benchmark test' });
    const gate = createGate({
      title: program.goal.slice(0, 80),
      description: program.translation,
      rank: getHunterRank(getUserProfile().level),
      bossCondition: `Beat your first scores on the final benchmark test: ${program.benchmarks.map((b) => b.name).join(', ')}.`.slice(0, 300),
      primaryAttribute: guessAttributeFromText(`${program.goal} ${program.translation}`, 'STR'),
      milestones,
      duration: durationForWeeks(program.totalWeeks),
      chainCategory: 'skill',
    });
    gateId = gate.id;
  }
  const saved = { ...program, gateId };
  saveTrainingProgram(saved);
  return saved;
}
