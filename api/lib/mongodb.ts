import { MongoClient, type Db } from 'mongodb';
import { randomBytes, scrypt as scryptCb, createHash, timingSafeEqual } from 'crypto';

const uri =
  process.env.MONGODB_URI ||
  process.env.MONGO_URI ||
  process.env.MONGODB_URL ||
  '';

// Never hardcode a fallback URI here — it ends up in git history. Without this var every
// handler silently drops to the in-memory store and nothing persists, so say so loudly.
if (!uri) {
  console.error('[api/lib/mongodb.ts] MONGODB_URI is not set — using in-memory store, data will NOT persist.');
}

// In-memory fallback database for offline/unconfigured environments
class InMemoryCollection {
  name: string;
  private items: any[] = [];

  constructor(name: string) {
    this.name = name;
  }

  async findOne(query: Record<string, any>): Promise<any | null> {
    return (
      this.items.find((item) => {
        return Object.entries(query).every(([k, v]) => {
          if (k === '_id' && item._id) {
            return String(item._id) === String(v);
          }
          return item[k] === v;
        });
      }) || null
    );
  }

  find(query: Record<string, any> = {}) {
    let result = this.items.filter((item) => {
      return Object.entries(query).every(([k, v]) => {
        if (k === '_id' && item._id) {
          return String(item._id) === String(v);
        }
        if (k === '$or' && Array.isArray(v)) {
          return v.some((subQuery) => {
            return Object.entries(subQuery).every(([sk, sv]) => item[sk] === sv);
          });
        }
        if (v && typeof v === 'object' && '$in' in v) {
          return (v as any).$in.includes(item[k]);
        }
        if (v && typeof v === 'object' && '$type' in v) {
          return typeof item[k] === (v as any).$type;
        }
        return item[k] === v;
      });
    });

    const cursor = {
      sort: (sortObj: Record<string, number>) => {
        const [key, dir] = Object.entries(sortObj)[0] || ['_id', 1];
        result.sort((a, b) => {
          const valA = a[key];
          const valB = b[key];
          if (valA < valB) return dir === -1 ? 1 : -1;
          if (valA > valB) return dir === -1 ? -1 : 1;
          return 0;
        });
        return cursor;
      },
      limit: (n: number) => {
        result = result.slice(0, n);
        return cursor;
      },
      toArray: async () => [...result],
    };

    return cursor;
  }

  async updateMany(filter: Record<string, any>, update: Record<string, any>) {
    let count = 0;
    for (const item of this.items) {
      const match = Object.entries(filter).every(([k, v]) => {
        if (k === '_id' && item._id) return String(item._id) === String(v);
        return item[k] === v;
      });
      if (match) {
        if (update.$set) Object.assign(item, update.$set);
        count++;
      }
    }
    return { modifiedCount: count };
  }

  async updateOne(filter: Record<string, any>, update: Record<string, any>, options?: { upsert?: boolean }) {
    const existingIndex = this.items.findIndex((item) => {
      return Object.entries(filter).every(([k, v]) => {
        if (k === '_id' && item._id) return String(item._id) === String(v);
        return item[k] === v;
      });
    });

    if (existingIndex >= 0) {
      const existing = this.items[existingIndex];
      if (update.$set) Object.assign(existing, update.$set);
      if (update.$inc) {
        for (const [k, v] of Object.entries(update.$inc)) {
          existing[k] = (existing[k] || 0) + Number(v);
        }
      }
      return { modifiedCount: 1, upsertedId: null };
    } else if (options?.upsert) {
      const newItem: any = { _id: Date.now().toString(), ...filter };
      if (update.$setOnInsert) Object.assign(newItem, update.$setOnInsert);
      if (update.$set) Object.assign(newItem, update.$set);
      this.items.push(newItem);
      return { modifiedCount: 0, upsertedId: newItem._id };
    }
    return { modifiedCount: 0, upsertedId: null };
  }

  async deleteMany(filter: Record<string, any>) {
    const before = this.items.length;
    this.items = this.items.filter((item) => !Object.entries(filter).every(([k, v]) => item[k] === v));
    return { deletedCount: before - this.items.length };
  }

  async insertOne(doc: any) {
    const item = { _id: doc._id || Date.now().toString(), ...doc };
    this.items.push(item);
    return { insertedId: item._id };
  }
}

