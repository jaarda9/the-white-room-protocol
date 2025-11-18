import { AttributeType, QuestCategory } from './types';

export type AchievementCategory = 'training' | 'mastery' | 'streak' | 'milestone' | 'special' | 'weekly' | 'monthly';

export type AchievementTier = 'bronze' | 'silver' | 'gold' | 'platinum' | 'limited';

export interface Achievement {
  id: string;
  name: string;
  description: string;
  category: AchievementCategory;
  tier: AchievementTier;
  icon: string;
  requirement: {
    type: 'quest_count' | 'lab_completion' | 'streak' | 'score' | 'perfect_score' | 'level' | 'attribute' | 'knowledge_domain';
    target: number;
    domain?: QuestCategory | 'mental' | 'physical' | 'social' | 'knowledge';
    attribute?: AttributeType;
    timeWindow?: 'weekly' | 'monthly';
  };
  hidden?: boolean;
  unlockedAt?: string;
  expiresAt?: string;
  isActive?: boolean;
}

export interface AchievementProgress {
  achievementId: string;
  progress: number;
  unlocked: boolean;
  unlockedAt?: string;
}

const STORAGE_KEY = 'whiteroom_achievements';

// Define all achievements
export const ACHIEVEMENTS: Achievement[] = [
  // Training achievements
  {
    id: 'first_quest',
    name: 'Initiate',
    description: 'Complete your first quest',
    category: 'training',
    tier: 'bronze',
    icon: '🎯',
    requirement: { type: 'quest_count', target: 1 },
  },
  {
    id: 'quest_warrior',
    name: 'Quest Warrior',
    description: 'Complete 25 quests',
    category: 'training',
    tier: 'silver',
    icon: '⚔️',
    requirement: { type: 'quest_count', target: 25 },
  },
  {
    id: 'quest_master',
    name: 'Quest Master',
    description: 'Complete 100 quests',
    category: 'training',
    tier: 'gold',
    icon: '👑',
    requirement: { type: 'quest_count', target: 100 },
  },
  
  // Mental Lab achievements
  {
    id: 'mental_initiate',
    name: 'Mental Initiate',
    description: 'Complete first mental challenge',
    category: 'mastery',
    tier: 'bronze',
    icon: '🧠',
    requirement: { type: 'lab_completion', target: 1, domain: 'mental' },
  },
  {
    id: 'mental_adept',
    name: 'Mental Adept',
    description: 'Complete 10 mental challenges',
    category: 'mastery',
    tier: 'silver',
    icon: '🧩',
    requirement: { type: 'lab_completion', target: 10, domain: 'mental' },
  },
  {
    id: 'mental_master',
    name: 'Mental Master',
    description: 'Complete 50 mental challenges',
    category: 'mastery',
    tier: 'gold',
    icon: '💎',
    requirement: { type: 'lab_completion', target: 50, domain: 'mental' },
  },
  
  // Physical Lab achievements
  {
    id: 'physical_initiate',
    name: 'Physical Initiate',
    description: 'Complete first workout',
    category: 'mastery',
    tier: 'bronze',
    icon: '💪',
    requirement: { type: 'lab_completion', target: 1, domain: 'physical' },
  },
  {
    id: 'physical_athlete',
    name: 'Physical Athlete',
    description: 'Complete 10 workouts',
    category: 'mastery',
    tier: 'silver',
    icon: '🏋️',
    requirement: { type: 'lab_completion', target: 10, domain: 'physical' },
  },
  {
    id: 'physical_champion',
    name: 'Physical Champion',
    description: 'Complete 50 workouts',
    category: 'mastery',
    tier: 'gold',
    icon: '🏆',
    requirement: { type: 'lab_completion', target: 50, domain: 'physical' },
  },
  
  // Social Lab achievements
  {
    id: 'social_initiate',
    name: 'Social Initiate',
    description: 'Complete first social scenario',
    category: 'mastery',
    tier: 'bronze',
    icon: '🗣️',
    requirement: { type: 'lab_completion', target: 1, domain: 'social' },
  },
  {
    id: 'social_diplomat',
    name: 'Social Diplomat',
    description: 'Complete 10 social scenarios',
    category: 'mastery',
    tier: 'silver',
    icon: '🤝',
    requirement: { type: 'lab_completion', target: 10, domain: 'social' },
  },
  {
    id: 'social_virtuoso',
    name: 'Social Virtuoso',
    description: 'Complete 50 social scenarios',
    category: 'mastery',
    tier: 'gold',
    icon: '🎭',
    requirement: { type: 'lab_completion', target: 50, domain: 'social' },
  },
  
  // Knowledge achievements
  {
    id: 'knowledge_seeker',
    name: 'Knowledge Seeker',
    description: 'Complete first knowledge quiz',
    category: 'mastery',
    tier: 'bronze',
    icon: '📚',
    requirement: { type: 'lab_completion', target: 1, domain: 'knowledge' },
  },
  {
    id: 'knowledge_scholar',
    name: 'Knowledge Scholar',
    description: 'Complete 25 knowledge quizzes',
    category: 'mastery',
    tier: 'silver',
    icon: '🎓',
    requirement: { type: 'lab_completion', target: 25, domain: 'knowledge' },
  },
  {
    id: 'knowledge_sage',
    name: 'Knowledge Sage',
    description: 'Complete 100 knowledge quizzes',
    category: 'mastery',
    tier: 'gold',
    icon: '📖',
    requirement: { type: 'lab_completion', target: 100, domain: 'knowledge' },
  },
  
  // Perfect score achievements
  {
    id: 'perfectionist',
    name: 'Perfectionist',
    description: 'Achieve a perfect score on any quiz',
    category: 'special',
    tier: 'silver',
    icon: '⭐',
    requirement: { type: 'perfect_score', target: 1 },
  },
  {
    id: 'flawless_streak',
    name: 'Flawless Streak',
    description: 'Achieve 5 perfect scores',
    category: 'special',
    tier: 'gold',
    icon: '✨',
    requirement: { type: 'perfect_score', target: 5 },
  },
  
  // Streak achievements
  {
    id: 'dedicated',
    name: 'Dedicated',
    description: 'Maintain a 7-day training streak',
    category: 'streak',
    tier: 'bronze',
    icon: '🔥',
    requirement: { type: 'streak', target: 7 },
  },
  {
    id: 'committed',
    name: 'Committed',
    description: 'Maintain a 30-day training streak',
    category: 'streak',
    tier: 'silver',
    icon: '🌟',
    requirement: { type: 'streak', target: 30 },
  },
  {
    id: 'unstoppable',
    name: 'Unstoppable',
    description: 'Maintain a 100-day training streak',
    category: 'streak',
    tier: 'gold',
    icon: '💫',
    requirement: { type: 'streak', target: 100 },
  },
  
  // Level milestones
  {
    id: 'level_10',
    name: 'Rising Subject',
    description: 'Reach level 10',
    category: 'milestone',
    tier: 'bronze',
    icon: '📈',
    requirement: { type: 'level', target: 10 },
  },
  {
    id: 'level_25',
    name: 'Advanced Subject',
    description: 'Reach level 25',
    category: 'milestone',
    tier: 'silver',
    icon: '🎯',
    requirement: { type: 'level', target: 25 },
  },
  {
    id: 'level_50',
    name: 'Elite Subject',
    description: 'Reach level 50',
    category: 'milestone',
    tier: 'gold',
    icon: '👑',
    requirement: { type: 'level', target: 50 },
  },
  {
    id: 'level_100',
    name: 'Transcendent',
    description: 'Reach level 100',
    category: 'milestone',
    tier: 'platinum',
    icon: '🌌',
    requirement: { type: 'level', target: 100 },
    hidden: true,
  },
  
  // Attribute mastery
  {
    id: 'strength_master',
    name: 'Strength Master',
    description: 'Reach 50 STR',
    category: 'mastery',
    tier: 'gold',
    icon: '💪',
    requirement: { type: 'attribute', target: 50, attribute: 'STR' },
  },
  {
    id: 'intelligence_master',
    name: 'Intelligence Master',
    description: 'Reach 50 INT',
    category: 'mastery',
    tier: 'gold',
    icon: '🧠',
    requirement: { type: 'attribute', target: 50, attribute: 'INT' },
  },
  {
    id: 'perception_master',
    name: 'Perception Master',
    description: 'Reach 50 PER',
    category: 'mastery',
    tier: 'gold',
    icon: '👁️',
    requirement: { type: 'attribute', target: 50, attribute: 'PER' },
  },
  {
    id: 'wisdom_master',
    name: 'Wisdom Master',
    description: 'Reach 50 WIS',
    category: 'mastery',
    tier: 'gold',
    icon: '🦉',
    requirement: { type: 'attribute', target: 50, attribute: 'WIS' },
  },
  {
    id: 'balanced_warrior',
    name: 'Balanced Warrior',
    description: 'Reach 30 in all attributes',
    category: 'special',
    tier: 'platinum',
    icon: '⚖️',
    requirement: { type: 'attribute', target: 30 },
    hidden: true,
  },
  
  // Weekly Challenges
  {
    id: 'weekly_warrior',
    name: 'Weekly Warrior',
    description: 'Complete 15 quests this week',
    category: 'weekly',
    tier: 'limited',
    icon: '⚡',
    requirement: { type: 'quest_count', target: 15, timeWindow: 'weekly' },
  },
  {
    id: 'weekly_mind_master',
    name: 'Weekly Mind Master',
    description: 'Complete 5 mental challenges this week',
    category: 'weekly',
    tier: 'limited',
    icon: '🧠',
    requirement: { type: 'lab_completion', target: 5, domain: 'mental', timeWindow: 'weekly' },
  },
  {
    id: 'weekly_athlete',
    name: 'Weekly Athlete',
    description: 'Complete 5 workouts this week',
    category: 'weekly',
    tier: 'limited',
    icon: '💪',
    requirement: { type: 'lab_completion', target: 5, domain: 'physical', timeWindow: 'weekly' },
  },
  {
    id: 'weekly_socialite',
    name: 'Weekly Socialite',
    description: 'Complete 5 social scenarios this week',
    category: 'weekly',
    tier: 'limited',
    icon: '🗣️',
    requirement: { type: 'lab_completion', target: 5, domain: 'social', timeWindow: 'weekly' },
  },
  {
    id: 'weekly_scholar',
    name: 'Weekly Scholar',
    description: 'Complete 10 knowledge quizzes this week',
    category: 'weekly',
    tier: 'limited',
    icon: '📚',
    requirement: { type: 'lab_completion', target: 10, domain: 'knowledge', timeWindow: 'weekly' },
  },
  
  // Monthly Challenges
  {
    id: 'monthly_champion',
    name: 'Monthly Champion',
    description: 'Complete 50 quests this month',
    category: 'monthly',
    tier: 'limited',
    icon: '🏆',
    requirement: { type: 'quest_count', target: 50, timeWindow: 'monthly' },
  },
  {
    id: 'monthly_genius',
    name: 'Monthly Genius',
    description: 'Complete 20 mental challenges this month',
    category: 'monthly',
    tier: 'limited',
    icon: '🌟',
    requirement: { type: 'lab_completion', target: 20, domain: 'mental', timeWindow: 'monthly' },
  },
  {
    id: 'monthly_titan',
    name: 'Monthly Titan',
    description: 'Complete 20 workouts this month',
    category: 'monthly',
    tier: 'limited',
    icon: '⚔️',
    requirement: { type: 'lab_completion', target: 20, domain: 'physical', timeWindow: 'monthly' },
  },
  {
    id: 'monthly_diplomat',
    name: 'Monthly Diplomat',
    description: 'Complete 20 social scenarios this month',
    category: 'monthly',
    tier: 'limited',
    icon: '🎭',
    requirement: { type: 'lab_completion', target: 20, domain: 'social', timeWindow: 'monthly' },
  },
  {
    id: 'monthly_sage',
    name: 'Monthly Sage',
    description: 'Complete 40 knowledge quizzes this month',
    category: 'monthly',
    tier: 'limited',
    icon: '📖',
    requirement: { type: 'lab_completion', target: 40, domain: 'knowledge', timeWindow: 'monthly' },
  },
];

