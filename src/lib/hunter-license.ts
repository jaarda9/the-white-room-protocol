/**
 * Hunter License: the player's identity card (Profile, Leaderboard).
 *
 * - License No. is derived from the PUBLIC handle (H-XXXXXXXX), never from the Subject ID:
 *   the Subject ID is a login credential and the card is meant to be shown and shared.
 * - Categories (hunter classes) come from real attributes: one MAIN class (highest stat) plus
 *   close secondaries and advanced pairs. Stats start at 10 and gain +1 per allocated point.
 * - The photo is a small JPEG data URL (~20 KB) kept in localStorage and synced in the save
 *   blob, so it follows the account to other devices. It is never sent to other players.
 */
import type { Attributes } from '@/lib/types';
import { requestSync } from '@/lib/sync-signal';

export type LicenseRank = 'E' | 'D' | 'C' | 'B' | 'A' | 'S';
export const LICENSE_RANKS: LicenseRank[] = ['E', 'D', 'C', 'B', 'A', 'S'];

export const LICENSE_PHOTO_KEY = 'wrp_license_photo';
export const LICENSE_RANK_KEY = 'wrp_license_rank';
const HANDLE_CACHE_KEY = 'wrp_my_handle';

/**
 * Class rules:
 * - MAIN: the base class of the highest attribute, once it reaches MAIN_CLASS_AT. Ties are
 *   broken by training history (accumulatedPoints from completed quests), then by grid order,
 *   so the main class doesn't flip between equal stats.
 * - SECONDARY: at most MAX_SECONDARY other base classes (strongest first) whose attribute is
 *   at least MAIN_CLASS_AT and within SECONDARY_WITHIN of the highest.
 * - ADVANCED: both of its attributes are the Hunter's top two and at least ADVANCED_CLASS_AT.
 */
export const MAIN_CLASS_AT = 15;
export const SECONDARY_WITHIN = 3;
export const MAX_SECONDARY = 2;
export const ADVANCED_CLASS_AT = 20;

type StatKey = keyof Attributes;
export interface LicenseClass {
  name: string;
  stats: StatKey[];
}

/** The 3×3 Category grid, in display order (also the final tie-break order). */
export const LICENSE_CLASSES: LicenseClass[] = [
  { name: 'Fighter', stats: ['STR'] },
  { name: 'Assassin', stats: ['AGI'] },
  { name: 'Tank', stats: ['VIT'] },
  { name: 'Mage', stats: ['INT'] },
  { name: 'Ranger', stats: ['PER'] },
  { name: 'Healer', stats: ['WIS'] },
  { name: 'Duelist', stats: ['STR', 'AGI'] },
  { name: 'Strategist', stats: ['INT', 'PER'] },
  { name: 'Paladin', stats: ['VIT', 'WIS'] },
];

const STAT_KEYS: StatKey[] = ['STR', 'AGI', 'VIT', 'INT', 'PER', 'WIS'];

const numOr = (obj: object | null | undefined, k: StatKey, fallback: number): number => {
  const n = Number((obj as Record<string, unknown> | null | undefined)?.[k]);
  return Number.isFinite(n) ? n : fallback;
};
const statOf = (stats: object | null | undefined, k: StatKey): number => numOr(stats, k, 10);

export type ClassStatus = 'main' | 'advanced' | 'secondary' | 'locked';

/** Attributes from strongest to weakest, ties broken by training history then grid order. */
export function rankedStats(stats: object | null | undefined, points?: object | null): StatKey[] {
  return [...STAT_KEYS].sort(
    (a, b) =>
      statOf(stats, b) - statOf(stats, a) ||
      numOr(points, b, 0) - numOr(points, a, 0) ||
      STAT_KEYS.indexOf(a) - STAT_KEYS.indexOf(b)
  );
}

/** Each grid slot with its status for this Hunter. */
export function licenseCategories(stats: object | null | undefined, points?: object | null) {
  const order = rankedStats(stats, points);
  const top = order[0];
  const topVal = statOf(stats, top);
  const topTwo = new Set(order.slice(0, 2));
  const hasMain = topVal >= MAIN_CLASS_AT;
  const secondary = new Set(
    hasMain
      ? order
          .slice(1)
          .filter((k) => statOf(stats, k) >= MAIN_CLASS_AT && topVal - statOf(stats, k) <= SECONDARY_WITHIN)
          .slice(0, MAX_SECONDARY)
      : []
  );
  return LICENSE_CLASSES.map((c) => {
    let status: ClassStatus = 'locked';
    if (c.stats.length === 1) {
      if (hasMain && c.stats[0] === top) status = 'main';
      else if (secondary.has(c.stats[0])) status = 'secondary';
    } else if (c.stats.every((k) => topTwo.has(k) && statOf(stats, k) >= ADVANCED_CLASS_AT)) {
      status = 'advanced';
    }
    return { ...c, status, unlocked: status !== 'locked' };
  });
}

