/**
 * Daily Variable (Phase B): one optional twist on one directive per day, for bonus EXP.
 *
 * THEIA proposes tomorrow's Variable in the evening review (theia-evening.ts); this file is the
 * code that stays in charge of it: which directives and twist types are allowed, the bonus
 * amount, strict limits on physical twists, and a hand-written fallback so a day always has
 * one even when the AI is unavailable. Never mandatory, never a penalty.
 */
import type { Quest } from '@/lib/types';
import { getDirectiveKey, type DirectiveKey } from '@/lib/quest-content';
import { requestSync } from '@/lib/sync-signal';

export const VARIABLE_KEY = 'wrp_daily_variable';

export type VariableType = 'focus' | 'environment' | 'technique' | 'volume';
export type VariableDirective = 'reading' | 'study' | 'work1' | 'meditation' | 'reflection' | 'gratitude' | 'physical';

export const VARIABLE_DIRECTIVES: VariableDirective[] = ['reading', 'study', 'work1', 'meditation', 'reflection', 'gratitude', 'physical'];

/** Twist types allowed per directive. Physical volume text is always written by code. */
export const ALLOWED_TYPES: Record<VariableDirective, VariableType[]> = {
  reading: ['focus', 'environment', 'technique'],
  study: ['focus', 'environment', 'technique'],
  work1: ['focus', 'environment', 'technique'],
  meditation: ['focus', 'environment', 'technique'],
  reflection: ['focus', 'technique'],
  gratitude: ['technique'],
  physical: ['focus', 'technique', 'volume'],
};

export interface DailyVariable {
  date: string;
  directive: VariableDirective;
  type: VariableType;
  text: string;
  /** Why THEIA chose it (shown small). Empty for the fallback. */
  reason: string;
  bonusXp: number;
  source: 'ai' | 'system';
  claimed: boolean;
}

/** Hand-written twists: the fallback, and the only text ever used for physical volume. */
const LIBRARY: Record<VariableDirective, Array<{ type: VariableType; text: string }>> = {
  reading: [
    { type: 'focus', text: 'Phone in another room for the whole session.' },
    { type: 'environment', text: 'Read somewhere you have never read before.' },
    { type: 'technique', text: 'Before closing the book, write one question the text raised.' },
  ],
  study: [
    { type: 'technique', text: 'Open with 5 minutes of recall from memory before touching the material.' },
    { type: 'focus', text: 'One tab, one document. Close everything else.' },
    { type: 'environment', text: 'Study sitting upright at a desk. No bed, no sofa.' },
  ],
  work1: [
    { type: 'focus', text: 'No breaks until the timer ends.' },
    { type: 'environment', text: 'Work in silence. No music.' },
    { type: 'technique', text: 'Write the session’s single goal before you start. Check it at the end.' },
  ],
  meditation: [
    { type: 'technique', text: 'Breathe out twice as long as you breathe in.' },
    { type: 'environment', text: 'Meditate outside, or beside an open window.' },
    { type: 'focus', text: 'Count breaths to 100. Lose count, start again.' },
  ],
  reflection: [
    { type: 'technique', text: 'Name the exact moment today turned — for better or worse.' },
    { type: 'focus', text: 'One sentence per answer. No softening.' },
  ],
  gratitude: [{ type: 'technique', text: 'One of the three must be a person you will thank directly today.' }],
  physical: [
    { type: 'volume', text: 'One extra set on your first exercise.' },
    { type: 'technique', text: 'Lower every rep over three seconds.' },
    { type: 'focus', text: 'Rest no more than 90 seconds between sets.' },
  ],
};

const RANKS = ['E', 'D', 'C', 'B', 'A', 'S'];
const rankIdx = (level: number) => Math.min(5, Math.max(0, Math.floor(Math.max(1, level) / 10)));
/** Set by code, never by the AI: E 20 … S 45. */
export const variableBonusXp = (level: number) => 20 + 5 * rankIdx(level);
export const rankLetter = (level: number) => RANKS[rankIdx(level)];

const hash01 = (seed: string) => {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) / 4294967296;
};

