/**
 * Hunter Codex: a monthly, THEIA-narrated recap of the player's progress.
 * Deterministic rollup (from the activity ledger in storage.ts) + a short AI narrative,
 * with a 0-token System Archive fallback — same duality pattern as nutrition-lab.ts.
 */
import { aiGatewayClient } from '@/lib/ai-gateway-client';
import { getMonthlyRollup, type MonthlyRollup } from '@/lib/storage';
import { getGateStatsForMonth } from '@/lib/gates';
import type { UserProfile } from '@/lib/types';

export const CODEX_ENTRIES_KEY = 'wrp_codex_entries';
export const CODEX_UPDATED_EVENT = 'wrp:codex-updated';

export interface CodexEntry {
  monthKey: string; // YYYY-MM
  generatedAt: string;
  origin: 'ai' | 'system';
  narrative: string;
  rollup: MonthlyRollup;
}

export const getCurrentMonthKey = (d = new Date()): string => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
};

/** All months from the player's registration up to the current one, newest first. */
export const getEligibleMonthKeys = (profile: UserProfile): string[] => {
  const created = new Date(profile.createdAt);
  const cursor = new Date(created.getFullYear(), created.getMonth(), 1);
  const nowKey = getCurrentMonthKey();
  const keys: string[] = [];

  while (getCurrentMonthKey(cursor) <= nowKey) {
    keys.push(getCurrentMonthKey(cursor));
    cursor.setMonth(cursor.getMonth() + 1);
    if (keys.length > 240) break; // 20-year safety cap
  }
  return keys.reverse();
};

export const getStoredCodexEntries = (): Record<string, CodexEntry> => {
  try {
    const raw = localStorage.getItem(CODEX_ENTRIES_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
};

export const getCodexEntry = (monthKey: string): CodexEntry | null => {
  return getStoredCodexEntries()[monthKey] || null;
};

export const saveCodexEntry = (entry: CodexEntry): void => {
  try {
    const all = getStoredCodexEntries();
    all[entry.monthKey] = entry;
    localStorage.setItem(CODEX_ENTRIES_KEY, JSON.stringify(all));
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent(CODEX_UPDATED_EVENT));
    }
  } catch {
    // ignore
  }
};

const hunterName = (profile: UserProfile): string => profile.displayName || profile.pseudo || 'Hunter';

interface GateMonthStats {
  cleared: string[];
  breached: string[];
}

/** Precision Archive Builder (0 Tokens / Instant) — deterministic recap from the rollup alone. */
const buildFallbackNarrative = (profile: UserProfile, rollup: MonthlyRollup, gateStats: GateMonthStats): string => {
  if (!rollup.hasData && gateStats.cleared.length === 0 && gateStats.breached.length === 0) {
    return [
      `[SYSTEM ARCHIVE — ${rollup.monthLabel.toUpperCase()}]`,
      `No activity was logged for Hunter ${hunterName(profile)} this cycle. The System archives remain empty, awaiting your next directive.`,
    ].join('\n\n');
  }

  const rankUp = rollup.levelEnd > rollup.levelStart;
  const lines: string[] = [`[SYSTEM ARCHIVE — ${rollup.monthLabel.toUpperCase()}]`];

  lines.push(
    `Hunter ${hunterName(profile)} logged ${rollup.activeDays} active day${rollup.activeDays === 1 ? '' : 's'} this cycle, ` +
      `accumulating ${rollup.xpGained.toLocaleString()} EXP.` +
      (rankUp
        ? ` Level ${rollup.levelStart} was surpassed — current standing: Level ${rollup.levelEnd}.`
        : ` Current standing holds at Level ${rollup.levelEnd}.`)
  );

  if (rollup.longestStreakInMonth > 1) {
    lines.push(`Peak consistency recorded: a ${rollup.longestStreakInMonth}-day unbroken directive streak.`);
  }
  if (rollup.bestDay) {
    lines.push(`Highest single-day output: ${rollup.bestDay.xp.toLocaleString()} EXP on ${rollup.bestDay.date}.`);
  }
  if (rollup.achievementsUnlocked.length > 0) {
    lines.push(
      `${rollup.achievementsUnlocked.length} achievement${rollup.achievementsUnlocked.length === 1 ? '' : 's'} unlocked this cycle: ${rollup.achievementsUnlocked
        .map((a) => a.name)
        .join(', ')}.`
    );
  }
  if (gateStats.cleared.length > 0) {
    lines.push(`Gate${gateStats.cleared.length === 1 ? '' : 's'} cleared this cycle: ${gateStats.cleared.join(', ')}.`);
  }
  if (gateStats.breached.length > 0) {
    lines.push(
      `Gate${gateStats.breached.length === 1 ? '' : 's'} breached: ${gateStats.breached.join(', ')} — logged permanently, still open to clear.`
    );
  }

  lines.push('The System continues its observation. Proceed to the next cycle, Hunter.');
  return lines.join('\n\n');
};

