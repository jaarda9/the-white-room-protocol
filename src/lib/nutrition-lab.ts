/**
 * Nutrition / Diet protocol for the Physical Training branch.
 * Biometrically calibrated to player's weight, height, and IMC (BMI).
 * Deterministic sports science energy engine + ultra-lean AI prompt (token minimized).
 */
import { aiGatewayClient } from '@/lib/ai-gateway-client';
import { removeSyncedKey } from '@/lib/synced-deletions';
import type { UserProfile, UserBodyMetrics, DietaryGoal } from '@/lib/types';
import { DEFAULT_BODY_METRICS, getPhysicalDayPlan } from '@/lib/storage';
import { requestSync } from '@/lib/sync-signal';
import { deviceTimeZone, regionFromTimeZone } from '@/lib/region-from-timezone';

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

export interface PlanBiometricsSnapshot {
  weightKg: number;
  heightCm: number;
  imc: number;
  imcCategory: string;
  goal: string;
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
  biometrics?: PlanBiometricsSnapshot;
  /** For origin 'ai': whether this was served with the player's own Gemini key or the shared System key. */
  keySource?: 'user' | 'shared';
  /** Set when today's meals come from the weekly plan (nutrition-week.ts). */
  weekId?: string;
  dayType?: DayType;
}

export interface NutritionLog {
  date: string;
  mealsDone: string[];
  waterDone: boolean;
  claimed: boolean;
  /** Meal ids that have already paid out per-item XP today (prevents re-earning via uncheck/recheck). */
  rewardedMealIds: string[];
  /** Whether the hydration item has already paid out per-item XP today. */
  waterRewarded: boolean;
  /** THEIA photo analyses logged today (nutrition-intake-scan.ts). The photo itself is never stored. */
  scans?: IntakeScan[];
  /** Meal ids that already paid the photo-verification bonus today. */
  verifiedMealIds?: string[];
  /** Analyses attempted today, successful or not — enforces the daily analysis cap. */
  scanAttempts?: number;
}

export type IntakeGrade = 'S' | 'A' | 'B' | 'C';

export interface IntakeScan {
  id: string;
  /** Planned checkpoint this photo verified, or null for an off-plan intake. */
  mealId: string | null;
  at: string;
  foods: string[];
  calories: [number, number];
  protein: [number, number];
  confidence: 'low' | 'medium' | 'high';
  /** Only for a planned checkpoint: graded against that checkpoint and the dietary goal. */
  grade?: IntakeGrade;
  verdict: string;
  bonusXp: number;
}

export interface ImcResult {
  imc: number;
  category: 'underweight' | 'normal' | 'overweight' | 'obese';
  label: string;
  color: string;
  badgeBg: string;
  description: string;
}

export interface CalculatedNutritionTargets {
  weightKg: number;
  heightCm: number;
  bmr: number;
  tdee: number;
  calories: number;
  protein: number;
  carbs: number;
  fats: number;
  waterLiters: number;
  goalTitle: string;
  directive: string;
}

export const getTodayKey = (d = new Date()): string => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

// ---------------------------------------------------------------------------------------------
// Food profile — asked once, the first time the Hunter plans a week (just-in-time, never at
// sign-up). Feeds every THEIA meal prompt; nutrition-week.ts also enforces it in code.
// ---------------------------------------------------------------------------------------------

export const FOOD_PROFILE_KEY = 'wrp_food_profile';
export type DietStyle = 'any' | 'vegetarian' | 'vegan' | 'pescatarian';
export interface FoodProfile {
  halal: boolean;
  diet: DietStyle;
  allergies: string;
  dislikes: string;
  budget: 'tight' | 'normal' | 'flexible';
  cookTime: 'quick' | 'normal' | 'enjoy';
  savedAt: string;
}

/** Halal by default: every meal prompt asked for halal food before profiles existed. */
export const DEFAULT_FOOD_PROFILE: FoodProfile = {
  halal: true,
  diet: 'any',
  allergies: '',
  dislikes: '',
  budget: 'normal',
  cookTime: 'normal',
  savedAt: '',
};

