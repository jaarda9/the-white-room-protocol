import { UserProfile, Quest, QuestAttempt, Attributes } from './types';
import { syncManager } from './sync-manager';
import chatGPTService from './chatgpt-service';

export const QUESTS_UPDATED_EVENT = 'wrp:quests-updated';

const STORAGE_KEYS = {
  USER_PROFILE: 'whiteroom_user_profile',
  QUESTS: 'whiteroom_quests',
  QUEST_ATTEMPTS: 'whiteroom_quest_attempts',
  DAILY_RESET: 'whiteroom_daily_reset',
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
    const newProfile = createDefaultProfile();
    saveUserProfile(newProfile);
    return newProfile;
  }
  return JSON.parse(stored);
};

export const saveUserProfile = (profile: UserProfile): void => {
  localStorage.setItem(STORAGE_KEYS.USER_PROFILE, JSON.stringify(profile));
  
  // Trigger background sync (non-blocking)
  syncManager.saveUserData().catch(error => {
    console.error('Background sync failed:', error);
    // Fail silently - localStorage is the source of truth
  });
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
export const getDailyQuests = (): Quest[] => {
  const today = new Date().toDateString();
  const lastReset = localStorage.getItem(STORAGE_KEYS.DAILY_RESET);
  
  if (lastReset !== today) {
    const newQuests = generateDailyQuests();
    saveQuests(newQuests);
    localStorage.setItem(STORAGE_KEYS.DAILY_RESET, today);
    return newQuests;
  }

  const stored = localStorage.getItem(STORAGE_KEYS.QUESTS);
  if (stored) {
    const quests: Quest[] = JSON.parse(stored);
    if (!quests.every(q => q.origin === 'ai')) {
      requestAIQuestUpgrade(quests);
    }
    return quests;
  }
  return generateDailyQuests();
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
  const quests = getDailyQuests();
  const updated = quests.map(q => 
    q.id === questId ? { ...q, completed: true, completedAt: new Date().toISOString() } : q
  );
  saveQuests(updated);
};

// Generate daily quests
const generateDailyQuests = (): Quest[] => {
  const mentalQuests: Omit<Quest, 'id' | 'completed'>[] = [
    {
      type: 'mental',
      title: 'Cognitive Pattern Analysis',
      description: 'Complete logical sequence puzzles. Focus on pattern recognition and deductive reasoning.',
      xp: 25,
      duration: 15,
      hiddenRewards: { INT: 2, PER: 1 },
      difficulty: 2,
    },
    {
      type: 'mental',
      title: 'Memory Protocol',
      description: 'Memorize and recall 20 random alphanumeric sequences. Accuracy above 85% required.',
      xp: 30,
      duration: 20,
      hiddenRewards: { INT: 3, WIS: 1 },
      difficulty: 3,
    },
    {
      type: 'mental',
      title: 'Strategic Analysis',
      description: 'Analyze three hypothetical conflict scenarios. Identify optimal decision paths.',
      xp: 35,
      duration: 25,
      hiddenRewards: { INT: 2, WIS: 2 },
      difficulty: 4,
    },
  ];

  const physicalQuests: Omit<Quest, 'id' | 'completed'>[] = [
    {
      type: 'physical',
      title: 'Endurance Protocol',
      description: '30 minutes sustained cardiovascular activity. Maintain target heart rate zone.',
      xp: 20,
      duration: 30,
      hiddenRewards: { VIT: 2, STR: 1 },
      difficulty: 2,
    },
    {
      type: 'physical',
      title: 'Strength Training',
      description: 'Complete resistance training circuit. 3 sets, progressive overload principle.',
      xp: 25,
      duration: 45,
      hiddenRewards: { STR: 3, VIT: 1 },
      difficulty: 3,
    },
    {
      type: 'physical',
      title: 'Agility Drills',
      description: 'Speed and coordination exercises. Measure reaction time improvement.',
      xp: 22,
      duration: 20,
      hiddenRewards: { AGI: 3, VIT: 1 },
      difficulty: 2,
    },
  ];

  const socialQuests: Omit<Quest, 'id' | 'completed'>[] = [
    {
      type: 'social',
      title: 'Observation Study',
      description: 'Document micro-expressions and behavioral patterns in 3 social interactions.',
      xp: 28,
      duration: 30,
      hiddenRewards: { PER: 3, WIS: 1 },
      difficulty: 3,
    },
    {
      type: 'social',
      title: 'Controlled Dialogue',
      description: 'Navigate conversation toward predetermined outcome. Minimize verbal reveals.',
      xp: 32,
      duration: 20,
      hiddenRewards: { PER: 2, WIS: 2 },
      difficulty: 4,
    },
    {
      type: 'social',
      title: 'Situational Analysis',
      description: 'Analyze group dynamics in recorded scenario. Identify power structures and alliances.',
      xp: 26,
      duration: 25,
      hiddenRewards: { INT: 1, PER: 2, WIS: 1 },
      difficulty: 3,
    },
  ];

  // Select random quests from each category
  const selectedMental = mentalQuests[Math.floor(Math.random() * mentalQuests.length)];
  const selectedPhysical = physicalQuests[Math.floor(Math.random() * physicalQuests.length)];
  const selectedSocial = socialQuests[Math.floor(Math.random() * socialQuests.length)];

  const generatedAt = new Date().toISOString();
  const baseQuests: Quest[] = [
    { ...selectedMental, id: crypto.randomUUID(), completed: false, origin: 'system', generatedAt },
    { ...selectedPhysical, id: crypto.randomUUID(), completed: false, origin: 'system', generatedAt },
    { ...selectedSocial, id: crypto.randomUUID(), completed: false, origin: 'system', generatedAt },
  ];

  requestAIQuestUpgrade(baseQuests);

  return baseQuests;
};

let aiQuestRequest: Promise<void> | null = null;

function requestAIQuestUpgrade(baseQuests: Quest[]): void {
  if (typeof window === 'undefined') return;
  if (aiQuestRequest) return;

  aiQuestRequest = (async () => {
    try {
      const profile = getUserProfile();
      const prompt = buildAIQuestPrompt(profile, baseQuests);
      const aiResponse = await chatGPTService.callChatGPTJSON<AIQuestResponse>(prompt, {
        temperature: 0.8,
        maxTokens: 800,
      });

      if (!aiResponse?.quests?.length) {
        console.warn('AI quest generation returned empty payload');
        return;
      }

      const aiQuests = sanitizeAIQuests(aiResponse.quests).map(quest => ({
        ...quest,
        id: crypto.randomUUID(),
        completed: false,
        origin: 'ai',
        generatedAt: new Date().toISOString(),
      }));

      if (aiQuests.length === 3) {
        saveQuests(aiQuests);
        console.log('AI quests generated and saved');
      }
    } catch (error) {
      console.warn('AI quest generation failed, keeping system quests', error);
    } finally {
      aiQuestRequest = null;
    }
  })();
}

interface AIQuestResponse {
  quests: Array<{
    type: string;
    title: string;
    description: string;
    xp: number;
    duration: number;
    difficulty: number;
    hiddenRewards?: Partial<Attributes>;
  }>;
}

function buildAIQuestPrompt(profile: UserProfile, baseQuests: Quest[]): string {
  const stats = JSON.stringify(profile.visibleStats, null, 2);
  const accumulated = JSON.stringify(profile.accumulatedPoints, null, 2);
  const summary = baseQuests.map(q => `- ${q.type.toUpperCase()}: ${q.title} (difficulty ${q.difficulty}) -> ${q.description}`).join('\n');

  return `
You are THE ARCHITECT from Solo Leveling, generating real-world self-improvement quests.

PLAYER PROFILE:
- Level: ${profile.level}
- XP Progress: ${profile.xp}/${profile.xpToNextLevel}
- Visible Stats: ${stats}
- Accumulated (hidden) Points: ${accumulated}

CURRENT PROTOCOL TEMPLATE:
${summary}

TASK:
Generate 3 quests (mental, physical, social) tailored to this player. Each quest must be actionable in real life, concise, and use THE ARCHITECT tone.

Return JSON with this exact structure:
{
  "quests": [
    {
      "type": "mental|physical|social",
      "title": "2-4 words",
      "description": "One sentence describing the task in Solo Leveling style",
      "xp": number (between 15 and 60, scale with difficulty),
      "duration": number (minutes, between 10 and 60),
      "difficulty": number (1-5, 5 hardest),
      "hiddenRewards": {
        "STR"?: number,
        "AGI"?: number,
        "VIT"?: number,
        "INT"?: number,
        "PER"?: number,
        "WIS"?: number
      }
    }
  ]
}

Rules:
- Must output exactly 3 quests.
- Keep descriptions actionable (no fantasy magic).
- Difficulty 1-5, consistent with xp and duration.
- Hidden rewards can be zero or omitted if not relevant.
- Maintain Solo Leveling / Architect tone.
`;
}

function sanitizeAIQuests(quests: AIQuestResponse['quests']): Quest[] {
  const allowedTypes: Quest['type'][] = ['mental', 'physical', 'social'];

  return quests
    .filter(Boolean)
    .map((quest, index) => {
      const type = allowedTypes.includes(quest.type as Quest['type'])
        ? (quest.type as Quest['type'])
        : allowedTypes[index % allowedTypes.length];

      const xp = Math.max(15, Math.min(80, Math.round(quest.xp || 20)));
      const duration = Math.max(10, Math.min(60, Math.round(quest.duration || 20)));
      const difficulty = Math.max(1, Math.min(5, Math.round(quest.difficulty || 2)));

      const hiddenRewards: Partial<Attributes> = {};
      const rewards = quest.hiddenRewards || {};
      (Object.keys(rewards) as (keyof Attributes)[]).forEach(attr => {
        const value = rewards[attr];
        if (typeof value === 'number' && value > 0) {
          hiddenRewards[attr] = Math.min(5, Math.max(1, Math.round(value)));
        }
      });

      return {
        type,
        title: quest.title?.trim() || `Protocol ${type}`,
        description: quest.description?.trim() || 'Execute a focused training protocol.',
        xp,
        duration,
        difficulty,
        hiddenRewards,
      } as Quest;
    })
    .slice(0, 3);
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
