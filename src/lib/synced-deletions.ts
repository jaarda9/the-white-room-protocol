/**
 * Deletions that must reach the other device.
 *
 * A pull only writes the keys present in the pulled copy, so deleting a synced key on one device
 * used to leave the other device's copy in place — and that device's next upload put it back on
 * the server (a dismissed nutrition blueprint returning, a consumed penalty assignment being
 * turned into a second, duplicate Penalty Quest).
 *
 * Now a deletion is recorded with a fingerprint of the value that was deleted. On restore
 * (synced-localstorage-keys.ts) both sides' records are merged, a local copy matching a deleted
 * fingerprint is removed, and a pulled copy matching it is not restored. A NEW value (different
 * fingerprint) is restored normally, so recreating the item later is never blocked.
 *
 * No imports besides sync-signal, so any module can use it without import cycles.
 */
import { requestSync } from '@/lib/sync-signal';

export const DELETED_SYNCED_KEYS_KEY = 'wrp_deleted_synced_keys';
const TTL_MS = 60 * 86_400_000;

export interface DeletionRecord {
  /** ms timestamp of the deletion */
  at: number;
  /** fingerprint of the value that was deleted */
  hash: string;
}
export type DeletionRecords = Record<string, DeletionRecord>;

/** Same fingerprint everywhere (FNV-1a + length). */
export function fingerprint(v: string | null): string {
  if (v === null) return '-';
  let h = 0x811c9dc5;
  for (let i = 0; i < v.length; i++) {
    h ^= v.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return `${v.length}:${h.toString(36)}`;
}

export function parseDeletionRecords(raw: unknown): DeletionRecords {
  let v: unknown = raw;
  if (typeof raw === 'string') {
    try {
      v = JSON.parse(raw);
    } catch {
      return {};
    }
  }
  if (!v || typeof v !== 'object' || Array.isArray(v)) return {};
  const out: DeletionRecords = {};
  const cutoff = Date.now() - TTL_MS;
  for (const [k, r] of Object.entries(v as Record<string, any>)) {
    const at = Number(r?.at);
    if (k && Number.isFinite(at) && at >= cutoff && typeof r?.hash === 'string') out[k] = { at, hash: r.hash };
  }
  return out;
}

/** Union of two record sets; per key the newer deletion wins. */
export function mergeDeletionRecords(a: unknown, b: unknown): DeletionRecords {
  const out = parseDeletionRecords(a);
  for (const [k, r] of Object.entries(parseDeletionRecords(b))) {
    if (!out[k] || r.at > out[k].at) out[k] = r;
  }
  return out;
}

/** Deletes a synced key on this device AND on every other device of the account. */
export function removeSyncedKey(key: string): void {
  try {
    const current = localStorage.getItem(key);
    if (current !== null) {
      const records = parseDeletionRecords(localStorage.getItem(DELETED_SYNCED_KEYS_KEY));
      records[key] = { at: Date.now(), hash: fingerprint(current) };
      localStorage.setItem(DELETED_SYNCED_KEYS_KEY, JSON.stringify(records));
    }
    localStorage.removeItem(key);
    requestSync();
  } catch {
    // storage unavailable: nothing to delete
  }
}