export interface AchievementStats {
  totalQuests: number;
  mentalChallenges: number;
  physicalWorkouts: number;
  socialScenarios: number;
  knowledgeQuizzes: number;
  perfectScores: number;
  currentStreak: number;
  achievements: Record<string, AchievementProgress>;
  weeklyProgress: {
    quests: number;
    mentalChallenges: number;
    physicalWorkouts: number;
    socialScenarios: number;
    knowledgeQuizzes: number;
    weekStart: string;
  };
  monthlyProgress: {
    quests: number;
    mentalChallenges: number;
    physicalWorkouts: number;
    socialScenarios: number;
    knowledgeQuizzes: number;
    monthStart: string;
  };
}

const getDefaultStats = (): AchievementStats => ({
  totalQuests: 0,
  mentalChallenges: 0,
  physicalWorkouts: 0,
  socialScenarios: 0,
  knowledgeQuizzes: 0,
  perfectScores: 0,
  currentStreak: 0,
  achievements: {},
  weeklyProgress: {
    quests: 0,
    mentalChallenges: 0,
    physicalWorkouts: 0,
    socialScenarios: 0,
    knowledgeQuizzes: 0,
    weekStart: new Date().toISOString(),
  },
  monthlyProgress: {
    quests: 0,
    mentalChallenges: 0,
    physicalWorkouts: 0,
    socialScenarios: 0,
    knowledgeQuizzes: 0,
    monthStart: new Date().toISOString(),
  },
});

