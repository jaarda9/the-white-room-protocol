import { UserProfile, Quest, QuestCategory, QuestAttempt, Attributes, KnowledgeDomain, KnowledgeData, KnowledgeProgress, KnowledgeTopic, QuizQuestion, QuizResult, ToDoItem, UserBodyMetrics } from './types';
import { scheduleSyncAfterGeneratedContentSave, syncManager } from './sync-manager';
import aiGatewayClient from './ai-gateway-client';
import { PRESET_SPLIT_TEMPLATES, getExerciseById, ExerciseDefinition } from './exercise-library';
import { recordOverdriveSession, getUnlockedAchievements } from './achievements';
import { getEquippedTitleEffect } from './titles';
import { getEffectiveSealXpMultiplier } from './seal-xp-modifier';

export const QUESTS_UPDATED_EVENT = 'wrp:quests-updated';
export const TODOS_UPDATED_EVENT = 'wrp:todos-updated';
export const PROTOCOL_CALIBRATED_EVENT = 'wrp:protocol-calibrated';
export const INVENTORY_UPDATED_EVENT = 'wrp:inventory-updated';

const STORAGE_KEYS = {
  USER_PROFILE: 'whiteroom_user_profile',
  QUESTS: 'whiteroom_quests',
  QUEST_ATTEMPTS: 'whiteroom_quest_attempts',
  DAILY_RESET: 'whiteroom_daily_reset',
  KNOWLEDGE_DATA: 'whiteroom_knowledge_data',
  PHYSICAL_QUEST_LOGS: 'whiteroom_physical_quest_logs',
  TODOS: 'whiteroom_todos',
  HUNTER_PROTOCOL_CONFIG: 'whiteroom_hunter_protocol_config',
  HUNTER_INVENTORY: 'whiteroom_hunter_inventory',
  ACTIVITY_LEDGER: 'whiteroom_activity_ledger',
};

export const getTodayKeyLocal = (d: Date = new Date()): string => {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const safeParseJson = <T,>(raw: string | null, fallback: T): T => {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
};

const sanitizeToDoReward = (todo: Pick<ToDoItem, 'xp' | 'hiddenRewards'>): Pick<ToDoItem, 'xp' | 'hiddenRewards'> => {
  const xp = Number.isFinite(todo.xp) ? Math.max(1, Math.min(120, Math.round(todo.xp))) : 10;
  const allowedAttrs: Array<keyof Attributes> = ['STR', 'AGI', 'VIT', 'INT', 'PER', 'WIS'];
  const raw = todo.hiddenRewards && typeof todo.hiddenRewards === 'object' ? todo.hiddenRewards : {};
  const entries = Object.entries(raw)
    .filter(([k, v]) => allowedAttrs.includes(k as keyof Attributes) && Number.isFinite(Number(v)) && Number(v) > 0)
    .map(([k, v]) => [k, Math.max(1, Math.min(2, Math.round(Number(v))))] as const);
  // Max 2 stats to keep it balanced, consistent with other AI content.
  const trimmed = entries.slice(0, 2);
  const hiddenRewards: Partial<Attributes> = {};
  trimmed.forEach(([k, v]) => {
    hiddenRewards[k as keyof Attributes] = v;
  });
  return { xp, hiddenRewards };
};

export const getToDos = (): ToDoItem[] => {
  const stored = localStorage.getItem(STORAGE_KEYS.TODOS);
  const parsed = safeParseJson<ToDoItem[]>(stored, []);
  if (!Array.isArray(parsed)) return [];
  return parsed.filter((t) => t && typeof t === 'object' && typeof t.id === 'string' && typeof t.title === 'string');
};

export const saveToDos = (todos: ToDoItem[]): void => {
  localStorage.setItem(STORAGE_KEYS.TODOS, JSON.stringify(todos));
  scheduleSyncAfterGeneratedContentSave();
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(TODOS_UPDATED_EVENT));
  }
};

export const addToDo = (patch: Omit<ToDoItem, 'id' | 'createdAt' | 'status'> & { status?: ToDoItem['status'] }): ToDoItem => {
  const now = new Date().toISOString();
  const rewards = sanitizeToDoReward({ xp: patch.xp, hiddenRewards: patch.hiddenRewards });
  const item: ToDoItem = {
    id: crypto.randomUUID(),
    title: String(patch.title || '').trim().slice(0, 140) || 'Untitled To‑Do',
    notes: patch.notes ? String(patch.notes).slice(0, 600) : undefined,
    dueDate: patch.dueDate,
    status: patch.status ?? (patch.origin === 'ai' ? 'suggested' : 'active'),
    origin: patch.origin,
    createdAt: now,
    xp: rewards.xp,
    hiddenRewards: rewards.hiddenRewards,
    source: patch.source,
  };
  const existing = getToDos();
  saveToDos([item, ...existing]);
  return item;
};

export const acceptSuggestedToDo = (id: string): void => {
  const todos = getToDos();
  const updated = todos.map((t) => (t.id === id && t.status === 'suggested' ? { ...t, status: 'active' as const } : t));
  saveToDos(updated);
};

export const ignoreSuggestedToDo = (id: string): void => {
  const now = new Date().toISOString();
  const todos = getToDos();
  const updated = todos.map((t) => (t.id === id && t.status === 'suggested' ? { ...t, status: 'ignored' as const, ignoredAt: now } : t));
  saveToDos(updated);
};

/** Rolls an active To-Do's due date forward to today — used to keep a Gate's current task
 * visible in Tactical To-Dos day after day if the player skips it, instead of it silently
 * falling out of the "today" filter once its original due date passes. */
export const rescheduleToDoToToday = (id: string): void => {
  const todos = getToDos();
  const today = getTodayKeyLocal();
  const updated = todos.map((t) => (t.id === id && t.status === 'active' ? { ...t, dueDate: today } : t));
  saveToDos(updated);
};

/** Removes every completed To-Do regardless of due date — old completed items aren't even
 * shown once their due date passes (Tactical To-Dos only lists today's), so without this they
 * just accumulate invisibly forever instead of actually going away. */
export const clearCompletedToDos = (): void => {
  const todos = getToDos();
  saveToDos(todos.filter((t) => t.status !== 'completed'));
};

export const completeToDo = (id: string): void => {
  const todos = getToDos();
  const target = todos.find((t) => t.id === id);
  if (!target || target.status !== 'active') return;

  const now = new Date().toISOString();
  const updatedTodos = todos.map((t) =>
    t.id === id ? { ...t, status: 'completed' as const, completedAt: now } : t
  );
  saveToDos(updatedTodos);

  // Apply rewards
  const profile = getUserProfile();
  const withHidden: UserProfile = {
    ...profile,
    accumulatedPoints: { ...profile.accumulatedPoints },
  };
  Object.entries(target.hiddenRewards || {}).forEach(([attr, value]) => {
    const k = attr as keyof Attributes;
    const v = Number(value) || 0;
    if (v > 0 && typeof withHidden.accumulatedPoints[k] === 'number') {
      withHidden.accumulatedPoints[k] += v;
    }
  });
  const finalProfile = addXP(withHidden, target.xp);
  saveUserProfile(finalProfile);
};

// Initialize sync manager on module load
let syncInitialized = false;
const initializeSync = async () => {
  if (!syncInitialized) {
    try {
      await syncManager.initialize();
      syncInitialized = true;
    } catch (error) {
      console.error('Error initializing sync manager:', error);
    }
  }
};

// Auto-initialize sync
initializeSync();

// Guard: only one profile creation per page load to avoid race (e.g. Dashboard + initializeDataSync)
let profileCreationInProgress = false;

// Initialize default user profile
export const createDefaultProfile = (): UserProfile => ({
  id: crypto.randomUUID(),
  displayName: 'Subject',
  pseudo: `SUBJECT-${Math.random().toString(36).substring(2, 8).toUpperCase()}`,
  level: 1,
  xp: 0,
  xpToNextLevel: calculateXPForLevel(1),
  job: 'None',
  title: 'Novice Hunter',
  hunterRank: 'E',
  availableAP: 0,
  fatigue: 0,
  visibleStats: {
    STR: 10,
    AGI: 10,
    VIT: 10,
    INT: 10,
    PER: 10,
    WIS: 10,
  },
  accumulatedPoints: {
    STR: 0,
    AGI: 0,
    VIT: 0,
    INT: 0,
    PER: 0,
    WIS: 0,
  },
  createdAt: new Date().toISOString(),
  settings: {
    tone: 'clinical',
  },
  bodyMetrics: { ...DEFAULT_BODY_METRICS },
});

export const DEFAULT_BODY_METRICS: UserBodyMetrics = {
  weightKg: 72,
  heightCm: 175,
  age: 24,
  gender: 'male',
  activityLevel: 'moderate',
  dietaryGoal: 'bulk',
  isCalibrated: false,
};

export const getUserBodyMetrics = (): UserBodyMetrics => {
  const profile = getUserProfile();
  return profile.bodyMetrics || { ...DEFAULT_BODY_METRICS };
};

export const saveUserBodyMetrics = (metrics: Partial<UserBodyMetrics>): UserProfile => {
  const profile = getUserProfile();
  const updated: UserProfile = {
    ...profile,
    bodyMetrics: {
      ...(profile.bodyMetrics || DEFAULT_BODY_METRICS),
      ...metrics,
      isCalibrated: true,
      lastUpdated: new Date().toISOString(),
    },
  };
  saveUserProfile(updated);
  return updated;
};

/** Player-supplied Gemini API key (Hunter Dossier). Pass null/empty to clear and fall back to the shared server key. */
export const saveUserGeminiApiKey = (apiKey: string | null): UserProfile => {
  const profile = getUserProfile();
  const updated: UserProfile = {
    ...profile,
    geminiApiKey: apiKey && apiKey.trim() ? apiKey.trim() : undefined,
  };
  saveUserProfile(updated);
  return updated;
};

export const getHunterRank = (level: number): 'E' | 'D' | 'C' | 'B' | 'A' | 'S' => {
  if (level >= 50) return 'S';
  if (level >= 40) return 'A';
  if (level >= 30) return 'B';
  if (level >= 20) return 'C';
  if (level >= 10) return 'D';
  return 'E';
};

export const getHunterJob = (level: number, customJob?: string): string => {
  if (customJob && customJob !== 'None') return customJob;
  if (level >= 50) return 'Shadow Monarch';
  if (level >= 40) return 'Monarch Vessel';
  if (level >= 30) return 'High Necromancer';
  if (level >= 20) return 'Necromancer';
  if (level >= 10) return 'Striker';
  return 'None';
};

export const getHunterTitle = (level: number, customTitle?: string): string => {
  if (customTitle && customTitle !== 'Wolf Assassin' && customTitle !== 'Novice Hunter') return customTitle;
  if (level >= 50) return 'Supreme Sovereign';
  if (level >= 40) return 'Ruler of the Dead';
  if (level >= 30) return 'Demon Slayer';
  if (level >= 20) return 'Dungeon Conqueror';
  if (level >= 10) return 'Wolf Assassin';
  return 'Novice Hunter';
};

