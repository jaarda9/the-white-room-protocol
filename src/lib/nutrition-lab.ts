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

/**
 * Precision Algorithmic Meal Builder (0 Tokens / Instant / Deterministic).
 * Scales wholesome, halal-friendly meals precisely to the calculated targets.
 */
export const buildPrecisionFallbackPlan = (
  date: string,
  targets: CalculatedNutritionTargets,
  imcData: ImcResult
): NutritionPlan => {
  const totalCals = targets.calories;
  const totalProt = targets.protein;

  // Split across 4 meals: 25%, 35%, 15%, 25%
  const m1Cals = Math.round(totalCals * 0.25);
  const m1Prot = Math.round(totalProt * 0.25);

  const m2Cals = Math.round(totalCals * 0.35);
  const m2Prot = Math.round(totalProt * 0.35);

  const m3Cals = Math.round(totalCals * 0.15);
  const m3Prot = Math.round(totalProt * 0.15);

  const m4Cals = totalCals - (m1Cals + m2Cals + m3Cals);
  const m4Prot = totalProt - (m1Prot + m2Prot + m3Prot);

  const eggCount = targets.weightKg > 80 ? '4 whole eggs' : '3 whole eggs';
  const oatsGrams = targets.calories > 2700 ? '90g oats' : '70g oats';
  const chickenGrams = targets.weightKg > 80 ? '220g grilled chicken' : '180g grilled chicken';
  const beefGrams = targets.weightKg > 80 ? '200g lean beef or salmon' : '160g lean beef or tuna';

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
    meals: [
      {
        id: 'fuel-intake-0',
        name: 'Fuel Intake I • Wake Fast Break',
        time: '08:00',
        items: [eggCount, `${oatsGrams} with whole milk`, '1 banana or dates', '1 tbsp honey or peanut butter'],
        calories: m1Cals,
        protein: m1Prot,
        notes: 'Consume within 60 min of waking to halt overnight catabolism.',
      },
      {
        id: 'fuel-intake-1',
        name: 'Fuel Intake II • Metabolic Surge',
        time: '13:00',
        items: [chickenGrams, 'Brown rice or whole pasta', 'Steamed broccoli & carrots', '1.5 tbsp extra virgin olive oil'],
        calories: m2Cals,
        protein: m2Prot,
        notes: 'Primary energy replenishment window.',
      },
      {
        id: 'pre-training-charge-2',
        name: 'Kinetic Charge • Pre/Intra-Session',
        time: '17:00',
        items: ['200g Greek yogurt or cottage cheese', 'Handful of almonds or walnuts', '1 apple or seasonal fruit'],
        calories: m3Cals,
        protein: m3Prot,
        notes: 'Consume 60-75 min prior to kinetic training.',
      },
      {
        id: 'recovery-intake-3',
        name: 'Recovery Intake • Cellular Repair',
        time: '20:30',
        items: [beefGrams, 'Baked sweet potatoes or quinoa', 'Leafy greens salad with lemon dressing'],
        calories: m4Cals,
        protein: m4Prot,
        notes: 'Post-workout protein synthesis & restorative rest window.',
      },
    ],
  };
};

interface CompactAiNutritionResponse {
  meals?: Array<{
    name?: string;
    time?: string;
    items?: string[];
    calories?: number;
    protein?: number;
    notes?: string;
  }>;
}

/**
 * Ultra-Lean prompt: passes deterministic targets directly to the LLM.
 * Prompt token length: ~75 tokens (was ~300).
 * Output maxTokens: 700 (was 2500).
 */
const buildMinimalPrompt = (
  targets: CalculatedNutritionTargets,
  imcData: ImcResult,
  context?: string
): string => `
Role: Solo Leveling Hunter Nutrition Module THEIA.
Hunter: ${targets.weightKg}kg, ${targets.heightCm}cm, IMC ${imcData.imc} (${imcData.label}), Goal: ${targets.goalTitle}.
Target: EXACTLY ${targets.calories} kcal & ${targets.protein}g protein total, divided across 4 halal whole-food meals.
${context ? `Note: ${context}` : ''}
Return ONLY valid JSON (no markdown):
{
  "meals": [
    {"name": "Fuel Intake I", "time": "08:00", "items": ["3 eggs", "80g oats", "200ml milk"], "calories": ${Math.round(targets.calories * 0.25)}, "protein": ${Math.round(targets.protein * 0.25)}, "notes": "fast break"}
  ]
}
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

  try {
    // Call AI with minimal prompt and strict token cap (700 max tokens)
    const prompt = buildMinimalPrompt(targets, imcData, context);
    const res = await aiGatewayClient.completeJson<CompactAiNutritionResponse>(prompt, {
      temperature: 0.4,
      maxTokens: 700,
      providerOverride: 'lab',
    });

    const rawMeals = res?.meals || [];
    if (!Array.isArray(rawMeals) || rawMeals.length < 2) {
      throw new Error('Nutrition AI returned insufficient meals');
    }

    const meals: NutritionMeal[] = rawMeals.slice(0, 5).map((m, i) => ({
      id: slug(String(m?.name || 'Intake'), i),
      name: String(m?.name || `Intake ${i + 1}`),
      time: String(m?.time || ''),
      items: Array.isArray(m?.items) ? m.items.map(String).filter(Boolean).slice(0, 6) : ['Whole foods intake'],
      calories: num(m?.calories, Math.round(targets.calories / rawMeals.length)),
      protein: num(m?.protein, Math.round(targets.protein / rawMeals.length)),
      notes: m?.notes ? String(m.notes) : undefined,
    }));

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
