import type { VercelRequest, VercelResponse } from '@vercel/node';
import { MongoClient, ObjectId } from 'mongodb';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const MONGODB_URI =
    process.env.MONGODB_URI ||
    'mongodb+srv://Vercel-Admin-atlas-amber-house:36UkjMa6SGPTMNoa@atlas-amber-house.hbybfiz.mongodb.net/?retryWrites=true&w=majority';

  const client = new MongoClient(MONGODB_URI);

  try {
    const { userId, taskId } = req.body || {};

    if (!userId || typeof userId !== 'string') return res.status(400).json({ error: 'Missing/invalid userId' });
    if (!taskId || typeof taskId !== 'string') return res.status(400).json({ error: 'Missing/invalid taskId' });

    let taskObjectId: ObjectId;
    try {
      taskObjectId = new ObjectId(taskId);
    } catch {
      return res.status(400).json({ error: 'Invalid taskId' });
    }

    await client.connect();
    const db = client.db('white-room-protocol');
    const tasksCollection = db.collection('learning_tasks');
    const plansCollection = db.collection('learning_plans');

    const task = await tasksCollection.findOne({ _id: taskObjectId, userId });
    if (!task) return res.status(404).json({ error: 'Task not found' });

    if (task.is_completed) return res.status(400).json({ error: 'Task already completed' });

    const now = new Date();

    // Mark task complete
    await tasksCollection.updateOne(
      { _id: taskObjectId, userId },
      { $set: { is_completed: true, completed_at: now } }
    );

    // Fetch plan + updated day tasks
    const plan = await plansCollection.findOne({ _id: task.plan_id, userId });
    if (!plan) return res.status(404).json({ error: 'Plan not found' });

    const dayTasks = await tasksCollection
      .find({ userId, plan_id: task.plan_id, day_number: task.day_number })
      .toArray();

    const allDayComplete = dayTasks.every((t: any) => Boolean(t.is_completed));
    const nextDay = Number(task.day_number) + 1;

    let planComplete = false;
    let bonusXp = 0;

    // Unlock next day tasks only after the whole day completes
    if (allDayComplete) {
      if (nextDay <= Number(plan.total_days)) {
        await tasksCollection.updateMany(
          { userId, plan_id: task.plan_id, day_number: nextDay },
          { $set: { is_unlocked: true } }
        );
      } else {
        planComplete = true;
        bonusXp = Number(plan.duration_weeks || 0) * 50;

        await plansCollection.updateOne(
          { _id: task.plan_id, userId },
          {
            $set: {
              status: 'completed',
              bonus_xp_awarded: true,
              current_day: nextDay,
              updated_at: now,
            },
            $inc: {
              total_xp_earned: Number(task.xp_reward || 0) + bonusXp,
            },
          }
        );

        const attributeRewards = task.attribute_rewards ?? {};
        return res.status(200).json({
          success: true,
          dayComplete: true,
          planComplete: true,
          xpEarned: Number(task.xp_reward || 0),
          attributeRewards,
          bonusXp,
        });
      }
    }

    // Update plan progress + XP for every task completion
    if (allDayComplete) {
      await plansCollection.updateOne(
        { _id: task.plan_id, userId },
        {
          $set: { current_day: nextDay, updated_at: now },
          $inc: { total_xp_earned: Number(task.xp_reward || 0) },
        }
      );
    } else {
      await plansCollection.updateOne(
        { _id: task.plan_id, userId },
        {
          $set: { updated_at: now },
          $inc: { total_xp_earned: Number(task.xp_reward || 0) },
        }
      );
    }

    const attributeRewards = task.attribute_rewards ?? {};
    return res.status(200).json({
      success: true,
      dayComplete: allDayComplete,
      planComplete,
      xpEarned: Number(task.xp_reward || 0),
      attributeRewards,
    });
  } catch (err) {
    console.error('skillforge-complete-learning-task POST error:', err);
    const message = err instanceof Error ? err.message : String(err);
    const stack = err instanceof Error ? err.stack : undefined;
    return res.status(500).json({ error: 'Internal server error', details: message, stack });
  } finally {
    await client.close().catch(() => {});
  }
}