export const getHunterVitals = (profile: UserProfile): {
  hp: { current: number; max: number };
  mp: { current: number; max: number };
  stm: { current: number; max: number };
  fatigue: number;
} => {
  const vit = Number(profile.visibleStats?.VIT) || 10;
  const str = Number(profile.visibleStats?.STR) || 10;
  const int = Number(profile.visibleStats?.INT) || 10;
  const per = Number(profile.visibleStats?.PER) || 10;
  const lvl = profile.level || 1;

  // Normalized 100-scale with subtle stat bonuses (100 to 150 range)
  const maxHp = Math.min(150, Math.floor(100 + (vit - 10) * 0.4 + Math.min(20, (lvl - 1) * 0.1)));
  const maxMp = Math.min(150, Math.floor(100 + (int - 10) * 0.4 + Math.min(20, (lvl - 1) * 0.1)));
  const maxStm = Math.min(130, Math.floor(100 + (vit - 10) * 0.2));
  const fatigue = Math.max(0, Math.min(100, profile.fatigue ?? 0));

  // Current values clamped to [0, max]
  const currentHp = Math.max(0, Math.min(maxHp, profile.hp?.current !== undefined ? profile.hp.current : maxHp));
  const currentMp = Math.max(0, Math.min(maxMp, profile.mp?.current !== undefined ? profile.mp.current : maxMp));
  const currentStm = Math.max(0, Math.min(maxStm, profile.stm?.current !== undefined ? profile.stm.current : Math.max(0, maxStm - fatigue)));

  return {
    hp: { current: currentHp, max: maxHp },
    mp: { current: currentMp, max: maxMp },
    stm: { current: currentStm, max: maxStm },
    fatigue,
  };
};

/** Minutes of continuous real-world rest to go from 0% to 100% recovery — replaces the old
 * instant nightly reset. Deliberately keyed off elapsedMinutes (time since vitals were last
 * touched by any real action), not the calendar day, so genuinely working through the night
 * — a Gate Wave, a quest, anything that calls consumePhysicalEnergy/consumeMentalEnergy —
 * resets this clock exactly like it would interrupt real sleep. */
const REST_FULL_MINUTES = 450; // 7.5 hours
/** Below this gap, treat it as a normal short break during waking hours (the existing small
 * trickle); at/above it, switch to the gradual rest curve. */
const REST_LONG_GAP_MINUTES = 180; // 3 hours

export const applyVitalsRegeneration = (profile: UserProfile): { profile: UserProfile; changed: boolean } => {
  const now = Date.now();
  const lastUpdated = profile.vitalsLastUpdatedAt || now;
  const elapsedMinutes = Math.max(0, (now - lastUpdated) / 60000);

  const vitals = getHunterVitals(profile);
  let hp = vitals.hp.current;
  let mp = vitals.mp.current;
  let stm = vitals.stm.current;
  let fatigue = vitals.fatigue;
  let changed = false;

  // Local calendar day — must match the day boundary the daily quest reset uses
  // (getDailyQuests() / DAILY_RESET), or the two can disagree on "today" by several
  // hours depending on the player's timezone offset from UTC.
  const todayStr = getTodayKeyLocal();
  const isNewDay = Boolean(profile.lastRestDate && profile.lastRestDate !== todayStr);

  const physicalPlan = getPhysicalDayPlan(new Date());
  const isRestDay = Boolean(physicalPlan.isRestDay);

  // Missed-mandatory-quest bookkeeping is now purely a once-per-day-boundary check — it no
  // longer touches HP directly. A miss stacks the streak and queues a System-assigned Penalty
  // Quest / Detox Protocol instead (see penalty-system.ts + PENDING_PENALTY_ASSIGNMENT_KEY).
  let missedQuestStreak = profile.missedQuestStreak || 0;
  if (isNewDay) {
    const prevQuestsRaw = localStorage.getItem(STORAGE_KEYS.QUESTS);
    let hadIncompleteMandatory = false;
    if (prevQuestsRaw) {
      try {
        const prevQuests = JSON.parse(prevQuestsRaw);
        if (Array.isArray(prevQuests) && prevQuests.length > 0) {
          hadIncompleteMandatory = prevQuests.some(
            (q: any) => q.origin === 'system' && !q.completed && !q.isChainBonus
          );
        }
      } catch {}
    }

    if (hadIncompleteMandatory) {
      missedQuestStreak += 1;
      changed = true;
      try {
        localStorage.setItem(
          PENDING_PENALTY_ASSIGNMENT_KEY,
          JSON.stringify({ streak: missedQuestStreak, date: todayStr })
        );
      } catch {
        // ignore
      }
    }
  }

  const wis = Number(profile.visibleStats?.WIS) || 10;
  let recoveryMultiplier = 1 + Math.min(1.5, (wis - 10) * 0.015);
  if (isRestDay) recoveryMultiplier *= 2.0;

  // Title Effects: some equipped titles boost specific regen rates (e.g. Peak Vitality ->
  // HP/STM, Ruler of the Dead -> MP) — see titles.ts. Only ever active while equipped.
  const titleEffect = getEquippedTitleEffect(profile.title);
  const hpRegenMultiplier = titleEffect.hpRegenMultiplier ?? 1;
  const stmRegenMultiplier = titleEffect.stmRegenMultiplier ?? 1;
  const mpRegenMultiplier = titleEffect.mpRegenMultiplier ?? 1;

  if (elapsedMinutes >= REST_LONG_GAP_MINUTES) {
    // A long gap since vitals were last touched — plausibly real sleep (or at least a long
    // break). Recovery approaches its ceiling smoothly instead of snapping there instantly;
    // an active Penalty/Detox debuff caps how far even a full rest window can reach.
    const debuffCap = profile.activeDebuff?.recoveryCapMultiplier ?? 1;
    const restFraction = Math.min(1, (elapsedMinutes * recoveryMultiplier) / REST_FULL_MINUTES) * debuffCap;

    if (restFraction > 0) {
      const newFatigue = Math.max(0, Math.round(fatigue * (1 - restFraction)));
      const newHp = Math.min(vitals.hp.max, hp + Math.round(40 * restFraction * hpRegenMultiplier));
      const newMp = Math.min(vitals.mp.max, mp + Math.round(50 * restFraction * mpRegenMultiplier));
      const newStm = Math.min(vitals.stm.max, stm + Math.round((vitals.stm.max - stm) * restFraction * stmRegenMultiplier));
      if (newFatigue !== fatigue || newHp !== hp || newMp !== mp || newStm !== stm) changed = true;
      fatigue = newFatigue;
      hp = newHp;
      mp = newMp;
      stm = newStm;
    }
  } else if (elapsedMinutes >= 1) {
    // Short gap during normal waking-hours play — unchanged from before.
    if (isRestDay && fatigue > 0) {
      // Supercompensation on Rest Days: fatigue flush (rate boost is in recoveryMultiplier above)
      fatigue = 0;
      changed = true;
    }
    if (isRestDay) {
      // Passive HP healing on Rest Days
      const hpGain = Math.floor(elapsedMinutes * 0.25 * recoveryMultiplier * hpRegenMultiplier);
      if (hpGain > 0 && hp < vitals.hp.max) {
        hp = Math.min(vitals.hp.max, hp + hpGain);
        changed = true;
      }
    }

    // STM natural recovery: ~0.5 per minute (scales with WIS & Rest Day)
    const stmGain = Math.floor(elapsedMinutes * 0.5 * recoveryMultiplier * stmRegenMultiplier);
    if (stmGain > 0 && stm < vitals.stm.max) {
      stm = Math.min(vitals.stm.max, stm + stmGain);
      changed = true;
    }

    // MP natural recovery: ~0.4 per minute
    const mpGain = Math.floor(elapsedMinutes * 0.4 * recoveryMultiplier * mpRegenMultiplier);
    if (mpGain > 0 && mp < vitals.mp.max) {
      mp = Math.min(vitals.mp.max, mp + mpGain);
      changed = true;
    }

    // Fatigue natural dissipation: ~0.2% per minute
    const fatigueLoss = Math.floor(elapsedMinutes * 0.2 * (isRestDay ? 2 : 1));
    if (fatigueLoss > 0 && fatigue > 0) {
      fatigue = Math.max(0, fatigue - fatigueLoss);
      changed = true;
    }

    // Sustained overtraining: staying at 90%+ Fatigue while still active (not resting) bleeds
    // HP continuously rather than a single one-shot hit — the longer you stay redlined, the
    // more it costs, down to the same 15%-max safety floor as everywhere else.
    if (fatigue >= 90 && hp > Math.max(15, Math.floor(vitals.hp.max * 0.15))) {
      const hpFloor = Math.max(15, Math.floor(vitals.hp.max * 0.15));
      const hpBleed = Math.floor(elapsedMinutes * 0.15);
      if (hpBleed > 0) {
        hp = Math.max(hpFloor, hp - hpBleed);
        changed = true;
      }
    }
  }

  // Tame any previously un-normalized values (e.g. 8232 HP)
  if (hp > vitals.hp.max) {
    hp = vitals.hp.max;
    changed = true;
  }
  if (mp > vitals.mp.max) {
    mp = vitals.mp.max;
    changed = true;
  }
  if (stm > vitals.stm.max) {
    stm = vitals.stm.max;
    changed = true;
  }

  return {
    profile: {
      ...profile,
      fatigue,
      hp: { current: hp, max: vitals.hp.max },
      mp: { current: mp, max: vitals.mp.max },
      stm: { current: stm, max: vitals.stm.max },
      vitalsLastUpdatedAt: now,
      lastRestDate: todayStr,
      missedQuestStreak,
    },
    changed: changed || !profile.vitalsLastUpdatedAt || profile.lastRestDate !== todayStr,
  };
};

export interface VitalsConsumptionResult {
  profile: UserProfile;
  inOverdrive: boolean;
  message: string;
}

export const consumePhysicalEnergy = (
  _profile: UserProfile,
  intensity: 'light' | 'moderate' | 'heavy' = 'moderate'
): VitalsConsumptionResult => {
  // Re-fetch rather than trusting the caller's (possibly minutes-stale) profile object —
  // otherwise passive regen accrued since it was fetched gets silently discarded, and
  // stamping vitalsLastUpdatedAt to "now" below would make that regen unrecoverable rather
  // than just delayed.
  const current = getUserProfile();
  const vitals = getHunterVitals(current);
  const vit = Number(current.visibleStats?.VIT) || 10;
  const str = Number(current.visibleStats?.STR) || 10;

  const baseCost = intensity === 'light' ? 10 : intensity === 'heavy' ? 25 : 18;
  const baseFatigue = intensity === 'light' ? 6 : intensity === 'heavy' ? 15 : 10;

  // Resistance reduction from VIT and STR (up to 50% discount)
  const discount = Math.min(0.5, (vit - 10) * 0.005 + (str - 10) * 0.003);
  const stmCost = Math.max(6, Math.floor(baseCost * (1 - discount)));
  const fatigueGain = Math.max(4, Math.floor(baseFatigue * (1 - Math.min(0.5, (vit - 10) * 0.005))));

  let currentStm = vitals.stm.current;
  let currentFatigue = vitals.fatigue;
  let currentHp = vitals.hp.current;
  let inOverdrive = false;
  let message = `Spent -${stmCost} STM (+${fatigueGain}% Fatigue)`;

  const hpFloor = Math.max(15, Math.floor(vitals.hp.max * 0.15));
  // Title Effect: The Indomitable Will softens the extra strain from pushing through zero
  // stamina/mana — see titles.ts. Only the overdrive-specific penalty, not the base fatigue.
  const overdriveFatigueMultiplier = getEquippedTitleEffect(current.title).overdriveFatigueMultiplier ?? 1;

  if (currentStm < stmCost) {
    inOverdrive = true;
    currentStm = 0;
    // Overdrive adds extra fatigue strain, and now costs real HP too — pushing your body past
    // zero stamina is genuine self-damage, not just an inconvenience.
    currentFatigue = Math.min(100, currentFatigue + fatigueGain + Math.round(5 * overdriveFatigueMultiplier));
    if (currentHp > hpFloor) {
      currentHp = Math.max(hpFloor, currentHp - 4);
    }
    message = `[OVERDRIVE PROTOCOL: WILLPOWER DEPTHS] Pushed through zero stamina! (-4 HP)`;
    try {
      recordOverdriveSession();
    } catch {}
  } else {
    currentStm = Math.max(0, currentStm - stmCost);
    currentFatigue = Math.min(100, currentFatigue + fatigueGain);
  }

  const updated: UserProfile = {
    ...current,
    fatigue: currentFatigue,
    hp: { current: currentHp, max: vitals.hp.max },
    mp: vitals.mp,
    stm: { current: currentStm, max: vitals.stm.max },
    vitalsLastUpdatedAt: Date.now(),
  };

  saveUserProfile(updated);
  return { profile: updated, inOverdrive, message };
};

