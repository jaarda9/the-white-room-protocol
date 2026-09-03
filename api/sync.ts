import type { VercelRequest, VercelResponse } from '@vercel/node';
import { MongoClient, type Db } from 'mongodb';

// In-memory fallback if MongoDB is unreachable
const memoryStore = new Map<string, { localStorage: any; lastUpdated: Date; gameData?: any; userProfile?: any }>();

let cachedClient: MongoClient | null = null;
let cachedDb: Db | null = null;

async function getMongoDatabase(): Promise<Db | null> {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    return null;
  }

  if (cachedClient && cachedDb) {
    try {
      // Return cached instance
      return cachedDb;
    } catch {
      cachedClient = null;
      cachedDb = null;
    }
  }

  try {
    const client = new MongoClient(uri, {
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 4000,
      connectTimeoutMS: 5000,
    });
    await client.connect();
    cachedClient = client;

    const customDb = process.env.MONGODB_DB || process.env.MONGODB_DB_NAME;
    if (customDb) {
      cachedDb = client.db(customDb);
    } else {
      try {
        cachedDb = client.db();
      } catch {
        cachedDb = client.db('gamedata');
      }
    }
    return cachedDb;
  } catch (err) {
    console.warn('[Sync API] MongoDB connection failed, falling back to memory store:', (err as any)?.message || err);
    cachedClient = null;
    cachedDb = null;
    return null;
  }
}

function calculateXPForLevel(level: number): number {
  return Math.floor(100 * Math.pow(1.25, level - 1));
}

