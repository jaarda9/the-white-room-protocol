import type { VercelRequest, VercelResponse } from '@vercel/node';
import { ObjectId } from 'mongodb';
import { getDb } from './lib/mongodb';

type LovablePlanData = {
  planSummary: string;
  phases: Array<{ name: string; days: string; focus: string }>;
  tasks: Array<{
    dayNumber: number;
    title: string;
    description: string;
    taskType: string;
    durationMinutes: number;
    xpReward: number;
    attributeRewards: Record<string, number>;
  }>;
};

function toISODate(value: any): string {
  if (!value) return new Date().toISOString();
  if (value instanceof Date) return value.toISOString();
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method === 'GET') {
    try {
      const userIdRaw = req.query.userId;
      const userId = typeof userIdRaw === 'string' ? userIdRaw : null;
      if (!userId) return res.status(400).json({ error: 'Missing userId' });

      const db = await getDb();
      const collection = db.collection('learning_plans');

      const plans = await collection
        .find({ userId })
        .sort({ created_at: -1 })
        .limit(200)
        .toArray();

      const mapped = plans.map((p: any) => ({
        id: p._id?.toString(),
        subject: p.subject,
        target_level: p.target_level,
        daily_time_minutes: p.daily_time_minutes,
        duration_weeks: p.duration_weeks,
        motivation: p.motivation ?? null,
        status: p.status ?? 'active',
        ai_plan: p.ai_plan ?? null,
        total_xp_earned: p.total_xp_earned ?? 0,
        current_day: p.current_day ?? 1,
        total_days: p.total_days ?? (p.duration_weeks ? p.duration_weeks * 7 : 7),
        created_at: toISODate(p.created_at),
      }));

      return res.status(200).json({ plans: mapped });
    } catch (err) {
      console.error('skillforge-plans GET error:', err);
      const message = err instanceof Error ? err.message : String(err);
      const stack = err instanceof Error ? err.stack : undefined;
      return res.status(500).json({ error: 'Internal server error', details: message, stack });
    }
  }

  if (req.method === 'POST') {
    try {
      const {
        userId,
        subject,
        targetLevel,
        dailyTimeMinutes,
        durationWeeks,
        motivation,
        planData,
      } = req.body || {};

      if (!userId || typeof userId !== 'string') return res.status(400).json({ error: 'Missing/invalid userId' });
      if (!subject || typeof subject !== 'string') return res.status(400).json({ error: 'Missing/invalid subject' });
      if (!targetLevel || typeof targetLevel !== 'string') return res.status(400).json({ error: 'Missing/invalid targetLevel' });
      if (typeof dailyTimeMinutes !== 'number' || !Number.isFinite(dailyTimeMinutes)) {
        return res.status(400).json({ error: 'Missing/invalid dailyTimeMinutes' });
      }
      if (typeof durationWeeks !== 'number' || !Number.isFinite(durationWeeks)) {
        return res.status(400).json({ error: 'Missing/invalid durationWeeks' });
      }
      if (!planData || typeof planData !== 'object') return res.status(400).json({ error: 'Missing planData' });

      const parsedPlanData = planData as LovablePlanData;
      if (!Array.isArray(parsedPlanData.tasks) || parsedPlanData.tasks.length === 0) {
        return res.status(400).json({ error: 'planData.tasks must be a non-empty array' });
      }

      const totalDays = Math.max(1, Math.round(durationWeeks * 7));
      const now = new Date();

      const db = await getDb();
      const plansCollection = db.collection('learning_plans');
      const tasksCollection = db.collection('learning_tasks');

      const planInsert = await plansCollection.insertOne({
        userId,
        subject,
        target_level: targetLevel,
        daily_time_minutes: Math.round(dailyTimeMinutes),
        duration_weeks: Math.round(durationWeeks),
        motivation: motivation ?? null,
        ai_plan: parsedPlanData,
        total_days: totalDays,
        current_day: 1,
        status: 'active',
        total_xp_earned: 0,
        bonus_xp_awarded: false,
        created_at: now,
        updated_at: now,
      });

      const planId = planInsert.insertedId;

      const tasks = parsedPlanData.tasks.map((t: any) => {
        const dayNumber = Number(t?.dayNumber);
        const title = String(t?.title ?? '').trim();
        const description = String(t?.description ?? '').trim();
        const taskType = String(t?.taskType ?? 'study');
        const durationMinutes = Number(t?.durationMinutes);
        const xpReward = Number(t?.xpReward);
        const attributeRewards = t?.attributeRewards && typeof t.attributeRewards === 'object' ? t.attributeRewards : {};

        return {
          userId,
          plan_id: planId,
          day_number: dayNumber,
          title,
          description,
          task_type: taskType,
          duration_minutes: Number.isFinite(durationMinutes) ? Math.round(durationMinutes) : 15,
          xp_reward: Number.isFinite(xpReward) ? Math.round(xpReward) : 15,
          attribute_rewards: attributeRewards,
          is_completed: false,
          is_unlocked: dayNumber === 1,
          completed_at: null,
          created_at: now,
        };
      });

      if (tasks.some(t => !t.title || !t.description || !Number.isFinite(t.day_number))) {
        return res.status(400).json({ error: 'AI returned invalid task data' });
      }

      await tasksCollection.insertMany(tasks);

      const created = {
        id: planId.toString(),
        subject,
        target_level: targetLevel,
        daily_time_minutes: Math.round(dailyTimeMinutes),
        duration_weeks: Math.round(durationWeeks),
        motivation: motivation ?? null,
        status: 'active',
        ai_plan: parsedPlanData,
        total_xp_earned: 0,
        current_day: 1,
        total_days: totalDays,
        created_at: now.toISOString(),
      } as const;

      return res.status(200).json({ plan: created });
    } catch (err) {
      console.error('skillforge-plans POST error:', err);
      const message = err instanceof Error ? err.message : String(err);
      const stack = err instanceof Error ? err.stack : undefined;
      return res.status(500).json({ error: 'Internal server error', details: message, stack });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}

