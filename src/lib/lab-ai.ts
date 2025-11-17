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
  type: MentalChallenge['type'];
  title: string;
  description: string;
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

const clone = <T>(data: T): T => JSON.parse(JSON.stringify(data));

export async function enhanceMentalChallenges(
  profile: UserProfile,
  baseChallenges: MentalChallenge[]
): Promise<MentalChallenge[]> {
  const cacheKey = `${LAB_CACHE_PREFIX}mental`;

  const cached = loadLabCache<MentalChallenge[]>(cacheKey);
  if (cached && cached.date === todayKey()) {
    return cached.items;
  }

  if (!labRequests.mental) {
    labRequests.mental = generateMentalAssignments(profile, baseChallenges)
      .then(assignments => {
        saveLabCache(cacheKey, assignments);
        return assignments;
      })
      .finally(() => {
        labRequests.mental = null;
      });
  }

  return labRequests.mental.catch(error => {
    console.warn('Mental lab AI failed, using base challenges', error);
    return baseChallenges;
  });
}

export async function enhancePhysicalWorkouts(
  profile: UserProfile,
  baseWorkouts: PhysicalWorkout[]
): Promise<PhysicalWorkout[]> {
  const cacheKey = `${LAB_CACHE_PREFIX}physical`;

  const cached = loadLabCache<PhysicalWorkout[]>(cacheKey);
  if (cached && cached.date === todayKey()) {
    return cached.items;
  }

  if (!labRequests.physical) {
    labRequests.physical = generatePhysicalAssignments(profile, baseWorkouts)
      .then(assignments => {
        saveLabCache(cacheKey, assignments);
        return assignments;
      })
      .finally(() => {
        labRequests.physical = null;
      });
  }

  return labRequests.physical.catch(error => {
    console.warn('Physical lab AI failed, using base workouts', error);
    return baseWorkouts;
  });
}

export async function enhanceSocialScenarios(
  profile: UserProfile,
  baseScenarios: SocialScenario[]
): Promise<SocialScenario[]> {
  const cacheKey = `${LAB_CACHE_PREFIX}social`;

  const cached = loadLabCache<SocialScenario[]>(cacheKey);
  if (cached && cached.date === todayKey()) {
    return cached.items;
  }

  if (!labRequests.social) {
    labRequests.social = generateSocialOverlays(profile, baseScenarios)
      .then(assignments => {
        saveLabCache(cacheKey, assignments);
        return assignments;
      })
      .finally(() => {
        labRequests.social = null;
      });
  }

  return labRequests.social.catch(error => {
    console.warn('Social lab AI failed, using base scenarios', error);
    return baseScenarios;
  });
}

