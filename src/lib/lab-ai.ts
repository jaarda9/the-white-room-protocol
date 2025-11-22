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
      maxTokens: 3000, // Increased for 4 modules with detailed procedures
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
      maxTokens: 2000, // Increased for detailed exercise descriptions
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
      maxTokens: 2000, // Reduced to prevent timeout - Vercel has 10s limit for free tier
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

MODULE 2: PSYCHOLOGICAL IMMUNITY
Target: Nullification of emotional processing when confronted with morally complex or stressful scenarios.

MODULE 3: STRATEGIC FORECASTING
Target: The ability to generate and hold multiple, deep-layer future scenarios based on limited present data.

MODULE 4: ENVIRONMENTAL MEMORY & RECONSTRUCTION
Target: Absolute, instantaneous recall and spatial reconstruction of learned data and observed environments.

REQUIREMENTS:
- XP 15-50 per module. Time limit 60-300 seconds. Difficulty 1-5.
- Hidden rewards: at most two stats, each between +1 and +2.
- Language must stay sterile. No dramatization. Clinical precision only.

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
        "questions"?: Array<{
          "question": string,
          "options": string[],
          "correctIndex": number
        }>,
        "sequence"?: number[],
        "targetClicks"?: number
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
        "questions"?: Array<{
          "question": string,
          "options": string[],
          "correctIndex": number
        }>,
        "sequence"?: number[],
        "targetClicks"?: number
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
        "questions"?: Array<{
          "question": string,
          "options": string[],
          "correctIndex": number
        }>,
        "sequence"?: number[],
        "targetClicks"?: number
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
        "questions"?: Array<{
          "question": string,
          "options": string[],
          "correctIndex": number
        }>,
        "sequence"?: number[],
        "targetClicks"?: number
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
- Each workout must include 2-4 exercises with sets, reps (or duration), rest periods, and form cues.
- XP 80-180. Duration 15-45 minutes. Difficulty 1-5.
- Attribute rewards must be restrained (max +2 each, two stats max).
- Phrasing must remain minimal and literal.

Return JSON:
{
  "workouts": [
    {
      "track": "strength",
      "title": "HOME-BASED STRENGTH",
      "description": "Bodyweight and dumbbell exercises",
      "xp": number,
      "difficulty": number,
      "duration": number,
      "hiddenRewards": { "STR"?: number, "AGI"?: number, "VIT"?: number },
      "note": "optional execution cue",
      "exercises": [
        {
          "name": "Exercise Name",
          "type": "strength",
          "sets": number,
          "reps": number,
          "restPeriod": number,
          "cues": ["cue1", "cue2"]
        }
      ]
    },
    {
      "track": "cardio",
      "title": "CARDIO TRAINING",
      "description": "Cardiovascular conditioning",
      "xp": number,
      "difficulty": number,
      "duration": number,
      "hiddenRewards": { "VIT"?: number, "AGI"?: number },
      "note": "optional execution cue",
      "exercises": [
        {
          "name": "Exercise Name",
          "type": "cardio",
          "sets": 1,
          "duration": number,
          "restPeriod": number,
          "cues": ["cue1", "cue2"]
        }
      ]
    },
    {
      "track": "flexibility",
      "title": "STRETCHING",
      "description": "Flexibility and mobility work",
      "xp": number,
      "difficulty": number,
      "duration": number,
      "hiddenRewards": { "AGI"?: number, "VIT"?: number },
      "note": "optional execution cue",
      "exercises": [
        {
          "name": "Stretch Name",
          "type": "flexibility",
          "sets": 1,
          "duration": number,
          "restPeriod": number,
          "cues": ["cue1", "cue2"]
        }
      ]
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
      const data = buildMentalData(type, assignment.data);

      sanitized.push({
        id: crypto.randomUUID(),
        type,
        title: assignment.protocolName?.trim() || `MODULE ${assignment.moduleNumber}: ${assignment.moduleType.toUpperCase()}`,
        description: assignment.objective?.trim() || 'Execute prescribed task.',
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
        protocolName: assignment.protocolName?.trim() || `MODULE ${assignment.moduleNumber}`,
        objective: assignment.objective?.trim() || 'Execute prescribed task.',
        executionProcedure: Array.isArray(assignment.executionProcedure) 
          ? assignment.executionProcedure.filter(Boolean)
          : assignment.executionProcedure?.split('\n').filter(Boolean) || [],
        successMetric: assignment.successMetric?.trim() || 'Complete all steps within time limit.',
      } as MentalChallenge);
    });

  // Ensure we have exactly 4 modules
  while (sanitized.length < 4) {
    const moduleNum = sanitized.length + 1;
    let moduleType: MentalPlanAssignment['moduleType'] = 'cognitive-speed-depth';
    let type: MentalChallenge['type'] = 'speed-processing';

    if (moduleNum === 1) {
      moduleType = 'cognitive-speed-depth';
      type = 'speed-processing';
    } else if (moduleNum === 2) {
      moduleType = 'psychological-immunity';
      type = 'strategic-planning';
    } else if (moduleNum === 3) {
      moduleType = 'strategic-forecasting';
      type = 'strategic-planning';
    } else if (moduleNum === 4) {
      moduleType = 'environmental-memory-reconstruction';
      type = 'working-memory';
    }

    sanitized.push({
      id: crypto.randomUUID(),
      type,
      title: `MODULE ${moduleNum}: ${moduleType.toUpperCase()}`,
      description: 'Execute prescribed task.',
      xp: 20,
      difficulty: 2,
      hiddenRewards: {},
      timeLimit: 120,
      data: buildMentalData(type, {}),
      completed: false,
      origin: 'ai',
      generatedAt: new Date().toISOString(),
      protocolName: `MODULE ${moduleNum}`,
      objective: 'Execute prescribed task.',
      executionProcedure: [],
      successMetric: 'Complete all steps within time limit.',
    } as MentalChallenge);
  }

  if (!sanitized.length) {
    throw new Error('No valid mental assignments returned');
  }

  // Return exactly 4 challenges
  return sanitized.slice(0, 4);
}