export const consumeMentalEnergy = (
  _profile: UserProfile,
  intensity: 'light' | 'moderate' | 'heavy' = 'moderate'
): VitalsConsumptionResult => {
  // See consumePhysicalEnergy above — re-fetch instead of trusting a possibly-stale profile.
  const current = getUserProfile();
  const vitals = getHunterVitals(current);
  const int = Number(current.visibleStats?.INT) || 10;
  const wis = Number(current.visibleStats?.WIS) || 10;

  const baseCost = intensity === 'light' ? 8 : intensity === 'heavy' ? 22 : 15;
  const baseFatigue = intensity === 'light' ? 5 : intensity === 'heavy' ? 12 : 8;

  // Resistance reduction from INT and WIS (up to 50% discount)
  const discount = Math.min(0.5, (int - 10) * 0.005 + (wis - 10) * 0.003);
  const mpCost = Math.max(5, Math.floor(baseCost * (1 - discount)));
  const fatigueGain = Math.max(3, Math.floor(baseFatigue * (1 - Math.min(0.5, (wis - 10) * 0.005))));

  let currentMp = vitals.mp.current;
  let currentFatigue = vitals.fatigue;
  let currentHp = vitals.hp.current;
  let inOverdrive = false;
  let message = `Spent -${mpCost} MP (+${fatigueGain}% Fatigue)`;

  const hpFloor = Math.max(15, Math.floor(vitals.hp.max * 0.15));
  // Title Effect: The Indomitable Will softens the extra strain from pushing through zero
  // stamina/mana — see titles.ts. Only the overdrive-specific penalty, not the base fatigue.
  const overdriveFatigueMultiplier = getEquippedTitleEffect(current.title).overdriveFatigueMultiplier ?? 1;

  if (currentMp < mpCost) {
    inOverdrive = true;
    currentMp = 0;
    currentFatigue = Math.min(100, currentFatigue + fatigueGain + Math.round(4 * overdriveFatigueMultiplier));
    // Mental overdrive costs a touch less HP than physical (see consumePhysicalEnergy) — real,
    // but burnout is a slower bleed than physically running yourself into the ground.
    if (currentHp > hpFloor) {
      currentHp = Math.max(hpFloor, currentHp - 3);
    }
    message = `[OVERDRIVE PROTOCOL: MENTAL FORTITUDE] Pushed through mental exhaustion! (-3 HP)`;
    try {
      recordOverdriveSession();
    } catch {}
  } else {
    currentMp = Math.max(0, currentMp - mpCost);
    currentFatigue = Math.min(100, currentFatigue + fatigueGain);
  }

  const updated: UserProfile = {
    ...current,
    fatigue: currentFatigue,
    hp: { current: currentHp, max: vitals.hp.max },
    mp: { current: currentMp, max: vitals.mp.max },
    stm: vitals.stm,
    vitalsLastUpdatedAt: Date.now(),
  };

  saveUserProfile(updated);
  return { profile: updated, inOverdrive, message };
};

export type ConsumableType = 'hydrate' | 'focusBrew' | 'coldExposure' | 'activeRest';

export interface ConsumableConfig {
  id: ConsumableType;
  name: string;
  category: string;
  realWorldAction: string;
  effectDescription: string;
  dailyMax: number;
  cooldownMinutes: number;
  icon: 'Droplets' | 'Coffee' | 'Snowflake' | 'Sparkles';
}

export const CONSUMABLE_CONFIGS: Record<ConsumableType, ConsumableConfig> = {
  hydrate: {
    id: 'hydrate',
    name: 'Pure Spring Water',
    category: 'Cellular Hydration',
    realWorldAction: 'Drink 1 full glass of fresh water (250–300ml)',
    effectDescription: '+15 STM • -5% Fatigue',
    dailyMax: 8,
    cooldownMinutes: 15,
    icon: 'Droplets',
  },
  focusBrew: {
    id: 'focusBrew',
    name: 'Focus Catalyst',
    category: 'Cognitive Stimulant',
    realWorldAction: 'Drink 1 cup of coffee, green tea, or matcha',
    effectDescription: '+25 MP',
    dailyMax: 3,
    cooldownMinutes: 60,
    icon: 'Coffee',
  },
  coldExposure: {
    id: 'coldExposure',
    name: 'Cryo-Immersion',
    category: 'Thermal Shock Reset',
    realWorldAction: 'Take a cold shower (1–3 min) or splash face with icy water',
    effectDescription: '+20 MP • +10 STM • -10% Fatigue',
    dailyMax: 2,
    cooldownMinutes: 180,
    icon: 'Snowflake',
  },
  activeRest: {
    id: 'activeRest',
    name: 'Active Recovery',
    category: 'Parasympathetic Reset',
    realWorldAction: '5–10 min mindful box breathing, posture reset, or light stretch',
    effectDescription: '+5 HP • -10% Fatigue',
    dailyMax: 2,
    cooldownMinutes: 45,
    icon: 'Sparkles',
  },
};

export interface ConsumableItemState {
  usedToday: number;
  lastUsedAt: number | null;
}

export interface InventoryState {
  lastResetDate: string;
  items: Record<ConsumableType, ConsumableItemState>;
}

const getDefaultInventoryState = (dateStr: string): InventoryState => ({
  lastResetDate: dateStr,
  items: {
    hydrate: { usedToday: 0, lastUsedAt: null },
    focusBrew: { usedToday: 0, lastUsedAt: null },
    coldExposure: { usedToday: 0, lastUsedAt: null },
    activeRest: { usedToday: 0, lastUsedAt: null },
  },
});

export const getHunterInventory = (): InventoryState => {
  const todayStr = getTodayKeyLocal(new Date());
  const stored = localStorage.getItem(STORAGE_KEYS.HUNTER_INVENTORY);
  let state = safeParseJson<InventoryState | null>(stored, null);

  if (!state || !state.items) {
    state = getDefaultInventoryState(todayStr);
    localStorage.setItem(STORAGE_KEYS.HUNTER_INVENTORY, JSON.stringify(state));
    return state;
  }

  // Ensure all keys exist
  let modified = false;
  const itemKeys: ConsumableType[] = ['hydrate', 'focusBrew', 'coldExposure', 'activeRest'];
  itemKeys.forEach((key) => {
    if (!state!.items[key]) {
      state!.items[key] = { usedToday: 0, lastUsedAt: null };
      modified = true;
    }
  });

  // Check if calendar day changed -> reset daily counts, preserve cooldown timestamp
  if (state.lastResetDate !== todayStr) {
    state.lastResetDate = todayStr;
    itemKeys.forEach((key) => {
      state!.items[key].usedToday = 0;
    });
    modified = true;
  }

  if (modified) {
    localStorage.setItem(STORAGE_KEYS.HUNTER_INVENTORY, JSON.stringify(state));
  }

  return state;
};

export const saveHunterInventory = (inventory: InventoryState): void => {
  localStorage.setItem(STORAGE_KEYS.HUNTER_INVENTORY, JSON.stringify(inventory));
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(INVENTORY_UPDATED_EVENT));
  }
};

export const consumeInventoryItem = (
  itemId: ConsumableType
): {
  success: boolean;
  message: string;
  cooldownRemainingSeconds?: number;
  profile?: UserProfile;
  inventory: InventoryState;
} => {
  const inventory = getHunterInventory();
  const config = CONSUMABLE_CONFIGS[itemId];
  const itemState = inventory.items[itemId];
  const now = Date.now();

  if (!config || !itemState) {
    return { success: false, message: 'Invalid consumable item', inventory };
  }

  // Check Daily Quota
  if (itemState.usedToday >= config.dailyMax) {
    return {
      success: false,
      message: `Daily limit reached for ${config.name} (${config.dailyMax}/${config.dailyMax}). Resets at midnight.`,
      inventory,
    };
  }

  // Check Cooldown
  if (itemState.lastUsedAt) {
    const elapsedSeconds = (now - itemState.lastUsedAt) / 1000;
    const cooldownSeconds = config.cooldownMinutes * 60;
    if (elapsedSeconds < cooldownSeconds) {
      const remainingSeconds = Math.ceil(cooldownSeconds - elapsedSeconds);
      const remMin = Math.floor(remainingSeconds / 60);
      const remSec = remainingSeconds % 60;
      return {
        success: false,
        message: `Cooldown active for ${config.name}. Ready in ${remMin > 0 ? `${remMin}m ` : ''}${remSec}s.`,
        cooldownRemainingSeconds: remainingSeconds,
        inventory,
      };
    }
  }

  // Apply consumable effect to UserProfile vitals
  const profile = getUserProfile();
  const vitals = getHunterVitals(profile);
  let hp = vitals.hp.current;
  let mp = vitals.mp.current;
  let stm = vitals.stm.current;
  let fatigue = vitals.fatigue;
  let message = '';

  if (itemId === 'hydrate') {
    stm = Math.min(vitals.stm.max, stm + 15);
    fatigue = Math.max(0, fatigue - 5);
    message = '💧 Hydration applied: +15 STM • -5% Fatigue';
  } else if (itemId === 'focusBrew') {
    mp = Math.min(vitals.mp.max, mp + 25);
    message = '☕ Focus Catalyst applied: +25 MP';
  } else if (itemId === 'coldExposure') {
    mp = Math.min(vitals.mp.max, mp + 20);
    stm = Math.min(vitals.stm.max, stm + 10);
    fatigue = Math.max(0, fatigue - 10);
    message = '❄️ Cryo-Immersion applied: +20 MP • +10 STM • -10% Fatigue';
  } else if (itemId === 'activeRest') {
    hp = Math.min(vitals.hp.max, hp + 5);
    fatigue = Math.max(0, fatigue - 10);
    message = '🧘 Active Recovery applied: +5 HP • -10% Fatigue';
  }

  const updatedProfile: UserProfile = {
    ...profile,
    fatigue,
    hp: { current: hp, max: vitals.hp.max },
    mp: { current: mp, max: vitals.mp.max },
    stm: { current: stm, max: vitals.stm.max },
    vitalsLastUpdatedAt: now,
  };

  saveUserProfile(updatedProfile);

  // Update item state
  itemState.usedToday += 1;
  itemState.lastUsedAt = now;
  saveHunterInventory(inventory);

  return {
    success: true,
    message,
    profile: updatedProfile,
    inventory,
  };
};

export const applyQuickAction = (
  action: 'hydrate' | 'elixir' | 'meditate'
): { profile: UserProfile; message: string } => {
  const mappedKey: ConsumableType =
    action === 'hydrate' ? 'hydrate' : action === 'elixir' ? 'focusBrew' : 'activeRest';
  const result = consumeInventoryItem(mappedKey);
  return {
    profile: result.profile || getUserProfile(),
    message: result.message,
  };
};

export const triggerFullStatusRecovery = (profile: UserProfile): UserProfile => {
  const vitals = getHunterVitals(profile);
  const updated: UserProfile = {
    ...profile,
    fatigue: 0,
    hp: { current: vitals.hp.max, max: vitals.hp.max },
    mp: { current: vitals.mp.max, max: vitals.mp.max },
    stm: { current: vitals.stm.max, max: vitals.stm.max },
    vitalsLastUpdatedAt: Date.now(),
  };
  saveUserProfile(updated);
  return updated;
};

export const allocateStatPoint = (attribute: keyof Attributes): UserProfile => {
  const profile = getUserProfile();
  const currentAP = profile.availableAP ?? 0;
  if (currentAP <= 0) return profile;

  const updatedProfile: UserProfile = {
    ...profile,
    availableAP: currentAP - 1,
    visibleStats: {
      ...profile.visibleStats,
      [attribute]: (profile.visibleStats[attribute] || 10) + 1,
    },
  };

  saveUserProfile(updatedProfile);
  return updatedProfile;
};

