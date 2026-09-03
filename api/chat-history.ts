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

async function getDb(): Promise<Db | any> {
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
    console.warn('[Chat History] MongoDB connection error:', err);
    // Return minimal in-memory fallback
    return {
      collection: () => ({
        findOne: async () => null,
        find: () => ({ sort: () => ({ toArray: async () => [] }) }),
        updateOne: async () => ({ modifiedCount: 0 }),
      }),
    };
  }
}

type StoredMessage = {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
};

type ConversationDoc = {
  _id?: unknown;
  userId: string;
  schemaVersion: 2;
  messages: StoredMessage[];
  createdAt: Date;
  updatedAt: Date;
};

function getAuthenticatedSubjectId(req: VercelRequest): string | null {
  const raw = req.headers['x-subject-id'];
  if (typeof raw === 'string' && raw.trim()) return raw.trim();
  if (Array.isArray(raw) && raw[0]?.trim()) return raw[0].trim();
  return null;
}

function isAuthorizedForUser(req: VercelRequest, userId: string): boolean {
  const subjectId = getAuthenticatedSubjectId(req);
  return !subjectId || subjectId === userId;
}

async function getOrMigrateConversation(
  collection: any,
  userId: string
): Promise<ConversationDoc | null> {
  const current = await collection.findOne({
    userId,
    schemaVersion: 2,
  });
  if (current) {
    return current as ConversationDoc;
  }

  // Legacy format: one Mongo document per message.
  const legacyMessages = await collection
    .find({
      userId,
      role: { $in: ['user', 'assistant'] },
      content: { $type: 'string' },
    })
    .sort({ timestamp: 1 })
    .toArray();

  if (!legacyMessages.length) {
    return null;
  }

  const mappedMessages: StoredMessage[] = legacyMessages.map((m: any) => ({
    role: m.role,
    content: m.content,
    timestamp: new Date(m.timestamp || Date.now()),
  }));

  const now = new Date();
  const doc: ConversationDoc = {
    userId,
    schemaVersion: 2,
    messages: mappedMessages,
    createdAt: new Date(mappedMessages[0]?.timestamp || now),
    updatedAt: new Date(mappedMessages[mappedMessages.length - 1]?.timestamp || now),
  };

  await collection.insertOne(doc);
  await collection.deleteMany({
    userId,
    role: { $in: ['user', 'assistant'] },
    content: { $type: 'string' },
  });

  return doc;
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Subject-Id');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const db = await getDb();
    const collection = db.collection('chatHistory');

    // GET - Retrieve chat history for a user
    if (req.method === 'GET') {
      const { userId, limit = '50' } = req.query;

      if (!userId || typeof userId !== 'string') {
        return res.status(400).json({ error: 'Missing userId parameter' });
      }
      if (!isAuthorizedForUser(req, userId)) {
        return res.status(403).json({ error: 'Forbidden: user mismatch' });
      }

      const parsedLimit = Math.max(1, parseInt(limit as string, 10) || 50);
      const conversation = await getOrMigrateConversation(collection, userId);

      const messages = (conversation?.messages || []).slice(-parsedLimit);
      return res.status(200).json({
        success: true,
        messages,
      });
    }

    // POST - Save a new message to chat history
    if (req.method === 'POST') {
      const { userId, message, role } = req.body || {};

      if (!userId || !message || !role) {
        return res.status(400).json({ 
          error: 'Missing required fields: userId, message, role' 
        });
      }
      if (!isAuthorizedForUser(req, String(userId))) {
        return res.status(403).json({ error: 'Forbidden: user mismatch' });
      }

      if (!['user', 'assistant'].includes(role)) {
        return res.status(400).json({ 
          error: 'Role must be "user" or "assistant"' 
        });
      }

      await getOrMigrateConversation(collection, String(userId));

      const chatMessage: StoredMessage = {
        role,
        content: message,
        timestamp: new Date(),
      };

      const result = await collection.findOneAndUpdate(
        { userId: String(userId), schemaVersion: 2 },
        {
          $setOnInsert: {
            userId: String(userId),
            schemaVersion: 2,
            createdAt: new Date(),
          },
          $set: { updatedAt: new Date() },
          $push: { messages: chatMessage },
        },
        { upsert: true, returnDocument: 'after' }
      );

      return res.status(201).json({
        success: true,
        messageId: null,
        message: chatMessage,
        totalMessages: (result?.messages || []).length,
      });
    }

    // DELETE - Clear chat history for a user
    if (req.method === 'DELETE') {
      const { userId } = req.body || req.query || {};

      if (!userId) {
        return res.status(400).json({ error: 'Missing userId parameter' });
      }
      if (!isAuthorizedForUser(req, String(userId))) {
        return res.status(403).json({ error: 'Forbidden: user mismatch' });
      }

      const result = await collection.deleteMany({ userId: userId as string });

      return res.status(200).json({
        success: true,
        deletedCount: result?.deletedCount || 0,
      });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('[Chat-History] Error:', err);
    if (req.method === 'GET') {
      return res.status(200).json({ success: true, messages: [] });
    }
    return res.status(500).json({
      error: 'Internal server error',
      message: err instanceof Error ? err.message : 'Unknown error',
    });
  }
}
