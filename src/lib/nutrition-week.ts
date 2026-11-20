/**
 * Weekly Rations — a 7-day meal plan and the Supply List (grocery list) that comes with it.
 *
 * THEIA designs a small set of recipes (2 breakfasts, 3 lunches, 2 snacks, 3 dinners) that
 * rotate through the week, the way real meal prep works: few recipes, shared ingredients, a
 * short and affordable list. Everything numeric is done in code:
 *   - each day's carbs follow that day's training (getDayTargets), by scaling the recipe's main
 *     carb ingredients, so training days eat more and rest days less;
 *   - the Supply List adds up the exact quantities of all 7 days;
 *   - diet rules (halal, vegetarian, vegan, pescatarian) and allergies are enforced on THEIA's
 *     answer, not only asked for; a System recipe library fills any gap (and the whole week
 *     when THEIA is unreachable).
 * Today's meals are derived from the week into the normal daily plan, so logging, rewards and
 * photo verification work exactly as before.
 */
import { aiGatewayClient } from '@/lib/ai-gateway-client';
import {
  buildMealSkeleton,
  calculateEnergyAndMacros,
  calculateIMC,
  clearStoredNutritionPlan,
  foodRulesForPrompt,
  getDayTargets,
  getStoredNutritionPlan,
  getTodayKey,
  getTrainingGoalForNutrition,
  saveNutritionPlan,
  type CalculatedNutritionTargets,
  type DayType,
  type FoodProfile,
  type NutritionPlan,
} from '@/lib/nutrition-lab';
import { DEFAULT_BODY_METRICS } from '@/lib/storage';
import { requestSync } from '@/lib/sync-signal';
import { removeSyncedKey } from '@/lib/synced-deletions';
import type { UserProfile } from '@/lib/types';

export const NUTRITION_WEEK_KEY = 'wrp_nutrition_week';
export const SUPPLY_RUN_XP = 15;

export type MealSlot = 'breakfast' | 'lunch' | 'snack' | 'dinner';
/** Same order as the daily meal slots (meal-0 ... meal-3) in nutrition-lab.ts. */
export const SLOT_ORDER: MealSlot[] = ['breakfast', 'lunch', 'snack', 'dinner'];
const RECIPES_PER_SLOT: Record<MealSlot, number> = { breakfast: 2, lunch: 3, snack: 2, dinner: 3 };

export type GrocerySection = 'produce' | 'protein' | 'dairy' | 'grains' | 'pantry' | 'frozen' | 'other';
export const SECTION_LABELS: Record<GrocerySection, string> = {
  produce: 'FRUIT & VEGETABLES',
  protein: 'MEAT, FISH, EGGS & TOFU',
  dairy: 'DAIRY',
  grains: 'GRAINS, BREAD & POTATOES',
  pantry: 'PANTRY & CANS',
  frozen: 'FROZEN',
  other: 'OTHER',
};
const SECTIONS = Object.keys(SECTION_LABELS) as GrocerySection[];
export type IngredientUnit = 'g' | 'ml' | 'pcs';

export interface Ingredient {
  name: string;
  qty: number;
  unit: IngredientUnit;
  section: GrocerySection;
  /** The meal's main carb source: scaled up on training days and down on rest days. */
  carb?: boolean;
}

export interface Recipe {
  id: string;
  slot: MealSlot;
  name: string;
  prepMinutes: number;
  howTo: string;
  ingredients: Ingredient[];
}

export interface WeekDay {
  date: string;
  dayType: DayType;
  /** Carb factor for this day's main carb ingredients (training > 1, rest < 1). */
  carbFactor: number;
  recipeIds: Record<MealSlot, string>;
}

export interface NutritionWeek {
  id: string;
  startDate: string;
  generatedAt: string;
  origin: 'ai' | 'system';
  recipes: Recipe[];
  days: WeekDay[];
  /** Supply List keys already bought / already at home. */
  checked: string[];
  supplyRewarded: boolean;
}

// ---------------------------------------------------------------------------------------------
// Storage & dates
// ---------------------------------------------------------------------------------------------

export const getNutritionWeek = (): NutritionWeek | null => {
  try {
    const v = JSON.parse(localStorage.getItem(NUTRITION_WEEK_KEY) || 'null');
    return v && typeof v === 'object' && Array.isArray(v.days) && Array.isArray(v.recipes) ? (v as NutritionWeek) : null;
  } catch {
    return null;
  }
};

export const NUTRITION_WEEK_EVENT = 'wrp:nutrition-week-updated';

export const saveNutritionWeek = (week: NutritionWeek | null): void => {
  try {
    if (week) localStorage.setItem(NUTRITION_WEEK_KEY, JSON.stringify(week));
    else removeSyncedKey(NUTRITION_WEEK_KEY);
    requestSync();
    window.dispatchEvent(new CustomEvent(NUTRITION_WEEK_EVENT));
  } catch {
    // ignore
  }
};

