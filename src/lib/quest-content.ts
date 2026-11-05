/**
 * Daily Quest content — the System's voice.
 *
 * Every mandatory/bonus directive gets an in-world NAME, a plain TASK (what to actually do — always
 * stated clearly), and a rotating SYSTEM LINE (cold, absolute, like the anime's System windows).
 * Lines rotate by calendar date (deterministic, no AI call, no randomness that changes on reload),
 * and react to the Hunter: a directive abandoned yesterday is called out today, and higher ranks
 * occasionally get a colder addendum.
 *
 * Mechanics never depend on these strings — quests are recognised by id (storage.ts). All text
 * lives here so a translation can be added in one place later.
 */
import type { Quest } from '@/lib/types';

export type DirectiveKey =
  | 'reading'
  | 'study'
  | 'geography'
  | 'history'
  | 'work1'
  | 'work2'
  | 'work3'
  | 'work4'
  | 'meditation'
  | 'reflection'
  | 'gratitude'
  | 'physical';

/** id prefix → directive. Order matters: more specific prefixes first. */
const ID_PREFIXES: Array<[string, DirectiveKey]> = [
  ['mental-book', 'reading'],
  ['mental-study-custom', 'study'],
  ['mental-geo', 'geography'],
  ['mental-history', 'history'],
  ['mental-work1', 'work1'],
  ['mental-study1', 'work1'],
  ['mental-work2', 'work2'],
  ['mental-study2', 'work2'],
  ['mental-work3', 'work3'],
  ['mental-study3', 'work3'],
  ['mental-work4', 'work4'],
  ['mental-study4', 'work4'],
  ['spiritual-meditation', 'meditation'],
  ['spiritual-reflection', 'reflection'],
  ['spiritual-gratitude', 'gratitude'],
  ['physical-workout', 'physical'],
];

export const getDirectiveKey = (quest: Pick<Quest, 'id' | 'type'>): DirectiveKey | null => {
  for (const [prefix, key] of ID_PREFIXES) if (quest.id.startsWith(prefix)) return key;
  return quest.type === 'physical' ? 'physical' : null;
};

const ROMAN = ['I', 'II', 'III', 'IV'];

const dungeonLines = (floor: number): string[] =>
  floor === 1
    ? [
        'Enter the instance. Phone sealed. Exit only on completion.',
        'One task. One door. Forty-five minutes. The dungeon does not pause.',
        'Distraction is a monster. Do not feed it.',
        'The first floor separates Hunters from people who intended to work.',
        'Close every tab that is not the task. The System is watching the clock.',
        'Begin before you feel ready. Readiness is a rumor.',
      ]
    : [
        'A deeper floor has opened. Few Hunters descend this far.',
        'Optional. The System recognizes the Hunter who goes further anyway.',
        'The weak stop when the quest is done. Descend.',
        `Floor ${ROMAN[floor - 1]}. Stronger enemies. Greater rewards.`,
        'Your previous floor is cleared. Momentum is a weapon — use it.',
      ];

interface DirectiveContent {
  name: (ctx: ContentContext) => string;
  task: (ctx: ContentContext) => string;
  lines: string[];
}

export interface ContentContext {
  bookTitle: string;
  readingMins: number;
  studyTopic: string;
  studyMins: number;
}

