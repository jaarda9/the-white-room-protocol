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
  if (uri && isMongoAvailable !== false) {
    try {
      if (!mongoClient) {
        mongoClient = new MongoClient(uri, {
          maxPoolSize: 10,
          serverSelectionTimeoutMS: 2500,
          socketTimeoutMS: 15000,
        });
        await mongoClient.connect();
        isMongoAvailable = true;
      }
      return { isMock: false, db: mongoClient.db('white-room-protocol'), client: mongoClient };
    } catch (err) {
      console.warn('[MongoDB] Real MongoDB unavailable, using in-memory database fallback:', (err as any)?.message || err);
      isMongoAvailable = false;
      mongoClient = null;
    }
  }

  return { isMock: true, db: inMemoryDb };
}

export async function getDb(): Promise<Db | any> {
  const { db } = await getDbClient();
  return db;
}
