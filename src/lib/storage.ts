import { UserProfile, Quest, QuestCategory, QuestAttempt, Attributes, KnowledgeDomain, KnowledgeData, KnowledgeProgress, KnowledgeTopic, QuizQuestion, QuizResult, ToDoItem } from './types';
import { scheduleSyncAfterGeneratedContentSave, syncManager } from './sync-manager';
import aiGatewayClient from './ai-gateway-client';

export const QUESTS_UPDATED_EVENT = 'wrp:quests-updated';
export const TODOS_UPDATED_EVENT = 'wrp:todos-updated';

const STORAGE_KEYS = {
  USER_PROFILE: 'whiteroom_user_profile',
  QUESTS: 'whiteroom_quests',
  QUEST_ATTEMPTS: 'whiteroom_quest_attempts',
  DAILY_RESET: 'whiteroom_daily_reset',
  KNOWLEDGE_DATA: 'whiteroom_knowledge_data',
  PHYSICAL_QUEST_LOGS: 'whiteroom_physical_quest_logs',
  TODOS: 'whiteroom_todos',
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
  displayName: 'Sung Jin-woo',
  pseudo: `HUNTER-${Math.random().toString(36).substring(2, 8).toUpperCase()}`,
  level: 18,
  xp: 0,
  xpToNextLevel: calculateXPForLevel(18),
  job: 'None',
  title: 'Wolf Assassin',
  hunterRank: 'E',
  availableAP: 12,
  fatigue: 0,
  visibleStats: {
    STR: 48,
    AGI: 27,
    VIT: 27,
    INT: 27,
    PER: 27,
    WIS: 27,
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
  if (customTitle) return customTitle;
  if (level >= 50) return 'Supreme Sovereign';
  if (level >= 40) return 'Ruler of the Dead';
  if (level >= 30) return 'Demon Slayer';
  if (level >= 20) return 'Dungeon Conqurer';
  if (level >= 10) return 'Wolf Assassin';
  return 'Wolf Assassin';
};

export const getHunterVitals = (profile: UserProfile): {
  hp: { current: number; max: number };
  mp: { current: number; max: number };
  fatigue: number;
} => {
  const vit = profile.visibleStats?.VIT ?? 27;
  const str = profile.visibleStats?.STR ?? 48;
  const int = profile.visibleStats?.INT ?? 27;
  const per = profile.visibleStats?.PER ?? 27;
  const lvl = profile.level || 18;

  // Formula calibrated to match anime screenshot (LV 18, STR 48, VIT 27 => HP 2220; INT 27, PER 27 => MP 350)
  const maxHp = Math.max(500, Math.floor(vit * 40 + str * 16 + lvl * 20));
  const maxMp = Math.max(100, Math.floor(int * 8 + per * 4 + lvl * 2));
  const fatigue = Math.max(0, Math.min(100, profile.fatigue ?? 0));

  return {
    hp: { current: maxHp, max: maxHp },
    mp: { current: maxMp, max: maxMp },
    fatigue,
  };
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
  let level = Number.isFinite(profile.level) ? Math.max(1, Math.floor(profile.level)) : 1;
  let xp = Number.isFinite(profile.xp) ? Math.max(0, Math.floor(profile.xp)) : 0;
  let xpToNext = calculateXPForLevel(level);

  while (xp >= xpToNext) {
    xp -= xpToNext;
    level += 1;
    xpToNext = calculateXPForLevel(level);
  }

  const changed =
    level !== profile.level ||
    xp !== profile.xp ||
    xpToNext !== profile.xpToNextLevel;

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
  const normalizedVisible: Attributes = { ...profile.visibleStats };
  const normalizedAccumulated: Attributes = { ...profile.accumulatedPoints };

  let changed = false;
  const attrs = Object.keys(normalizedVisible) as Array<keyof Attributes>;

  const clampOutlier = (
    values: Attributes,
    key: keyof Attributes,
    level: number,
    leadBase: number
  ): number => {
    const current = Math.max(0, Number(values[key]) || 0);
    const others = attrs.filter((a) => a !== key).map((a) => Math.max(0, Number(values[a]) || 0));
    const othersAvg =
      others.reduce((sum, v) => sum + v, 0) / Math.max(1, others.length);
    const allowedLead = leadBase + level * 2;
    const maxAllowed = Math.max(10, Math.floor(othersAvg + allowedLead));
    return Math.min(current, maxAllowed);
  };

  // Visible stats: strict anomaly guard (prevents impossible injected values like 400 vs 10 baseline).
  attrs.forEach((attr) => {
    const clamped = clampOutlier(normalizedVisible, attr, profile.level, 20);
    if (clamped !== normalizedVisible[attr]) {
      normalizedVisible[attr] = clamped;
      changed = true;
    }
  });

  // Accumulated points: looser guard (allows reserves, but blocks extreme injected values).
  attrs.forEach((attr) => {
    const clamped = clampOutlier(normalizedAccumulated, attr, profile.level, 40);
    if (clamped !== normalizedAccumulated[attr]) {
      normalizedAccumulated[attr] = clamped;
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
          if (normalizedProgress.changed || normalizedAttributes.changed) {
            localStorage.setItem(STORAGE_KEYS.USER_PROFILE, JSON.stringify(normalizedAttributes.profile));
          }
          return normalizedAttributes.profile;
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
    if (parsed.availableAP === undefined) parsed.availableAP = 12;
    if (parsed.fatigue === undefined) parsed.fatigue = 0;
    if (!parsed.job) parsed.job = 'None';
    if (!parsed.title) parsed.title = 'Wolf Assassin';
    const normalizedProgress = normalizeProfileProgress(parsed);
    const normalizedAttributes = normalizeAttributeAnomalies(normalizedProgress.profile);
    if (normalizedProgress.changed || normalizedAttributes.changed) {
      localStorage.setItem(STORAGE_KEYS.USER_PROFILE, JSON.stringify(normalizedAttributes.profile));
    }
    return normalizedAttributes.profile;
  } catch (error) {
    console.error('[Storage] Error parsing stored profile, creating new one:', error);
    const newProfile = createDefaultProfile();
    saveUserProfile(newProfile);
    return newProfile;
  }
};

export const saveUserProfile = (profile: UserProfile): void => {
  localStorage.setItem(STORAGE_KEYS.USER_PROFILE, JSON.stringify(profile));
  
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
  return Math.floor(100 * Math.pow(1.25, level - 1));
};

export const addXP = (profile: UserProfile, amount: number): UserProfile => {
  let newXP = Math.max(0, profile.xp + amount);
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
interface PhysicalDayPlan {
  title: string;
  description: string;
  duration: number;
  xp: number;
  difficulty: number;
  hiddenRewards: Partial<Attributes>;
}

export type PhysicalLogRowKind = "strength" | "cardio" | "flexibility" | "other";

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

export const getPhysicalDayPlan = (date: Date): PhysicalDayPlan => {
  const day = date.getDay(); // 0=Sunday ... 6=Saturday

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

const applyPhysicalPlanToQuests = (quests: Quest[], date: Date): Quest[] => {
  const plan = getPhysicalDayPlan(date);
  return quests.map((q) =>
    q.type !== "physical"
      ? q
      : {
          ...q,
          title: plan.title,
          description: plan.description,
          duration: plan.duration,
          xp: plan.xp,
          difficulty: plan.difficulty,
          hiddenRewards: plan.hiddenRewards,
        }
  );
};

export const getDailyQuests = async (): Promise<Quest[]> => {
  const today = new Date().toDateString();
  const lastReset = localStorage.getItem(STORAGE_KEYS.DAILY_RESET);
  
  if (lastReset !== today) {
    const newQuests = await generateDailyQuests();
    saveQuests(newQuests);
    localStorage.setItem(STORAGE_KEYS.DAILY_RESET, today);
    return newQuests;
  }

  const stored = localStorage.getItem(STORAGE_KEYS.QUESTS);
  if (stored) {
    const parsed = JSON.parse(stored) as Quest[];
    const adjusted = applyPhysicalPlanToQuests(parsed, new Date());
    if (JSON.stringify(adjusted) !== JSON.stringify(parsed)) {
      saveQuests(adjusted);
      return adjusted;
    }
    return parsed;
  }

  const quests = await generateDailyQuests();
  saveQuests(quests);
  localStorage.setItem(STORAGE_KEYS.DAILY_RESET, today);
  return quests;
};

export const saveQuests = (quests: Quest[]): void => {
  localStorage.setItem(STORAGE_KEYS.QUESTS, JSON.stringify(quests));
  scheduleSyncAfterGeneratedContentSave();

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(QUESTS_UPDATED_EVENT));
  }
};

export const completeQuest = (questId: string): void => {
  const stored = localStorage.getItem(STORAGE_KEYS.QUESTS);
  if (!stored) return;
  const quests: Quest[] = JSON.parse(stored);
  const updated = quests.map(q =>
    q.id === questId ? { ...q, completed: true, completedAt: new Date().toISOString() } : q
  );
  saveQuests(updated);
};

// Generate daily quests — fixed protocol (no AI)
const generateDailyQuests = async (): Promise<Quest[]> => {
  const today = new Date().toISOString();
  const physicalPlan = getPhysicalDayPlan(new Date());
  return [
    // ── Mental ──
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
    {
      id: `mental-study1-${today}`,
      type: 'mental' as QuestCategory,
      title: 'Study Session 1 (45 Min)',
      description: 'Focused study session — 45 minutes.',
      xp: 30, duration: 45, difficulty: 3,
      hiddenRewards: { INT: 2 },
      completed: false, origin: 'system', generatedAt: today,
    },
    {
      id: `mental-study2-${today}`,
      type: 'mental' as QuestCategory,
      title: 'Study Session 2 (45 Min)',
      description: 'Focused study session — 45 minutes.',
      xp: 30, duration: 45, difficulty: 3,
      hiddenRewards: { PER: 2 },
      completed: false, origin: 'system', generatedAt: today,
    },
    {
      id: `mental-study3-${today}`,
      type: 'mental' as QuestCategory,
      title: 'Study Session 3 (45 Min)',
      description: 'Focused study session — 45 minutes.',
      xp: 30, duration: 45, difficulty: 3,
      hiddenRewards: { WIS: 2 },
      completed: false, origin: 'system', generatedAt: today,
    },
    {
      id: `mental-study4-${today}`,
      type: 'mental' as QuestCategory,
      title: 'Study Session 4 (45 Min)',
      description: 'Focused study session — 45 minutes.',
      xp: 30, duration: 45, difficulty: 3,
      hiddenRewards: { PER: 2 },
      completed: false, origin: 'system', generatedAt: today,
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