function buildMentalData(type: MentalChallenge['type'], data: any = {}): any {
  if (type === 'working-memory') {
    return { items: data.items || null };
  }
  if (type === 'speed-processing') {
    return { questions: data.questions || null };
  }
  if (type === 'strategic-planning') {
    return { scenario: data.scenario || null };
  }
  return {};
}

function sanitizeQuestions(
  questions: NonNullable<MentalPlanAssignment['data']>['questions']
): Array<{ question: string; options: string[]; correctIndex: number }> {
  return (questions || [])
    .map(q => {
      const options =
        Array.isArray(q.options) && q.options.length >= 2
          ? q.options.slice(0, 4)
          : ['Option A', 'Option B'];
      const correctIndex = clampNumber(q.correctIndex ?? 0, 0, options.length - 1);
      return {
        question: q.question?.trim() || 'Select the most precise option.',
        options,
        correctIndex,
      };
    })
    .filter(Boolean);
}

function createFallbackQuestion(): { question: string; options: string[]; correctIndex: number } {
  return {
    question: 'Which response maintains operational clarity?',
    options: ['Neutral summary', 'Emotional appeal', 'Ambiguous hint'],
    correctIndex: 0,
  };
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
      // Create fallback workout if missing
      const fallbackExercises = createFallbackExercises(requiredTrack, i);
      sanitized.push({
        id: crypto.randomUUID(),
        title: requiredTrack === 'strength' ? 'HOME-BASED STRENGTH' : 
               requiredTrack === 'cardio' ? 'CARDIO TRAINING' : 'STRETCHING',
        description: requiredTrack === 'strength' ? 'Bodyweight and dumbbell exercises' :
                     requiredTrack === 'cardio' ? 'Cardiovascular conditioning' :
                     'Flexibility and mobility work',
        difficulty: 2,
        xp: 100,
        hiddenRewards: {},
        exercises: fallbackExercises,
        totalDuration: 25,
        origin: 'ai',
        generatedAt: new Date().toISOString(),
      } as PhysicalWorkout);
      continue;
    }
    
    const track = allowedTracks.includes(assignment.track) ? assignment.track : requiredTrack;
    let exercises = sanitizeExercises(assignment.exercises, track);
    // If no exercises, create fallback exercises instead of rejecting the workout
    if (!exercises.length) {
      exercises = createFallbackExercises(track, i);
    }

    sanitized.push({
      id: crypto.randomUUID(),
      title: assignment.title?.trim() || 
             (track === 'strength' ? 'HOME-BASED STRENGTH' : 
              track === 'cardio' ? 'CARDIO TRAINING' : 'STRETCHING'),
      description: assignment.description?.trim() || 'Follow the prescribed sequence.',
      difficulty: clampNumber(assignment.difficulty ?? 2, 1, 5),
      xp: clampNumber(assignment.xp ?? 100, 80, 180),
      hiddenRewards: sanitizeRewards({}, assignment.hiddenRewards || {}, 2),
      exercises,
      totalDuration: clampNumber(assignment.duration ?? 25, 15, 45),
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
  if (!Array.isArray(exercises) || exercises.length === 0) return [];
  return exercises
    .map((exercise, index) => {
      const type = exercise.type || track;
      const sets = exercise.sets ?? (type === 'cardio' ? 1 : 3);
      const reps = type === 'cardio' ? undefined : exercise.reps ?? 12;
      const duration = exercise.duration ?? (type === 'cardio' ? 60 : 0);
      const restPeriod = clampNumber(exercise.restPeriod ?? 45, 20, 90);
      const cues =
        Array.isArray(exercise.cues) && exercise.cues.length ? exercise.cues.slice(0, 4) : ['Maintain neutral spine'];

      return {
        id: `ex-${index}`,
        name: exercise.name?.trim() || `${track.toUpperCase()} MOVE ${index + 1}`,
        sets,
        reps,
        duration,
        restPeriod,
        type,
        formCues: cues,
        completed: false,
      } as PhysicalExercise;
    })
    .filter(Boolean);
}

function createFallbackExercises(track: PhysicalPlanAssignment['track'], workoutIndex: number): PhysicalExercise[] {
  const fallbackNames: Record<PhysicalPlanAssignment['track'], string[]> = {
    strength: ['Push-ups', 'Squats', 'Plank Hold'],
    cardio: ['Jumping Jacks', 'High Knees', 'Burpees'],
    flexibility: ['Forward Fold', 'Hip Circles', 'Shoulder Rolls'],
  };

  const names = fallbackNames[track] || ['Exercise 1', 'Exercise 2', 'Exercise 3'];
  return names.map((name, index) => ({
    id: `ex-fallback-${workoutIndex}-${index}`,
    name,
    sets: track === 'cardio' ? 1 : 3,
    reps: track === 'cardio' ? undefined : 12,
    duration: track === 'cardio' ? 60 : 0,
    restPeriod: 45,
    type: track,
    formCues: ['Maintain neutral spine', 'Control your breathing'],
    completed: false,
  })) as PhysicalExercise[];
}

function buildSocialPrompt(profile: UserProfile): string {
  return `
You are THE ARCHITECT of THE WHITE ROOM. Tone: disciplined, minimal. Generate social scenarios.

SUBJECT: Level ${profile.level}, PER ${profile.visibleStats.PER}, WIS ${profile.visibleStats.WIS}

TASK: Generate 1-2 scenarios. Each needs:
- start node + 2-3 nodes (speaker, text, context, 1-3 hiddenCues, 1-3 choices)
- Choices: text, nextNodeId, optional skillCheck (attribute: PER/WIS/INT, difficulty 1-5)
- XP 20-50, difficulty 1-5, rewards max +2 per stat (2 stats max)
- Realistic setting (boardroom/briefing/negotiation)
- optimalPath array

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

      return {
        id: `social-${index}`,
        title: scenario.title?.trim() || `SOCIAL PROTOCOL ${index + 1}`,
        description: scenario.description?.trim() || 'Execute the observation drill.',
        difficulty: clampNumber(scenario.difficulty ?? 3, 1, 5),
        xp: clampNumber(scenario.xp ?? 30, 20, 50),
        hiddenRewards: sanitizeRewards({}, scenario.hiddenRewards || {}, 2),
        context: scenario.context?.trim() || 'Briefing room',
        objectives: scenario.objectives?.primary
          ? scenario.objectives
          : { primary: 'Maintain situational awareness' },
        nodes,
        initialNodeId,
        optimalPath:
          Array.isArray(scenario.optimalPath) && scenario.optimalPath.length
            ? scenario.optimalPath
            : [initialNodeId],
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
  if (!Array.isArray(planNodes)) {
    return nodes;
  }

  planNodes.forEach((node, index) => {
    const id = (node.id && node.id.trim()) || (index === 0 ? 'start' : `node-${index}`);
    nodes[id] = {
      id,
      speaker: node.speaker?.trim() || 'OBSERVER',
      text: node.text?.trim() || 'Maintain observation stance.',
      context: node.context?.trim(),
      hiddenCues: Array.isArray(node.hiddenCues) ? node.hiddenCues.slice(0, 3) : undefined,
      isEndNode: node.isEndNode ?? false,
      choices: sanitizeChoices(node.choices, node.isEndNode ?? false, id),
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

  const sanitized =
    Array.isArray(choices) && choices.length
      ? choices.map((choice, index) => ({
          id: choice.id?.trim() || `${currentId}-choice-${index}`,
          text: choice.text?.trim() || 'Maintain neutral reply.',
          nextNodeId: choice.nextNodeId?.trim() || null,
          skillCheck:
            choice.skillCheck && allowedAttributes.includes(choice.skillCheck.attribute)
              ? {
                  attribute: choice.skillCheck.attribute,
                  difficulty: clampNumber(choice.skillCheck.difficulty ?? 2, 1, 5),
                }
              : undefined,
        }))
      : [
          {
            id: `${currentId}-choice-0`,
            text: 'Acknowledge and wait.',
            nextNodeId: null,
          },
        ];

  return sanitized;
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