const normalizeProfileProgress = (
  profile: UserProfile
): { profile: UserProfile; changed: boolean } => {
  const level = Number.isFinite(profile.level) ? Math.max(1, Math.floor(profile.level)) : 1;
  let xp = Number.isFinite(profile.xp) ? Math.max(0, Math.floor(profile.xp)) : 0;
  const xpToNext = calculateXPForLevel(level);

  let changed = false;

  // If the user previously had a quintillion xp or xp >= xpToNext due to the old exponential formula,
  // preserve their current level and place them at ~32% through the level cleanly
  if (xp >= xpToNext) {
    xp = Math.floor(xpToNext * 0.32);
    changed = true;
  }

  if (
    level !== profile.level ||
    xp !== profile.xp ||
    xpToNext !== profile.xpToNextLevel
  ) {
    changed = true;
  }

  return {
    profile: {
      ...profile,
      level,
      xp,
      xpToNextLevel: xpToNext,
    },
    changed,
  };
};

const normalizeAttributeAnomalies = (
  profile: UserProfile
): { profile: UserProfile; changed: boolean } => {
  const sourceVisible = (profile.visibleStats || (profile as any).stats || (profile as any).attributes || {}) as Partial<Attributes>;
  const normalizedVisible: Attributes = { ...sourceVisible } as Attributes;
  const normalizedAccumulated: Attributes = { ...(profile.accumulatedPoints || {}) } as Attributes;

  let changed = false;
  const attrs: Array<keyof Attributes> = ['STR', 'AGI', 'VIT', 'INT', 'PER', 'WIS'];

  attrs.forEach((attr) => {
    const v = Number(normalizedVisible[attr]);
    const validV = Number.isFinite(v) && v >= 0 ? Math.floor(v) : 10;
    if (validV !== normalizedVisible[attr]) {
      normalizedVisible[attr] = validV;
      changed = true;
    }

    const a = Number(normalizedAccumulated[attr]);
    const validA = Number.isFinite(a) && a >= 0 ? Math.floor(a) : 0;
    if (validA !== normalizedAccumulated[attr]) {
      normalizedAccumulated[attr] = validA;
      changed = true;
    }
  });

  return {
    profile: {
      ...profile,
      visibleStats: normalizedVisible,
      accumulatedPoints: normalizedAccumulated,
    },
    changed,
  };
};

// User Profile operations
export const getUserProfile = (): UserProfile => {
  const stored = localStorage.getItem(STORAGE_KEYS.USER_PROFILE);
  if (!stored) {
    // Avoid race: if another caller is already creating a profile, re-read once (they may have written)
    if (profileCreationInProgress) {
      const after = localStorage.getItem(STORAGE_KEYS.USER_PROFILE);
      if (after) {
        try {
          const parsed = JSON.parse(after) as UserProfile;
          const normalizedProgress = normalizeProfileProgress(parsed);
          const normalizedAttributes = normalizeAttributeAnomalies(normalizedProgress.profile);
          // While an initial DB restore may still be in flight, don't compute (let
          // alone persist) a vitals regen/reset off possibly-stale pre-restore data:
          // returning a value that diverges from what's actually stored is exactly
          // as bad as persisting it, since a caller may cache this return value and
          // never re-read it once the restore lands.
          if (syncManager.isInitialLoadPending()) {
            if (normalizedProgress.changed || normalizedAttributes.changed) {
              localStorage.setItem(STORAGE_KEYS.USER_PROFILE, JSON.stringify(normalizedAttributes.profile));
            }
            return normalizedAttributes.profile;
          }
          const regenerated = applyVitalsRegeneration(normalizedAttributes.profile);
          const hasChanges = normalizedProgress.changed || normalizedAttributes.changed || regenerated.changed;
          if (hasChanges) {
            // Route through saveUserProfile so a nightly vitals reset/penalty (or any other
            // regen change) actually syncs and notifies listeners instead of sitting silently
            // in localStorage until some unrelated action happens to save again later.
            saveUserProfile(regenerated.profile);
          }
          return regenerated.profile;
        } catch {
          return createDefaultProfile();
        }
      }
    }
    profileCreationInProgress = true;
    try {
      console.log('[Storage] No profile found, creating new profile');
      const newProfile = createDefaultProfile();
      saveUserProfile(newProfile);
      return newProfile;
    } finally {
      profileCreationInProgress = false;
    }
  }
  try {
    const parsed = JSON.parse(stored) as UserProfile;
    if (parsed.xp === undefined && (parsed as any).exp !== undefined) {
      parsed.xp = Number((parsed as any).exp) || 0;
    }
    (parsed as any).exp = parsed.xp;
    if (parsed.availableAP === undefined) parsed.availableAP = 0;
    if (parsed.fatigue === undefined) parsed.fatigue = 0;
    if (!parsed.job) parsed.job = 'None';
    if (!parsed.title) parsed.title = getHunterTitle(parsed.level || 1);
    if (!parsed.bodyMetrics) {
      parsed.bodyMetrics = { ...DEFAULT_BODY_METRICS };
    }
    const normalizedProgress = normalizeProfileProgress(parsed);
    const normalizedAttributes = normalizeAttributeAnomalies(normalizedProgress.profile);
    // See comment above: while a DB restore may still be in flight, don't compute
    // or return a vitals regen/reset off possibly-stale pre-restore data - just
    // hand back what's actually stored so nothing displays a value that diverges
    // from localStorage (and, once the restore lands, from the DB).
    if (syncManager.isInitialLoadPending()) {
      if (normalizedProgress.changed || normalizedAttributes.changed) {
        localStorage.setItem(STORAGE_KEYS.USER_PROFILE, JSON.stringify(normalizedAttributes.profile));
      }
      return normalizedAttributes.profile;
    }
    const regenerated = applyVitalsRegeneration(normalizedAttributes.profile);
    const hasChanges = normalizedProgress.changed || normalizedAttributes.changed || regenerated.changed;
    if (hasChanges) {
      // See comment in the profileCreationInProgress branch above: route through
      // saveUserProfile so this actually syncs and notifies listeners.
      saveUserProfile(regenerated.profile);
    }
    return regenerated.profile;
  } catch (error) {
    console.error('[Storage] Error parsing stored profile, creating new one:', error);
    const newProfile = createDefaultProfile();
    saveUserProfile(newProfile);
    return newProfile;
  }
};

export const PROFILE_UPDATED_EVENT = 'wrp:profile-updated';

/** One-shot marker read (and cleared) by penalty-system.ts's checkAndAssignPendingPenalty(),
 * called once from Dashboard.tsx — queued here rather than assigned inline because generating
 * the actual Penalty Quest may call the AI gateway, and storage.ts must not depend on
 * penalty-system.ts (penalty-system.ts already depends on storage.ts; see gates.ts for the
 * same one-directional pattern). */
export const PENDING_PENALTY_ASSIGNMENT_KEY = 'wrp_pending_penalty_assignment';

export const saveUserProfile = (profile: UserProfile): void => {
  (profile as any).exp = profile.xp;

  // Log XP gains for the Hunter Codex — diff against whatever was stored before this write.
  try {
    const prevRaw = localStorage.getItem(STORAGE_KEYS.USER_PROFILE);
    logActivityXpGain(prevRaw ? (JSON.parse(prevRaw) as UserProfile) : null, profile);
  } catch {
    // ignore
  }

  localStorage.setItem(STORAGE_KEYS.USER_PROFILE, JSON.stringify(profile));
  // Keep the shared AI client's per-player Gemini key in sync with whatever is on the profile now.
  aiGatewayClient.setUserApiKey(profile.geminiApiKey);

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(PROFILE_UPDATED_EVENT, { detail: profile }));
  }
  
  // Only sync to MongoDB when profile has progress or is "established" (created > 1 min ago).
  // This prevents creating a new DB user on every first visit / reload / parse error.
  const hasProgress = profile.level > 1 || profile.xp > 0 || 
                     Object.values(profile.visibleStats || {}).some((v: any) => v > 10);
  const profileAgeMs = Date.now() - new Date(profile.createdAt).getTime();
  const isBrandNew = !hasProgress && profileAgeMs < 60000; // no progress and created < 1 min ago

  if (!isBrandNew && (hasProgress || syncManager.getUserId())) {
    syncManager.saveUserData().catch(error => {
      console.error('Background sync failed:', error);
    });
  } else if (isBrandNew) {
    console.log('[Storage] Skipping background sync for brand-new profile (no progress, created < 1 min ago)');
  } else {
    console.log('[Storage] Skipping background sync for new profile without progress');
  }
};

// XP and leveling
export const calculateXPForLevel = (level: number): number => {
  const lvl = Math.max(1, level);
  // Soft-scaled XP curve so daily quests provide meaningful percentage progression
  return Math.floor(100 + (lvl - 1) * 25);
};

/** Cumulative XP across all completed levels plus progress in the current one. */
const totalCumulativeXp = (level: number, xpInLevel: number): number => {
  let total = 0;
  for (let l = 1; l < Math.max(1, level); l++) {
    total += calculateXPForLevel(l);
  }
  return total + Math.max(0, xpInLevel || 0);
};

/**
 * Append-only XP activity log — powers the Hunter Codex (and any future feature needing
 * "how much progress happened when"). `saveUserProfile` is the single choke point every XP
 * award already passes through, so logging here needs zero changes at any of the ~15+ call
 * sites that award XP.
 */
export interface ActivityLedgerEntry {
  timestamp: string; // ISO
  xpGained: number;
  /** Cumulative XP across all levels, immediately after this gain. */
  totalXpAfter: number;
  levelAfter: number;
}

const ACTIVITY_LEDGER_MAX_ENTRIES = 5000;

const logActivityXpGain = (prev: UserProfile | null, next: UserProfile): void => {
  const prevTotal = prev ? totalCumulativeXp(prev.level, prev.xp) : 0;
  const nextTotal = totalCumulativeXp(next.level, next.xp);
  const gained = nextTotal - prevTotal;
  // Skip no-op saves and ignore negative diffs (e.g. manual profile corrections/resets) —
  // this ledger only needs to track real forward progress.
  if (!prev || gained <= 0) return;

  try {
    const stored = localStorage.getItem(STORAGE_KEYS.ACTIVITY_LEDGER);
    const ledger: ActivityLedgerEntry[] = stored ? JSON.parse(stored) : [];
    ledger.push({
      timestamp: new Date().toISOString(),
      xpGained: gained,
      totalXpAfter: nextTotal,
      levelAfter: next.level,
    });
    const trimmed = ledger.length > ACTIVITY_LEDGER_MAX_ENTRIES
      ? ledger.slice(ledger.length - ACTIVITY_LEDGER_MAX_ENTRIES)
      : ledger;
    localStorage.setItem(STORAGE_KEYS.ACTIVITY_LEDGER, JSON.stringify(trimmed));
  } catch {
    // ignore — the ledger is a nice-to-have for the Codex, never load-bearing
  }
};

