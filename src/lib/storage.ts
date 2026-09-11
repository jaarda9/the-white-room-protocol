import { UserProfile, Quest, QuestCategory, QuestAttempt, Attributes, KnowledgeDomain, KnowledgeData, KnowledgeProgress, KnowledgeTopic, QuizQuestion, QuizResult, ToDoItem } from './types';
import { scheduleSyncAfterGeneratedContentSave, syncManager } from './sync-manager';
import aiGatewayClient from './ai-gateway-client';
import { PRESET_SPLIT_TEMPLATES, getExerciseById, ExerciseDefinition } from './exercise-library';
import { recordOverdriveSession } from './achievements';

export const QUESTS_UPDATED_EVENT = 'wrp:quests-updated';
export const TODOS_UPDATED_EVENT = 'wrp:todos-updated';
export const PROTOCOL_CALIBRATED_EVENT = 'wrp:protocol-calibrated';

const STORAGE_KEYS = {
  USER_PROFILE: 'whiteroom_user_profile',
  QUESTS: 'whiteroom_quests',
  QUEST_ATTEMPTS: 'whiteroom_quest_attempts',
  DAILY_RESET: 'whiteroom_daily_reset',
  KNOWLEDGE_DATA: 'whiteroom_knowledge_data',
  PHYSICAL_QUEST_LOGS: 'whiteroom_physical_quest_logs',
  TODOS: 'whiteroom_todos',
  HUNTER_PROTOCOL_CONFIG: 'whiteroom_hunter_protocol_config',
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
});

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

  const todayStr = new Date().toISOString().split('T')[0];
  const isNewDay = Boolean(profile.lastRestDate && profile.lastRestDate !== todayStr);

  const physicalPlan = getPhysicalDayPlan(new Date());
  const isRestDay = Boolean(physicalPlan.isRestDay);

  if (isNewDay) {
    // Check if previous day had incomplete core system quests to apply HP penalty
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
      // HP penalty for missed mandatory daily protocol (with 15% safety floor)
      const hpSafetyFloor = Math.max(15, Math.floor(vitals.hp.max * 0.15));
      hp = Math.max(hpSafetyFloor, hp - 25);
    }

    // Nightly rest rejuvenation: resets fatigue to 0, heals +40 HP, restores full STM & +50 MP
    fatigue = 0;
    hp = Math.min(vitals.hp.max, hp + 40);
    stm = vitals.stm.max;
    mp = Math.min(vitals.mp.max, mp + 50);
    changed = true;
  } else if (elapsedMinutes >= 1) {
    const wis = Number(profile.visibleStats?.WIS) || 10;
    let recoveryMultiplier = 1 + Math.min(1.5, (wis - 10) * 0.015);

    if (isRestDay) {
      // Supercompensation on Rest Days: 2x recovery rate & fatigue flush
      recoveryMultiplier *= 2.0;
      if (fatigue > 0) {
        fatigue = 0;
        changed = true;
      }
      // Passive HP healing on Rest Days
      const hpGain = Math.floor(elapsedMinutes * 0.25 * recoveryMultiplier);
      if (hpGain > 0 && hp < vitals.hp.max) {
        hp = Math.min(vitals.hp.max, hp + hpGain);
        changed = true;
      }
    }

    // STM natural recovery: ~0.5 per minute (scales with WIS & Rest Day)
    const stmGain = Math.floor(elapsedMinutes * 0.5 * recoveryMultiplier);
    if (stmGain > 0 && stm < vitals.stm.max) {
      stm = Math.min(vitals.stm.max, stm + stmGain);
      changed = true;
    }

    // MP natural recovery: ~0.4 per minute
    const mpGain = Math.floor(elapsedMinutes * 0.4 * recoveryMultiplier);
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
  profile: UserProfile,
  intensity: 'light' | 'moderate' | 'heavy' = 'moderate'
): VitalsConsumptionResult => {
  const vitals = getHunterVitals(profile);
  const vit = Number(profile.visibleStats?.VIT) || 10;
  const str = Number(profile.visibleStats?.STR) || 10;

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

  if (currentStm < stmCost) {
    inOverdrive = true;
    currentStm = 0;
    // Overdrive adds extra fatigue strain
    currentFatigue = Math.min(100, currentFatigue + fatigueGain + 5);
    message = `[OVERDRIVE PROTOCOL: WILLPOWER DEPTHS] Pushed through zero stamina!`;
    try {
      recordOverdriveSession();
    } catch {}
  } else {
    currentStm = Math.max(0, currentStm - stmCost);
    currentFatigue = Math.min(100, currentFatigue + fatigueGain);
  }

  // If fatigue is at 95%+, overtraining inflicts minor HP damage down to 15% minimum safety floor
  const hpFloor = Math.max(15, Math.floor(vitals.hp.max * 0.15));
  if (currentFatigue >= 95 && currentHp > hpFloor) {
    currentHp = Math.max(hpFloor, currentHp - 5);
    message += ` (High strain: -5 HP)`;
  }

  const updated: UserProfile = {
    ...profile,
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
  profile: UserProfile,
  intensity: 'light' | 'moderate' | 'heavy' = 'moderate'
): VitalsConsumptionResult => {
  const vitals = getHunterVitals(profile);
  const int = Number(profile.visibleStats?.INT) || 10;
  const wis = Number(profile.visibleStats?.WIS) || 10;

  const baseCost = intensity === 'light' ? 8 : intensity === 'heavy' ? 22 : 15;
  const baseFatigue = intensity === 'light' ? 5 : intensity === 'heavy' ? 12 : 8;

  // Resistance reduction from INT and WIS (up to 50% discount)
  const discount = Math.min(0.5, (int - 10) * 0.005 + (wis - 10) * 0.003);
  const mpCost = Math.max(5, Math.floor(baseCost * (1 - discount)));
  const fatigueGain = Math.max(3, Math.floor(baseFatigue * (1 - Math.min(0.5, (wis - 10) * 0.005))));

  let currentMp = vitals.mp.current;
  let currentFatigue = vitals.fatigue;
  let inOverdrive = false;
  let message = `Spent -${mpCost} MP (+${fatigueGain}% Fatigue)`;

  if (currentMp < mpCost) {
    inOverdrive = true;
    currentMp = 0;
    currentFatigue = Math.min(100, currentFatigue + fatigueGain + 4);
    message = `[OVERDRIVE PROTOCOL: MENTAL FORTITUDE] Pushed through mental exhaustion!`;
    try {
      recordOverdriveSession();
    } catch {}
  } else {
    currentMp = Math.max(0, currentMp - mpCost);
    currentFatigue = Math.min(100, currentFatigue + fatigueGain);
  }

  const updated: UserProfile = {
    ...profile,
    fatigue: currentFatigue,
    hp: vitals.hp,
    mp: { current: currentMp, max: vitals.mp.max },
    stm: vitals.stm,
    vitalsLastUpdatedAt: Date.now(),
  };

  saveUserProfile(updated);
  return { profile: updated, inOverdrive, message };
};

export const applyQuickAction = (
  action: 'hydrate' | 'elixir' | 'meditate'
): { profile: UserProfile; message: string } => {
  const profile = getUserProfile();
  const vitals = getHunterVitals(profile);

  let hp = vitals.hp.current;
  let mp = vitals.mp.current;
  let stm = vitals.stm.current;
  let fatigue = vitals.fatigue;
  let message = '';

  if (action === 'hydrate') {
    // 💧 Hydration Potion: +15 STM, -5% Fatigue
    stm = Math.min(vitals.stm.max, stm + 15);
    fatigue = Math.max(0, fatigue - 5);
    message = 'Hydration applied: +15 STM, -5% Fatigue';
  } else if (action === 'elixir') {
    // ☕ Mana Elixir: +25 MP
    mp = Math.min(vitals.mp.max, mp + 25);
    message = 'Mana surge applied: +25 MP';
  } else if (action === 'meditate') {
    // 🧘 Meditation: -10% Fatigue, +5 HP
    fatigue = Math.max(0, fatigue - 10);
    hp = Math.min(vitals.hp.max, hp + 5);
    message = 'Recovery breathing: -10% Fatigue, +5 HP restored';
  }

  const updated: UserProfile = {
    ...profile,
    fatigue,
    hp: { current: hp, max: vitals.hp.max },
    mp: { current: mp, max: vitals.mp.max },
    stm: { current: stm, max: vitals.stm.max },
    vitalsLastUpdatedAt: Date.now(),
  };

  saveUserProfile(updated);
  return { profile: updated, message };
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
          const regenerated = applyVitalsRegeneration(normalizedAttributes.profile);
          if (normalizedProgress.changed || normalizedAttributes.changed || regenerated.changed) {
            localStorage.setItem(STORAGE_KEYS.USER_PROFILE, JSON.stringify(regenerated.profile));
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
    const normalizedProgress = normalizeProfileProgress(parsed);
    const normalizedAttributes = normalizeAttributeAnomalies(normalizedProgress.profile);
    const regenerated = applyVitalsRegeneration(normalizedAttributes.profile);
    if (normalizedProgress.changed || normalizedAttributes.changed || regenerated.changed) {
      localStorage.setItem(STORAGE_KEYS.USER_PROFILE, JSON.stringify(regenerated.profile));
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

export const saveUserProfile = (profile: UserProfile): void => {
  (profile as any).exp = profile.xp;
  localStorage.setItem(STORAGE_KEYS.USER_PROFILE, JSON.stringify(profile));

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

  // Title Effect: Peak Vitality (+10% EXP Gain) when maintaining 90%+ HP
  const isPeakVitality = vitals.hp.current >= Math.floor(vitals.hp.max * 0.9);
  const peakVitalityMultiplier = isPeakVitality ? 1.10 : 1.0;

  // Stat-driven boost: STR boosts physical workout EXP (+0.5% per pt > 10, up to +20%), INT boosts mental
  const str = Number(profile.visibleStats?.STR) || 10;
  const int = Number(profile.visibleStats?.INT) || 10;
  let statMultiplier = 1.0;
  if (domain === 'physical' && str > 10) {
    statMultiplier = 1 + Math.min(0.20, (str - 10) * 0.005);
  } else if (domain === 'mental' && int > 10) {
    statMultiplier = 1 + Math.min(0.20, (int - 10) * 0.005);
  }

  const effectiveAmount = Math.max(1, Math.round(amount * fatigueMultiplier * peakVitalityMultiplier * statMultiplier));

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

export interface HunterProtocolConfig {
  physicalPath: 'system' | 'custom';
  selectedTemplateId?: string;
  customWeeklySplit: Record<number, CustomDayPlan>;
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

  const isMeditationQuest = (q: Quest) =>
    q.id.startsWith('mental-meditation') ||
    q.title.toLowerCase().includes('meditation');

  if (!masterQuests.some(isMeditationQuest)) {
    masterQuests.push({
      id: `mental-meditation-${todayKey}`,
      type: 'mental',
      title: '10 Min Meditation',
      description: 'Engage in 10 minutes of silent mindfulness, breath control, and mental clarity.',
      xp: 15,
      duration: 10,
      difficulty: 1,
      hiddenRewards: { WIS: 1, PER: 1 },
      completed: false,
      origin: 'system',
      generatedAt: todayKey,
    });
  }

  // 3. Synchronize physical and mental attributes
  return masterQuests.map((q) => {
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
  const lastReset = localStorage.getItem(STORAGE_KEYS.DAILY_RESET);
  
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
  let questToComplete: Quest | undefined;

  const updated = quests.map(q => {
    if (q.id === questId) {
      const nextCompleted = forceState !== undefined ? forceState : !q.completed;
      if (nextCompleted && !q.completed) {
        questToComplete = q;
      }
      return {
        ...q,
        completed: nextCompleted,
        completedAt: nextCompleted ? new Date().toISOString() : undefined,
      };
    }
    return q;
  });

  saveQuests(updated);

  // Consume vitals on quest completion
  if (questToComplete) {
    const prof = getUserProfile();
    if (questToComplete.type === 'physical') {
      consumePhysicalEnergy(prof, 'moderate');
    } else if (questToComplete.type === 'mental') {
      consumeMentalEnergy(prof, 'moderate');
    } else if (questToComplete.type === 'spiritual') {
      applyQuickAction('meditate');
    }
  }

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
      id: `mental-meditation-${today}`,
      type: 'mental' as QuestCategory,
      title: '10 Min Meditation',
      description: 'Engage in 10 minutes of silent mindfulness, breath control, and mental clarity.',
      xp: 15,
      duration: 10,
      difficulty: 1,
      hiddenRewards: { WIS: 1, PER: 1 },
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
    // ── Spiritual ──
    {
      id: `spiritual-morning-${today}`,
      type: 'social' as QuestCategory,
      title: 'Morning Adhkar',
      description: 'Complete your morning remembrance.',
      xp: 15, duration: 10, difficulty: 1,
      hiddenRewards: { WIS: 1 },
      completed: false, origin: 'system', generatedAt: today,
    },
    {
      id: `spiritual-evening-${today}`,
      type: 'social' as QuestCategory,
      title: 'Evening Adhkar',
      description: 'Complete your evening remembrance.',
      xp: 15, duration: 10, difficulty: 1,
      hiddenRewards: { PER: 1 },
      completed: false, origin: 'system', generatedAt: today,
    },
    {
      id: `spiritual-witr-${today}`,
      type: 'social' as QuestCategory,
      title: 'Witr Salah',
      description: 'Pray Witr at the end of the day.',
      xp: 20, duration: 10, difficulty: 1,
      hiddenRewards: { WIS: 1, PER: 1 },
      completed: false, origin: 'system', generatedAt: today,
    },
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
