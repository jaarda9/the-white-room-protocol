/**
 * Gate sync rules — pure functions, no imports (used by gates.ts and by the sync restore in
 * synced-localstorage-keys.ts without creating an import cycle).
 *
 * The Gate list used to sync as one block: a pull replaced the whole local list. A pull landing
 * between a local change and its push (startup pulls twice, the Dashboard pulls on focus) or a
 * second device's older copy could bring an abandoned Gate back, or drop a Gate created
 * elsewhere. Now:
 *  - every Gate carries `updatedAt` (ms), stamped by saveGates when it is created or changed;
 *  - a pull merges Gate by Gate: the newer `updatedAt` wins, Gates only one side has are kept;
 *  - an explicit deletion (abandon) writes a tombstone that both sides honour, so an old copy
 *    can never revive it. Tombstones also remember what an abandoned THEIA directive was about,
 *    so THEIA doesn't assign the same topic again.
 */

export const GATE_TOMBSTONES_KEY = 'wrp_gate_tombstones';
const TOMBSTONE_TTL_MS = 120 * 86_400_000;

export interface GateTombstone {
  /** ms timestamp of the deletion. */
  at: number;
  title?: string;
  origin?: string;
  chainId?: string;
  chainIndex?: number;
}

export type GateTombstones = Record<string, GateTombstone>;

export function parseTombstones(raw: unknown): GateTombstones {
  let v: unknown = raw;
  if (typeof raw === 'string') {
    try {
      v = JSON.parse(raw);
    } catch {
      return {};
    }
  }
  if (!v || typeof v !== 'object' || Array.isArray(v)) return {};
  const out: GateTombstones = {};
  const cutoff = Date.now() - TOMBSTONE_TTL_MS;
  for (const [id, t] of Object.entries(v as Record<string, any>)) {
    const at = Number(t?.at);
    if (!id || !Number.isFinite(at) || at < cutoff) continue;
    out[id] = {
      at,
      title: typeof t.title === 'string' ? t.title.slice(0, 160) : undefined,
      origin: typeof t.origin === 'string' ? t.origin : undefined,
      chainId: typeof t.chainId === 'string' ? t.chainId : undefined,
      chainIndex: Number.isFinite(Number(t.chainIndex)) ? Number(t.chainIndex) : undefined,
    };
  }
  return out;
}

/** Union of two tombstone sets (newest deletion time per id), expired ones dropped. */
export function mergeTombstones(a: unknown, b: unknown): GateTombstones {
  const left = parseTombstones(a);
  const right = parseTombstones(b);
  const out: GateTombstones = { ...left };
  for (const [id, t] of Object.entries(right)) {
    if (!out[id] || t.at > out[id].at) out[id] = { ...out[id], ...t };
  }
  return out;
}

const parseGateArray = (raw: unknown): any[] => {
  if (Array.isArray(raw)) return raw;
  if (typeof raw !== 'string' || !raw) return [];
  try {
    const v = JSON.parse(raw);
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
};

const stampOf = (g: any): number => {
  const n = Number(g?.updatedAt);
  return Number.isFinite(n) ? n : 0;
};

/**
 * Merges a pulled Gate list into the local one.
 *  - Both have it: the higher `updatedAt` wins (equal/missing on both: the pulled copy, which is
 *    what a pull always did before).
 *  - Only the pull has it: kept.
 *  - Only local has it: kept if it was written by this sync-aware code (has `updatedAt`) — a
 *    Gate created here and not pushed yet. A legacy local-only Gate (no stamp) follows the old
 *    rule, server wins, so a Gate deleted elsewhere before this change does not come back.
 *  - Tombstoned on either side: dropped.
 * Order: newest `createdAt` first (how the Gate list is always written).
 */
export function mergeGateLists(localRaw: unknown, incomingRaw: unknown, tombstones: GateTombstones): any[] {
  const local = parseGateArray(localRaw);
  const incoming = parseGateArray(incomingRaw);
  const byId = new Map<string, any>();
  for (const g of incoming) if (g?.id) byId.set(g.id, g);
  for (const g of local) {
    if (!g?.id) continue;
    const other = byId.get(g.id);
    if (!other) {
      if (stampOf(g) > 0) byId.set(g.id, g);
    } else if (stampOf(g) > stampOf(other)) {
      byId.set(g.id, g);
    }
  }
  for (const id of Object.keys(tombstones)) byId.delete(id);
  return [...byId.values()].sort(
    (a, b) => (Date.parse(b?.createdAt || '') || 0) - (Date.parse(a?.createdAt || '') || 0)
  );
}

/** Stable comparison of two Gate versions, ignoring the stamp itself. */
export function gateContentKey(g: any): string {
  if (!g || typeof g !== 'object') return '';
  const { updatedAt: _ignored, ...rest } = g;
  return JSON.stringify(rest);
}
