/**
 * Nutrition / Diet protocol for the Physical Training branch.
 * Plan generation goes through the existing AI gateway (`/api/ai`, providerOverride 'lab').
 * Persistence uses localStorage keys registered in synced-localstorage-keys.ts, so the
 * existing MongoDB `/api/sync` pipeline carries them across devices. No new backend.
 */
import { aiGatewayClient } from '@/lib/ai-gateway-client';
import type { UserProfile } from '@/lib/types';

export const NUTRITION_PLAN_KEY = 'wrp_nutrition_plan';
export const NUTRITION_LOG_KEY = 'wrp_nutrition_log';

export interface NutritionMeal {
  id: string;
  name: string;
  time: string;
  items: string[];
  calories: number;
  protein: number;
  notes?: string;
}

export interface NutritionPlan {
  date: string; // YYYY-MM-DD
  goal: string;
  calories: number;
  protein: number;
  carbs: number;
  fats: number;
  waterLiters: number;
  meals: NutritionMeal[];
  directive: string;
  origin: 'ai' | 'system';
  generatedAt: string;
}

export interface NutritionLog {
  date: string;
  mealsDone: string[];
  waterDone: boolean;
  claimed: boolean;
}

export const getTodayKey = (d = new Date()): string => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

export const getStoredNutritionPlan = (date = getTodayKey()): NutritionPlan | null => {
  try {
    const raw = localStorage.getItem(NUTRITION_PLAN_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as NutritionPlan;
    if (!parsed || parsed.date !== date || !Array.isArray(parsed.meals)) return null;
    return parsed;
  } catch {
    return null;
  }
};

export const NUTRITION_UPDATED_EVENT = 'wrp:nutrition-updated';

export const saveNutritionPlan = (plan: NutritionPlan): void => {
  try {
    localStorage.setItem(NUTRITION_PLAN_KEY, JSON.stringify(plan));
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent(NUTRITION_UPDATED_EVENT));
    }
  } catch {
    // ignore
  }
};

export const getNutritionLog = (date = getTodayKey()): NutritionLog => {
  try {
    const raw = localStorage.getItem(NUTRITION_LOG_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as NutritionLog;
      if (parsed?.date === date) {
        return {
          date,
          mealsDone: Array.isArray(parsed.mealsDone) ? parsed.mealsDone : [],
          waterDone: Boolean(parsed.waterDone),
          claimed: Boolean(parsed.claimed),
        };
      }
    }
  } catch {
    // ignore
  }
  return { date, mealsDone: [], waterDone: false, claimed: false };
};

export const saveNutritionLog = (log: NutritionLog): void => {
  try {
    localStorage.setItem(NUTRITION_LOG_KEY, JSON.stringify(log));
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent(NUTRITION_UPDATED_EVENT));
    }
  } catch {
    // ignore
  }
};

const slug = (s: string, i: number) =>
  `${s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'meal'}-${i}`;

const num = (v: unknown, fallback: number): number => {
  const n = typeof v === 'number' ? v : parseFloat(String(v ?? ''));
  return Number.isFinite(n) && n > 0 ? Math.round(n) : fallback;
};

const buildFallbackPlan = (date: string): NutritionPlan => ({
  date,
  goal: 'Lean muscle accretion',
  calories: 2600,
  protein: 165,
  carbs: 280,
  fats: 80,
  waterLiters: 3,
  origin: 'system',
  generatedAt: new Date().toISOString(),
  directive:
    'Muscle is built in the kitchen. Hit the protein floor before anything else, then fill remaining energy with whole carbohydrate sources.',
  meals: [
    {
      id: 'fuel-intake-0',
      name: 'Fuel Intake I',
      time: '08:00',
      items: ['4 eggs / omelette', 'Oats with milk', 'Banana'],
      calories: 650,
      protein: 40,
      notes: 'Break the overnight fast within 60 min of waking.',
    },
    {
      id: 'fuel-intake-1',
      name: 'Fuel Intake II',
      time: '13:00',
      items: ['Grilled chicken or tuna', 'Rice or pasta', 'Mixed vegetables', 'Olive oil'],
      calories: 850,
      protein: 55,
    },
    {
      id: 'pre-training-charge-2',
      name: 'Pre-Training Charge',
      time: '17:00',
      items: ['Greek yogurt', 'Dates or fruit', 'Handful of nuts'],
      calories: 400,
      protein: 25,
      notes: 'Consume 60-90 min before kinetic conditioning.',
    },
    {
      id: 'recovery-intake-3',
      name: 'Recovery Intake',
      time: '20:30',
      items: ['Lean red meat or fish', 'Potatoes or couscous', 'Salad'],
      calories: 700,
      protein: 45,
      notes: 'Post-session repair window.',
    },
  ],
});

