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
import type { HunterRank, PenaltyQuest, PenaltyTask, UserProfile } from '@/lib/types';

export const ACTIVE_PENALTY_KEY = 'wrp_active_penalty_quest';
export const PENALTY_UPDATED_EVENT = 'wrp:penalty-updated';

/** Consecutive misses before a plain Penalty Quest escalates into the bigger Detox Protocol. */
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

/** Debuff severity by streak — first miss only dents XP; a repeat also caps how far rest can
 * recover; once it escalates to Detox the debuff is at its harshest until fully cleared. */
const debuffForStreak = (streak: number): { xpMultiplier: number; recoveryCapMultiplier: number } => {
  if (streak >= PENALTY_DETOX_STREAK_THRESHOLD) return { xpMultiplier: 0.5, recoveryCapMultiplier: 0.65 };
  if (streak >= 2) return { xpMultiplier: 0.65, recoveryCapMultiplier: 0.85 };
  return { xpMultiplier: 0.85, recoveryCapMultiplier: 1 };
};

/** Real-world minutes the assigned task/protocol should take — scaled by Rank so a higher-
 * level Hunter faces a genuinely harder ordeal, same spirit as Jinwoo's desert survival trial
 * being brutal specifically because of how far he'd come. */
const DURATION_MINUTES_BY_RANK: Record<HunterRank, number> = { E: 25, D: 40, C: 55, B: 80, A: 120, S: 210 };

const FALLBACK_PENALTY_BY_RANK: Record<HunterRank, { title: string; flavorText: string; task: string }> = {
  E: {
    title: '[PENALTY QUEST: DISCIPLINE PROTOCOL]',
    flavorText:
      'The System does not forgive negligence, Hunter. A directive was ignored — a small toll is now owed before the next may begin.',
    task: '50 continuous bodyweight squats, no single rest longer than 10 seconds between sets. Time it.',
  },
  D: {
    title: '[PENALTY QUEST: DISCIPLINE PROTOCOL]',
    flavorText:
      'The System does not forgive negligence, Hunter. A directive was ignored — the debt grows heavier with rank.',
    task: 'A 30-minute uninterrupted walk or run outdoors. No phone in hand for the duration.',
  },
  C: {
    title: '[PENALTY QUEST: ENDURANCE TRIAL]',
    flavorText:
      'Negligence at this Rank is not an accident, it is a choice. The System now demands proof of will.',
    task: 'A 45-minute unbroken physical circuit (push-ups, squats, planks, rotating). Log total reps.',
  },
  B: {
    title: '[PENALTY QUEST: ENDURANCE TRIAL]',
    flavorText:
      'You were trusted with more, and gave less. The System is watching more closely now.',
    task: 'A 60-minute deep-work block on one meaningful task — zero distractions, phone in another room.',
  },
  A: {
    title: '[PENALTY QUEST: SURVIVAL PROTOCOL]',
    flavorText:
      'At your Rank, a missed directive is not fatigue — it is surrender. The System rejects it.',
    task: 'A 90-minute sustained physical endurance session (cardio or strength circuit), no stop longer than 30 seconds.',
  },
  S: {
    title: '[PENALTY QUEST: SURVIVAL PROTOCOL]',
    flavorText:
      'A Hunter of your standing does not fall to negligence. The System imposes a true trial — endure it, unbroken, to the end.',
    task: 'A 3.5-hour unbroken endurance trial, physical or mental — logged start to finish, no exit before the clock runs out.',
  },
};

const FALLBACK_DETOX = {
  title: '[SYSTEM INTERVENTION: DETOX PROTOCOL]',
  flavorText:
    'A pattern has formed, Hunter — not a single lapse, but a slide. The System will not issue another small penalty. It is resetting you.',
  tasks: [
    'Digital Curfew — zero phone/social media for the next 3 continuous hours.',
    'Single-Tasking Trial — one uninterrupted 45-minute focus block on a single task, no switching.',
    'Physical Reset — an unbroken 30-minute physical session (walk, run, or circuit), no stopping.',
    'Reflection Log — write 3-5 sentences on what caused the slide, and one concrete change starting tomorrow.',
  ],
};

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

const buildDetoxPrompt = (rank: HunterRank, level: number, streak: number): string => `
Role: The System, from Solo Leveling, intervening after a Hunter has missed ${streak} consecutive
mandatory daily directives — a genuine slide into procrastination, not a single lapse.
Hunter: Rank ${rank}, Level ${level}.

Design a Detox Protocol: a short System-style title, 2-3 sentence flavorText in the System's voice
framing this as a full reset of the Hunter's discipline (not a small punishment — an intervention),
and exactly 4 concrete, safe, real-world tasks covering: (1) a digital curfew / disconnection, (2) an
unbroken single-focus deep-work block, (3) a physical reset activity, and (4) a short written
reflection on the cause of the slide and one concrete change. Never suggest anything dangerous.

Return ONLY valid JSON (no markdown): {"title":"...","flavorText":"...","tasks":["...","...","...","..."]}
`.trim();

