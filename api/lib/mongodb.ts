import { MongoClient, Db } from 'mongodb';

// Use environment variable or fallback to provided connection string
const uri = process.env.MONGODB_URI || 'mongodb+srv://Vercel-Admin-atlas-amber-house:36UkjMa6SGPTMNoa@atlas-amber-house.hbybfiz.mongodb.net/?retryWrites=true&w=majority';

// Connection options optimized for serverless environments
const options = {
  maxPoolSize: 10, // Maintain up to 10 socket connections
  serverSelectionTimeoutMS: 5000, // How long to try selecting a server
  socketTimeoutMS: 45000, // How long a send or receive on a socket can take before timeout
};

// For Vercel serverless functions, we need to use a global variable to reuse connections
// across function invocations (which is important for performance)
let globalWithMongo = global as typeof globalThis & {
  _mongoClientPromise?: Promise<MongoClient>;
};

let clientPromise: Promise<MongoClient>;

if (!globalWithMongo._mongoClientPromise) {
  const client = new MongoClient(uri, options);
  globalWithMongo._mongoClientPromise = client.connect();
}

clientPromise = globalWithMongo._mongoClientPromise;

// Export a module-scoped MongoClient promise. By doing this in a
// separate module, the client can be shared across functions.
export default clientPromise;

export async function getDb(): Promise<Db> {
  try {
    const client = await clientPromise;
    return client.db('white-room-protocol');
  } catch (error) {
    console.error('MongoDB connection error:', error);
    throw new Error(`Failed to connect to MongoDB: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

