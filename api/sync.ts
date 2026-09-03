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

function getHunterTitle(level: number): string {
  if (level >= 50) return 'Supreme Sovereign';
  if (level >= 40) return 'Ruler of the Dead';
  if (level >= 30) return 'Demon Slayer';
  if (level >= 20) return 'Dungeon Conqueror';
  if (level >= 10) return 'Wolf Assassin';
  return 'Novice Hunter';
}

function extractAttribute(
  key: 'STR' | 'AGI' | 'VIT' | 'INT' | 'PER' | 'WIS',
  ...sources: any[]
): number | undefined {
  const upper = key;
  const lower = key.toLowerCase();
  const alternates: string[] = [upper, lower];
  if (key === 'STR') alternates.push('stg', 'STG', 'str_stat', 'strength', 'Strength');
  if (key === 'AGI') alternates.push('dex', 'DEX', 'agi_stat', 'agility', 'Agility');
  if (key === 'VIT') alternates.push('con', 'CON', 'vit_stat', 'vitality', 'Vitality');
  if (key === 'INT') alternates.push('int_stat', 'intelligence', 'Intelligence');
  if (key === 'PER') alternates.push('sen', 'SEN', 'per_stat', 'perception', 'Perception');
  if (key === 'WIS') alternates.push('wis_stat', 'wisdom', 'Wisdom');

  for (const src of sources) {
    if (!src || typeof src !== 'object') continue;
    for (const alt of alternates) {
      if (src[alt] !== undefined && src[alt] !== null && src[alt] !== '') {
        const num = Number(src[alt]);
        if (Number.isFinite(num) && num >= 0) {
          return Math.floor(num);
        }
      }
    }
  }
  return undefined;
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

      const resolvedStats = {
        STR: extractAttribute('STR', profileObj?.visibleStats, gameDataIn.Attributes, gameDataIn.stats) ?? 10,
        AGI: extractAttribute('AGI', profileObj?.visibleStats, gameDataIn.Attributes, gameDataIn.stats) ?? 10,
        VIT: extractAttribute('VIT', profileObj?.visibleStats, gameDataIn.Attributes, gameDataIn.stats) ?? 10,
        INT: extractAttribute('INT', profileObj?.visibleStats, gameDataIn.Attributes, gameDataIn.stats) ?? 10,
        PER: extractAttribute('PER', profileObj?.visibleStats, gameDataIn.Attributes, gameDataIn.stats) ?? 10,
        WIS: extractAttribute('WIS', profileObj?.visibleStats, gameDataIn.Attributes, gameDataIn.stats) ?? 10,
      };

      const calculatedHp = Math.max(100, Math.floor(resolvedStats.VIT * 40 + resolvedStats.STR * 16 + currentLevel * 20));
      const calculatedMp = Math.max(50, Math.floor(resolvedStats.INT * 8 + resolvedStats.PER * 4 + currentLevel * 2));

      const normalizedProfile = {
        ...(profileObj || {}),
        id: profileObj?.id || userId,
        level: currentLevel,
        xp: currentXp,
        exp: currentXp,
        visibleStats: resolvedStats,
        xpToNextLevel: profileObj?.xpToNextLevel || calculateXPForLevel(currentLevel),
        hunterRank: profileObj?.hunterRank || getHunterRank(currentLevel),
        title: profileObj?.title || getHunterTitle(currentLevel),
      };

      const normalizedGameData = {
        ...gameDataIn,
        level: currentLevel,
        exp: currentXp,
        xp: currentXp,
        name: normalizedProfile.displayName || normalizedProfile.pseudo || userId,
        Attributes: resolvedStats,
        hp: gameDataIn.hp || calculatedHp,
        mp: gameDataIn.mp || calculatedMp,
        stm: gameDataIn.stm || 100,
        fatigue: normalizedProfile.fatigue ?? gameDataIn.fatigue ?? 0,
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
        Attributes: resolvedStats,
        stats: resolvedStats,
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

      // Detect if profile has the old anime hardcoded defaults (LV 18 with STR 48 and INT 27)
      const hasOldHardcodedStats =
        profile?.visibleStats &&
        profile.visibleStats.STR === 48 &&
        profile.visibleStats.INT === 27 &&
        profile.visibleStats.AGI === 27;

      // Prioritize explicit MongoDB fields over cached local storage
      const resolvedLevel = Number(
        userDoc.level ??
        gameData.level ??
        userDoc.gameData?.level ??
        lsData.gameData?.level ??
        (profile?.level !== 18 || !userDoc.level ? profile?.level : undefined) ??
        profile?.level ??
        1
      );

      const resolvedXp = Number(
        userDoc.exp ??
        userDoc.xp ??
        gameData.exp ??
        gameData.xp ??
        userDoc.gameData?.exp ??
        userDoc.gameData?.xp ??
        lsData.gameData?.exp ??
        lsData.gameData?.xp ??
        profile?.xp ??
        profile?.exp ??
        0
      );

      // Extract attributes in order: direct DB root -> DB gameData -> stats -> profile (if not old hardcoded default)
      const resolvedStats = {
        STR: extractAttribute('STR', userDoc.Attributes, userDoc.gameData?.Attributes, userDoc.stats, userDoc.attributes, gameData.Attributes, gameData.stats, (!hasOldHardcodedStats ? profile?.visibleStats : undefined), profile?.visibleStats) ?? 10,
        AGI: extractAttribute('AGI', userDoc.Attributes, userDoc.gameData?.Attributes, userDoc.stats, userDoc.attributes, gameData.Attributes, gameData.stats, (!hasOldHardcodedStats ? profile?.visibleStats : undefined), profile?.visibleStats) ?? 10,
        VIT: extractAttribute('VIT', userDoc.Attributes, userDoc.gameData?.Attributes, userDoc.stats, userDoc.attributes, gameData.Attributes, gameData.stats, (!hasOldHardcodedStats ? profile?.visibleStats : undefined), profile?.visibleStats) ?? 10,
        INT: extractAttribute('INT', userDoc.Attributes, userDoc.gameData?.Attributes, userDoc.stats, userDoc.attributes, gameData.Attributes, gameData.stats, (!hasOldHardcodedStats ? profile?.visibleStats : undefined), profile?.visibleStats) ?? 10,
        PER: extractAttribute('PER', userDoc.Attributes, userDoc.gameData?.Attributes, userDoc.stats, userDoc.attributes, gameData.Attributes, gameData.stats, (!hasOldHardcodedStats ? profile?.visibleStats : undefined), profile?.visibleStats) ?? 10,
        WIS: extractAttribute('WIS', userDoc.Attributes, userDoc.gameData?.Attributes, userDoc.stats, userDoc.attributes, gameData.Attributes, gameData.stats, (!hasOldHardcodedStats ? profile?.visibleStats : undefined), profile?.visibleStats) ?? 10,
      };

      const resolvedFatigue = Number(userDoc.fatigue ?? gameData.fatigue ?? profile?.fatigue ?? 0);
      const calculatedHp = Math.max(100, Math.floor(resolvedStats.VIT * 40 + resolvedStats.STR * 16 + resolvedLevel * 20));
      const calculatedMp = Math.max(50, Math.floor(resolvedStats.INT * 8 + resolvedStats.PER * 4 + resolvedLevel * 2));
      const resolvedHp = Number(userDoc.hp ?? gameData.hp ?? calculatedHp);
      const resolvedMp = Number(userDoc.mp ?? gameData.mp ?? calculatedMp);
      const resolvedStm = Number(userDoc.stm ?? gameData.stm ?? Math.max(0, 100 - resolvedFatigue));

      const resolvedName = userDoc.name ?? gameData.name ?? (profile?.displayName !== 'Sung Jin-woo' ? profile?.displayName : undefined) ?? profile?.fullName ?? 'Subject';
      const resolvedTitle = userDoc.title || gameData.title || (profile?.title && profile.title !== 'Wolf Assassin' ? profile.title : undefined) || getHunterTitle(resolvedLevel);

      const resolvedProfile = {
        ...(profile || {}),
        id: profile?.id || userId,
        displayName: resolvedName,
        pseudo: profile?.pseudo || `SUBJECT-${userId}`,
        level: resolvedLevel,
        xp: resolvedXp,
        exp: resolvedXp,
        xpToNextLevel: profile?.xpToNextLevel || calculateXPForLevel(resolvedLevel),
        job: profile?.job || gameData.job || 'None',
        title: resolvedTitle,
        hunterRank: profile?.hunterRank || getHunterRank(resolvedLevel),
        availableAP: Number(userDoc.availableAP ?? userDoc.availablePoints ?? gameData.availablePoints ?? profile?.availableAP ?? 0),
        fatigue: resolvedFatigue,
        visibleStats: resolvedStats,
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
        hp: resolvedHp,
        mp: resolvedMp,
        stm: resolvedStm,
        fatigue: resolvedFatigue,
        name: resolvedName,
        Attributes: resolvedStats,
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
        Attributes: resolvedStats,
        stats: resolvedStats,
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
