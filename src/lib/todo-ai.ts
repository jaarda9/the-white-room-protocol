import aiGatewayClient from '@/lib/ai-gateway-client';
import { getDailyQuests, getPhysicalDayPlan, getTodayKeyLocal, addToDo, getToDos } from '@/lib/storage';
import type { Attributes, ToDoItem } from '@/lib/types';

type Suggestion = {
  title: string;
  due: 'today' | 'tomorrow';
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

export async function extractInstructorToDosFromMessage(userMessage: string): Promise<ToDoItem[]> {
  const now = new Date();
  const todayKey = getTodayKeyLocal(now);
  const tomorrow = new Date(now);
  tomorrow.setDate(now.getDate() + 1);
  const tomorrowKey = getTodayKeyLocal(tomorrow);

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
      "due": "today" | "tomorrow",
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
  for (const s of suggestions) {
    if (!s || typeof s !== 'object') continue;
    const title = typeof s.title === 'string' ? s.title.trim() : '';
    if (!title) continue;

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

  return created;
}

