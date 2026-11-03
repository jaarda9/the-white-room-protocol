import type { VercelRequest, VercelResponse } from '@vercel/node';
import webpush from 'web-push';
import { getDb } from './lib/mongodb';

/**
 * Web Push uplink — the System's channel to the Player's device when the app is closed.
 *
 *   GET  ?action=key                                  → { publicKey } (VAPID, safe to expose)
 *   POST { action: 'subscribe', subjectId, subscription, deviceLabel? }
 *   POST { action: 'unsubscribe', endpoint }
 *   POST { action: 'test', subjectId }                → sends a test transmission to every device of that subject
 *
 * Phase 1 only: no scheduling yet. Subscriptions live in the `pushSubscriptions` collection,
 * one document per device endpoint.
 */

const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY || '';
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || '';
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || 'mailto:system@white-room-protocol.app';

const vapidReady = Boolean(VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY);
if (vapidReady) {
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
} else {
  console.error('[api/push.ts] VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY are not set — push notifications are disabled.');
}

const COLLECTION = 'pushSubscriptions';
const TEST_COOLDOWN_MS = 10_000;
const lastTestAt = new Map<string, number>();

const norm = (id: unknown) =>
  String(id || '')
    .replace(/^SUBJECT-/i, '')
    .trim()
    .toUpperCase();

interface PushSubscriptionJSON {
  endpoint: string;
  expirationTime?: number | null;
  keys: { p256dh: string; auth: string };
}

function isValidSubscription(sub: any): sub is PushSubscriptionJSON {
  return (
    sub &&
    typeof sub.endpoint === 'string' &&
    /^https:\/\//.test(sub.endpoint) &&
    sub.keys &&
    typeof sub.keys.p256dh === 'string' &&
    typeof sub.keys.auth === 'string'
  );
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const action = String((req.method === 'GET' ? req.query.action : req.body?.action) || '');

  if (req.method === 'GET' && action === 'key') {
    if (!vapidReady) return res.status(503).json({ error: 'Push uplink not configured on the server.' });
    return res.status(200).json({ publicKey: VAPID_PUBLIC_KEY });
  }

  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!vapidReady) return res.status(503).json({ error: 'Push uplink not configured on the server.' });

  const db = await getDb();
  const col = db.collection(COLLECTION);

  try {
    if (action === 'subscribe') {
      const subjectId = norm(req.body?.subjectId);
      const subscription = req.body?.subscription;
      if (!subjectId) return res.status(400).json({ error: 'subjectId required' });
      if (!isValidSubscription(subscription)) return res.status(400).json({ error: 'Invalid subscription' });

      const now = new Date().toISOString();
      await col.updateOne(
        { endpoint: subscription.endpoint },
        {
          $set: {
            subjectId,
            subscription,
            deviceLabel: String(req.body?.deviceLabel || '').slice(0, 120),
            updatedAt: now,
          },
          $setOnInsert: { createdAt: now },
        },
        { upsert: true }
      );
      return res.status(200).json({ ok: true });
    }

    if (action === 'unsubscribe') {
      const endpoint = String(req.body?.endpoint || '');
      if (!endpoint) return res.status(400).json({ error: 'endpoint required' });
      await col.deleteMany({ endpoint });
      return res.status(200).json({ ok: true });
    }

    if (action === 'test') {
      const subjectId = norm(req.body?.subjectId);
      if (!subjectId) return res.status(400).json({ error: 'subjectId required' });

      const last = lastTestAt.get(subjectId) || 0;
      if (Date.now() - last < TEST_COOLDOWN_MS) {
        return res.status(429).json({ error: 'Uplink cooling down. Retry in a few seconds.' });
      }
      const docs: any[] = await col.find({ subjectId }).toArray();
      if (docs.length === 0) return res.status(404).json({ error: 'No registered devices for this Subject.' });
      lastTestAt.set(subjectId, Date.now());

      const payload = JSON.stringify({
        title: '[SYSTEM] UPLINK ESTABLISHED',
        body: 'The System can now reach you. Transmission test successful.',
        tag: 'wrp-test',
        url: '/',
      });

      let sent = 0;
      let removed = 0;
      for (const doc of docs) {
        try {
          await webpush.sendNotification(doc.subscription, payload, { TTL: 60 });
          sent++;
        } catch (err: any) {
          // 404/410 = the browser revoked or expired this subscription; it will never work again.
          if (err?.statusCode === 404 || err?.statusCode === 410) {
            await col.deleteMany({ endpoint: doc.endpoint });
            removed++;
          } else {
            console.warn('[api/push.ts] send failed:', err?.statusCode, err?.body || err?.message);
          }
        }
      }
      return res.status(200).json({ ok: sent > 0, sent, removed, devices: docs.length });
    }

    return res.status(400).json({ error: `Unknown action: ${action}` });
  } catch (err: any) {
    console.error('[api/push.ts] error:', err?.message || err);
    return res.status(500).json({ error: 'Push uplink error' });
  }
}
