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

export type DietaryGoal = 'cut' | 'bulk' | 'maintain' | 'recomp';
export type ActivityLevel = 'sedentary' | 'light' | 'moderate' | 'heavy';
export type BiologicalSex = 'male' | 'female' | 'other';

export interface UserBodyMetrics {
  weightKg: number;
  heightCm: number;
  age?: number;
  gender?: BiologicalSex;
  activityLevel?: ActivityLevel;
  dietaryGoal?: DietaryGoal;
  notes?: string;
  isCalibrated?: boolean;
  lastUpdated?: string;
  /** Free-text region/country, used so AI-generated meals suggest locally available ingredients. */
  country?: string;
}

export type HunterRank = 'E' | 'D' | 'C' | 'B' | 'A' | 'S';

export interface UserProfile {
  id: string;
  displayName: string;
  fullName?: string;
  pseudo: string;
  level: number;
  xp: number;
  xpToNextLevel: number;
  job?: string;
  title?: string;
  hunterRank?: HunterRank;
  availableAP?: number;
  fatigue?: number;
  hp?: { current: number; max: number };
  mp?: { current: number; max: number };
  stm?: { current: number; max: number };
  vitalsLastUpdatedAt?: number;
  lastRestDate?: string;
  visibleStats: Attributes;
  accumulatedPoints: Attributes;
  createdAt: string;
  settings: {
    tone: 'clinical' | 'supportive';
  };
  bodyMetrics?: UserBodyMetrics;
  /** Player's own Gemini API key (Hunter Dossier) — used in place of the shared server key when set. */
  geminiApiKey?: string;
  /** Titles earned by clearing Gates (in addition to the automatic level-based ones), re-selectable anytime. */
  unlockedTitles?: string[];
  /** Consecutive local days ending with an incomplete mandatory system quest. Resets to 0 the
   * moment the active Penalty Quest / Detox Protocol is cleared. Drives escalation. */
  missedQuestStreak?: number;
  /** Active while a Penalty Quest or Detox Protocol is outstanding — lifted immediately on
   * completion, not just at the next day boundary. */
  activeDebuff?: {
    xpMultiplier: number;
    recoveryCapMultiplier: number;
  };
  /** Last Hunter Rank the player has been shown the Rank Advancement Ceremony for. Synced as
   * part of the profile (not a local-only localStorage key) so it travels with the account
   * across devices/browsers/reinstalls — otherwise a fresh device has no record of what's
   * already been celebrated and can replay the ceremony for a rank the player reached long ago. */
  lastSeenRank?: string;
  /** A temporary, self-decaying XP modifier from a Seal event (a slip's fading debuff, or a
   * Rank-Up/Arisen's fading buff) — see getEffectiveSealXpMultiplier in seal-xp-modifier.ts.
   * Deliberately separate from `activeDebuff` above: that one only clears when its Penalty
   * Quest is completed, not on a timer, so mixing a time-decayed Seal effect into the same
   * field would let one silently overwrite or get stuck behind the other. A single slot here
   * means a brand-new Seal event overwrites whatever modifier (buff or debuff) was still
   * fading from an earlier one — an accepted simplification rather than tracking one per Seal. */
  sealXpModifier?: SealXpModifier;
  /** THEIA chain-Gates (see chain-gates.ts): the ongoing chain's stable id, kept here (not on
   * a single Gate) so it survives across every Gate in the chain, and the earliest the next
   * Gate may spawn (effort-based rest window, set on clear). Synced with the profile — a bare
   * local-only key would let a fresh device/reinstall immediately spawn a new chain-Gate for a
   * player who's still mid-rest on another device, same staleness bug class as lastSeenRank. */
  activeChainId?: string;
  nextChainGateEarliestAt?: string;
}

