/**
 * One-way cleanup of data that leaked between Subjects on a shared device.
 *
 * Before the switch/upload guards existed (subject-auth.ts loginWithSubjectId wipe,
 * sync-manager isForeignSave, api/sync.ts mismatch check), a device's leftover data could be
 * uploaded into another account — a real account received the DEV "test-seed" Skill Tree along
 * with another Subject's Research progress. This runs after every initial restore and removes:
 *
 *  - Skill ledger entries created by the Profile DEV test button (taughtByChainGateId 'test-seed')
 *    on any account below that button's own level gate (100) — such an account cannot have
 *    seeded them itself. Their removal also stops THEIA from planning chain-Gates on top of
 *    "mastery" the Hunter never earned (chain-gates.ts reads the ledger).
 *  - Research / calendar keys namespaced to a DIFFERENT Subject id (invisible to this Subject
 *    anyway, but they would keep riding along in every save).
 *
 * Changes are pushed with the next sync, so the server copy is cleaned too.
 */
import { getSkillLedger, saveSkillLedger } from '@/lib/skill-ledger';

const TEST_SEED_GATE_ID = 'test-seed';
/** Matches the DEV TEST LABS gate in Profile.tsx. */
const DEV_TOOLS_MIN_LEVEL = 100;

const NAMESPACED_KEY = /^(?:quiz-score|knowledge-progress|research-progress-meta|whiteroom_calendar_events):([^:]+)/;

const normalize = (id: unknown) =>
  String(id || '')
    .replace(/^SUBJECT-/i, '')
    .trim()
    .toUpperCase();

/** Returns true when anything was removed (caller should sync). */
export const purgeLeakedSubjectData = (subjectId: string, level: number): boolean => {
  const owner = normalize(subjectId);
  if (!owner) return false;
  let changed = false;

  if (level < DEV_TOOLS_MIN_LEVEL) {
    const ledger = getSkillLedger();
    const removedIds = new Set(ledger.filter((s) => s.taughtByChainGateId === TEST_SEED_GATE_ID).map((s) => s.id));
    if (removedIds.size > 0) {
      saveSkillLedger(
        ledger
          .filter((s) => !removedIds.has(s.id))
          .map((s) => ({ ...s, parentIds: s.parentIds.filter((p) => !removedIds.has(p)) }))
      );
      console.warn(`[Hygiene] Removed ${removedIds.size} DEV test-seed skills from ${owner}.`);
      changed = true;
    }
  }

  const foreign: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    const match = key ? key.match(NAMESPACED_KEY) : null;
    if (key && match && normalize(match[1]) !== owner) foreign.push(key);
  }
  if (foreign.length > 0) {
    foreign.forEach((k) => localStorage.removeItem(k));
    console.warn(`[Hygiene] Removed ${foreign.length} keys belonging to other Subjects.`);
    changed = true;
  }

  return changed;
};
