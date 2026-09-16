/**
 * THEIA chain-Gates — autonomous, continuous short Gates (3-6 days of content) that teach the
 * player a skill/subject/habit/technique, chained indefinitely: clear one, rest 1-3 days
 * (effort-based), THEIA spawns the next. Builds entirely on gates.ts's existing Gate/Wave/task
 * model via the optional `origin`/`chain*` fields added there — a chain-Gate IS a Gate, not a
 * parallel type, so it renders through the same GateDetail.tsx with no fork.
 *
 * Phase 1 scope (this file, initially): the data model + the sprint/cram date math, both fully
 * testable with zero AI dependency. THEIA generation (assessAndGenerateChainGate) and
 * autonomous spawning (spawnNextChainGateIfDue) land in Phase 2; report grading and real effort
 * scoring in Phase 3.
 */
import { aiGatewayClient } from '@/lib/ai-gateway-client';
import type { Gate, GateMilestone, GateTask, ChainEffortDay, GateClearReward, WaveReward } from '@/lib/gates';
import { getGates, saveGates, isAttribute, guessAttributeFromText, clearGate, toggleGateTask, RANK_ORDER } from '@/lib/gates';
import { getTodayKeyLocal, getUserProfile, saveUserProfile, getHunterRank } from '@/lib/storage';
import { getSkillLedger, addSkillLedgerEntry } from '@/lib/skill-ledger';
import { truncateCleanly } from '@/lib/text-utils';
import { generateQuizQuestions, assessFreeResponseAnswer } from '@/lib/knowledge-ai';
import type { Attributes, HunterRank, UserProfile, QuizQuestion, KnowledgeTopic } from '@/lib/types';

/** Fixed regardless of chainDurationDays — see the Gate.targetDate doc comment in gates.ts for
 * why this is deliberately NOT derived from the content length. */
const CHAIN_DEADLINE_DAYS = 7;

export interface CreateChainGateInput {
  title: string;
  description: string;
  bossCondition: string;
  rank: HunterRank;
  primaryAttribute: keyof Attributes;
  chainCategory: 'skill' | 'subject' | 'habit' | 'technique';
  /** One label per Wave/day — length determines chainDurationDays. 3-6 expected, not enforced
   * here (the caller — THEIA generation in Phase 2, or the Phase 1 manual trigger — owns that). */
  dayLabels: string[];
  chainId: string;
  chainIndex: number;
  /** See Gate.builtOnSkillId in gates.ts — the Ledger entry this Directive builds on, if any. */
  builtOnSkillId?: string;
}

const dayKeyToLocalDate = (key: string): Date => {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
};

export const createChainGate = (input: CreateChainGateInput): Gate => {
  const now = new Date();
  const deadline = new Date(now);
  deadline.setDate(deadline.getDate() + CHAIN_DEADLINE_DAYS);

  const milestones: GateMilestone[] = input.dayLabels.slice(0, 6).map((label, i) => ({
    id: crypto.randomUUID(),
    label: label.trim().slice(0, 160) || `Day ${i + 1}`,
    // Empty until this Wave becomes active — generateWaveTasks() (gates.ts) fills it in then,
    // exactly like a player-created Gate's Waves. Chain-specific task verification mode gets
    // set at generation time in Phase 2/3, not here.
    tasks: [],
    completed: false,
    attribute: isAttribute(input.primaryAttribute) ? input.primaryAttribute : 'WIS',
  }));

  const gate: Gate = {
    id: crypto.randomUUID(),
    title: input.title.trim().slice(0, 120) || 'Unnamed Directive',
    description: input.description.trim().slice(0, 800),
    rank: input.rank,
    bossCondition: input.bossCondition.trim().slice(0, 300),
    primaryAttribute: input.primaryAttribute,
    milestones,
    status: 'active',
    createdAt: now.toISOString(),
    targetDate: deadline.toISOString(),
    origin: 'theia-chain',
    chainCategory: input.chainCategory,
    chainDurationDays: milestones.length,
    chainId: input.chainId,
    chainIndex: input.chainIndex,
    effortLog: [],
    builtOnSkillId: input.builtOnSkillId,
  };

  const gates = getGates();
  saveGates([gate, ...gates]);
  return gate;
};

/** How many Waves are left to clear — the numerator in the sprint-mode comparison. */
export const getWavesRemaining = (gate: Gate): number =>
  gate.milestones.filter((m) => !m.completed).length;

