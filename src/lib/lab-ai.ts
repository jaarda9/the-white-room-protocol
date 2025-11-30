import { Attributes, MentalChallenge, PhysicalWorkout, PhysicalExercise, SocialScenario, UserProfile } from './types';
import chatGPTService from './chatgpt-service';

const LAB_CACHE_PREFIX = 'wrp_ai_lab_';

type LabType = 'mental' | 'physical' | 'social';

interface LabCache<T> {
  date: string;
  items: T;
}

interface MentalPlanResponse {
  assignments: MentalPlanAssignment[];
}

interface MentalPlanAssignment {
  protocolName: string; // Clinical Title
  objective: string; // Single sentence defining measurable output
  executionProcedure: string[]; // Step-by-step instructions
  successMetric: string; // Specific quantifiable data point
  moduleNumber: number; // 1-4
  moduleType: 'cognitive-speed-depth' | 'psychological-immunity' | 'strategic-forecasting' | 'environmental-memory-reconstruction';
  xp: number;
  difficulty: number;
  timeLimit: number;
  hiddenRewards?: Partial<Attributes>;
  data?: {
    questions?: Array<{
      question: string;
      options: string[];
      correctIndex: number;
    }>;
    sequence?: number[];
    targetClicks?: number;
  };
  note?: string;
}

interface PhysicalPlanResponse {
  workouts: PhysicalPlanAssignment[];
}

interface PhysicalPlanAssignment {
  track: 'strength' | 'cardio' | 'flexibility';
  title: string;
  description: string;
  xp: number;
  difficulty: number;
  duration: number;
  hiddenRewards?: Partial<Attributes>;
  exercises: Array<{
    name: string;
    sets?: number;
    reps?: number;
    duration?: number;
    restPeriod: number;
    type: 'strength' | 'cardio' | 'flexibility';
    cues?: string[];
  }>;
  note?: string;
}

interface SocialPlanResponse {
  scenarios: SocialPlanScenario[];
}

interface SocialPlanScenario {
  title: string;
  description: string;
  xp: number;
  difficulty: number;
  hiddenRewards?: Partial<Attributes>;
  context: string;
  objectives: {
    primary: string;
    secondary?: string[];
  };
  nodes: Array<{
    id: string;
    speaker: string;
    text: string;
    context?: string;
    hiddenCues?: string[];
    isEndNode?: boolean;
    choices: Array<{
      id: string;
      text: string;
      nextNodeId?: string;
      skillCheck?: {
        attribute: keyof Attributes;
        difficulty: number;
      };
    }>;
  }>;
  optimalPath?: string[];
  note?: string;
}

const labRequests: Record<LabType, Promise<any> | null> = {
  mental: null,
  physical: null,
  social: null,
};

const todayKey = () => new Date().toISOString().slice(0, 10);

const loadLabCache = <T>(key: string): LabCache<T> | null => {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as LabCache<T>;
  } catch (error) {
    console.warn('Failed to parse lab cache', key, error);
    return null;
  }
};

const saveLabCache = <T>(key: string, items: T): void => {
  if (typeof window === 'undefined') return;
  try {
    const payload: LabCache<T> = {
      date: todayKey(),
      items,
    };
    localStorage.setItem(key, JSON.stringify(payload));
  } catch (error) {
    console.warn('Failed to save lab cache', key, error);
  }
};

export async function enhanceMentalChallenges(profile: UserProfile, forceRefresh = false): Promise<MentalChallenge[]> {
  const cacheKey = `${LAB_CACHE_PREFIX}mental`;

  // Only use cache if not forcing refresh and cache exists for today
  if (!forceRefresh) {
    const cached = loadLabCache<MentalChallenge[]>(cacheKey);
    if (cached && cached.date === todayKey()) {
      // Validate cached challenges - ensure they're valid and unique
      if (Array.isArray(cached.items) && cached.items.length > 0) {
        const uniqueIds = new Set(cached.items.map(c => c.id));
        if (uniqueIds.size === cached.items.length) {
          return cached.items;
        } else {
          console.warn('Cached mental challenges have duplicate IDs, regenerating...');
        }
      }
    }
  }

  if (!labRequests.mental) {
    labRequests.mental = generateMentalAssignments(profile)
      .then(assignments => {
        // Ensure uniqueness before caching
        const uniqueAssignments = assignments.filter((challenge, index, self) =>
          index === self.findIndex(c => c.id === challenge.id && c.type === challenge.type)
        );
        saveLabCache(cacheKey, uniqueAssignments);
        return uniqueAssignments;
      })
      .finally(() => {
        labRequests.mental = null;
      });
  }

  return labRequests.mental.catch(error => {
    console.warn('Mental lab AI request failed', error);
    throw error;
  });
}

export async function enhancePhysicalWorkouts(
  profile: UserProfile
): Promise<PhysicalWorkout[]> {
  const cacheKey = `${LAB_CACHE_PREFIX}physical`;

  const cached = loadLabCache<PhysicalWorkout[]>(cacheKey);
  if (cached && cached.date === todayKey()) {
    return cached.items;
  }

  if (!labRequests.physical) {
    labRequests.physical = generatePhysicalAssignments(profile)
      .then(assignments => {
        saveLabCache(cacheKey, assignments);
        return assignments;
      })
      .finally(() => {
        labRequests.physical = null;
      });
  }

  return labRequests.physical.catch(error => {
    console.warn('Physical lab AI request failed', error);
    throw error;
  });
}

