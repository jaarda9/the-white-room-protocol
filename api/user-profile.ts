import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getDb } from './lib/mongodb';
import { UserProfile } from '../src/lib/types';

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
      const collection = db.collection<UserProfile>('userProfiles');
      
      // Get the first (and should be only) user profile
      // In a multi-user system, you'd identify by user ID/session
      const profile = await collection.findOne({}, { sort: { createdAt: -1 } });
      
      if (!profile) {
        return response.status(404).json({ error: 'Profile not found' });
      }
      
      return response.status(200).json(profile);
    } catch (error) {
      console.error('Error fetching user profile:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return response.status(500).json({ 
        error: 'Failed to fetch user profile',
        details: process.env.NODE_ENV === 'development' ? errorMessage : undefined
      });
    }
  }
  
  if (request.method === 'POST') {
    try {
      const profile: UserProfile = request.body;
      const db = await getDb();
      const collection = db.collection<UserProfile>('userProfiles');
      
      // Upsert the profile (update if exists, insert if not)
      await collection.updateOne(
        { id: profile.id },
        { $set: profile },
        { upsert: true }
      );
      
      return response.status(200).json(profile);
    } catch (error) {
      console.error('Error saving user profile:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return response.status(500).json({ 
        error: 'Failed to save user profile',
        details: process.env.NODE_ENV === 'development' ? errorMessage : undefined
      });
    }
  }
  
  return response.status(405).json({ error: 'Method not allowed' });
}

