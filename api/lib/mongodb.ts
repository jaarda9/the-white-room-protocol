import { MongoClient, Db, ObjectId } from 'mongodb';

const uri = process.env.MONGODB_URI || '';

// In-memory fallback database for when MongoDB is offline / unconfigured
class InMemoryCollection {
  private items: any[] = [];

  constructor(public name: string) {}

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
      if (update.$push) {
        for (const [k, v] of Object.entries(update.$push)) {
          if (!Array.isArray(existing[k])) existing[k] = [];
          existing[k].push(v);
        }
      }
      return { modifiedCount: 1, upsertedId: null };
    } else if (options?.upsert) {
      const newItem: any = { _id: new ObjectId(), ...filter };
      if (update.$setOnInsert) Object.assign(newItem, update.$setOnInsert);
      if (update.$set) Object.assign(newItem, update.$set);
      this.items.push(newItem);
      return { modifiedCount: 0, upsertedId: newItem._id };
    }
    return { modifiedCount: 0, upsertedId: null };
  }

  async updateMany(filter: Record<string, any>, update: Record<string, any>) {
    let modifiedCount = 0;
    for (const item of this.items) {
      const match = Object.entries(filter).every(([k, v]) => {
        if (k === '_id' && item._id) return String(item._id) === String(v);
        return item[k] === v;
      });
      if (match) {
        if (update.$set) Object.assign(item, update.$set);
        modifiedCount++;
      }
    }
    return { modifiedCount };
  }

  async insertOne(doc: any) {
    const item = { _id: doc._id || new ObjectId(), ...doc };
    this.items.push(item);
    return { insertedId: item._id };
  }

  async insertMany(docs: any[]) {
    const insertedIds: any[] = [];
    for (const doc of docs) {
      const item = { _id: doc._id || new ObjectId(), ...doc };
      this.items.push(item);
      insertedIds.push(item._id);
    }
    return { insertedIds };
  }

  async findOneAndUpdate(filter: Record<string, any>, update: Record<string, any>, options?: { upsert?: boolean; returnDocument?: string }) {
    await this.updateOne(filter, update, options);
    return this.findOne(filter);
  }

  async deleteMany(filter: Record<string, any>) {
    const beforeCount = this.items.length;
    this.items = this.items.filter((item) => {
      return !Object.entries(filter).every(([k, v]) => {
        if (k === '_id' && item._id) return String(item._id) === String(v);
        return item[k] === v;
      });
    });
    return { deletedCount: beforeCount - this.items.length };
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
  const currentUri = process.env.MONGODB_URI || process.env.MONGO_URI || process.env.MONGODB_URL || uri;
  if (currentUri && isMongoAvailable !== false) {
    try {
      if (!mongoClient) {
        mongoClient = new MongoClient(currentUri, {
          maxPoolSize: 10,
          serverSelectionTimeoutMS: 4000,
          connectTimeoutMS: 5000,
          socketTimeoutMS: 15000,
        });
        await mongoClient.connect();
        isMongoAvailable = true;
      }
      let db: any;
      const customDb = process.env.MONGODB_DB || process.env.MONGODB_DB_NAME;
      if (customDb) {
        db = mongoClient.db(customDb);
      } else {
        // In MongoClient, client.db() uses the URI database, or 'test' if none in URI.
        // We set default db, but multi-database search will also scan 'gamedata', 'whiteroom', etc.
        db = mongoClient.db();
      }
      return { isMock: false, db, client: mongoClient };
    } catch (err) {
      console.warn('[MongoDB] Real MongoDB connection error, falling back to in-memory store:', (err as any)?.message || err);
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

function computeDocProgress(doc: any): { level: number; xp: number; date: number } {
  if (!doc) return { level: 0, xp: 0, date: 0 };
  const ls = doc.localStorage || {};
  let prof = ls.userProfile;
  if (!prof && ls.whiteroom_user_profile) {
    try {
      prof = typeof ls.whiteroom_user_profile === 'string' ? JSON.parse(ls.whiteroom_user_profile) : ls.whiteroom_user_profile;
    } catch {
      // ignore
    }
  }
  if (!prof && doc.userProfile) prof = doc.userProfile;
  const gameData = ls.gameData || doc.gameData || {};

  const level = Number(doc.level ?? gameData.level ?? prof?.level ?? 1);
  const xp = Number(doc.exp ?? doc.xp ?? gameData.exp ?? gameData.xp ?? prof?.xp ?? prof?.exp ?? 0);
  const date = doc.lastUpdated ? new Date(doc.lastUpdated).getTime() : 0;
  return { level, xp, date };
}

/**
 * Searches across candidate databases and collections for the user document,
 * ranking by level and XP so that real user progress (e.g. LVL 190) is always
 * preferred over dummy or auto-saved initial states.
 */
export async function findUserDocAcrossDatabases(
  userId: string,
  providedClient?: MongoClient
): Promise<ResolvedMongoDocResult | null> {
  const cleanId = (userId || '').trim();
  if (!cleanId) return null;

  const bareId = cleanId.replace(/^SUBJECT-/i, '').trim();
  const escapedBare = bareId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const escapedClean = cleanId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  const { isMock, db, client: activeClient } = await getDbClient();
  const client = providedClient || activeClient;

  if (isMock || !client) {
    // In-memory fallback
    const collections = ['userData', 'users'];
    for (const cName of collections) {
      const col = db.collection(cName);
      const doc =
        (await col.findOne({ userId: cleanId })) ||
        (await col.findOne({ userId: bareId })) ||
        (await col.findOne({ userId: `SUBJECT-${bareId}` }));
      if (doc) {
        return { doc, db, collectionName: cName, databaseName: 'memory' };
      }
    }
    return null;
  }

  // Real MongoDB: gather candidate databases
  const candidateDbNames: string[] = [];
  const customDb = process.env.MONGODB_DB || process.env.MONGODB_DB_NAME;
  if (customDb && !candidateDbNames.includes(customDb)) candidateDbNames.push(customDb);

  try {
    const defaultDbName = client.db().databaseName;
    if (defaultDbName && !candidateDbNames.includes(defaultDbName)) {
      candidateDbNames.push(defaultDbName);
    }
  } catch {
    // ignore
  }

  // Always check standard gamedata and whiteroom database names
  for (const name of ['gamedata', 'whiteroom', 'white-room', 'test']) {
    if (!candidateDbNames.includes(name)) {
      candidateDbNames.push(name);
    }
  }

  // Try to list databases on cluster if admin access permits
  try {
    const adminDb = client.db('admin');
    const dbsList = await adminDb.admin().listDatabases();
    if (dbsList && Array.isArray(dbsList.databases)) {
      for (const d of dbsList.databases) {
        if (d.name && !['admin', 'local', 'config'].includes(d.name) && !candidateDbNames.includes(d.name)) {
          candidateDbNames.push(d.name);
        }
      }
    }
  } catch {
    // Admin listDatabases might be restricted on some Atlas roles, which is normal
  }

  const collectionsToCheck = ['userData', 'users', 'user_data', 'profiles'];
  const regexPattern = new RegExp(`^(SUBJECT-)?${escapedBare}$`, 'i');

  const orClauses: any[] = [
    { userId: cleanId },
    { userId: bareId },
    { userId: `SUBJECT-${bareId}` },
    { userId: { $regex: regexPattern } },
    { 'localStorage.userProfile.id': cleanId },
    { 'localStorage.userProfile.id': bareId },
    { 'localStorage.userProfile.id': { $regex: regexPattern } },
    { 'localStorage.userProfile.pseudo': { $regex: regexPattern } },
    { 'userProfile.id': cleanId },
    { 'userProfile.id': bareId },
    { 'userProfile.id': { $regex: regexPattern } },
    { 'userProfile.pseudo': { $regex: regexPattern } },
    { 'gameData.name': { $regex: new RegExp(`^${escapedClean}$`, 'i') } },
    { 'localStorage.userProfile.fullName': { $regex: new RegExp(`^${escapedClean}$`, 'i') } },
  ];

  if (ObjectId.isValid(cleanId)) {
    try {
      orClauses.push({ _id: new ObjectId(cleanId) });
    } catch {
      // ignore
    }
  }

  const query = { $or: orClauses };
  const matchingCandidates: ResolvedMongoDocResult[] = [];

  for (const dbName of candidateDbNames) {
    try {
      const database = client.db(dbName);
      for (const colName of collectionsToCheck) {
        try {
          const col = database.collection(colName);
          const foundDocs = await col.find(query).limit(5).toArray();
          for (const doc of foundDocs) {
            matchingCandidates.push({
              doc,
              db: database,
              collectionName: colName,
              databaseName: dbName,
            });
          }
        } catch {
          // collection might not exist in this db
        }
      }
    } catch {
      // db access error
    }
  }

  if (matchingCandidates.length === 0) {
    return null;
  }

  // Sort candidate documents by progress (highest level, then highest xp, then most recent date)
  matchingCandidates.sort((a, b) => {
    const aProg = computeDocProgress(a.doc);
    const bProg = computeDocProgress(b.doc);
    if (bProg.level !== aProg.level) {
      return bProg.level - aProg.level;
    }
    if (bProg.xp !== aProg.xp) {
      return bProg.xp - aProg.xp;
    }
    return bProg.date - aProg.date;
  });

  return matchingCandidates[0];
}