/**
 * Calendar days left until the deadline, counting today as a full remaining day — matches the
 * two worked examples that pinned this formula down: today=day6/deadline=day7 -> 2 remaining;
 * today=day7 (last day) -> 1 remaining. Compares day-keys (local calendar days), not raw
 * timestamps, for the same reason isGateTaskUnlocked already does — a Gate created at 11pm
 * shouldn't have its deadline maths thrown off by time-of-day.
 */
export const getDaysRemainingUntilDeadline = (gate: Gate): number => {
  const todayKey = getTodayKeyLocal();
  const deadlineKey = getTodayKeyLocal(new Date(gate.targetDate));
  const diffDays = Math.round(
    (dayKeyToLocalDate(deadlineKey).getTime() - dayKeyToLocalDate(todayKey).getTime()) / 86_400_000
  );
  return Math.max(0, diffDays + 1);
};

/**
 * Sprint/cram mode: unlocks every task in the current Wave at once, bypassing the normal
 * one-task-per-day rule — but only once it's mathematically impossible to still finish at the
 * normal pace. Pure comparison, recomputed on every call, never stored — so it flips on/off
 * live as days pass, exactly matching the confirmed design ("genuinely can't clear it").
 */
export const isSprintMode = (gate: Gate): boolean => {
  if (gate.origin !== 'theia-chain' || gate.status !== 'active') return false;
  return getWavesRemaining(gate) > getDaysRemainingUntilDeadline(gate);
};

/**
 * The Wave-to-Wave equivalent of gates.ts's per-task day-gate, for chain-Gates specifically:
 * a Wave's tasks all unlock together (see isGateTaskUnlocked's `taskLevelDayGate` param), so
 * without this, nothing would stop the player clearing every Wave back-to-back the instant one
 * completes — undoing the "one Wave = one day" pacing entirely. The Wave at `index` is locked
 * until the calendar day changes since the previous Wave's completion. Bypassed during sprint
 * mode for the same reason sprint mode exists at all — once catching up at normal pace is
 * mathematically impossible, this gate would only make it worse.
 */
export const isChainWaveLocked = (gate: Gate, index: number): boolean => {
  if (index <= 0) return false;
  if (isSprintMode(gate)) return false;
  const prev = gate.milestones[index - 1];
  if (!prev?.completed || !prev.completedAt) return false;
  return getTodayKeyLocal() === getTodayKeyLocal(new Date(prev.completedAt));
};

/**
 * One day's engagement record, appended (not overwritten) so a Gate's effortLog reflects the
 * whole run once effort scoring lands in Phase 3. Safe to call multiple times same-day —
 * replaces that day's entry instead of duplicating it.
 */
export const recordChainEffortDay = (gate: Gate, engaged: boolean, qualityScore?: number): Gate => {
  const dateKey = getTodayKeyLocal();
  const log = (gate.effortLog || []).filter((d) => d.dateKey !== dateKey);
  const entry: ChainEffortDay = { dateKey, engaged, qualityScore };
  const updatedGate: Gate = { ...gate, effortLog: [...log, entry] };

  const gates = getGates();
  saveGates(gates.map((g) => (g.id === gate.id ? updatedGate : g)));
  return updatedGate;
};

// ---------------------------------------------------------------------------------------------
// Phase 2 — THEIA generation + autonomous spawn
// ---------------------------------------------------------------------------------------------

const isRank = (v: unknown): v is HunterRank => typeof v === 'string' && RANK_ORDER.includes(v as HunterRank);

type ChainCategory = 'skill' | 'subject' | 'habit' | 'technique';
const isChainCategory = (v: unknown): v is ChainCategory =>
  v === 'skill' || v === 'subject' || v === 'habit' || v === 'technique';

interface RawChainGateAssessment {
  title?: string;
  description?: string;
  bossCondition?: string;
  rank?: string;
  primaryAttribute?: string;
  category?: string;
  dayLabels?: string[];
  /** Exact name of an already-taught skill this directive builds on, if any — matched back
   * against the Skill Ledger by name in assessAndGenerateChainGate. Omitted/unmatched means a
   * new root skill, same as before this existed. */
  builtOnSkillName?: string;
}

