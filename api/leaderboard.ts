import type { VercelRequest, VercelResponse } from '@vercel/node';
import { MongoClient, type Db } from 'mongodb';

const DEFAULT_MONGODB_URI =
  'mongodb+srv://Vercel-Admin-atlas-amber-house:36UkjMa6SGPTMNoa@atlas-amber-house.hbybfiz.mongodb.net/white-room-protocol?retryWrites=true&w=majority';

const MONGODB_URI =
  process.env.MONGODB_URI ||
  process.env.MONGO_URI ||
  process.env.MONGODB_URL ||
  DEFAULT_MONGODB_URI;

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
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

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
        
        let fullName = '';
        if (rawName && typeof rawName === 'string' && rawName.trim().length > 0) {
          fullName = rawName.trim();
        } else if (userId) {
          const cleanId = String(userId).replace(/^SUBJECT-/i, '').trim();
          fullName = `Subject ${cleanId || 'Awakened'}`;
        } else {
          fullName = 'Hunter Candidate';
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
        };
      })
      .filter(Boolean)
      .sort((a: any, b: any) => {
        if (b.level !== a.level) return b.level - a.level;
        return b.totalXp - a.totalXp;
      });

    return res.status(200).json({ leaderboard });
  } catch (err) {
    console.error('Leaderboard error:', err);
    return res.status(200).json({ leaderboard: [] });
  }
}