async function generateMentalAssignments(
  profile: UserProfile,
  fallback: MentalChallenge[]
): Promise<MentalChallenge[]> {
  try {
    const prompt = buildMentalPrompt(profile);
    const response = await chatGPTService.callChatGPTJSON<MentalPlanResponse>(prompt, {
      temperature: 0.5,
      maxTokens: 1100,
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
    console.warn('Mental lab AI failure, using fallback', error);
    return clone(fallback);
  }
}

async function generatePhysicalAssignments(
  profile: UserProfile,
  fallback: PhysicalWorkout[]
): Promise<PhysicalWorkout[]> {
  try {
    const prompt = buildPhysicalPrompt(profile);
    const response = await chatGPTService.callChatGPTJSON<PhysicalPlanResponse>(prompt, {
      temperature: 0.45,
      maxTokens: 1100,
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
    console.warn('Physical lab AI failure, using fallback', error);
    return clone(fallback);
  }
}

async function generateSocialOverlays(
  profile: UserProfile,
  fallback: SocialScenario[]
): Promise<SocialScenario[]> {
  try {
    const prompt = buildSocialPrompt(profile);
    const response = await chatGPTService.callChatGPTJSON<SocialPlanResponse>(prompt, {
      temperature: 0.4,
      maxTokens: 1200,
    });

    if (!response?.scenarios?.length) {
      throw new Error('Social lab AI returned empty plan');
    }

    const sanitized = sanitizeSocialScenarios(response.scenarios, fallback.length || 1);
    if (!sanitized.length) {
      throw new Error('Social lab AI produced invalid scenarios');
    }
    return sanitized;
  } catch (error) {
    console.warn('Social lab AI failure, using fallback', error);
    return clone(fallback);
  }
}

const formatAttributes = (attrs: Partial<Attributes>) =>
  Object.entries(attrs || {})
    .map(([key, value]) => `${key}+${value}`)
    .join(', ') || 'None';

function buildMentalPrompt(profile: UserProfile): string {
  return `
You are THE ARCHITECT of THE WHITE ROOM. Voice: clinical, minimal, exact. Calibrate the mental laboratory.

SUBJECT
- Level ${profile.level}
- XP ${profile.xp}/${profile.xpToNextLevel}
- Visible stats: ${formatAttributes(profile.visibleStats)}
- Hidden reserves: ${formatAttributes(profile.accumulatedPoints)}

TASK
- Determine three assignments (pattern, memory, logic, or focus) with clear execution metrics.
- Each directive must be concrete, measurable, and executable now.
- XP 15-50. Time limit 60-300 seconds. Difficulty 1-5.
- Hidden rewards: at most two stats, each between +1 and +2.
- Language must stay sterile. No dramatization.

Return JSON:
{
  "assignments": [
    {
      "type": "pattern|memory|logic|focus",
      "codename": "SHORT LABEL",
      "description": "precise directive",
      "xp": number,
      "difficulty": number,
      "timeLimit": number,
      "hiddenRewards": { "INT"?: number, "WIS"?: number, "PER"?: number, "AGI"?: number },
      "notes": "optional metric or reminder"
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
- Produce three sessions (strength, cardio, flexibility) with clear sequencing.
- Each session must specify focus, duration, and control variables (tempo, breathing, heart-rate, rest).
- XP 80-180. Duration 15-45 minutes. Difficulty 1-5.
- Attribute rewards must be restrained (max +2 each, two stats max).
- Phrasing must remain minimal and literal.

Return JSON:
{
  "workouts": [
    {
      "track": "strength|cardio|flexibility",
      "codename": "SHORT LABEL",
      "description": "concise directive",
      "xp": number,
      "difficulty": number,
      "duration": number,
      "hiddenRewards": { "STR"?: number, "AGI"?: number, "VIT"?: number },
      "notes": "optional execution cue"
    }
  ]
}
`;
}

function sanitizeMentalAssignments(assignments: MentalPlanAssignment[]): MentalChallenge[] {
  const allowedTypes: MentalChallenge['type'][] = ['pattern', 'memory', 'logic', 'focus'];
  return assignments
    .map((assignment, index) => {
      const type = allowedTypes.includes(assignment.type) ? assignment.type : allowedTypes[index % allowedTypes.length];
      const xp = clampNumber(assignment.xp ?? 20, 15, 50);
      const difficulty = clampNumber(assignment.difficulty ?? 2, 1, 5);
      const timeLimit = clampNumber(assignment.timeLimit ?? 120, 60, 300);
      const hiddenRewards = sanitizeRewards({}, assignment.hiddenRewards || {}, 2);
      const data = buildMentalData(type, assignment.data);

      return {
        id: crypto.randomUUID(),
        type,
        title: assignment.title?.trim() || `MENTAL PROTOCOL ${index + 1}`,
        description: assignment.description?.trim() || 'Execute prescribed task.',
        xp,
        difficulty,
        hiddenRewards,
        timeLimit,
        data,
        completed: false,
        origin: 'ai',
        generatedAt: new Date().toISOString(),
        aiContext: assignment.note,
      } as MentalChallenge;
    })
    .filter(Boolean);
}

function buildMentalData(type: MentalChallenge['type'], data: MentalPlanAssignment['data'] = {}): any {
  if (type === 'memory') {
    const sequence =
      Array.isArray(data.sequence) && data.sequence.length >= 3
        ? data.sequence.slice(0, 8).map(num => clampNumber(num, 0, 9))
        : Array.from({ length: 5 }, () => Math.floor(Math.random() * 9));
    return { sequence };
  }

  if (type === 'focus') {
    const targetClicks = clampNumber(data.targetClicks ?? 60, 30, 150);
    return { targetClicks };
  }

  const sanitizedQuestions =
    Array.isArray(data.questions) && data.questions.length
      ? sanitizeQuestions(data.questions)
      : [createFallbackQuestion()];
  return { questions: sanitizedQuestions };
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
  return assignments
    .map((assignment, index) => {
      const track = allowedTracks.includes(assignment.track) ? assignment.track : allowedTracks[index % allowedTracks.length];
      const exercises = sanitizeExercises(assignment.exercises, track);
      if (!exercises.length) return null;

      return {
        id: crypto.randomUUID(),
        title: assignment.title?.trim() || `SESSION ${index + 1}`,
        description: assignment.description?.trim() || 'Follow the prescribed sequence.',
        difficulty: clampNumber(assignment.difficulty ?? 2, 1, 5),
        xp: clampNumber(assignment.xp ?? 100, 80, 180),
        hiddenRewards: sanitizeRewards({}, assignment.hiddenRewards || {}, 2),
        exercises,
        totalDuration: clampNumber(assignment.duration ?? 25, 15, 45),
        origin: 'ai',
        generatedAt: new Date().toISOString(),
        aiContext: assignment.note,
      } as PhysicalWorkout;
    })
    .filter(Boolean) as PhysicalWorkout[];
}

function sanitizeExercises(
  exercises: PhysicalPlanAssignment['exercises'],
  track: PhysicalPlanAssignment['track']
): PhysicalExercise[] {
  if (!Array.isArray(exercises)) return [];
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

function buildSocialPrompt(profile: UserProfile): string {
  return `
You are THE ARCHITECT of THE WHITE ROOM. Tone: disciplined, minimal. Refresh the social lab simulations.

SUBJECT
- Level ${profile.level}
- Observable emphasis: PER ${profile.visibleStats.PER}, WIS ${profile.visibleStats.WIS}

TASK
- Produce 1-2 negotiation/observation scenarios with branching decisions.
- Each scenario must include dialogue nodes (start plus 2-3 additional nodes) and clear objectives.
- XP 20-50. Difficulty 1-5. Attribute rewards limited to +2 each.
- Keep environments realistic (boardroom, briefing, negotiation).

Return JSON:
{
  "scenarios": [
    {
      "title": "SHORT LABEL",
      "description": "brief mission summary",
      "xp": number,
      "difficulty": number,
      "hiddenRewards": { "PER"?: number, "WIS"?: number, "INT"?: number },
      "context": "setting description",
      "objectives": { "primary": "...", "secondary": ["...", "..."] },
      "nodes": [
        {
          "id": "start",
          "speaker": "ROLE",
          "text": "dialogue",
          "context": "non-verbal cues",
          "hiddenCues": ["cue"],
          "choices": [
            { "id": "choice_a", "text": "option", "nextNodeId": "analysis", "skillCheck": { "attribute": "PER", "difficulty": 3 } }
          ]
        }
      ],
      "optimalPath": ["start", "...", "success"],
      "note": "optional directive"
    }
  ]
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
    return [];
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
  nextNodeId?: string;
  skillCheck?: { attribute: keyof Attributes; difficulty: number };
}> {
  if (isEndNode) return [];
  const allowedAttributes: (keyof Attributes)[] = ['STR', 'AGI', 'VIT', 'INT', 'PER', 'WIS'];

  const sanitized =
    Array.isArray(choices) && choices.length
      ? choices.map((choice, index) => ({
          id: choice.id?.trim() || `${currentId}-choice-${index}`,
          text: choice.text?.trim() || 'Maintain neutral reply.',
          nextNodeId: choice.nextNodeId?.trim(),
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
            nextNodeId: undefined,
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