export const getActivityLedger = (): ActivityLedgerEntry[] => {
  try {
    const stored = localStorage.getItem(STORAGE_KEYS.ACTIVITY_LEDGER);
    const parsed = stored ? JSON.parse(stored) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

export interface MonthlyRollup {
  monthKey: string; // YYYY-MM
  monthLabel: string; // e.g. "March 2026"
  xpGained: number;
  levelStart: number;
  levelEnd: number;
  activeDays: number;
  longestStreakInMonth: number;
  bestDay: { date: string; xp: number } | null;
  achievementsUnlocked: Array<{ name: string; description?: string }>;
  hasData: boolean;
}

/** Aggregates the activity ledger + achievements into a monthly snapshot for the Hunter Codex. */
export const getMonthlyRollup = (monthKey: string, currentProfile: UserProfile): MonthlyRollup => {
  const [yearStr, monthStr] = monthKey.split('-');
  const year = Number(yearStr);
  const monthIndex = Number(monthStr) - 1; // 0-based
  const monthStart = new Date(year, monthIndex, 1, 0, 0, 0, 0);
  const monthEnd = new Date(year, monthIndex + 1, 1, 0, 0, 0, 0);
  const monthLabel = monthStart.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  const ledger = getActivityLedger();
  const before = ledger.filter((e) => new Date(e.timestamp) < monthStart);
  const within = ledger
    .filter((e) => {
      const t = new Date(e.timestamp);
      return t >= monthStart && t < monthEnd;
    })
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

  const levelStart = before.length > 0 ? before[before.length - 1].levelAfter : 1;
  const levelEnd = within.length > 0 ? within[within.length - 1].levelAfter : levelStart;
  const xpGained = within.reduce((sum, e) => sum + e.xpGained, 0);

  const dayTotals = new Map<string, number>();
  within.forEach((e) => {
    const day = getTodayKeyLocal(new Date(e.timestamp));
    dayTotals.set(day, (dayTotals.get(day) || 0) + e.xpGained);
  });
  const activeDays = dayTotals.size;

  let bestDay: { date: string; xp: number } | null = null;
  dayTotals.forEach((xp, date) => {
    if (!bestDay || xp > bestDay.xp) bestDay = { date, xp };
  });

  // Longest run of consecutive active calendar days within the month.
  const sortedDates = Array.from(dayTotals.keys()).sort();
  let longestStreakInMonth = 0;
  let currentRun = 0;
  let prevDate: Date | null = null;
  sortedDates.forEach((d) => {
    const cur = new Date(d);
    if (prevDate) {
      const diffDays = Math.round((cur.getTime() - prevDate.getTime()) / (1000 * 60 * 60 * 24));
      currentRun = diffDays === 1 ? currentRun + 1 : 1;
    } else {
      currentRun = 1;
    }
    longestStreakInMonth = Math.max(longestStreakInMonth, currentRun);
    prevDate = cur;
  });

  const achievementsUnlocked = getUnlockedAchievements()
    .filter((a) => {
      if (!a.unlockedAt) return false;
      const t = new Date(a.unlockedAt);
      return t >= monthStart && t < monthEnd;
    })
    .map((a) => ({ name: a.name, description: a.description }));

  // Current month with no ledger history yet still reflects the player's live level.
  const isCurrentMonth = monthKey === getTodayKeyLocal().slice(0, 7);
  return {
    monthKey,
    monthLabel,
    xpGained,
    levelStart,
    levelEnd: isCurrentMonth && within.length === 0 ? currentProfile.level : levelEnd,
    activeDays,
    longestStreakInMonth,
    bestDay,
    achievementsUnlocked,
    hasData: within.length > 0 || achievementsUnlocked.length > 0,
  };
};

export const addXP = (
  profile: UserProfile,
  amount: number,
  domain?: 'physical' | 'mental' | 'general'
): UserProfile => {
  const currentXP = Number(profile.xp ?? (profile as any).exp ?? 0);
  const fatigueVal = Math.max(0, Math.min(100, profile.fatigue ?? 0));
  const vitals = getHunterVitals(profile);

  // Fatigue curve: < 50% gives +10% bonus, >= 90% gives -15% penalty
  const fatigueMultiplier = fatigueVal < 50 ? 1.10 : fatigueVal >= 90 ? 0.85 : 1.0;

  // Title Effect: Peak Vitality (+EXP Gain) — only while that title is actually equipped AND
  // HP is currently 90%+; previously this fired for anyone at high HP regardless of title.
  const equippedTitleEffect = getEquippedTitleEffect(profile.title);
  const isPeakVitality = vitals.hp.current >= Math.floor(vitals.hp.max * 0.9);
  const peakVitalityMultiplier =
    profile.title === 'Peak Vitality' && isPeakVitality ? equippedTitleEffect.xpMultiplier ?? 1 : 1;

  // Stat-driven boost: STR boosts physical workout EXP (+0.5% per pt > 10, up to +20%), INT boosts mental
  const str = Number(profile.visibleStats?.STR) || 10;
  const int = Number(profile.visibleStats?.INT) || 10;
  let statMultiplier = 1.0;
  if (domain === 'physical' && str > 10) {
    statMultiplier = 1 + Math.min(0.20, (str - 10) * 0.005);
  } else if (domain === 'mental' && int > 10) {
    statMultiplier = 1 + Math.min(0.20, (int - 10) * 0.005);
  }

  // Active Penalty Quest / Detox Protocol debuff — reduced until it's cleared (see
  // penalty-system.ts). Applied last, alongside every other multiplier, not as a separate path.
  const debuffMultiplier = profile.activeDebuff?.xpMultiplier ?? 1;

  // A Seal event's temporary, self-fading modifier — a slip's debuff or a Rank-Up/Arisen's
  // buff (see seal-xp-modifier.ts). Independent of the Penalty Quest debuff above; both can
  // be active at once and simply multiply together.
  const sealXpMultiplier = getEffectiveSealXpMultiplier(profile.sealXpModifier);

  const effectiveAmount = Math.max(
    1,
    Math.round(amount * fatigueMultiplier * peakVitalityMultiplier * statMultiplier * debuffMultiplier * sealXpMultiplier)
  );

  let newXP = Math.max(0, currentXP + effectiveAmount);
  let newLevel = Math.max(1, profile.level);
  let xpToNext = calculateXPForLevel(newLevel);
  let leveledUp = false;

  while (newXP >= xpToNext) {
    newXP -= xpToNext;
    newLevel += 1;
    xpToNext = calculateXPForLevel(newLevel);
    leveledUp = true;
  }

  const leveledProfile: UserProfile = {
    ...profile,
    xp: newXP,
    level: newLevel,
    xpToNextLevel: xpToNext,
  };
  (leveledProfile as any).exp = newXP;

  // Hidden points only become visible when a level-up occurs.
  if (leveledUp) {
    return applyAccumulatedPoints(leveledProfile);
  }

  return leveledProfile;
};

export const applyAccumulatedPoints = (profile: UserProfile): UserProfile => {
  const newVisibleStats: Attributes = { ...profile.visibleStats };
  
  Object.keys(profile.accumulatedPoints).forEach((key) => {
    const attr = key as keyof Attributes;
    newVisibleStats[attr] += profile.accumulatedPoints[attr];
  });

  return {
    ...profile,
    visibleStats: newVisibleStats,
    accumulatedPoints: {
      STR: 0,
      AGI: 0,
      VIT: 0,
      INT: 0,
      PER: 0,
      WIS: 0,
    },
  };
};

// Quest operations
export interface PhysicalDayPlan {
  title: string;
  description: string;
  duration: number;
  xp: number;
  difficulty: number;
  hiddenRewards: Partial<Attributes>;
  isRestDay?: boolean;
  isCustom?: boolean;
  exercisesList?: CustomDayExercise[];
}

export type PhysicalLogRowKind = "strength" | "cardio" | "flexibility" | "other";

export interface CustomDayExercise {
  id?: string;
  name: string;
  kind: PhysicalLogRowKind;
  targetSets?: number;
  targetReps?: string;
  targetMinutes?: number;
  category?: string;
  notes?: string;
}

export interface CustomDayPlan {
  dayIndex: number; // 0=Sunday, 1=Monday, ..., 6=Saturday
  dayName: string;
  focus: string;
  isRestDay: boolean;
  exercises: CustomDayExercise[];
}

/** A player-named snapshot of a custom weekly split, saved for easy reload later — e.g. after
 * experimenting with (or accidentally resetting to) the System Prescribed plan. */
export interface SavedCustomTemplate {
  id: string;
  name: string;
  savedAt: string;
  weeklySplit: Record<number, CustomDayPlan>;
}

export interface HunterProtocolConfig {
  physicalPath: 'system' | 'custom';
  selectedTemplateId?: string;
  customWeeklySplit: Record<number, CustomDayPlan>;
  savedCustomTemplates?: SavedCustomTemplate[];
  mentalPreferences: {
    currentBookTitle: string;
    currentBookAuthor?: string;
    dailyReadingMinutes: number;
    currentStudyTopic: string;
    dailyStudyMinutes: number;
  };
  calibratedAt?: string;
}

export const getDefaultHunterProtocolConfig = (): HunterProtocolConfig => {
  const defaultTemplate = PRESET_SPLIT_TEMPLATES.find((t) => t.id === 'ppl-6day') || PRESET_SPLIT_TEMPLATES[0];
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  const customWeeklySplit: Record<number, CustomDayPlan> = {};
  for (let i = 0; i < 7; i++) {
    const sched = defaultTemplate?.schedule[i];
    const exercises: CustomDayExercise[] = (sched?.exerciseIds || [])
      .map((exId) => {
        const def = getExerciseById(exId);
        if (!def) return null;
        return {
          id: def.id,
          name: def.name,
          kind: def.kind,
          targetSets: def.defaultSets,
          targetReps: def.defaultReps,
          targetMinutes: def.defaultMinutes,
          category: def.category,
        };
      })
      .filter((e): e is CustomDayExercise => Boolean(e));

    customWeeklySplit[i] = {
      dayIndex: i,
      dayName: dayNames[i],
      focus: sched?.focus || (i === 0 ? 'Rest & Recovery' : 'Conditioning'),
      isRestDay: sched ? sched.isRestDay : i === 0,
      exercises,
    };
  }

  return {
    physicalPath: 'system',
    selectedTemplateId: 'ppl-6day',
    customWeeklySplit,
    savedCustomTemplates: [],
    mentalPreferences: {
      currentBookTitle: 'Atomic Habits',
      currentBookAuthor: 'James Clear',
      dailyReadingMinutes: 20,
      currentStudyTopic: 'Software Architecture & Systems',
      dailyStudyMinutes: 30,
    },
    calibratedAt: new Date().toISOString(),
  };
};

export const getHunterProtocolConfig = (): HunterProtocolConfig => {
  const def = getDefaultHunterProtocolConfig();
  const raw = localStorage.getItem(STORAGE_KEYS.HUNTER_PROTOCOL_CONFIG);
  if (!raw) {
    try {
      localStorage.setItem(STORAGE_KEYS.HUNTER_PROTOCOL_CONFIG, JSON.stringify(def));
    } catch {
      // ignore
    }
    return def;
  }
  try {
    const parsed = JSON.parse(raw) as Partial<HunterProtocolConfig> | null;
    if (!parsed || typeof parsed !== 'object') {
      return def;
    }
    return {
      physicalPath: parsed.physicalPath || def.physicalPath,
      selectedTemplateId: parsed.selectedTemplateId || def.selectedTemplateId,
      customWeeklySplit: parsed.customWeeklySplit && Object.keys(parsed.customWeeklySplit).length === 7
        ? parsed.customWeeklySplit
        : def.customWeeklySplit,
      savedCustomTemplates: Array.isArray(parsed.savedCustomTemplates) ? parsed.savedCustomTemplates : [],
      mentalPreferences: {
        ...def.mentalPreferences,
        ...(parsed.mentalPreferences || {}),
      },
      calibratedAt: parsed.calibratedAt || def.calibratedAt,
    };
  } catch {
    return def;
  }
};

export const saveHunterProtocolConfig = (config: HunterProtocolConfig): void => {
  const safeConfig = config || getDefaultHunterProtocolConfig();
  localStorage.setItem(STORAGE_KEYS.HUNTER_PROTOCOL_CONFIG, JSON.stringify(safeConfig));
  scheduleSyncAfterGeneratedContentSave();

  // Sync existing quests with newly updated plan and mental preferences
  const stored = localStorage.getItem(STORAGE_KEYS.QUESTS);
  if (stored) {
    try {
      const parsed = JSON.parse(stored) as Quest[];
      const adjusted = syncQuestsWithProtocols(parsed, new Date());
      localStorage.setItem(STORAGE_KEYS.QUESTS, JSON.stringify(adjusted));
    } catch {
      // ignore
    }
  }

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(PROTOCOL_CALIBRATED_EVENT, { detail: safeConfig }));
    window.dispatchEvent(new Event(QUESTS_UPDATED_EVENT));
  }
};

