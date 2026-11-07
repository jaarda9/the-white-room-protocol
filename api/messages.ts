import type { VercelRequest, VercelResponse } from '@vercel/node';
import { MongoClient, type Db } from 'mongodb';
import { findUserDocAcrossDatabases, handlesFor, requireSubject, subjectForHandle } from './lib/mongodb.js';
import { sendCommsTransmission } from './push.js';

/**
 * Hunter Comms. Every call is signed in (session token); the caller is always the session's
 * Subject. Other players are addressed by public handle (H-XXXXXXXX), never by Subject ID:
 * the Subject ID is a login credential. Messages are still stored by Subject ID, so threads
 * written before handles existed keep working.
 *
 *   GET  ?                      -> thread list   { threads: [{ peerId: handle, peerName, ... }] }
 *   GET  ?with=<handle>         -> conversation  { messages: [{ from, to, mine, ... }], peer }
 *   GET  ?action=unread         -> unread summary (senders by handle)
 *   GET  ?action=comms-prefs    -> { blocked: [{handle,name}], muted: [{handle,name}] }
 *   POST { to: <handle>, content }
 *   POST { action: 'block'|'unblock'|'mute'|'unmute', handle }
 *
 * Collections: playerMessages, commsPrefs { subjectId, blocked: [subjectId], muted: [subjectId] }
 */

export interface StoredMessage {
  threadId: string;
  from: string;
  to: string;
  content: string;
  read: boolean;
  createdAt: string;
}

const MONGODB_URI =
  process.env.MONGODB_URI ||
  process.env.MONGO_URI ||
  process.env.MONGODB_URL ||
  '';

// Never hardcode a fallback URI here — it ends up in git history. Without this var every
// handler silently drops to the in-memory store and nothing persists, so say so loudly.
if (!MONGODB_URI) {
  console.error('[api/messages.ts] MONGODB_URI is not set — using in-memory store, data will NOT persist.');
}

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

const COMMS_PREFS = 'commsPrefs';
/** Anti-spam: a burst limit and a daily cap per sender. */
const BURST_WINDOW_MS = 10 * 60_000;
const BURST_LIMIT = 30;
const DAILY_LIMIT = 200;
const ROUTINE_SHARE_PREFIX = '##WRP_ROUTINE_SHARE##';

const memoryCommsPrefs = new Map<string, { blocked: string[]; muted: string[] }>();

async function readCommsPrefs(db: Db | null, subjectId: string): Promise<{ blocked: string[]; muted: string[] }> {
  if (db) {
    try {
      const doc: any = await db.collection(COMMS_PREFS).findOne({ subjectId });
      return { blocked: doc?.blocked || [], muted: doc?.muted || [] };
    } catch {
      // fall through to memory
    }
  }
  return memoryCommsPrefs.get(subjectId) || { blocked: [], muted: [] };
}

async function writeCommsPrefs(db: Db | null, subjectId: string, prefs: { blocked: string[]; muted: string[] }) {
  if (db) {
    try {
      await db
        .collection(COMMS_PREFS)
        .updateOne({ subjectId }, { $set: { ...prefs, updatedAt: new Date() } }, { upsert: true });
      return;
    } catch (err) {
      console.warn('[Messages API] commsPrefs write failed, storing in memory:', err);
    }
  }
  memoryCommsPrefs.set(subjectId, prefs);
}

/** Display names for a set of Subjects (falls back to their handle, never their ID). */
async function namesFor(ids: string[], handles: Map<string, string>): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  await Promise.all(
    ids.map(async (id) => {
      let name = '';
      try {
        const found = await findUserDocAcrossDatabases(id);
        const ls = found?.doc?.localStorage || {};
        let profile = ls.userProfile;
        if (!profile && typeof ls.whiteroom_user_profile === 'string') {
          try {
            profile = JSON.parse(ls.whiteroom_user_profile);
          } catch {
            profile = null;
          }
        }
        name = String(profile?.displayName || profile?.fullName || ls.gameData?.name || '').trim();
        // Default names are built from the Subject ID ("SUBJECT-XXXXXX") — never show those.
        if (/^SUBJECT-/i.test(name) || norm(name) === id || name.toUpperCase().includes(id)) name = '';
      } catch {
        // ignore
      }
      out.set(id, name || `Hunter ${handles.get(id) || ''}`.trim());
    })
  );
  return out;
}

