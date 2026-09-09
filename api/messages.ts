import type { VercelRequest, VercelResponse } from '@vercel/node';
import { MongoClient, type Db } from 'mongodb';

export interface StoredMessage {
  threadId: string;
  from: string;
  to: string;
  content: string;
  read: boolean;
  createdAt: string;
}

const DEFAULT_MONGODB_URI =
  'mongodb+srv://Vercel-Admin-atlas-amber-house:36UkjMa6SGPTMNoa@atlas-amber-house.hbybfiz.mongodb.net/white-room-protocol?retryWrites=true&w=majority';

const MONGODB_URI =
  process.env.MONGODB_URI ||
  process.env.MONGO_URI ||
  process.env.MONGODB_URL ||
  DEFAULT_MONGODB_URI;

let cachedClient: MongoClient | null = null;
let cachedDb: Db | null = null;

// In-memory fallback if MongoDB connection fails or in offline/development environments
const memoryMessages: StoredMessage[] = [];

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
    console.warn('[Messages API] MongoDB connection error, using in-memory store:', (err as any)?.message || err);
    return null;
  }
}

const norm = (id: unknown) =>
  String(id || '')
    .replace(/^SUBJECT-/i, '')
    .trim()
    .toUpperCase();

function threadKey(a: string, b: string) {
  return [a, b].sort().join('|');
}

function authorized(req: VercelRequest, userId: string): boolean {
  const raw = req.headers['x-subject-id'];
  const claimed = Array.isArray(raw) ? raw[0] : raw;
  if (!claimed) return true;
  return norm(claimed) === norm(userId);
}

function serializeMessage(m: any): StoredMessage {
  return {
    threadId: m.threadId,
    from: m.from,
    to: m.to,
    content: m.content,
    read: Boolean(m.read),
    createdAt: m.createdAt instanceof Date ? m.createdAt.toISOString() : String(m.createdAt || new Date().toISOString()),
  };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Subject-Id, x-subject-id, Cache-Control, cache-control');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const db = await getMongoDb();

    if (req.method === 'GET') {
      const userId = norm(req.query.userId);
      const peer = norm(req.query.with);
      const action = String(req.query.action || '');

      if (!userId) {
        return res.status(400).json({ error: 'Missing userId' });
      }
      if (!authorized(req, userId)) {
        return res.status(403).json({ error: 'Forbidden' });
      }

      // Unread summary (used by SoloNotificationWindow)
      if (action === 'unread') {
        let unread: StoredMessage[] = [];
        if (db) {
          try {
            const rawDocs = await db
              .collection('playerMessages')
              .find({ to: userId, read: false })
              .sort({ createdAt: -1 })
              .toArray();
            unread = rawDocs.map(serializeMessage);
          } catch (err) {
            console.warn('[Messages API] Mongo find error for unread, falling back to memory:', err);
            unread = memoryMessages.filter((m) => m.to === userId && !m.read);
          }
        } else {
          unread = memoryMessages.filter((m) => m.to === userId && !m.read);
        }

        const bySender = new Map<string, number>();
        unread.forEach((m) => bySender.set(m.from, (bySender.get(m.from) || 0) + 1));

        return res.status(200).json({
          success: true,
          unreadCount: unread.length,
          senders: Array.from(bySender.entries()).map(([from, count]) => ({ from, count })),
          latest: unread[0] || null,
        });
      }

      // Single conversation with a specific peer
      if (peer) {
        const tKey = threadKey(userId, peer);
        let messages: StoredMessage[] = [];

        if (db) {
          try {
            const col = db.collection('playerMessages');
            const rawDocs = await col
              .find({ threadId: tKey })
              .sort({ createdAt: 1 })
              .toArray();
            messages = rawDocs.map(serializeMessage);

            // Mark unread messages to this user as read
            await col.updateMany(
              { threadId: tKey, to: userId, read: false },
              { $set: { read: true } }
            );
          } catch (err) {
            console.warn('[Messages API] Mongo conversation fetch error, falling back to memory:', err);
            messages = memoryMessages.filter((m) => m.threadId === tKey);
            memoryMessages.forEach((m) => {
              if (m.threadId === tKey && m.to === userId) {
                m.read = true;
              }
            });
          }
        } else {
          messages = memoryMessages.filter((m) => m.threadId === tKey);
          memoryMessages.forEach((m) => {
            if (m.threadId === tKey && m.to === userId) {
              m.read = true;
            }
          });
        }

        return res.status(200).json({ success: true, messages });
      }

      // Thread list overview
      let all: StoredMessage[] = [];
      if (db) {
        try {
          const rawDocs = await db
            .collection('playerMessages')
            .find({ $or: [{ from: userId }, { to: userId }] })
            .sort({ createdAt: -1 })
            .toArray();
          all = rawDocs.map(serializeMessage);
        } catch (err) {
          console.warn('[Messages API] Mongo threads fetch error, falling back to memory:', err);
          all = memoryMessages
            .filter((m) => m.from === userId || m.to === userId)
            .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        }
      } else {
        all = memoryMessages
          .filter((m) => m.from === userId || m.to === userId)
          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      }

      const threads = new Map<string, {
        peerId: string;
        lastMessage: string;
        lastFrom: string;
        lastAt: string;
        unread: number;
      }>();

      for (const m of all) {
        const other = m.from === userId ? m.to : m.from;
        const existing = threads.get(other);
        if (!existing) {
          threads.set(other, {
            peerId: other,
            lastMessage: m.content,
            lastFrom: m.from,
            lastAt: m.createdAt,
            unread: m.to === userId && !m.read ? 1 : 0,
          });
        } else if (m.to === userId && !m.read) {
          existing.unread += 1;
        }
      }

      return res.status(200).json({ success: true, threads: Array.from(threads.values()) });
    }

    if (req.method === 'POST') {
      let body = req.body;
      if (typeof body === 'string') {
        try {
          body = JSON.parse(body);
        } catch {
          body = {};
        }
      }

      const { from, to, content } = body || {};
      const fromId = norm(from);
      const toId = norm(to);
      const text = String(content || '').trim();

      if (!fromId || !toId || !text) {
        return res.status(400).json({ error: 'Missing from, to or content' });
      }
      if (fromId === toId) {
        return res.status(400).json({ error: 'Cannot message yourself' });
      }
      if (!authorized(req, fromId)) {
        return res.status(403).json({ error: 'Forbidden' });
      }
      if (text.length > 2000) {
        return res.status(400).json({ error: 'Message exceeds 2000 characters limit' });
      }

      const doc: StoredMessage = {
        threadId: threadKey(fromId, toId),
        from: fromId,
        to: toId,
        content: text,
        read: false,
        createdAt: new Date().toISOString(),
      };

      if (db) {
        try {
          await db.collection('playerMessages').insertOne({
            ...doc,
            createdAt: new Date(),
          });
        } catch (err) {
          console.warn('[Messages API] Mongo insertOne error, storing in memory:', err);
          memoryMessages.push(doc);
        }
      } else {
        memoryMessages.push(doc);
      }

      return res.status(201).json({ success: true, message: doc });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('[Messages API] Unexpected error:', err);
    if (req.method === 'GET') {
      return res.status(200).json({
        success: true,
        messages: [],
        threads: [],
        unreadCount: 0,
        senders: [],
      });
    }
    return res.status(500).json({ error: 'Internal server error', details: (err as any)?.message || String(err) });
  }
}