interface AiNutritionResponse {
  goal?: string;
  calories?: number;
  protein?: number;
  carbs?: number;
  fats?: number;
  waterLiters?: number;
  directive?: string;
  meals?: Array<{
    name?: string;
    time?: string;
    items?: string[];
    calories?: number;
    protein?: number;
    notes?: string;
  }>;
}

const buildPrompt = (profile: UserProfile, context?: string): string => `
You are THEIA, the System's nutrition module for a hunter following a daily physical conditioning protocol.
Return ONLY valid JSON. No markdown.

HUNTER DATA:
- Level: ${profile.level}
- STR: ${profile.visibleStats?.STR ?? 10}, VIT: ${profile.visibleStats?.VIT ?? 10}, AGI: ${profile.visibleStats?.AGI ?? 10}
- Objective: muscular development and recovery support alongside daily training.
${context ? `- Hunter notes: ${context}` : ''}

Design ONE realistic day of eating (4 to 5 intakes), using affordable, common whole foods.
Halal-friendly: no pork, no alcohol.

JSON SHAPE:
{
  "goal": "short phrase",
  "calories": number,
  "protein": number,
  "carbs": number,
  "fats": number,
  "waterLiters": number,
  "directive": "one or two clinical sentences of dietary instruction",
  "meals": [
    { "name": "Fuel Intake I", "time": "08:00", "items": ["food 1", "food 2"], "calories": number, "protein": number, "notes": "optional short cue" }
  ]
}
`.trim();

export const generateNutritionPlan = async (
  profile: UserProfile,
  context?: string
): Promise<NutritionPlan> => {
  const date = getTodayKey();
  try {
    const res = await aiGatewayClient.completeJson<AiNutritionResponse>(buildPrompt(profile, context), {
      temperature: 0.5,
      maxTokens: 2500,
      providerOverride: 'lab',
    });

    const meals = (res?.meals || [])
      .filter((m) => m && m.name)
      .slice(0, 6)
      .map((m, i) => ({
        id: slug(String(m.name), i),
        name: String(m.name),
        time: String(m.time || ''),
        items: Array.isArray(m.items) ? m.items.map(String).filter(Boolean).slice(0, 8) : [],
        calories: num(m.calories, 500),
        protein: num(m.protein, 30),
        notes: m.notes ? String(m.notes) : undefined,
      }));

    if (meals.length < 2) throw new Error('Nutrition AI returned an incomplete plan');

    const plan: NutritionPlan = {
      date,
      goal: res.goal ? String(res.goal) : 'Lean muscle accretion',
      calories: num(res.calories, meals.reduce((a, m) => a + m.calories, 0)),
      protein: num(res.protein, meals.reduce((a, m) => a + m.protein, 0)),
      carbs: num(res.carbs, 260),
      fats: num(res.fats, 75),
      waterLiters: num(res.waterLiters, 3),
      directive: res.directive
        ? String(res.directive)
        : 'Protein floor first. Training without intake is wasted output.',
      meals,
      origin: 'ai',
      generatedAt: new Date().toISOString(),
    };
    saveNutritionPlan(plan);
    return plan;
  } catch (error) {
    console.warn('Nutrition lab AI failure, using system baseline plan', error);
    const fallback = buildFallbackPlan(date);
    saveNutritionPlan(fallback);
    return fallback;
  }
};

/** Load today's plan, generating one only when missing. */
export const loadOrGenerateNutritionPlan = async (profile: UserProfile): Promise<NutritionPlan> => {
  const existing = getStoredNutritionPlan();
  if (existing) return existing;
  return generateNutritionPlan(profile);
};
