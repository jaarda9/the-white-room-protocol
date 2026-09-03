import type { VercelRequest, VercelResponse } from '@vercel/node';
import { MongoClient, type Db } from 'mongodb';

// Working Atlas cluster fallback from project history
const DEFAULT_MONGODB_URI =
  'mongodb+srv://Vercel-Admin-atlas-amber-house:36UkjMa6SGPTMNoa@atlas-amber-house.hbybfiz.mongodb.net/white-room-protocol?retryWrites=true&w=majority';

const MONGODB_URI =
  process.env.MONGODB_URI ||
  process.env.MONGO_URI ||
  process.env.MONGODB_URL ||
  DEFAULT_MONGODB_URI;

// Cached connection for Vercel serverless function lifecycle
let cachedClient: MongoClient | null = null;
let cachedDb: Db | null = null;

// In-memory fallback if MongoDB is unreachable
const memoryStore = new Map<string, { localStorage: any; lastUpdated: Date; [key: string]: any }>();

async function getMongoDatabase(): Promise<Db | null> {
  if (cachedClient && cachedDb) {
    return cachedDb;
  }

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
    console.warn('[Sync API] MongoDB connection error, using in-memory store:', (err as any)?.message || err);
    cachedClient = null;
    cachedDb = null;
    return null;
  }
}

