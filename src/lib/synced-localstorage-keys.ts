/**
 * localStorage keys for AI-generated lab content + related progress that must sync
 * to MongoDB (same subject, different device) via /api/sync.
 */
import type { KnowledgeDomain } from '@/lib/types';

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
const LEGACY_RESEARCH_PROGRESS_PREFIX = 'knowledge-progress-';
const LEGACY_RESEARCH_QUIZ_SCORE_PREFIX = 'quiz-score-';

/** Keys stored as raw JSON strings (same as localStorage values). */
export function getSyncedGenerationKeys(): string[] {
  const keys: string[] = [
    'wrp_ai_lab_mental',
    'wrp_ai_lab_physical',
    'wrp_ai_lab_social',
    'social-challenges',
    'whiteroom_achievements',
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
      if (!key.startsWith(RESEARCH_PROGRESS_PREFIX) && !key.startsWith(RESEARCH_QUIZ_SCORE_PREFIX)) {
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
      localStorage.setItem(key, v);
    }
  }

  // Restore dynamic Research/Kinnu lab keys from sync blob.
  for (const [key, value] of Object.entries(source)) {
    if (
      (key.startsWith(RESEARCH_PROGRESS_PREFIX) || key.startsWith(RESEARCH_QUIZ_SCORE_PREFIX)) &&
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
        k.startsWith(LEGACY_RESEARCH_PROGRESS_PREFIX) ||
        k.startsWith(LEGACY_RESEARCH_QUIZ_SCORE_PREFIX)
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
