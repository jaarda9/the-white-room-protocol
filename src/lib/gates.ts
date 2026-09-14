/**
 * Gates — player-declared mid/long-term real-life goals (weeks to months), distinct from
 * Daily Quests (reset every day) and To-Dos (single tasks due one day). Phase 1: manual
 * creation + a milestone checklist + clearing. Later phases layer on THEIA-assessed Rank,
 * rank-gated access, loot on clear, and a real deadline/Breach consequence.
 */
import { aiGatewayClient } from '@/lib/ai-gateway-client';
import {
  getUserProfile,
  saveUserProfile,
  addXP,
  getTodayKeyLocal,
  getHunterVitals,
  consumePhysicalEnergy,
  consumeMentalEnergy,
} from '@/lib/storage';
import type { Attributes, HunterRank } from '@/lib/types';

export const GATES_KEY = 'wrp_gates';
export const GATES_UPDATED_EVENT = 'wrp:gates-updated';

export const ATTRIBUTE_ORDER: Array<keyof Attributes> = ['STR', 'AGI', 'VIT', 'INT', 'PER', 'WIS'];
const PHYSICAL_ATTRIBUTES: Array<keyof Attributes> = ['STR', 'AGI', 'VIT'];
export const isAttribute = (v: unknown): v is keyof Attributes =>
  typeof v === 'string' && ATTRIBUTE_ORDER.includes(v as keyof Attributes);

/** Keyword heuristic used both as the 0-token assessment path and as a safety net whenever
 * the AI omits/mangles an attribute — never leaves a Wave or Gate unclassified. */
const ATTRIBUTE_KEYWORDS: Record<keyof Attributes, string[]> = {
  STR: ['lift', 'strength', 'push-up', 'pushup', 'squat', 'bench', 'deadlift', 'pull-up', 'pullup', 'muscle', 'weightlift', 'gym'],
  AGI: ['run', 'sprint', 'flip', 'jump', 'agility', 'dash', 'dance', 'flexib', 'stretch', 'sport', 'acrobat', 'parkour', 'martial'],
  VIT: ['endurance', 'stamina', 'diet', 'nutrition', 'marathon', 'swim', 'cardio', 'hydrate', 'health', 'cycling', 'weight loss'],
  INT: ['study', 'learn', 'code', 'program', 'read', 'math', 'exam', 'course', 'language', 'book', 'write', 'research', 'certif'],
  PER: ['talk', 'speak', 'social', 'network', 'present', 'pitch', 'interview', 'charisma', 'negotiate', 'date', 'friend', 'conversation'],
  WIS: ['meditate', 'reflect', 'journal', 'mindful', 'discipline', 'habit', 'plan', 'strategy', 'focus', 'routine', 'patience'],
};

const guessAttributeFromText = (text: string, fallback: keyof Attributes): keyof Attributes => {
  const lower = text.toLowerCase();
  let best: keyof Attributes = fallback;
  let bestScore = 0;
  (Object.keys(ATTRIBUTE_KEYWORDS) as Array<keyof Attributes>).forEach((attr) => {
    const score = ATTRIBUTE_KEYWORDS[attr].filter((kw) => lower.includes(kw)).length;
    if (score > bestScore) {
      bestScore = score;
      best = attr;
    }
  });
  return best;
};

export interface GateMilestone {
  id: string;
  label: string;
  /** A short, concrete "how" note — from THEIA's suggestion, or left blank for a manual Wave. */
  hint?: string;
  completed: boolean;
  completedAt?: string;
  /** A To-Do this Wave was scheduled as, so it shows up in the daily flow instead of only
   * living on this page. Completing that To-Do auto-completes this Wave (see GateDetail.tsx). */
  linkedTodoId?: string;
  /** Which attribute this specific Wave's activity trains — THEIA-classified at assessment
   * time (or heuristically guessed if the Gate was never assessed), independent of the
   * Gate's own primaryAttribute. A "read about nutrition" Wave inside a fitness Gate trains
   * INT, not STR. Drives the small hidden attribute-point reward on completion. */
  attribute: keyof Attributes;
  /** Set the first time this Wave's completion reward is paid out — prevents farming XP/points
   * by toggling a Wave off and back on. */
  rewardsGranted?: boolean;
}

/** 'breached' means the deadline passed while still open — it does NOT lock the Gate; it can
 * still be worked on and cleared later, same as a Solo Leveling dungeon break doesn't erase
 * the dungeon. It's a permanent mark on the record, not a dead end. */
