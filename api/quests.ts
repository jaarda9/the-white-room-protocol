import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getDb } from './lib/mongodb';
import { Quest } from '../src/lib/types';

interface QuestData {
  quests: Quest[];
  lastReset: string;
}

export default async function handler(
  request: VercelRequest,
  response: VercelResponse
) {
  // Set CORS headers
  response.setHeader('Access-Control-Allow-Origin', '*');
  response.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  response.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle preflight requests
  if (request.method === 'OPTIONS') {
    return response.status(200).end();
  }

  if (request.method === 'GET') {
    try {
      const db = await getDb();
      const collection = db.collection<QuestData>('quests');
      
      // Get the latest quest data
      const questData = await collection.findOne({}, { sort: { lastReset: -1 } });
      
      if (!questData) {
        return response.status(200).json({ quests: [], lastReset: '' });
      }
      
      return response.status(200).json(questData);
    } catch (error) {
      console.error('Error fetching quests:', error);
      return response.status(500).json({ error: 'Failed to fetch quests' });
    }
  }
  
  if (request.method === 'POST') {
    try {
      const data: QuestData = request.body;
      const db = await getDb();
      const collection = db.collection<QuestData>('quests');
      
      // Upsert quest data
      await collection.updateOne(
        { lastReset: data.lastReset },
        { $set: data },
        { upsert: true }
      );
      
      return response.status(200).json(data);
    } catch (error) {
      console.error('Error saving quests:', error);
      return response.status(500).json({ error: 'Failed to save quests' });
    }
  }
  
  return response.status(405).json({ error: 'Method not allowed' });
}