function getHunterRank(level: number): 'E' | 'D' | 'C' | 'B' | 'A' | 'S' {
  if (level >= 50) return 'S';
  if (level >= 40) return 'A';
  if (level >= 30) return 'B';
  if (level >= 20) return 'C';
  if (level >= 10) return 'D';
  return 'E';
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    let db: Db | null = null;
    try {
      db = await getMongoDatabase();
    } catch (e) {
      console.warn('[Sync API] Error connecting to db:', e);
      db = null;
    }

    if (req.method === 'POST') {
      let body = req.body;
      if (typeof body === 'string') {
        try {
          body = JSON.parse(body);
        } catch {
          // ignore
        }
      }

      const { userId, localStorageData } = body || {};

      if (!userId || !localStorageData) {
        return res.status(400).json({ error: 'Missing userId or localStorageData' });
      }

      // Extract and normalize profile & XP
      let profileObj: any = localStorageData.userProfile;
      if (!profileObj && localStorageData.whiteroom_user_profile) {
        try {
          profileObj = typeof localStorageData.whiteroom_user_profile === 'string'
            ? JSON.parse(localStorageData.whiteroom_user_profile)
            : localStorageData.whiteroom_user_profile;
        } catch {
          // ignore
        }
      }

      const gameDataIn = localStorageData.gameData || {};
      const currentLevel = Number(profileObj?.level ?? gameDataIn.level ?? 1);
      const currentXp = Number(
        profileObj?.xp ??
        profileObj?.exp ??
        gameDataIn.exp ??
        gameDataIn.xp ??
        0
      );

      const normalizedProfile = {
        ...(profileObj || {}),
        id: profileObj?.id || userId,
        level: currentLevel,
        xp: currentXp,
        exp: currentXp,
        xpToNextLevel: profileObj?.xpToNextLevel || calculateXPForLevel(currentLevel),
        hunterRank: profileObj?.hunterRank || getHunterRank(currentLevel),
      };

      const normalizedGameData = {
        ...gameDataIn,
        level: currentLevel,
        exp: currentXp,
        xp: currentXp,
        name: normalizedProfile.displayName || normalizedProfile.pseudo || userId,
        Attributes: normalizedProfile.visibleStats || gameDataIn.Attributes || {},
      };

      // Ensure localStorageData has both representations synchronized
      localStorageData.userProfile = normalizedProfile;
      localStorageData.whiteroom_user_profile = JSON.stringify(normalizedProfile);
      localStorageData.gameData = normalizedGameData;

      const updatePayload = {
        localStorage: localStorageData,
        lastUpdated: new Date(),
        exp: currentXp,
        xp: currentXp,
        level: currentLevel,
        userProfile: normalizedProfile,
        gameData: normalizedGameData,
      };

      if (db) {
        try {
          const collection = db.collection('userData');
          const result = await collection.updateOne(
            { userId },
            { $set: updatePayload },
            { upsert: true }
          );

          return res.status(200).json({
            success: true,
            message: 'User data and XP synced successfully to MongoDB',
            userId,
            exp: currentXp,
            xp: currentXp,
            level: currentLevel,
            modifiedCount: result.modifiedCount,
            upsertedId: result.upsertedId,
          });
        } catch (dbErr) {
          console.error('[Sync API] MongoDB update failed, falling back to memory store:', dbErr);
          // Fall through to memory store on DB write error
        }
      }

      // In-memory fallback
      memoryStore.set(userId, {
        localStorage: localStorageData,
        lastUpdated: new Date(),
        userProfile: normalizedProfile,
        gameData: normalizedGameData,
      });

      return res.status(200).json({
        success: true,
        message: 'Data and XP synced (memory store fallback)',
        userId,
        exp: currentXp,
        xp: currentXp,
        level: currentLevel,
        modifiedCount: 1,
        upsertedId: null,
      });
    } else if (req.method === 'GET') {
      let userId: string | undefined;

      if (req.query && typeof req.query.userId === 'string') {
        userId = req.query.userId;
      } else if (req.query && Array.isArray(req.query.userId)) {
        userId = req.query.userId[0];
      } else if ((req as any).params && (req as any).params.userId) {
        userId = (req as any).params.userId;
      } else if (req.url) {
        try {
          const parsedUrl = new URL(req.url, 'http://localhost');
          userId = parsedUrl.searchParams.get('userId') || undefined;
          if (!userId && parsedUrl.pathname.startsWith('/api/user/')) {
            userId = parsedUrl.pathname.replace('/api/user/', '');
          }
        } catch {
          // ignore
        }
      }

      if (!userId) {
        return res.status(400).json({ error: 'Missing userId parameter' });
      }

      let userDoc: any = null;

      if (db) {
        try {
          const collection = db.collection('userData');
          userDoc = await collection.findOne({ userId });

          if (!userDoc) {
            if (userId.startsWith('SUBJECT-')) {
              userDoc = await collection.findOne({ userId: userId.replace('SUBJECT-', '') });
            } else {
              userDoc = await collection.findOne({ userId: `SUBJECT-${userId}` });
            }
          }

          if (!userDoc) {
            userDoc = await collection.findOne({
              $or: [
                { 'localStorage.userProfile.id': userId },
                { 'userProfile.id': userId },
                { 'gameData.name': userId },
              ],
            });
          }
        } catch (dbErr) {
          console.error('[Sync API] MongoDB find failed, falling back to memory store:', dbErr);
        }
      }

      if (!userDoc) {
        const record = memoryStore.get(userId) || (userId.startsWith('SUBJECT-') ? memoryStore.get(userId.replace('SUBJECT-', '')) : memoryStore.get(`SUBJECT-${userId}`));
        if (record) {
          userDoc = {
            userId,
            localStorage: record.localStorage,
            userProfile: record.userProfile,
            gameData: record.gameData,
          };
        }
      }

      if (!userDoc) {
        return res.status(404).json({ error: 'User not found', localStorageData: null });
      }

      // Synthesize complete localStorageData and resolve XP & EXP
      const lsData = { ...(userDoc.localStorage || {}) };

      let profile = lsData.userProfile;
      if (!profile && lsData.whiteroom_user_profile) {
        try {
          profile = typeof lsData.whiteroom_user_profile === 'string'
            ? JSON.parse(lsData.whiteroom_user_profile)
            : lsData.whiteroom_user_profile;
        } catch {
          // ignore
        }
      }
      if (!profile && userDoc.userProfile) {
        profile = userDoc.userProfile;
      }

      const gameData = lsData.gameData || userDoc.gameData || {};

      const resolvedLevel = Number(profile?.level ?? gameData.level ?? userDoc.level ?? 1);
      const resolvedXp = Number(
        profile?.xp ??
        profile?.exp ??
        gameData.exp ??
        gameData.xp ??
        userDoc.exp ??
        userDoc.xp ??
        0
      );

      const resolvedProfile = {
        ...(profile || {}),
        id: profile?.id || userId,
        displayName: profile?.displayName || gameData.name || 'Hunter',
        pseudo: profile?.pseudo || `SUBJECT-${userId}`,
        level: resolvedLevel,
        xp: resolvedXp,
        exp: resolvedXp,
        xpToNextLevel: profile?.xpToNextLevel || calculateXPForLevel(resolvedLevel),
        job: profile?.job || gameData.job || 'None',
        title: profile?.title || gameData.title || 'Wolf Assassin',
        hunterRank: profile?.hunterRank || getHunterRank(resolvedLevel),
        availableAP: profile?.availableAP ?? 12,
        fatigue: profile?.fatigue ?? gameData.fatigue ?? 0,
        visibleStats: profile?.visibleStats || gameData.Attributes || {
          STR: 48,
          AGI: 27,
          VIT: 27,
          INT: 27,
          PER: 27,
          WIS: 27,
        },
        accumulatedPoints: profile?.accumulatedPoints || {
          STR: 0,
          AGI: 0,
          VIT: 0,
          INT: 0,
          PER: 0,
          WIS: 0,
        },
        createdAt: profile?.createdAt || new Date().toISOString(),
        settings: profile?.settings || { tone: 'clinical' },
      };

      const resolvedGameData = {
        ...gameData,
        level: resolvedLevel,
        exp: resolvedXp,
        xp: resolvedXp,
        hp: gameData.hp || 2220,
        mp: gameData.mp || 350,
        stm: gameData.stm || 100,
        fatigue: resolvedProfile.fatigue,
        name: resolvedProfile.displayName,
        Attributes: resolvedProfile.visibleStats,
      };

      lsData.userProfile = resolvedProfile;
      lsData.whiteroom_user_profile = JSON.stringify(resolvedProfile);
      lsData.gameData = resolvedGameData;

      return res.status(200).json({
        success: true,
        userId,
        localStorageData: lsData,
        localStorage: lsData,
        userProfile: resolvedProfile,
        gameData: resolvedGameData,
        exp: resolvedXp,
        xp: resolvedXp,
        level: resolvedLevel,
        lastUpdated: userDoc.lastUpdated || new Date(),
      });
    } else {
      return res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (err) {
    console.error('[Sync API] Unexpected error:', err);
    return res.status(500).json({
      error: err instanceof Error ? err.message : 'Internal server error',
    });
  }
}