export type GateStatus = 'active' | 'cleared' | 'breached';

export interface Gate {
  id: string;
  title: string;
  description: string;
  rank: HunterRank;
  /** What "cleared" actually means — required at creation so a Gate can't be un-clearable. */
  bossCondition: string;
  /** Which attribute this campaign trains — determines where the clear-reward Blessing lands. */
  primaryAttribute: keyof Attributes;
  milestones: GateMilestone[];
  status: GateStatus;
  createdAt: string;
  /** Derived from the declared duration estimate at creation — the Gate's clock. */
  targetDate: string;
  clearedAt?: string;
  breachedAt?: string;
}

export const getGates = (): Gate[] => {
  try {
    const raw = localStorage.getItem(GATES_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

export const getGateById = (gateId: string): Gate | null => {
  return getGates().find((g) => g.id === gateId) || null;
};

export const saveGates = (gates: Gate[]): void => {
  try {
    localStorage.setItem(GATES_KEY, JSON.stringify(gates));
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent(GATES_UPDATED_EVENT));
    }
  } catch {
    // ignore
  }
};

/** Days granted for each declared duration estimate — generous relative to the estimate
 * itself (roughly 1.5x), since this is the actual clock a Breach is judged against, not
 * just a label. */
const DURATION_DAYS: Record<GateDuration, number> = {
  '<2w': 21,
  '2-4w': 42,
  '1-3m': 135,
  '3-6m': 270,
  '6-12m': 545,
  '12m+': 730,
};

export interface CreateGateMilestoneInput {
  label: string;
  hint?: string;
  /** THEIA's per-Wave classification from assessment, when available — see GateMilestone. */
  attribute?: keyof Attributes;
}

export interface CreateGateInput {
  title: string;
  description: string;
  rank: HunterRank;
  bossCondition: string;
  primaryAttribute: keyof Attributes;
  milestones: CreateGateMilestoneInput[];
  duration: GateDuration;
}

/** A Gate needs a real breakdown to exist at all — this is the enforced minimum. */
export const MIN_GATE_MILESTONES = 2;

export const createGate = (input: CreateGateInput): Gate => {
  const targetDate = new Date();
  targetDate.setDate(targetDate.getDate() + (DURATION_DAYS[input.duration] || 90));

  const gate: Gate = {
    id: crypto.randomUUID(),
    title: input.title.trim().slice(0, 120) || 'Unnamed Gate',
    description: input.description.trim().slice(0, 800),
    rank: input.rank,
    bossCondition: input.bossCondition.trim().slice(0, 300),
    primaryAttribute: input.primaryAttribute,
    milestones: input.milestones
      .map((m) => ({ label: m.label.trim(), hint: m.hint?.trim(), attribute: m.attribute }))
      .filter((m) => m.label.length > 0)
      .slice(0, 10)
      .map((m) => ({
        id: crypto.randomUUID(),
        label: m.label.slice(0, 160),
        hint: m.hint ? m.hint.slice(0, 200) : undefined,
        completed: false,
        // THEIA classifies each Wave during assessment; a Wave created (or added) without
        // ever being assessed still gets a real attribute via the same keyword heuristic
        // used by the 0-token path, so nothing is ever left unclassified.
        attribute: isAttribute(m.attribute) ? m.attribute : guessAttributeFromText(`${m.label} ${m.hint || ''}`, input.primaryAttribute),
      })),
    status: 'active',
    createdAt: new Date().toISOString(),
    targetDate: targetDate.toISOString(),
  };

  const gates = getGates();
  saveGates([gate, ...gates]);
  return gate;
};

/** Small, deliberately modest per-Wave payout — real feedback without letting a multi-Wave
 * Gate out-earn what the equivalent effort would pay through Daily Quests/To-Dos. Attribute
 * points land in the same hidden accumulatedPoints pool as everything else (see storage.ts),
 * only surfacing as a visible stat on the next level-up — same economy, not a separate one. */
const WAVE_XP_BY_RANK: Record<HunterRank, number> = { E: 15, D: 25, C: 40, B: 65, A: 100, S: 160 };
const WAVE_ATTR_POINTS_BY_RANK: Record<HunterRank, number> = { E: 1, D: 1, C: 1, B: 2, A: 2, S: 2 };

export interface WaveReward {
  xpAwarded: number;
  attribute: keyof Attributes;
  attributePoints: number;
  vitalsMessage: string;
}

const grantWaveReward = (gate: Gate, milestone: GateMilestone): WaveReward => {
  const xpAwarded = WAVE_XP_BY_RANK[gate.rank];
  const attributePoints = WAVE_ATTR_POINTS_BY_RANK[gate.rank];
  const attribute = milestone.attribute;

  // 'light' intensity — a single Wave is one step of a larger campaign, not a full workout;
  // the real cost already happened out in the world before this checkbox was clicked.
  const vitalsResult = PHYSICAL_ATTRIBUTES.includes(attribute)
    ? consumePhysicalEnergy(getUserProfile(), 'light')
    : consumeMentalEnergy(getUserProfile(), 'light');

  const withPoints = {
    ...vitalsResult.profile,
    accumulatedPoints: {
      ...vitalsResult.profile.accumulatedPoints,
      [attribute]: (vitalsResult.profile.accumulatedPoints[attribute] || 0) + attributePoints,
    },
  };
  saveUserProfile(addXP(withPoints, xpAwarded, 'general'));

  return { xpAwarded, attribute, attributePoints, vitalsMessage: vitalsResult.message };
};

export const toggleGateMilestone = (gateId: string, milestoneId: string): { gates: Gate[]; reward: WaveReward | null } => {
  const gates = getGates();
  const gate = gates.find((g) => g.id === gateId);
  const milestone = gate?.milestones.find((m) => m.id === milestoneId);
  if (!gate || !milestone) return { gates, reward: null };

  const completing = !milestone.completed;
  // Only ever pays out once per Wave — toggling off and back on cannot re-farm the reward.
  const shouldGrantReward = completing && !milestone.rewardsGranted;

  const updated = gates.map((g) => {
    if (g.id !== gateId) return g;
    return {
      ...g,
      milestones: g.milestones.map((m) =>
        m.id === milestoneId
          ? {
              ...m,
              completed: completing,
              completedAt: completing ? new Date().toISOString() : undefined,
              rewardsGranted: m.rewardsGranted || shouldGrantReward,
            }
          : m
      ),
    };
  });
  saveGates(updated);

  const reward = shouldGrantReward ? grantWaveReward(gate, milestone) : null;
  return { gates: updated, reward };
};

/** Records that a Wave was scheduled as a To-Do — GateDetail.tsx reconciles completion. */
export const linkGateMilestoneToTodo = (gateId: string, milestoneId: string, todoId: string): Gate[] => {
  const gates = getGates();
  const updated = gates.map((g) => {
    if (g.id !== gateId) return g;
    return {
      ...g,
      milestones: g.milestones.map((m) => (m.id === milestoneId ? { ...m, linkedTodoId: todoId } : m)),
    };
  });
  saveGates(updated);
  return updated;
};

/**
 * Phase 4: clearing a Gate drops something permanent, not just a number that vanishes into
 * a pool — a small permanent stat Blessing on the Gate's primary attribute, a re-selectable
 * Title named after the campaign itself, and an XP payout scaled to the Rank.
 */
const BLESSING_BY_RANK: Record<HunterRank, number> = { E: 1, D: 1, C: 2, B: 2, A: 3, S: 4 };
const XP_BY_RANK: Record<HunterRank, number> = { E: 150, D: 250, C: 400, B: 650, A: 1000, S: 1600 };
/** Varies the earned-title suffix by Rank so it isn't the same flat "X Conqueror" every time. */
const TITLE_SUFFIX_BY_RANK: Record<HunterRank, string> = {
  E: 'Initiate',
  D: 'Breaker',
  C: 'Conqueror',
  B: 'Vanquisher',
  A: 'Sovereign',
  S: 'Transcendent',
};

export interface GateClearReward {
  xpAwarded: number;
  blessingAttribute: keyof Attributes;
  blessingAmount: number;
  titleUnlocked: string;
}

export const clearGate = (gateId: string): { gates: Gate[]; reward: GateClearReward } | null => {
  const gates = getGates();
  const gate = gates.find((g) => g.id === gateId);
  if (!gate || gate.status === 'cleared') return null;

  const updated = gates.map((g) =>
    g.id === gateId ? { ...g, status: 'cleared' as GateStatus, clearedAt: new Date().toISOString() } : g
  );
  saveGates(updated);

  const blessingAmount = BLESSING_BY_RANK[gate.rank];
  const xpAwarded = XP_BY_RANK[gate.rank];
  const titleUnlocked = `${gate.title} ${TITLE_SUFFIX_BY_RANK[gate.rank]}`;

  const profile = getUserProfile();
  const blessedProfile = {
    ...profile,
    visibleStats: {
      ...profile.visibleStats,
      [gate.primaryAttribute]: (profile.visibleStats[gate.primaryAttribute] || 10) + blessingAmount,
    },
    unlockedTitles: [...(profile.unlockedTitles || []), titleUnlocked],
    title: titleUnlocked,
  };
  const finalProfile = addXP(blessedProfile, xpAwarded, 'general');
  saveUserProfile(finalProfile);

  return {
    gates: updated,
    reward: { xpAwarded, blessingAttribute: gate.primaryAttribute, blessingAmount, titleUnlocked },
  };
};

const BREACH_FATIGUE_PENALTY = 20;
/** A real, weeks-to-months-long commitment missed its deadline — rare enough, and weighty
 * enough, that a genuine HP cost belongs here rather than on daily friction. */
const BREACH_HP_PENALTY = 12;

/**
 * Phase 5: the clock. Call once per app load (Dashboard) rather than baking this into
 * getGates() itself, so a plain read never has side effects. Marks any active Gate whose
 * targetDate has passed as "breached" — a permanent mark on the record and a one-time
 * fatigue + HP nudge, but NOT a lock: a breached Gate can still be worked on and cleared
 * later, same as a dungeon break doesn't erase the dungeon.
 */
export const checkAndApplyGateBreaches = (): Gate[] => {
  const gates = getGates();
  const now = Date.now();
  const newlyBreached: Gate[] = [];

  const updated = gates.map((g) => {
    if (g.status === 'active' && new Date(g.targetDate).getTime() < now) {
      const breached: Gate = { ...g, status: 'breached', breachedAt: new Date().toISOString() };
      newlyBreached.push(breached);
      return breached;
    }
    return g;
  });

  if (newlyBreached.length === 0) return [];

  saveGates(updated);

  try {
    const profile = getUserProfile();
    const vitals = getHunterVitals(profile);
    const fatigue = Math.min(100, (profile.fatigue ?? 0) + BREACH_FATIGUE_PENALTY * newlyBreached.length);
    const hpFloor = Math.max(15, Math.floor(vitals.hp.max * 0.15));
    const hp = Math.max(hpFloor, vitals.hp.current - BREACH_HP_PENALTY * newlyBreached.length);
    saveUserProfile({ ...profile, fatigue, hp: { current: hp, max: vitals.hp.max } });
  } catch {
    // ignore — the breach record is what matters most; the fatigue/HP nudge is secondary
  }

  return newlyBreached;
};

/**
 * Gates cleared/breached within a given YYYY-MM (local calendar, matching getMonthlyRollup's
 * day boundary in storage.ts) — used by the Hunter Codex's monthly recap.
 */
export const getGateStatsForMonth = (monthKey: string): { cleared: Gate[]; breached: Gate[] } => {
  const gates = getGates();
  const inMonth = (iso?: string) => Boolean(iso) && getTodayKeyLocal(new Date(iso!)).slice(0, 7) === monthKey;
  return {
    cleared: gates.filter((g) => g.status === 'cleared' && inMonth(g.clearedAt)),
    breached: gates.filter((g) => inMonth(g.breachedAt)),
  };
};

export const deleteGate = (gateId: string): Gate[] => {
  const updated = getGates().filter((g) => g.id !== gateId);
  saveGates(updated);
  return updated;
};

export const RANK_ORDER: HunterRank[] = ['E', 'D', 'C', 'B', 'A', 'S'];

/**
 * Phase 2: THEIA assesses a drafted Gate instead of the player self-ranking it, and pushes
 * back on a vague Boss condition rather than silently accepting an un-clearable goal.
 * Same duality pattern as nutrition-lab.ts / codex.ts: an AI path plus a 0-token fallback.
 */
export type GateDuration = '<2w' | '2-4w' | '1-3m' | '3-6m' | '6-12m' | '12m+';

export const DURATION_LABELS: Record<GateDuration, string> = {
  '<2w': 'Under 2 weeks',
  '2-4w': '2-4 weeks',
  '1-3m': '1-3 months',
  '3-6m': '3-6 months',
  '6-12m': '6-12 months',
  '12m+': 'Over a year',
};

const DURATION_FALLBACK_RANK: Record<GateDuration, HunterRank> = {
  '<2w': 'E',
  '2-4w': 'D',
  '1-3m': 'C',
  '3-6m': 'B',
  '6-12m': 'A',
  '12m+': 'S',
};

export interface GateAssessmentInput {
  title: string;
  description: string;
  bossCondition: string;
  duration: GateDuration;
  /** Currently drafted waves (label only) — THEIA classifies each one's attribute in the
   * same order, rather than only the ones it suggests itself. */
  milestones?: Array<{ label: string }>;
}

export interface SuggestedMilestone {
  label: string;
  /** One concrete sentence on how to actually do it — not just a checkbox title. */
  hint: string;
  /** Which attribute this specific wave's activity trains — see GateMilestone.attribute. */
  attribute: keyof Attributes;
}

export interface GateAssessment {
  rank: HunterRank;
  rationale: string;
  /** THEIA's thematic rephrasing of the player's raw title (e.g. "backflip" -> "The Aerial
   * Reversal Trial") — applied automatically, never left as an opt-in suggestion. */
  refinedTitle?: string;
  bossConditionOk: boolean;
  bossConditionFeedback?: string;
  /** Always offered when the AI path runs, not just when bossConditionOk is false — a
   * concrete-but-clunky condition can still get a cleaner, more thematic phrasing. */
  refinedBossCondition?: string;
  /** Which attribute the Gate as a whole trains, read from its actual nature rather than
   * self-selected — applied automatically, same as refinedTitle. */
  primaryAttribute: keyof Attributes;
  /** Per-Wave attribute classification for the waves already drafted at assessment time,
   * same order as GateAssessmentInput.milestones. */
  existingWaveAttributes: Array<keyof Attributes>;
  suggestedMilestones: SuggestedMilestone[];
  origin: 'ai' | 'system';
}

const isRank = (v: unknown): v is HunterRank => typeof v === 'string' && RANK_ORDER.includes(v as HunterRank);

const buildFallbackAssessment = (input: GateAssessmentInput): GateAssessment => {
  const wordCount = input.bossCondition.trim().split(/\s+/).filter(Boolean).length;
  const bossConditionOk = wordCount >= 4;
  const primaryAttribute = guessAttributeFromText(`${input.title} ${input.description} ${input.bossCondition}`, 'STR');
  return {
    rank: DURATION_FALLBACK_RANK[input.duration] || 'C',
    rationale: `Precision estimate based on declared scope (${DURATION_LABELS[input.duration]}).`,
    bossConditionOk,
    bossConditionFeedback: bossConditionOk
      ? undefined
      : 'Too short to be a verifiable finish line — state exactly what "cleared" looks like.',
    primaryAttribute,
    existingWaveAttributes: (input.milestones || []).map((m) => guessAttributeFromText(m.label, primaryAttribute)),
    suggestedMilestones: [],
    origin: 'system',
  };
};

interface RawGateAssessment {
  rank?: string;
  rationale?: string;
  refinedTitle?: string;
  bossConditionOk?: boolean;
  bossConditionFeedback?: string;
  refinedBossCondition?: string;
  primaryAttribute?: string;
  existingWaveAttributes?: string[];
  suggestedMilestones?: Array<{ label?: string; hint?: string; attribute?: string }>;
}

const buildAssessmentPrompt = (input: GateAssessmentInput): string => {
  const existingWaves = (input.milestones || []).filter((m) => m.label.trim().length > 0);
  const existingWavesBlock =
    existingWaves.length > 0
      ? existingWaves.map((m, i) => `${i + 1}. "${m.label}"`).join('\n')
      : '(none drafted yet)';

  return `
Role: Solo Leveling System Analyst THEIA, assessing a Hunter's self-declared Gate (a personal real-life goal, not a dungeon).
Gate: "${input.title}"
Description: ${input.description || '(none provided)'}
Estimated duration: ${DURATION_LABELS[input.duration]}
Draft Boss Condition (the stated finish line): "${input.bossCondition}"
Existing draft waves (assign each one an attribute, in this exact order):
${existingWavesBlock}

Assess five things:
1. Rank (E, D, C, B, A, or S) based on scope/difficulty/duration — E is trivial/days, S is life-changing/1yr+.
2. A thematic rephrasing of the Gate's name in the System's voice — Hunters do not name their own Gates
   "backflip", the System designates them ("The Aerial Reversal Trial"). Keep it short (under 6 words),
   evocative, and clearly still about the same goal — do not invent a different goal.
3. Whether the Boss Condition is concrete and verifiable (not vague like "get better at X"), AND a
   cleaner, more thematic rephrasing of it regardless — even a concrete condition can read better.
4. primaryAttribute: which single attribute (STR, AGI, VIT, INT, PER, or WIS) the Gate as a whole
   trains, judged from its real nature — e.g. flips/sports/coordination is AGI, raw lifting/strength
   is STR, endurance/health/diet is VIT, study/language/coding is INT, social/public speaking is PER,
   discipline/mindfulness/habit-building is WIS.
5. For every existing draft wave listed above (same order, same count) AND for each of your 3-5
   suggested new waves, assign the single attribute that WAVE's specific activity trains — it can
   differ from the Gate's own primaryAttribute (e.g. a fitness Gate's "read about recovery science"
   wave trains INT, not STR). Each suggested wave also needs a short label AND one concrete sentence
   on how to actually do it (not another vague restatement). This is the whole point of the request —
   a Hunter should not open a Gate with nothing inside it.

Return ONLY valid JSON (no markdown):
{"rank":"C","rationale":"one clinical sentence in the System's voice","refinedTitle":"...","bossConditionOk":true,"bossConditionFeedback":"","refinedBossCondition":"...","primaryAttribute":"AGI","existingWaveAttributes":["AGI","STR"],"suggestedMilestones":[{"label":"...","hint":"...","attribute":"AGI"},{"label":"...","hint":"...","attribute":"VIT"}]}
`.trim();
};

export const assessGate = async (
  input: GateAssessmentInput,
  options?: { forceAlgorithmic?: boolean }
): Promise<GateAssessment> => {
  if (options?.forceAlgorithmic) {
    return buildFallbackAssessment(input);
  }

  try {
    const prompt = buildAssessmentPrompt(input);
    // thinkingBudget: 0 — this is a short structured judgment call, not a reasoning task;
    // see nutrition-lab.ts for why that matters (avoids truncated responses).
    const res = await aiGatewayClient.completeJson<RawGateAssessment>(prompt, {
      temperature: 0.4,
      maxTokens: 750,
      thinkingBudget: 0,
      providerOverride: 'lab',
    });

    if (!res || !isRank(res.rank) || !res.rationale) {
      throw new Error('Gate assessment response missing required fields');
    }

    const fallbackText = `${input.title} ${input.description} ${input.bossCondition}`;
    const primaryAttribute = isAttribute(res.primaryAttribute)
      ? res.primaryAttribute
      : guessAttributeFromText(fallbackText, 'STR');

    const existingWaves = (input.milestones || []).filter((m) => m.label.trim().length > 0);
    const existingWaveAttributes = existingWaves.map((m, i) => {
      const raw = res.existingWaveAttributes?.[i];
      return isAttribute(raw) ? raw : guessAttributeFromText(m.label, primaryAttribute);
    });

    return {
      rank: res.rank,
      rationale: String(res.rationale).slice(0, 300),
      refinedTitle: res.refinedTitle ? String(res.refinedTitle).trim().slice(0, 80) : undefined,
      bossConditionOk: Boolean(res.bossConditionOk),
      bossConditionFeedback: res.bossConditionFeedback ? String(res.bossConditionFeedback).slice(0, 300) : undefined,
      refinedBossCondition: res.refinedBossCondition ? String(res.refinedBossCondition).slice(0, 300) : undefined,
      primaryAttribute,
      existingWaveAttributes,
      suggestedMilestones: Array.isArray(res.suggestedMilestones)
        ? res.suggestedMilestones
            .map((m) => {
              const label = String(m?.label || '').trim();
              const hint = String(m?.hint || '').trim();
              return {
                label,
                hint,
                attribute: isAttribute(m?.attribute) ? (m!.attribute as keyof Attributes) : guessAttributeFromText(`${label} ${hint}`, primaryAttribute),
              };
            })
            .filter((m) => m.label.length > 0)
            .slice(0, 5)
        : [],
      origin: 'ai',
    };
  } catch (error) {
    console.warn('Gate assessment AI fallback to precision estimate:', error);
    return buildFallbackAssessment(input);
  }
};
