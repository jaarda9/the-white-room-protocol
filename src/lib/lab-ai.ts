import { Attributes, MentalChallenge, PhysicalWorkout, SocialScenario, UserProfile } from './types';
import chatGPTService from './chatgpt-service';

const LAB_CACHE_PREFIX = 'wrp_ai_lab_';

type LabType = 'mental' | 'physical' | 'social';

interface LabCache<T> {
  date: string;
  items: T;
}

interface MentalPlanResponse {
  assignments: Array<{
    type: MentalChallenge['type'];
    codename?: string;
    title?: string;
    description?: string;
    xp?: number;
    difficulty?: number;
    timeLimit?: number;
    hiddenRewards?: Partial<Attributes>;
    notes?: string;
  }>;
}

interface PhysicalPlanResponse {
  workouts: Array<{
    track: 'strength' | 'cardio' | 'flexibility';
    codename?: string;
    title?: string;
    description?: string;
    xp?: number;
    difficulty?: number;
    duration?: number;
    hiddenRewards?: Partial<Attributes>;
    notes?: string;
  }>;
}

interface SocialPlanResponse {
  overlays: Array<{
    title?: string;
    description?: string;
    xp?: number;
    difficulty?: number;
    hiddenRewards?: Partial<Attributes>;
    context?: string;
    objectives?: {
      primary: string;
      secondary?: string[];
    };
    directive?: string;
  }>;
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
  baseChallenges: MentalChallenge[]
): Promise<MentalChallenge[]> {
  const prompt = buildMentalPrompt(profile, baseChallenges);
  const response = await chatGPTService.callChatGPTJSON<MentalPlanResponse>(prompt, {
    temperature: 0.75,
    maxTokens: 900,
  });

  if (!response?.assignments?.length) {
    throw new Error('Mental lab AI returned empty assignments');
  }

  return applyMentalAssignments(baseChallenges, response.assignments);
}

async function generatePhysicalAssignments(
  profile: UserProfile,
  baseWorkouts: PhysicalWorkout[]
): Promise<PhysicalWorkout[]> {
  const prompt = buildPhysicalPrompt(profile, baseWorkouts);
  const response = await chatGPTService.callChatGPTJSON<PhysicalPlanResponse>(prompt, {
    temperature: 0.7,
    maxTokens: 900,
  });

  if (!response?.workouts?.length) {
    throw new Error('Physical lab AI returned empty plan');
  }

  return applyPhysicalAssignments(baseWorkouts, response.workouts);
}

async function generateSocialOverlays(
  profile: UserProfile,
  baseScenarios: SocialScenario[]
): Promise<SocialScenario[]> {
  const prompt = buildSocialPrompt(profile, baseScenarios);
  const response = await chatGPTService.callChatGPTJSON<SocialPlanResponse>(prompt, {
    temperature: 0.65,
    maxTokens: 700,
  });

  if (!response?.overlays?.length) {
    throw new Error('Social lab AI returned empty overlay');
  }

  return applySocialOverlays(baseScenarios, response.overlays);
}

const formatAttributes = (attrs: Partial<Attributes>) =>
  Object.entries(attrs || {})
    .map(([key, value]) => `${key}+${value}`)
    .join(', ') || 'None';