export const resetHunterProtocolToSystem = (): HunterProtocolConfig => {
  const cur = getHunterProtocolConfig();
  cur.physicalPath = 'system';
  saveHunterProtocolConfig(cur);
  return cur;
};

export interface PhysicalSetLog {
  reps: string;
  weightKg: string;
}

export interface PhysicalExerciseLog {
  exercise: string;
  kind: PhysicalLogRowKind;
  /** Strength: one entry per performed set. */
  sets?: PhysicalSetLog[];
  /** Cardio/flexibility: time it took (minutes). */
  timeMinutes?: string;
  notes: string;
  completed?: boolean;
  targetReps?: string;
  targetSets?: number;
  targetMinutes?: number;
  userLogged?: boolean;
}

interface PhysicalQuestLogPayload {
  questId: string;
  date: string; // YYYY-MM-DD
  rows: PhysicalExerciseLog[];
  updatedAt: string;
}

const physicalLogStorageKey = (questId: string, date: string): string => `${questId}::${date}`;

export const getPhysicalQuestLog = (questId: string, date: string): PhysicalExerciseLog[] | null => {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.PHYSICAL_QUEST_LOGS);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Record<string, PhysicalQuestLogPayload>;
    const entry = parsed[physicalLogStorageKey(questId, date)];
    if (!entry || !Array.isArray(entry.rows)) return null;
    // Back-compat: older rows used {sets,reps,weightKg,notes} (strings). Map them into v2.
    return entry.rows
      .map((row) => {
        if (!row || typeof row !== "object") return null;
        const anyRow = row as any;
        if (typeof anyRow.exercise !== "string") return null;
        if (typeof anyRow.kind === "string" && typeof anyRow.notes === "string") {
          return anyRow as PhysicalExerciseLog;
        }
        const reps = typeof anyRow.reps === "string" ? anyRow.reps : "";
        const weightKg = typeof anyRow.weightKg === "string" ? anyRow.weightKg : "";
        const legacySets = typeof anyRow.sets === "string" ? anyRow.sets : "";
        const notes = typeof anyRow.notes === "string" ? anyRow.notes : "";
        const inferredKind: PhysicalLogRowKind =
          /jog|run|km|cardio/i.test(anyRow.exercise) ? "cardio" : /stretch|pose|mobility/i.test(anyRow.exercise) ? "flexibility" : "strength";

        const setCount = Math.max(0, Math.min(10, Number.parseInt(legacySets, 10) || 0));
        const sets: PhysicalSetLog[] =
          setCount > 0
            ? Array.from({ length: setCount }).map(() => ({ reps, weightKg }))
            : reps || weightKg
              ? [{ reps, weightKg }]
              : [];

        return {
          exercise: anyRow.exercise,
          kind: inferredKind,
          sets: sets.length > 0 ? sets : undefined,
          timeMinutes: inferredKind === "cardio" || inferredKind === "flexibility" ? "" : undefined,
          notes,
        } satisfies PhysicalExerciseLog;
      })
      .filter((x): x is PhysicalExerciseLog => !!x);
  } catch {
    return null;
  }
};

export const savePhysicalQuestLog = (questId: string, date: string, rows: PhysicalExerciseLog[]): void => {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.PHYSICAL_QUEST_LOGS);
    const parsed = raw ? (JSON.parse(raw) as Record<string, PhysicalQuestLogPayload>) : {};
    const key = physicalLogStorageKey(questId, date);
    parsed[key] = {
      questId,
      date,
      rows,
      updatedAt: new Date().toISOString(),
    };
    localStorage.setItem(STORAGE_KEYS.PHYSICAL_QUEST_LOGS, JSON.stringify(parsed));
    scheduleSyncAfterGeneratedContentSave();
  } catch {
    // Non-fatal: quest flow should continue even if log persistence fails.
  }
};

export function getPhysicalDayPlan(date: Date): PhysicalDayPlan {
  const day = date.getDay(); // 0=Sunday ... 6=Saturday
  const config = getHunterProtocolConfig();

  if (config && config.physicalPath === 'custom' && config.customWeeklySplit && config.customWeeklySplit[day]) {
    const customDay = config.customWeeklySplit[day];
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const dName = customDay.dayName || dayNames[day];

    if (customDay.isRestDay) {
      return {
        title: `${dName} Protocol — Rest & Active Recovery`,
        description:
          customDay.exercises && customDay.exercises.length > 0
            ? `Active Recovery: ${customDay.exercises.map((e) => e.name).join(' • ')}`
            : 'Scheduled Rest Day • Hydration & Mobility • Rest is when Hunter muscle synthesis and recovery occur.',
        duration: 20,
        xp: 35,
        difficulty: 1,
        hiddenRewards: { VIT: 2, AGI: 1 },
        isRestDay: true,
        isCustom: true,
        exercisesList: customDay.exercises,
      };
    }

    const exList = customDay.exercises || [];
    const desc =
      exList.length > 0
        ? exList.map((e) => e.name).join(' • ')
        : `Hunter Custom Regimen: ${customDay.focus || 'Physical Conditioning'}`;

    return {
      title: `${dName} Protocol — ${customDay.focus || 'Custom Conditioning'}`,
      description: desc,
      duration: Math.max(30, exList.length * 10),
      xp: Math.min(70, Math.max(40, exList.length * 10)),
      difficulty: Math.min(5, Math.max(2, Math.ceil(exList.length / 1.5))),
      hiddenRewards: { STR: 3, VIT: 2, AGI: 1 },
      isRestDay: false,
      isCustom: true,
      exercisesList: exList,
    };
  }

  switch (day) {
    case 1: // Monday — Gym Day 1 (Physical Daily Protocol: Force Production)
      return {
        title: "Monday Protocol — Gym: Force Production",
        description:
          "Warm-up (~5 min): dynamic stretching or 500m row • Superset A1/A2: Barbell Back Squat 3×5-8 • Pull-Ups (weighted if possible) 3×max • Superset B1/B2: Overhead Press (DB or bar) 3×8-10 • Hanging Leg Raises 3×12 • C1: Farmer’s Walk (heavy) 3×40m • Rest ~60s between supersets • Exit (~5 min): log and cool-down.",
        duration: 50,
        xp: 55,
        difficulty: 4,
        hiddenRewards: { STR: 3, VIT: 2, AGI: 1 },
      };
    case 2: // Tuesday
      return {
        title: "Tuesday Protocol — Cardiovascular",
        description: "Light Jog/Run (2-3 km).",
        duration: 30,
        xp: 35,
        difficulty: 2,
        hiddenRewards: { AGI: 2, VIT: 2 },
      };
    case 3: // Wednesday — Gym Day 2 (Mechanical Advantage / The Pull)
      return {
        title: "Wednesday Protocol — Gym: Mechanical Advantage",
        description:
          "Warm-up (~5 min): dynamic stretching or 500m row • Superset A1/A2: Deadlift (conventional or trap bar) 3×5 • Dips (chest focus) 3×10-12 • Superset B1/B2: Bent-Over Barbell Rows 3×8-10 • Dumbbell Lunges 3×10/leg • C1: Face Pulls 3×15 • Rest ~60s between supersets • Exit (~5 min): log and cool-down.",
        duration: 50,
        xp: 55,
        difficulty: 4,
        hiddenRewards: { STR: 3, VIT: 2, AGI: 1 },
      };
    case 4: // Thursday
      return {
        title: "Thursday Protocol — Specific Muscles",
        description: "Forearms (grip strength) • Biceps (dumbbell curls) • Light stretching.",
        duration: 35,
        xp: 35,
        difficulty: 2,
        hiddenRewards: { STR: 2, AGI: 1 },
      };
    case 5: // Friday — Gym Day 3 (Explosive Utility / The Operator)
      return {
        title: "Friday Protocol — Gym: Explosive Utility",
        description:
          "Warm-up (~5 min): dynamic stretching or 500m row • Superset A1/A2: Incline Bench Press 3×6-8 • Goblet Squats (explosive) 3×12 • Superset B1/B2: Lat Pulldowns (neutral grip) 3×10 • Plank with weight plate 3×60s • C1: Medicine Ball Slams 3×10 • Rest ~60s between supersets • Exit (~5 min): log and cool-down.",
        duration: 50,
        xp: 55,
        difficulty: 4,
        hiddenRewards: { STR: 2, AGI: 2, VIT: 2 },
      };
    case 6: // Saturday
      return {
        title: "Saturday Protocol — Cardiovascular",
        description: "Light Jog/Run (2-3 km).",
        duration: 30,
        xp: 35,
        difficulty: 2,
        hiddenRewards: { AGI: 2, VIT: 2 },
      };
    case 0: // Sunday
    default:
      return {
        title: "Sunday Protocol — Full Body Stretch",
        description:
          "Neck circles • Cross-body shoulder stretch • Overhead tricep stretch • Doorway chest stretch • Cat-cow flow • Child's pose • Cobra stretch • Lying torso twist • Seated toe touch • Standing quad stretch • Runner's lunge • Figure-4 stretch • Wall calf stretch.",
        duration: 30,
        xp: 30,
        difficulty: 1,
        hiddenRewards: { VIT: 2, AGI: 1 },
      };
  }
};

export const isWorkSession1 = (q: Quest) =>
  q.id.startsWith('mental-work1') || q.id.startsWith('mental-study1') || q.title.toLowerCase().startsWith('work session 1') || q.title.toLowerCase().startsWith('study session 1');

export const isWorkSession2 = (q: Quest) =>
  q.id.startsWith('mental-work2') || q.id.startsWith('mental-study2') || q.title.toLowerCase().startsWith('work session 2') || q.title.toLowerCase().startsWith('study session 2');

export const isWorkSession3 = (q: Quest) =>
  q.id.startsWith('mental-work3') || q.id.startsWith('mental-study3') || q.title.toLowerCase().startsWith('work session 3') || q.title.toLowerCase().startsWith('study session 3');

export const isWorkSession4 = (q: Quest) =>
  q.id.startsWith('mental-work4') || q.id.startsWith('mental-study4') || q.title.toLowerCase().startsWith('work session 4') || q.title.toLowerCase().startsWith('study session 4');

export const filterVisibleQuests = (quests: Quest[]): Quest[] => {
  const work1 = quests.find(isWorkSession1);
  const work2 = quests.find(isWorkSession2);
  const work3 = quests.find(isWorkSession3);
  const work4 = quests.find(isWorkSession4);

  const isWork1Complete = Boolean(work1?.completed);
  const isWork2Complete = Boolean(work2?.completed);
  const isWork3Complete = Boolean(work3?.completed);

  return quests.filter((q) => {
    // Work Session 1 is always visible
    if (isWorkSession1(q)) return true;

    // Work Session 2 is visible only if Work Session 1 is completed (or Work 2 is already completed)
    if (isWorkSession2(q)) {
      return isWork1Complete || Boolean(q.completed);
    }

    // Work Session 3 is visible only if Work Session 2 is completed (or Work 3 is already completed)
    if (isWorkSession3(q)) {
      return isWork2Complete || Boolean(q.completed);
    }

    // Work Session 4 is visible only if Work Session 3 is completed (or Work 4 is completed)
    if (isWorkSession4(q)) {
      return isWork3Complete || Boolean(q.completed);
    }

    return true;
  });
};