const CONTENT: Record<Exclude<DirectiveKey, 'physical'>, DirectiveContent> = {
  reading: {
    name: (c) => `Archive Access — ${c.bookTitle}`,
    task: (c) => `Read "${c.bookTitle}" for ${c.readingMins} uninterrupted minutes.`,
    lines: [
      'Absorb the designated text. Knowledge not retained was never acquired.',
      'Read as if you will be tested. You will be.',
      'One idea from today’s pages must change how you act. Find it.',
      'The archive opens for those who sit still long enough to enter.',
      'Pages skimmed are pages wasted. Slow down. Extract.',
      'Close the book only after you can explain what you read.',
    ],
  },
  study: {
    name: (c) => `Field Mastery — ${c.studyTopic}`,
    task: (c) => `${c.studyMins} minutes of active study on ${c.studyTopic}: recall and practice, not rereading.`,
    lines: [
      'Your profession is a weapon. Sharpen it.',
      'Recall, do not reread. The mind grows only under load.',
      'Teach today’s concept to an empty room. Gaps will reveal themselves.',
      'Attack the topic you have been avoiding. That is where the levels are.',
      'Write from memory first. Check the source after. Measure the difference.',
      'Mastery is not a feeling. It is a result you can reproduce on demand.',
    ],
  },
  geography: {
    name: () => 'Cartography Briefing',
    task: () => '15 minutes of geography study.',
    lines: [
      'Today’s target: one region you cannot place. Its countries, its capitals.',
      'Today’s target: one great river — where it rises, where it ends, who depends on it.',
      'Today’s target: one country’s borders and the reason each one exists.',
      'Today’s target: one mountain range, and how it shaped the people around it.',
      'Today’s target: one strait or canal that the world’s trade cannot afford to lose.',
      'Today’s target: one desert, one climate, one way of surviving it.',
      'Today’s target: redraw a continent from memory. Then check it.',
    ],
  },
  history: {
    name: () => 'Chronicle Study',
    task: () => '15 minutes of history study.',
    lines: [
      'Today’s target: one empire — its rise, its peak, its fall.',
      'Today’s target: one battle that changed a border, and why it was won.',
      'Today’s target: one leader, and the single decision that defined them.',
      'Today’s target: one invention, and the world before and after it.',
      'Today’s target: one revolution — what was promised, what was delivered.',
      'Today’s target: one collapse. Find the warning signs everyone ignored.',
      'Those who do not study the past repeat it. Do not repeat it.',
    ],
  },
  work1: { name: () => 'Instant Dungeon I', task: () => '45 minutes of focused deep work. Phone away, one task only.', lines: dungeonLines(1) },
  work2: { name: () => 'Instant Dungeon II', task: () => '45 more minutes of focused deep work. Optional floor.', lines: dungeonLines(2) },
  work3: { name: () => 'Instant Dungeon III', task: () => '45 more minutes of focused deep work. Optional floor.', lines: dungeonLines(3) },
  work4: { name: () => 'Instant Dungeon IV', task: () => '45 more minutes of focused deep work. Optional floor.', lines: dungeonLines(4) },
  meditation: {
    name: () => 'Mana Stabilization',
    task: () => '10 minutes of silent meditation.',
    lines: [
      'Stillness. Breath only. An unstable mind leaks mana.',
      'Technique: box breathing — in 4, hold 4, out 4, hold 4. Repeat.',
      'Count 100 breaths. Lose count, begin again. No judgment, only repetition.',
      'The strongest Hunters are calm before the Gate opens. Practice calm.',
      'Technique: body scan — from the crown of the head to the soles of the feet.',
      'Thoughts will come. Observe them like enemies outside the barrier. Do not engage.',
      'Technique: long exhale — breathe out twice as long as you breathe in.',
    ],
  },
  reflection: {
    name: () => 'Combat Log Review',
    task: () => '10 minutes reviewing today: one victory, one error, one adjustment for tomorrow.',
    lines: [
      'A Hunter who does not study his losses repeats them.',
      'Identify the moment today you chose comfort over growth.',
      'What did today cost you? What did it give you? Record both.',
      'Name one thing you will do differently tomorrow. Be specific.',
      'Review the battle, not the feelings about the battle.',
      'If today were repeated 100 times, where would you be? Answer honestly.',
    ],
  },
  gratitude: {
    name: () => 'Ally Registry',
    task: () => 'Write down three things you are grateful for today.',
    lines: [
      'Know what you fight for. Record it.',
      'Three allies, people or things, that made you stronger today.',
      'Even the Shadow Monarch did not fight alone. Name yours.',
      'Gratitude is not softness. It is clarity about what matters.',
      'One person, one thing, one moment. Record all three.',
    ],
  },
};

const PHYSICAL_LINES: Record<'gym' | 'cardio' | 'accessory' | 'mobility' | 'custom', string[]> = {
  gym: [
    'Preparation to become strong. The weight does not care how you feel.',
    'Every set is a floor of the dungeon. Clear them in order.',
    'Form first. Load second. Ego never.',
    'The body you want is built in the sets you want to skip.',
    'Lift with intent. Rest with discipline. Leave nothing unfinished.',
  ],
  cardio: [
    'Cover the distance. Pace is irrelevant. Stopping is not.',
    'Endurance is the stat that decides who is still standing at the end.',
    'Run until the doubt goes quiet. Then finish the distance.',
    'The Gate does not wait for those who cannot keep moving.',
  ],
  accessory: [
    'Weak links break first. Today, reinforce them.',
    'Precision work. Small muscles, large consequences.',
    'The details no one sees are what holds the structure together.',
  ],
  mobility: [
    'Recovery is also training. A rigid Hunter breaks.',
    'Restore range. Restore readiness. Tomorrow’s strength is built today.',
    'Slow, deliberate, complete. The System rewards patience here.',
  ],
  custom: [
    'Your protocol, your terms. The System expects it completed in full.',
    'You designed this trial. Now honor it.',
    'Execute the program as written. Adjust tomorrow, not mid-set.',
  ],
};

const physicalKind = (title: string): keyof typeof PHYSICAL_LINES => {
  const t = title.toLowerCase();
  if (/rest|recovery|stretch|mobility/.test(t)) return 'mobility';
  if (/cardio|run|jog/.test(t)) return 'cardio';
  if (/specific muscles|accessory/.test(t)) return 'accessory';
  if (/gym/.test(t)) return 'gym';
  return 'custom';
};