export interface SealXpModifier {
  /** The multiplier's strength at the moment it was applied — >1 is a buff, <1 is a debuff.
   * Linearly fades back to 1.0 (no effect) by `expiresAt`. */
  multiplier: number;
  startedAt: string;
  expiresAt: string;
}

export type PenaltyQuestKind = 'penalty' | 'detox';

export interface PenaltyTask {
  id: string;
  label: string;
  completed: boolean;
}

/** A System-assigned punishment for a missed mandatory day — replaces the old flat HP hit.
 * A single 'penalty' task for an isolated miss; a multi-task 'detox' protocol once misses
 * stack into a real streak (see PENALTY_DETOX_STREAK_THRESHOLD in penalty-system.ts). */
export interface PenaltyQuest {
  id: string;
  kind: PenaltyQuestKind;
  title: string;
  /** The System's in-character narration of the punishment — the "hunted by giant worms"
   * framing, not the literal real-world instructions. */
  flavorText: string;
  tasks: PenaltyTask[];
  assignedAt: string;
  /** Real-world minutes from assignedAt before this is considered overdue. Purely informational
   * for now — an overdue Penalty Quest does not lock further than it already does. */
  deadlineMinutes: number;
  difficultyRank: HunterRank;
  streakAtAssignment: number;
  origin: 'ai' | 'system';
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
  isChainBonus?: boolean;
  chainLevel?: number;
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

export type ToDoOrigin = 'user' | 'ai';

export type ToDoStatus = 'suggested' | 'active' | 'completed' | 'ignored';

export interface ToDoItem {
  id: string;
  title: string;
  notes?: string;
  /** YYYY-MM-DD in user's local time. */
  dueDate: string;
  status: ToDoStatus;
  origin: ToDoOrigin;
  createdAt: string;
  completedAt?: string;
  ignoredAt?: string;
  /** Rewards */
  xp: number;
  hiddenRewards: Partial<Attributes>;
  /** Provenance for AI-generated items */
  source?: {
    type: 'instructor_chat' | 'journal';
    messageExcerpt?: string;
    timestamp?: string;
  };
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
  /** Set after user completes this workout for the current day. */
  completedAt?: string;
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
  /** A light research direction, NOT an answer key — deliberately does not tell the player
   * what they need to know before the quiz, just points at what to go find out. Replaces the
   * old `keyPoints` (5 items shown to the player before the quiz, which was a real bug: it
   * handed out the quiz's own answers). Old cached topics from before this change have
   * `keyPoints` but no `researchPrompt` — loadTopicCache treats those as a cache miss rather
   * than crashing or silently keeping the answer-key behavior for stale data. */
  researchPrompt: string;
  domain: KnowledgeDomain;
  generatedAt: string;
  lastTopicDate: string; // ISO date string
}

export interface QuizQuestion {
  question: string;
  type: 'multiple_choice' | 'true_false' | 'free_response';
  /** Empty for free_response — there's no fixed option list to pick from. */
  options: string[];
  /** For free_response: a model answer/rubric for THEIA to grade against, not a string the
   * player's answer is matched against directly. */
  correctAnswer: string;
  explanation: string;
  /** free_response only — what THEIA should specifically check for when grading. */
  gradingRubric?: string;
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
    /** true when this entry was graded by THEIA (free_response) rather than string-matched. */
    aiGraded?: boolean;
    gradedFeedback?: string;
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

export type ConsumableType = 'hydrate' | 'focusBrew' | 'coldExposure' | 'activeRest';

export interface ConsumableConfig {
  id: ConsumableType;
  name: string;
  category: string;
  realWorldAction: string;
  effectDescription: string;
  dailyMax: number;
  cooldownMinutes: number;
  icon: 'Droplets' | 'Coffee' | 'Snowflake' | 'Sparkles';
}

export interface ConsumableItemState {
  usedToday: number;
  lastUsedAt: number | null;
}

export interface InventoryState {
  lastResetDate: string;
  items: Record<ConsumableType, ConsumableItemState>;
}