/**
 * The Spiritual quest set — shared between generateDailyQuests() and
 * syncQuestsWithProtocols() so the two never drift apart. Faith-agnostic (mindfulness/
 * reflection), not tied to any one religion — the meditation quest was migrated in from
 * Mental, plus two new ones.
 */
const SPIRITUAL_ID_PREFIXES = ['spiritual-meditation', 'spiritual-reflection', 'spiritual-gratitude'];

const buildSpiritualQuests = (todayKey: string): Quest[] => [
  {
    id: `spiritual-meditation-${todayKey}`,
    type: 'social' as QuestCategory,
    title: '10 Min Meditation',
    description: 'Engage in 10 minutes of silent mindfulness, breath control, and mental clarity.',
    xp: 15, duration: 10, difficulty: 1,
    hiddenRewards: { WIS: 1, PER: 1 },
    completed: false, origin: 'system', generatedAt: todayKey,
  },
  {
    id: `spiritual-reflection-${todayKey}`,
    type: 'social' as QuestCategory,
    title: 'Evening Reflection',
    description: "Reflect on today's directives — what went well, what to adjust tomorrow.",
    xp: 15, duration: 10, difficulty: 1,
    hiddenRewards: { WIS: 1 },
    completed: false, origin: 'system', generatedAt: todayKey,
  },
  {
    id: `spiritual-gratitude-${todayKey}`,
    type: 'social' as QuestCategory,
    title: 'Gratitude Log',
    description: "Write down three things you're grateful for today.",
    xp: 20, duration: 5, difficulty: 1,
    hiddenRewards: { PER: 1 },
    completed: false, origin: 'system', generatedAt: todayKey,
  },
];

const syncQuestsWithProtocols = (quests: Quest[], date: Date): Quest[] => {
  const plan = getPhysicalDayPlan(date);
  const config = getHunterProtocolConfig();
  const bookTitle = config.mentalPreferences?.currentBookTitle || 'Focus Reading';
  const readingMins = config.mentalPreferences?.dailyReadingMinutes || 20;
  const studyTopic = config.mentalPreferences?.currentStudyTopic || 'Specialized Topic';
  const studyMins = config.mentalPreferences?.dailyStudyMinutes || 30;
  const todayKey = new Date().toISOString();

  // 1. Normalize and migrate quests (updating study sessions to Work Sessions)
  const normalized = quests.map((q) => {
    if (isWorkSession1(q)) {
      return {
        ...q,
        title: 'Work Session 1 (45 Min)',
        description: 'Focused deep work & concentration session — 45 minutes.',
        duration: 45,
        xp: 30,
        difficulty: 3,
        hiddenRewards: { INT: 2 },
        chainLevel: 1,
      };
    }
    if (isWorkSession2(q)) {
      return {
        ...q,
        title: 'Work Session 2 (45 Min)',
        description: 'Focused deep work & concentration session — 45 minutes.',
        duration: 45,
        xp: 30,
        difficulty: 3,
        hiddenRewards: { PER: 2 },
        isChainBonus: true,
        chainLevel: 2,
      };
    }
    if (isWorkSession3(q)) {
      return {
        ...q,
        title: 'Work Session 3 (45 Min)',
        description: 'Focused deep work & concentration session — 45 minutes.',
        duration: 45,
        xp: 30,
        difficulty: 3,
        hiddenRewards: { WIS: 2 },
        isChainBonus: true,
        chainLevel: 3,
      };
    }
    if (isWorkSession4(q)) {
      return {
        ...q,
        title: 'Work Session 4 (45 Min)',
        description: 'Focused deep work & concentration session — 45 minutes.',
        duration: 45,
        xp: 30,
        difficulty: 3,
        hiddenRewards: { PER: 2 },
        isChainBonus: true,
        chainLevel: 4,
      };
    }
    return q;
  });

  // 2. Ensure Work Sessions exist in the master pool
  const masterQuests = [...normalized];
  if (!masterQuests.some(isWorkSession1)) {
    masterQuests.push({
      id: `mental-work1-${todayKey}`,
      type: 'mental',
      title: 'Work Session 1 (45 Min)',
      description: 'Focused deep work & concentration session — 45 minutes.',
      xp: 30,
      duration: 45,
      difficulty: 3,
      hiddenRewards: { INT: 2 },
      completed: false,
      origin: 'system',
      generatedAt: todayKey,
      chainLevel: 1,
    });
  }
  if (!masterQuests.some(isWorkSession2)) {
    masterQuests.push({
      id: `mental-work2-${todayKey}`,
      type: 'mental',
      title: 'Work Session 2 (45 Min)',
      description: 'Focused deep work & concentration session — 45 minutes.',
      xp: 30,
      duration: 45,
      difficulty: 3,
      hiddenRewards: { PER: 2 },
      completed: false,
      origin: 'system',
      generatedAt: todayKey,
      isChainBonus: true,
      chainLevel: 2,
    });
  }
  if (!masterQuests.some(isWorkSession3)) {
    masterQuests.push({
      id: `mental-work3-${todayKey}`,
      type: 'mental',
      title: 'Work Session 3 (45 Min)',
      description: 'Focused deep work & concentration session — 45 minutes.',
      xp: 30,
      duration: 45,
      difficulty: 3,
      hiddenRewards: { WIS: 2 },
      completed: false,
      origin: 'system',
      generatedAt: todayKey,
      isChainBonus: true,
      chainLevel: 3,
    });
  }
  if (!masterQuests.some(isWorkSession4)) {
    masterQuests.push({
      id: `mental-work4-${todayKey}`,
      type: 'mental',
      title: 'Work Session 4 (45 Min)',
      description: 'Focused deep work & concentration session — 45 minutes.',
      xp: 30,
      duration: 45,
      difficulty: 3,
      hiddenRewards: { PER: 2 },
      completed: false,
      origin: 'system',
      generatedAt: todayKey,
      isChainBonus: true,
      chainLevel: 4,
    });
  }

  // Ensure the Spiritual set exists, same self-healing pattern as Work Sessions above. Also
  // clears out the old Islamic quests (spiritual-morning/-evening/-witr) from a quest list
  // generated before this change, unless already completed today — never erase logged
  // progress for something the player actually did.
  const isSpiritualQuest = (q: Quest) => q.id.startsWith('spiritual-');
  let synced = masterQuests.filter(
    (q) => !isSpiritualQuest(q) || q.completed || SPIRITUAL_ID_PREFIXES.some((p) => q.id.startsWith(p))
  );
  buildSpiritualQuests(todayKey).forEach((wanted) => {
    const prefix = wanted.id.slice(0, wanted.id.lastIndexOf('-'));
    if (!synced.some((q) => q.id.startsWith(prefix))) {
      synced = [...synced, wanted];
    }
  });

  // 3. Synchronize physical and mental attributes
  return synced.map((q) => {
    if (q.type === 'physical') {
      return {
        ...q,
        title: plan.title,
        description: plan.description,
        duration: plan.duration,
        xp: plan.xp,
        difficulty: plan.difficulty,
        hiddenRewards: plan.hiddenRewards,
      };
    }

    if (q.type === 'mental') {
      // Reading quest sync
      if (
        q.id.startsWith('mental-book') ||
        q.title.toLowerCase().includes('min reading') ||
        q.title.toLowerCase().includes('reading:')
      ) {
        return {
          ...q,
          title: `${readingMins} Min Reading: ${bookTitle}`,
          description: `Complete ${readingMins} minutes of dedicated, uninterrupted reading of "${bookTitle}".`,
          duration: readingMins,
        };
      }

      // Specialty study quest sync (updates dynamically when player changes study topic/specialty)
      if (
        q.id.startsWith('mental-study-custom') ||
        q.title.toLowerCase().includes('min study:') ||
        q.title.toLowerCase().includes('study: software architecture') ||
        q.title.toLowerCase().includes('study: specialized') ||
        q.title.toLowerCase().includes('study: dentistry') ||
        (q.title.toLowerCase().includes('study:') && !q.title.toLowerCase().includes('geography') && !q.title.toLowerCase().includes('history') && !q.title.toLowerCase().includes('work session'))
      ) {
        return {
          ...q,
          title: `${studyMins} Min Study: ${studyTopic}`,
          description: `Active learning & mastery session: ${studyTopic}.`,
          duration: studyMins,
        };
      }
    }

    return q;
  });
};

export const getDailyQuests = async (): Promise<Quest[]> => {
  const today = new Date().toDateString();
  let lastReset = localStorage.getItem(STORAGE_KEYS.DAILY_RESET);

  console.log(`[Storage] Daily quest check: last reset = ${lastReset}, today = ${today}`);

  if (lastReset !== today) {
    // Only pay for the DB round-trip when a reset is actually on the table -
    // most loads are same-day and should return from cache instantly. Wait for
    // any pending initial restore to land first so this decision (and the
    // regenerated quests below) aren't made against stale, pre-restore data.
    await syncManager.ensureInitialLoad();
    lastReset = localStorage.getItem(STORAGE_KEYS.DAILY_RESET);
  }

  if (lastReset !== today) {
    const newQuests = await generateDailyQuests();
    saveQuests(newQuests);
    localStorage.setItem(STORAGE_KEYS.DAILY_RESET, today);
    return filterVisibleQuests(newQuests);
  }

  const stored = localStorage.getItem(STORAGE_KEYS.QUESTS);
  if (stored) {
    const parsed = JSON.parse(stored) as Quest[];
    const adjusted = syncQuestsWithProtocols(parsed, new Date());
    if (JSON.stringify(adjusted) !== JSON.stringify(parsed)) {
      saveQuests(adjusted);
    }
    return filterVisibleQuests(adjusted);
  }

  const quests = await generateDailyQuests();
  saveQuests(quests);
  localStorage.setItem(STORAGE_KEYS.DAILY_RESET, today);
  return filterVisibleQuests(quests);
};

export const getAllStoredQuests = (): Quest[] => {
  const stored = localStorage.getItem(STORAGE_KEYS.QUESTS);
  if (!stored) return [];
  try {
    return JSON.parse(stored);
  } catch {
    return [];
  }
};

export const getQuestById = (questId: string): Quest | null => {
  const all = getAllStoredQuests();
  return all.find((q) => q.id === questId) || null;
};

export const saveQuests = (quests: Quest[]): void => {
  localStorage.setItem(STORAGE_KEYS.QUESTS, JSON.stringify(quests));
  scheduleSyncAfterGeneratedContentSave();

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(QUESTS_UPDATED_EVENT));
  }
};

export const completeQuest = (questId: string): void => {
  toggleQuestCompletion(questId, true);
};

export const toggleQuestCompletion = (questId: string, forceState?: boolean): Quest[] => {
  const stored = localStorage.getItem(STORAGE_KEYS.QUESTS);
  if (!stored) return [];
  const quests: Quest[] = JSON.parse(stored);

  const updated = quests.map(q => {
    if (q.id === questId) {
      const nextCompleted = forceState !== undefined ? forceState : !q.completed;
      return {
        ...q,
        completed: nextCompleted,
        completedAt: nextCompleted ? new Date().toISOString() : undefined,
      };
    }
    return q;
  });

  saveQuests(updated);

  // Vitals (STM/MP/fatigue) are consumed by the caller, which knows the quest's actual
  // difficulty and can scale intensity accordingly (light/moderate/heavy) — this used to
  // ALSO be done here unconditionally at 'moderate', so every completion was charged twice.
  return filterVisibleQuests(updated);
};

