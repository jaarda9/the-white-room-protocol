import { UserProfile, Quest, QuestAttempt, Attributes, KnowledgeDomain, KnowledgeData, KnowledgeProgress, KnowledgeTopic, QuizQuestion, QuizResult } from './types';
import { syncManager } from './sync-manager';
import chatGPTService from './chatgpt-service';

export const QUESTS_UPDATED_EVENT = 'wrp:quests-updated';

const STORAGE_KEYS = {
  USER_PROFILE: 'whiteroom_user_profile',
  QUESTS: 'whiteroom_quests',
  QUEST_ATTEMPTS: 'whiteroom_quest_attempts',
  DAILY_RESET: 'whiteroom_daily_reset',
  KNOWLEDGE_DATA: 'whiteroom_knowledge_data',
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
  xpToNextLevel: 100,
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

// User Profile operations
export const getUserProfile = (): UserProfile => {
  const stored = localStorage.getItem(STORAGE_KEYS.USER_PROFILE);
  if (!stored) {
    // Avoid race: if another caller is already creating a profile, re-read once (they may have written)
    if (profileCreationInProgress) {
      const after = localStorage.getItem(STORAGE_KEYS.USER_PROFILE);
      if (after) {
        try {
          return JSON.parse(after);
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
    return JSON.parse(stored);
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
  return Math.floor(100 * Math.pow(1.5, level - 1));
};

export const addXP = (profile: UserProfile, amount: number): UserProfile => {
  let newXP = profile.xp + amount;
  let newLevel = profile.level;
  let xpToNext = profile.xpToNextLevel;

  while (newXP >= xpToNext) {
    newXP -= xpToNext;
    newLevel += 1;
    xpToNext = calculateXPForLevel(newLevel);
  }

  return {
    ...profile,
    xp: newXP,
    level: newLevel,
    xpToNextLevel: xpToNext,
  };
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
    return JSON.parse(stored);
  }

  const quests = await generateDailyQuests();
  saveQuests(quests);
  localStorage.setItem(STORAGE_KEYS.DAILY_RESET, today);
  return quests;
};

export const saveQuests = (quests: Quest[]): void => {
  localStorage.setItem(STORAGE_KEYS.QUESTS, JSON.stringify(quests));
  
  // Trigger background sync (non-blocking)
  syncManager.saveUserData().catch(error => {
    console.error('Background sync failed:', error);
  });

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

// Generate daily quests
const generateDailyQuests = async (): Promise<Quest[]> => {
  const profile = getUserProfile();
  // Require AI-generated quests - no fallbacks
  const aiQuests = await requestAIQuestPlan(profile);
  if (!aiQuests || aiQuests.length !== 3) {
    throw new Error('AI failed to generate daily quests. All quests must be AI-generated.');
  }
  return aiQuests;
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
  const response = await chatGPTService.callChatGPTJSON<AIQuestResponse>(prompt, {
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
You are THE ARCHITECT of THE WHITE ROOM. Voice: sterile, concise, professional.

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

// Knowledge/Research Training Storage Functions
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
  
  // Trigger background sync (non-blocking)
  syncManager.saveUserData().catch(error => {
    console.error('Background sync failed:', error);
  });
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
