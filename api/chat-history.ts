import type { VercelRequest, VercelResponse } from '@vercel/node';
import { MongoClient } from 'mongodb';

// Environment variable for MongoDB connection
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://Vercel-Admin-atlas-amber-house:36UkjMa6SGPTMNoa@atlas-amber-house.hbybfiz.mongodb.net/?retryWrites=true&w=majority';

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
  return !!subjectId && subjectId === userId;
}

async function getOrMigrateConversation(
  collection: ReturnType<MongoClient['db']>['collection'],
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
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // GET - Retrieve chat history for a user
  if (req.method === 'GET') {
    const client = new MongoClient(MONGODB_URI);
    
    try {
      const { userId, limit = '50' } = req.query;

      if (!userId || typeof userId !== 'string') {
        return res.status(400).json({ error: 'Missing userId parameter' });
      }
      if (!isAuthorizedForUser(req, userId)) {
        return res.status(403).json({ error: 'Forbidden: user mismatch' });
      }

      try {
        await client.connect();
        const db = client.db('white-room-protocol');
        const collection = db.collection('chatHistory');

        const parsedLimit = Math.max(1, parseInt(limit as string, 10) || 50);
        const conversation = await getOrMigrateConversation(collection, userId);

        const messages = (conversation?.messages || []).slice(-parsedLimit);
        return res.status(200).json({
          success: true,
          messages,
        });
      } catch (dbError) {
        console.error('[Chat-History] Database error in GET:', dbError);
        // Return empty array if database error (graceful degradation)
        return res.status(200).json({
          success: true,
          messages: []
        });
      } finally {
        await client.close();
      }
    } catch (err) {
      console.error('[Chat-History] Unexpected error in GET:', err);
      // Return empty array on any unexpected error (graceful degradation)
      return res.status(200).json({
        success: true,
        messages: []
      });
    }
  }

  // POST - Save a new message to chat history
  if (req.method === 'POST') {
    const client = new MongoClient(MONGODB_URI);
    
    try {
      const { userId, message, role } = req.body;

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

      try {
        await client.connect();
        const db = client.db('white-room-protocol');
        const collection = db.collection('chatHistory');

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
      } catch (dbError) {
        console.error('[Chat-History] Database error in POST:', dbError);
        return res.status(500).json({ 
          error: 'Failed to save message to database',
          details: dbError instanceof Error ? dbError.message : 'Unknown error'
        });
      } finally {
        await client.close();
      }
    } catch (err) {
      console.error('[Chat-History] Unexpected error in POST:', err);
      return res.status(500).json({ 
        error: 'Internal server error',
        message: err instanceof Error ? err.message : 'Unknown error'
      });
    }
  }

  // DELETE - Clear chat history for a user
  if (req.method === 'DELETE') {
    const client = new MongoClient(MONGODB_URI);
    
    try {
      const { userId } = req.body || req.query;

      if (!userId) {
        return res.status(400).json({ error: 'Missing userId parameter' });
      }
      if (!isAuthorizedForUser(req, String(userId))) {
        return res.status(403).json({ error: 'Forbidden: user mismatch' });
      }

      try {
        await client.connect();
        const db = client.db('white-room-protocol');
        const collection = db.collection('chatHistory');

        const result = await collection.deleteMany({ userId: userId as string });

        return res.status(200).json({
          success: true,
          deletedCount: result.deletedCount,
        });
      } catch (dbError) {
        console.error('[Chat-History] Database error in DELETE:', dbError);
        return res.status(500).json({ 
          error: 'Failed to clear chat history',
          details: dbError instanceof Error ? dbError.message : 'Unknown error'
        });
      } finally {
        await client.close();
      }
    } catch (err) {
      console.error('[Chat-History] Unexpected error in DELETE:', err);
      return res.status(500).json({ 
        error: 'Internal server error',
        message: err instanceof Error ? err.message : 'Unknown error'
      });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