export const normalizeFoodProfile = (v: Partial<FoodProfile>): FoodProfile => {
  const clean = (x: unknown) => String(x ?? '').replace(/\s+/g, ' ').trim().slice(0, 120);
  const diets: DietStyle[] = ['any', 'vegetarian', 'vegan', 'pescatarian'];
  return {
    halal: v.halal !== false,
    diet: diets.includes(v.diet as DietStyle) ? (v.diet as DietStyle) : 'any',
    allergies: clean(v.allergies),
    dislikes: clean(v.dislikes),
    budget: v.budget === 'tight' || v.budget === 'flexible' ? v.budget : 'normal',
    cookTime: v.cookTime === 'quick' || v.cookTime === 'enjoy' ? v.cookTime : 'normal',
    savedAt: typeof v.savedAt === 'string' ? v.savedAt : '',
  };
};

export const getFoodProfile = (): FoodProfile | null => {
  try {
    const v = JSON.parse(localStorage.getItem(FOOD_PROFILE_KEY) || 'null');
    return v && typeof v === 'object' ? normalizeFoodProfile(v) : null;
  } catch {
    return null;
  }
};

export const saveFoodProfile = (v: Partial<FoodProfile>): FoodProfile => {
  const profile = { ...normalizeFoodProfile(v), savedAt: new Date().toISOString() };
  try {
    localStorage.setItem(FOOD_PROFILE_KEY, JSON.stringify(profile));
    requestSync();
  } catch {
    // ignore
  }
  return profile;
};

/** The food rules every meal prompt states. */
export const foodRulesForPrompt = (food: FoodProfile | null): string => {
  const f = food || DEFAULT_FOOD_PROFILE;
  const rules: string[] = [];
  if (f.halal) rules.push('halal only (no pork, no alcohol in cooking)');
  if (f.diet !== 'any') rules.push(f.diet);
  if (f.allergies) rules.push(`ALLERGIES, never include: ${f.allergies}`);
  if (f.dislikes) rules.push(`avoid (dislikes): ${f.dislikes}`);
  if (food) {
    rules.push(`budget: ${f.budget === 'tight' ? 'tight, cheap staples' : f.budget === 'flexible' ? 'flexible' : 'normal'}`);
    rules.push(`cooking time: ${f.cookTime === 'quick' ? 'max ~15 min per meal' : f.cookTime === 'enjoy' ? 'happy to cook' : 'up to ~30 min per meal'}`);
  }
  return rules.join('; ');
};

/** The Hunter's THEIA training program goal, if any (read raw to keep this module standalone). */
export const getTrainingGoalForNutrition = (): string => {
  try {
    const p = JSON.parse(localStorage.getItem('wrp_training_program') || 'null');
    if (!p || typeof p.goal !== 'string') return '';
    return `${p.goal}${p.translation ? ` (${String(p.translation).slice(0, 160)})` : ''}`;
  } catch {
    return '';
  }
};

// ---------------------------------------------------------------------------------------------
// Training-aware targets: training days get more carbs, rest days fewer; the weekly total stays
// what the goal needs. Protein and fats never move.
// ---------------------------------------------------------------------------------------------

export type DayType = 'training' | 'rest';

export const dayTypeFor = (date: Date): DayType => {
  try {
    return getPhysicalDayPlan(date).isRestDay ? 'rest' : 'training';
  } catch {
    return 'training';
  }
};

export interface DayTargets extends CalculatedNutritionTargets {
  dayType: DayType;
  /** Carbs moved vs the flat target: + on training days, - on rest days, 0 with no rest days. */
  carbShift: number;
}

// ---------------------------------------------------------------------------------------------
// Weekly weigh-in trend (weigh-in.ts writes it): a calorie correction when the scale says the
// plan isn't working. It only applies to the goal it was decided for.
// ---------------------------------------------------------------------------------------------

export const WEIGH_INS_KEY = 'wrp_weigh_ins';