/** Evergreen, attribute-varied templates covering all four categories — used only if the AI
 * call fails outright, so a chain never just silently stalls on a network hiccup. Deliberately
 * generic/short; the whole point of the AI path is a Gate tailored to the player and to what
 * the Skill Ledger says is still a real gap, which a hardcoded fallback can't do. For 'subject',
 * dayLabels double as each day's sub-topic (see chain-gates.ts's capstone quiz logic). */
const FALLBACK_CHAIN_TEMPLATES: Array<{
  title: string;
  bossCondition: string;
  attribute: keyof Attributes;
  category: ChainCategory;
  dayLabels: string[];
}> = [
  {
    title: 'Directive: Grip & Core Fundamentals',
    bossCondition: 'Complete every day\'s session and hold a 30-second plank on the final day.',
    attribute: 'STR',
    category: 'skill',
    dayLabels: ['Day 1: Dead hang practice', 'Day 2: Plank basics', 'Day 3: Combine both', 'Day 4: Test hold'],
  },
  {
    title: 'Directive: Cold Exposure Basics',
    bossCondition: 'Complete a full routine on the final day without stopping early.',
    attribute: 'VIT',
    category: 'habit',
    dayLabels: ['Day 1: Cold shower, 30s', 'Day 2: Extend to 60s', 'Day 3: Breathing technique', 'Day 4: Full routine'],
  },
  {
    title: 'Directive: One Real Conversation',
    bossCondition: 'Start a conversation with someone new and report what happened.',
    attribute: 'PER',
    category: 'technique',
    dayLabels: ['Day 1: Plan an opener', 'Day 2: Attempt it', 'Day 3: Reflect and adjust', 'Day 4: Try again'],
  },
  {
    title: 'Directive: Personal Finance Basics',
    bossCondition: 'Pass the final assessment covering every sub-topic studied this week.',
    attribute: 'INT',
    category: 'subject',
    dayLabels: ['Day 1: Budgeting basics', 'Day 2: Compound interest', 'Day 3: Emergency funds', 'Day 4: Final assessment'],
  },
];

const buildFallbackChainAssessment = (profile: UserProfile): RawChainGateAssessment & { rank: HunterRank } => {
  const template = FALLBACK_CHAIN_TEMPLATES[Math.floor(Math.random() * FALLBACK_CHAIN_TEMPLATES.length)];
  return {
    title: template.title,
    description: 'A short THEIA-assigned directive.',
    bossCondition: template.bossCondition,
    rank: getHunterRank(profile.level),
    primaryAttribute: template.attribute,
    category: template.category,
    dayLabels: template.dayLabels,
  };
};

const buildChainGatePrompt = (profile: UserProfile, alreadyTaught: string[]): string => {
  const taughtBlock = alreadyTaught.length > 0 ? alreadyTaught.join(', ') : '(nothing yet — this is the first one)';
  return `
Role: Solo Leveling System Analyst THEIA, autonomously assigning a Hunter's next short training
directive.

CRITICAL — READ CAREFULLY: the "Hunter"/"Rank"/"System" framing is just this app's visual theme.
The Hunter is a REAL PERSON and the directive must teach a REAL SKILL they could actually use in
their actual life. This is NOT a game quest and must contain ZERO fantasy or game mechanics —
no mana, spells, magic, dungeons, monsters, auras, elemental affinities, combat abilities, HP/MP,
or anything that only exists in a fictional power system. Every title, description, boss
condition, and day label must describe something a real human being can literally go and do.

GOOD examples (genuine real-life skills/subjects/habits/techniques): grip strength training,
basic first aid, cold exposure tolerance, active listening in conversation, budgeting/compound
interest, a cooking technique (knife skills, searing), touch-typing speed, public speaking,
sleep hygiene, a stretching/mobility routine, basic car maintenance, negotiation tactics,
journaling for reflection, a music theory or instrument basic, conversational phrases in a
language.
BAD examples — NEVER produce anything like these: "mana flow regulation," "channeling a spell,"
"mana shield," "sensing ambient mana," "elemental attunement," or any other fictional-power
content. If you catch yourself writing "mana," "spell," or "aura," stop and pick a real skill
instead.

Hunter Level: ${profile.level} (Rank ${getHunterRank(profile.level)})
Already taught in this chain — do NOT repeat one of these; prefer building on one of them if a
natural next step exists: ${taughtBlock}

Design ONE short directive for this Hunter over 3 to 6 days, scaled to their level (higher level
= more demanding/advanced within the real skill, but still concretely achievable in under a
week). Pick whichever category genuinely fits best:
- "skill": a practical, doable real-world action (a physical or hands-on skill)
- "subject": a real body of knowledge to research and be tested on (dayLabels are sub-topics —
  the final day must be a comprehensive assessment covering every sub-topic from the earlier days)
- "habit": something real to repeat/build consistency in
- "technique": a specific real method to practice and refine

If this directive is a natural next step from one specific skill already taught (from the list
above), set "builtOnSkillName" to that skill's EXACT name as listed — otherwise omit it entirely
(a new root skill, unconnected to anything earlier). Only set it when there's a real, specific
progression (e.g. "Grip & Core Fundamentals" -> "Weighted Carries"), not just a loose thematic
similarity — most directives should NOT set this.

Return ONLY valid JSON (no markdown):
{"title":"System-voiced short title for a REAL skill (no fantasy terms)","description":"one sentence on what this teaches and why","bossCondition":"one concrete, verifiable real-world finish line","rank":"E","primaryAttribute":"STR","category":"skill","dayLabels":["Day 1: ...","Day 2: ...","Day 3: ..."],"builtOnSkillName":""}

dayLabels must have between 3 and 6 entries, one per day, each a short concrete label for that
day's focus (not full instructions — those get generated separately once the Hunter reaches
that day). primaryAttribute must be one of STR, AGI, VIT, INT, PER, WIS.
`.trim();
};

