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
}

export function restoreGenerationKeysFromSyncBlob(source: Record<string, unknown>): void {
  for (const key of getSyncedGenerationKeys()) {
    const v = source[key];
    if (typeof v === 'string' && v.length > 0) {
      localStorage.setItem(key, v);
    }
  }
}

/** New subject / full reset: remove generated content so a fresh subject does not inherit lab caches. */
export function clearSyncedGenerationKeys(): void {
  for (const key of getSyncedGenerationKeys()) {
    localStorage.removeItem(key);
  }
}
