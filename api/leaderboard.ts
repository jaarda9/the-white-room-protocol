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

function calculateTotalXP(level: number, xp: number): number {
  let total = xp;
  for (let l = 1; l < level; l++) {
    total += Math.floor(100 * Math.pow(1.25, l - 1));
  }
  return total;
}

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
          const found = await col.find({}).limit(150).toArray();
          for (const doc of found) {
            const rawUid = doc.userId || doc.id || doc._id?.toString();
            if (!rawUid) continue;
            const normUid = String(rawUid).trim().toUpperCase();
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
      .map((doc: any) => {
        const ls = doc.localStorage || {};
        let profile = doc.userProfile;
        if (!profile && (ls.whiteroom_user_profile || ls.userProfile)) {
          const raw = ls.whiteroom_user_profile || ls.userProfile;
          try {
            profile = typeof raw === 'string' ? JSON.parse(raw) : raw;
          } catch {
            profile = null;
          }
        }

        const userId = doc.userId || profile?.id || doc._id?.toString() || '';
        const rawName = profile?.fullName || profile?.displayName || profile?.pseudo || doc.name || doc.gameData?.name;
        
        // Names built from the Subject ID ("SUBJECT-XXXXXX") would publish a login credential;
        // those fall back to the public handle below.
        const cleanId = normSubject(userId);
        let fullName = '';
        if (rawName && typeof rawName === 'string' && rawName.trim().length > 0) {
          fullName = rawName.trim();
          if (cleanId && fullName.toUpperCase().includes(cleanId)) fullName = '';
        }

        const level = Number(doc.level ?? doc.gameData?.level ?? profile?.level ?? 1) || 1;
        const xp = Number(doc.exp ?? doc.xp ?? doc.gameData?.exp ?? doc.gameData?.xp ?? profile?.xp ?? 0) || 0;
        const stats = doc.Attributes || doc.stats || doc.gameData?.Attributes || profile?.visibleStats || {};
        const totalXp = calculateTotalXP(level, xp);
        const topStat = getTopStat(stats);

        return {
          userId,
          fullName,
          level,
          xp,
          totalXp,
          topStat,
          visibleStats: stats,
          // For the public Hunter License (Leaderboard): equipped title and registration date only.
          title: typeof profile?.title === 'string' ? profile.title.slice(0, 40) : '',
          since: typeof profile?.createdAt === 'string' ? profile.createdAt.slice(0, 10) : '',
        };
      })
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
