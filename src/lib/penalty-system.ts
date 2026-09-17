/**
 * Penalty Quests — replaces the old flat -25 HP hit for a missed mandatory day with an
 * actual System-assigned consequence, matching how the anime's System punishes Sung Jinwoo
 * (a real, timed ordeal, not a stat tax). A single miss assigns one Penalty Quest; a streak
 * of PENALTY_DETOX_STREAK_THRESHOLD or more consecutive misses escalates it into a bigger,
 * multi-task Detox Protocol. Both block the Daily Quest HUD until cleared (see
 * SoloDailyQuestWindow.tsx) and apply a debuff (reduced XP, capped rest recovery) in the
 * meantime — lifted immediately on completion, not just at the next day boundary.
 *
 * Same AI + 0-token duality pattern as nutrition-lab.ts / gates.ts: the System always
 * assigns something, LLM or not.
 */
import { aiGatewayClient } from '@/lib/ai-gateway-client';
import { getUserProfile, saveUserProfile, getHunterRank, PENDING_PENALTY_ASSIGNMENT_KEY } from '@/lib/storage';
import { truncateCleanly } from '@/lib/text-utils';
import type { HunterRank, PenaltyQuest, PenaltyTask, UserProfile } from '@/lib/types';

export const ACTIVE_PENALTY_KEY = 'wrp_active_penalty_quest';
/** A second penalty that arrived while one was already active/blocking doesn't get dropped — it
 * waits here and gets promoted the moment the active one clears (see completePenaltyTask). This
 * is what actually keeps the 'daily' and 'seal' sources independent: each generates its own
 * quest on its own trigger, with its own difficulty scaling, and neither one silently overwrites
 * or cancels the other just because of unlucky timing. */
export const PENDING_PENALTY_QUEUE_KEY = 'wrp_pending_penalty_queue';
export const PENALTY_UPDATED_EVENT = 'wrp:penalty-updated';
/** Timestamp of the last fully-completed Penalty Quest — see restoreGenerationKeysFromSyncBlob
 * (synced-localstorage-keys.ts) for why this exists: ACTIVE_PENALTY_KEY syncs via a raw,
 * unconditional overwrite with no staleness check, so completing a quest locally and then
 * pulling before that completion has reached the server would otherwise paste the old,
 * pre-completion quest right back — reappearing even though it was just finished. The same
 * timestamp also filters PENDING_PENALTY_QUEUE_KEY on restore for the identical reason. */
export const PENALTY_LAST_CLEARED_AT_KEY = 'wrp_penalty_last_cleared_at';

/** Consecutive misses before a plain Penalty Quest escalates into the bigger Detox Protocol —
 * 'daily' source only; a Seal slip never escalates this way (see assignPenaltyForSealSlip). */
export const PENALTY_DETOX_STREAK_THRESHOLD = 3;

export const getActivePenaltyQuest = (): PenaltyQuest | null => {
  try {
    const raw = localStorage.getItem(ACTIVE_PENALTY_KEY);
    return raw ? (JSON.parse(raw) as PenaltyQuest) : null;
  } catch {
    return null;
  }
};

const saveActivePenaltyQuest = (quest: PenaltyQuest | null): void => {
  try {
    if (quest) {
      localStorage.setItem(ACTIVE_PENALTY_KEY, JSON.stringify(quest));
    } else {
      localStorage.removeItem(ACTIVE_PENALTY_KEY);
    }
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent(PENALTY_UPDATED_EVENT));
    }
  } catch {
    // ignore
  }
};

