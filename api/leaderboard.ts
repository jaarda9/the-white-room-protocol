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
      try {
        const col = db.collection('userData');
        const found = await col.find({}).limit(100).toArray();
        for (const doc of found) {
          const uid = doc.userId || doc._id?.toString();
          if (uid && !seenUserIds.has(uid)) {
            seenUserIds.add(uid);
            docs.push(doc);
          }
        }
      } catch (e) {
        console.warn('[Leaderboard] Find error:', e);
      }
    }

    const leaderboard = docs
      .map((doc: any) => {
        const ls = doc.localStorage || {};
        const profileRaw = ls.whiteroom_user_profile || ls.userProfile;
        if (!profileRaw) return null;

        let profile: any;
        try {
          profile = typeof profileRaw === 'string' ? JSON.parse(profileRaw) : profileRaw;
        } catch {
          return null;
        }

        const fullName = profile.fullName || profile.displayName || doc.name || doc.gameData?.name;
        // Only show users who have set their name
        if (!fullName || typeof fullName !== 'string' || fullName.trim().length === 0 || fullName === 'Sung Jin-woo') return null;

        const level = Number(doc.level ?? doc.gameData?.level ?? profile.level) || 1;
        const xp = Number(doc.exp ?? doc.xp ?? doc.gameData?.exp ?? doc.gameData?.xp ?? profile.xp) || 0;
        const stats = doc.Attributes || doc.stats || doc.gameData?.Attributes || profile.visibleStats || {};
        
        // Calculate total XP accumulated across all levels
        let totalXp = xp;
        for (let l = 1; l < level; l++) {
          totalXp += Math.floor(100 * Math.pow(1.25, l - 1));
        }

        return {
          userId: doc.userId,
          fullName: fullName.trim(),
          level,
          totalXp,
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