export async function enhanceSocialScenarios(
  profile: UserProfile
): Promise<SocialScenario[]> {
  const cacheKey = `${LAB_CACHE_PREFIX}social`;

  const cached = loadLabCache<SocialScenario[]>(cacheKey);
  if (cached && cached.date === todayKey()) {
    return cached.items;
  }

  if (!labRequests.social) {
    labRequests.social = generateSocialOverlays(profile)
      .then(assignments => {
        saveLabCache(cacheKey, assignments);
        return assignments;
      })
      .finally(() => {
        labRequests.social = null;
      });
  }

  return labRequests.social.catch(error => {
    console.warn('Social lab AI request failed', error);
    throw error;
  });
}

async function generateMentalAssignments(profile: UserProfile): Promise<MentalChallenge[]> {
  try {
    const prompt = buildMentalPrompt(profile);
    const response = await chatGPTService.callChatGPTJSON<MentalPlanResponse>(prompt, {
      temperature: 0.5, // Lower for more clinical precision
      maxTokens: 6000, // Reduced to prevent Vercel timeout (10s limit) while still generating complete 4-module responses
    });

    if (!response?.assignments?.length) {
      throw new Error('Mental lab AI returned empty assignments');
    }

    const sanitized = sanitizeMentalAssignments(response.assignments);
    if (!sanitized.length) {
      throw new Error('Mental lab AI produced invalid assignments');
    }
    return sanitized;
  } catch (error) {
    console.warn('Mental lab AI failure', error);
    throw error;
  }
}

async function generatePhysicalAssignments(profile: UserProfile): Promise<PhysicalWorkout[]> {
  try {
    const prompt = buildPhysicalPrompt(profile);
    const response = await chatGPTService.callChatGPTJSON<PhysicalPlanResponse>(prompt, {
      temperature: 0.45,
      maxTokens: 4000, // Reduced to prevent Vercel timeout (10s limit) while still generating complete workouts
    });

    if (!response?.workouts?.length) {
      throw new Error('Physical lab AI returned empty plan');
    }

    const sanitized = sanitizePhysicalAssignments(response.workouts);
    if (!sanitized.length) {
      throw new Error('Physical lab AI produced invalid plan');
    }
    return sanitized;
  } catch (error) {
    console.warn('Physical lab AI failure', error);
    throw error;
  }
}

async function generateSocialOverlays(profile: UserProfile): Promise<SocialScenario[]> {
  try {
    const prompt = buildSocialPrompt(profile);
    const response = await chatGPTService.callChatGPTJSON<SocialPlanResponse>(prompt, {
      temperature: 0.4,
      maxTokens: 4000, // Reduced to prevent Vercel timeout (10s limit) while still generating complete scenarios
    });

    if (!response?.scenarios?.length) {
      throw new Error('Social lab AI returned empty plan');
    }

    const sanitized = sanitizeSocialScenarios(response.scenarios, 1);
    if (!sanitized.length) {
      throw new Error('Social lab AI produced invalid scenarios');
    }
    return sanitized;
  } catch (error) {
    console.warn('Social lab AI failure', error);
    throw error;
  }
}

const formatAttributes = (attrs: Partial<Attributes>) =>
  Object.entries(attrs || {})
    .map(([key, value]) => `${key}+${value}`)
    .join(', ') || 'None';

