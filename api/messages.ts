import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getDb } from './lib/mongodb';

type StoredMessage = {
  threadId: string;
  from: string;
  to: string;
  content: string;
  read: boolean;
  createdAt: Date;
};

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
  return norm(claimed) === userId;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Subject-Id');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const db = await getDb();
    const col = db.collection('playerMessages');

    if (req.method === 'GET') {
      const userId = norm(req.query.userId);
      const peer = norm(req.query.with);
      const action = String(req.query.action || '');

      if (!userId) return res.status(400).json({ error: 'Missing userId' });
      if (!authorized(req, userId)) return res.status(403).json({ error: 'Forbidden' });

      // Unread summary (used by the Notices window)
      if (action === 'unread') {
        const unread: StoredMessage[] = await col
          .find({ to: userId, read: false })
          .sort({ createdAt: -1 })
          .toArray();
        const bySender = new Map<string, number>();
        unread.forEach((m) => bySender.set(m.from, (bySender.get(m.from) || 0) + 1));
        return res.status(200).json({
          success: true,
          unreadCount: unread.length,
          senders: Array.from(bySender.entries()).map(([from, count]) => ({ from, count })),
          latest: unread[0] || null,
        });
      }

      // Single conversation
      if (peer) {
        const messages: StoredMessage[] = await col
          .find({ threadId: threadKey(userId, peer) })
          .sort({ createdAt: 1 })
          .toArray();
        try {
          await col.updateMany(
            { threadId: threadKey(userId, peer), to: userId, read: false },
            { $set: { read: true } }
          );
        } catch {
          // in-memory fallback may not support updateMany
        }
        return res.status(200).json({ success: true, messages });
      }

      // Thread list
      const all: StoredMessage[] = await col
        .find({ $or: [{ from: userId }, { to: userId }] })
        .sort({ createdAt: -1 })
        .toArray();

      const threads = new Map<string, any>();
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
      const { from, to, content } = req.body || {};
      const fromId = norm(from);
      const toId = norm(to);
      const text = String(content || '').trim();

      if (!fromId || !toId || !text) {
        return res.status(400).json({ error: 'Missing from, to or content' });
      }
      if (fromId === toId) return res.status(400).json({ error: 'Cannot message yourself' });
      if (!authorized(req, fromId)) return res.status(403).json({ error: 'Forbidden' });
      if (text.length > 2000) return res.status(400).json({ error: 'Message too long' });

      const doc: StoredMessage = {
        threadId: threadKey(fromId, toId),
        from: fromId,
        to: toId,
        content: text,
        read: false,
        createdAt: new Date(),
      };
      await col.insertOne(doc);
      return res.status(201).json({ success: true, message: doc });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('[Messages] Error:', err);
    if (req.method === 'GET') {
      return res.status(200).json({ success: true, messages: [], threads: [], unreadCount: 0, senders: [] });
    }
    return res.status(500).json({ error: 'Internal server error' });
  }
}