const inMemoryDb = {
  collections: new Map<string, InMemoryCollection>(),
  collection(name: string): InMemoryCollection {
    if (!this.collections.has(name)) {
      this.collections.set(name, new InMemoryCollection(name));
    }
    return this.collections.get(name)!;
  },
};

let mongoClient: MongoClient | null = null;
let isMongoAvailable: boolean | null = null;

export async function getDbClient(): Promise<{ isMock: boolean; db: any; client?: MongoClient }> {
  if (uri && isMongoAvailable !== false) {
    try {
      if (!mongoClient) {
        mongoClient = new MongoClient(uri, {
          maxPoolSize: 10,
          serverSelectionTimeoutMS: 4000,
          connectTimeoutMS: 5000,
          socketTimeoutMS: 10000,
        });
        await mongoClient.connect();
        isMongoAvailable = true;
      }
      const customDb = process.env.MONGODB_DB || process.env.MONGODB_DB_NAME;
      const db = customDb ? mongoClient.db(customDb) : mongoClient.db('white-room-protocol');
      return { isMock: false, db, client: mongoClient };
    } catch (err) {
      console.warn('[MongoDB] Connection error, using in-memory store:', (err as any)?.message || err);
      mongoClient = null;
    }
  }

  return { isMock: true, db: inMemoryDb };
}

export async function getDb(): Promise<Db | any> {
  const { db } = await getDbClient();
  return db;
}

export interface ResolvedMongoDocResult {
  doc: any;
  db: any;
  collectionName: string;
  databaseName: string;
}

export async function findUserDocAcrossDatabases(
  userId: string,
  providedClient?: MongoClient
): Promise<ResolvedMongoDocResult | null> {
  const cleanId = (userId || '').trim();
  if (!cleanId) return null;

  const bareId = cleanId.replace(/^SUBJECT-/i, '').trim();
  const fullId = `SUBJECT-${bareId}`;

  const { isMock, db, client: activeClient } = await getDbClient();
  const client = providedClient || activeClient;

  if (isMock || !client) {
    const col = db.collection('userData');
    const doc =
      (await col.findOne({ userId: cleanId })) ||
      (await col.findOne({ userId: bareId })) ||
      (await col.findOne({ userId: fullId }));
    if (doc) {
      return { doc, db, collectionName: 'userData', databaseName: 'memory' };
    }
    return null;
  }

  const query = {
    $or: [
      { userId: cleanId },
      { userId: bareId },
      { userId: fullId },
      { 'localStorage.userProfile.id': cleanId },
      { 'localStorage.userProfile.id': bareId },
      { 'localStorage.userProfile.id': fullId },
      { 'userProfile.id': cleanId },
      { 'userProfile.id': bareId },
      { 'userProfile.id': fullId },
    ],
  };

  const candidateDbNames: string[] = [];
  const customDb = process.env.MONGODB_DB || process.env.MONGODB_DB_NAME;
  if (customDb) candidateDbNames.push(customDb);
  for (const d of ['white-room-protocol', 'gamedata', 'whiteroom']) {
    if (!candidateDbNames.includes(d)) candidateDbNames.push(d);
  }

  for (const dbName of candidateDbNames) {
    try {
      const database = client.db(dbName);
      for (const colName of ['userData', 'users']) {
        try {
          const col = database.collection(colName);
          const doc = await col.findOne(query);
          if (doc) {
            return {
              doc,
              db: database,
              collectionName: colName,
              databaseName: dbName,
            };
          }
        } catch {
          // ignore
        }
      }
    } catch {
      // ignore
    }
  }

  return null;
}

// ---------------------------------------------------------------------------
// Subject authentication (Subject ID + PIN → session token)
// ---------------------------------------------------------------------------
// Lives in this shared module, not a new file: every file under api/ counts against the
// Hobby plan's 12-function limit.
//
// Collections:
//   subjectAuth     { subjectId, pinSalt, pinHash, recoverySalt, recoveryHash,
//                     failedAttempts, lockedUntil, recoveryFailedAttempts,
//                     recoveryLockedUntil, createdAt, updatedAt }
//   subjectSessions { tokenHash, subjectId, createdAt, lastUsedAt, expiresAt }   (TTL)
//   hunterHandles   { subjectId, handle, createdAt }  — the public name other players see;
//                     the Subject ID itself is a login credential and never leaves the server
//                     for anyone but its owner.