const buildPrompt = (profile: UserProfile, rollup: MonthlyRollup, gateStats: GateMonthStats): string => `
Role: Solo Leveling System Archivist THEIA, writing a monthly Hunter Codex entry.
Hunter: ${hunterName(profile)}, Level ${rollup.levelEnd} (was Level ${rollup.levelStart} at cycle start).
Cycle: ${rollup.monthLabel}.
Stats: ${rollup.xpGained} EXP gained, ${rollup.activeDays} active day(s), longest streak ${rollup.longestStreakInMonth} day(s)${
  rollup.bestDay ? `, best single day ${rollup.bestDay.xp} EXP on ${rollup.bestDay.date}` : ''
}.
Achievements unlocked: ${rollup.achievementsUnlocked.length > 0 ? rollup.achievementsUnlocked.map((a) => a.name).join(', ') : 'none'}.
Gates cleared this cycle: ${gateStats.cleared.length > 0 ? gateStats.cleared.join(', ') : 'none'}.
Gates breached this cycle (deadline missed, not locked, still open): ${gateStats.breached.length > 0 ? gateStats.breached.join(', ') : 'none'}.
${!rollup.hasData && gateStats.cleared.length === 0 && gateStats.breached.length === 0 ? 'No activity was recorded this cycle — acknowledge the silence, do not invent activity.' : ''}
Write a short, personalized 3-paragraph System Archive entry in the Solo Leveling "System" voice — clinical but epic, second person ("Hunter"), referencing the specific numbers above. Plain text paragraphs separated by a blank line, no markdown, no headers. End with a short forward-looking directive for the next cycle.
`.trim();

export const generateCodexEntry = async (
  profile: UserProfile,
  monthKey: string,
  options?: { forceAlgorithmic?: boolean }
): Promise<CodexEntry> => {
  const rollup = getMonthlyRollup(monthKey, profile);
  const gateStatsRaw = getGateStatsForMonth(monthKey);
  const gateStats: GateMonthStats = {
    cleared: gateStatsRaw.cleared.map((g) => g.title),
    breached: gateStatsRaw.breached.map((g) => g.title),
  };

  if (options?.forceAlgorithmic) {
    const entry: CodexEntry = {
      monthKey,
      generatedAt: new Date().toISOString(),
      origin: 'system',
      narrative: buildFallbackNarrative(profile, rollup, gateStats),
      rollup,
    };
    saveCodexEntry(entry);
    return entry;
  }

  try {
    const prompt = buildPrompt(profile, rollup, gateStats);
    // thinkingBudget: 0 — this is directed creative writing from a fixed template, not a
    // reasoning task, so give the full token budget to visible prose (see nutrition-lab.ts).
    const narrative = await aiGatewayClient.complete(prompt, {
      temperature: 0.75,
      maxTokens: 500,
      thinkingBudget: 0,
      providerOverride: 'lab',
    });
    const cleaned = narrative.trim();
    if (!cleaned) throw new Error('Empty codex narrative');

    const entry: CodexEntry = {
      monthKey,
      generatedAt: new Date().toISOString(),
      origin: 'ai',
      narrative: cleaned,
      rollup,
    };
    saveCodexEntry(entry);
    return entry;
  } catch (error) {
    console.warn('Hunter Codex AI fallback to system archive:', error);
    const fallback: CodexEntry = {
      monthKey,
      generatedAt: new Date().toISOString(),
      origin: 'system',
      narrative: buildFallbackNarrative(profile, rollup, gateStats),
      rollup,
    };
    saveCodexEntry(fallback);
    return fallback;
  }
};