/** The main class name, or '' while no attribute has reached MAIN_CLASS_AT. */
export function mainClassName(stats: object | null | undefined, points?: object | null): string {
  return licenseCategories(stats, points).find((c) => c.status === 'main')?.name || '';
}

/** Training history per attribute as plain numbers (missing = 0). */
export function normalizedPoints(points: object | null | undefined): Attributes {
  return {
    STR: numOr(points, 'STR', 0),
    AGI: numOr(points, 'AGI', 0),
    VIT: numOr(points, 'VIT', 0),
    INT: numOr(points, 'INT', 0),
    PER: numOr(points, 'PER', 0),
    WIS: numOr(points, 'WIS', 0),
  };
}

export function normalizedStats(stats: object | null | undefined): Attributes {
  return {
    STR: statOf(stats, 'STR'),
    AGI: statOf(stats, 'AGI'),
    VIT: statOf(stats, 'VIT'),
    INT: statOf(stats, 'INT'),
    PER: statOf(stats, 'PER'),
    WIS: statOf(stats, 'WIS'),
  };
}

/** Deterministic 32-bit FNV-1a. */
function fnv(str: string, seed = 0x811c9dc5): number {
  let h = seed >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

/** 12-digit License No. from the public handle; '' without a handle. Never starts with 0. */
export function licenseNumber(handle: string | undefined | null): string {
  const h = String(handle || '').trim().toUpperCase();
  if (!h) return '';
  const a = String(fnv(h) % 1_000_000).padStart(6, '0');
  const b = String(fnv(h, 0x9e3779b9) % 1_000_000).padStart(6, '0');
  const digits = a + b;
  return (digits[0] === '0' ? String((fnv(h, 7) % 9) + 1) : digits[0]) + digits.slice(1);
}

/** Barcode bar widths (1–3 units each), unique per License No. */
export function barcodeBars(seed: string, count = 34): number[] {
  const out: number[] = [];
  let h = fnv(seed || 'WRP');
  for (let i = 0; i < count; i++) {
    h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d) >>> 0;
    out.push((h % 3) + 1);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Own handle (needed for the own License No.; the server is the source of truth)
// ---------------------------------------------------------------------------

export function getCachedHandle(subjectId: string | undefined): string {
  try {
    const raw = JSON.parse(localStorage.getItem(HANDLE_CACHE_KEY) || 'null');
    if (raw && raw.subject === subjectId && typeof raw.handle === 'string') return raw.handle;
  } catch {
    // ignore
  }
  return '';
}

/** Asks the server for this account's handle (session-authenticated) and caches it per subject. */
export async function fetchOwnHandle(subjectId: string | undefined): Promise<string> {
  const cached = getCachedHandle(subjectId);
  if (cached) return cached;
  try {
    const res = await fetch('/api/sync?action=session');
    if (!res.ok) return '';
    const data = await res.json();
    const handle = typeof data?.handle === 'string' ? data.handle.toUpperCase() : '';
    if (handle && data?.subjectId && (!subjectId || String(data.subjectId).toUpperCase() === String(subjectId).toUpperCase())) {
      try {
        localStorage.setItem(HANDLE_CACHE_KEY, JSON.stringify({ subject: subjectId, handle }));
      } catch {
        // storage full: the handle is just re-fetched next time
      }
      return handle;
    }
  } catch {
    // offline: the card shows a pending number
  }
  return '';
}

// ---------------------------------------------------------------------------
// Photo
// ---------------------------------------------------------------------------

interface StoredPhoto {
  /** ms timestamp of the change: the newer side wins when a sync restore meets a local edit. */
  at: number;
  /** JPEG data URL, or '' when removed. */
  url: string;
}

function readStoredPhoto(raw: string | null): StoredPhoto | null {
  if (!raw) return null;
  if (raw.startsWith('data:image/')) return { at: 0, url: raw };
  try {
    const v = JSON.parse(raw);
    if (v && typeof v === 'object' && Number.isFinite(Number(v.at))) {
      return { at: Number(v.at), url: typeof v.url === 'string' && v.url.startsWith('data:image/') ? v.url : '' };
    }
  } catch {
    // unreadable: treated as no photo
  }
  return null;
}

/** The stored photo data URL, or ''. */
export function getLicensePhoto(): string {
  try {
    return readStoredPhoto(localStorage.getItem(LICENSE_PHOTO_KEY))?.url || '';
  } catch {
    return '';
  }
}

/** Saves (or with null removes) the photo. Removal is stored too, so a stale sync can't revive it. */
export function setLicensePhoto(dataUrl: string | null): boolean {
  try {
    const url = dataUrl && dataUrl.startsWith('data:image/') ? dataUrl : '';
    localStorage.setItem(LICENSE_PHOTO_KEY, JSON.stringify({ at: Date.now(), url } satisfies StoredPhoto));
    requestSync();
    return true;
  } catch {
    return false;
  }
}

/**
 * Sync restore guard (synced-localstorage-keys.ts): true when the local value must be kept over
 * the incoming one. A pull can land between a local change and its (debounced) push; without
 * this it would paste the older server copy back — reviving a removed photo, or rewinding the
 * license rank and replaying the re-issue ceremony.
 */
export function keepLocalLicenseValue(key: string, local: string | null, incoming: string): boolean {
  if (!local) return false;
  if (key === LICENSE_RANK_KEY) {
    return LICENSE_RANKS.indexOf(local as LicenseRank) > LICENSE_RANKS.indexOf(incoming as LicenseRank);
  }
  if (key === LICENSE_PHOTO_KEY) {
    const l = readStoredPhoto(local);
    const i = readStoredPhoto(incoming);
    return Boolean(l && (!i || l.at > i.at));
  }
  return false;
}

const PHOTO_W = 240;
const PHOTO_H = 300;
const PHOTO_MAX_CHARS = 60_000;

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('This image format cannot be read. Try a JPG or PNG.'));
    };
    img.src = url;
  });
}

