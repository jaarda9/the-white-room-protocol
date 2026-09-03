import { MongoClient, type Db } from 'mongodb';

const DEFAULT_MONGODB_URI =
  'mongodb+srv://Vercel-Admin-atlas-amber-house:36UkjMa6SGPTMNoa@atlas-amber-house.hbybfiz.mongodb.net/white-room-protocol?retryWrites=true&w=majority';

const uri =
  process.env.MONGODB_URI ||
  process.env.MONGO_URI ||
  process.env.MONGODB_URL ||
  DEFAULT_MONGODB_URI;

// In-memory fallback database for offline/unconfigured environments
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

// Default export to ensure Vercel treats this file safely if routed
export default function handler(req: any, res: any) {
  return res.status(200).json({ status: 'ok', service: 'mongodb-helper' });
}
