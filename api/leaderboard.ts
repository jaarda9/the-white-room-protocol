import type { VercelRequest, VercelResponse } from '@vercel/node';
import { MongoClient, type Db } from 'mongodb';
import { handlesFor, normSubject, resolveSession } from './lib/mongodb.js';

const MONGODB_URI =
  process.env.MONGODB_URI ||
  process.env.MONGO_URI ||
  process.env.MONGODB_URL ||
  '';

// Never hardcode a fallback URI here — it ends up in git history. Without this var every
// handler silently drops to the in-memory store and nothing persists, so say so loudly.
if (!MONGODB_URI) {
  console.error('[api/leaderboard.ts] MONGODB_URI is not set — using in-memory store, data will NOT persist.');
}

let cachedClient: MongoClient | null = null;
let cachedDb: Db | null = null;

async function getMongoDb(): Promise<Db | null> {
  if (cachedClient && cachedDb) return cachedDb;
  try {
    const client = new MongoClient(MONGODB_URI, {
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 4000,
      connectTimeoutMS: 5000,
      socketTimeoutMS: 10000,
    });
    await client.connect();
    cachedClient = client;
    const customDb = process.env.MONGODB_DB || process.env.MONGODB_DB_NAME;
    const db = customDb ? client.db(customDb) : client.db('white-room-protocol');
    cachedDb = db;
    return db;
  } catch (err) {
    console.warn('[Leaderboard] MongoDB connection error:', err);
    return null;
  }
}

/** Cumulative EXP — same curve as calculateXPForLevel in src/lib/storage.ts and api/sync.ts
 * (100 + 25 per level). Only breaks ties between Hunters on the same level. */
function calculateTotalXP(level: number, xp: number): number {
  let total = xp;
  for (let l = 1; l < level; l++) {
    total += Math.floor(100 + (l - 1) * 25);
  }
  return total;
}

const parseMaybeJson = (v: unknown): any => {
  if (!v) return null;
  if (typeof v === 'object') return v;
  try {
    return JSON.parse(String(v));
  } catch {
    return null;
  }
};

/**
 * One Rankings row from a save. The CURRENT profile (localStorage.userProfile, rewritten on every
 * sync) comes first. The top-level fields (level, exp, Attributes, userProfile, gameData) are
 * copies from before saves were restructured and are never updated again (see api/sync.ts), so
 * they are only a fallback for a save that has no current profile at all — reading them first
 * showed Hunters at an old level (e.g. LV2 for a LV10 player) and an old top stat.
 */
export function rankingRowFromDoc(doc: any) {
  const ls = doc?.localStorage || {};
  const current = parseMaybeJson(ls.userProfile) || parseMaybeJson(ls.whiteroom_user_profile);
  const legacy = parseMaybeJson(doc?.userProfile);
  const profile = current || legacy;
  const gameData = parseMaybeJson(ls.gameData) || doc?.gameData || {};

  const userId = doc?.userId || profile?.id || doc?._id?.toString() || '';
  const rawName = profile?.fullName || profile?.displayName || profile?.pseudo || doc?.name || gameData?.name;
  // Names built from the Subject ID ("SUBJECT-XXXXXX") would publish a login credential;
  // those fall back to the public handle.
  const cleanId = normSubject(userId);
  let fullName = '';
  if (rawName && typeof rawName === 'string' && rawName.trim().length > 0) {
    fullName = rawName.trim().slice(0, 40);
    if (cleanId && fullName.toUpperCase().includes(cleanId)) fullName = '';
  }

  const level = current
    ? Number(current.level ?? ls.level ?? 1) || 1
    : Number(doc?.level ?? gameData?.level ?? legacy?.level ?? 1) || 1;
  const xp = current
    ? Number(current.xp ?? current.exp ?? ls.xp ?? 0) || 0
    : Number(doc?.exp ?? doc?.xp ?? gameData?.exp ?? gameData?.xp ?? legacy?.xp ?? 0) || 0;
  const stats = (current && current.visibleStats) || doc?.Attributes || doc?.stats || gameData?.Attributes || legacy?.visibleStats || {};

  return {
    userId,
    fullName,
    level,
    xp,
    totalXp: calculateTotalXP(level, xp),
    topStat: getTopStat(stats),
    visibleStats: stats,
    // For the public Hunter License (Leaderboard): equipped title and registration date only.
    title: typeof profile?.title === 'string' ? profile.title.slice(0, 40) : '',
    since: typeof profile?.createdAt === 'string' ? profile.createdAt.slice(0, 10) : '',
    // Training history per attribute: breaks main-class ties on the license. Numbers only.
    classPoints: Object.fromEntries(['STR', 'AGI', 'VIT', 'INT', 'PER', 'WIS'].map((k) => [k, Number(profile?.accumulatedPoints?.[k]) || 0])),
  };
}

