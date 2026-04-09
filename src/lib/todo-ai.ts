import aiGatewayClient from '@/lib/ai-gateway-client';
import { getDailyQuests, getPhysicalDayPlan, getTodayKeyLocal, addToDo, getToDos } from '@/lib/storage';
import type { Attributes, ToDoItem } from '@/lib/types';

const TODO_PENDING_KEY = 'whiteroom_todo_pending';

type Suggestion = {
  title: string;
  due: 'today' | 'tomorrow' | 'unknown';
  notes?: string;
  xp: number;
  hiddenRewards: Partial<Attributes>;
};

type SuggestionResponse = {
  suggestions: Suggestion[];
};

const normalize = (s: string): string =>
  s
    .toLowerCase()
    .replace(/[’']/g, "'")
    .replace(/[^a-z0-9\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const isDuplicateAgainstProtocol = (title: string, planned: string[]): boolean => {
  const t = normalize(title);
  if (!t) return true;
  // Exact-ish containment is enough for v1.
  return planned.some((p) => {
    const pn = normalize(p);
    return pn === t || pn.includes(t) || t.includes(pn);
  });
};

const getPlannedProtocolTitlesForDate = async (date: Date): Promise<string[]> => {
  // We only have a stable “full protocol” generator for today. For tomorrow we approximate:
  // - Physical comes from `getPhysicalDayPlan(date)`
  // - Mental + Spiritual are fixed titles in `generateDailyQuests()`
  const dayKey = getTodayKeyLocal(date);
  const physical = getPhysicalDayPlan(date);
  const fixed = [
    '15 Min Geography Study',
    '15 Min History Study',
    'Study Session 1 (45 Min)',
    'Study Session 2 (45 Min)',
    'Study Session 3 (45 Min)',
    'Study Session 4 (45 Min)',
    'Morning Adhkar',
    'Evening Adhkar',
    'Witr Salah',
    physical.title,
    physical.description,
    dayKey,
  ];

  // If date is today, use live quests too (covers future protocol changes).
  const todayKey = getTodayKeyLocal(new Date());
  if (dayKey === todayKey) {
    try {
      const quests = await getDailyQuests();
      return [
        ...new Set(
          quests.flatMap((q) => [q.title, q.description].filter(Boolean))
        ),
      ];
    } catch {
      return fixed;
    }
  }

  return fixed;
};

const splitListItems = (raw: string): string[] => {
  const cleaned = raw
    .replace(/\bplease\b/gi, ' ')
    .replace(/\bfor me\b/gi, ' ')
    .replace(/[.?!]+$/g, '')
    .trim();
  if (!cleaned) return [];
  // "buy coffee, make bed and floss" -> ["buy coffee", "make bed", "floss"]
  return cleaned
    .split(/,|\band\b|\bthen\b/gi)
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => s.replace(/^to\s+/i, '').trim())
    .filter(Boolean);
};

const computeDueDateKey = (message: string, today: Date): { dueKey: string; dueLabel: 'today' | 'tomorrow' } => {
  const m = message.toLowerCase();
  if (/\btomorrow\b/.test(m)) {
    const t = new Date(today);
    t.setDate(today.getDate() + 1);
    return { dueKey: getTodayKeyLocal(t), dueLabel: 'tomorrow' };
  }
  if (/\btoday\b/.test(m)) {
    return { dueKey: getTodayKeyLocal(today), dueLabel: 'today' };
  }
  return { dueKey: getTodayKeyLocal(today), dueLabel: 'today' };
};

const looksLikeToDoCommand = (message: string): boolean => {
  const m = message.toLowerCase();
  const mentionsToDo = /\bto-?do'?s?\b|\btodos\b|\bto do list\b/.test(m);
  const startsLikeCommand = /^\s*(add|create|put|remember|remind)\b/.test(m);
  return mentionsToDo && startsLikeCommand;
};

type PendingPayload = {
  titles: string[];
  createdAt: string;
};

const readPending = (): PendingPayload | null => {
  try {
    const raw = localStorage.getItem(TODO_PENDING_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PendingPayload;
    if (!parsed || typeof parsed !== 'object') return null;
    if (!Array.isArray(parsed.titles) || parsed.titles.length === 0) return null;
    return parsed;
  } catch {
    return null;
  }
};

const writePending = (titles: string[]): void => {
  const payload: PendingPayload = { titles, createdAt: new Date().toISOString() };
  localStorage.setItem(TODO_PENDING_KEY, JSON.stringify(payload));
};

const clearPending = (): void => {
  localStorage.removeItem(TODO_PENDING_KEY);
};

const parseTodayTomorrowAnswer = (message: string): 'today' | 'tomorrow' | null => {
  const m = message.toLowerCase();
  if (/\btomorrow\b/.test(m)) return 'tomorrow';
  if (/\btoday\b/.test(m)) return 'today';
  if (/\btonight\b/.test(m)) return 'today';
  return null;
};

export async function processInstructorToDosFromMessage(
  userMessage: string
): Promise<{ created: ToDoItem[]; clarification?: string }> {
  const now = new Date();
  const todayKey = getTodayKeyLocal(now);
  const tomorrow = new Date(now);
  tomorrow.setDate(now.getDate() + 1);
  const tomorrowKey = getTodayKeyLocal(tomorrow);

  // If we previously asked a clarification question, resolve it deterministically.
  const pending = readPending();
  if (pending) {
    const answer = parseTodayTomorrowAnswer(userMessage);
    if (!answer) {
      return { created: [], clarification: "Is this for **today** or **tomorrow**? (Reply: today/tomorrow)" };
    }
    const dueKey = answer === 'tomorrow' ? tomorrowKey : todayKey;
    const existing = getToDos();
    const created: ToDoItem[] = [];
    for (const rawTitle of pending.titles) {
      const title = String(rawTitle || '').trim();
      if (!title) continue;
      const dupe = existing.some(
        (t) => t.dueDate === dueKey && normalize(t.title) === normalize(title) && t.status !== 'ignored'
      );
      if (dupe) continue;
      created.push(
        addToDo({
          title,
          dueDate: dueKey,
          origin: 'ai',
          status: 'active',
          xp: 8,
          hiddenRewards: { PER: 1 },
          source: {
            type: 'instructor_chat',
            messageExcerpt: userMessage.slice(0, 200),
            timestamp: new Date().toISOString(),
          },
        })
      );
    }
    clearPending();
    return { created };
  }

  // Deterministic To-Do command path (high reliability, no LLM dependency).
  // Examples:
  // - "Add buy coffee to the to-do's"
  // - "Add buy coffee, make my bed and floss to the todos tomorrow"
  if (looksLikeToDoCommand(userMessage)) {
    const afterVerb = userMessage.replace(/^\s*(add|create|put|remember|remind)\b/i, '').trim();
    const withoutTail = afterVerb.replace(/\bto\s+(?:the\s+)?to-?do'?s?\b.*$/i, '').trim() || afterVerb;
    const items = splitListItems(withoutTail);
    const { dueKey } = computeDueDateKey(userMessage, now);
    const existing = getToDos();

    const created: ToDoItem[] = [];
    for (const title of items) {
      const dupeExisting = existing.some(
        (t) => t.dueDate === dueKey && normalize(t.title) === normalize(title) && t.status !== 'ignored'
      );
      if (dupeExisting) continue;
      created.push(
        addToDo({
          title,
          dueDate: dueKey,
          origin: 'ai',
          status: 'active',
          xp: 8,
          hiddenRewards: { PER: 1 },
          source: {
            type: 'instructor_chat',
            messageExcerpt: userMessage.slice(0, 200),
            timestamp: new Date().toISOString(),
          },
        })
      );
    }
    if (created.length > 0) return { created };
  }

  const plannedToday = await getPlannedProtocolTitlesForDate(now);
  const plannedTomorrow = await getPlannedProtocolTitlesForDate(tomorrow);

  const prompt = `
You are extracting actionable To-Do's from a Subject message.

Rules:
- Extract ONLY explicit commitments / actionable tasks (not feelings, not vague intentions).
- If a task is already part of the Daily Protocol for the same day, DO NOT suggest it.
- Return JSON only.

Today is ${todayKey}. Tomorrow is ${tomorrowKey}.

Daily Protocol (Today) includes:
${plannedToday.map((x) => `- ${x}`).join('\n')}

Daily Protocol (Tomorrow) includes:
${plannedTomorrow.map((x) => `- ${x}`).join('\n')}

Subject message:
"""${userMessage}"""

Output schema:
{
  "suggestions": [
    {
      "title": string,
      "due": "today" | "tomorrow" | "unknown",   // use "unknown" when the subject didn't specify
      "notes"?: string,
      "xp": number,                 // realistic, balanced (small chores 5-15, medium 15-35, hard 35-70)
      "hiddenRewards": {             // at most 2 stats, +1 to +2 each
        "STR"?: number, "AGI"?: number, "VIT"?: number,
        "INT"?: number, "PER"?: number, "WIS"?: number
      }
    }
  ]
}
`;

  const result = await aiGatewayClient.completeJson<SuggestionResponse>(prompt, {
    temperature: 0.25,
    maxTokens: 520,
  });

  const suggestions = Array.isArray(result?.suggestions) ? result.suggestions : [];
  const existing = getToDos();

  const created: ToDoItem[] = [];
  const needsDue: string[] = [];
  for (const s of suggestions) {
    if (!s || typeof s !== 'object') continue;
    const title = typeof s.title === 'string' ? s.title.trim() : '';
    if (!title) continue;

    if (s.due === 'unknown') {
      needsDue.push(title);
      continue;
    }

    const dueDate = s.due === 'tomorrow' ? tomorrowKey : todayKey;
    const planned = s.due === 'tomorrow' ? plannedTomorrow : plannedToday;
    if (isDuplicateAgainstProtocol(title, planned)) continue;

    const dupeExisting = existing.some((t) => t.dueDate === dueDate && normalize(t.title) === normalize(title) && t.status !== 'ignored');
    if (dupeExisting) continue;

    created.push(
      addToDo({
        title,
        notes: typeof s.notes === 'string' ? s.notes : undefined,
        dueDate,
        origin: 'ai',
        status: 'suggested',
        xp: Number(s.xp) || 10,
        hiddenRewards: (s.hiddenRewards || {}) as Partial<Attributes>,
        source: {
          type: 'instructor_chat',
          messageExcerpt: userMessage.slice(0, 200),
          timestamp: new Date().toISOString(),
        },
      })
    );
  }

  if (created.length > 0) return { created };
  if (needsDue.length > 0) {
    // Store pending titles and ask one crisp question.
    writePending(needsDue.slice(0, 3));
    const list = needsDue.slice(0, 3).map((t) => `"${t}"`).join(', ');
    return {
      created: [],
      clarification: `You mentioned ${list}. Is this for **today** or **tomorrow**?`,
    };
  }

  return { created: [] };
}

// Back-compat: previous name used by AIChat.
export async function extractInstructorToDosFromMessage(userMessage: string): Promise<ToDoItem[]> {
  const result = await processInstructorToDosFromMessage(userMessage);
  return result.created;
}