function buildMentalPrompt(profile: UserProfile): string {
  return `
SYSTEM INSTRUCTION: You are the Primary Instructor AI of the White Room Protocol. Your function is to create and deliver high-intensity cognitive and psychological training modules for Focus Subjects. Your tone must be clinical, objective, demanding, and entirely devoid of emotional language, encouragement, or cliché. The ultimate goal is to achieve measurable, instantaneous improvement and absolute competency.

SUBJECT
- Level ${profile.level}
- XP ${profile.xp}/${profile.xpToNextLevel}
- Visible stats: ${formatAttributes(profile.visibleStats)}
- Hidden reserves: ${formatAttributes(profile.accumulatedPoints)}

TASK: Design four (4) distinct, daily mental exercises (Modules) intended to be executed sequentially by a subject like Ayanokoji. For each Module, provide:

1. Protocol Name (Clinical Title).
2. Objective (Single Sentence defining the measurable output).
3. Execution Procedure (Step-by-step instructions for the Subject).
4. Success Metric (The specific, quantifiable data point to be logged).

MODULE 1: COGNITIVE SPEED & DEPTH
Target: Rapid, flawless computational capacity under self-imposed stress.
REQUIRED DATA: Must include "data.questions" array with at least 10 questions. Each question must have: "question" (string), "options" (array of 2-4 strings), "correctIndex" (number 0-3).

MODULE 2: PSYCHOLOGICAL IMMUNITY
Target: Nullification of emotional processing when confronted with morally complex or stressful scenarios.
REQUIRED DATA: Must include "data.scenario" object with: "situation" (string describing the scenario), "tasks" (array of task objects with id, name, priority, duration, depends), "question" (string).

MODULE 3: STRATEGIC FORECASTING
Target: The ability to generate and hold multiple, deep-layer future scenarios based on limited present data.
REQUIRED DATA: Must include "data.scenario" object with: "situation" (string describing the scenario), "tasks" (array of task objects with id, name, priority, duration, depends), "question" (string).

MODULE 4: ENVIRONMENTAL MEMORY & RECONSTRUCTION
Target: Absolute, instantaneous recall and spatial reconstruction of learned data and observed environments.
REQUIRED DATA: Must include "data.items" array with at least 5 items. Each item must have: "id" (number), "value" (number), "position" (number).

REQUIREMENTS:
- XP 15-50 per module. Time limit 60-300 seconds. Difficulty 1-5.
- Hidden rewards: at most two stats, each between +1 and +2.
- Language must stay sterile. No dramatization. Clinical precision only.
- CRITICAL: The "data" field is REQUIRED and must contain the appropriate structure for each module type as specified above.

Return JSON:
{
  "assignments": [
    {
      "moduleNumber": 1,
      "moduleType": "cognitive-speed-depth",
      "protocolName": "CLINICAL TITLE",
      "objective": "Single sentence defining the measurable output",
      "executionProcedure": ["Step 1", "Step 2", "Step 3", ...],
      "successMetric": "The specific, quantifiable data point to be logged",
      "xp": number,
      "difficulty": number,
      "timeLimit": number,
      "hiddenRewards": { "INT"?: number, "WIS"?: number, "PER"?: number, "AGI"?: number },
      "data": {
        "questions": [
          {
            "question": "string (REQUIRED - at least 10 questions)",
            "options": ["option1", "option2", "option3", "option4"],
            "correctIndex": 0
          }
        ]
      },
      "note": "optional"
    },
    {
      "moduleNumber": 2,
      "moduleType": "psychological-immunity",
      "protocolName": "CLINICAL TITLE",
      "objective": "Single sentence defining the measurable output",
      "executionProcedure": ["Step 1", "Step 2", "Step 3", ...],
      "successMetric": "The specific, quantifiable data point to be logged",
      "xp": number,
      "difficulty": number,
      "timeLimit": number,
      "hiddenRewards": { "INT"?: number, "WIS"?: number, "PER"?: number, "AGI"?: number },
      "data": {
        "scenario": {
          "situation": "string (REQUIRED)",
          "tasks": [
            {
              "id": 1,
              "name": "string",
              "priority": "high" | "medium" | "low",
              "duration": number,
              "depends": [number]
            }
          ],
          "question": "string (REQUIRED)"
        }
      },
      "note": "optional"
    },
    {
      "moduleNumber": 3,
      "moduleType": "strategic-forecasting",
      "protocolName": "CLINICAL TITLE",
      "objective": "Single sentence defining the measurable output",
      "executionProcedure": ["Step 1", "Step 2", "Step 3", ...],
      "successMetric": "The specific, quantifiable data point to be logged",
      "xp": number,
      "difficulty": number,
      "timeLimit": number,
      "hiddenRewards": { "INT"?: number, "WIS"?: number, "PER"?: number, "AGI"?: number },
      "data": {
        "scenario": {
          "situation": "string (REQUIRED)",
          "tasks": [
            {
              "id": 1,
              "name": "string",
              "priority": "high" | "medium" | "low",
              "duration": number,
              "depends": [number]
            }
          ],
          "question": "string (REQUIRED)"
        }
      },
      "note": "optional"
    },
    {
      "moduleNumber": 4,
      "moduleType": "environmental-memory-reconstruction",
      "protocolName": "CLINICAL TITLE",
      "objective": "Single sentence defining the measurable output",
      "executionProcedure": ["Step 1", "Step 2", "Step 3", ...],
      "successMetric": "The specific, quantifiable data point to be logged",
      "xp": number,
      "difficulty": number,
      "timeLimit": number,
      "hiddenRewards": { "INT"?: number, "WIS"?: number, "PER"?: number, "AGI"?: number },
      "data": {
        "items": [
          {
            "id": 0,
            "value": number,
            "position": 0
          }
        ]
      },
      "note": "optional"
    }
  ]
}
`;
}