const AUTH = 'subjectAuth';
const SESSIONS = 'subjectSessions';
const HANDLES = 'hunterHandles';
const SESSION_DAYS = 180;
const MAX_FAILED_ATTEMPTS = 5;
const LOCK_MINUTES = 15;
const SAFE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export const normSubject = (v: unknown): string =>
  String(v || '')
    .replace(/^SUBJECT-/i, '')
    .trim()
    .toUpperCase();

export function isValidPin(pin: unknown): pin is string {
  return typeof pin === 'string' && /^\d{6}$/.test(pin);
}

export function randomCode(length: number): string {
  const bytes = randomBytes(length);
  let out = '';
  for (let i = 0; i < length; i++) out += SAFE_ALPHABET[bytes[i] % SAFE_ALPHABET.length];
  return out;
}

/** Recovery codes are shown as XXXX-XXXX-XXXX; compare without dashes/spaces/case. */
const normRecovery = (code: unknown) => String(code || '').replace(/[^A-Za-z0-9]/g, '').toUpperCase();

export function formatRecoveryCode(code: string): string {
  const c = normRecovery(code);
  return [c.slice(0, 4), c.slice(4, 8), c.slice(8, 12)].join('-');
}

function scrypt(secret: string, salt: string): Promise<Buffer> {
  return new Promise((resolve, reject) =>
    scryptCb(secret, salt, 32, { N: 16384, r: 8, p: 1 }, (err, key) => (err ? reject(err) : resolve(key as Buffer)))
  );
}

async function hashSecret(secret: string): Promise<{ salt: string; hash: string }> {
  const salt = randomBytes(16).toString('hex');
  const hash = (await scrypt(secret, salt)).toString('hex');
  return { salt, hash };
}

async function verifySecret(secret: string, salt: string, hash: string): Promise<boolean> {
  if (!salt || !hash) return false;
  const actual = await scrypt(secret, salt);
  const expected = Buffer.from(hash, 'hex');
  return expected.length === actual.length && timingSafeEqual(actual, expected);
}

const sha256 = (v: string) => createHash('sha256').update(v).digest('hex');

let authIndexesReady = false;
async function ensureAuthIndexes(db: any) {
  if (authIndexesReady) return;
  authIndexesReady = true;
  try {
    if (typeof db.collection(AUTH).createIndex !== 'function') return; // in-memory store
    await db.collection(AUTH).createIndex({ subjectId: 1 }, { unique: true });
    await db.collection(SESSIONS).createIndex({ tokenHash: 1 }, { unique: true });
    await db.collection(SESSIONS).createIndex({ subjectId: 1 });
    await db.collection(SESSIONS).createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
    await db.collection(HANDLES).createIndex({ subjectId: 1 }, { unique: true });
    await db.collection(HANDLES).createIndex({ handle: 1 }, { unique: true });
  } catch (err) {
    console.warn('[auth] index setup failed:', (err as any)?.message || err);
  }
}

export async function getAuthRecord(subjectId: string): Promise<any | null> {
  const db = await getDb();
  await ensureAuthIndexes(db);
  return db.collection(AUTH).findOne({ subjectId: normSubject(subjectId) });
}

/** True when a save document exists for this Subject (accounts created before PINs existed). */
export async function subjectHasSave(subjectId: string): Promise<boolean> {
  const found = await findUserDocAcrossDatabases(normSubject(subjectId));
  return Boolean(found?.doc);
}

/**
 * Creates the PIN record. Returns null if one already exists — the unique index makes two
 * racing claims on the same Subject resolve to exactly one winner.
 */
export async function createAuthRecord(subjectId: string, pin: string): Promise<{ recoveryCode: string } | null> {
  const db = await getDb();
  await ensureAuthIndexes(db);
  const id = normSubject(subjectId);
  if (await db.collection(AUTH).findOne({ subjectId: id })) return null;
  const recoveryCode = randomCode(12);
  const [p, r] = await Promise.all([hashSecret(pin), hashSecret(recoveryCode)]);
  const now = new Date();
  try {
    await db.collection(AUTH).insertOne({
      subjectId: id,
      pinSalt: p.salt,
      pinHash: p.hash,
      recoverySalt: r.salt,
      recoveryHash: r.hash,
      failedAttempts: 0,
      lockedUntil: null,
      createdAt: now,
      updatedAt: now,
    });
  } catch (err: any) {
    if (err?.code === 11000) return null; // lost the race
    throw err;
  }
  return { recoveryCode: formatRecoveryCode(recoveryCode) };
}

