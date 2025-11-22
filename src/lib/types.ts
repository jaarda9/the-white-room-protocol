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
  origin?: 'system' | 'ai';
  generatedAt?: string;
  aiContext?: string;
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

// Social Simulation Types
export interface DialogueChoice {
  id: string;
  text: string;
  nextNodeId: string | null;
  observationRequired?: boolean;
  skillCheck?: {
    attribute: AttributeType;
    difficulty: number;
  };
}

export interface DialogueNode {
  id: string;
  speaker: string;
  text: string;
  context?: string;
  hiddenCues?: string[];
  choices: DialogueChoice[];
  isEndNode?: boolean;
}

export interface SocialScenario {
  id: string;
  title: string;
  description: string;
  difficulty: number;
  xp: number;
  hiddenRewards: Partial<Attributes>;
  context: string;
  initialNodeId: string;
  nodes: Record<string, DialogueNode>;
  objectives: {
    primary: string;
    secondary?: string[];
  };
  optimalPath: string[];
  origin?: 'system' | 'ai';
  generatedAt?: string;
  aiContext?: string;
}

export interface ScenarioAttempt {
  id: string;
  scenarioId: string;
  userId: string;
  choicesMade: string[];
  pathTaken: string[];
  observationsUsed: number;
  timeTaken: number;
  score: number;
  missedCues: string[];
  optimalChoices: string[];
  success: boolean;
  timestamp: string;
}

// Physical Training Types
export interface PhysicalExercise {
  id: string;
  name: string;
  sets?: number;
  reps?: number;
  duration?: number; // seconds
  restPeriod: number; // seconds
  type: 'strength' | 'cardio' | 'flexibility';
  formCues: string[];
  completed: boolean;
}

export interface PhysicalWorkout {
  id: string;
  title: string;
  description: string;
  difficulty: number;
  xp: number;
  hiddenRewards: Partial<Attributes>;
  exercises: PhysicalExercise[];
  totalDuration: number; // minutes
  origin?: 'system' | 'ai';
  generatedAt?: string;
  aiContext?: string;
}

export interface WorkoutAttempt {
  id: string;
  workoutId: string;
  userId: string;
  exercisesCompleted: string[];
  totalTime: number;
  formRating: number;
  success: boolean;
  timestamp: string;
}

// Mental Training Types
export interface MentalChallenge {
  id: string;
  title: string;
  description: string;
  type: 'working-memory' | 'speed-processing' | 'strategic-planning';
  difficulty: number;
  xp: number;
  hiddenRewards: Partial<Attributes>;
  timeLimit: number; // seconds
  data: any; // Challenge-specific data
  origin?: 'system' | 'ai';
  generatedAt?: string;
  aiContext?: string;
  // White Room Protocol fields
  protocolName?: string; // Clinical Title
  objective?: string; // Single sentence defining measurable output
  executionProcedure?: string[]; // Step-by-step instructions
  successMetric?: string; // Specific quantifiable data point to be logged
}

export interface MentalAttempt {
  id: string;
  challengeId: string;
  userId: string;
  accuracy: number;
  timeTaken: number;
  focusScore: number;
  success: boolean;
  timestamp: string;
}

// Knowledge/Research Training Types
export type KnowledgeDomain = 'science' | 'history' | 'geography' | 'economics' | 'politics';

export type DifficultyRank = 'E' | 'D' | 'C' | 'B' | 'A' | 'S';

export interface KnowledgeTopic {
  category: string;
  title: string;
  description: string;
  difficulty: DifficultyRank;
  keyPoints: string[]; // Exactly 5 points
  domain: KnowledgeDomain;
  generatedAt: string;
  lastTopicDate: string; // ISO date string
}

export interface QuizQuestion {
  question: string;
  type: 'multiple_choice' | 'true_false';
  options: string[];
  correctAnswer: string;
  explanation: string;
}

export interface QuizResult {
  score: number; // Percentage
  correctAnswers: number;
  totalQuestions: number;
  results: Array<{
    question: string;
    userAnswer: string | null;
    correctAnswer: string;
    isCorrect: boolean;
    explanation: string;
  }>;
  timeTaken: number; // seconds
  timestamp: string;
}

export interface KnowledgeProgress {
  score: number; // Total accumulated score
  streak: number; // Consecutive days
  totalQuizzes: number;
  lastQuizDate: string | null; // ISO date string
}

export interface KnowledgeData {
  currentTopic: KnowledgeTopic | null;
  quizData: QuizQuestion[] | null;
  quizResults: QuizResult | null;
  userProgress: KnowledgeProgress;
  lastTopicDate: string | null; // ISO date string
  partialAnswers?: (string | null)[]; // For resuming quiz
  partialIndex?: number;
}