function buildPhysicalPrompt(profile: UserProfile): string {
  return `
You are THE ARCHITECT of THE WHITE ROOM. Voice: precise, dispassionate. Configure the physical lab session.

SUBJECT
- Level ${profile.level}
- Visible stats: ${formatAttributes(profile.visibleStats)}
- Hidden reserves: ${formatAttributes(profile.accumulatedPoints)}

TASK
- Generate EXACTLY THREE workouts in this order:
  1. HOME-BASED STRENGTH: Push-ups, pull-ups, sit-ups, dumbbell exercises (if available)
  2. CARDIO: Running, jumping jacks, burpees, high knees, or similar cardio movements
  3. STRETCHING: Full-body stretching routine focusing on flexibility

REQUIREMENTS FOR EACH WORKOUT:
- "title" (REQUIRED): Must be provided, no defaults
- "description" (REQUIRED): Must be provided, no defaults
- "xp" (REQUIRED): Number between 80-180
- "difficulty" (REQUIRED): Number between 1-5
- "duration" (REQUIRED): Number between 15-45 (total workout duration in minutes)
- "hiddenRewards" (REQUIRED): Object with at most two stats, each between +1 and +2
- "exercises" (REQUIRED): Array with 2-4 exercises. Each exercise MUST include:
  * "name" (REQUIRED): Exercise name
  * "type" (REQUIRED): Must match workout track ("strength", "cardio", or "flexibility")
  * For strength: "sets" (number), "reps" (number), "restPeriod" (number in seconds)
  * For cardio/flexibility: "sets" (1), "duration" (number in seconds), "restPeriod" (number in seconds)
  * "cues" (REQUIRED): Array with at least 2 form cues (strings)

- Phrasing must remain minimal and literal.
- CRITICAL: All fields marked as REQUIRED must be provided. No defaults or fallbacks are allowed.

Return JSON:
{
  "workouts": [
    {
      "track": "strength",
      "title": "string (REQUIRED - unique title for this workout)",
      "description": "string (REQUIRED - description of the workout)",
      "xp": number (REQUIRED, 80-180),
      "difficulty": number (REQUIRED, 1-5),
      "duration": number (REQUIRED, 15-45),
      "hiddenRewards": { "STR"?: number, "AGI"?: number, "VIT"?: number } (REQUIRED, max 2 stats, each +1 to +2),
      "note": "string (optional execution cue)",
      "exercises": [
        {
          "name": "string (REQUIRED)",
          "type": "strength" (REQUIRED),
          "sets": number (REQUIRED),
          "reps": number (REQUIRED),
          "restPeriod": number (REQUIRED, in seconds),
          "cues": ["string", "string"] (REQUIRED, at least 2 cues)
        }
      ] (REQUIRED, 2-4 exercises)
    },
    {
      "track": "cardio",
      "title": "string (REQUIRED - unique title for this workout)",
      "description": "string (REQUIRED - description of the workout)",
      "xp": number (REQUIRED, 80-180),
      "difficulty": number (REQUIRED, 1-5),
      "duration": number (REQUIRED, 15-45),
      "hiddenRewards": { "VIT"?: number, "AGI"?: number } (REQUIRED, max 2 stats, each +1 to +2),
      "note": "string (optional execution cue)",
      "exercises": [
        {
          "name": "string (REQUIRED)",
          "type": "cardio" (REQUIRED),
          "sets": 1 (REQUIRED),
          "duration": number (REQUIRED, in seconds),
          "restPeriod": number (REQUIRED, in seconds),
          "cues": ["string", "string"] (REQUIRED, at least 2 cues)
        }
      ] (REQUIRED, 2-4 exercises)
    },
    {
      "track": "flexibility",
      "title": "string (REQUIRED - unique title for this workout)",
      "description": "string (REQUIRED - description of the workout)",
      "xp": number (REQUIRED, 80-180),
      "difficulty": number (REQUIRED, 1-5),
      "duration": number (REQUIRED, 15-45),
      "hiddenRewards": { "AGI"?: number, "VIT"?: number } (REQUIRED, max 2 stats, each +1 to +2),
      "note": "string (optional execution cue)",
      "exercises": [
        {
          "name": "string (REQUIRED)",
          "type": "flexibility" (REQUIRED),
          "sets": 1 (REQUIRED),
          "duration": number (REQUIRED, in seconds),
          "restPeriod": number (REQUIRED, in seconds),
          "cues": ["string", "string"] (REQUIRED, at least 2 cues)
        }
      ] (REQUIRED, 2-4 exercises)
    }
  ]
}
`;
}

