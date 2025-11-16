import { UserProfile, Quest, QuestAttempt, Attributes } from './types';

const STORAGE_KEYS = {
  USER_PROFILE: 'whiteroom_user_profile',
  QUESTS: 'whiteroom_quests',
  QUEST_ATTEMPTS: 'whiteroom_quest_attempts',
  DAILY_RESET: 'whiteroom_daily_reset',
};

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
  return stored ? JSON.parse(stored) : generateDailyQuests();
};

export const saveQuests = (quests: Quest[]): void => {
  localStorage.setItem(STORAGE_KEYS.QUESTS, JSON.stringify(quests));
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

  return [
    { ...selectedMental, id: crypto.randomUUID(), completed: false },
    { ...selectedPhysical, id: crypto.randomUUID(), completed: false },
    { ...selectedSocial, id: crypto.randomUUID(), completed: false },
  ];
};

// Quest attempts
export const saveQuestAttempt = (attempt: QuestAttempt): void => {
  const stored = localStorage.getItem(STORAGE_KEYS.QUEST_ATTEMPTS);
  const attempts: QuestAttempt[] = stored ? JSON.parse(stored) : [];
  attempts.push(attempt);
  localStorage.setItem(STORAGE_KEYS.QUEST_ATTEMPTS, JSON.stringify(attempts));
};

export const getQuestAttempts = (): QuestAttempt[] => {
  const stored = localStorage.getItem(STORAGE_KEYS.QUEST_ATTEMPTS);
  return stored ? JSON.parse(stored) : [];
};