async function countRecentSends(db: Db | null, from: string, since: Date): Promise<number> {
  if (db) {
    try {
      return await db.collection('playerMessages').countDocuments({ from, createdAt: { $gte: since } });
    } catch {
      // fall through
    }
  }
  return memoryMessages.filter((m) => m.from === from && new Date(m.createdAt) >= since).length;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Cache-Control, cache-control');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const me = await requireSubject(req, res, req.method === 'GET' ? req.query.userId : undefined);
    if (!me) return;
    const db = await getMongoDb();

    if (req.method === 'GET') {
      const action = String(req.query.action || '');
      const prefs = await readCommsPrefs(db, me);
      const blocked = new Set(prefs.blocked);

      if (action === 'comms-prefs') {
        const ids = Array.from(new Set([...prefs.blocked, ...prefs.muted]));
        const handles = await handlesFor(ids);
        const names = await namesFor(ids, handles);
        const view = (list: string[]) =>
          list.map((id) => ({ handle: handles.get(id) || '', name: names.get(id) || '' })).filter((e) => e.handle);
        return res.status(200).json({ success: true, blocked: view(prefs.blocked), muted: view(prefs.muted) });
      }

      // Unread summary (used by SoloNotificationWindow / SystemDock)
      if (action === 'unread') {
        let unread: StoredMessage[] = [];
        if (db) {
          try {
            const rawDocs = await db
              .collection('playerMessages')
              .find({ to: me, read: false })
              .sort({ createdAt: -1 })
              .toArray();
            unread = rawDocs.map(serializeMessage);
          } catch (err) {
            console.warn('[Messages API] Mongo find error for unread, falling back to memory:', err);
            unread = memoryMessages.filter((m) => m.to === me && !m.read);
          }
        } else {
          unread = memoryMessages.filter((m) => m.to === me && !m.read);
        }
        unread = unread.filter((m) => !blocked.has(m.from));

        const bySender = new Map<string, number>();
        unread.forEach((m) => bySender.set(m.from, (bySender.get(m.from) || 0) + 1));
        const senderIds = Array.from(bySender.keys());
        const handles = await handlesFor([me, ...senderIds]);
        const names = await namesFor(senderIds, handles);
        const latest = unread[0];

        return res.status(200).json({
          success: true,
          unreadCount: unread.length,
          senders: senderIds.map((from) => ({
            from: handles.get(from) || '',
            name: names.get(from) || '',
            count: bySender.get(from) || 0,
          })),
          latest: latest
            ? {
                ...latest,
                threadId: '',
                from: handles.get(latest.from) || '',
                to: handles.get(me) || '',
                mine: false,
                fromName: names.get(latest.from) || '',
              }
            : null,
        });
      }

      // Single conversation with a specific peer (by handle)
      if (req.query.with) {
        const peer = await subjectForHandle(req.query.with);
        if (!peer) return res.status(404).json({ error: 'Unknown Hunter', messages: [] });
        const tKey = threadKey(me, peer);
        let messages: StoredMessage[] = [];

        if (db) {
          try {
            const col = db.collection('playerMessages');
            const rawDocs = await col.find({ threadId: tKey }).sort({ createdAt: 1 }).toArray();
            messages = rawDocs.map(serializeMessage);
            await col.updateMany({ threadId: tKey, to: me, read: false }, { $set: { read: true } });
          } catch (err) {
            console.warn('[Messages API] Mongo conversation fetch error, falling back to memory:', err);
            messages = memoryMessages.filter((m) => m.threadId === tKey);
            memoryMessages.forEach((m) => {
              if (m.threadId === tKey && m.to === me) m.read = true;
            });
          }
        } else {
          messages = memoryMessages.filter((m) => m.threadId === tKey);
          memoryMessages.forEach((m) => {
            if (m.threadId === tKey && m.to === me) m.read = true;
          });
        }

        const handles = await handlesFor([me, peer]);
        const names = await namesFor([peer], handles);
        return res.status(200).json({
          success: true,
          peer: {
            handle: handles.get(peer) || '',
            name: names.get(peer) || '',
            blocked: blocked.has(peer),
            muted: prefs.muted.includes(peer),
          },
          messages: messages.map((m) => ({
            ...m,
            threadId: '',
            from: handles.get(m.from) || '',
            to: handles.get(m.to) || '',
            mine: m.from === me,
          })),
        });
      }

      // Thread list overview
      let all: StoredMessage[] = [];
      if (db) {
        try {
          const rawDocs = await db
            .collection('playerMessages')
            .find({ $or: [{ from: me }, { to: me }] })
            .sort({ createdAt: -1 })
            .toArray();
          all = rawDocs.map(serializeMessage);
        } catch (err) {
          console.warn('[Messages API] Mongo threads fetch error, falling back to memory:', err);
          all = memoryMessages
            .filter((m) => m.from === me || m.to === me)
            .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        }
      } else {
        all = memoryMessages
          .filter((m) => m.from === me || m.to === me)
          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      }

      const threads = new Map<
        string,
        { peer: string; lastMessage: string; lastFromMe: boolean; lastAt: string; unread: number }
      >();
      for (const m of all) {
        const other = m.from === me ? m.to : m.from;
        const existing = threads.get(other);
        if (!existing) {
          threads.set(other, {
            peer: other,
            lastMessage: m.content,
            lastFromMe: m.from === me,
            lastAt: m.createdAt,
            unread: m.to === me && !m.read ? 1 : 0,
          });
        } else if (m.to === me && !m.read) {
          existing.unread += 1;
        }
      }

      const peers = Array.from(threads.keys());
      const handles = await handlesFor(peers);
      const names = await namesFor(peers, handles);
      return res.status(200).json({
        success: true,
        threads: Array.from(threads.values())
          .map((t) => ({
            peerId: handles.get(t.peer) || '',
            peerName: names.get(t.peer) || '',
            lastMessage: t.lastMessage,
            lastFromMe: t.lastFromMe,
            lastFrom: t.lastFromMe ? 'me' : 'peer',
            lastAt: t.lastAt,
            unread: blocked.has(t.peer) ? 0 : t.unread,
            blocked: blocked.has(t.peer),
          }))
          .filter((t) => t.peerId),
      });
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
      body = body || {};
      const action = String(body.action || '');

      if (['block', 'unblock', 'mute', 'unmute'].includes(action)) {
        const target = await subjectForHandle(body.handle);
        if (!target || target === me) return res.status(400).json({ error: 'Unknown Hunter' });
        const prefs = await readCommsPrefs(db, me);
        const listKey: 'blocked' | 'muted' = action.endsWith('block') ? 'blocked' : 'muted';
        const set = new Set(prefs[listKey]);
        if (action.startsWith('un')) set.delete(target);
        else set.add(target);
        await writeCommsPrefs(db, me, { ...prefs, [listKey]: Array.from(set).slice(0, 500) });
        return res.status(200).json({ success: true });
      }

      const toId = await subjectForHandle(body.to);
      const text = String(body.content || '').trim();
      if (!toId || !text) {
        return res.status(400).json({ error: 'Missing recipient or content' });
      }
      if (toId === me) {
        return res.status(400).json({ error: 'Cannot message yourself' });
      }
      // Must match ROUTINE_SHARE_PREFIX in src/lib/messaging-service.ts — a shared gym routine
      // rides the plain `content` field as marker + JSON, and a full weekly split easily runs
      // past the normal 2000-char anti-spam cap that free-typed chat should stay under.
      const isRoutineShare = text.startsWith(ROUTINE_SHARE_PREFIX);
      const maxLen = isRoutineShare ? 20000 : 2000;
      if (text.length > maxLen) {
        return res.status(400).json({ error: `Message exceeds ${maxLen} characters limit` });
      }

      const now = Date.now();
      if (
        (await countRecentSends(db, me, new Date(now - BURST_WINDOW_MS))) >= BURST_LIMIT ||
        (await countRecentSends(db, me, new Date(now - 86_400_000))) >= DAILY_LIMIT
      ) {
        return res
          .status(429)
          .json({ error: 'Transmission limit reached. Wait before sending more.', code: 'RATE_LIMITED' });
      }

      const recipientPrefs = await readCommsPrefs(db, toId);
      if (recipientPrefs.blocked.includes(me)) {
        return res.status(403).json({ error: 'This Hunter is not receiving your transmissions.', code: 'BLOCKED' });
      }

      const doc: StoredMessage = {
        threadId: threadKey(me, toId),
        from: me,
        to: toId,
        content: text,
        read: false,
        createdAt: new Date(now).toISOString(),
      };

      if (db) {
        try {
          await db.collection('playerMessages').insertOne({ ...doc, createdAt: new Date(now) });
        } catch (err) {
          console.warn('[Messages API] Mongo insertOne error, storing in memory:', err);
          memoryMessages.push(doc);
        }
      } else {
        memoryMessages.push(doc);
      }

      const handles = await handlesFor([me, toId]);
      if (!recipientPrefs.muted.includes(me)) {
        const names = await namesFor([me], handles);
        let preview = text;
        if (isRoutineShare) {
          try {
            preview = `[SHARED ROUTINE] ${JSON.parse(text.slice(ROUTINE_SHARE_PREFIX.length))?.name || ''}`.trim();
          } catch {
            preview = '[SHARED ROUTINE]';
          }
        }
        await sendCommsTransmission(toId, { handle: handles.get(me) || '', name: names.get(me) || 'A Hunter' }, preview);
      }

      return res.status(201).json({
        success: true,
        message: { ...doc, threadId: '', from: handles.get(me) || '', to: handles.get(toId) || '', mine: true },
      });
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
    return res.status(500).json({ error: 'Internal server error' });
  }
}