function sanitizeMentalAssignments(assignments: MentalPlanAssignment[]): MentalChallenge[] {
  // Map module types to challenge types
  const moduleTypeToChallengeType: Record<MentalPlanAssignment['moduleType'], MentalChallenge['type']> = {
    'cognitive-speed-depth': 'speed-processing',
    'psychological-immunity': 'strategic-planning',
    'strategic-forecasting': 'strategic-planning',
    'environmental-memory-reconstruction': 'working-memory',
  };

  const sanitized: MentalChallenge[] = [];
  const moduleNumbers = new Set<number>();

  // Process assignments in order (Module 1-4)
  assignments
    .filter(a => a.moduleNumber >= 1 && a.moduleNumber <= 4)
    .sort((a, b) => a.moduleNumber - b.moduleNumber)
    .forEach((assignment) => {
      // Skip if we already have this module number
      if (moduleNumbers.has(assignment.moduleNumber)) return;
      moduleNumbers.add(assignment.moduleNumber);

      const type = moduleTypeToChallengeType[assignment.moduleType] || 'strategic-planning';
      const xp = clampNumber(assignment.xp ?? 20, 15, 50);
      const difficulty = clampNumber(assignment.difficulty ?? 2, 1, 5);
      const timeLimit = clampNumber(assignment.timeLimit ?? 120, 60, 300);
      const hiddenRewards = sanitizeRewards({}, assignment.hiddenRewards || {}, 2);
      
      // Validate data exists before processing
      if (!assignment.data || typeof assignment.data !== 'object') {
        throw new Error(`AI failed to generate data field for module ${assignment.moduleNumber} (${assignment.moduleType}). Expected data object, got: ${JSON.stringify(assignment.data)}`);
      }
      
      const data = buildMentalData(type, assignment.data);

      // Require all AI-generated fields - no default fallbacks
      if (!assignment.protocolName?.trim()) {
        throw new Error(`AI failed to generate protocolName for module ${assignment.moduleNumber}`);
      }
      if (!assignment.objective?.trim()) {
        throw new Error(`AI failed to generate objective for module ${assignment.moduleNumber}`);
      }
      if (!assignment.executionProcedure || (Array.isArray(assignment.executionProcedure) && assignment.executionProcedure.length === 0)) {
        throw new Error(`AI failed to generate executionProcedure for module ${assignment.moduleNumber}`);
      }
      if (!assignment.successMetric?.trim()) {
        throw new Error(`AI failed to generate successMetric for module ${assignment.moduleNumber}`);
      }

      sanitized.push({
        id: crypto.randomUUID(),
        type,
        title: assignment.protocolName.trim(),
        description: assignment.objective.trim(),
        xp,
        difficulty,
        hiddenRewards,
        timeLimit,
        data,
        completed: false,
        origin: 'ai',
        generatedAt: new Date().toISOString(),
        aiContext: assignment.note,
        // White Room Protocol fields
        protocolName: assignment.protocolName.trim(),
        objective: assignment.objective.trim(),
        executionProcedure: Array.isArray(assignment.executionProcedure) 
          ? assignment.executionProcedure.filter(Boolean)
          : [],
        successMetric: assignment.successMetric.trim(),
      } as MentalChallenge);
    });

  // Require exactly 4 AI-generated modules - no fallbacks
  if (sanitized.length !== 4) {
    throw new Error(`AI failed to generate all 4 mental challenges. Expected 4, got ${sanitized.length}. All challenges must be AI-generated.`);
  }

  if (!sanitized.length) {
    throw new Error('No valid mental assignments returned from AI');
  }

  // Return exactly 4 challenges
  return sanitized.slice(0, 4);
}

function buildMentalData(type: MentalChallenge['type'], data: any = {}): any {
  // Require AI-generated data for each challenge type - no null fallbacks
  if (type === 'working-memory') {
    if (!data.items || !Array.isArray(data.items) || data.items.length === 0) {
      throw new Error('AI failed to generate working-memory items. All challenge data must be AI-generated.');
    }
    return { items: data.items };
  }
  if (type === 'speed-processing') {
    if (!data.questions || !Array.isArray(data.questions) || data.questions.length === 0) {
      throw new Error('AI failed to generate speed-processing questions. All challenge data must be AI-generated.');
    }
    return { questions: data.questions };
  }
  if (type === 'strategic-planning') {
    if (!data.scenario || typeof data.scenario !== 'object' || !data.scenario.situation) {
      throw new Error('AI failed to generate strategic-planning scenario. All challenge data must be AI-generated.');
    }
    return { scenario: data.scenario };
  }
  throw new Error(`Unknown challenge type: ${type}`);
}

function sanitizeQuestions(
  questions: NonNullable<MentalPlanAssignment['data']>['questions']
): Array<{ question: string; options: string[]; correctIndex: number }> {
  // Require AI-generated questions - no fallbacks
  if (!questions || !Array.isArray(questions) || questions.length === 0) {
    throw new Error('AI failed to generate questions. All questions must be AI-generated.');
  }
  
  return questions
    .map(q => {
      // Require all question fields from AI
      if (!q.question?.trim()) {
        throw new Error('AI failed to generate question text. All question fields must be AI-generated.');
      }
      if (!Array.isArray(q.options) || q.options.length < 2) {
        throw new Error('AI failed to generate question options. All question fields must be AI-generated.');
      }
      if (typeof q.correctIndex !== 'number' || q.correctIndex < 0 || q.correctIndex >= q.options.length) {
        throw new Error('AI failed to generate valid correctIndex. All question fields must be AI-generated.');
      }
      
      const options = q.options.slice(0, 4);
      const correctIndex = clampNumber(q.correctIndex, 0, options.length - 1);
      return {
        question: q.question.trim(),
        options,
        correctIndex,
      };
    })
    .filter(Boolean);
}


