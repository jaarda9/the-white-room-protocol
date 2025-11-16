export type AttributeType = 'STR' | 'AGI' | 'VIT' | 'INT' | 'PER' | 'WIS';

export type QuestCategory = 'mental' | 'physical' | 'social';

export interface Attributes {
  STR: number;
  AGI: number;
  VIT: number;
  INT: number;
  PER: number;
  WIS: number;
}

export interface UserProfile {
  id: string;
  displayName: string;
  pseudo: string;
  level: number;
  xp: number;
  xpToNextLevel: number;
  visibleStats: Attributes;
  accumulatedPoints: Attributes;
  createdAt: string;
  settings: {
    tone: 'clinical' | 'supportive';
  };
}

export interface Quest {
  id: string;
  type: QuestCategory;
  title: string;
  description: string;
  xp: number;
  duration: number; // in minutes
  hiddenRewards: Partial<Attributes>;
  difficulty: number;
  completed: boolean;
  completedAt?: string;
}

export interface QuestAttempt {
  id: string;
  questId: string;
  userId: string;
  timeTaken: number; // seconds
  success: boolean;
  xpGained: number;
  timestamp: string;
}

export interface DialogueChoice {
  id: string;
  text: string;
  observationLevel: 'low' | 'medium' | 'high';
  nextNodeId?: string;
  consequences: Partial<Attributes>;
  tags: string[];
}

export interface DialogueNode {
  id: string;
  speaker: string;
  text: string;
  context?: string;
  emotionalState?: string;
  choices: DialogueChoice[];
  isEndNode?: boolean;
}

export interface SocialScenario {
  id: string;
  title: string;
  description: string;
  difficulty: number;
  startNodeId: string;
  nodes: Record<string, DialogueNode>;
  optimalPath: string[];
  xpReward: number;
  attributeRewards: Partial<Attributes>;
}

export interface MentalChallenge {
  id: string;
  type: 'logic' | 'memory' | 'pattern' | 'deduction';
  title: string;
  description: string;
  difficulty: number;
  question: string;
  options: string[];
  correctAnswer: number;
  timeLimit: number; // seconds
  xpReward: number;
  attributeRewards: Partial<Attributes>;
  explanation: string;
}

export interface PhysicalExercise {
  id: string;
  title: string;
  description: string;
  difficulty: number;
  duration: number; // minutes
  sets?: number;
  reps?: number;
  instructions: string[];
  xpReward: number;
  attributeRewards: Partial<Attributes>;
  restPeriod?: number; // seconds
}

export interface ScenarioAttempt {
  id: string;
  scenarioId: string;
  scenarioType: 'social' | 'mental' | 'physical';
  userId: string;
  timeTaken: number;
  success: boolean;
  score: number;
  choices?: string[];
  hintsUsed: number;
  xpGained: number;
  analysis: {
    missedCues?: string[];
    optimalChoices?: string[];
    strengths?: string[];
    improvements?: string[];
    observationScore?: number;
  };
  timestamp: string;
}
