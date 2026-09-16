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

      // Nested localStorage.* fields (gameData, profile) are checked FIRST in every ?? chain
      // below, not as a fallback: they're the only fields still written on every save (see the
      // POST handler above), so they're always current. The top-level userDoc.* fields are
      // read-only compatibility for documents saved before that top-level duplication was
      // removed — `$set` never deletes old fields, so on a document written both before and
      // after that change, the top-level ones sit frozen at whatever they were on the last
      // pre-change write. Checking them first would make progress look permanently stuck at
      // that frozen snapshot for every existing user instead of reading their real, current data.
      const gameData = lsData.gameData || userDoc.gameData || {};
      const resolvedLevel = Number(gameData.level ?? profile?.level ?? userDoc.level ?? 1);
      const resolvedXp = Number(gameData.exp ?? gameData.xp ?? profile?.xp ?? userDoc.exp ?? userDoc.xp ?? 0);

      const resolvedStats = {
        STR: extractAttribute('STR', profile?.visibleStats, gameData.Attributes, userDoc.Attributes, userDoc.stats) ?? 10,
        AGI: extractAttribute('AGI', profile?.visibleStats, gameData.Attributes, userDoc.Attributes, userDoc.stats) ?? 10,
        VIT: extractAttribute('VIT', profile?.visibleStats, gameData.Attributes, userDoc.Attributes, userDoc.stats) ?? 10,
        INT: extractAttribute('INT', profile?.visibleStats, gameData.Attributes, userDoc.Attributes, userDoc.stats) ?? 10,
        PER: extractAttribute('PER', profile?.visibleStats, gameData.Attributes, userDoc.Attributes, userDoc.stats) ?? 10,
        WIS: extractAttribute('WIS', profile?.visibleStats, gameData.Attributes, userDoc.Attributes, userDoc.stats) ?? 10,
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

      const db = await getMongoDatabase();
      let existing: any = null;

      if (db) {
        try {
          const collection = db.collection('userData');
          existing = await collection.findOne({
            $or: [
              { userId: cleanId },
              { userId: bareId },
              { userId: fullId },
              { 'localStorage.userProfile.id': cleanId },
              { 'localStorage.userProfile.id': bareId },
            ],
          });
        } catch (dbErr) {
          console.warn('[Sync API] MongoDB find query error:', dbErr);
        }
      }

      // Progress protection: never let a save regress level/xp - but only clamp
      // those two fields. Every other field in this save (fatigue, quests, hp/mp/stm,
      // lastRestDate, todos, etc.) must still be written; previously the whole save
      // was rejected whenever level/xp didn't advance, so anything that changed
      // without an accompanying xp gain (like fatigue) silently never reached the DB.
      let finalLevel = currentLevel;
      let finalXp = currentXp;
      let progressProtected = false;

      if (existing) {
        // localStorage.* is checked FIRST, not as a fallback: it's the only place still
        // written on every save (see updatePayload below), so it's always current. The
        // top-level fields are read-only compatibility for documents saved before this
        // duplication was removed — `$set` never deletes them, so on an existing document
        // they'd otherwise sit frozen at whatever they were on that document's last pre-fix
        // write and (checked first) would wrongly outrank the real, up-to-date nested value
        // for the rest of that document's life.
        const existingLs = existing.localStorage || {};
        const exLevel = Number(
          existingLs.userProfile?.level ?? existingLs.gameData?.level ??
          existing.level ?? existing.gameData?.level ?? existing.userProfile?.level ?? 1
        );
        const exXp = Number(
          existingLs.userProfile?.xp ?? existingLs.gameData?.exp ?? existingLs.gameData?.xp ??
          existing.exp ?? existing.xp ?? existing.gameData?.exp ?? existing.userProfile?.xp ?? 0
        );

        if (exLevel > currentLevel) {
          finalLevel = exLevel;
          finalXp = exXp;
          progressProtected = true;
        } else if (exLevel === currentLevel && exXp > currentXp) {
          finalXp = exXp;
          progressProtected = true;
        }

        if (progressProtected) {
          console.log(`[Sync API] Clamped level/xp to protected DB values (${finalLevel}/${finalXp}); still saving the rest of this update.`);
        }
      }

      // Same lost-update problem as level/xp above, for the Rank-ceremony "already seen"
      // marker: forceSaveUserData() (page-unload flush) deliberately bypasses the client's
      // save queue, so an older snapshot (captured before a ceremony just set this) can land
      // here AFTER a newer one already advanced it — regressing the DB copy and replaying the
      // ceremony on the player's very next load. Never let an incoming save move this field
      // backward through E→D→C→B→A→S.
      const RANK_ORDER = ['E', 'D', 'C', 'B', 'A', 'S'];
      const existingLastSeenRank = existing?.localStorage?.userProfile?.lastSeenRank;
      const incomingLastSeenRank = profileObj?.lastSeenRank;
      const finalLastSeenRank =
        existingLastSeenRank && RANK_ORDER.indexOf(existingLastSeenRank) > RANK_ORDER.indexOf(incomingLastSeenRank ?? '')
          ? existingLastSeenRank
          : incomingLastSeenRank;

      const normalizedProfile = {
        ...(profileObj || {}),
        id: profileObj?.id || cleanId,
        level: finalLevel,
        xp: finalXp,
        exp: finalXp,
        visibleStats: resolvedStats,
        xpToNextLevel: profileObj?.xpToNextLevel || calculateXPForLevel(finalLevel),
        hunterRank: profileObj?.hunterRank || getHunterRank(finalLevel),
        lastSeenRank: finalLastSeenRank,
        title: profileObj?.title || getHunterTitle(finalLevel),
      };

      const normalizedGameData = {
        ...gameDataIn,
        level: finalLevel,
        exp: finalXp,
        xp: finalXp,
        Attributes: resolvedStats,
      };

      localStorageData.userProfile = normalizedProfile;
      localStorageData.whiteroom_user_profile = JSON.stringify(normalizedProfile);
      localStorageData.gameData = normalizedGameData;
      // These two are separate leftover fields inside localStorageData itself (not the
      // top-level duplication removed below) — the client always sends them equal to
      // userProfile.xp/gameData.xp, but if progress protection just clamped finalXp UP to a
      // higher previously-stored value, that clamp only reached userProfile/gameData above.
      // Left unset, these would keep whatever (lower, unclamped) value the client originally
      // sent, silently disagreeing with the just-corrected userProfile/gameData in the exact
      // same document — which is exactly the split-brain state a subsequent read could surface.
      localStorageData.exp = finalXp;
      localStorageData.xp = finalXp;
      localStorageData.level = finalLevel;

      // userProfile/gameData/exp/xp/level/Attributes/stats used to also be duplicated here as
      // top-level siblings of `localStorage` — same values, written twice, roughly doubling
      // every sync payload for no benefit (and the direct cause of the "payload too large for
      // keepalive" downgrade logged client-side). localStorage.* (already populated with the
      // normalized profile/gameData above) is the single write target now. The GET handler
      // below still reads both shapes, so existing documents saved before this change keep
      // loading correctly without needing any migration.
      const updatePayload = {
        userId: cleanId,
        localStorage: localStorageData,
        lastUpdated: new Date(),
      };

      if (db) {
        try {
          const collection = db.collection('userData');
          if (existing) {
            await collection.updateOne({ _id: existing._id }, { $set: updatePayload });
          } else {
            await collection.insertOne(updatePayload);
          }

          return res.status(200).json({
            success: true,
            message: progressProtected
              ? 'Synced to MongoDB (level/xp clamped to protected DB values)'
              : 'LocalStorage data synced successfully to MongoDB',
            userId: cleanId,
            level: finalLevel,
            xp: finalXp,
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
        level: finalLevel,
        xp: finalXp,
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