function calculateXPForLevel(level: number): number {
  return Math.floor(100 * Math.pow(1.25, Math.max(1, level) - 1));
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
  const alternates: string[] = [key, key.toLowerCase()];
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
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    if (req.method === 'GET') {
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

      if (!userId || !userId.trim()) {
        return res.status(400).json({ error: 'Missing userId parameter' });
      }

      const cleanId = userId.trim();
      const bareId = cleanId.replace(/^SUBJECT-/i, '');
      const fullId = `SUBJECT-${bareId}`;

      let userDoc: any = null;
      let matchedSource = 'database';
      const db = await getMongoDatabase();

      if (db) {
        try {
          const collection = db.collection('userData');
          userDoc = await collection.findOne({
            $or: [
              { userId: cleanId },
              { userId: bareId },
              { userId: fullId },
              { 'localStorage.userProfile.id': cleanId },
              { 'localStorage.userProfile.id': bareId },
              { 'localStorage.userProfile.id': fullId },
              { 'userProfile.id': cleanId },
              { 'userProfile.id': bareId },
            ],
          });

          // Fallback to 'users' collection if not in 'userData'
          if (!userDoc) {
            const usersCol = db.collection('users');
            userDoc = await usersCol.findOne({
              $or: [{ userId: cleanId }, { userId: bareId }, { userId: fullId }],
            });
          }
        } catch (dbErr) {
          console.warn('[Sync API] MongoDB find query error:', dbErr);
        }
      }

      // If not in MongoDB, check in-memory store
      if (!userDoc) {
        userDoc = memoryStore.get(cleanId) || memoryStore.get(bareId) || memoryStore.get(fullId);
        if (userDoc) {
          matchedSource = 'memory';
        }
      }

      // If still not found, return 404 (handled gracefully by sync-manager.ts as new profile)
      if (!userDoc) {
        return res.status(404).json({ error: 'User not found', localStorageData: null });
      }

      // Synthesize localStorageData
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
      const resolvedLevel = Number(userDoc.level ?? gameData.level ?? profile?.level ?? 1);
      const resolvedXp = Number(userDoc.exp ?? userDoc.xp ?? gameData.exp ?? gameData.xp ?? profile?.xp ?? 0);

      const resolvedStats = {
        STR: extractAttribute('STR', userDoc.Attributes, userDoc.stats, profile?.visibleStats, gameData.Attributes) ?? 10,
        AGI: extractAttribute('AGI', userDoc.Attributes, userDoc.stats, profile?.visibleStats, gameData.Attributes) ?? 10,
        VIT: extractAttribute('VIT', userDoc.Attributes, userDoc.stats, profile?.visibleStats, gameData.Attributes) ?? 10,
        INT: extractAttribute('INT', userDoc.Attributes, userDoc.stats, profile?.visibleStats, gameData.Attributes) ?? 10,
        PER: extractAttribute('PER', userDoc.Attributes, userDoc.stats, profile?.visibleStats, gameData.Attributes) ?? 10,
        WIS: extractAttribute('WIS', userDoc.Attributes, userDoc.stats, profile?.visibleStats, gameData.Attributes) ?? 10,
      };

      const resolvedName = userDoc.name ?? gameData.name ?? profile?.displayName ?? profile?.fullName ?? 'Subject';
      const resolvedProfile = {
        ...(profile || {}),
        id: profile?.id || cleanId,
        displayName: resolvedName,
        pseudo: profile?.pseudo || fullId,
        fullName: profile?.fullName || resolvedName,
        level: resolvedLevel,
        xp: resolvedXp,
        exp: resolvedXp,
        xpToNextLevel: profile?.xpToNextLevel || calculateXPForLevel(resolvedLevel),
        hunterRank: profile?.hunterRank || getHunterRank(resolvedLevel),
        title: profile?.title || getHunterTitle(resolvedLevel),
        visibleStats: resolvedStats,
      };

      const resolvedGameData = {
        ...gameData,
        level: resolvedLevel,
        exp: resolvedXp,
        xp: resolvedXp,
        Attributes: resolvedStats,
      };

      lsData.userProfile = resolvedProfile;
      lsData.whiteroom_user_profile = JSON.stringify(resolvedProfile);
      lsData.gameData = resolvedGameData;

      return res.status(200).json({
        success: true,
        userId: cleanId,
        source: matchedSource,
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

      const cleanId = String(userId).trim();
      const bareId = cleanId.replace(/^SUBJECT-/i, '');
      const fullId = `SUBJECT-${bareId}`;

      // Extract and normalize profile
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
      const currentXp = Number(profileObj?.xp ?? profileObj?.exp ?? gameDataIn.exp ?? gameDataIn.xp ?? 0);

      const resolvedStats = {
        STR: extractAttribute('STR', profileObj?.visibleStats, gameDataIn.Attributes, gameDataIn.stats) ?? 10,
        AGI: extractAttribute('AGI', profileObj?.visibleStats, gameDataIn.Attributes, gameDataIn.stats) ?? 10,
        VIT: extractAttribute('VIT', profileObj?.visibleStats, gameDataIn.Attributes, gameDataIn.stats) ?? 10,
        INT: extractAttribute('INT', profileObj?.visibleStats, gameDataIn.Attributes, gameDataIn.stats) ?? 10,
        PER: extractAttribute('PER', profileObj?.visibleStats, gameDataIn.Attributes, gameDataIn.stats) ?? 10,
        WIS: extractAttribute('WIS', profileObj?.visibleStats, gameDataIn.Attributes, gameDataIn.stats) ?? 10,
      };

      const normalizedProfile = {
        ...(profileObj || {}),
        id: profileObj?.id || cleanId,
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
        Attributes: resolvedStats,
      };

      localStorageData.userProfile = normalizedProfile;
      localStorageData.whiteroom_user_profile = JSON.stringify(normalizedProfile);
      localStorageData.gameData = normalizedGameData;

      const updatePayload = {
        userId: cleanId,
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

      const db = await getMongoDatabase();

      if (db) {
        try {
          const collection = db.collection('userData');
          const existing = await collection.findOne({
            $or: [
              { userId: cleanId },
              { userId: bareId },
              { userId: fullId },
              { 'localStorage.userProfile.id': cleanId },
              { 'localStorage.userProfile.id': bareId },
            ],
          });

          if (existing) {
            const exLevel = Number(existing.level ?? existing.gameData?.level ?? existing.userProfile?.level ?? 1);
            const exXp = Number(existing.exp ?? existing.xp ?? existing.gameData?.exp ?? existing.userProfile?.xp ?? 0);

            // Progress protection: do not overwrite higher DB progress with lower local progress
            if (exLevel > currentLevel || (exLevel === currentLevel && exXp > currentXp)) {
              console.log(`[Sync API] Overwrite protected: existing DB level ${exLevel} > incoming ${currentLevel}`);
              return res.status(200).json({
                success: true,
                message: 'Preserved higher progress in database',
                userId: cleanId,
                level: exLevel,
                xp: exXp,
                userProfile: existing.userProfile,
              });
            }

            await collection.updateOne({ _id: existing._id }, { $set: updatePayload });
          } else {
            await collection.insertOne(updatePayload);
          }

          return res.status(200).json({
            success: true,
            message: 'LocalStorage data synced successfully to MongoDB',
            userId: cleanId,
            level: currentLevel,
            xp: currentXp,
          });
        } catch (dbErr) {
          console.warn('[Sync API] MongoDB update failed, storing in memory:', dbErr);
        }
      }

      // In-memory fallback
      memoryStore.set(cleanId, updatePayload);
      return res.status(200).json({
        success: true,
        message: 'LocalStorage data synced (in-memory fallback)',
        userId: cleanId,
        level: currentLevel,
        xp: currentXp,
      });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('[Sync API] Unexpected error in handler:', err);
    return res.status(200).json({
      success: false,
      message: err instanceof Error ? err.message : 'Sync fallback',
      localStorageData: null,
    });
  }
}
