import { UserProfile, Quest, QuestAttempt, Attributes } from './types';

// API base URL - use environment variable or default to relative path for Vercel
const API_BASE = import.meta.env.VITE_API_URL || '/api';

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
export const getUserProfile = async (): Promise<UserProfile> => {
  try {
    const response = await fetch(`${API_BASE}/user-profile`);
    if (response.status === 404) {
      // Profile doesn't exist, create a new one
      const newProfile = createDefaultProfile();
      await saveUserProfile(newProfile);
      return newProfile;
    }
    if (!response.ok) {
      throw new Error('Failed to fetch user profile');
    }
    return await response.json();
  } catch (error) {
    console.error('Error fetching user profile:', error);
    // Fallback: create and return default profile
    const newProfile = createDefaultProfile();
    await saveUserProfile(newProfile).catch(() => {
      // If save fails, still return the profile (it will be saved on next operation)
    });
    return newProfile;
  }
};

export const saveUserProfile = async (profile: UserProfile): Promise<void> => {
  try {
    const response = await fetch(`${API_BASE}/user-profile`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(profile),
    });
    if (!response.ok) {
      throw new Error('Failed to save user profile');
    }
  } catch (error) {
    console.error('Error saving user profile:', error);
    throw error;
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
  try {
    const today = new Date().toDateString();
    const response = await fetch(`${API_BASE}/quests`);
    
    if (!response.ok) {
      throw new Error('Failed to fetch quests');
    }
    
    const data = await response.json();
    const lastReset = data.lastReset || '';
    
    if (lastReset !== today) {
      // Need to generate new quests for today
      const newQuests = generateDailyQuests();
      await saveQuests(newQuests, today);
      return newQuests;
    }
    
    return data.quests || [];
  } catch (error) {
    console.error('Error fetching quests:', error);
    // Fallback: generate new quests
    const newQuests = generateDailyQuests();
    const today = new Date().toDateString();
    await saveQuests(newQuests, today).catch(() => {
      // If save fails, still return the quests
    });
    return newQuests;
  }
};

export const saveQuests = async (quests: Quest[], lastReset?: string): Promise<void> => {
  try {
    const today = lastReset || new Date().toDateString();
    const response = await fetch(`${API_BASE}/quests`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        quests,
        lastReset: today,
      }),
    });
    if (!response.ok) {
      throw new Error('Failed to save quests');
    }
  } catch (error) {
    console.error('Error saving quests:', error);
    throw error;
  }
};

export const completeQuest = async (questId: string): Promise<void> => {
  // Fetch quests and preserve the lastReset date to maintain consistency
  const today = new Date().toDateString();
  const response = await fetch(`${API_BASE}/quests`);
  
  let lastReset: string;
  let quests: Quest[];
  
  if (!response.ok) {
    // If fetch fails, generate new quests
    quests = generateDailyQuests();
    lastReset = today;
  } else {
    const data = await response.json();
    lastReset = data.lastReset || today;
    
    if (lastReset !== today) {
      // Need to generate new quests for today
      quests = generateDailyQuests();
      lastReset = today;
    } else {
      quests = data.quests || [];
    }
  }
  
  const updated = quests.map(q => 
    q.id === questId ? { ...q, completed: true, completedAt: new Date().toISOString() } : q
  );
  // Pass lastReset to preserve consistency with the quest date
  await saveQuests(updated, lastReset);
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
export const saveQuestAttempt = async (attempt: QuestAttempt): Promise<void> => {
  try {
    const response = await fetch(`${API_BASE}/quest-attempts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(attempt),
    });
    if (!response.ok) {
      throw new Error('Failed to save quest attempt');
    }
  } catch (error) {
    console.error('Error saving quest attempt:', error);
    throw error;
  }
};

export const getQuestAttempts = async (): Promise<QuestAttempt[]> => {
  try {
    const response = await fetch(`${API_BASE}/quest-attempts`);
    if (!response.ok) {
      throw new Error('Failed to fetch quest attempts');
    }
    return await response.json();
  } catch (error) {
    console.error('Error fetching quest attempts:', error);
    return [];
  }
};