const generatePenaltyQuest = async (profile: UserProfile, streak: number): Promise<PenaltyQuest> => {
  const rank = getHunterRank(profile.level);
  const durationMinutes = DURATION_MINUTES_BY_RANK[rank];

  let title = FALLBACK_PENALTY_BY_RANK[rank].title;
  let flavorText = FALLBACK_PENALTY_BY_RANK[rank].flavorText;
  let task = FALLBACK_PENALTY_BY_RANK[rank].task;
  let origin: 'ai' | 'system' = 'system';

  try {
    const res = await aiGatewayClient.completeJson<RawPenaltyQuest>(
      buildPenaltyPrompt(rank, profile.level, streak, durationMinutes),
      { temperature: 0.7, maxTokens: 350, thinkingBudget: 0, providerOverride: 'lab' }
    );
    if (res?.title && res?.flavorText && res?.task) {
      title = String(res.title).trim().slice(0, 80);
      flavorText = String(res.flavorText).trim().slice(0, 400);
      task = String(res.task).trim().slice(0, 300);
      origin = 'ai';
    }
  } catch (error) {
    console.warn('Penalty Quest AI fallback to System template:', error);
  }

  return {
    id: crypto.randomUUID(),
    kind: 'penalty',
    title,
    flavorText,
    tasks: makeTasks([task]),
    assignedAt: new Date().toISOString(),
    deadlineMinutes: durationMinutes,
    difficultyRank: rank,
    streakAtAssignment: streak,
    origin,
  };
};

const generateDetoxProtocol = async (profile: UserProfile, streak: number): Promise<PenaltyQuest> => {
  const rank = getHunterRank(profile.level);

  let title = FALLBACK_DETOX.title;
  let flavorText = FALLBACK_DETOX.flavorText;
  let tasks = FALLBACK_DETOX.tasks;
  let origin: 'ai' | 'system' = 'system';

  try {
    const res = await aiGatewayClient.completeJson<RawDetoxProtocol>(
      buildDetoxPrompt(rank, profile.level, streak),
      { temperature: 0.7, maxTokens: 500, thinkingBudget: 0, providerOverride: 'lab' }
    );
    if (res?.title && res?.flavorText && Array.isArray(res.tasks) && res.tasks.length >= 3) {
      title = String(res.title).trim().slice(0, 80);
      flavorText = String(res.flavorText).trim().slice(0, 500);
      tasks = res.tasks.map((t) => String(t || '').trim().slice(0, 300)).filter((t) => t.length > 0).slice(0, 5);
      origin = 'ai';
    }
  } catch (error) {
    console.warn('Detox Protocol AI fallback to System template:', error);
  }

  return {
    id: crypto.randomUUID(),
    kind: 'detox',
    title,
    flavorText,
    tasks: makeTasks(tasks),
    assignedAt: new Date().toISOString(),
    deadlineMinutes: 240,
    difficultyRank: rank,
    streakAtAssignment: streak,
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
  const debuff = debuffForStreak(streak);
  saveUserProfile({ ...profile, activeDebuff: debuff });

  const shouldBeDetox = streak >= PENALTY_DETOX_STREAK_THRESHOLD;

  // Already has an active quest of the right kind — just let the (already-updated) debuff
  // escalate; don't hand out a second quest on top of an unresolved one.
  if (existing && (existing.kind === 'detox' || !shouldBeDetox)) {
    return null;
  }

  const quest = shouldBeDetox
    ? await generateDetoxProtocol(profile, streak)
    : await generatePenaltyQuest(profile, streak);
  saveActivePenaltyQuest(quest);
  return quest;
};

export const completePenaltyTask = (taskId: string): { cleared: boolean; quest: PenaltyQuest | null } => {
  const quest = getActivePenaltyQuest();
  if (!quest) return { cleared: false, quest: null };

  const updatedTasks = quest.tasks.map((t) => (t.id === taskId ? { ...t, completed: true } : t));
  const allDone = updatedTasks.every((t) => t.completed);

  if (allDone) {
    // Debt paid in full — lift the debuff and reset the streak immediately, don't wait for
    // the next day boundary.
    saveActivePenaltyQuest(null);
    const profile = getUserProfile();
    saveUserProfile({ ...profile, activeDebuff: undefined, missedQuestStreak: 0 });
    return { cleared: true, quest: { ...quest, tasks: updatedTasks } };
  }

  const updated = { ...quest, tasks: updatedTasks };
  saveActivePenaltyQuest(updated);
  return { cleared: false, quest: updated };
};