export const getPendingPenaltyQueue = (): PenaltyQuest[] => {
  try {
    const raw = localStorage.getItem(PENDING_PENALTY_QUEUE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const savePendingPenaltyQueue = (queue: PenaltyQuest[]): void => {
  try {
    if (queue.length > 0) {
      localStorage.setItem(PENDING_PENALTY_QUEUE_KEY, JSON.stringify(queue));
    } else {
      localStorage.removeItem(PENDING_PENALTY_QUEUE_KEY);
    }
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent(PENALTY_UPDATED_EVENT));
    }
  } catch {
    // ignore
  }
};

/**
 * The single point where a freshly-generated quest either becomes active immediately or queues
 * behind whatever's already active — this is what makes "two independent sources, neither one
 * drops the other" actually true, instead of just true in the common case where they never
 * collide. A quest's own `debuff` (fixed at generation time) is what takes effect, whether it
 * activates now or gets promoted later — see completePenaltyTask for the promotion side.
 */
const activateOrQueuePenaltyQuest = (quest: PenaltyQuest): void => {
  if (getActivePenaltyQuest()) {
    savePendingPenaltyQueue([...getPendingPenaltyQueue(), quest]);
    return;
  }
  saveActivePenaltyQuest(quest);
  saveUserProfile({ ...getUserProfile(), activeDebuff: quest.debuff });
};

/** Debuff severity by streak — first miss only dents XP; a repeat also caps how far rest can
 * recover; once it escalates to Detox the debuff is at its harshest until fully cleared.
 * 'daily' source only — see DEBUFF_BY_RANK for the 'seal' source's own scaling. */
const debuffForStreak = (streak: number): { xpMultiplier: number; recoveryCapMultiplier: number } => {
  if (streak >= PENALTY_DETOX_STREAK_THRESHOLD) return { xpMultiplier: 0.5, recoveryCapMultiplier: 0.65 };
  if (streak >= 2) return { xpMultiplier: 0.65, recoveryCapMultiplier: 0.85 };
  return { xpMultiplier: 0.85, recoveryCapMultiplier: 1 };
};

/** A Seal slip's debuff scales with that Seal's own Threat Rank instead of a miss streak — there
 * is no "streak" concept for a single slip event. Deliberately a wider spread than
 * debuffForStreak's three tiers (6 Ranks vs 3 streak tiers) since Threat Rank already has that
 * much granularity elsewhere (THREAT_TUNING in seals.ts). */
const DEBUFF_BY_RANK: Record<HunterRank, { xpMultiplier: number; recoveryCapMultiplier: number }> = {
  E: { xpMultiplier: 0.85, recoveryCapMultiplier: 1 },
  D: { xpMultiplier: 0.8, recoveryCapMultiplier: 0.95 },
  C: { xpMultiplier: 0.7, recoveryCapMultiplier: 0.9 },
  B: { xpMultiplier: 0.65, recoveryCapMultiplier: 0.85 },
  A: { xpMultiplier: 0.55, recoveryCapMultiplier: 0.75 },
  S: { xpMultiplier: 0.45, recoveryCapMultiplier: 0.65 },
};

/** Real-world minutes the assigned task/protocol should take — scaled by Rank so a higher-
 * level Hunter faces a genuinely harder ordeal, same spirit as Jinwoo's desert survival trial
 * being brutal specifically because of how far he'd come. */
const DURATION_MINUTES_BY_RANK: Record<HunterRank, number> = { E: 25, D: 40, C: 55, B: 80, A: 120, S: 210 };

// Multiple task/flavorText variants per rank, picked at random — a single fixed template here
// meant every fallback (which is common: this call shares the same tight free-tier daily AI
// quota as every other THEIA feature, and a penalty tends to get assigned late in the day after
// that budget is already spent elsewhere) showed the exact same quest, every time, indefinitely.
const FALLBACK_PENALTY_BY_RANK: Record<HunterRank, { title: string; flavorTexts: string[]; tasks: string[] }> = {
  E: {
    title: '[PENALTY QUEST: DISCIPLINE PROTOCOL]',
    flavorTexts: [
      'The System does not forgive negligence, Hunter. A directive was ignored — a small toll is now owed before the next may begin.',
      'A directive lapsed unanswered. The System logs it, and issues the first toll — small, but not optional.',
    ],
    tasks: [
      '50 continuous bodyweight squats, no single rest longer than 10 seconds between sets. Time it.',
      '3 minutes of wall-sit, broken into as few sets as possible. Log your longest single hold.',
      '100 jumping jacks without stopping, then hold a plank for as long as you can immediately after.',
    ],
  },
  D: {
    title: '[PENALTY QUEST: DISCIPLINE PROTOCOL]',
    flavorTexts: [
      'The System does not forgive negligence, Hunter. A directive was ignored — the debt grows heavier with rank.',
      'Negligence compounds with rank, Hunter. What was excusable at E-Rank is now a debt owed.',
    ],
    tasks: [
      'A 30-minute uninterrupted walk or run outdoors. No phone in hand for the duration.',
      '75 push-ups and 75 bodyweight squats, split however you like, completed within 20 minutes.',
      'A 25-minute unbroken skipping-rope or shadow-boxing session — keep moving the whole time.',
    ],
  },
  C: {
    title: '[PENALTY QUEST: ENDURANCE TRIAL]',
    flavorTexts: [
      'Negligence at this Rank is not an accident, it is a choice. The System now demands proof of will.',
      'A Hunter at this Rank knows better. The System does not accept excuses — only proof of will.',
    ],
    tasks: [
      'A 45-minute unbroken physical circuit (push-ups, squats, planks, rotating). Log total reps.',
      'A 40-minute deep-work block on the task you have been avoiding most — phone off, one tab open.',
      'A 5km walk, run, or cycle, completed without stopping for longer than 60 seconds at a time.',
    ],
  },
  B: {
    title: '[PENALTY QUEST: ENDURANCE TRIAL]',
    flavorTexts: [
      'You were trusted with more, and gave less. The System is watching more closely now.',
      'More was expected of a Hunter at this Rank. The System recalibrates its trust downward — earn it back.',
    ],
    tasks: [
      'A 60-minute deep-work block on one meaningful task — zero distractions, phone in another room.',
      'A 60-minute physical endurance circuit, unbroken, mixing cardio and strength work.',
      'A cold shower held for the full duration, immediately followed by 15 minutes of stillness/breathwork.',
    ],
  },
  A: {
    title: '[PENALTY QUEST: SURVIVAL PROTOCOL]',
    flavorTexts: [
      'At your Rank, a missed directive is not fatigue — it is surrender. The System rejects it.',
      'A lapse at this Rank is not weariness — it is surrender, and the System does not accept surrender.',
    ],
    tasks: [
      'A 90-minute sustained physical endurance session (cardio or strength circuit), no stop longer than 30 seconds.',
      'A 90-minute uninterrupted deep-work session on your single hardest pending task, phone powered off.',
      'A 10km walk, run, or cycle, completed start to finish without stopping.',
    ],
  },
  S: {
    title: '[PENALTY QUEST: SURVIVAL PROTOCOL]',
    flavorTexts: [
      'A Hunter of your standing does not fall to negligence. The System imposes a true trial — endure it, unbroken, to the end.',
      'Your standing was earned, Hunter — do not let it erode from here. The System imposes a true trial: endure it to the end.',
    ],
    tasks: [
      'A 3.5-hour unbroken endurance trial, physical or mental — logged start to finish, no exit before the clock runs out.',
      'A half-marathon-distance walk, run, or cycle, completed in one continuous session.',
      'A 3-hour deep-work marathon on your single most important pending goal, phone off, no breaks longer than 5 minutes.',
    ],
  },
};

/** Detox is the harshest tier and now scales with Rank like the plain Penalty Quest does — it
 * used to be one universal set of 4 tasks regardless of Rank, which read as flat/repetitive at
 * every level. Each category still has multiple variants, randomly picked, for the same reason
 * the plain Penalty Quest above does. */
const FALLBACK_DETOX_BY_TIER: Record<
  'low' | 'mid' | 'high',
  { curfewHours: number; focusMinutes: number; physicalMinutes: number; deadlineMinutes: number }
> = {
  // deadlineMinutes gives real headroom beyond the curfew alone (which can run concurrently
  // with the reflection/planning around it) for the focus + physical tasks to actually fit —
  // the old flat 240 for every tier left zero buffer once the high tier's curfew hit 4 hours.
  low: { curfewHours: 2, focusMinutes: 30, physicalMinutes: 20, deadlineMinutes: 180 },
  mid: { curfewHours: 3, focusMinutes: 45, physicalMinutes: 30, deadlineMinutes: 270 },
  high: { curfewHours: 4, focusMinutes: 60, physicalMinutes: 45, deadlineMinutes: 360 },
};
const DETOX_TIER_BY_RANK: Record<HunterRank, 'low' | 'mid' | 'high'> = {
  E: 'low',
  D: 'low',
  C: 'mid',
  B: 'mid',
  A: 'high',
  S: 'high',
};
const FALLBACK_DETOX_FLAVOR_TEXTS = [
  'A pattern has formed, Hunter — not a single lapse, but a slide. The System will not issue another small penalty. It is resetting you.',
  'This is no longer an isolated lapse, Hunter — it is a pattern. The System intervenes directly, in full.',
];

interface RawPenaltyQuest {
  title?: string;
  flavorText?: string;
  task?: string;
}

interface RawDetoxProtocol {
  title?: string;
  flavorText?: string;
  tasks?: string[];
}

const makeTasks = (labels: string[]): PenaltyTask[] =>
  labels.map((label) => ({ id: crypto.randomUUID(), label, completed: false }));

const buildPenaltyPrompt = (rank: HunterRank, level: number, streak: number, durationMinutes: number): string => `
Role: The System, from Solo Leveling, assigning a Penalty Quest to a Hunter who ignored a mandatory daily directive (this is consecutive miss #${streak}).
Hunter: Rank ${rank}, Level ${level}.

Design ONE real-world Penalty Quest:
1. title: a short System-style quest name in brackets, e.g. "[PENALTY QUEST: ENDURANCE PROTOCOL]".
2. flavorText: 2-3 ominous, dramatic sentences in the System's clinical-but-epic voice, framing this
   as a real consequence for negligence (Sung Jinwoo's desert survival trial is the tone to match) —
   metaphorically harsh is fine, but do not describe actual danger.
3. task: ONE concrete, safe, real-world task a real person can actually do, harder and longer than a
   normal daily quest, completable in roughly ${durationMinutes} minutes, demanding genuine discipline
   (physical endurance, or an unbroken focus/deep-work block) appropriate for Rank ${rank}. Never
   suggest anything dangerous, harmful, or medically risky.

Return ONLY valid JSON (no markdown): {"title":"...","flavorText":"...","task":"..."}
`.trim();

const buildDetoxPrompt = (rank: HunterRank, level: number, streak: number): string => {
  const tier = FALLBACK_DETOX_BY_TIER[DETOX_TIER_BY_RANK[rank]];
  return `
Role: The System, from Solo Leveling, intervening after a Hunter has missed ${streak} consecutive
mandatory daily directives — a genuine slide into procrastination, not a single lapse.
Hunter: Rank ${rank}, Level ${level}.

Design a Detox Protocol: a short System-style title, 2-3 sentence flavorText in the System's voice
framing this as a full reset of the Hunter's discipline (not a small punishment — an intervention),
and exactly 4 concrete, safe, real-world tasks covering: (1) a digital curfew / disconnection of
roughly ${tier.curfewHours} hours, (2) an unbroken single-focus deep-work block of roughly
${tier.focusMinutes} minutes, (3) a physical reset activity of roughly ${tier.physicalMinutes}
minutes, and (4) a short written reflection on the cause of the slide and one concrete change.
Scale intensity/duration up with Rank — this Hunter's Rank puts them in the ${DETOX_TIER_BY_RANK[rank]}
tier of severity. Never suggest anything dangerous.

Return ONLY valid JSON (no markdown): {"title":"...","flavorText":"...","tasks":["...","...","...","..."]}
`.trim();
};

const pickRandom = <T>(items: T[]): T => items[Math.floor(Math.random() * items.length)];

const generatePenaltyQuest = async (profile: UserProfile, streak: number): Promise<PenaltyQuest> => {
  const rank = getHunterRank(profile.level);
  const durationMinutes = DURATION_MINUTES_BY_RANK[rank];

  let title = FALLBACK_PENALTY_BY_RANK[rank].title;
  let flavorText = pickRandom(FALLBACK_PENALTY_BY_RANK[rank].flavorTexts);
  let task = pickRandom(FALLBACK_PENALTY_BY_RANK[rank].tasks);
  let origin: 'ai' | 'system' = 'system';

  try {
    const res = await aiGatewayClient.completeJson<RawPenaltyQuest>(
      buildPenaltyPrompt(rank, profile.level, streak, durationMinutes),
      // skipCache: real culprit behind "the AI didn't hit its limit but I still got the same
      // quest" — the gateway's 1-hour response cache is keyed on the exact prompt+options, and
      // this prompt is nearly static (rank/level/streak/duration), so two infractions within an
      // hour at the same rank/streak were getting the SAME cached AI response back verbatim,
      // regardless of temperature — a Penalty Quest must always be a fresh generation.
      { temperature: 0.7, maxTokens: 350, thinkingBudget: 0, providerOverride: 'lab', skipCache: true }
    );
    if (res?.title && res?.flavorText && res?.task) {
      title = truncateCleanly(String(res.title).trim(), 80);
      flavorText = truncateCleanly(String(res.flavorText).trim(), 400);
      task = truncateCleanly(String(res.task).trim(), 300);
      origin = 'ai';
    }
  } catch (error) {
    console.warn('Penalty Quest AI fallback to System template:', error);
  }

  return {
    id: crypto.randomUUID(),
    kind: 'penalty',
    source: 'daily',
    title,
    flavorText,
    tasks: makeTasks([task]),
    assignedAt: new Date().toISOString(),
    deadlineMinutes: durationMinutes,
    difficultyRank: rank,
    streakAtAssignment: streak,
    origin,
    debuff: debuffForStreak(streak),
  };
};

/** Seal-slip flavor text, keyed by nothing but pickRandom's own randomness — the task pool is
 * shared with FALLBACK_PENALTY_BY_RANK (same real-world difficulty tasks work fine regardless of
 * whether the trigger was a missed directive or a Seal slip), only the framing differs. */
const buildFallbackSealSlipFlavorTexts = (sealName: string): string[] => [
  `The Seal against "${sealName}" cracked, Hunter. The System does not let a crack go unanswered — a toll is now owed.`,
  `You let "${sealName}" through. The System responds in kind — an ordeal, not a lecture.`,
];

const buildSealSlipPenaltyPrompt = (sealName: string, rank: HunterRank, level: number, durationMinutes: number): string => `
Role: The System, from Solo Leveling, assigning a Penalty Quest to a Hunter whose Seal against a
named weakness just slipped — this is a suppression failure, not a missed daily directive.
Hunter: Rank ${rank}, Level ${level}. The weakness that broke through: "${sealName}".

Design ONE real-world Penalty Quest:
1. title: a short System-style quest name in brackets, e.g. "[PENALTY QUEST: DISCIPLINE PROTOCOL]".
2. flavorText: 2-3 ominous, dramatic sentences in the System's clinical-but-epic voice, framing this
   specifically as the consequence of the Seal against "${sealName}" breaking, not a missed task —
   Sung Jinwoo's desert survival trial is the tone to match. Metaphorically harsh is fine, do not
   describe actual danger.
3. task: ONE concrete, safe, real-world task a real person can actually do, completable in roughly
   ${durationMinutes} minutes, demanding genuine discipline (physical endurance, or an unbroken
   focus/deep-work block) appropriate for Rank ${rank}. Never suggest anything dangerous, harmful,
   or medically risky, and never reference the specific weakness itself in the task (e.g. don't
   assign anything related to "${sealName}" as the task — the task is a general discipline trial,
   the flavorText is what references the Seal).

Return ONLY valid JSON (no markdown): {"title":"...","flavorText":"...","task":"..."}
`.trim();

/**
 * Penalty Quest for a Seal slip — an independent source from the Daily Quest one: its own
 * difficulty scaling (the SLIPPED SEAL's own Threat Rank, not the Hunter's overall Rank or any
 * streak — matching how the Seal's own slip consequences already scale by Threat Rank), its own
 * debuff table (DEBUFF_BY_RANK), and never escalates to a Detox Protocol (that streak-based
 * concept belongs specifically to the Daily Quest habit-formation loop). It DOES share the same
 * active-quest slot and blocking UI (SoloDailyQuestWindow) rather than a parallel one — but never
 * silently drops if that slot is occupied: see activateOrQueuePenaltyQuest.
 */
export const assignPenaltyForSealSlip = async (sealName: string, threatRank: HunterRank): Promise<PenaltyQuest> => {
  const profile = getUserProfile();
  const rank = threatRank;
  const durationMinutes = DURATION_MINUTES_BY_RANK[rank];

  let title = FALLBACK_PENALTY_BY_RANK[rank].title;
  let flavorText = pickRandom(buildFallbackSealSlipFlavorTexts(sealName));
  let task = pickRandom(FALLBACK_PENALTY_BY_RANK[rank].tasks);
  let origin: 'ai' | 'system' = 'system';

  try {
    const res = await aiGatewayClient.completeJson<RawPenaltyQuest>(
      buildSealSlipPenaltyPrompt(sealName, rank, profile.level, durationMinutes),
      { temperature: 0.7, maxTokens: 350, thinkingBudget: 0, providerOverride: 'lab', skipCache: true }
    );
    if (res?.title && res?.flavorText && res?.task) {
      title = truncateCleanly(String(res.title).trim(), 80);
      flavorText = truncateCleanly(String(res.flavorText).trim(), 400);
      task = truncateCleanly(String(res.task).trim(), 300);
      origin = 'ai';
    }
  } catch (error) {
    console.warn('Seal-slip Penalty Quest AI fallback to System template:', error);
  }

  const quest: PenaltyQuest = {
    id: crypto.randomUUID(),
    kind: 'penalty',
    source: 'seal',
    title,
    flavorText,
    tasks: makeTasks([task]),
    assignedAt: new Date().toISOString(),
    deadlineMinutes: durationMinutes,
    difficultyRank: rank,
    streakAtAssignment: 1,
    origin,
    debuff: DEBUFF_BY_RANK[rank],
    sourceDetail: sealName,
  };

  // This Penalty Quest's own debuff (activateOrQueuePenaltyQuest, if it activates immediately)
  // stacks alongside the Seal's own separate debuff (sealXpModifier, see seals.ts) — intentional,
  // same as before: the Seal's own consequence is about that specific weakness, this one is the
  // System's broader, felt consequence layered on top.
  activateOrQueuePenaltyQuest(quest);
  return quest;
};

const buildFallbackDetoxTasks = (rank: HunterRank): string[] => {
  const tier = FALLBACK_DETOX_BY_TIER[DETOX_TIER_BY_RANK[rank]];
  return [
    `Digital Curfew — zero phone/social media for the next ${tier.curfewHours} continuous hours.`,
    `Single-Tasking Trial — one uninterrupted ${tier.focusMinutes}-minute focus block on a single task, no switching.`,
    `Physical Reset — an unbroken ${tier.physicalMinutes}-minute physical session (walk, run, or circuit), no stopping.`,
    'Reflection Log — write 3-5 sentences on what caused the slide, and one concrete change starting tomorrow.',
  ];
};

const generateDetoxProtocol = async (profile: UserProfile, streak: number): Promise<PenaltyQuest> => {
  const rank = getHunterRank(profile.level);
  const deadlineMinutes = FALLBACK_DETOX_BY_TIER[DETOX_TIER_BY_RANK[rank]].deadlineMinutes;

  let title = '[SYSTEM INTERVENTION: DETOX PROTOCOL]';
  let flavorText = pickRandom(FALLBACK_DETOX_FLAVOR_TEXTS);
  let tasks = buildFallbackDetoxTasks(rank);
  let origin: 'ai' | 'system' = 'system';

  try {
    const res = await aiGatewayClient.completeJson<RawDetoxProtocol>(
      buildDetoxPrompt(rank, profile.level, streak),
      // Same reasoning as generatePenaltyQuest's skipCache — a Detox Protocol must be a fresh
      // generation every time, never a stale cached one from an earlier same-rank intervention.
      { temperature: 0.7, maxTokens: 500, thinkingBudget: 0, providerOverride: 'lab', skipCache: true }
    );
    if (res?.title && res?.flavorText && Array.isArray(res.tasks) && res.tasks.length >= 3) {
      title = truncateCleanly(String(res.title).trim(), 80);
      flavorText = truncateCleanly(String(res.flavorText).trim(), 500);
      tasks = res.tasks
        .map((t) => truncateCleanly(String(t || '').trim(), 300))
        .filter((t) => t.length > 0)
        .slice(0, 5);
      origin = 'ai';
    }
  } catch (error) {
    console.warn('Detox Protocol AI fallback to System template:', error);
  }

  return {
    id: crypto.randomUUID(),
    kind: 'detox',
    source: 'daily',
    title,
    flavorText,
    tasks: makeTasks(tasks),
    assignedAt: new Date().toISOString(),
    deadlineMinutes,
    difficultyRank: rank,
    streakAtAssignment: streak,
    debuff: debuffForStreak(streak),
    origin,
  };
};

/**
 * Consumes PENDING_PENALTY_ASSIGNMENT_KEY (queued by storage.ts's applyVitalsRegeneration)
 * and assigns/escalates the active Penalty Quest accordingly. Call once from Dashboard.tsx —
 * kept out of storage.ts entirely since generation may call the AI gateway, and storage.ts
 * must stay free of that dependency (same reasoning as gates.ts/codex.ts).
 */
export const checkAndAssignPendingPenalty = async (): Promise<PenaltyQuest | null> => {
  let pending: { streak: number } | null = null;
  try {
    const raw = localStorage.getItem(PENDING_PENALTY_ASSIGNMENT_KEY);
    if (raw) pending = JSON.parse(raw);
  } catch {
    pending = null;
  }
  if (!pending || !(pending.streak > 0)) return null;

  localStorage.removeItem(PENDING_PENALTY_ASSIGNMENT_KEY);

  const profile = getUserProfile();
  const streak = pending.streak;
  const existing = getActivePenaltyQuest();
  const shouldBeDetox = streak >= PENALTY_DETOX_STREAK_THRESHOLD;

  // A 'daily'-sourced quest is ALREADY the active one — this new streak is the SAME ongoing debt
  // continuing, not an independent second one, so it escalates/refreshes in place rather than
  // queuing behind itself. A 'seal'-sourced quest occupying the slot is a genuinely different
  // debt, so it falls through to the general queue-or-activate path below instead.
  if (existing && existing.source === 'daily') {
    if (existing.kind === 'detox' || !shouldBeDetox) {
      saveUserProfile({ ...getUserProfile(), activeDebuff: debuffForStreak(streak) });
      return null;
    }
    const quest = await generateDetoxProtocol(profile, streak);
    saveActivePenaltyQuest(quest);
    saveUserProfile({ ...getUserProfile(), activeDebuff: quest.debuff });
    return quest;
  }

  const quest = shouldBeDetox
    ? await generateDetoxProtocol(profile, streak)
    : await generatePenaltyQuest(profile, streak);
  activateOrQueuePenaltyQuest(quest);
  return quest;
};

export const completePenaltyTask = (taskId: string): { cleared: boolean; quest: PenaltyQuest | null } => {
  const quest = getActivePenaltyQuest();
  if (!quest) return { cleared: false, quest: null };

  const updatedTasks = quest.tasks.map((t) => (t.id === taskId ? { ...t, completed: true } : t));
  const allDone = updatedTasks.every((t) => t.completed);

  if (allDone) {
    try {
      localStorage.setItem(PENALTY_LAST_CLEARED_AT_KEY, new Date().toISOString());
    } catch {
      // ignore — worst case, loses the anti-reappearance protection for this one completion
    }

    const profile = getUserProfile();
    // Only a 'daily'-sourced quest's completion resets the miss streak — a 'seal'-sourced quest
    // paying off has nothing to do with that counter, and shouldn't silently reset it.
    const streakReset = quest.source === 'daily' ? { missedQuestStreak: 0 } : {};

    // Debt paid in full — promote whatever's next in line (a different debt that arrived while
    // this one was active) instead of just clearing everything, so it doesn't get silently lost.
    const [next, ...rest] = getPendingPenaltyQueue();
    if (next) {
      savePendingPenaltyQueue(rest);
      saveActivePenaltyQuest(next);
      saveUserProfile({ ...profile, ...streakReset, activeDebuff: next.debuff });
    } else {
      saveActivePenaltyQuest(null);
      saveUserProfile({ ...profile, ...streakReset, activeDebuff: undefined });
    }

    return { cleared: true, quest: { ...quest, tasks: updatedTasks } };
  }

  const updated = { ...quest, tasks: updatedTasks };
  saveActivePenaltyQuest(updated);
  return { cleared: false, quest: updated };
};