/**
 * Generates one chain-Gate. Same duality as gates.ts's assessGate: a real THEIA call with a
 * local template fallback on any failure, so autonomous spawning never just silently does
 * nothing because of a network hiccup.
 */
export const assessAndGenerateChainGate = async (
  profile: UserProfile,
  chainId: string,
  chainIndex: number
): Promise<Gate> => {
  const ledger = getSkillLedger();
  const alreadyTaught = ledger.map((s) => s.name);

  let parsed: RawChainGateAssessment & { rank?: string };
  try {
    const prompt = buildChainGatePrompt(profile, alreadyTaught);
    // thinkingBudget: 0 — a short structured judgment call, not a reasoning task (same as
    // every other THEIA assessment call in this codebase).
    const res = await aiGatewayClient.completeJson<RawChainGateAssessment>(prompt, {
      temperature: 0.7,
      maxTokens: 500,
      thinkingBudget: 0,
      providerOverride: 'lab',
      // A 429's default backoff can wait 65s+ per retry — fine for a background call, but this
      // one blocks the Dashboard's "directive assigned" flow. Fail fast to the local template
      // fallback instead of leaving the player watching nothing happen for minutes.
      maxRetries: 1,
    });
    if (!res || !res.title || !res.bossCondition || !Array.isArray(res.dayLabels) || res.dayLabels.length < 3) {
      throw new Error('Chain-Gate assessment response missing required fields');
    }
    parsed = res;
  } catch {
    parsed = buildFallbackChainAssessment(profile);
  }

  const fallbackText = `${parsed.title} ${parsed.description || ''} ${parsed.bossCondition}`;
  const primaryAttribute = isAttribute(parsed.primaryAttribute)
    ? parsed.primaryAttribute
    : guessAttributeFromText(fallbackText, 'WIS');
  const rank = isRank(parsed.rank) ? parsed.rank : getHunterRank(profile.level);
  const chainCategory = isChainCategory(parsed.category) ? parsed.category : 'skill';
  // Matched by exact name against the Ledger THEIA was actually shown — an unmatched or
  // hallucinated name (or the fallback path, which never sets this at all) just means no
  // parent link, same as before this existed, never a hard failure.
  const builtOnSkillId = parsed.builtOnSkillName
    ? ledger.find((s) => s.name === parsed.builtOnSkillName)?.id
    : undefined;

  return createChainGate({
    title: parsed.title || 'Unnamed Directive',
    description: parsed.description || '',
    bossCondition: parsed.bossCondition || 'Complete every day of this directive.',
    rank,
    primaryAttribute,
    chainCategory,
    dayLabels: (parsed.dayLabels || []).slice(0, 6),
    builtOnSkillId,
    chainId,
    chainIndex,
  });
};

