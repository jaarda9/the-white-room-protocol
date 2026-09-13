/**
 * Nutrition / Diet protocol for the Physical Training branch.
 * Biometrically calibrated to player's weight, height, and IMC (BMI).
 * Deterministic sports science energy engine + ultra-lean AI prompt (token minimized).
 */
import { aiGatewayClient } from '@/lib/ai-gateway-client';
import type { UserProfile, UserBodyMetrics } from '@/lib/types';
import { DEFAULT_BODY_METRICS } from '@/lib/storage';

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
  const goal = metrics.dietaryGoal || (imcData.category === 'underweight' ? 'bulk' : imcData.category === 'obese' ? 'cut' : 'bulk');
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
        };
      }
    }
  } catch {
    // ignore
  }
  return { date, mealsDone: [], waterDone: false, claimed: false, rewardedMealIds: [], waterRewarded: false };
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

interface MealSkeletonEntry {
  id: string;
  name: string;
  time: string;
  notes: string;
  calories: number;
  protein: number;
}

/** Deterministically splits the daily targets across the fixed meal slots. Last slot absorbs rounding remainder. */
const buildMealSkeleton = (targets: CalculatedNutritionTargets): MealSkeletonEntry[] => {
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

const DEFAULT_ITEMS_BY_SLOT = (targets: CalculatedNutritionTargets): string[][] => {
  const eggCount = targets.weightKg > 80 ? '4 whole eggs' : '3 whole eggs';
  const oatsGrams = targets.calories > 2700 ? '90g oats' : '70g oats';
  const chickenGrams = targets.weightKg > 80 ? '220g grilled chicken' : '180g grilled chicken';
  const beefGrams = targets.weightKg > 80 ? '200g lean beef or salmon' : '160g lean beef or tuna';

  return [
    [eggCount, `${oatsGrams} with whole milk`, '1 banana or dates', '1 tbsp honey or peanut butter'],
    [chickenGrams, 'Brown rice or whole pasta', 'Steamed broccoli & carrots', '1.5 tbsp extra virgin olive oil'],
    ['200g Greek yogurt or cottage cheese', 'Handful of almonds or walnuts', '1 apple or seasonal fruit'],
    [beefGrams, 'Baked sweet potatoes or quinoa', 'Leafy greens salad with lemon dressing'],
  ];
};

/**
 * Precision Algorithmic Meal Builder (0 Tokens / Instant / Deterministic).
 * Scales wholesome, halal-friendly meals precisely to the calculated targets.
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
  context?: string
): string => `
Role: Solo Leveling Hunter Nutrition Module THEIA.
Hunter: ${targets.weightKg}kg, ${targets.heightCm}cm, IMC ${imcData.imc} (${imcData.label}), Goal: ${targets.goalTitle}.
For each slot below, list 3-4 real halal whole-food items (with quantities) that roughly hit its kcal/protein target.
${context ? `Note: ${context}` : ''}
Slots (in order):
${skeleton.map((s, i) => `${i + 1}. ${s.name} — ~${s.calories}kcal / ${s.protein}g protein`).join('\n')}
Return ONLY valid JSON (no markdown), meals array in the same order as the slots:
{"meals":[{"items":["3 eggs","80g oats","200ml milk"]}]}
`.trim();

export const generateNutritionPlan = async (
  profile: UserProfile,
  context?: string,
  options?: { forceAlgorithmic?: boolean }
): Promise<NutritionPlan> => {
  const date = getTodayKey();
  const metrics = profile.bodyMetrics || DEFAULT_BODY_METRICS;
  const imcData = calculateIMC(metrics.weightKg, metrics.heightCm);
  const targets = calculateEnergyAndMacros(metrics, profile.level);

  // If user requested instant/algorithmic generation or if offline
  if (options?.forceAlgorithmic) {
    const instantPlan = buildPrecisionFallbackPlan(date, targets, imcData);
    saveNutritionPlan(instantPlan);
    return instantPlan;
  }

  const skeleton = buildMealSkeleton(targets);

  try {
    // Call AI for food items only — small, fixed-shape completion (no name/time/macro output).
    const prompt = buildMinimalPrompt(targets, imcData, skeleton, context);
    const res = await aiGatewayClient.completeJson<CompactAiNutritionResponse>(prompt, {
      temperature: 0.4,
      maxTokens: 350,
      providerOverride: 'lab',
    });

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
    const fallback = buildPrecisionFallbackPlan(date, targets, imcData);
    saveNutritionPlan(fallback);
    return fallback;
  }
};

/** Load today's plan, generating via AI only when missing AND user has calibrated biometrics. */
export const loadOrGenerateNutritionPlan = async (profile: UserProfile): Promise<NutritionPlan | null> => {
  const existing = getStoredNutritionPlan();
  if (existing) {
    // Only use existing plan if biometrics have been calibrated
    if (profile.bodyMetrics?.isCalibrated) {
      return existing;
    }
  }
  // Do NOT auto-generate an AI plan if the player has not configured their biometrics (weight/height)
  if (!profile.bodyMetrics?.isCalibrated) {
    return null;
  }
  return generateNutritionPlan(profile);
};