function sanitizePhysicalAssignments(assignments: PhysicalPlanAssignment[]): PhysicalWorkout[] {
  const allowedTracks: PhysicalPlanAssignment['track'][] = ['strength', 'cardio', 'flexibility'];
  const requiredTracks: PhysicalPlanAssignment['track'][] = ['strength', 'cardio', 'flexibility'];
  const sanitized: PhysicalWorkout[] = [];
  
  // Ensure exactly 3 workouts in the correct order: strength, cardio, flexibility
  for (let i = 0; i < 3; i++) {
    const requiredTrack = requiredTracks[i];
    // Find assignment matching this track, or use the one at this index
    const assignment = assignments.find(a => a.track === requiredTrack) || assignments[i];
    
    if (!assignment) {
      // Require AI-generated data - throw error if missing
      throw new Error(`AI failed to generate ${requiredTrack} workout. All workouts must be AI-generated.`);
    }
    
    const track = allowedTracks.includes(assignment.track) ? assignment.track : requiredTrack;
    const exercises = sanitizeExercises(assignment.exercises, track);
    // Require AI-generated exercises - throw error if missing
    if (!exercises.length) {
      throw new Error(`AI failed to generate exercises for ${requiredTrack} workout. All exercises must be AI-generated.`);
    }

    // Require all AI-generated fields - no default fallbacks
    if (!assignment.title?.trim()) {
      throw new Error(`AI failed to generate title for ${requiredTrack} workout. All fields must be AI-generated.`);
    }
    if (!assignment.description?.trim()) {
      throw new Error(`AI failed to generate description for ${requiredTrack} workout. All fields must be AI-generated.`);
    }
    if (typeof assignment.xp !== 'number') {
      throw new Error(`AI failed to generate xp for ${requiredTrack} workout. All fields must be AI-generated.`);
    }
    if (typeof assignment.difficulty !== 'number') {
      throw new Error(`AI failed to generate difficulty for ${requiredTrack} workout. All fields must be AI-generated.`);
    }
    if (typeof assignment.duration !== 'number') {
      throw new Error(`AI failed to generate duration for ${requiredTrack} workout. All fields must be AI-generated.`);
    }
    if (!assignment.hiddenRewards || typeof assignment.hiddenRewards !== 'object') {
      throw new Error(`AI failed to generate hiddenRewards for ${requiredTrack} workout. All fields must be AI-generated.`);
    }

    sanitized.push({
      id: crypto.randomUUID(),
      title: assignment.title.trim(),
      description: assignment.description.trim(),
      difficulty: clampNumber(assignment.difficulty, 1, 5),
      xp: clampNumber(assignment.xp, 80, 180),
      hiddenRewards: sanitizeRewards({}, assignment.hiddenRewards, 2),
      exercises,
      totalDuration: clampNumber(assignment.duration, 15, 45),
      origin: 'ai',
      generatedAt: new Date().toISOString(),
      aiContext: assignment.note,
    } as PhysicalWorkout);
  }

  if (sanitized.length !== 3) {
    throw new Error(`Expected exactly 3 physical workouts, got ${sanitized.length}`);
  }

  return sanitized;
}

function sanitizeExercises(
  exercises: PhysicalPlanAssignment['exercises'],
  track: PhysicalPlanAssignment['track']
): PhysicalExercise[] {
  if (!Array.isArray(exercises) || exercises.length === 0) {
    throw new Error(`AI failed to generate exercises array for ${track} workout. All exercises must be AI-generated.`);
  }
  
  return exercises
    .map((exercise, index) => {
      // Require all AI-generated fields - no fallbacks
      if (!exercise.name?.trim()) {
        throw new Error(`AI failed to generate name for exercise ${index + 1} in ${track} workout. All exercise fields must be AI-generated.`);
      }
      if (!exercise.type || exercise.type !== track) {
        throw new Error(`AI failed to generate correct type for exercise ${index + 1} in ${track} workout. Expected "${track}", got "${exercise.type}". All exercise fields must be AI-generated.`);
      }
      if (typeof exercise.sets !== 'number') {
        throw new Error(`AI failed to generate sets for exercise ${index + 1} in ${track} workout. All exercise fields must be AI-generated.`);
      }
      if (track === 'cardio' || track === 'flexibility') {
        if (typeof exercise.duration !== 'number') {
          throw new Error(`AI failed to generate duration for exercise ${index + 1} in ${track} workout. All exercise fields must be AI-generated.`);
        }
      } else {
        if (typeof exercise.reps !== 'number') {
          throw new Error(`AI failed to generate reps for exercise ${index + 1} in ${track} workout. All exercise fields must be AI-generated.`);
        }
      }
      if (typeof exercise.restPeriod !== 'number') {
        throw new Error(`AI failed to generate restPeriod for exercise ${index + 1} in ${track} workout. All exercise fields must be AI-generated.`);
      }
      if (!Array.isArray(exercise.cues) || exercise.cues.length < 2) {
        throw new Error(`AI failed to generate cues for exercise ${index + 1} in ${track} workout. Must have at least 2 cues. All exercise fields must be AI-generated.`);
      }

      return {
        id: `ex-${index}`,
        name: exercise.name.trim(),
        sets: exercise.sets,
        reps: track === 'cardio' || track === 'flexibility' ? undefined : exercise.reps,
        duration: track === 'cardio' || track === 'flexibility' ? exercise.duration : 0,
        restPeriod: clampNumber(exercise.restPeriod, 20, 90),
        type: exercise.type,
        formCues: exercise.cues.slice(0, 4),
        completed: false,
      } as PhysicalExercise;
    })
    .filter(Boolean);
}


