/**
 * Just-in-time setup. Registration asks only for what the System cannot work without (name, PIN,
 * AI key); the rest starts from sensible defaults and is asked the first time it matters:
 *   - 'book'    — the first reading directive (QuestSession)
 *   - 'study'   — the first Field Mastery directive (QuestSession)
 *   - 'routine' — the first visit to the Physical Lab
 * Body data is asked by the Nutrition Lab's own "starting estimate" banner.
 *
 * Only Hunters registered through the short flow get pending prompts; players who calibrated at
 * the old long sign-up never see them. Synced, so a prompt answered on one device is gone on all.
 */
import { requestSync } from '@/lib/sync-signal';

export const SETUP_PROMPTS_KEY = 'wrp_setup_prompts';
export type SetupPromptId = 'book' | 'study' | 'routine';
const ALL: SetupPromptId[] = ['book', 'study', 'routine'];

interface SetupPromptState {
  pending: SetupPromptId[];
}

function read(): SetupPromptState {
  try {
    const v = JSON.parse(localStorage.getItem(SETUP_PROMPTS_KEY) || 'null');
    if (v && Array.isArray(v.pending)) return { pending: v.pending.filter((x: unknown) => ALL.includes(x as SetupPromptId)) };
  } catch {
    // ignore
  }
  return { pending: [] };
}

function write(state: SetupPromptState): void {
  try {
    localStorage.setItem(SETUP_PROMPTS_KEY, JSON.stringify(state));
    requestSync();
  } catch {
    // ignore
  }
}

/** Called once by the short registration flow. */
export function initSetupPrompts(): void {
  write({ pending: [...ALL] });
}

export function isSetupPending(id: SetupPromptId): boolean {
  return read().pending.includes(id);
}

/** Answered or dismissed: never asked again (on any device). */
export function completeSetupPrompt(id: SetupPromptId): void {
  const state = read();
  if (!state.pending.includes(id)) return;
  write({ pending: state.pending.filter((x) => x !== id) });
}