/**
 * Consistency (did the player engage most days) dominates; average report/quiz quality is the
 * secondary term — deliberately NOT speed-based, so finishing early doesn't game a better rest
 * window. With no graded reports yet (Phase 2, before Phase 3's report verification exists),
 * the quality term has nothing to average, so this degrades to pure consistency — a sane
 * placeholder that Phase 3 sharpens for real once reports start feeding qualityScore.
 */
export const computeChainEffortScore = (gate: Gate): number => {
  const days = gate.chainDurationDays || gate.milestones.length || 1;
  const log = gate.effortLog || [];
  const engagedCount = log.filter((d) => d.engaged).length;
  const consistency = Math.min(1, engagedCount / days);

  const qualityEntries = log.filter((d) => typeof d.qualityScore === 'number');
  const avgQuality =
    qualityEntries.length > 0
      ? qualityEntries.reduce((sum, d) => sum + (d.qualityScore || 0), 0) / qualityEntries.length
      : consistency * 100;

  return Math.round(0.6 * consistency * 100 + 0.4 * avgQuality);
};

export const getRestDaysForEffortScore = (score: number): number => {
  if (score >= 75) return 3;
  if (score >= 45) return 2;
  return 1;
};

/**
 * Clearing a chain-Gate wraps the normal clearGate() reward path with three chain-specific
 * effects: schedule the next spawn (effort-based rest window), free up activeChainId so the
 * next Gate in this chain can be generated, and record the taught skill in the Ledger so future
 * generations know not to repeat it.
 */
export const clearChainGate = (gateId: string): { gates: Gate[]; reward: GateClearReward } | null => {
  const gate = getGates().find((g) => g.id === gateId);
  if (!gate || gate.origin !== 'theia-chain') return null;

  const result = clearGate(gateId);
  if (!result) return null;

  const effortScore = computeChainEffortScore(gate);
  const restDays = getRestDaysForEffortScore(effortScore);
  const earliest = new Date();
  earliest.setDate(earliest.getDate() + restDays);

  const profile = getUserProfile();
  saveUserProfile({ ...profile, nextChainGateEarliestAt: earliest.toISOString() });

  addSkillLedgerEntry({
    name: gate.title,
    category: gate.chainCategory || 'skill',
    // Set at generation time (assessAndGenerateChainGate) when THEIA judged this a natural
    // next step from an already-taught skill — this is what makes the Skill Tree actually
    // branch instead of every entry landing as an unconnected root.
    parentIds: gate.builtOnSkillId ? [gate.builtOnSkillId] : [],
    taughtByChainGateId: gate.id,
    taughtByChainId: gate.chainId || '',
    proficiency: effortScore,
  });

  return result;
};

// The Dashboard effect that calls spawnNextChainGateIfDue() re-runs on every
// wrp:profile-updated/storage event, not just on mount — so a second call can start while the
// first is still mid-generation (a slow AI round trip). Both would read "no open chain-Gate yet"
// before either had actually written one, and both would create one — this is exactly what
// produced two simultaneous chain-Gates. Same class of race, same fix, as sync-manager.ts's
// currentSaveInFlight: later callers await whichever call is already running instead of racing
// their own check against it.
let spawnInFlight: Promise<Gate | null> | null = null;

/**
 * The autonomy entry point — called from Dashboard's existing profile-triggered effect (see
 * checkAndAssignPendingPenalty's call site for why AI-gateway-dependent side effects live
 * there, not inside storage.ts). No pause/opt-out: unconditional, same as the penalty check.
 * A breached-but-uncleared chain-Gate blocks the next spawn until the player deals with it late
 * — the chain stalling is itself part of the deliberate pressure, not a bug to work around.
 */
export const spawnNextChainGateIfDue = async (): Promise<Gate | null> => {
  if (spawnInFlight) return spawnInFlight;

  spawnInFlight = (async () => {
    try {
      const gates = getGates();
      const hasOpenChainGate = gates.some((g) => g.origin === 'theia-chain' && g.status !== 'cleared');
      if (hasOpenChainGate) return null;

      const profile = getUserProfile();
      if (profile.nextChainGateEarliestAt && new Date(profile.nextChainGateEarliestAt).getTime() > Date.now()) {
        return null;
      }

      const chainId = profile.activeChainId || crypto.randomUUID();
      const chainIndex = gates.filter((g) => g.chainId === chainId).length + 1;

      const gate = await assessAndGenerateChainGate(profile, chainId, chainIndex);

      saveUserProfile({ ...getUserProfile(), activeChainId: chainId, nextChainGateEarliestAt: undefined });

      return gate;
    } finally {
      spawnInFlight = null;
    }
  })();

  return spawnInFlight;
};

