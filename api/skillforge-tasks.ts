import type { VercelRequest, VercelResponse } from '@vercel/node';
import { ObjectId } from 'mongodb';
import { getDb } from './lib/mongodb';

function toISODate(value: any): string | null {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString();
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const userIdRaw = req.query.userId;
    const planIdRaw = req.query.planId;

    const userId = typeof userIdRaw === 'string' ? userIdRaw : null;
    const planId = typeof planIdRaw === 'string' ? planIdRaw : null;

    if (!userId) return res.status(400).json({ error: 'Missing userId' });
    if (!planId) return res.status(400).json({ error: 'Missing planId' });

    let planObjectId: ObjectId;
    try {
      planObjectId = new ObjectId(planId);
    } catch {
      return res.status(400).json({ error: 'Invalid planId' });
    }

    const db = await getDb();
    const tasks = await db.collection('learning_tasks')
      .find({ userId, plan_id: planObjectId })
      .sort({ day_number: 1, created_at: 1 })
      .toArray();

    const mapped = tasks.map((t: any) => ({
      id: t._id?.toString(),
      plan_id: t.plan_id?.toString(),
      day_number: t.day_number,
      title: t.title,
      description: t.description,
      task_type: t.task_type,
      duration_minutes: t.duration_minutes,
      xp_reward: t.xp_reward,
      attribute_rewards: t.attribute_rewards ?? {},
      is_completed: Boolean(t.is_completed),
      is_unlocked: Boolean(t.is_unlocked),
      completed_at: toISODate(t.completed_at),
    }));

    return res.status(200).json({ tasks: mapped });
  } catch (err) {
    console.error('skillforge-tasks GET error:', err);
    const message = err instanceof Error ? err.message : String(err);
    return res.status(500).json({ error: 'Internal server error', details: message });
  }
}