const resetWeeklyProgress = (stats: AchievementStats): void => {
  const now = new Date();
  const weekStart = new Date(stats.weeklyProgress.weekStart);
  const daysSinceWeekStart = Math.floor((now.getTime() - weekStart.getTime()) / (1000 * 60 * 60 * 24));
  
  if (daysSinceWeekStart >= 7) {
    stats.weeklyProgress = {
      quests: 0,
      mentalChallenges: 0,
      physicalWorkouts: 0,
      socialScenarios: 0,
      knowledgeQuizzes: 0,
      weekStart: now.toISOString(),
    };
  }
};

const resetMonthlyProgress = (stats: AchievementStats): void => {
  const now = new Date();
  const monthStart = new Date(stats.monthlyProgress.monthStart);
  
  if (now.getMonth() !== monthStart.getMonth() || now.getFullYear() !== monthStart.getFullYear()) {
    stats.monthlyProgress = {
      quests: 0,
      mentalChallenges: 0,
      physicalWorkouts: 0,
      socialScenarios: 0,
      knowledgeQuizzes: 0,
      monthStart: now.toISOString(),
    };
  }
};

export const getAchievementStats = (): AchievementStats => {
  if (typeof window === 'undefined') return getDefaultStats();
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    const stats = stored ? JSON.parse(stored) : getDefaultStats();
    
    // Reset weekly/monthly progress if needed
    resetWeeklyProgress(stats);
    resetMonthlyProgress(stats);
    
    return stats;
  } catch (error) {
    console.error('Error loading achievements:', error);
    return getDefaultStats();
  }
};

