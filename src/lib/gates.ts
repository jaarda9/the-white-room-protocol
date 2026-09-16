/**
 * Gates — player-declared mid/long-term real-life goals (weeks to months), distinct from
 * Daily Quests (reset every day) and To-Dos (single tasks due one day). Phase 1: manual
 * creation + a milestone checklist + clearing. Later phases layer on THEIA-assessed Rank,
 * rank-gated access, loot on clear, and a real deadline/Breach consequence.
 */
import { aiGatewayClient } from '@/lib/ai-gateway-client';
import { getEquippedTitleEffect } from '@/lib/titles';
import {
  getUserProfile,
  saveUserProfile,
  addXP,
  getTodayKeyLocal,
  getHunterVitals,
  consumePhysicalEnergy,
  consumeMentalEnergy,
  addToDo,
  getToDos,
  saveToDos,
  rescheduleToDoToToday,
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

export const guessAttributeFromText = (text: string, fallback: keyof Attributes): keyof Attributes => {
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

export interface GateTask {
  id: string;
  label: string;
  completed: boolean;
  completedAt?: string;
  /** A To-Do this task was scheduled as, so it shows up in the daily flow instead of only
   * living on this page. Completing that To-Do auto-completes this task (see GateDetail.tsx). */
  linkedTodoId?: string;
  /** How this task gets marked done — undefined/'checkbox' is today's behavior for every
   * player-created Gate. 'report'/'quiz' are chain-Gate-only (see chain-gates.ts): a written
   * report THEIA grades, or a quiz question, replacing a bare self-reported checkbox. */
  verification?: 'checkbox' | 'report' | 'quiz';
  /** The player's written submission, for verification: 'report' tasks. */
  reportText?: string;
  /** 0-100 — THEIA's read on this task's report/quiz quality, feeding the Gate's effortLog. */
  assessedEffort?: number;
}

export interface GateMilestone {
  id: string;
  label: string;
  /** A short overview line for the checkpoint as a whole — from THEIA's suggestion, or left
   * blank for a manual Wave. The day-to-day "how" now lives in tasks below. */
  hint?: string;
  /** Derived, not directly toggled — true once every task is completed (see
   * completeGateTask()). A Wave is a checkpoint; tasks are the real unit of work. Always
   * non-empty once reached: generated the moment this Wave becomes the active one (see
   * generateWaveTasks() in GateDetail.tsx) — never left permanently un-broken-down. */
  tasks: GateTask[];
  completed: boolean;
  completedAt?: string;
  /** Which attribute this specific Wave's activity trains — THEIA-classified at assessment
   * time (or heuristically guessed if the Gate was never assessed), independent of the
   * Gate's own primaryAttribute. A "read about nutrition" Wave inside a fitness Gate trains
   * INT, not STR. Drives the small hidden attribute-point reward on completion. */
  attribute: keyof Attributes;
  /** Set the first time this Wave's completion reward is paid out — prevents farming XP/points
   * by completing/uncompleting its tasks repeatedly. */
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
  /** Derived from the declared duration estimate at creation — the Gate's clock. Player-created
   * Gates: createdAt + DURATION_DAYS[duration]. THEIA chain-Gates: always createdAt + 7 calendar
   * days flat, regardless of chainDurationDays (see chain-gates.ts). */
  targetDate: string;
  clearedAt?: string;
  breachedAt?: string;
  /** undefined/'player' = today's behavior (manually created via GateCreationModal). THEIA
   * autonomously spawns 'theia-chain' Gates — see chain-gates.ts. Every existing Gate-processing
   * function ignores this field and keeps working unchanged for both kinds. */
  origin?: 'player' | 'theia-chain';
  /** theia-chain only: what this Gate is teaching — do (skill), learn (subject), repeat
   * (habit), or practice (technique). Drives which verification mode its tasks use. */
  chainCategory?: 'skill' | 'subject' | 'habit' | 'technique';
  /** theia-chain only: THEIA-assessed content length in days (3-6) — one Wave per day. Not the
   * same as the Gate's deadline, which is always a flat 7 days regardless of this number. */
  chainDurationDays?: number;
  /** theia-chain only: stable across the whole ongoing chain (many Gates over time), distinct
   * from this Gate instance's own id. */
  chainId?: string;
  /** theia-chain only: 1st/2nd/3rd... Gate in this chain. */
  chainIndex?: number;
  /** theia-chain only: per-day engagement/quality signal feeding the effort-based rest-days
   * calculation on clear (see chain-gates.ts's computeChainEffortScore). */
  effortLog?: ChainEffortDay[];
  /** theia-chain only: the Skill Ledger entry (skill-ledger.ts) this Directive's generation
   * chose to build on, if THEIA judged one to be a natural prerequisite — set at generation
   * time (assessAndGenerateChainGate), read back at clear time (clearChainGate) to give the new
   * Ledger entry a real `parentIds` link instead of always landing as an unconnected root. */
  builtOnSkillId?: string;
}

/** One day's engagement record inside a chain-Gate's effortLog. `engaged` alone (no report/quiz
 * that day) still counts toward the consistency term of the effort score; `qualityScore` only
 * exists on days where a report or quiz was actually graded. */
export interface ChainEffortDay {
  dateKey: string;
  engaged: boolean;
  qualityScore?: number;
}

/** Backward-compat migration: Gates created before per-Wave tasks existed have milestones
 * with no `tasks` field at all — every `.map`/`.length`/`.findIndex` on that throws. Applied
 * on every read so nothing downstream (Dashboard, GateDetail, codex.ts, ...) ever has to
 * special-case an old-shape Gate. */
let gatesMigrated = false;
const normalizeGate = (raw: any): Gate => {
  const milestones = Array.isArray(raw?.milestones) ? raw.milestones : [];
  const fallbackAttr = isAttribute(raw?.primaryAttribute) ? raw.primaryAttribute : 'STR';
  return {
    ...raw,
    milestones: milestones.map((m: any) => {
      if (Array.isArray(m?.tasks)) return m;
      gatesMigrated = true;
      return {
        ...m,
        tasks: [],
        attribute: isAttribute(m?.attribute) ? m.attribute : guessAttributeFromText(`${m?.label || ''} ${m?.hint || ''}`, fallbackAttr),
      };
    }),
  };
};

export const getGates = (): Gate[] => {
  try {
    const raw = localStorage.getItem(GATES_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed)) return [];

    gatesMigrated = false;
    const normalized = parsed.map(normalizeGate);
    if (gatesMigrated) {
      // Persist the migrated shape so this doesn't need re-normalizing (or re-triggering a
      // save) on every subsequent read — a one-time, silent upgrade.
      try {
        localStorage.setItem(GATES_KEY, JSON.stringify(normalized));
      } catch {
        // ignore — the in-memory normalized copy below is still correct for this session
      }
    }
    return normalized;
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
        // Empty until this Wave becomes the active one — generateWaveTasks() fills it in then
        // (see GateDetail.tsx). Every Wave gets tasks eventually, just not all at once.
        tasks: [],
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
  const attributePoints = WAVE_ATTR_POINTS_BY_RANK[gate.rank];
  const attribute = milestone.attribute;

  // 'light' intensity — a single Wave is one step of a larger campaign, not a full workout;
  // the real cost already happened out in the world before this checkbox was clicked.
  const vitalsResult = PHYSICAL_ATTRIBUTES.includes(attribute)
    ? consumePhysicalEnergy(getUserProfile(), 'light')
    : consumeMentalEnergy(getUserProfile(), 'light');

  // Title Effect: Dungeon Conqueror boosts XP specifically from Wave clears — see titles.ts.
  const waveXpMultiplier = getEquippedTitleEffect(vitalsResult.profile.title).gateWaveXpMultiplier ?? 1;
  const xpAwarded = Math.round(WAVE_XP_BY_RANK[gate.rank] * waveXpMultiplier);

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

/**
 * Toggles one task inside a Wave. A Wave's own `completed` is derived here, not set directly
 * — the moment every task in it is done, the Wave clears and its (one-time) reward pays out;
 * un-completing a task afterward un-clears the Wave display but never claws back a reward
 * already granted (rewardsGranted stays true).
 */
export const toggleGateTask = (
  gateId: string,
  milestoneId: string,
  taskId: string
): { gates: Gate[]; reward: WaveReward | null } => {
  const gates = getGates();
  const gate = gates.find((g) => g.id === gateId);
  const milestone = gate?.milestones.find((m) => m.id === milestoneId);
  const task = milestone?.tasks.find((t) => t.id === taskId);
  if (!gate || !milestone || !task) return { gates, reward: null };

  const completingTask = !task.completed;
  const newTasks = milestone.tasks.map((t) =>
    t.id === taskId
      ? { ...t, completed: completingTask, completedAt: completingTask ? new Date().toISOString() : undefined }
      : t
  );
  const waveNowComplete = newTasks.length > 0 && newTasks.every((t) => t.completed);
  // Only ever pays out once per Wave, on the transition into fully-complete — toggling tasks
  // back and forth afterward cannot re-farm it.
  const shouldGrantReward = waveNowComplete && !milestone.completed && !milestone.rewardsGranted;

  const updatedMilestone: GateMilestone = {
    ...milestone,
    tasks: newTasks,
    completed: waveNowComplete,
    completedAt: waveNowComplete ? new Date().toISOString() : undefined,
    rewardsGranted: milestone.rewardsGranted || shouldGrantReward,
  };

  const updated = gates.map((g) =>
    g.id !== gateId
      ? g
      : { ...g, milestones: g.milestones.map((m) => (m.id === milestoneId ? updatedMilestone : m)) }
  );
  saveGates(updated);

  const reward = shouldGrantReward ? grantWaveReward(gate, updatedMilestone) : null;
  return { gates: updated, reward };
};

/**
 * A task is unlocked the moment it becomes the Wave's active one: instantly if it's the
 * first task, or starting the calendar day AFTER the previous task's completion — never the
 * same day, so clearing "Day 1" can't immediately cascade into "Day 2" in one sitting (the
 * same anti-speedrun reasoning as the Wave-level sequential reveal, one layer deeper). A
 * skipped/incomplete task never force-advances — it just stays active indefinitely.
 *
 * This day-boundary rule assumes a Wave is meant to span several real days — true for a
 * player-created Gate (weeks to months), but NOT for a theia-chain Gate, where a whole Wave IS
 * one day and its 3-5 generated tasks are meant to be that day's checklist, done together (see
 * chain-gates.ts's isChainWaveLocked, which adds an equivalent day-gate between Waves instead).
 * Applying this same per-task gate to a chain-Gate's multi-task Wave would silently stretch one
 * "day" across several real days before the next Wave could even start — undermining the whole
 * point of the fixed 7-day deadline. `taskLevelDayGate` lets chain-Gates opt out of it.
 *
 * @param sprintMode theia-chain only (see chain-gates.ts's isSprintMode) — when true, every
 * task in the Wave is unlocked regardless of the day-boundary rule below. Activates only once
 * it's mathematically impossible to still finish at the normal one-task-per-day pace before the
 * chain-Gate's deadline. Omitted/false preserves today's exact behavior for every player-created
 * Gate — zero regression risk.
 * @param taskLevelDayGate theia-chain Gates pass false — every task in the active Wave is then
 * unlocked together instead of one-per-day. Defaults to true (today's exact behavior) for every
 * player-created Gate.
 */
export const isGateTaskUnlocked = (
  tasks: GateTask[],
  index: number,
  sprintMode = false,
  taskLevelDayGate = true
): boolean => {
  if (index <= 0) return true;
  if (sprintMode) return true;
  if (!taskLevelDayGate) return true;
  const prev = tasks[index - 1];
  if (!prev.completed || !prev.completedAt) return false;
  return getTodayKeyLocal() !== getTodayKeyLocal(new Date(prev.completedAt));
};

export interface UnlockedGateTask {
  gate: Gate;
  milestone: GateMilestone;
  task: GateTask;
}

/**
 * Keeps each active Gate's current task's To-Do fresh: creates it the instant a task
 * unlocks (no manual "schedule" step), and rolls its due date forward to today each day it
 * stays incomplete so a skipped task never silently falls out of Tactical To-Dos. Idempotent
 * — safe to call from both Dashboard.tsx (once per app load, for daily-flow visibility) and
 * GateDetail.tsx (on its own mount, for a direct visit before Dashboard ever ran it).
 */
/**
 * Schedules every currently-unlocked, incomplete task of the active Wave as a Tactical To-Do —
 * for a player-created Gate that's still just the single next task (day-gated one at a time),
 * but for a chain-Gate ALL of the Wave's tasks at once, since they're all meant to be that day's
 * checklist (see isGateTaskUnlocked's taskLevelDayGate param). Report/quiz-verified tasks are
 * scheduled too now (so they're visible in the daily list, per player feedback), but their
 * linked To-Do can't actually be checked off directly — SoloDailyQuestWindow.tsx's
 * handleToggleTodo intercepts and redirects to the Gate page instead, so this never reopens the
 * "tick the checkbox to skip THEIA's grading" exploit.
 */
export const syncActiveGateTasks = (): UnlockedGateTask[] => {
  const gates = getGates();
  const today = getTodayKeyLocal();
  const newlyUnlocked: UnlockedGateTask[] = [];
  let anyChange = false;

  const updated = gates.map((g) => {
    if (g.status === 'cleared') return g;
    const activeMilestone = g.milestones.find((m) => !m.completed);
    if (!activeMilestone || activeMilestone.tasks.length === 0) return g;

    const taskLevelDayGate = g.origin !== 'theia-chain';
    let milestoneChanged = false;

    const newTasks = activeMilestone.tasks.map((task, index) => {
      if (task.completed) return task;
      if (!isGateTaskUnlocked(activeMilestone.tasks, index, false, taskLevelDayGate)) return task;

      if (!task.linkedTodoId) {
        const todo = addToDo({ title: task.label, dueDate: today, origin: 'user', xp: 10, hiddenRewards: {} });
        anyChange = true;
        milestoneChanged = true;
        newlyUnlocked.push({ gate: g, milestone: activeMilestone, task });
        return { ...task, linkedTodoId: todo.id };
      }

      // Already scheduled — roll it forward if it fell behind (a skipped day).
      const linkedTodo = getToDos().find((t) => t.id === task.linkedTodoId);
      if (linkedTodo && linkedTodo.status === 'active' && linkedTodo.dueDate !== today) {
        rescheduleToDoToToday(linkedTodo.id);
      }
      return task;
    });

    if (!milestoneChanged) return g;
    return {
      ...g,
      milestones: g.milestones.map((m) => (m.id === activeMilestone.id ? { ...m, tasks: newTasks } : m)),
    };
  });

  if (anyChange) saveGates(updated);
  return newlyUnlocked;
};

/** Reverse lookup for a To-Do's originating Gate task — used by SoloDailyQuestWindow.tsx to
 * intercept a checkbox click on a report/quiz-verified task before it can bypass grading. */
export const findGateTaskByLinkedTodoId = (
  todoId: string
): { gate: Gate; milestone: GateMilestone; task: GateTask } | null => {
  for (const gate of getGates()) {
    for (const milestone of gate.milestones) {
      const task = milestone.tasks.find((t) => t.linkedTodoId === todoId);
      if (task) return { gate, milestone, task };
    }
  }
  return null;
};

/** Persists THEIA's (or the 0-token fallback's) generated tasks onto a Wave the first time
 * it becomes the active one — see generateWaveTasks() and GateDetail.tsx. */
export const setWaveTasks = (gateId: string, milestoneId: string, tasks: GateTask[]): Gate[] => {
  const gates = getGates();
  const updated = gates.map((g) =>
    g.id !== gateId
      ? g
      : { ...g, milestones: g.milestones.map((m) => (m.id === milestoneId ? { ...m, tasks } : m)) }
  );
  saveGates(updated);
  return updated;
};

/** Records that a task was scheduled as a To-Do — GateDetail.tsx reconciles completion. */
export const linkGateTaskToTodo = (gateId: string, milestoneId: string, taskId: string, todoId: string): Gate[] => {
  const gates = getGates();
  const updated = gates.map((g) => {
    if (g.id !== gateId) return g;
    return {
      ...g,
      milestones: g.milestones.map((m) =>
        m.id === milestoneId
          ? { ...m, tasks: m.tasks.map((t) => (t.id === taskId ? { ...t, linkedTodoId: todoId } : t)) }
          : m
      ),
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

  const profile = getUserProfile();
  // Title Effect: Demon Slayer adds a bonus point on top of the Blessing — checked against
  // whatever title is equipped right now, before this clear overwrites it below. See titles.ts.
  const demonSlayerBonus = getEquippedTitleEffect(profile.title).gateClearBonusAttributePoint ?? 0;
  const blessingAmount = BLESSING_BY_RANK[gate.rank] + demonSlayerBonus;
  const xpAwarded = XP_BY_RANK[gate.rank];
  const titleUnlocked = `${gate.title} ${TITLE_SUFFIX_BY_RANK[gate.rank]}`;

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
  const gate = getGates().find((g) => g.id === gateId);
  const updated = getGates().filter((g) => g.id !== gateId);
  saveGates(updated);

  // Any task scheduled as a real To-Do (see syncActiveGateTasks) would otherwise orphan there
  // forever — nothing left to ever mark it complete "properly," and nothing left to reconcile
  // it against once the Gate it belonged to is gone.
  const linkedTodoIds = new Set(
    (gate?.milestones || []).flatMap((m) => m.tasks.map((t) => t.linkedTodoId).filter((id): id is string => Boolean(id)))
  );
  if (linkedTodoIds.size > 0) {
    saveToDos(getToDos().filter((t) => !linkedTodoIds.has(t.id)));
  }

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

/** How many Wave checkpoints actually make sense across a Gate's declared timeline — a
 * 6-12 month Gate with 4 checkpoints total is far too sparse; each checkpoint gets its own
 * lazily-generated task list now, so this stays modest even for long Gates. */
const WAVE_COUNT_GUIDE_BY_DURATION: Record<GateDuration, string> = {
  '<2w': '3-4 waves',
  '2-4w': '3-4 waves',
  '1-3m': '4-5 waves',
  '3-6m': '5-6 waves',
  '6-12m': '6-7 waves',
  '12m+': '7-8 waves',
};

const buildAssessmentPrompt = (input: GateAssessmentInput): string => {
  const existingWaves = (input.milestones || []).filter((m) => m.label.trim().length > 0);
  const existingWavesBlock =
    existingWaves.length > 0
      ? existingWaves.map((m, i) => `${i + 1}. "${m.label}"`).join('\n')
      : '(none drafted yet)';
  const waveCountGuide = WAVE_COUNT_GUIDE_BY_DURATION[input.duration] || '4-5 waves';

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
5. For every existing draft wave listed above (same order, same count) AND for each of your suggested
   new waves — aim for the existing waves plus enough new ones to reach roughly ${waveCountGuide} total,
   spaced sensibly across the full ${DURATION_LABELS[input.duration]} timeline, not clustered at the
   start — assign the single attribute that WAVE's specific activity trains, which can differ from the
   Gate's own primaryAttribute (e.g. a fitness Gate's "read about recovery science" wave trains INT,
   not STR). Each suggested wave also needs a short label AND one concrete overview sentence of what
   this checkpoint covers (day-to-day tasks are generated separately, later, once the Hunter actually
   reaches each wave — this is just the checkpoint itself). This is the whole point of the request — a
   Hunter should not open a Gate with too few checkpoints to actually track a long campaign.

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
      maxTokens: 1000,
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
            .slice(0, 8)
        : [],
      origin: 'ai',
    };
  } catch (error) {
    console.warn('Gate assessment AI fallback to precision estimate:', error);
    return buildFallbackAssessment(input);
  }
};

interface RawWaveTasks {
  tasks?: string[];
}

const buildWaveTasksPrompt = (gate: Gate, milestone: GateMilestone): string => `
Role: Solo Leveling System Analyst THEIA, breaking one Wave (checkpoint) of an active Gate down
into concrete day-to-day tasks, now that the Hunter has actually reached it.
Gate: "${gate.title}" (Rank ${gate.rank}) — Boss Condition: "${gate.bossCondition}"
Current Wave: "${milestone.label}"${milestone.hint ? ` — ${milestone.hint}` : ''}

Break this ONE Wave down into 3-5 concrete, real-world tasks a Hunter can schedule on individual
days — each a specific, checkable action (not another vague restatement of the Wave itself),
sequenced so completing all of them clears this checkpoint.
${
  gate.origin === 'theia-chain'
    ? `\nThis is an autonomously-assigned real-life directive, not a game quest — the "Hunter"/
"System" framing is just this app's visual theme. Every task must be something a real person can
literally go and do. ZERO fantasy or game mechanics — no mana, spells, magic, auras, elemental
attunement, or anything from a fictional power system, even if the Gate/Wave name above sounds
game-like. If a task would only make sense inside a fantasy world, replace it with the closest
real-world equivalent action instead.\n`
    : ''
}
Return ONLY valid JSON (no markdown): {"tasks":["...","...","..."]}
`.trim();

/** theia-chain skill/habit/technique tasks are 'report'-verified (see chain-gates.ts's
 * submitChainTaskReport); subject tasks are 'quiz'-verified (see chain-gates.ts's
 * submitChainQuizAnswers) instead of a bare self-reported checkbox. Every player-created Gate
 * keeps today's plain checkbox behavior. */
const verificationForGate = (gate: Gate): GateTask['verification'] => {
  if (gate.origin !== 'theia-chain') return undefined;
  return gate.chainCategory === 'subject' ? 'quiz' : 'report';
};

const buildFallbackWaveTasks = (gate: Gate, milestone: GateMilestone): GateTask[] =>
  ['Session 1', 'Session 2', 'Final check'].map((label) => ({
    id: crypto.randomUUID(),
    label: `${label}: ${milestone.label}`,
    completed: false,
    verification: verificationForGate(gate),
  }));

/**
 * Generates a Wave's task breakdown — called once, the moment a Wave becomes the active one
 * (see GateDetail.tsx), never all up front at Gate creation. Same AI + 0-token duality as
 * assessGate(): the System always produces something usable, LLM or not.
 */
export const generateWaveTasks = async (
  gate: Gate,
  milestone: GateMilestone,
  options?: { forceAlgorithmic?: boolean }
): Promise<GateTask[]> => {
  // Subject chain-Gates culminate in ONE quiz per day (see chain-gates.ts's
  // generateChainSubjectQuiz/submitChainQuizAnswers) — breaking the Wave into 3-5 generic tasks
  // like every other Gate would mean 3-5 separately-generated quizzes for the same sub-topic,
  // which is redundant and confusing rather than "one assessment per day." No AI call needed
  // here at all; the single task's own label is just the day's sub-topic (already in
  // milestone.label), and the quiz itself is generated lazily when the player starts it.
  if (gate.origin === 'theia-chain' && gate.chainCategory === 'subject') {
    return [
      {
        id: crypto.randomUUID(),
        label: `Research & assessment: ${milestone.label}`,
        completed: false,
        verification: 'quiz',
      },
    ];
  }

  if (options?.forceAlgorithmic) {
    return buildFallbackWaveTasks(gate, milestone);
  }

  try {
    const res = await aiGatewayClient.completeJson<RawWaveTasks>(buildWaveTasksPrompt(gate, milestone), {
      temperature: 0.6,
      maxTokens: 350,
      thinkingBudget: 0,
      providerOverride: 'lab',
    });
    const labels = Array.isArray(res?.tasks)
      ? res!.tasks
          .map((t) => String(t || '').trim().slice(0, 200))
          .filter((t) => t.length > 0)
          .slice(0, 5)
      : [];
    if (labels.length === 0) throw new Error('Wave task generation returned nothing usable');
    return labels.map((label) => ({
      id: crypto.randomUUID(),
      label,
      completed: false,
      verification: verificationForGate(gate),
    }));
  } catch (error) {
    console.warn('Wave task generation AI fallback to generic sessions:', error);
    return buildFallbackWaveTasks(gate, milestone);
  }
};