function buildMentalPrompt(profile: UserProfile, baseChallenges: MentalChallenge[]): string {
  const modules = baseChallenges
    .map(challenge => {
      return `- ${challenge.type.toUpperCase()} :: ${challenge.title} | difficulty ${challenge.difficulty}/5 | ${challenge.timeLimit}s | XP ${challenge.xp} | rewards: ${formatAttributes(challenge.hiddenRewards)}`;
    })
    .join('\n');

  return `
You are THE ARCHITECT of THE WHITE ROOM. Voice: clinical, minimal, exact. Calibrate the mental laboratory.

SUBJECT
- Level ${profile.level}
- XP ${profile.xp}/${profile.xpToNextLevel}
- Visible stats: ${formatAttributes(profile.visibleStats)}
- Hidden reserves: ${formatAttributes(profile.accumulatedPoints)}

AVAILABLE MODULES
${modules}

TASK
- Determine three assignments (pattern, memory, logic, or focus) using the modules as anchors.
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

function applyMentalAssignments(
  baseChallenges: MentalChallenge[],
  assignments: MentalPlanResponse['assignments']
): MentalChallenge[] {
  const available = baseChallenges.map(challenge => clone(challenge));
  const usedIndices = new Set<number>();
  const enhanced: MentalChallenge[] = [];

  assignments.forEach(assignment => {
    const preferredIndex = available.findIndex(
      (challenge, idx) => !usedIndices.has(idx) && challenge.type === assignment.type
    );
    const fallbackIndex = available.findIndex((_, idx) => !usedIndices.has(idx));
    const index = preferredIndex !== -1 ? preferredIndex : fallbackIndex;
    if (index === -1) return;

    usedIndices.add(index);
    const base = available[index];
    enhanced.push({
      ...base,
      title: assignment.codename?.trim() || assignment.title?.trim() || base.title,
      description: assignment.description?.trim() || base.description,
      xp: assignment.xp ? clampNumber(assignment.xp, 15, 50) : base.xp,
      difficulty: assignment.difficulty ? clampNumber(assignment.difficulty, 1, 5) : base.difficulty,
      timeLimit: assignment.timeLimit ? clampNumber(assignment.timeLimit, 60, 300) : base.timeLimit,
      hiddenRewards: assignment.hiddenRewards
        ? sanitizeRewards(base.hiddenRewards, assignment.hiddenRewards)
        : base.hiddenRewards,
      origin: 'ai',
      generatedAt: new Date().toISOString(),
      aiContext: assignment.notes,
    });
  });

  // Append unused base challenges (if AI returned fewer than available)
  available.forEach((challenge, idx) => {
    if (!usedIndices.has(idx)) {
      enhanced.push(challenge);
    }
  });

  return enhanced;
}

function buildPhysicalPrompt(profile: UserProfile, baseWorkouts: PhysicalWorkout[]): string {
  const tracks = baseWorkouts
    .map(workout => {
      const primaryType = inferWorkoutTrack(workout);
      return `- ${primaryType.toUpperCase()} :: ${workout.title} | duration ${workout.totalDuration}m | difficulty ${workout.difficulty}/5 | XP ${workout.xp} | rewards: ${formatAttributes(workout.hiddenRewards)}`;
    })
    .join('\n');

  return `
You are THE ARCHITECT of THE WHITE ROOM. Voice: precise, dispassionate. Configure the physical lab session.

SUBJECT
- Level ${profile.level}
- Visible stats: ${formatAttributes(profile.visibleStats)}
- Hidden reserves: ${formatAttributes(profile.accumulatedPoints)}

AVAILABLE MODULES
${tracks}

TASK
- Produce three sessions (strength, cardio, flexibility) derived from the modules.
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

function applyPhysicalAssignments(
  baseWorkouts: PhysicalWorkout[],
  assignments: PhysicalPlanResponse['workouts']
): PhysicalWorkout[] {
  const available = baseWorkouts.map(workout => clone(workout));
  const usedIndices = new Set<number>();
  const enhanced: PhysicalWorkout[] = [];

  assignments.forEach(assignment => {
    const track = assignment.track;
    const preferredIndex = available.findIndex(
      (workout, idx) => !usedIndices.has(idx) && inferWorkoutTrack(workout) === track
    );
    const fallbackIndex = available.findIndex((_, idx) => !usedIndices.has(idx));
    const index = preferredIndex !== -1 ? preferredIndex : fallbackIndex;
    if (index === -1) return;

    usedIndices.add(index);
    const base = available[index];
    enhanced.push({
      ...base,
      title: assignment.codename?.trim() || base.title,
      description: assignment.description?.trim() || base.description,
      xp: assignment.xp ? clampNumber(assignment.xp, 80, 180) : base.xp,
      difficulty: assignment.difficulty ? clampNumber(assignment.difficulty, 1, 5) : base.difficulty,
      totalDuration: assignment.duration ? clampNumber(assignment.duration, 15, 45) : base.totalDuration,
      hiddenRewards: assignment.hiddenRewards
        ? sanitizeRewards(base.hiddenRewards, assignment.hiddenRewards)
        : base.hiddenRewards,
      origin: 'ai',
      generatedAt: new Date().toISOString(),
      aiContext: assignment.notes,
    });
  });

  available.forEach((workout, idx) => {
    if (!usedIndices.has(idx)) {
      enhanced.push(workout);
    }
  });

  return enhanced;
}

const inferWorkoutTrack = (workout: PhysicalWorkout): PhysicalPlanResponse['workouts'][number]['track'] => {
  const exerciseTypes = workout.exercises.map(ex => ex.type);
  if (exerciseTypes.every(type => type === 'strength')) return 'strength';
  if (exerciseTypes.every(type => type === 'flexibility')) return 'flexibility';
  return 'cardio';
};

function buildSocialPrompt(profile: UserProfile, baseScenarios: SocialScenario[]): string {
  const summary = baseScenarios
    .map(scenario => {
      return `- ${scenario.title}: difficulty ${scenario.difficulty}/5, XP ${scenario.xp}, rewards ${formatAttributes(
        scenario.hiddenRewards
      )}, context "${scenario.context}", objective "${scenario.objectives.primary}"`;
    })
    .join('\n');

  return `
You are THE ARCHITECT of THE WHITE ROOM. Tone: measured, professional. Refresh the social simulations.

SUBJECT
- Level ${profile.level}
- Observed emphasis: PER ${profile.visibleStats.PER}, WIS ${profile.visibleStats.WIS}

CURRENT SCENARIOS
${summary}

TASK
- Provide new overlays for each scenario (title, briefing, objectives, directive, rewards).
- Keep settings rooted in realistic negotiation or observation environments.
- XP 20-50. Difficulty 1-5. Attribute rewards capped at +2 each, two stats max.
- Directives must read like operational guidance.

Return JSON:
{
  "overlays": [
    {
      "title": "SHORT LABEL",
      "description": "brief mission summary",
      "xp": number,
      "difficulty": number,
      "hiddenRewards": { "PER"?: number, "WIS"?: number, "INT"?: number },
      "context": "setting description",
      "objectives": { "primary": "...", "secondary": ["...", "..."] },
      "directive": "succinct guidance"
    }
  ]
}
`;
}

function applySocialOverlays(
  baseScenarios: SocialScenario[],
  overlays: SocialPlanResponse['overlays']
): SocialScenario[] {
  const enhanced: SocialScenario[] = [];
  const baseClones = baseScenarios.map(scenario => clone(scenario));

  baseClones.forEach((scenario, idx) => {
    const overlay = overlays[idx];
    if (!overlay) {
      enhanced.push(scenario);
      return;
    }

    enhanced.push({
      ...scenario,
      title: overlay.title?.trim() || scenario.title,
      description: overlay.description?.trim() || scenario.description,
      xp: overlay.xp ? clampNumber(overlay.xp, 20, 50) : scenario.xp,
      difficulty: overlay.difficulty ? clampNumber(overlay.difficulty, 1, 5) : scenario.difficulty,
      hiddenRewards: overlay.hiddenRewards
        ? sanitizeRewards(scenario.hiddenRewards, overlay.hiddenRewards)
        : scenario.hiddenRewards,
      context: overlay.context?.trim() || scenario.context,
      objectives: overlay.objectives
        ? {
            primary: overlay.objectives.primary || scenario.objectives.primary,
            secondary: overlay.objectives.secondary?.length ? overlay.objectives.secondary : scenario.objectives.secondary,
          }
        : scenario.objectives,
      origin: 'ai',
      generatedAt: new Date().toISOString(),
      aiContext: overlay.directive,
    });
  });

  return enhanced;
}

const clampNumber = (value: number, min: number, max: number) => {
  if (Number.isNaN(value)) return min;
  return Math.max(min, Math.min(max, Math.round(value)));
};

const sanitizeRewards = (
  base: Partial<Attributes>,
  overrides: Partial<Attributes>
): Partial<Attributes> => {
  const result: Partial<Attributes> = { ...base };
  (Object.keys(overrides) as (keyof Attributes)[]).forEach(key => {
    const value = overrides[key];
    if (typeof value === 'number' && value > 0) {
      result[key] = clampNumber(value, 1, 5);
    }
  });
  return result;
};