export const saveAchievementStats = (stats: AchievementStats): void => {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stats));
  } catch (error) {
    console.error('Error saving achievements:', error);
  }
};

export const checkAchievements = (stats: AchievementStats, userLevel: number, userAttributes: Record<AttributeType, number>): string[] => {
  const newlyUnlocked: string[] = [];
  
  ACHIEVEMENTS.forEach(achievement => {
    const progress = stats.achievements[achievement.id];
    if (progress?.unlocked) return; // Already unlocked
    
    let currentProgress = 0;
    let isUnlocked = false;
    
    switch (achievement.requirement.type) {
      case 'quest_count':
        if (achievement.requirement.timeWindow === 'weekly') {
          currentProgress = stats.weeklyProgress.quests;
          isUnlocked = stats.weeklyProgress.quests >= achievement.requirement.target;
        } else if (achievement.requirement.timeWindow === 'monthly') {
          currentProgress = stats.monthlyProgress.quests;
          isUnlocked = stats.monthlyProgress.quests >= achievement.requirement.target;
        } else {
          currentProgress = stats.totalQuests;
          isUnlocked = stats.totalQuests >= achievement.requirement.target;
        }
        break;
        
      case 'lab_completion':
        if (achievement.requirement.timeWindow === 'weekly') {
          if (achievement.requirement.domain === 'mental') {
            currentProgress = stats.weeklyProgress.mentalChallenges;
            isUnlocked = stats.weeklyProgress.mentalChallenges >= achievement.requirement.target;
          } else if (achievement.requirement.domain === 'physical') {
            currentProgress = stats.weeklyProgress.physicalWorkouts;
            isUnlocked = stats.weeklyProgress.physicalWorkouts >= achievement.requirement.target;
          } else if (achievement.requirement.domain === 'social') {
            currentProgress = stats.weeklyProgress.socialScenarios;
            isUnlocked = stats.weeklyProgress.socialScenarios >= achievement.requirement.target;
          } else if (achievement.requirement.domain === 'knowledge') {
            currentProgress = stats.weeklyProgress.knowledgeQuizzes;
            isUnlocked = stats.weeklyProgress.knowledgeQuizzes >= achievement.requirement.target;
          }
        } else if (achievement.requirement.timeWindow === 'monthly') {
          if (achievement.requirement.domain === 'mental') {
            currentProgress = stats.monthlyProgress.mentalChallenges;
            isUnlocked = stats.monthlyProgress.mentalChallenges >= achievement.requirement.target;
          } else if (achievement.requirement.domain === 'physical') {
            currentProgress = stats.monthlyProgress.physicalWorkouts;
            isUnlocked = stats.monthlyProgress.physicalWorkouts >= achievement.requirement.target;
          } else if (achievement.requirement.domain === 'social') {
            currentProgress = stats.monthlyProgress.socialScenarios;
            isUnlocked = stats.monthlyProgress.socialScenarios >= achievement.requirement.target;
          } else if (achievement.requirement.domain === 'knowledge') {
            currentProgress = stats.monthlyProgress.knowledgeQuizzes;
            isUnlocked = stats.monthlyProgress.knowledgeQuizzes >= achievement.requirement.target;
          }
        } else {
          if (achievement.requirement.domain === 'mental') {
            currentProgress = stats.mentalChallenges;
            isUnlocked = stats.mentalChallenges >= achievement.requirement.target;
          } else if (achievement.requirement.domain === 'physical') {
            currentProgress = stats.physicalWorkouts;
            isUnlocked = stats.physicalWorkouts >= achievement.requirement.target;
          } else if (achievement.requirement.domain === 'social') {
            currentProgress = stats.socialScenarios;
            isUnlocked = stats.socialScenarios >= achievement.requirement.target;
          } else if (achievement.requirement.domain === 'knowledge') {
            currentProgress = stats.knowledgeQuizzes;
            isUnlocked = stats.knowledgeQuizzes >= achievement.requirement.target;
          }
        }
        break;
        
      case 'perfect_score':
        currentProgress = stats.perfectScores;
        isUnlocked = stats.perfectScores >= achievement.requirement.target;
        break;
        
      case 'streak':
        currentProgress = stats.currentStreak;
        isUnlocked = stats.currentStreak >= achievement.requirement.target;
        break;
        
      case 'level':
        currentProgress = userLevel;
        isUnlocked = userLevel >= achievement.requirement.target;
        break;
        
      case 'attribute':
        if (achievement.requirement.attribute) {
          currentProgress = userAttributes[achievement.requirement.attribute];
          isUnlocked = userAttributes[achievement.requirement.attribute] >= achievement.requirement.target;
        } else {
          // Check if all attributes meet target (for balanced warrior)
          const allAttributesAboveTarget = Object.values(userAttributes).every(
            val => val >= achievement.requirement.target
          );
          currentProgress = Math.min(...Object.values(userAttributes));
          isUnlocked = allAttributesAboveTarget;
        }
        break;
    }
    
    if (isUnlocked && !progress?.unlocked) {
      const now = new Date().toISOString();
      stats.achievements[achievement.id] = {
        achievementId: achievement.id,
        progress: currentProgress,
        unlocked: true,
        unlockedAt: now,
      };
      newlyUnlocked.push(achievement.id);
    } else if (!progress) {
      stats.achievements[achievement.id] = {
        achievementId: achievement.id,
        progress: currentProgress,
        unlocked: false,
      };
    } else if (progress && !progress.unlocked) {
      progress.progress = currentProgress;
    }
  });
  
  return newlyUnlocked;
};

