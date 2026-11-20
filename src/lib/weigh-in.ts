/**
 * Weekly weigh-in: the scale closes the nutrition loop, the way benchmark tests close the
 * training loop. Each weigh-in updates the Hunter's body weight (so every target recalculates),
 * and once there are two weeks of data the System compares the real trend with what the goal
 * needs and corrects daily calories by 100 kcal at a time (max ±400), at most once every
 * two weeks so a correction has time to show. Read by getDayTargets (nutrition-lab.ts).
 */
import { calculateEnergyAndMacros, getTodayKey, resolveDietaryGoal, WEIGH_INS_KEY } from '@/lib/nutrition-lab';
import { DEFAULT_BODY_METRICS, getUserProfile, saveUserProfile } from '@/lib/storage';
import { requestSync } from '@/lib/sync-signal';
import type { DietaryGoal, UserProfile } from '@/lib/types';

export interface WeighIn {
  date: string;
  kg: number;
}

export interface WeighInState {
  entries: WeighIn[];
  /** Daily calorie correction from the trend (applied through carbs). */
  adjustKcal: number;
  /** goalTitle the correction was decided for; a goal change drops it. */
  adjustGoal: string;
  lastDecision?: { date: string; change: number; reason: string };
}

export type WeighInDecision = 'need-data' | 'on-track' | 'more' | 'less' | 'wait' | 'at-limit';

const STEP = 100;
const LIMIT = 400;
const DECISION_GAP_DAYS = 13;
const MIN_SPAN_DAYS = 13;

/** Healthy weekly change, % of body weight, per goal: [min, max]. */
const BANDS: Record<DietaryGoal, [number, number]> = {
  cut: [-1.0, -0.25],
  bulk: [0.1, 0.5],
  maintain: [-0.25, 0.25],
  recomp: [-0.35, 0.15],
};

const keyToTime = (k: string) => {
  const [y, m, d] = k.split('-').map(Number);
  return new Date(y, m - 1, d).getTime();
};
export const daysBetweenKeys = (a: string, b: string) => Math.round((keyToTime(b) - keyToTime(a)) / 86_400_000);

export const getWeighInState = (): WeighInState => {
  try {
    const v = JSON.parse(localStorage.getItem(WEIGH_INS_KEY) || 'null');
    if (v && Array.isArray(v.entries)) {
      return {
        entries: v.entries.filter((e: any) => e && typeof e.date === 'string' && Number.isFinite(Number(e.kg))).map((e: any) => ({ date: e.date, kg: Number(e.kg) })),
        adjustKcal: Number(v.adjustKcal) || 0,
        adjustGoal: typeof v.adjustGoal === 'string' ? v.adjustGoal : '',
        lastDecision: v.lastDecision,
      };
    }
  } catch {
    // ignore
  }
  return { entries: [], adjustKcal: 0, adjustGoal: '' };
};

const saveState = (s: WeighInState) => {
  try {
    localStorage.setItem(WEIGH_INS_KEY, JSON.stringify(s));
    requestSync();
  } catch {
    // ignore
  }
};

export const isWeighInDue = (state = getWeighInState(), today = getTodayKey()): boolean => {
  const last = state.entries[state.entries.length - 1];
  return !last || daysBetweenKeys(last.date, today) >= 7;
};

/** kg per week over the last ~5 weeks (needs at least two weeks of data). */
export const weeklyTrend = (entries: WeighIn[], today = getTodayKey()): { kgPerWeek: number; pctPerWeek: number; spanDays: number } | null => {
  const recent = entries.filter((e) => daysBetweenKeys(e.date, today) <= 35);
  if (recent.length < 2) return null;
  const first = recent[0];
  const last = recent[recent.length - 1];
  const spanDays = daysBetweenKeys(first.date, last.date);
  if (spanDays < MIN_SPAN_DAYS) return null;
  const kgPerWeek = ((last.kg - first.kg) / spanDays) * 7;
  return { kgPerWeek: Math.round(kgPerWeek * 100) / 100, pctPerWeek: (kgPerWeek / first.kg) * 100, spanDays };
};

export interface WeighInResult {
  state: WeighInState;
  profile: UserProfile;
  decision: WeighInDecision;
  change: number;
  message: string;
}

const GOAL_WORDS: Record<DietaryGoal, string> = { cut: 'losing fat', bulk: 'gaining', maintain: 'holding weight', recomp: 'recomposing' };

/** Records today's weight, updates the body data and, when the trend calls for it, the calories. */
export const logWeighIn = (kgInput: number, today = getTodayKey()): WeighInResult | null => {
  const kg = Math.round(Number(kgInput) * 10) / 10;
  if (!Number.isFinite(kg) || kg < 30 || kg > 250) return null;

  // Body data first: every target is recalculated from the new weight.
  const current = getUserProfile();
  const metrics = { ...DEFAULT_BODY_METRICS, ...(current.bodyMetrics || {}), weightKg: kg, lastUpdated: new Date().toISOString() };
  const profile: UserProfile = { ...current, bodyMetrics: metrics };
  saveUserProfile(profile);

  const prev = getWeighInState();
  const entries = [...prev.entries.filter((e) => e.date !== today), { date: today, kg }].sort((a, b) => a.date.localeCompare(b.date)).slice(-26);
  const goal = resolveDietaryGoal(metrics);
  const goalTitle = calculateEnergyAndMacros(metrics, profile.level).goalTitle;
  // A correction belongs to the goal it was made for.
  let adjustKcal = prev.adjustGoal === goalTitle ? prev.adjustKcal : 0;
  let lastDecision = prev.adjustGoal === goalTitle ? prev.lastDecision : undefined;

  const trend = weeklyTrend(entries, today);
  let decision: WeighInDecision = 'need-data';
  let change = 0;
  let message = 'Baseline recorded. Weigh in again next week: after two weeks the System reads your trend.';
  if (trend) {
    const [min, max] = BANDS[goal];
    const sign = trend.kgPerWeek > 0 ? '+' : '';
    const rate = `${sign}${trend.kgPerWeek} kg/week`;
    const want = trend.pctPerWeek < min ? STEP : trend.pctPerWeek > max ? -STEP : 0;
    if (want === 0) {
      decision = 'on-track';
      message = `Trend ${rate}: on track for ${GOAL_WORDS[goal]}. Calories unchanged.`;
    } else if (lastDecision && daysBetweenKeys(lastDecision.date, today) < DECISION_GAP_DAYS) {
      decision = 'wait';
      message = `Trend ${rate}. The last correction needs time to show; the System re-checks next week.`;
    } else if (Math.abs(adjustKcal + want) > LIMIT) {
      decision = 'at-limit';
      message = `Trend ${rate}. Calories are already corrected by ${adjustKcal > 0 ? '+' : ''}${adjustKcal} kcal (the limit). Re-calibrate your activity level if this continues.`;
    } else {
      change = want;
      adjustKcal += want;
      decision = want > 0 ? 'more' : 'less';
      lastDecision = { date: today, change: want, reason: rate };
      message =
        want > 0
          ? `Trend ${rate}: ${goal === 'cut' ? 'losing faster than is safe for muscle' : 'not gaining enough'}. +${STEP} kcal per day from today.`
          : `Trend ${rate}: ${goal === 'bulk' ? 'gaining faster than muscle can be built' : 'not losing as planned'}. -${STEP} kcal per day from today.`;
    }
  }

  const state: WeighInState = { entries, adjustKcal, adjustGoal: goalTitle, lastDecision };
  saveState(state);
  return { state, profile, decision, change, message };
};