// ---------------------------------------------------------------------------------------------
// Phase 3 — report verification + real effort scoring
// ---------------------------------------------------------------------------------------------

export interface ChainReportAssessment {
  passed: boolean;
  feedback: string;
  /** 0-100 — how much real effort/specificity the report demonstrates, independent of pass/fail
   * (a thoughtful report on an easy task still scores well; a vague "did it" scores low even if
   * it passes). Feeds the Gate's effortLog -> computeChainEffortScore. */
  qualityScore: number;
}

interface RawChainReportAssessment {
  passed?: boolean;
  feedback?: string;
  qualityScore?: number;
}

/** 0-token fallback if the AI call fails outright — word count as a crude stand-in for "this
 * reads like a real, specific account" so a network hiccup never silently blocks progress on a
 * report the player genuinely put effort into. */
const buildFallbackChainReportAssessment = (reportText: string): ChainReportAssessment => {
  const wordCount = reportText.trim().split(/\s+/).filter(Boolean).length;
  const passed = wordCount >= 8;
  return {
    passed,
    feedback: passed
      ? 'Logged — System could not reach THEIA for a full read; accepted on length alone.'
      : 'Too brief to verify — describe what you actually did, not just that you did it.',
    qualityScore: passed ? 60 : 20,
  };
};

const buildChainReportPrompt = (gate: Gate, milestone: GateMilestone, task: GateTask, reportText: string): string => `
Role: Solo Leveling System Analyst THEIA, verifying a Hunter's real-world completion report for a
training directive task — not a dungeon or a Gate campaign.
Directive: "${gate.title}"
Today's checkpoint: "${milestone.label}"
Task: "${task.label}"
Hunter's report: "${reportText}"

Assess whether this report plausibly demonstrates the task was actually attempted — not outcome
quality (a genuine attempt that didn't go perfectly still passes), just whether it reads like a
real, specific account rather than a vague or fabricated one-liner.

Return ONLY valid JSON (no markdown):
{"passed":true,"feedback":"one short sentence in the System's voice","qualityScore":75}

qualityScore is 0-100: how much real effort/specificity the report shows, independent of whether
it passes.
`.trim();

/** Same duality pattern as assessSeal/assessGate: a real THEIA call with a local heuristic
 * fallback on any failure — see buildFallbackChainReportAssessment. This is the exact pattern
 * to replicate for grading player free text, not a new architecture. */
export const assessChainTaskReport = async (
  gate: Gate,
  milestone: GateMilestone,
  task: GateTask,
  reportText: string
): Promise<ChainReportAssessment> => {
  try {
    const prompt = buildChainReportPrompt(gate, milestone, task, reportText);
    const res = await aiGatewayClient.completeJson<RawChainReportAssessment>(prompt, {
      temperature: 0.3,
      maxTokens: 300,
      thinkingBudget: 0,
      providerOverride: 'lab',
      // The player is watching a "THEIA is verifying..." spinner for this one — fail fast to
      // the local fallback instead of the default 429 backoff, which can wait 65s+ per retry.
      maxRetries: 1,
    });

    if (!res || typeof res.passed !== 'boolean' || !res.feedback) {
      throw new Error('Chain task report assessment missing required fields');
    }

    return {
      passed: res.passed,
      feedback: truncateCleanly(String(res.feedback), 300),
      qualityScore:
        typeof res.qualityScore === 'number' ? Math.max(0, Math.min(100, res.qualityScore)) : res.passed ? 60 : 20,
    };
  } catch {
    return buildFallbackChainReportAssessment(reportText);
  }
};

const setChainTaskReport = (gateId: string, milestoneId: string, taskId: string, reportText: string, assessedEffort: number): void => {
  const gates = getGates();
  const updated = gates.map((g) => {
    if (g.id !== gateId) return g;
    return {
      ...g,
      milestones: g.milestones.map((m) =>
        m.id === milestoneId
          ? { ...m, tasks: m.tasks.map((t) => (t.id === taskId ? { ...t, reportText, assessedEffort } : t)) }
          : m
      ),
    };
  });
  saveGates(updated);
};