export const updateQuestCompletion = (): string[] => {
  const stats = getAchievementStats();
  stats.totalQuests++;
  stats.weeklyProgress.quests++;
  stats.monthlyProgress.quests++;
  
  const profile = JSON.parse(localStorage.getItem('whiteroom_user_profile') || '{}');
  const newlyUnlocked = checkAchievements(stats, profile.level || 1, profile.visibleStats || {});
  
  saveAchievementStats(stats);
  return newlyUnlocked;
};

export const updateMentalCompletion = (userLevel: number, userAttributes: Record<AttributeType, number>): string[] => {
  const stats = getAchievementStats();
  stats.mentalChallenges++;
  stats.weeklyProgress.mentalChallenges++;
  stats.monthlyProgress.mentalChallenges++;
  
  const newlyUnlocked = checkAchievements(stats, userLevel, userAttributes);
  saveAchievementStats(stats);
  return newlyUnlocked;
};

export const updatePhysicalCompletion = (userLevel: number, userAttributes: Record<AttributeType, number>): string[] => {
  const stats = getAchievementStats();
  stats.physicalWorkouts++;
  stats.weeklyProgress.physicalWorkouts++;
  stats.monthlyProgress.physicalWorkouts++;
  
  const newlyUnlocked = checkAchievements(stats, userLevel, userAttributes);
  saveAchievementStats(stats);
  return newlyUnlocked;
};