const keyToDate = (key: string) => {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
};
const addDays = (key: string, n: number) => {
  const d = keyToDate(key);
  return getTodayKey(new Date(d.getFullYear(), d.getMonth(), d.getDate() + n));
};

/** The week covering `date`, or null when there is none or it has ended. */
export const getActiveWeek = (date = getTodayKey()): NutritionWeek | null => {
  const week = getNutritionWeek();
  if (!week) return null;
  return week.days.some((d) => d.date === date) ? week : null;
};

export const weekDayIndex = (week: NutritionWeek, date = getTodayKey()): number => week.days.findIndex((d) => d.date === date);

// ---------------------------------------------------------------------------------------------
// Diet & allergy enforcement (code-side, on THEIA's answer and on the System library)
// ---------------------------------------------------------------------------------------------

const KEYWORDS: Record<string, string[]> = {
  meat: ['chicken', 'beef', 'lamb', 'mutton', 'turkey', 'meat', 'mince', 'veal', 'goat', 'sausage', 'kofta', 'steak', 'liver', 'duck'],
  pork: ['pork', 'bacon', 'ham', 'lard', 'pepperoni', 'prosciutto', 'chorizo', 'salami'],
  alcohol: ['wine', 'beer', 'rum', 'vodka', 'liqueur', 'brandy', 'mirin', 'sake'],
  fish: ['fish', 'salmon', 'tuna', 'sardine', 'cod', 'shrimp', 'prawn', 'mackerel', 'seafood', 'tilapia', 'anchov', 'crab', 'mussel', 'squid', 'hake', 'trout'],
  dairy: ['milk', 'yogurt', 'yoghurt', 'cheese', 'butter', 'cream', 'whey', 'labneh', 'cottage', 'kefir', 'ghee', 'curd', 'ricotta', 'mozzarella', 'feta', 'skyr',
    'halloumi', 'paneer', 'parmesan', 'cheddar', 'gouda', 'edam', 'emmental', 'brie', 'camembert', 'mascarpone', 'quark', 'burrata', 'jben', 'raib', 'casein', 'lactose'],
  egg: ['egg'],
  gluten: ['bread', 'pasta', 'wheat', 'couscous', 'flour', 'bulgur', 'barley', 'semolina', 'tortilla', 'pita', 'noodle', 'wrap', 'bagel', 'cracker'],
  nuts: ['almond', 'walnut', 'cashew', 'hazelnut', 'pistachio', 'pecan', 'macadamia', 'brazil nut', 'mixed nuts'],
  peanut: ['peanut'],
  soy: ['soy', 'tofu', 'tempeh', 'edamame'],
  sesame: ['sesame', 'tahini', 'hummus'],
  honey: ['honey'],
};
/** Allergy words the Hunter may type -> keyword groups to exclude. */
const ALLERGY_GROUPS: Array<[RegExp, string[]]> = [
  [/lactose|dairy|milk/, ['dairy']],
  [/egg/, ['egg']],
  [/gluten|wheat|celiac|coeliac/, ['gluten']],
  [/peanut/, ['peanut']],
  [/tree ?nut|\bnuts?\b|almond|walnut|cashew|hazelnut|pistachio/, ['nuts']],
  [/soy|soja/, ['soy']],
  [/fish|seafood|shellfish|shrimp/, ['fish']],
  [/sesame/, ['sesame']],
];

/** Word-start match, so "ham" doesn't hit "champignon" and "cod" doesn't hit "coconut". */
const hasAny = (text: string, groups: string[]) =>
  groups.some((g) => (KEYWORDS[g] || []).some((k) => new RegExp(`\\b${k}`).test(text)));
/** Plant milks, nut butters and eggplant aren't dairy / egg. */
const neutralize = (text: string) =>
  text
    .replace(/\b(soy|soya|oat|almond|coconut|rice|plant|cashew)[ -]?(milk|yogurt|yoghurt|cream|cheese|drink)/g, '$1 plant-based')
    .replace(/\b(peanut|almond|cashew|nut|seed|sunflower|apple|cocoa|shea)[ -]?butter/g, '$1 spread')
    .replace(/eggplant/g, 'aubergine');
const words = (s: string) =>
  s
    .toLowerCase()
    .split(/[,;/]|\band\b|\bor\b/)
    .map((w) => w.trim())
    .filter((w) => w.length >= 3);