// Generate daily quests — fixed protocol (no AI)
const generateDailyQuests = async (): Promise<Quest[]> => {
  const today = new Date().toISOString();
  const physicalPlan = getPhysicalDayPlan(new Date());
  const config = getHunterProtocolConfig();
  const bookTitle = config.mentalPreferences?.currentBookTitle || 'Focus Reading';
  const readingMins = config.mentalPreferences?.dailyReadingMinutes || 20;
  const studyTopic = config.mentalPreferences?.currentStudyTopic || 'Specialized Topic';
  const studyMins = config.mentalPreferences?.dailyStudyMinutes || 30;

  return [
    // ── Mental ──
    {
      id: `mental-book-${today}`,
      type: 'mental' as QuestCategory,
      title: `${readingMins} Min Reading: ${bookTitle}`,
      description: `Complete ${readingMins} minutes of dedicated, uninterrupted reading of "${bookTitle}".`,
      xp: 20,
      duration: readingMins,
      difficulty: 2,
      hiddenRewards: { INT: 1, WIS: 1 },
      completed: false,
      origin: 'system',
      generatedAt: today,
    },
    {
      id: `mental-study-custom-${today}`,
      type: 'mental' as QuestCategory,
      title: `${studyMins} Min Study: ${studyTopic}`,
      description: `Active learning & mastery session: ${studyTopic}.`,
      xp: 25,
      duration: studyMins,
      difficulty: 2,
      hiddenRewards: { INT: 2 },
      completed: false,
      origin: 'system',
      generatedAt: today,
    },
    {
      id: `mental-geo-${today}`,
      type: 'mental' as QuestCategory,
      title: '15 Min Geography Study',
      description: 'Study geography for 15 minutes.',
      xp: 15, duration: 15, difficulty: 2,
      hiddenRewards: { INT: 1 },
      completed: false, origin: 'system', generatedAt: today,
    },
    {
      id: `mental-history-${today}`,
      type: 'mental' as QuestCategory,
      title: '15 Min History Study',
      description: 'Study history for 15 minutes.',
      xp: 15, duration: 15, difficulty: 2,
      hiddenRewards: { WIS: 1 },
      completed: false, origin: 'system', generatedAt: today,
    },
    // ── Progressive Work Sessions (Session 1 default, Session 2 unlocks upon completing Session 1, etc.) ──
    {
      id: `mental-work1-${today}`,
      type: 'mental' as QuestCategory,
      title: 'Work Session 1 (45 Min)',
      description: 'Focused deep work & concentration session — 45 minutes.',
      xp: 30,
      duration: 45,
      difficulty: 3,
      hiddenRewards: { INT: 2 },
      completed: false,
      origin: 'system',
      generatedAt: today,
      chainLevel: 1,
    },
    {
      id: `mental-work2-${today}`,
      type: 'mental' as QuestCategory,
      title: 'Work Session 2 (45 Min)',
      description: 'Focused deep work & concentration session — 45 minutes.',
      xp: 30,
      duration: 45,
      difficulty: 3,
      hiddenRewards: { PER: 2 },
      completed: false,
      origin: 'system',
      generatedAt: today,
      isChainBonus: true,
      chainLevel: 2,
    },
    {
      id: `mental-work3-${today}`,
      type: 'mental' as QuestCategory,
      title: 'Work Session 3 (45 Min)',
      description: 'Focused deep work & concentration session — 45 minutes.',
      xp: 30,
      duration: 45,
      difficulty: 3,
      hiddenRewards: { WIS: 2 },
      completed: false,
      origin: 'system',
      generatedAt: today,
      isChainBonus: true,
      chainLevel: 3,
    },
    {
      id: `mental-work4-${today}`,
      type: 'mental' as QuestCategory,
      title: 'Work Session 4 (45 Min)',
      description: 'Focused deep work & concentration session — 45 minutes.',
      xp: 30,
      duration: 45,
      difficulty: 3,
      hiddenRewards: { PER: 2 },
      completed: false,
      origin: 'system',
      generatedAt: today,
      isChainBonus: true,
      chainLevel: 4,
    },
    // ── Physical ──
    {
      id: `physical-workout-${today}`,
      type: 'physical' as QuestCategory,
      title: physicalPlan.title,
      description: physicalPlan.description,
      xp: physicalPlan.xp, duration: physicalPlan.duration, difficulty: physicalPlan.difficulty,
      hiddenRewards: physicalPlan.hiddenRewards,
      completed: false, origin: 'system', generatedAt: today,
    },
    // ── Spiritual ── (see buildSpiritualQuests())
    ...buildSpiritualQuests(today),
  ];
};

interface AIQuestResponse {
  assignments: Array<{
    type: Quest['type'];
    title: string;
    description: string;
    xp: number;
    duration: number;
    difficulty: number;
    hiddenRewards?: Partial<Attributes>;
    note?: string;
  }>;
}

async function requestAIQuestPlan(profile: UserProfile): Promise<Quest[]> {
  const prompt = buildQuestPlanPrompt(profile);
  const response = await aiGatewayClient.completeJson<AIQuestResponse>(prompt, {
    temperature: 0.6,
    maxTokens: 6000, // Increased significantly to prevent MAX_TOKENS truncation for 3 complete quests
  });

  if (!response?.assignments || response.assignments.length !== 3) {
    throw new Error('Invalid quest plan response');
  }

  return response.assignments.map((assignment, index) => sanitizeQuestAssignment(assignment, index));
}

function buildQuestPlanPrompt(profile: UserProfile): string {
  return `
You are THEIA of THE WHITE ROOM. Voice: sterile, concise, professional.

SUBJECT
- Level ${profile.level}
- XP ${profile.xp}/${profile.xpToNextLevel}
- Visible stats: ${formatAttributes(profile.visibleStats)}
- Hidden reserves: ${formatAttributes(profile.accumulatedPoints)}

IMPORTANT DISTINCTION:
- Daily Quests are SIMPLE, SELF-REPORTED tasks (not interactive challenges)
- Mental Lab provides complex interactive cognitive challenges (separate system)
- The "mental" quest here should be a simple, real-world task (e.g., reading, studying, reflection)
- DO NOT generate interactive challenges, quizzes, or complex cognitive exercises
- Focus on straightforward, measurable activities that can be completed in the real world

REQUIRED OUTPUT
- Exactly three quests: mental, physical, social.
- Each quest must be realistic, measurable, and executable today.
- Mental quest: Simple self-reported task (reading, studying, journaling, etc.) - NOT an interactive challenge
- Physical quest: Simple exercise routine (push-ups, running, stretching, etc.)
- Social quest: Simple social interaction task (conversation, observation, etc.)
- XP range: 10-40. Difficulty 1-5. Duration 10-40 minutes.
- Hidden rewards: at most two attributes per quest, values between +1 and +2.
- Provide optional calibration note if needed.

Return JSON:
{
  "assignments": [
    {
      "type": "mental|physical|social",
      "title": "SHORT LABEL",
      "description": "precise instruction",
      "xp": number,
      "duration": number,
      "difficulty": number,
      "hiddenRewards": { "INT"?: number, "PER"?: number, ... },
      "note": "optional minimal note"
    }
  ]
}
`;
}

function sanitizeQuestAssignment(assignment: AIQuestResponse['assignments'][number], index: number): Quest {
  const allowedTypes: Quest['type'][] = ['mental', 'physical', 'social'];
  const type = allowedTypes.includes(assignment.type) ? assignment.type : allowedTypes[index] || 'mental';

  const xp = clampNumber(assignment.xp ?? 20, 10, 40);
  const duration = clampNumber(assignment.duration ?? 20, 10, 40);
  const difficulty = clampNumber(assignment.difficulty ?? 2, 1, 5);
  const hiddenRewards = sanitizeRewards({}, assignment.hiddenRewards || {}, 2);

  return {
    id: crypto.randomUUID(),
    type,
    title: assignment.title?.trim() || `Protocol ${type.toUpperCase()}`,
    description: assignment.description?.trim() || 'Execute prescribed routine.',
    xp,
    duration,
    difficulty,
    hiddenRewards,
    completed: false,
    origin: 'ai',
    generatedAt: new Date().toISOString(),
    aiContext: assignment.note,
  };
}


function clampNumber(value: number, min: number, max: number): number {
  if (typeof value !== 'number' || Number.isNaN(value)) return min;
  return Math.max(min, Math.min(max, Math.round(value)));
}

function formatAttributes(attrs: Attributes): string {
  return Object.entries(attrs)
    .map(([key, value]) => `${key}:${value}`)
    .join(', ');
}

function sanitizeRewards(
  base: Partial<Attributes>,
  overrides: Partial<Attributes>,
  maxAttributes: number
): Partial<Attributes> {
  const result: Partial<Attributes> = { ...base };
  const entries = Object.entries(overrides || {})
    .filter(([, value]) => typeof value === 'number' && value! > 0)
    .slice(0, maxAttributes);

  entries.forEach(([key, value]) => {
    result[key as keyof Attributes] = clampNumber(value as number, 1, 2);
  });

  return result;
}

// Quest attempts
export const saveQuestAttempt = (attempt: QuestAttempt): void => {
  const stored = localStorage.getItem(STORAGE_KEYS.QUEST_ATTEMPTS);
  const attempts: QuestAttempt[] = stored ? JSON.parse(stored) : [];
  attempts.push(attempt);
  localStorage.setItem(STORAGE_KEYS.QUEST_ATTEMPTS, JSON.stringify(attempts));
  
  // Trigger background sync (non-blocking)
  syncManager.saveUserData().catch(error => {
    console.error('Background sync failed:', error);
  });
};

export const getQuestAttempts = (): QuestAttempt[] => {
  const stored = localStorage.getItem(STORAGE_KEYS.QUEST_ATTEMPTS);
  return stored ? JSON.parse(stored) : [];
};

// Knowledge Lab (AI daily topics) storage helpers
const getDefaultKnowledgeData = (): KnowledgeData => ({
  currentTopic: null,
  quizData: null,
  quizResults: null,
  userProgress: {
    score: 0,
    streak: 0,
    totalQuizzes: 0,
    lastQuizDate: null,
  },
  lastTopicDate: null,
});

export const getKnowledgeData = (domain: KnowledgeDomain): KnowledgeData => {
  const stored = localStorage.getItem(`${STORAGE_KEYS.KNOWLEDGE_DATA}_${domain}`);
  if (!stored) {
    return getDefaultKnowledgeData();
  }
  try {
    const data = JSON.parse(stored) as KnowledgeData;
    // Check if it's a new day - reset topic/quiz if needed
    const today = new Date().toISOString().slice(0, 10);
    if (data.lastTopicDate !== today) {
      // New day - reset topic and quiz
      data.currentTopic = null;
      data.quizData = null;
      data.quizResults = null;
      data.partialAnswers = undefined;
      data.partialIndex = undefined;
      data.lastTopicDate = null;
      saveKnowledgeData(domain, data);
    }
    return data;
  } catch (error) {
    console.error('Error parsing knowledge data:', error);
    return getDefaultKnowledgeData();
  }
};

export const saveKnowledgeData = (domain: KnowledgeDomain, data: KnowledgeData): void => {
  localStorage.setItem(`${STORAGE_KEYS.KNOWLEDGE_DATA}_${domain}`, JSON.stringify(data));
  scheduleSyncAfterGeneratedContentSave();
};

export const updateKnowledgeProgress = (
  domain: KnowledgeDomain,
  score: number,
  timeTaken: number
): void => {
  const data = getKnowledgeData(domain);
  const today = new Date().toISOString().slice(0, 10);
  const progress = data.userProgress;
  
  // Only update if not already updated today
  if (progress.lastQuizDate === today && data.quizResults) {
    return; // Already completed today
  }
  
  progress.score += score;
  progress.totalQuizzes++;
  
  // Update streak
  if (progress.lastQuizDate === today) {
    // Already completed today, don't update streak
  } else if (progress.lastQuizDate === getYesterdayDate()) {
    // Consecutive day
    progress.streak++;
  } else {
    // Break in streak or first quiz
    progress.streak = progress.lastQuizDate ? 1 : 1;
  }
  
  progress.lastQuizDate = today;
  data.lastTopicDate = today;
  
  saveKnowledgeData(domain, data);
};

const getYesterdayDate = (): string => {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  return yesterday.toISOString().slice(0, 10);
};