export const getTrendAdjustment = (goalTitle: string): number => {
  try {
    const v = JSON.parse(localStorage.getItem(WEIGH_INS_KEY) || 'null');
    const kcal = Number(v?.adjustKcal) || 0;
    return v && v.adjustGoal === goalTitle ? Math.max(-400, Math.min(400, kcal)) : 0;
  } catch {
    return 0;
  }
};

/** Applies the weigh-in correction through carbs (protein and fats untouched, carbs >= 90 g). */
export const applyTrendAdjustment = (base: CalculatedNutritionTargets): CalculatedNutritionTargets => {
  const kcal = getTrendAdjustment(base.goalTitle);
  if (!kcal) return base;
  const carbs = Math.max(90, base.carbs + Math.round(kcal / 4));
  return { ...base, carbs, calories: base.calories + (carbs - base.carbs) * 4 };
};

export const getDayTargets = (rawBase: CalculatedNutritionTargets, date: Date = new Date()): DayTargets => {
  const base = applyTrendAdjustment(rawBase);
  const dayType = dayTypeFor(date);
  let rest = 0;
  for (let i = 0; i < 7; i++) {
    if (dayTypeFor(new Date(date.getFullYear(), date.getMonth(), date.getDate() + i)) === 'rest') rest++;
  }
  const training = 7 - rest;
  if (rest === 0 || training === 0) return { ...base, dayType, carbShift: 0 };
  let up = Math.round((base.carbs * 0.15) / 5) * 5;
  let down = Math.round((up * training) / rest / 5) * 5;
  if (base.carbs - down < 90) {
    down = Math.max(0, Math.floor((base.carbs - 90) / 5) * 5);
    up = Math.round((down * rest) / training / 5) * 5;
  }
  const shift = dayType === 'training' ? up : -down;
  return { ...base, carbs: base.carbs + shift, calories: base.calories + shift * 4, dayType, carbShift: shift };
};

/**
 * Best-effort region guess, no permission prompt and no network call: the device's time zone
 * first (where the device actually is), then the language setting (which often points to the
 * wrong country: a French-language phone in Morocco resolves to France). Pre-fills the Region
 * field and stands in for it while the Hunter hasn't saved one. '' when nothing usable.
 */
export const guessRegionFromLocale = (): string => {
  const fromZone = regionFromTimeZone(deviceTimeZone());
  if (fromZone) return fromZone;
  try {
    const locale =
      (typeof navigator !== 'undefined' && (navigator.languages?.[0] || navigator.language)) || '';
    if (!locale) return '';

    let regionCode: string | undefined;
    try {
      // Intl.Locale#maximize resolves e.g. "fr" -> region "FR" using likely-subtags data.
      regionCode = new Intl.Locale(locale).maximize().region;
    } catch {
      regionCode = locale.match(/-([A-Za-z]{2})$/)?.[1]?.toUpperCase();
    }
    if (!regionCode) return '';

    try {
      return new Intl.DisplayNames(['en'], { type: 'region' }).of(regionCode) || regionCode;
    } catch {
      return regionCode;
    }
  } catch {
    return '';
  }
};

/** The region THEIA uses: what the Hunter saved, else the device's best guess. */
export const regionFor = (metrics?: Partial<UserBodyMetrics> | null): string =>
  (metrics?.country || '').trim() || guessRegionFromLocale();

/**
 * Calculates Body Mass Index (IMC) and returns clinical Solo Leveling system classification.
 */