function buildSocialPrompt(profile: UserProfile): string {
  return `
You are THE ARCHITECT of THE WHITE ROOM. Tone: disciplined, minimal. Generate social scenarios.

SUBJECT: Level ${profile.level}, PER ${profile.visibleStats.PER}, WIS ${profile.visibleStats.WIS}

TASK: Generate 1-2 scenarios. Each needs:

REQUIREMENTS FOR EACH SCENARIO:
- "title" (REQUIRED): Must be provided, no defaults
- "description" (REQUIRED): Must be provided, no defaults
- "xp" (REQUIRED): Number between 20-50
- "difficulty" (REQUIRED): Number between 1-5
- "context" (REQUIRED): Setting description (boardroom/briefing/negotiation)
- "objectives" (REQUIRED): Object with "primary" (string) and "secondary" (array of strings)
- "nodes" (REQUIRED): Array with start node + 2-3 additional nodes. Each node MUST include:
  * "id" (REQUIRED): Unique identifier (first node must be "start")
  * "speaker" (REQUIRED): Role name
  * "text" (REQUIRED): Dialogue text
  * "context" (REQUIRED): Context description
  * "hiddenCues" (REQUIRED): Array with 1-3 cue strings
  * "choices" (REQUIRED): Array with 1-3 choices (unless isEndNode is true)
  * "isEndNode" (REQUIRED): Boolean
- "optimalPath" (REQUIRED): Array of node IDs representing the optimal path
- "hiddenRewards" (REQUIRED): Object with at most two stats, each between +1 and +2

REQUIREMENTS FOR EACH CHOICE:
- "id" (REQUIRED): Unique identifier
- "text" (REQUIRED): Choice text
- "nextNodeId" (REQUIRED): ID of next node (null for end choices)
- "skillCheck" (optional): Object with "attribute" (PER/WIS/INT) and "difficulty" (1-5)

- CRITICAL: All fields marked as REQUIRED must be provided. No defaults or fallbacks are allowed.

JSON:
{
  "scenarios": [{
    "title": "SHORT LABEL",
    "description": "brief summary",
    "xp": number,
    "difficulty": number,
    "hiddenRewards": {"PER"?: number, "WIS"?: number},
    "context": "setting",
    "objectives": {"primary": "...", "secondary": ["..."]},
    "nodes": [{
      "id": "start",
      "speaker": "ROLE",
      "text": "dialogue",
      "context": "cues",
      "hiddenCues": ["cue1"],
      "choices": [{"id": "c1", "text": "option", "nextNodeId": "node2", "skillCheck": {"attribute": "PER", "difficulty": 3}}],
      "isEndNode": false
    }],
    "optimalPath": ["start", "node2", "success"],
    "note": "optional"
  }]
}
`;
}

function sanitizeSocialScenarios(plan: SocialPlanScenario[], minimum: number): SocialScenario[] {
  const sanitized = plan
    .map((scenario, index) => {
      const nodes = buildSocialNodes(scenario.nodes);
      const initialNodeId = nodes.start ? 'start' : Object.keys(nodes)[0];
      if (!initialNodeId) return null;

      // Require all AI-generated fields - no default fallbacks
      if (!scenario.title?.trim()) {
        throw new Error(`AI failed to generate title for scenario ${index + 1}. All fields must be AI-generated.`);
      }
      if (!scenario.description?.trim()) {
        throw new Error(`AI failed to generate description for scenario ${index + 1}. All fields must be AI-generated.`);
      }
      if (typeof scenario.xp !== 'number') {
        throw new Error(`AI failed to generate xp for scenario ${index + 1}. All fields must be AI-generated.`);
      }
      if (typeof scenario.difficulty !== 'number') {
        throw new Error(`AI failed to generate difficulty for scenario ${index + 1}. All fields must be AI-generated.`);
      }
      if (!scenario.context?.trim()) {
        throw new Error(`AI failed to generate context for scenario ${index + 1}. All fields must be AI-generated.`);
      }
      if (!scenario.objectives || !scenario.objectives.primary?.trim()) {
        throw new Error(`AI failed to generate objectives for scenario ${index + 1}. All fields must be AI-generated.`);
      }
      if (!Array.isArray(scenario.optimalPath) || scenario.optimalPath.length === 0) {
        throw new Error(`AI failed to generate optimalPath for scenario ${index + 1}. All fields must be AI-generated.`);
      }
      if (!scenario.hiddenRewards || typeof scenario.hiddenRewards !== 'object') {
        throw new Error(`AI failed to generate hiddenRewards for scenario ${index + 1}. All fields must be AI-generated.`);
      }

      return {
        id: `social-${index}`,
        title: scenario.title.trim(),
        description: scenario.description.trim(),
        difficulty: clampNumber(scenario.difficulty, 1, 5),
        xp: clampNumber(scenario.xp, 20, 50),
        hiddenRewards: sanitizeRewards({}, scenario.hiddenRewards, 2),
        context: scenario.context.trim(),
        objectives: scenario.objectives,
        nodes,
        initialNodeId,
        optimalPath: scenario.optimalPath,
        origin: 'ai',
        generatedAt: new Date().toISOString(),
        aiContext: scenario.note,
      } as SocialScenario;
    })
    .filter((scenario): scenario is SocialScenario => Boolean(scenario));

  if (!sanitized.length) {
    throw new Error('No valid social scenarios returned');
  }
  return sanitized.slice(0, Math.max(minimum, sanitized.length));
}