/** Flat (not a discriminated union) so it narrows the same with or without strict mode. */
export interface CredentialCheck {
  ok: boolean;
  reason?: 'locked' | 'invalid';
  retryAfterSeconds?: number;
  attemptsLeft?: number;
}

/**
 * Verifies a PIN or recovery code with lockout: 5 wrong tries → locked for 15 minutes.
 * PIN and recovery code keep separate counters, so someone hammering a PIN cannot also lock
 * the owner out of recovery.
 */
export async function checkCredential(
  record: any,
  kind: 'pin' | 'recovery',
  secret: string
): Promise<CredentialCheck> {
  const db = await getDb();
  const failedField = kind === 'pin' ? 'failedAttempts' : 'recoveryFailedAttempts';
  const lockField = kind === 'pin' ? 'lockedUntil' : 'recoveryLockedUntil';
  const now = Date.now();
  const lockedUntil = record[lockField] ? new Date(record[lockField]).getTime() : 0;
  if (lockedUntil > now) {
    return { ok: false, reason: 'locked', retryAfterSeconds: Math.ceil((lockedUntil - now) / 1000) };
  }
  const valid =
    kind === 'pin'
      ? await verifySecret(String(secret || ''), record.pinSalt, record.pinHash)
      : await verifySecret(normRecovery(secret), record.recoverySalt, record.recoveryHash);

  if (valid) {
    if (record[failedField] || record[lockField]) {
      await db.collection(AUTH).updateOne(
        { subjectId: record.subjectId },
        { $set: { [failedField]: 0, [lockField]: null } }
      );
    }
    return { ok: true };
  }

  // A lock that has already expired starts a fresh count.
  const failed = (lockedUntil && lockedUntil <= now ? 0 : Number(record[failedField]) || 0) + 1;
  const lock = failed >= MAX_FAILED_ATTEMPTS;
  await db.collection(AUTH).updateOne(
    { subjectId: record.subjectId },
    {
      $set: {
        [failedField]: lock ? 0 : failed,
        [lockField]: lock ? new Date(now + LOCK_MINUTES * 60_000) : null,
      },
    }
  );
  if (lock) return { ok: false, reason: 'locked', retryAfterSeconds: LOCK_MINUTES * 60 };
  return { ok: false, reason: 'invalid', attemptsLeft: MAX_FAILED_ATTEMPTS - failed };
}

/** Sets a new PIN and a fresh recovery code, and signs every device out. */
export async function resetCredentials(subjectId: string, newPin: string): Promise<{ recoveryCode: string }> {
  const db = await getDb();
  const id = normSubject(subjectId);
  const recoveryCode = randomCode(12);
  const [p, r] = await Promise.all([hashSecret(newPin), hashSecret(recoveryCode)]);
  await db.collection(AUTH).updateOne(
    { subjectId: id },
    {
      $set: {
        pinSalt: p.salt,
        pinHash: p.hash,
        recoverySalt: r.salt,
        recoveryHash: r.hash,
        failedAttempts: 0,
        lockedUntil: null,
        recoveryFailedAttempts: 0,
        recoveryLockedUntil: null,
        updatedAt: new Date(),
      },
    }
  );
  await db.collection(SESSIONS).deleteMany({ subjectId: id });
  return { recoveryCode: formatRecoveryCode(recoveryCode) };
}

/** Changes the PIN only; the recovery code and signed-in devices stay valid. */
export async function changePin(subjectId: string, newPin: string): Promise<void> {
  const db = await getDb();
  const p = await hashSecret(newPin);
  await db.collection(AUTH).updateOne(
    { subjectId: normSubject(subjectId) },
    { $set: { pinSalt: p.salt, pinHash: p.hash, updatedAt: new Date() } }
  );
}

/** Replaces the recovery code (the old one stops working). PIN and sessions unchanged. */
export async function regenerateRecoveryCode(subjectId: string): Promise<{ recoveryCode: string }> {
  const db = await getDb();
  const recoveryCode = randomCode(12);
  const r = await hashSecret(recoveryCode);
  await db.collection(AUTH).updateOne(
    { subjectId: normSubject(subjectId) },
    { $set: { recoverySalt: r.salt, recoveryHash: r.hash, updatedAt: new Date() } }
  );
  return { recoveryCode: formatRecoveryCode(recoveryCode) };
}