export const calculateIMC = (weightKg: number, heightCm: number): ImcResult => {
  const safeWeight = Math.max(30, Math.min(250, Number(weightKg) || 70));
  const safeHeight = Math.max(100, Math.min(250, Number(heightCm) || 175));
  const heightM = safeHeight / 100;
  const rawImc = safeWeight / (heightM * heightM);
  const imc = Math.round(rawImc * 10) / 10;

  if (imc < 18.5) {
    return {
      imc,
      category: 'underweight',
      label: 'UNDERWEIGHT',
      color: '#38bdf8',
      badgeBg: 'rgba(56, 189, 248, 0.15)',
      description:
        'Mass accretion protocol priority. Caloric surplus recommended to build bone density and foundational muscular mass.',
    };
  }
  if (imc < 25.0) {
    return {
      imc,
      category: 'normal',
      label: 'OPTIMAL / NORMAL',
      color: '#34d399',
      badgeBg: 'rgba(52, 211, 153, 0.15)',
      description:
        'Optimal physiological balance. High-performance nutrient partitioning to sustain kinetic conditioning.',
    };
  }
  if (imc < 30.0) {
    return {
      imc,
      category: 'overweight',
      label: 'HEAVY / OVERWEIGHT',
      color: '#fbbf24',
      badgeBg: 'rgba(251, 191, 36, 0.15)',
      description:
        'Body recomposition priority. Elevated protein floor to protect contractile tissue while moderating energy surplus.',
    };
  }
  return {
    imc,
    category: 'obese',
    label: 'HIGH ADIPOSITY',
    color: '#f87171',
    badgeBg: 'rgba(248, 113, 113, 0.15)',
    description:
      'Controlled deficit protocol. High-satiety, micronutrient-dense whole foods to optimize metabolic recovery.',
  };
};

/**
 * Calculates BMR (Mifflin-St Jeor), TDEE, and precise macronutrient targets.
 * Deterministic calculation prevents random AI hallucinated macros.
 */
/** The goal the targets are actually built for: the declared one, else inferred from IMC. */
export const resolveDietaryGoal = (metricsInput?: Partial<UserBodyMetrics>): DietaryGoal => {
  const metrics = { ...DEFAULT_BODY_METRICS, ...metricsInput };
  if (metrics.dietaryGoal) return metrics.dietaryGoal;
  const category = calculateIMC(Number(metrics.weightKg) || 72, Number(metrics.heightCm) || 175).category;
  return category === 'obese' ? 'cut' : 'bulk';
};

export const calculateEnergyAndMacros = (
  metricsInput?: Partial<UserBodyMetrics>,
  hunterLevel = 1
): CalculatedNutritionTargets => {
  const metrics = { ...DEFAULT_BODY_METRICS, ...metricsInput };
  const w = Math.max(35, Math.min(220, Number(metrics.weightKg) || 72));
  const h = Math.max(120, Math.min(230, Number(metrics.heightCm) || 175));
  const age = Math.max(14, Math.min(90, Number(metrics.age) || 24));
  const gender = metrics.gender || 'male';
  const imcData = calculateIMC(w, h);

  // Mifflin-St Jeor Equation
  let bmr = 10 * w + 6.25 * h - 5 * age;
  if (gender === 'male') {
    bmr += 5;
  } else if (gender === 'female') {
    bmr -= 161;
  } else {
    bmr -= 78;
  }
  bmr = Math.max(1200, Math.round(bmr));

  // Activity Multiplier for hunter conditioning
  const activityMap: Record<string, number> = {
    sedentary: 1.25,
    light: 1.375,
    moderate: 1.55,
    heavy: 1.725,
  };
  const multiplier = activityMap[metrics.activityLevel || 'moderate'] || 1.55;
  const tdee = Math.round(bmr * multiplier);

  // Goal logic
  const goal = resolveDietaryGoal(metrics);
  let targetCalories = tdee;
  let goalTitle = 'Lean muscle accretion';
  let directive = 'Protein floor first. Muscle is constructed in recovery.';

  switch (goal) {
    case 'bulk':
      targetCalories = tdee + 350;
      goalTitle = 'Hypertrophic Accretion (Surplus)';
      directive = `Caloric surplus (+350 kcal) calibrated for hunter level ${hunterLevel}. Hit protein ceiling and load complex carbohydrates.`;
      break;
    case 'cut':
      targetCalories = Math.max(1500, tdee - 450);
      goalTitle = 'Fat Loss & Density (Deficit)';
      directive = `Precision deficit (-450 kcal). Elevated protein to protect muscular structural integrity.`;
      break;
    case 'recomp':
      targetCalories = tdee - 100;
      goalTitle = 'Metabolic Recomposition';
      directive = `Iso-caloric recomposition. High protein intake with nutrient timing synced to workout windows.`;
      break;
    case 'maintain':
    default:
      targetCalories = tdee;
      goalTitle = 'Physical Maintenance & Stamina';
      directive = `Maintenance equilibrium. Constant kinetic energy output supported by balanced macronutrient distribution.`;
      break;
  }

  // Macronutrient split based on sports physiology
  // Protein: 2.0g/kg for bulk/maintain, 2.2g/kg for cut/recomp
  const proteinPerKg = goal === 'cut' || goal === 'recomp' ? 2.2 : 2.0;
  const protein = Math.round(Math.max(120, Math.min(260, w * proteinPerKg)) / 5) * 5;

  // Fats: ~0.85g/kg (essential fatty acids & hormonal health)
  const fats = Math.round(Math.max(50, Math.min(110, w * 0.85)) / 5) * 5;

  // Carbs: remaining calories / 4
  const remainingCalories = targetCalories - (protein * 4 + fats * 9);
  const carbs = Math.max(90, Math.round(remainingCalories / 4));

  // Water: ~35-40ml per kg, clamped to 2.5L - 4.5L
  const rawWater = (w * 0.04);
  const waterLiters = Math.max(2.5, Math.min(4.5, Math.round(rawWater * 2) / 2));

  return {
    weightKg: w,
    heightCm: h,
    bmr,
    tdee,
    calories: targetCalories,
    protein,
    carbs,
    fats,
    waterLiters,
    goalTitle,
    directive,
  };
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
          rewardedMealIds: Array.isArray(parsed.rewardedMealIds) ? parsed.rewardedMealIds : [],
          waterRewarded: Boolean(parsed.waterRewarded),
          scans: Array.isArray(parsed.scans) ? parsed.scans : [],
          verifiedMealIds: Array.isArray(parsed.verifiedMealIds) ? parsed.verifiedMealIds : [],
          scanAttempts: Number(parsed.scanAttempts) || 0,
        };
      }
    }
  } catch {
    // ignore
  }
  return {
    date,
    mealsDone: [],
    waterDone: false,
    claimed: false,
    rewardedMealIds: [],
    waterRewarded: false,
    scans: [],
    verifiedMealIds: [],
    scanAttempts: 0,
  };
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