export const updateSocialCompletion = (userLevel: number, userAttributes: Record<AttributeType, number>): string[] => {
  const stats = getAchievementStats();
  stats.socialScenarios++;
  stats.weeklyProgress.socialScenarios++;
  stats.monthlyProgress.socialScenarios++;
  
  const newlyUnlocked = checkAchievements(stats, userLevel, userAttributes);
  saveAchievementStats(stats);
  return newlyUnlocked;
};

export const updateKnowledgeCompletion = (isPerfectScore: boolean, userLevel: number, userAttributes: Record<AttributeType, number>): string[] => {
  const stats = getAchievementStats();
  stats.knowledgeQuizzes++;
  stats.weeklyProgress.knowledgeQuizzes++;
  stats.monthlyProgress.knowledgeQuizzes++;
  if (isPerfectScore) {
    stats.perfectScores++;
  }
  
  const newlyUnlocked = checkAchievements(stats, userLevel, userAttributes);
  saveAchievementStats(stats);
  return newlyUnlocked;
};

export const getAchievementProgress = (achievementId: string): AchievementProgress | null => {
  const stats = getAchievementStats();
  return stats.achievements[achievementId] || null;
};

export const getUnlockedAchievements = (): Achievement[] => {
  const stats = getAchievementStats();
  return ACHIEVEMENTS.filter(achievement => stats.achievements[achievement.id]?.unlocked);
};

export const getLockedAchievements = (): Achievement[] => {
  const stats = getAchievementStats();
  return ACHIEVEMENTS.filter(achievement => !stats.achievements[achievement.id]?.unlocked && !achievement.hidden);
};

export const getActiveChallenges = (): Achievement[] => {
  const stats = getAchievementStats();
  return ACHIEVEMENTS.filter(
    achievement => 
      (achievement.category === 'weekly' || achievement.category === 'monthly') &&
      !stats.achievements[achievement.id]?.unlocked
  );
};

export const getChallengeProgress = (achievement: Achievement): { current: number; target: number; percentage: number } => {
  const stats = getAchievementStats();
  let current = 0;
  
  if (achievement.requirement.timeWindow === 'weekly') {
    switch (achievement.requirement.type) {
      case 'quest_count':
        current = stats.weeklyProgress.quests;
        break;
      case 'lab_completion':
        if (achievement.requirement.domain === 'mental') current = stats.weeklyProgress.mentalChallenges;
        else if (achievement.requirement.domain === 'physical') current = stats.weeklyProgress.physicalWorkouts;
        else if (achievement.requirement.domain === 'social') current = stats.weeklyProgress.socialScenarios;
        else if (achievement.requirement.domain === 'knowledge') current = stats.weeklyProgress.knowledgeQuizzes;
        break;
    }
  } else if (achievement.requirement.timeWindow === 'monthly') {
    switch (achievement.requirement.type) {
      case 'quest_count':
        current = stats.monthlyProgress.quests;
        break;
      case 'lab_completion':
        if (achievement.requirement.domain === 'mental') current = stats.monthlyProgress.mentalChallenges;
        else if (achievement.requirement.domain === 'physical') current = stats.monthlyProgress.physicalWorkouts;
        else if (achievement.requirement.domain === 'social') current = stats.monthlyProgress.socialScenarios;
        else if (achievement.requirement.domain === 'knowledge') current = stats.monthlyProgress.knowledgeQuizzes;
        break;
    }
  }
  
  return {
    current,
    target: achievement.requirement.target,
    percentage: Math.min((current / achievement.requirement.target) * 100, 100),
  };
};

export const getTimeRemaining = (timeWindow: 'weekly' | 'monthly'): string => {
  const stats = getAchievementStats();
  const now = new Date();
  
  if (timeWindow === 'weekly') {
    const weekStart = new Date(stats.weeklyProgress.weekStart);
    const weekEnd = new Date(weekStart.getTime() + 7 * 24 * 60 * 60 * 1000);
    const diff = weekEnd.getTime() - now.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    return `${days}d ${hours}h`;
  } else {
    const monthStart = new Date(stats.monthlyProgress.monthStart);
    const monthEnd = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 1);
    const diff = monthEnd.getTime() - now.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    return `${days}d`;
  }
};