/** Groups and free words a recipe must not contain for this food profile. */
export const forbiddenFor = (food: FoodProfile | null): { groups: string[]; words: string[]; soft: string[] } => {
  const groups: string[] = [];
  if (!food || food.halal) groups.push('pork', 'alcohol');
  if (food?.diet === 'vegetarian') groups.push('meat', 'fish', 'pork');
  if (food?.diet === 'pescatarian') groups.push('meat', 'pork');
  if (food?.diet === 'vegan') groups.push('meat', 'fish', 'pork', 'dairy', 'egg', 'honey');
  const allergyText = (food?.allergies || '').toLowerCase();
  for (const [re, g] of ALLERGY_GROUPS) if (re.test(allergyText)) groups.push(...g);
  return { groups: [...new Set(groups)], words: words(food?.allergies || ''), soft: words(food?.dislikes || '') };
};

const recipeText = (r: Recipe) => neutralize(`${r.name} ${r.ingredients.map((i) => i.name).join(' ')}`.toLowerCase());
/** Hard rules: diet + allergies. Never broken. */
export const recipeAllowed = (r: Recipe, food: FoodProfile | null): boolean => {
  const f = forbiddenFor(food);
  const text = recipeText(r);
  return !hasAny(text, f.groups) && !f.words.some((w) => text.includes(w));
};
const recipeLiked = (r: Recipe, food: FoodProfile | null) => {
  const text = recipeText(r);
  return !forbiddenFor(food).soft.some((w) => text.includes(w));
};

// ---------------------------------------------------------------------------------------------
// System recipe library (0 tokens). Quantities are for ~2600 kcal/day and are scaled.
// ---------------------------------------------------------------------------------------------

