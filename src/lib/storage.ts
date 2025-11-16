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

export const getCurrentProfile = () => getUserProfile();

export const addXPWithAttributes = (xp: number, attributes?: Partial<Attributes>) => {
  const profile = getUserProfile();
  let updated = addXP(profile, xp);
  
  if (attributes) {
    const newAccumulated = { ...updated.accumulatedPoints };
    Object.keys(attributes).forEach(key => {
      const attr = key as keyof Attributes;
      newAccumulated[attr] += attributes[attr] || 0;
    });
    updated = { ...updated, accumulatedPoints: newAccumulated };
  }
  
  saveUserProfile(updated);
};

export const getSocialScenarios = (): SocialScenario[] => {
  const stored = localStorage.getItem('social_scenarios');
  if (stored) return JSON.parse(stored);
  const scenarios = generateSocialScenarios();
  localStorage.setItem('social_scenarios', JSON.stringify(scenarios));
  return scenarios;
};

export const getSocialScenarioById = (id: string) => getSocialScenarios().find(s => s.id === id) || null;

export const getMentalChallenges = (): MentalChallenge[] => {
  const stored = localStorage.getItem('mental_challenges');
  if (stored) return JSON.parse(stored);
  const challenges = generateMentalChallenges();
  localStorage.setItem('mental_challenges', JSON.stringify(challenges));
  return challenges;
};

export const getMentalChallengeById = (id: string) => getMentalChallenges().find(c => c.id === id) || null;

export const getPhysicalExercises = (): PhysicalExercise[] => {
  const stored = localStorage.getItem('physical_exercises');
  if (stored) return JSON.parse(stored);
  const exercises = generatePhysicalExercises();
  localStorage.setItem('physical_exercises', JSON.stringify(exercises));
  return exercises;
};

export const getPhysicalExerciseById = (id: string) => getPhysicalExercises().find(e => e.id === id) || null;

export const saveScenarioAttempt = (attempt: Omit<ScenarioAttempt, 'id' | 'timestamp'>): ScenarioAttempt => {
  const attempts = getScenarioAttempts();
  const newAttempt: ScenarioAttempt = {
    ...attempt,
    id: `attempt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    timestamp: new Date().toISOString()
  };
  attempts.push(newAttempt);
  localStorage.setItem('scenario_attempts', JSON.stringify(attempts));
  return newAttempt;
};

export const getScenarioAttempts = (): ScenarioAttempt[] => {
  const stored = localStorage.getItem('scenario_attempts');
  return stored ? JSON.parse(stored) : [];
};

function generateSocialScenarios(): SocialScenario[] {
  return [
    {
      id: 'social_001',
      title: 'Team Conflict Resolution',
      description: 'Navigate a tense group discussion where hidden agendas threaten project success.',
      difficulty: 3,
      startNodeId: 'node_1',
      xpReward: 50,
      attributeRewards: { PER: 3, WIS: 2, INT: 1 },
      optimalPath: ['node_1', 'choice_observe', 'node_3', 'choice_address'],
      nodes: {
        node_1: {
          id: 'node_1',
          speaker: 'Marcus',
          text: 'We need to discuss the budget cuts. Some departments will lose resources.',
          context: 'Team lead seems nervous. Sarah is avoiding eye contact.',
          emotionalState: 'tense',
          choices: [
            {
              id: 'choice_jump',
              text: 'Immediately propose a solution',
              observationLevel: 'low',
              nextNodeId: 'node_2_bad',
              consequences: { WIS: -1 },
              tags: ['hasty']
            },
            {
              id: 'choice_observe',
              text: 'Remain silent and observe reactions',
              observationLevel: 'high',
              nextNodeId: 'node_3',
              consequences: { PER: 2 },
              tags: ['optimal']
            }
          ]
        },
        node_2_bad: {
          id: 'node_2_bad',
          speaker: 'Sarah',
          text: 'You don\'t even know what the real issues are!',
          context: 'Your hasty suggestion missed the underlying tension.',
          choices: [],
          isEndNode: true
        },
        node_3: {
          id: 'node_3',
          speaker: 'System',
          text: 'You notice Sarah glancing at Marcus whenever budget is mentioned. Her jaw is tight.',
          context: 'Your observation reveals hidden dynamics.',
          choices: [
            {
              id: 'choice_address',
              text: 'Address the unspoken tension',
              observationLevel: 'high',
              consequences: { PER: 3, WIS: 2 },
              tags: ['optimal']
            }
          ],
          isEndNode: true
        }
      }
    }
  ];
}

function generateMentalChallenges(): MentalChallenge[] {
  return [
    {
      id: 'mental_001',
      type: 'logic',
      title: 'Pattern Sequence',
      description: 'Identify the logical pattern.',
      difficulty: 2,
      question: 'What comes next: 2, 6, 12, 20, 30, ?',
      options: ['40', '42', '44', '48'],
      correctAnswer: 1,
      timeLimit: 60,
      xpReward: 30,
      attributeRewards: { INT: 2, PER: 1 },
      explanation: 'The pattern adds +4, +6, +8, +10, +12. Answer: 42'
    },
    {
      id: 'mental_002',
      type: 'deduction',
      title: 'Logic Puzzle',
      description: 'Solve using deduction.',
      difficulty: 4,
      question: 'Three people - A, B, C. A: "B is lying." B: "C is lying." C: "A and B are lying." If only one is truthful, who?',
      options: ['A', 'B', 'C', 'None'],
      correctAnswer: 1,
      timeLimit: 120,
      xpReward: 50,
      attributeRewards: { INT: 3, WIS: 2 },
      explanation: 'If B is truthful, C lies. Then A or B is truthful (B). Consistent.'
    }
  ];
}

function generatePhysicalExercises(): PhysicalExercise[] {
  return [
    {
      id: 'physical_001',
      title: 'Endurance Protocol',
      description: 'Cardiovascular training.',
      difficulty: 2,
      duration: 20,
      xpReward: 40,
      attributeRewards: { VIT: 3, AGI: 1 },
      instructions: [
        'Warm-up: 3 minutes',
        '40s high intensity, 20s rest - 8 cycles',
        'Cool-down: 3 minutes'
      ]
    },
    {
      id: 'physical_002',
      title: 'Strength Foundation',
      description: 'Compound movements.',
      difficulty: 3,
      duration: 30,
      sets: 4,
      reps: 12,
      xpReward: 50,
      attributeRewards: { STR: 3, VIT: 2 },
      instructions: [
        'Push-ups: 12 reps',
        'Squats: 12 reps',
        'Plank: 30 seconds',
        'Lunges: 12 reps each',
        'Rest 60s between sets'
      ]
    }
  ];
}