/** Only the fields a Rankings row reads — not whole saves (photos, quests, labs…). */
const RANKING_PROJECTION = {
  userId: 1,
  id: 1,
  name: 1,
  level: 1,
  exp: 1,
  xp: 1,
  Attributes: 1,
  stats: 1,
  gameData: 1,
  userProfile: 1,
  'localStorage.userProfile': 1,
  'localStorage.whiteroom_user_profile': 1,
  'localStorage.gameData': 1,
  'localStorage.level': 1,
  'localStorage.xp': 1,
  lastUpdated: 1,
};

function getTopStat(stats: any): { key: string; value: number } {
  const keys = ['STR', 'AGI', 'VIT', 'INT', 'PER', 'WIS'];
  let bestKey = 'STR';
  let bestVal = Number(stats?.STR ?? stats?.str ?? stats?.strength ?? 10);

  for (const k of keys) {
    const altKeys = [k, k.toLowerCase()];
    if (k === 'STR') altKeys.push('stg', 'STG', 'strength');
    if (k === 'AGI') altKeys.push('dex', 'DEX', 'agility');
    if (k === 'VIT') altKeys.push('con', 'CON', 'vitality');
    if (k === 'INT') altKeys.push('intelligence');
    if (k === 'PER') altKeys.push('sen', 'SEN', 'perception');
    if (k === 'WIS') altKeys.push('wisdom');

    for (const alt of altKeys) {
      if (stats?.[alt] !== undefined && stats?.[alt] !== null) {
        const val = Number(stats[alt]);
        if (Number.isFinite(val) && val > bestVal) {
          bestVal = val;
          bestKey = k;
        }
      }
    }
  }

  return { key: bestKey, value: Math.max(10, bestVal) };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const db = await getMongoDb();
    const docs: any[] = [];
    const seenUserIds = new Set<string>();

    if (db) {
      for (const colName of ['userData', 'users']) {
        try {
          const col = db.collection(colName);
          const found = await col.find({}, { projection: RANKING_PROJECTION }).sort({ lastUpdated: -1 }).limit(500).toArray();
          for (const doc of found) {
            const rawUid = doc.userId || doc.id || doc._id?.toString();
            if (!rawUid) continue;
            // "SUBJECT-ABC123" and "ABC123" are the same Hunter (newest save wins: sorted above).
            const normUid = normSubject(rawUid) || String(rawUid).trim().toUpperCase();
            if (!seenUserIds.has(normUid)) {
              seenUserIds.add(normUid);
              docs.push(doc);
            }
          }
        } catch (e) {
          console.warn(`[Leaderboard] Find error in ${colName}:`, e);
        }
      }
    }

    const leaderboard = docs
      .map((doc: any) => rankingRowFromDoc(doc))
      .filter(Boolean)
      .sort((a: any, b: any) => {
        if (b.level !== a.level) return b.level - a.level;
        return b.totalXp - a.totalXp;
      });

    // Public view: handles, never Subject IDs. `isYou` marks the signed-in caller's own row.
    const me = await resolveSession(req).catch(() => null);
    const handles = await handlesFor(leaderboard.map((e: any) => e.userId).filter(Boolean));
    const publicBoard = leaderboard
      .map((e: any) => {
        const id = normSubject(e.userId);
        const handle = handles.get(id) || '';
        const { userId: _hidden, ...rest } = e;
        return { ...rest, handle, fullName: e.fullName || `Hunter ${handle}`.trim(), isYou: Boolean(me && id === me) };
      })
      .filter((e: any) => e.handle);

    return res.status(200).json({ leaderboard: publicBoard });
  } catch (err) {
    console.error('Leaderboard error:', err);
    return res.status(200).json({ leaderboard: [] });
  }
}