const I = (name: string, qty: number, unit: IngredientUnit, section: GrocerySection, carb = false): Ingredient => ({ name, qty, unit, section, carb });
const SYSTEM_RECIPES: Recipe[] = [
  // breakfast
  { id: 'sys-b-oats', slot: 'breakfast', name: 'Banana oats with peanut butter', prepMinutes: 8, howTo: 'Simmer the oats in milk 4 min, top with sliced banana and peanut butter.',
    ingredients: [I('Rolled oats', 80, 'g', 'grains', true), I('Milk', 300, 'ml', 'dairy'), I('Banana', 1, 'pcs', 'produce'), I('Peanut butter', 15, 'g', 'pantry')] },
  { id: 'sys-b-eggs', slot: 'breakfast', name: 'Eggs on wholegrain toast', prepMinutes: 10, howTo: 'Scramble the eggs in a little olive oil; serve on toast with sliced tomato.',
    ingredients: [I('Eggs', 3, 'pcs', 'protein'), I('Wholegrain bread', 80, 'g', 'grains', true), I('Tomatoes', 1, 'pcs', 'produce'), I('Olive oil', 5, 'ml', 'pantry')] },
  { id: 'sys-b-yogurt', slot: 'breakfast', name: 'Greek yogurt, oats and berries', prepMinutes: 3, howTo: 'Layer yogurt, oats and berries; finish with honey.',
    ingredients: [I('Greek yogurt', 250, 'g', 'dairy'), I('Rolled oats', 50, 'g', 'grains', true), I('Frozen berries', 100, 'g', 'frozen'), I('Honey', 10, 'g', 'pantry')] },
  { id: 'sys-b-tofu', slot: 'breakfast', name: 'Tofu scramble on toast', prepMinutes: 12, howTo: 'Crumble tofu into a hot pan with oil, spinach and spices; serve on toast.',
    ingredients: [I('Firm tofu', 180, 'g', 'protein'), I('Wholegrain bread', 80, 'g', 'grains', true), I('Spinach', 60, 'g', 'produce'), I('Olive oil', 10, 'ml', 'pantry')] },
  { id: 'sys-b-soyoats', slot: 'breakfast', name: 'Soy-milk oats with banana', prepMinutes: 8, howTo: 'Simmer oats in soy milk; top with banana and seeds.',
    ingredients: [I('Rolled oats', 90, 'g', 'grains', true), I('Soy milk', 300, 'ml', 'dairy'), I('Banana', 1, 'pcs', 'produce'), I('Sunflower seeds', 15, 'g', 'pantry')] },
  // lunch
  { id: 'sys-l-chicken', slot: 'lunch', name: 'Chicken, rice and broccoli', prepMinutes: 25, howTo: 'Cook rice; pan-sear sliced chicken; steam broccoli; dress with olive oil. Cook double for tomorrow.',
    ingredients: [I('Chicken breast', 180, 'g', 'protein'), I('Rice', 90, 'g', 'grains', true), I('Broccoli', 150, 'g', 'produce'), I('Olive oil', 10, 'ml', 'pantry')] },
  { id: 'sys-l-tuna', slot: 'lunch', name: 'Tuna tomato pasta', prepMinutes: 15, howTo: 'Boil pasta; warm passata with tuna and garlic; combine.',
    ingredients: [I('Wholewheat pasta', 90, 'g', 'grains', true), I('Canned tuna', 140, 'g', 'pantry'), I('Tomato passata', 150, 'ml', 'pantry'), I('Garlic', 1, 'pcs', 'produce')] },
  { id: 'sys-l-beef', slot: 'lunch', name: 'Beef and potato skillet', prepMinutes: 25, howTo: 'Brown the mince with onion; add diced boiled potatoes and green beans.',
    ingredients: [I('Lean beef mince', 160, 'g', 'protein'), I('Potatoes', 300, 'g', 'grains', true), I('Green beans', 150, 'g', 'produce'), I('Onion', 1, 'pcs', 'produce')] },
  { id: 'sys-l-lentil', slot: 'lunch', name: 'Lentil and rice bowl', prepMinutes: 30, howTo: 'Simmer lentils with onion and carrot; serve over rice with olive oil.',
    ingredients: [I('Dry lentils', 90, 'g', 'pantry'), I('Rice', 60, 'g', 'grains', true), I('Carrots', 120, 'g', 'produce'), I('Onion', 1, 'pcs', 'produce'), I('Olive oil', 10, 'ml', 'pantry')] },
  { id: 'sys-l-chickpea', slot: 'lunch', name: 'Chickpea couscous salad', prepMinutes: 10, howTo: 'Pour boiling water on couscous; mix with chickpeas, cucumber, tomato, lemon and oil.',
    ingredients: [I('Canned chickpeas', 240, 'g', 'pantry'), I('Couscous', 70, 'g', 'grains', true), I('Cucumber', 1, 'pcs', 'produce'), I('Tomatoes', 1, 'pcs', 'produce'), I('Olive oil', 10, 'ml', 'pantry')] },
  { id: 'sys-l-blackbean', slot: 'lunch', name: 'Black bean and rice bowl', prepMinutes: 20, howTo: 'Cook rice; warm beans with cumin and onion; top with avocado and lime.',
    ingredients: [I('Canned black beans', 240, 'g', 'pantry'), I('Rice', 80, 'g', 'grains', true), I('Avocado', 0.5, 'pcs', 'produce'), I('Onion', 1, 'pcs', 'produce')] },
  // snack
  { id: 'sys-s-yogurt', slot: 'snack', name: 'Yogurt and an apple', prepMinutes: 1, howTo: 'Eat 60-75 min before training.',
    ingredients: [I('Greek yogurt', 200, 'g', 'dairy'), I('Apples', 1, 'pcs', 'produce')] },
  { id: 'sys-s-dates', slot: 'snack', name: 'Almonds and dates', prepMinutes: 1, howTo: 'Fast fuel before a session.',
    ingredients: [I('Almonds', 30, 'g', 'pantry'), I('Dates', 40, 'g', 'pantry', true)] },
  { id: 'sys-s-banana', slot: 'snack', name: 'Banana with peanut butter', prepMinutes: 1, howTo: 'Easy pre-training fuel.',
    ingredients: [I('Banana', 1, 'pcs', 'produce', true), I('Peanut butter', 20, 'g', 'pantry')] },
  { id: 'sys-s-hummus', slot: 'snack', name: 'Hummus, carrots and bread', prepMinutes: 3, howTo: 'Dip carrot sticks and bread in hummus.',
    ingredients: [I('Hummus', 80, 'g', 'pantry'), I('Carrots', 100, 'g', 'produce'), I('Wholegrain bread', 40, 'g', 'grains', true)] },
  { id: 'sys-s-fruit', slot: 'snack', name: 'Fruit and sunflower seeds', prepMinutes: 1, howTo: 'Simple and light.',
    ingredients: [I('Oranges', 2, 'pcs', 'produce', true), I('Sunflower seeds', 25, 'g', 'pantry')] },
  // dinner
  { id: 'sys-d-salmon', slot: 'dinner', name: 'Salmon, sweet potato and salad', prepMinutes: 30, howTo: 'Roast sweet potato 25 min; bake salmon the last 12 min; serve with dressed leaves.',
    ingredients: [I('Salmon fillet', 160, 'g', 'protein'), I('Sweet potatoes', 250, 'g', 'grains', true), I('Salad leaves', 80, 'g', 'produce'), I('Olive oil', 10, 'ml', 'pantry')] },
  { id: 'sys-d-chicken', slot: 'dinner', name: 'Chicken and vegetable quinoa', prepMinutes: 25, howTo: 'Cook quinoa; stir-fry chicken with frozen vegetables; combine.',
    ingredients: [I('Chicken breast', 170, 'g', 'protein'), I('Quinoa', 70, 'g', 'grains', true), I('Frozen mixed vegetables', 200, 'g', 'frozen'), I('Olive oil', 10, 'ml', 'pantry')] },
  { id: 'sys-d-omelette', slot: 'dinner', name: 'Potato and spinach omelette', prepMinutes: 20, howTo: 'Fry sliced boiled potatoes, add spinach, pour over beaten eggs and cheese; finish in the pan.',
    ingredients: [I('Eggs', 4, 'pcs', 'protein'), I('Potatoes', 200, 'g', 'grains', true), I('Spinach', 80, 'g', 'produce'), I('Grated cheese', 30, 'g', 'dairy')] },
  { id: 'sys-d-chili', slot: 'dinner', name: 'Bean chili with rice', prepMinutes: 30, howTo: 'Soften onion and pepper, add beans and passata with chili spices; simmer 15 min; serve on rice.',
    ingredients: [I('Canned kidney beans', 240, 'g', 'pantry'), I('Rice', 70, 'g', 'grains', true), I('Tomato passata', 200, 'ml', 'pantry'), I('Bell pepper', 1, 'pcs', 'produce'), I('Onion', 1, 'pcs', 'produce')] },
  { id: 'sys-d-tofu', slot: 'dinner', name: 'Tofu vegetable stir-fry', prepMinutes: 20, howTo: 'Brown cubed tofu, add vegetables and a splash of soy sauce; serve on rice.',
    ingredients: [I('Firm tofu', 200, 'g', 'protein'), I('Rice', 80, 'g', 'grains', true), I('Frozen mixed vegetables', 200, 'g', 'frozen'), I('Soy sauce', 15, 'ml', 'pantry')] },
  { id: 'sys-d-curry', slot: 'dinner', name: 'Chickpea and spinach curry', prepMinutes: 25, howTo: 'Soften onion with curry spices, add chickpeas, passata and spinach; simmer 10 min; serve on rice.',
    ingredients: [I('Canned chickpeas', 240, 'g', 'pantry'), I('Rice', 80, 'g', 'grains', true), I('Spinach', 100, 'g', 'produce'), I('Tomato passata', 150, 'ml', 'pantry'), I('Onion', 1, 'pcs', 'produce')] },
  { id: 'sys-d-beef', slot: 'dinner', name: 'Beef kofta with bulgur', prepMinutes: 25, howTo: 'Shape mince with onion and spices; grill; serve with bulgur and salad.',
    ingredients: [I('Lean beef mince', 160, 'g', 'protein'), I('Bulgur', 70, 'g', 'grains', true), I('Cucumber', 1, 'pcs', 'produce'), I('Onion', 1, 'pcs', 'produce')] },
];

