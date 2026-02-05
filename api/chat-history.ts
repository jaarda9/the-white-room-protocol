import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getDb } from './lib/mongodb';

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

  try {
    const db = await getDb();
    const collection = db.collection('chatHistory');

    // GET - Retrieve chat history for a user
    if (req.method === 'GET') {
      const { userId, limit = '50' } = req.query;

      if (!userId || typeof userId !== 'string') {
        return res.status(400).json({ error: 'Missing userId parameter' });
      }

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
    }

    // POST - Save a new message to chat history
    if (req.method === 'POST') {
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
    }

    // DELETE - Clear chat history for a user
    if (req.method === 'DELETE') {
      const { userId } = req.body || req.query;

      if (!userId) {
        return res.status(400).json({ error: 'Missing userId parameter' });
      }

      const result = await collection.deleteMany({ userId: userId as string });

      return res.status(200).json({
        success: true,
        deletedCount: result.deletedCount
      });
    }

    return res.status(405).json({ error: 'Method not allowed' });

  } catch (err) {
    console.error('Chat history API error:', err);
    return res.status(500).json({ 
      error: err instanceof Error ? err.message : 'Unknown error' 
    });
  }
}
