/**
 * localStorage keys for AI-generated lab content + related progress that must sync
 * to MongoDB (same subject, different device) via /api/sync.
 */
import type { KnowledgeDomain } from '@/lib/types';
import { ACTIVE_PENALTY_KEY, PENALTY_LAST_CLEARED_AT_KEY } from '@/lib/penalty-system';

export const SYNCED_KNOWLEDGE_DOMAINS: KnowledgeDomain[] = [
  'science',
  'history',
  'geography',
  'economics',
  'politics',
];

const KNOWLEDGE_DATA_PREFIX = 'whiteroom_knowledge_data';
const RESEARCH_PROGRESS_PREFIX = 'knowledge-progress:';
const RESEARCH_QUIZ_SCORE_PREFIX = 'quiz-score:';
const RESEARCH_META_PREFIX = 'research-progress-meta:';
const LEGACY_RESEARCH_PROGRESS_PREFIX = 'knowledge-progress-';
const LEGACY_RESEARCH_QUIZ_SCORE_PREFIX = 'quiz-score-';
const LEGACY_RESEARCH_META_PREFIX = 'research-progress-meta';

/** Keys stored as raw JSON strings (same as localStorage values). */
export function getSyncedGenerationKeys(): string[] {
  const keys: string[] = [
    'wrp_ai_lab_mental',
    'wrp_ai_lab_physical',
    'wrp_ai_lab_social',
    'social-challenges',
    'wrp_nutrition_plan',
    'wrp_nutrition_log',
    'whiteroom_achievements',
    'wrp_codex_entries',
    'whiteroom_activity_ledger',
    'wrp_gates',
    'wrp_active_penalty_quest',
    'wrp_seals',
    'wrp_notifications',
    'wrp_skill_ledger', // THEIA chain-Gate skill/subject/habit/technique tree — see skill-ledger.ts
    // Found via audit: these four were real gaps, not deliberate exclusions — each is
    // meaningful player data with no reason to be device-local. Missing from here meant (a)
    // it never synced across devices, and (b) clearLocalProtocolData() (subject-auth.ts) never
    // wiped it on a new-subject/full-reset either, since that also just iterates this list —
    // so a new player on the same device could silently inherit the previous player's data.
    'whiteroom_hunter_protocol_config', // physical/mental prefs, custom weekly split + saved templates
    'whiteroom_hunter_inventory', // consumable items' daily-use counts and cooldowns
    'wrp_pending_penalty_assignment', // a missed day queued for Penalty Quest assignment
    PENALTY_LAST_CLEARED_AT_KEY, // anti-reappearance guard, above — needs to travel with the
    // account too, or a different device's stale pull could still paste a resolved quest back.
    'wrp_system_events_seen', // ambient [SYSTEM] notice dedupe — same local-only-marker bug
    // class as the old wrp_last_seen_rank issue: without this, a new device replays every
    // fatigue/streak/rank-approach notice the player already saw elsewhere.
  ];
  for (const d of SYNCED_KNOWLEDGE_DOMAINS) {
    keys.push(`wrp_knowledge_topic_${d}`);
    keys.push(`wrp_knowledge_quiz_${d}`);
    keys.push(`${KNOWLEDGE_DATA_PREFIX}_${d}`);
  }
  return keys;
}

export function mergeGenerationKeysIntoSyncBlob(target: Record<string, unknown>): void {
  for (const key of getSyncedGenerationKeys()) {
    const v = localStorage.getItem(key);
    if (v != null && v !== '') {
      target[key] = v;
    }
  }

  // Include user-scoped Research/Kinnu lab keys (dynamic keyspace).
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key) continue;
      if (
        !key.startsWith(RESEARCH_PROGRESS_PREFIX) &&
        !key.startsWith(RESEARCH_QUIZ_SCORE_PREFIX) &&
        !key.startsWith(RESEARCH_META_PREFIX)
      ) {
        continue;
      }
      const v = localStorage.getItem(key);
      if (v != null && v !== '') {
        target[key] = v;
      }
    }
  } catch {
    // ignore
  }
}

export function restoreGenerationKeysFromSyncBlob(source: Record<string, unknown>): void {
  for (const key of getSyncedGenerationKeys()) {
    const v = source[key];
    if (typeof v === 'string' && v.length > 0) {
      // ACTIVE_PENALTY_KEY has no per-key staleness protection like the profile object does
      // (see restoreToLocalStorage's lastSeenRank guard in sync-manager.ts) — it's just a flat
      // string overwritten unconditionally. Completing a Penalty Quest clears it locally and
      // pushes that in the background; if a pull lands before that push does, this would
      // otherwise paste the old, pre-completion quest right back. Skip restoring it if we've
      // already resolved a quest at least as new as the one being pulled.
      if (key === ACTIVE_PENALTY_KEY) {
        try {
          const clearedAt = localStorage.getItem(PENALTY_LAST_CLEARED_AT_KEY);
          const incomingAssignedAt = JSON.parse(v)?.assignedAt;
          if (clearedAt && incomingAssignedAt && new Date(incomingAssignedAt).getTime() <= new Date(clearedAt).getTime()) {
            continue;
          }
        } catch {
          // Not parseable as a quest — fall through and restore as-is.
        }
      }
      localStorage.setItem(key, v);
    }
  }

  // Restore dynamic Research/Kinnu lab keys from sync blob.
  for (const [key, value] of Object.entries(source)) {
    if (
      (
        key.startsWith(RESEARCH_PROGRESS_PREFIX) ||
        key.startsWith(RESEARCH_QUIZ_SCORE_PREFIX) ||
        key.startsWith(RESEARCH_META_PREFIX)
      ) &&
      typeof value === 'string' &&
      value.length > 0
    ) {
      localStorage.setItem(key, value);
    }
  }
}

/** New subject / full reset: remove generated content so a fresh subject does not inherit lab caches. */
export function clearSyncedGenerationKeys(): void {
  for (const key of getSyncedGenerationKeys()) {
    localStorage.removeItem(key);
  }

  // Clear dynamic Research/Kinnu lab keys.
  try {
    const dynamicKeys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k) continue;
      if (
        k.startsWith(RESEARCH_PROGRESS_PREFIX) ||
        k.startsWith(RESEARCH_QUIZ_SCORE_PREFIX) ||
        k.startsWith(RESEARCH_META_PREFIX) ||
        k.startsWith(LEGACY_RESEARCH_PROGRESS_PREFIX) ||
        k.startsWith(LEGACY_RESEARCH_QUIZ_SCORE_PREFIX) ||
        k === LEGACY_RESEARCH_META_PREFIX
      ) {
        dynamicKeys.push(k);
      }
    }
    dynamicKeys.forEach((k) => localStorage.removeItem(k));
  } catch {
    // ignore
  }

  // Also clear any per-subject calendar keys (these are synced too).
  try {
    const toRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith('whiteroom_calendar_events:')) {
        toRemove.push(k);
      }
    }
    toRemove.forEach((k) => localStorage.removeItem(k));
  } catch {
    // ignore
  }
}