const scaleRecipe = (r: Recipe, factor: number): Recipe => ({
  ...r,
  ingredients: r.ingredients.map((i) => ({ ...i, qty: i.unit === 'pcs' ? Math.max(0.5, Math.round(i.qty * factor * 2) / 2) : Math.max(5, Math.round((i.qty * factor) / 5) * 5) })),
});

/** System recipes for one slot that obey the profile, liked ones first. */
const systemRecipesFor = (slot: MealSlot, food: FoodProfile | null, factor: number): Recipe[] => {
  const allowed = SYSTEM_RECIPES.filter((r) => r.slot === slot && recipeAllowed(r, food));
  const liked = allowed.filter((r) => recipeLiked(r, food));
  return [...liked, ...allowed.filter((r) => !liked.includes(r))].map((r) => scaleRecipe(r, factor));
};

// ---------------------------------------------------------------------------------------------
// THEIA answer validation
// ---------------------------------------------------------------------------------------------

const clean = (v: unknown, max: number) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, max);

const normalizeUnit = (unit: unknown, qty: number): { unit: IngredientUnit; qty: number } | null => {
  const u = String(unit || '').toLowerCase().trim();
  if (['g', 'gr', 'gram', 'grams'].includes(u)) return { unit: 'g', qty };
  if (['kg', 'kilo', 'kilogram', 'kilograms'].includes(u)) return { unit: 'g', qty: qty * 1000 };
  if (['ml', 'milliliter', 'milliliters', 'millilitre', 'millilitres'].includes(u)) return { unit: 'ml', qty };
  if (['l', 'liter', 'liters', 'litre', 'litres'].includes(u)) return { unit: 'ml', qty: qty * 1000 };
  if (['pcs', 'pc', 'piece', 'pieces', 'unit', 'units', 'x', '', 'whole', 'item', 'items', 'clove', 'cloves'].includes(u)) return { unit: 'pcs', qty };
  if (['tbsp', 'tablespoon', 'tablespoons'].includes(u)) return { unit: 'ml', qty: qty * 15 };
  if (['tsp', 'teaspoon', 'teaspoons'].includes(u)) return { unit: 'ml', qty: qty * 5 };
  return null;
};