/**
 * Fixed meal slots: name, time, macro share, and recovery notes are sports-science
 * constants, not creative choices — they never need an AI call to determine.
 */
const MEAL_SLOTS: Array<{ id: string; name: string; time: string; share: number; notes: string }> = [
  {
    id: 'meal-0',
    name: 'Fuel Intake I • Wake Fast Break',
    time: '08:00',
    share: 0.25,
    notes: 'Consume within 60 min of waking to halt overnight catabolism.',
  },
  {
    id: 'meal-1',
    name: 'Fuel Intake II • Metabolic Surge',
    time: '13:00',
    share: 0.35,
    notes: 'Primary energy replenishment window.',
  },
  {
    id: 'meal-2',
    name: 'Kinetic Charge • Pre/Intra-Session',
    time: '17:00',
    share: 0.15,
    notes: 'Consume 60-75 min prior to kinetic training.',
  },
  {
    id: 'meal-3',
    name: 'Recovery Intake • Cellular Repair',
    time: '20:30',
    share: 0.25,
    notes: 'Post-workout protein synthesis & restorative rest window.',
  },
];

export interface MealSkeletonEntry {
  id: string;
  name: string;
  time: string;
  notes: string;
  calories: number;
  protein: number;
}

/** Deterministically splits the daily targets across the fixed meal slots. Last slot absorbs rounding remainder. */
export const buildMealSkeleton = (targets: CalculatedNutritionTargets): MealSkeletonEntry[] => {
  let calRunning = 0;
  let protRunning = 0;
  return MEAL_SLOTS.map((slot, i) => {
    const isLast = i === MEAL_SLOTS.length - 1;
    const calories = isLast ? targets.calories - calRunning : Math.round(targets.calories * slot.share);
    const protein = isLast ? targets.protein - protRunning : Math.round(targets.protein * slot.share);
    calRunning += calories;
    protRunning += protein;
    return { id: slot.id, name: slot.name, time: slot.time, notes: slot.notes, calories, protein };
  });
};

