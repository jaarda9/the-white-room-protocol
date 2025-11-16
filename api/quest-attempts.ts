import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getDb } from './lib/mongodb';
import { QuestAttempt } from '../src/lib/types';

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
      const collection = db.collection<QuestAttempt>('questAttempts');
      
      // Get all quest attempts, sorted by timestamp
      const attempts = await collection.find({}).sort({ timestamp: -1 }).toArray();
      
      return response.status(200).json(attempts);
    } catch (error) {
      console.error('Error fetching quest attempts:', error);
      return response.status(500).json({ error: 'Failed to fetch quest attempts' });
    }
  }
  
  if (request.method === 'POST') {
    try {
      const attempt: QuestAttempt = request.body;
      const db = await getDb();
      const collection = db.collection<QuestAttempt>('questAttempts');
      
      // Insert the quest attempt
      await collection.insertOne(attempt);
      
      return response.status(200).json(attempt);
    } catch (error) {
      console.error('Error saving quest attempt:', error);
      return response.status(500).json({ error: 'Failed to save quest attempt' });
    }
  }
  
  return response.status(405).json({ error: 'Method not allowed' });
}