export async function issueSession(subjectId: string): Promise<string> {
  const db = await getDb();
  await ensureAuthIndexes(db);
  const token = randomBytes(32).toString('base64url');
  const now = new Date();
  await db.collection(SESSIONS).insertOne({
    tokenHash: sha256(token),
    subjectId: normSubject(subjectId),
    createdAt: now,
    lastUsedAt: now,
    expiresAt: new Date(now.getTime() + SESSION_DAYS * 86_400_000),
  });
  return token;
}

export async function revokeSession(token: string): Promise<void> {
  const db = await getDb();
  await db.collection(SESSIONS).deleteMany({ tokenHash: sha256(token) });
}

export function bearerToken(req: any): string | null {
  const raw = req?.headers?.authorization || req?.headers?.Authorization;
  const value = Array.isArray(raw) ? raw[0] : raw;
  const match = typeof value === 'string' ? value.match(/^Bearer\s+(.+)$/i) : null;
  return match ? match[1].trim() : null;
}

/** The Subject this request is signed in as, or null. Slides the expiry on use (at most daily). */
export async function resolveSession(req: any): Promise<string | null> {
  const token = bearerToken(req);
  if (!token || token.length < 20 || token.length > 200) return null;
  const db = await getDb();
  const session = await db.collection(SESSIONS).findOne({ tokenHash: sha256(token) });
  if (!session) return null;
  const now = Date.now();
  if (session.expiresAt && new Date(session.expiresAt).getTime() <= now) return null;
  if (!session.lastUsedAt || now - new Date(session.lastUsedAt).getTime() > 86_400_000) {
    Promise.resolve(
      db.collection(SESSIONS).updateOne(
        { tokenHash: session.tokenHash },
        { $set: { lastUsedAt: new Date(now), expiresAt: new Date(now + SESSION_DAYS * 86_400_000) } }
      )
    ).catch(() => {});
  }
  return normSubject(session.subjectId);
}

/**
 * Gate for every private endpoint. Responds 401 (no/expired session) or 403 (signed in as a
 * different Subject than the one the request names) and returns null; otherwise returns the
 * signed-in Subject ID.
 */
export async function requireSubject(req: any, res: any, claimed?: unknown): Promise<string | null> {
  const subjectId = await resolveSession(req);
  if (!subjectId) {
    res.status(401).json({ error: 'Authentication required', code: 'AUTH_REQUIRED' });
    return null;
  }
  if (claimed !== undefined && claimed !== null && claimed !== '' && normSubject(claimed) !== subjectId) {
    res.status(403).json({ error: 'Forbidden', code: 'SUBJECT_MISMATCH' });
    return null;
  }
  return subjectId;
}

/** Public handle for a Subject, created on first use. */
export async function getOrCreateHandle(subjectId: string): Promise<string> {
  const map = await handlesFor([subjectId]);
  return map.get(normSubject(subjectId)) || '';
}

/** Batch version: Subject ID → handle for every id given, creating missing ones. */
export async function handlesFor(subjectIds: string[]): Promise<Map<string, string>> {
  const db = await getDb();
  await ensureAuthIndexes(db);
  const ids = Array.from(new Set(subjectIds.map(normSubject).filter(Boolean)));
  const out = new Map<string, string>();
  if (ids.length === 0) return out;
  const col = db.collection(HANDLES);
  const existing: any[] = await col.find({ subjectId: { $in: ids } }).toArray();
  for (const doc of existing) out.set(doc.subjectId, doc.handle);
  for (const id of ids) {
    if (out.has(id)) continue;
    for (let attempt = 0; attempt < 5; attempt++) {
      const handle = `H-${randomCode(8)}`;
      try {
        await col.insertOne({ subjectId: id, handle, createdAt: new Date() });
        out.set(id, handle);
        break;
      } catch (err: any) {
        if (err?.code !== 11000) throw err;
        const raced = await col.findOne({ subjectId: id });
        if (raced) {
          out.set(id, raced.handle);
          break;
        }
      }
    }
  }
  return out;
}

/** Handle → Subject ID (null when unknown). */
export async function subjectForHandle(handle: unknown): Promise<string | null> {
  const h = String(handle || '').trim().toUpperCase();
  if (!/^H-[A-Z0-9]{8}$/.test(h)) return null;
  const db = await getDb();
  const doc = await db.collection(HANDLES).findOne({ handle: h });
  return doc ? normSubject(doc.subjectId) : null;
}

// Default export to ensure Vercel treats this file safely if routed
export default function handler(req: any, res: any) {
  return res.status(200).json({ status: 'ok', service: 'mongodb-helper' });
}