// Hand-scale visual portions calculator
export const getHandPortionsGuide = (targets: CalculatedNutritionTargets) => {
  const proteinPalms = Math.max(3, Math.round((targets.protein / 30) * 2) / 2); // e.g. 5 palms
  const carbsFists = Math.max(2, Math.round((targets.carbs / 40) * 2) / 2);     // e.g. 4 fists
  const fatsThumbs = Math.max(3, Math.round((targets.fats / 10) * 2) / 2);      // e.g. 6 thumbs/handfuls
  const waterGlasses = Math.max(8, Math.round(targets.waterLiters / 0.35));     // ~350ml glass
  return {
    proteinPalms,
    carbsFists,
    fatsThumbs,
    waterGlasses,
  };
};

export interface DefaultIntakeCheckpoint {
  id: string;
  name: string;
  role: string;
  handGuide: string;
  examples: string;
  calories: number;
  protein: number;
}

export const getDefaultIntakeCheckpoints = (targets: CalculatedNutritionTargets): DefaultIntakeCheckpoint[] => [
  {
    id: 'meal-0',
    name: 'Fuel Intake I • Fast Break',
    role: 'Morning Anchor',
    handGuide: '1-2 Palms Protein + 1 Cupped Hand Carbs',
    examples: '3 whole eggs + 1 cupped hand of oats with milk, or Greek yogurt + fruit',
    calories: Math.round(targets.calories * 0.25),
    protein: Math.round(targets.protein * 0.25),
  },
  {
    id: 'meal-1',
    name: 'Fuel Intake II • Metabolic Surge',
    role: 'Primary Fuel Window',
    handGuide: '1-2 Palms Protein + 1-2 Fists Carbs + 1 Fist Veggies',
    examples: '1 palm-sized chicken breast or tuna + 1-2 fists rice/pasta + greens + 1 thumb olive oil',
    calories: Math.round(targets.calories * 0.35),
    protein: Math.round(targets.protein * 0.35),
  },
  {
    id: 'meal-2',
    name: 'Kinetic Charge • Pre/Post Fuel',
    role: 'Workout Support',
    handGuide: 'Quick Protein or Energy Snacking',
    examples: '1 closed handful almonds/dates, 1 banana with peanut butter, or 1 protein shake/milk',
    calories: Math.round(targets.calories * 0.15),
    protein: Math.round(targets.protein * 0.15),
  },
  {
    id: 'meal-3',
    name: 'Recovery Intake • Cellular Repair',
    role: 'Restorative Anchor',
    handGuide: '1-2 Palms Protein + 1 Fist Tubers/Carbs + Salad',
    examples: '1 palm lean beef, fish, or eggs + 1 sweet potato or quinoa + fresh greens',
    calories: Math.round(targets.calories * 0.25),
    protein: Math.round(targets.protein * 0.25),
  },
];

export const clearStoredNutritionPlan = (): void => {
  try {
    // Dismissed on every device (a plain removal left the other device's copy, which its next
    // upload put back).
    removeSyncedKey(NUTRITION_PLAN_KEY);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent(NUTRITION_UPDATED_EVENT));
    }
  } catch {
    // ignore
  }
};