/**
 * The full report-submission flow for a 'report'-verified chain-Gate task: grade it, persist
 * the report + quality score on the task either way, log today's effort (so even a failed
 * attempt still counts toward consistency), and only actually complete the task (via the
 * existing toggleGateTask — same Wave-reward logic as every other Gate, untouched) if it passed.
 */
export const submitChainTaskReport = async (
  gate: Gate,
  milestone: GateMilestone,
  task: GateTask,
  reportText: string
): Promise<{ passed: boolean; feedback: string; reward: WaveReward | null }> => {
  const assessment = await assessChainTaskReport(gate, milestone, task, reportText);
  setChainTaskReport(gate.id, milestone.id, task.id, reportText, assessment.qualityScore);
  recordChainEffortDay(gate, true, assessment.qualityScore);

  if (!assessment.passed) {
    return { passed: false, feedback: assessment.feedback, reward: null };
  }

  const { reward } = toggleGateTask(gate.id, milestone.id, task.id);
  return { passed: true, feedback: assessment.feedback, reward };
};

// ---------------------------------------------------------------------------------------------
// Phase 4 — subject/quiz verification (capstone quiz on the final day)
// ---------------------------------------------------------------------------------------------

/**
 * Builds the quiz for one subject-category chain-Gate day. On the final Wave, this becomes a
 * capstone spanning every earlier day's sub-topic instead of just that day's — each Wave's own
 * `label` already IS its sub-topic (e.g. "Day 1: Budgeting basics", set at generation time in
 * assessAndGenerateChainGate), so no separate field is needed to track them.
 */
export const generateChainSubjectQuiz = async (gate: Gate, milestone: GateMilestone): Promise<QuizQuestion[]> => {
  const isCapstone = gate.milestones[gate.milestones.length - 1]?.id === milestone.id;
  const otherSubTopics = gate.milestones.filter((m) => m.id !== milestone.id).map((m) => m.label);

  // DifficultyRank and HunterRank share the exact same E/D/C/B/A/S value set, so the Gate's own
  // Rank doubles as the quiz's difficulty with no conversion needed.
  const topic: KnowledgeTopic = {
    category: 'THEIA Directive',
    title: gate.title,
    description: milestone.label,
    difficulty: gate.rank,
    researchPrompt: milestone.label,
    domain: 'science', // unused by buildQuizPrompt beyond typing — this isn't one of the fixed Lab domains
    generatedAt: new Date().toISOString(),
    lastTopicDate: getTodayKeyLocal(),
  };

  return generateQuizQuestions(topic, {
    questionCount: isCapstone ? 6 : 3,
    includeFreeResponse: true,
    additionalContext: isCapstone
      ? `This is the FINAL day — a comprehensive assessment covering every sub-topic studied this week: ${otherSubTopics.join('; ')}.`
      : undefined,
  });
};

/**
 * Grades a full quiz submission: multiple_choice/true_false via string equality (same as the
 * standalone Knowledge Lab), free_response via THEIA (assessFreeResponseAnswer). Reuses
 * setChainTaskReport (Phase 3) to persist a summary + quality score on the task — a quiz
 * result is conceptually the same "graded submission" shape as a written report, just produced
 * differently, so no new task fields are needed.
 */
export const submitChainQuizAnswers = async (
  gate: Gate,
  milestone: GateMilestone,
  task: GateTask,
  quiz: QuizQuestion[],
  answers: (string | null)[]
): Promise<{ passed: boolean; correctCount: number; total: number; reward: WaveReward | null }> => {
  let correctCount = 0;
  for (let i = 0; i < quiz.length; i++) {
    const question = quiz[i];
    const userAnswer = answers[i] || '';
    const isCorrect =
      question.type === 'free_response'
        ? (await assessFreeResponseAnswer(question, userAnswer)).correct
        : userAnswer === question.correctAnswer;
    if (isCorrect) correctCount++;
  }

  const qualityScore = Math.round((correctCount / quiz.length) * 100);
  const passed = qualityScore >= 60;

  setChainTaskReport(gate.id, milestone.id, task.id, `Quiz: ${correctCount}/${quiz.length} correct.`, qualityScore);
  recordChainEffortDay(gate, true, qualityScore);

  if (!passed) {
    return { passed: false, correctCount, total: quiz.length, reward: null };
  }

  const { reward } = toggleGateTask(gate.id, milestone.id, task.id);
  return { passed: true, correctCount, total: quiz.length, reward };
};
