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
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // GET - Retrieve chat history for a user
  if (req.method === 'GET') {
    const client = new MongoClient(MONGODB_URI);
    
    try {
      const { userId, limit = '50' } = req.query;

      if (!userId || typeof userId !== 'string') {
        return res.status(400).json({ error: 'Missing userId parameter' });
      }

      try {
        await client.connect();
        const db = client.db('white-room-protocol');
        const collection = db.collection('chatHistory');

        const messages = await collection
          .find({ userId })
          .sort({ timestamp: -1 })
          .limit(parseInt(limit as string, 10))
          .toArray();

        // Return in chronological order
        return res.status(200).json({
          success: true,
          messages: messages.reverse()
        });
      } catch (dbError) {
        console.error('[Chat-History] Database error in GET:', dbError);
        // Return empty array if database error (graceful degradation)
        return res.status(200).json({
          success: true,
          messages: []
        });
      } finally {
        await client.close();
      }
    } catch (err) {
      console.error('[Chat-History] Unexpected error in GET:', err);
      // Return empty array on any unexpected error (graceful degradation)
      return res.status(200).json({
        success: true,
        messages: []
      });
    }
  }

  // POST - Save a new message to chat history
  if (req.method === 'POST') {
    const client = new MongoClient(MONGODB_URI);
    
    try {
      const { userId, message, role } = req.body;

      if (!userId || !message || !role) {
        return res.status(400).json({ 
          error: 'Missing required fields: userId, message, role' 
        });
      }

      if (!['user', 'assistant'].includes(role)) {
        return res.status(400).json({ 
          error: 'Role must be "user" or "assistant"' 
        });
      }

      try {
        await client.connect();
        const db = client.db('white-room-protocol');
        const collection = db.collection('chatHistory');

        const chatMessage = {
          userId,
          role,
          content: message,
          timestamp: new Date()
        };

        const result = await collection.insertOne(chatMessage);

        return res.status(201).json({
          success: true,
          messageId: result.insertedId,
          message: chatMessage
        });
      } catch (dbError) {
        console.error('[Chat-History] Database error in POST:', dbError);
        return res.status(500).json({ 
          error: 'Failed to save message to database',
          details: dbError instanceof Error ? dbError.message : 'Unknown error'
        });
      } finally {
        await client.close();
      }
    } catch (err) {
      console.error('[Chat-History] Unexpected error in POST:', err);
      return res.status(500).json({ 
        error: 'Internal server error',
        message: err instanceof Error ? err.message : 'Unknown error'
      });
    }
  }

  // DELETE - Clear chat history for a user
  if (req.method === 'DELETE') {
    const client = new MongoClient(MONGODB_URI);
    
    try {
      const { userId } = req.body || req.query;

      if (!userId) {
        return res.status(400).json({ error: 'Missing userId parameter' });
      }

      try {
        await client.connect();
        const db = client.db('white-room-protocol');
        const collection = db.collection('chatHistory');

        const result = await collection.deleteMany({ userId: userId as string });

        return res.status(200).json({
          success: true,
          deletedCount: result.deletedCount
        });
      } catch (dbError) {
        console.error('[Chat-History] Database error in DELETE:', dbError);
        return res.status(500).json({ 
          error: 'Failed to clear chat history',
          details: dbError instanceof Error ? dbError.message : 'Unknown error'
        });
      } finally {
        await client.close();
      }
    } catch (err) {
      console.error('[Chat-History] Unexpected error in DELETE:', err);
      return res.status(500).json({ 
        error: 'Internal server error',
        message: err instanceof Error ? err.message : 'Unknown error'
      });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