/** A directive the Hunter abandoned yesterday is called out by name. */
const FAILURE_LINES = [
  (n: string) => `[NOTICE] ${n} was abandoned yesterday. The System does not forget.`,
  (n: string) => `[NOTICE] ${n} was left incomplete yesterday. Today it is not optional.`,
  (n: string) => `[NOTICE] Yesterday you walked away from ${n}. Return to it first.`,
  (n: string) => `[NOTICE] ${n}: failed yesterday. Failure twice is a pattern.`,
];

/** Colder addendum for higher ranks (C and above) — status raises the standard. */
const RANK_ADDENDA: Record<'C' | 'B' | 'A' | 'S', string[]> = {
  C: ['A C-rank Hunter does not need reminders. Proceed.'],
  B: ['This is routine for a B-rank. Execute without ceremony.'],
  A: ['This is beneath your rank. Complete it anyway. Discipline is not a phase.'],
  S: ['S-rank. The System no longer instructs you. It observes.'],
};

/** Deterministic 0..1 per (seed). */
const hash01 = (seed: string): number => {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) / 4294967296;
};

const pick = <T,>(list: T[], seed: string): T => list[Math.floor(hash01(seed) * list.length)];

const RANKS = ['E', 'D', 'C', 'B', 'A', 'S'] as const;
const rankForLevel = (level: number) => RANKS[Math.min(5, Math.max(0, Math.floor((Math.max(1, level) - 1) / 10)))];

export interface DecorateOptions extends ContentContext {
  /** Local calendar day key — the rotation seed. */
  dateKey: string;
  level: number;
  /** Directives left incomplete yesterday (recordDirectiveMisses). */
  missedYesterday: DirectiveKey[];
}

/**
 * Applies the System's content to today's directives. Idempotent (same inputs → same output), so
 * it is safe to run on every load after storage.ts's protocol sync.
 */
export const decorateDirectives = (quests: Quest[], opts: DecorateOptions): Quest[] => {
  const rank = rankForLevel(opts.level);
  // The rank addendum is rare on purpose: at most one directive, on about half of days — repeated
  // on several directives it stops being the System's judgment and becomes a catchphrase.
  const addendumKey: DirectiveKey | null =
    rank in RANK_ADDENDA && hash01(`${opts.dateKey}|rank`) < 0.5
      ? pick<DirectiveKey>(['reading', 'study', 'work1', 'physical', 'meditation', 'reflection'], `${opts.dateKey}|rankpick`)
      : null;
  return quests.map((q) => {
    if (q.origin !== 'system') return q;
    const key = getDirectiveKey(q);
    if (!key) return q;
    const seed = `${opts.dateKey}|${key}`;

    let title = q.title;
    let description = q.description;
    let line: string;
    if (key === 'physical') {
      line = pick(PHYSICAL_LINES[physicalKind(q.title)], seed);
    } else {
      const content = CONTENT[key];
      title = content.name(opts);
      description = content.task(opts);
      line = pick(content.lines, seed);
    }

    if (opts.missedYesterday.includes(key)) {
      line = `${pick(FAILURE_LINES, `${seed}|fail`)(key === 'physical' ? 'Physical training' : title)} ${line}`;
    } else if (key === addendumKey) {
      line = `${line} ${pick(RANK_ADDENDA[rank as keyof typeof RANK_ADDENDA], seed)}`;
    }

    return { ...q, title, description, systemLine: line };
  });
};

// ---------------------------------------------------------------------------
// Failure memory — which directives were abandoned yesterday.
// ---------------------------------------------------------------------------

export const DIRECTIVE_MISSES_KEY = 'wrp_directive_misses';

/** Called once at the day reset with the outgoing day's quests (only if that day was yesterday). */
export const recordDirectiveMisses = (previousQuests: Quest[], todayKey: string): void => {
  const missed = previousQuests
    .filter((q) => q.origin === 'system' && !q.completed && !q.isChainBonus)
    .map((q) => getDirectiveKey(q))
    .filter((k): k is DirectiveKey => k !== null);
  try {
    localStorage.setItem(DIRECTIVE_MISSES_KEY, JSON.stringify({ date: todayKey, keys: missed }));
  } catch {
    // ignore
  }
};

export const getMissedYesterday = (todayKey: string): DirectiveKey[] => {
  try {
    const parsed = JSON.parse(localStorage.getItem(DIRECTIVE_MISSES_KEY) || 'null');
    return parsed?.date === todayKey && Array.isArray(parsed.keys) ? parsed.keys : [];
  } catch {
    return [];
  }
};

// ---------------------------------------------------------------------------
// Clear screen
// ---------------------------------------------------------------------------

const CLEAR_LINES = [
  'You have become slightly stronger.',
  'The System acknowledges your compliance.',
  'Another day survived. Another day closer.',
  'Status restored. The weak rest. You recover.',
  'The penalty zone remains empty today.',
];

export const getClearLine = (dateKey: string): string => pick(CLEAR_LINES, `${dateKey}|clear`);