/** Directives that can carry today's Variable: present, mandatory (not bonus) and supported. */
export function eligibleDirectives(quests: Quest[]): VariableDirective[] {
  const out: VariableDirective[] = [];
  for (const q of quests) {
    if (q.origin !== 'system' || q.isChainBonus) continue;
    const key = getDirectiveKey(q) as DirectiveKey | null;
    if (key && (VARIABLE_DIRECTIVES as string[]).includes(key) && !out.includes(key as VariableDirective)) {
      out.push(key as VariableDirective);
    }
  }
  return out;
}

export function systemVariable(date: string, directives: VariableDirective[], level: number): DailyVariable | null {
  if (directives.length === 0) return null;
  const directive = directives[Math.floor(hash01(`${date}|var|d`) * directives.length)];
  const options = LIBRARY[directive];
  const pick = options[Math.floor(hash01(`${date}|var|t`) * options.length)];
  return {
    date,
    directive,
    type: pick.type,
    text: pick.text,
    reason: '',
    bonusXp: variableBonusXp(level),
    source: 'system',
    claimed: false,
  };
}

const PHYSICAL_RISK = /(\d+\s*(kg|kilo|lb|lbs|%|percent|minutes?|reps?|sets?|km|miles?))|max(imum)?|failure|until you|through (the )?pain|fast(ing)?|no (water|food)|skip (the )?warm/i;

/**
 * Validates THEIA's proposal against the rules. Returns null when it cannot be used (the caller
 * then keeps the fallback). Physical volume always gets the code's own text.
 */
export function sanitizeProposal(
  raw: any,
  date: string,
  directives: VariableDirective[],
  level: number
): DailyVariable | null {
  const directive = String(raw?.directive || '') as VariableDirective;
  const type = String(raw?.type || '') as VariableType;
  if (!directives.includes(directive)) return null;
  if (!ALLOWED_TYPES[directive]?.includes(type)) return null;
  const clean = (v: unknown, max: number) =>
    String(v || '')
      .replace(/[\r\n\t]+/g, ' ')
      .replace(/^["'\s]+|["'\s]+$/g, '')
      .replace(/\s+/g, ' ')
      .slice(0, max);
  let text = clean(raw?.text, 140);
  const reason = clean(raw?.reason, 160);
  if (directive === 'physical') {
    if (type === 'volume') text = LIBRARY.physical[0].text;
    else if (PHYSICAL_RISK.test(text)) return null;
  }
  if (text.length < 8) return null;
  return { date, directive, type, text, reason, bonusXp: variableBonusXp(level), source: 'ai', claimed: false };
}

// ---------------------------------------------------------------------------
// Storage: one Variable per local date, last few kept.
// ---------------------------------------------------------------------------

function readAll(): Record<string, DailyVariable> {
  try {
    const parsed = JSON.parse(localStorage.getItem(VARIABLE_KEY) || '{}');
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function writeAll(all: Record<string, DailyVariable>) {
  const keep = Object.keys(all).sort().slice(-4);
  const trimmed: Record<string, DailyVariable> = {};
  for (const k of keep) trimmed[k] = all[k];
  try {
    localStorage.setItem(VARIABLE_KEY, JSON.stringify(trimmed));
  } catch {
    // ignore
  }
  requestSync();
}

export function getVariable(date: string): DailyVariable | null {
  return readAll()[date] || null;
}

export function setVariable(v: DailyVariable): void {
  const all = readAll();
  if (all[v.date]?.claimed) return; // never replace a Variable already cleared
  all[v.date] = v;
  writeAll(all);
}

/**
 * Today's Variable, guaranteed to sit on a directive that exists today: a stored one whose
 * directive is gone (rank change, calibration) is replaced by the fallback.
 */
export function ensureVariable(date: string, quests: Quest[], level: number): DailyVariable | null {
  const directives = eligibleDirectives(quests);
  const stored = getVariable(date);
  if (stored && (stored.claimed || directives.includes(stored.directive))) return stored;
  const fallback = systemVariable(date, directives, level);
  if (fallback) setVariable(fallback);
  return fallback;
}

/** Marks today's Variable cleared. Returns the bonus to pay, or 0 if already claimed / missing. */
export function claimVariable(date: string): number {
  const all = readAll();
  const v = all[date];
  if (!v || v.claimed) return 0;
  all[date] = { ...v, claimed: true };
  writeAll(all);
  return v.bonusXp;
}