export const normalizeRecipes = (raw: any, food: FoodProfile | null): Recipe[] => {
  const list: any[] = Array.isArray(raw?.recipes) ? raw.recipes : [];
  const out: Recipe[] = [];
  const perSlot: Record<string, number> = {};
  for (const r of list) {
    const slot = String(r?.slot || '').toLowerCase() as MealSlot;
    if (!SLOT_ORDER.includes(slot)) continue;
    if ((perSlot[slot] || 0) >= RECIPES_PER_SLOT[slot]) continue;
    const name = clean(r?.name, 60);
    if (!name) continue;
    const ingredients: Ingredient[] = [];
    for (const i of Array.isArray(r?.ingredients) ? r.ingredients : []) {
      const iname = clean(i?.name, 40);
      const q = Number(i?.qty);
      if (!iname || !Number.isFinite(q) || q <= 0) continue;
      const u = normalizeUnit(i?.unit, q);
      if (!u || u.qty > 3000) continue;
      const section = SECTIONS.includes(String(i?.section) as GrocerySection) ? (String(i.section) as GrocerySection) : 'other';
      ingredients.push({ name: iname, qty: u.unit === 'pcs' ? Math.max(0.5, Math.round(u.qty * 2) / 2) : Math.max(1, Math.round(u.qty)), unit: u.unit, section, carb: i?.carb === true });
      if (ingredients.length >= 8) break;
    }
    if (ingredients.length < 2) continue;
    const recipe: Recipe = {
      id: `r-${slot}-${(perSlot[slot] || 0) + 1}`,
      slot,
      name,
      prepMinutes: Math.max(1, Math.min(120, Math.round(Number(r?.prepMinutes)) || 15)),
      howTo: clean(r?.howTo, 180),
      ingredients,
    };
    if (!recipeAllowed(recipe, food)) continue; // diet / allergy safety net
    perSlot[slot] = (perSlot[slot] || 0) + 1;
    out.push(recipe);
  }
  return out;
};

// ---------------------------------------------------------------------------------------------
// Building the week
// ---------------------------------------------------------------------------------------------

const baseTargets = (profile: UserProfile) => calculateEnergyAndMacros(profile.bodyMetrics || DEFAULT_BODY_METRICS, profile.level);

const buildDays = (startDate: string, recipes: Recipe[], base: CalculatedNutritionTargets): WeekDay[] => {
  const bySlot = (slot: MealSlot) => recipes.filter((r) => r.slot === slot);
  return Array.from({ length: 7 }, (_, i) => {
    const date = addDays(startDate, i);
    const t = getDayTargets(base, keyToDate(date));
    const pick = (slot: MealSlot, offset: number) => {
      const list = bySlot(slot);
      return list.length ? list[(i + offset) % list.length].id : '';
    };
    return {
      date,
      dayType: t.dayType,
      carbFactor: Math.round((t.carbs / Math.max(1, base.carbs)) * 100) / 100,
      recipeIds: { breakfast: pick('breakfast', 0), lunch: pick('lunch', 0), snack: pick('snack', 0), dinner: pick('dinner', 1) },
    };
  });
};

const buildWeekPrompt = (profile: UserProfile, food: FoodProfile | null, base: CalculatedNutritionTargets): string => {
  const metrics = profile.bodyMetrics || DEFAULT_BODY_METRICS;
  const imc = calculateIMC(metrics.weightKg, metrics.heightCm);
  const skeleton = buildMealSkeleton(base);
  const goal = getTrainingGoalForNutrition();
  return `
Role: THEIA, the System's nutrition module. The Hunter is a real person: real, ordinary food only.
Hunter: ${base.weightKg} kg, ${base.heightCm} cm, IMC ${imc.imc}. Diet goal: ${base.goalTitle}. Daily target ~${base.calories} kcal, ${base.protein} g protein.
${metrics.country ? `Region: ${metrics.country}: use foods sold in ordinary supermarkets there.` : 'Region: unspecified: globally common foods.'}
Food rules: ${foodRulesForPrompt(food)}.
${goal ? `Training goal: ${goal}.` : ''}
Design a meal-prep week: exactly 2 breakfast, 3 lunch, 2 snack and 3 dinner recipes. They rotate through 7 days.
SHARE ingredients across recipes so the shopping list stays short and cheap. Batch-cooking friendly.
Per serving, size each recipe for its slot: breakfast ~${skeleton[0].calories} kcal / ${skeleton[0].protein} g protein, lunch ~${skeleton[1].calories} / ${skeleton[1].protein} g, snack ~${skeleton[2].calories} / ${skeleton[2].protein} g (eaten before training), dinner ~${skeleton[3].calories} / ${skeleton[3].protein} g.
Ingredients: 2-6 each, quantity per ONE serving, unit "g", "ml" or "pcs" only, raw/dry weights, section one of produce|protein|dairy|grains|pantry|frozen|other. Mark the meal's main carb source with "carb":true (rice, pasta, oats, bread, potatoes...).
howTo: one short sentence.
Return ONLY valid JSON (no markdown):
{"recipes":[{"slot":"lunch","name":"Chicken, rice and broccoli","prepMinutes":25,"howTo":"...","ingredients":[{"name":"Chicken breast","qty":180,"unit":"g","section":"protein"},{"name":"Rice","qty":90,"unit":"g","section":"grains","carb":true}]}]}
`.trim();
};