/** Center-crops to the license frame (4:5) and compresses to a small JPEG data URL. */
export async function processLicensePhoto(file: File): Promise<string> {
  if (!file.type.startsWith('image/') && !/\.(jpe?g|png|webp|gif|bmp|heic|heif)$/i.test(file.name)) {
    throw new Error('Pick an image file.');
  }
  if (file.size > 25 * 1024 * 1024) throw new Error('That image is too large (max 25 MB).');
  const img = await loadImage(file);
  const sw = img.naturalWidth;
  const sh = img.naturalHeight;
  if (!sw || !sh) throw new Error('This image could not be read.');
  const target = PHOTO_W / PHOTO_H;
  let cw = sw;
  let ch = sw / target;
  if (ch > sh) {
    ch = sh;
    cw = sh * target;
  }
  // Portraits: keep a little more of the top (faces sit in the upper third).
  const sx = (sw - cw) / 2;
  const sy = Math.max(0, Math.min(sh - ch, (sh - ch) * 0.3));
  const canvas = document.createElement('canvas');
  canvas.width = PHOTO_W;
  canvas.height = PHOTO_H;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('This device cannot process images.');
  ctx.fillStyle = '#0a1b2e';
  ctx.fillRect(0, 0, PHOTO_W, PHOTO_H);
  ctx.drawImage(img, sx, sy, cw, ch, 0, 0, PHOTO_W, PHOTO_H);
  for (const q of [0.82, 0.7, 0.58, 0.45]) {
    const url = canvas.toDataURL('image/jpeg', q);
    if (url.length <= PHOTO_MAX_CHARS) return url;
  }
  throw new Error('This image could not be compressed enough.');
}

// ---------------------------------------------------------------------------
// Re-issue on rank-up
// ---------------------------------------------------------------------------

/**
 * Compares the rank printed on the last issued license with the current one. Returns the
 * previous rank when the Hunter has ranked up since (the card is "re-issued"), else null.
 * The first look ever just records the rank (no ceremony for an existing account).
 */
export function checkLicenseReissue(current: LicenseRank): LicenseRank | null {
  try {
    const prev = localStorage.getItem(LICENSE_RANK_KEY) as LicenseRank | null;
    const prevIdx = prev ? LICENSE_RANKS.indexOf(prev) : -1;
    const curIdx = LICENSE_RANKS.indexOf(current);
    if (prevIdx === curIdx) return null;
    localStorage.setItem(LICENSE_RANK_KEY, current);
    requestSync();
    return prevIdx >= 0 && curIdx > prevIdx ? prev : null;
  } catch {
    return null;
  }
}
