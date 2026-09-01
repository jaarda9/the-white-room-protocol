import type { VercelRequest, VercelResponse } from '@vercel/node';
import { MongoClient } from 'mongodb';

// Environment variable for MongoDB connection
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://Vercel-Admin-atlas-amber-house:36UkjMa6SGPTMNoa@atlas-amber-house.hbybfiz.mongodb.net/?retryWrites=true&w=majority';

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const client = new MongoClient(MONGODB_URI);
  
  try {
    await client.connect();
    const db = client.db('white-room-protocol');
    const collection = db.collection('userData');

    if (req.method === 'POST') {
      const { userId, localStorageData } = req.body;

      if (!userId || !localStorageData) {
        return res.status(400).json({ error: 'Missing userId or localStorageData' });
      }

      const result = await collection.updateOne(
        { userId: userId },
        { 
          $set: { 
            localStorage: localStorageData,
            lastUpdated: new Date()
          } 
        },
        { upsert: true }
      );

      res.status(200).json({ 
        success: true, 
        message: 'LocalStorage data synced successfully',
        modifiedCount: result.modifiedCount,
        upsertedId: result.upsertedId
      });

    } else if (req.method === 'GET') {
      const { userId } = req.query;
      
      if (!userId || typeof userId !== 'string') {
        return res.status(400).json({ error: 'Missing userId parameter' });
      }
  
      const userDoc = await collection.findOne({ userId: userId });
      
      if (!userDoc) {
        return res.status(404).json({ error: 'User not found' });
      }

      // Found the user, return their localStorage data
      res.status(200).json({ localStorageData: userDoc.localStorage });

    } else {
      return res.status(405).json({ error: 'Method not allowed' });
    }

  } catch (err) {
    console.error('Error handling request:', err);
    res.status(500).json({ error: err instanceof Error ? err.message : 'Internal server error' });
  } finally {
    await client.close();
  }
}