/** Asks THEIA for the week's recipes; never throws (System library fills any gap). */
export const designNutritionWeek = async (profile: UserProfile, food: FoodProfile | null): Promise<NutritionWeek> => {
  const base = baseTargets(profile);
  const factor = Math.max(0.7, Math.min(1.5, base.calories / 2600));
  let recipes: Recipe[] = [];
  let origin: 'ai' | 'system' = 'system';
  try {
    const raw = await aiGatewayClient.completeJson<any>(buildWeekPrompt(profile, food, base), {
      temperature: 0.5,
      maxTokens: 3500,
      thinkingBudget: 0,
      providerOverride: 'lab',
      maxRetries: 1,
      skipCache: true,
    });
    recipes = normalizeRecipes(raw, food);
    if (recipes.length >= 4) origin = 'ai';
    else recipes = [];
  } catch (e) {
    console.warn('[Weekly Rations] THEIA unreachable, using the System library:', e);
  }
  // Fill every slot up to its count from the System library (or the whole week).
  for (const slot of SLOT_ORDER) {
    const have = recipes.filter((r) => r.slot === slot).length;
    if (have >= RECIPES_PER_SLOT[slot]) continue;
    const extra = systemRecipesFor(slot, food, factor).slice(0, RECIPES_PER_SLOT[slot] - have);
    recipes.push(...extra);
  }
  const startDate = getTodayKey();
  return {
    id: `week-${Date.now().toString(36)}`,
    startDate,
    generatedAt: new Date().toISOString(),
    origin,
    recipes,
    days: buildDays(startDate, recipes, base),
    checked: [],
    supplyRewarded: false,
  };
};

/** One recipe on one day: carb ingredients scaled to that day's training. */
export const dayIngredients = (recipe: Recipe, day: WeekDay): Ingredient[] =>
  recipe.ingredients.map((i) => {
    if (!i.carb || day.carbFactor === 1) return i;
    const qty = i.qty * day.carbFactor;
    return { ...i, qty: i.unit === 'pcs' ? Math.max(0.5, Math.round(qty * 2) / 2) : Math.max(5, Math.round(qty / 5) * 5) };
  });

const fmtQty = (qty: number, unit: IngredientUnit): string => {
  if (unit === 'pcs') return `${Number.isInteger(qty) ? qty : qty.toFixed(1)}×`;
  if (qty >= 1000) return `${(qty / 1000).toFixed(qty % 1000 === 0 ? 0 : 1)} ${unit === 'g' ? 'kg' : 'L'}`;
  return `${Math.round(qty)} ${unit}`;
};
export const formatIngredient = (i: Ingredient) => (i.unit === 'pcs' ? `${fmtQty(i.qty, 'pcs')} ${i.name}` : `${fmtQty(i.qty, i.unit)} ${i.name}`);

/** Today's daily plan, built from the week. Same meal ids as every daily plan. */
export const buildDayPlanFromWeek = (week: NutritionWeek, profile: UserProfile, date = getTodayKey()): NutritionPlan | null => {
  const day = week.days.find((d) => d.date === date);
  if (!day) return null;
  const metrics = profile.bodyMetrics || DEFAULT_BODY_METRICS;
  const base = baseTargets(profile);
  const targets = getDayTargets(base, keyToDate(date));
  const imc = calculateIMC(metrics.weightKg, metrics.heightCm);
  const skeleton = buildMealSkeleton(targets);
  const meals = skeleton.map((slot, i) => {
    const recipe = week.recipes.find((r) => r.id === day.recipeIds[SLOT_ORDER[i]]);
    const restSnack = SLOT_ORDER[i] === 'snack' && targets.dayType === 'rest';
    return {
      id: slot.id,
      name: slot.name,
      time: slot.time,
      items: recipe ? dayIngredients(recipe, day).map(formatIngredient) : ['Whole-food intake within targets'],
      calories: slot.calories,
      protein: slot.protein,
      notes: recipe
        ? `${recipe.name} · ${recipe.prepMinutes} min${restSnack ? ' · Rest day: no session to fuel, eat it when hungry.' : recipe.howTo ? ` · ${recipe.howTo}` : ''}`
        : slot.notes,
    };
  });
  return {
    date,
    goal: targets.goalTitle,
    calories: targets.calories,
    protein: targets.protein,
    carbs: targets.carbs,
    fats: targets.fats,
    waterLiters: targets.waterLiters,
    meals,
    directive: targets.directive,
    origin: week.origin,
    generatedAt: week.generatedAt,
    weekId: week.id,
    dayType: targets.dayType,
    biometrics: { weightKg: targets.weightKg, heightCm: targets.heightCm, imc: imc.imc, imcCategory: imc.label, goal: targets.goalTitle },
  };
};