const DEFAULT_ITEMS_BY_SLOT = (targets: CalculatedNutritionTargets): string[][] => {
  const eggPortion = targets.weightKg > 80 ? '4 whole eggs (~24g protein)' : '3 whole eggs (~18g protein)';
  const oatsPortion = targets.calories > 2700 ? '1 large cupped hand of oats (~45g carbs)' : '1 cupped hand of oats (~30g carbs)';
  const chickenPortion = targets.weightKg > 80 ? '1.5 palms grilled chicken (~40g protein)' : '1 palm grilled chicken (~30g protein)';
  const beefPortion = targets.weightKg > 80 ? '1.5 palms lean beef or salmon (~38g protein)' : '1 palm lean beef or tuna (~28g protein)';

  return [
    [eggPortion, `${oatsPortion} cooked with whole milk`, '1 banana or 2-3 dates for fast glycogen', '1 thumb peanut butter or honey (~8g fats)'],
    [chickenPortion, '1.5 fists cooked rice or whole pasta (~45g carbs)', '1 fist steamed greens or broccoli', '1 thumb-sized drizzle extra virgin olive oil (~10g fats)'],
    ['1 cup Greek yogurt or cottage cheese (~20g protein)', '1 closed handful almonds or walnuts (~10g fats)', '1 apple or seasonal fruit'],
    [beefPortion, '1 fist-sized baked sweet potato or quinoa (~35g carbs)', '1 fist fresh leafy salad with lemon & olive oil'],
  ];
};

/**
 * Precision Algorithmic Meal Builder (0 Tokens / Instant / Deterministic).
 * Scales wholesome, halal-friendly meals using intuitive hand-scale portions.
 */
export const buildPrecisionFallbackPlan = (
  date: string,
  targets: CalculatedNutritionTargets,
  imcData: ImcResult
): NutritionPlan => {
  const skeleton = buildMealSkeleton(targets);
  const defaultItems = DEFAULT_ITEMS_BY_SLOT(targets);

  return {
    date,
    goal: targets.goalTitle,
    calories: targets.calories,
    protein: targets.protein,
    carbs: targets.carbs,
    fats: targets.fats,
    waterLiters: targets.waterLiters,
    origin: 'system',
    generatedAt: new Date().toISOString(),
    directive: targets.directive,
    biometrics: {
      weightKg: targets.weightKg,
      heightCm: targets.heightCm,
      imc: imcData.imc,
      imcCategory: imcData.label,
      goal: targets.goalTitle,
    },
    meals: skeleton.map((slot, i) => ({
      id: slot.id,
      name: slot.name,
      time: slot.time,
      items: defaultItems[i],
      calories: slot.calories,
      protein: slot.protein,
      notes: slot.notes,
    })),
  };
};

interface CompactAiNutritionResponse {
  meals?: Array<{ items?: string[] }>;
}

/**
 * Ultra-Lean prompt: the AI is only asked for food items per fixed meal slot —
 * names, times, and the calorie/protein split are deterministic (see buildMealSkeleton)
 * and never need to round-trip through the model. This keeps the completion short
 * enough to avoid truncation and guarantees the numbers always match the targets exactly.
 */
const buildMinimalPrompt = (
  targets: CalculatedNutritionTargets,
  imcData: ImcResult,
  skeleton: MealSkeletonEntry[],
  region?: string,
  context?: string
): string => `
Role: Solo Leveling Hunter Nutrition Module THEIA.
Hunter: ${targets.weightKg}kg, ${targets.heightCm}cm, IMC ${imcData.imc} (${imcData.label}), Goal: ${targets.goalTitle}.
${region ? `Region: ${region} — only use whole-food items ordinarily available there (skip anything imported/rare).` : 'Region: unspecified — stick to globally common whole-food items.'}
Food rules: ${foodRulesForPrompt(getFoodProfile())}.
${getTrainingGoalForNutrition() ? `Training goal: ${getTrainingGoalForNutrition()}.` : ''}
CRITICAL FORMATTING RULE: For each slot, list 3-4 real whole-food items described using intuitive visual hand measurements (e.g. "1 palm-sized chicken breast (~30g protein)", "1.5 fists cooked rice (~45g carbs)", "1 closed handful almonds (~10g fats)", "3 whole eggs") instead of raw gram weights. No kitchen scale required!
${context ? `Note: ${context}` : ''}
Slots (in order):
${skeleton.map((s, i) => `${i + 1}. ${s.name} — ~${s.calories}kcal / ${s.protein}g protein`).join('\n')}
Return ONLY valid JSON (no markdown), meals array in the same order as the slots:
{"meals":[{"items":["3 whole eggs (~18g protein)","1 cupped hand oats with milk","1 thumb peanut butter"]}]}
`.trim();

