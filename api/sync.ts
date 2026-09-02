import type { VercelRequest, VercelResponse } from '@vercel/node';
import { MongoClient, Db } from 'mongodb';

// Cached MongoDB Client for Vercel Serverless Function lifecycle
let cachedClient: MongoClient | null = null;
let cachedDb: any = null;

// In-memory fallback if MongoDB is unreachable
const memoryStore = new Map<string, { localStorage: any; lastUpdated: Date }>();

async function getDatabase(): Promise<any> {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.warn('[Sync] MONGODB_URI not provided; using memory fallback');
    return null;
  }

  if (cachedClient && cachedDb) {
    return cachedDb;
  }

  try {
    const client = new MongoClient(uri, {
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 4000,
      connectTimeoutMS: 8000,
    });
    await client.connect();
    cachedClient = client;

    const customDb = process.env.MONGODB_DB || process.env.MONGODB_DB_NAME;
    let db: Db;
    if (customDb) {
      db = client.db(customDb);
    } else {
      try {
        db = client.db();
      } catch {
        db = client.db('gamedata');
      }
    }
    cachedDb = db;
    return db;
  } catch (err) {
    console.warn('[Sync] MongoDB connection failed; falling back to memory store:', (err as any)?.message || err);
    return null;
  }
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
    const db = await getDatabase();

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

      if (db) {
        const collection = db.collection('userData');
        const result = await collection.updateOne(
          { userId },
          {
            $set: {
              localStorage: localStorageData,
              lastUpdated: new Date(),
            },
          },
          { upsert: true }
        );

        return res.status(200).json({
          success: true,
          message: 'LocalStorage data synced successfully',
          modifiedCount: result.modifiedCount,
          upsertedId: result.upsertedId,
        });
      } else {
        // In-memory fallback
        memoryStore.set(userId, {
          localStorage: localStorageData,
          lastUpdated: new Date(),
        });
        return res.status(200).json({
          success: true,
          message: 'LocalStorage data synced (in-memory mode)',
          modifiedCount: 1,
          upsertedId: null,
        });
      }
    } else if (req.method === 'GET') {
      let userId: string | undefined;

      if (req.query && typeof req.query.userId === 'string') {
        userId = req.query.userId;
      } else if (req.query && Array.isArray(req.query.userId)) {
        userId = req.query.userId[0];
      } else if (req.url) {
        try {
          const parsedUrl = new URL(req.url, 'http://localhost');
          userId = parsedUrl.searchParams.get('userId') || undefined;
        } catch {
          // ignore
        }
      }

      if (!userId) {
        return res.status(400).json({ error: 'Missing userId parameter' });
      }

      if (db) {
        const collection = db.collection('userData');
        const userDoc = await collection.findOne({ userId });

        if (!userDoc || !userDoc.localStorage) {
          return res.status(404).json({ error: 'User not found' });
        }

        return res.status(200).json({ localStorageData: userDoc.localStorage });
      } else {
        // In-memory fallback
        const record = memoryStore.get(userId);
        if (!record || !record.localStorage) {
          return res.status(404).json({ error: 'User not found' });
        }
        return res.status(200).json({ localStorageData: record.localStorage });
      }
    } else {
      return res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (err) {
    console.error('Error in /api/sync handler:', err);
    return res.status(500).json({
      error: err instanceof Error ? err.message : 'Internal server error',
    });
  }
}