/**
 * Keeps today's daily plan in step with the active week (after a new week, a new day, a body
 * recalibration or a training change). Saves only when something actually changed.
 */
export const syncTodayFromWeek = (profile: UserProfile): NutritionPlan | null => {
  const week = getActiveWeek();
  if (!week) return null;
  const plan = buildDayPlanFromWeek(week, profile);
  if (!plan) return null;
  const current = getStoredNutritionPlan(plan.date);
  const same = current && current.weekId === plan.weekId && JSON.stringify(current.meals) === JSON.stringify(plan.meals) && current.calories === plan.calories;
  if (!same) saveNutritionPlan(plan);
  return same ? current : plan;
};

export const acceptNutritionWeek = (week: NutritionWeek, profile: UserProfile): void => {
  saveNutritionWeek(week);
  syncTodayFromWeek(profile);
};

export const endNutritionWeek = (): void => {
  const today = getStoredNutritionPlan();
  saveNutritionWeek(null);
  if (today?.weekId) clearStoredNutritionPlan();
};

// ---------------------------------------------------------------------------------------------
// Supply List
// ---------------------------------------------------------------------------------------------

export interface SupplyItem {
  key: string;
  name: string;
  section: GrocerySection;
  qty: number;
  unit: IngredientUnit;
  label: string;
}

const nameKey = (n: string) => {
  const k = n.toLowerCase().replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim();
  if (k.length <= 3 || k.endsWith('ss')) return k;
  if (k.endsWith('oes')) return k.slice(0, -2);
  if (k.endsWith('ies')) return `${k.slice(0, -3)}y`;
  return k.endsWith('s') ? k.slice(0, -1) : k;
};

/** Shopping-friendly rounding: up, never down. */
const roundUp = (qty: number, unit: IngredientUnit) => {
  if (unit === 'pcs') return Math.ceil(qty);
  const step = qty < 200 ? 10 : qty < 1000 ? 50 : 100;
  return Math.ceil(qty / step) * step;
};

export const buildSupplyList = (week: NutritionWeek): SupplyItem[] => {
  const map = new Map<string, SupplyItem>();
  for (const day of week.days) {
    for (const slot of SLOT_ORDER) {
      const recipe = week.recipes.find((r) => r.id === day.recipeIds[slot]);
      if (!recipe) continue;
      for (const ing of dayIngredients(recipe, day)) {
        const key = `${nameKey(ing.name)}|${ing.unit}`;
        const cur = map.get(key);
        if (cur) cur.qty += ing.qty;
        else map.set(key, { key, name: ing.name, section: ing.section, qty: ing.qty, unit: ing.unit, label: '' });
      }
    }
  }
  return [...map.values()]
    .map((i) => {
      const qty = roundUp(i.qty, i.unit);
      return { ...i, qty, label: i.unit === 'pcs' ? `${qty}× ${i.name}` : `${i.name} · ${fmtQty(qty, i.unit)}` };
    })
    .sort((a, b) => SECTIONS.indexOf(a.section) - SECTIONS.indexOf(b.section) || a.name.localeCompare(b.name));
};

export const supplyListText = (week: NutritionWeek): string => {
  const items = buildSupplyList(week);
  const lines = [`SUPPLY RUN · ${week.days[0].date} → ${week.days[6].date}`];
  for (const section of SECTIONS) {
    const inSection = items.filter((i) => i.section === section);
    if (!inSection.length) continue;
    lines.push('', SECTION_LABELS[section]);
    for (const i of inSection) lines.push(`${week.checked.includes(i.key) ? '[x]' : '[ ]'} ${i.label}`);
  }
  return lines.join('\n');
};

/** Toggles one Supply List item. Returns the updated week and whether the run was just completed. */
export const toggleSupplyItem = (key: string): { week: NutritionWeek | null; completedNow: boolean } => {
  const week = getNutritionWeek();
  if (!week) return { week: null, completedNow: false };
  const checked = week.checked.includes(key) ? week.checked.filter((k) => k !== key) : [...week.checked, key];
  const all = buildSupplyList(week).map((i) => i.key);
  const complete = all.length > 0 && all.every((k) => checked.includes(k));
  const completedNow = complete && !week.supplyRewarded;
  const next = { ...week, checked, supplyRewarded: week.supplyRewarded || completedNow };
  saveNutritionWeek(next);
  return { week: next, completedNow };
};