export const generateNutritionPlan = async (
  profile: UserProfile,
  context?: string,
  options?: { forceAlgorithmic?: boolean }
): Promise<NutritionPlan> => {
  const date = getTodayKey();
  const metrics = profile.bodyMetrics || DEFAULT_BODY_METRICS;
  const imcData = calculateIMC(metrics.weightKg, metrics.heightCm);
  // Training-aware: today's carbs follow today's training (see getDayTargets).
  const dayTargets = getDayTargets(calculateEnergyAndMacros(metrics, profile.level));
  const targets: CalculatedNutritionTargets = dayTargets;

  // If user requested instant/algorithmic generation or if offline
  if (options?.forceAlgorithmic) {
    const instantPlan: NutritionPlan = { ...buildPrecisionFallbackPlan(date, targets, imcData), dayType: dayTargets.dayType };
    saveNutritionPlan(instantPlan);
    return instantPlan;
  }

  const skeleton = buildMealSkeleton(targets);

  try {
    // Call AI for food items only — small, fixed-shape completion (no name/time/macro output).
    // thinkingBudget: 0 disables Gemini 2.5 Flash's invisible reasoning tokens, which otherwise
    // eat the whole maxTokens budget before any visible JSON is written (the actual cause of
    // truncated/cut-short responses) — this task needs zero reasoning, just a food list.
    const prompt = buildMinimalPrompt(targets, imcData, skeleton, regionFor(metrics), context);
    const res = await aiGatewayClient.completeJson<CompactAiNutritionResponse>(prompt, {
      temperature: 0.4,
      maxTokens: 500,
      thinkingBudget: 0,
      providerOverride: 'lab',
    });
    // Captured right after the call so it reflects which key actually served THIS response
    // (server reports this via the X-LLM-Key-Source header — see ai-gateway-client.ts).
    const keySource = aiGatewayClient.lastGatewayInfo?.keySource;

    const rawMeals = res?.meals || [];
    if (!Array.isArray(rawMeals) || rawMeals.length < skeleton.length) {
      throw new Error('Nutrition AI returned insufficient meals');
    }

    const meals: NutritionMeal[] = skeleton.map((slot, i) => {
      const items = rawMeals[i]?.items;
      return {
        id: slot.id,
        name: slot.name,
        time: slot.time,
        items: Array.isArray(items) ? items.map(String).filter(Boolean).slice(0, 6) : ['Whole foods intake'],
        calories: slot.calories,
        protein: slot.protein,
        notes: slot.notes,
      };
    });

    const plan: NutritionPlan = {
      date,
      goal: targets.goalTitle,
      calories: targets.calories,
      protein: targets.protein,
      carbs: targets.carbs,
      fats: targets.fats,
      waterLiters: targets.waterLiters,
      directive: targets.directive,
      meals,
      origin: 'ai',
      generatedAt: new Date().toISOString(),
      keySource,
      dayType: dayTargets.dayType,
      biometrics: {
        weightKg: targets.weightKg,
        heightCm: targets.heightCm,
        imc: imcData.imc,
        imcCategory: imcData.label,
        goal: targets.goalTitle,
      },
    };

    saveNutritionPlan(plan);
    return plan;
  } catch (error) {
    console.warn('Nutrition lab AI fallback to precision deterministic protocol:', error);
    const fallback: NutritionPlan = { ...buildPrecisionFallbackPlan(date, targets, imcData), dayType: dayTargets.dayType };
    saveNutritionPlan(fallback);
    return fallback;
  }
};

/** Load today's plan ONLY if already saved. Never forces an automatic AI call on load. */
export const loadOrGenerateNutritionPlan = async (
  profile: UserProfile,
  options?: { generateIfMissing?: boolean }
): Promise<NutritionPlan | null> => {
  const existing = getStoredNutritionPlan();
  if (existing) {
    if (profile.bodyMetrics?.isCalibrated) {
      return existing;
    }
  }
  if (options?.generateIfMissing && profile.bodyMetrics?.isCalibrated) {
    return generateNutritionPlan(profile);
  }
  return null;
};