function buildSocialNodes(planNodes: SocialPlanScenario['nodes']): SocialScenario['nodes'] {
  const nodes: SocialScenario['nodes'] = {};
  if (!Array.isArray(planNodes) || planNodes.length === 0) {
    throw new Error('AI failed to generate nodes array. All nodes must be AI-generated.');
  }

  planNodes.forEach((node, index) => {
    // Require all AI-generated fields - no fallbacks
    if (!node.id?.trim()) {
      throw new Error(`AI failed to generate id for node ${index + 1}. All node fields must be AI-generated.`);
    }
    if (!node.speaker?.trim()) {
      throw new Error(`AI failed to generate speaker for node ${node.id || index + 1}. All node fields must be AI-generated.`);
    }
    if (!node.text?.trim()) {
      throw new Error(`AI failed to generate text for node ${node.id || index + 1}. All node fields must be AI-generated.`);
    }
    if (!node.context?.trim()) {
      throw new Error(`AI failed to generate context for node ${node.id || index + 1}. All node fields must be AI-generated.`);
    }
    if (!Array.isArray(node.hiddenCues) || node.hiddenCues.length === 0) {
      throw new Error(`AI failed to generate hiddenCues for node ${node.id || index + 1}. Must have at least 1 cue. All node fields must be AI-generated.`);
    }
    if (typeof node.isEndNode !== 'boolean') {
      throw new Error(`AI failed to generate isEndNode for node ${node.id || index + 1}. All node fields must be AI-generated.`);
    }

    const id = node.id.trim();
    nodes[id] = {
      id,
      speaker: node.speaker.trim(),
      text: node.text.trim(),
      context: node.context.trim(),
      hiddenCues: node.hiddenCues.slice(0, 3),
      isEndNode: node.isEndNode,
      choices: sanitizeChoices(node.choices, node.isEndNode, id),
    };
  });

  return nodes;
}

function sanitizeChoices(
  choices: SocialPlanScenario['nodes'][number]['choices'],
  isEndNode: boolean,
  currentId: string
): Array<{
  id: string;
  text: string;
  nextNodeId: string | null;
  skillCheck?: { attribute: keyof Attributes; difficulty: number };
}> {
  if (isEndNode) return [];
  const allowedAttributes: (keyof Attributes)[] = ['STR', 'AGI', 'VIT', 'INT', 'PER', 'WIS'];

  // Require AI-generated choices - no fallbacks
  if (!Array.isArray(choices) || choices.length === 0) {
    throw new Error(`AI failed to generate choices for node ${currentId}. All choices must be AI-generated.`);
  }

  return choices.map((choice, index) => {
    // Require all AI-generated fields - no fallbacks
    if (!choice.id?.trim()) {
      throw new Error(`AI failed to generate id for choice ${index + 1} in node ${currentId}. All choice fields must be AI-generated.`);
    }
    if (!choice.text?.trim()) {
      throw new Error(`AI failed to generate text for choice ${index + 1} in node ${currentId}. All choice fields must be AI-generated.`);
    }
    if (choice.nextNodeId === undefined || choice.nextNodeId === null) {
      // nextNodeId can be null for end choices, but must be explicitly provided
      if (choice.nextNodeId === undefined) {
        throw new Error(`AI failed to generate nextNodeId for choice ${index + 1} in node ${currentId}. All choice fields must be AI-generated.`);
      }
    }
    // skillCheck is optional, but if provided, must be valid
    if (choice.skillCheck) {
      if (!allowedAttributes.includes(choice.skillCheck.attribute)) {
        throw new Error(`AI failed to generate valid skillCheck attribute for choice ${index + 1} in node ${currentId}. Must be one of: ${allowedAttributes.join(', ')}`);
      }
      if (typeof choice.skillCheck.difficulty !== 'number') {
        throw new Error(`AI failed to generate skillCheck difficulty for choice ${index + 1} in node ${currentId}. All choice fields must be AI-generated.`);
      }
    }

    return {
      id: choice.id.trim(),
      text: choice.text.trim(),
      nextNodeId: choice.nextNodeId?.trim() || null,
      skillCheck:
        choice.skillCheck && allowedAttributes.includes(choice.skillCheck.attribute)
          ? {
              attribute: choice.skillCheck.attribute,
              difficulty: clampNumber(choice.skillCheck.difficulty, 1, 5),
            }
          : undefined,
    };
  });
}

const clampNumber = (value: number, min: number, max: number) => {
  if (typeof value !== 'number' || Number.isNaN(value)) return min;
  return Math.max(min, Math.min(max, Math.round(value)));
};

const sanitizeRewards = (
  base: Partial<Attributes>,
  overrides: Partial<Attributes>,
  maxAttributes = 2
): Partial<Attributes> => {
  const entries = Object.entries(overrides || {})
    .filter(([, value]) => typeof value === 'number' && value! > 0)
    .slice(0, maxAttributes);

  const result: Partial<Attributes> = { ...base };
  entries.forEach(([key, value]) => {
    result[key as keyof Attributes] = clampNumber(value as number, 1, 2);
  });
  return result;
};

