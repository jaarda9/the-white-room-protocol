import aiGatewayClient from '@/lib/ai-gateway-client';
import { addToDo, getTodayKeyLocal, getToDos } from '@/lib/storage';
import type { Attributes, ToDoItem } from '@/lib/types';

const normalize = (s: string): string =>
  s
    .toLowerCase()
    .replace(/[’']/g, "'")
    .replace(/[^a-z0-9\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

/** Split freeform text into raw task fragments (no AI). */
export function splitTodoInputIntoRawItems(text: string): string[] {
  const trimmed = text.trim();
  if (!trimmed) return [];

  const pieces: string[] = [];
  for (const line of trimmed.split(/\r?\n/)) {
    const t = line.trim();
    if (!t) continue;
    const sub = t
      .split(/,|\band\b|\bthen\b/gi)
      .map((s) => s.trim())
      .filter(Boolean)
      .map((s) => s.replace(/^[\s•\-*]+/, '').trim())
      .filter(Boolean);
    pieces.push(...sub);
  }

  const seen = new Set<string>();
  const out: string[] = [];
  for (const p of pieces) {
    const key = normalize(p);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(p.slice(0, 200));
    if (out.length >= 15) break;
  }
  return out;
}

function dueDateKeyForFragment(raw: string, todayKey: string, tomorrowKey: string): string {
  return /\btomorrow\b/i.test(raw) ? tomorrowKey : todayKey;
}

type EnrichItem = {
  title: string;
  xp: number;
  hiddenRewards: Partial<Attributes>;
};

type EnrichResponse = {
  items: EnrichItem[];
};

function fallbackEnrich(raw: string): EnrichItem {
  const title = raw.trim().slice(0, 140) || 'To‑Do';
  const len = title.length;
  const xp = len < 25 ? 8 : len < 60 ? 14 : 22;
  return { title, xp, hiddenRewards: { PER: 1 } };
}

/**
 * Dashboard To‑Do parser: split text locally, then one small AI call to
 * rewrite labels for the UI and assign balanced XP + hiddenRewards only.
 * No protocol matching, no “when/where” reasoning beyond a dumb tomorrow keyword per line.
 */
export async function parseUserTodosFromInput(
  userText: string
): Promise<{ created: ToDoItem[]; hint?: string }> {
  const raws = splitTodoInputIntoRawItems(userText);
  if (raws.length === 0) {
    return { created: [], hint: 'No tasks found. Try separate lines or commas.' };
  }

  const now = new Date();
  const todayKey = getTodayKeyLocal(now);
  const tomorrow = new Date(now);
  tomorrow.setDate(now.getDate() + 1);
  const tomorrowKey = getTodayKeyLocal(tomorrow);

  const prompt = `You help format a To-Do list for a gamified app.

Your job is ONLY:
1) Rewrite each raw fragment into a short, clear title for the UI (fix typos; keep meaning; max ~90 chars each).
2) Assign realistic, balanced rewards: xp roughly 6–55 for normal life tasks; hiddenRewards uses at most TWO of STR, AGI, VIT, INT, PER, WIS with values 1 or 2 each, matching the task vibe.

Do NOT infer schedules, locations, or calendar logic. Do not drop items.

Return JSON only, exactly this shape:
{"items":[{"title":"string","xp":number,"hiddenRewards":{"PER":1}}]}

There must be exactly ${raws.length} items in the same order as the list below.

Raw fragments:
${raws.map((r, i) => `${i + 1}. ${r}`).join('\n')}
`;

  let enriched: EnrichItem[] = [];
  try {
    const result = await aiGatewayClient.completeJson<EnrichResponse>(prompt, {
      temperature: 0.2,
      maxTokens: Math.min(900, 120 + raws.length * 120),
    });
    enriched = Array.isArray(result?.items) ? result.items : [];
  } catch {
    enriched = [];
  }

  const existing = getToDos();
  const created: ToDoItem[] = [];

  for (let i = 0; i < raws.length; i++) {
    const raw = raws[i];
    const dueDate = dueDateKeyForFragment(raw, todayKey, tomorrowKey);
    const e = enriched[i] && typeof enriched[i].title === 'string' ? enriched[i] : fallbackEnrich(raw);
    const title = String(e.title || raw).trim().slice(0, 140) || fallbackEnrich(raw).title;

    const dupe = existing.some(
      (t) =>
        t.dueDate === dueDate &&
        normalize(t.title) === normalize(title) &&
        t.status !== 'ignored'
    );
    if (dupe) continue;

    created.push(
      addToDo({
        title,
        dueDate,
        origin: 'ai',
        status: 'active',
        xp: Number(e.xp) || fallbackEnrich(raw).xp,
        hiddenRewards: (e.hiddenRewards || {}) as Partial<Attributes>,
        source: {
          type: 'instructor_chat',
          messageExcerpt: userText.slice(0, 200),
          timestamp: new Date().toISOString(),
        },
      })
    );
  }

  if (created.length === 0) {
    return { created: [], hint: 'Nothing new to add (duplicates skipped).' };
  }
  return { created, hint: `Added ${created.length} To‑Do${created.length === 1 ? '' : 's'}.` };
}

/** @deprecated Use parseUserTodosFromInput — kept for import stability. */
export async function inferInstructorToDosWithAI(
  userText: string
): Promise<{ created: ToDoItem[]; clarification?: string }> {
  const r = await parseUserTodosFromInput(userText);
  return { created: r.created, clarification: r.hint };
}

/** Legacy no-op for any old callers — Instructor chat does not use To‑Do extraction. */
export async function extractInstructorToDosFromMessage(_userMessage: string): Promise<ToDoItem[]> {
  return [];
}
