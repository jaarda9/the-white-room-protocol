import type { VercelRequest, VercelResponse } from '@vercel/node';
import webpush from 'web-push';
import { getDb, findUserDocAcrossDatabases } from './lib/mongodb.js';

/**
 * Web Push uplink — the System's channel to the Player's device when the app is closed.
 *
 *   GET  ?action=key                                  → { publicKey } (VAPID, safe to expose)
 *   GET  ?action=prefs&subjectId=X                    → schedule prefs for that subject
 *   POST { action: 'prefs', subjectId, prefs }        → save schedule prefs
 *   POST { action: 'subscribe', subjectId, subscription, deviceLabel? }
 *   POST { action: 'unsubscribe', endpoint }
 *   POST { action: 'test', subjectId }                → test transmission to every device of that subject
 *   GET  ?action=tick   (Authorization: Bearer CRON_SECRET)
 *        Called every 5 min by an external cron (cron-job.org — Vercel Hobby crons only run daily).
 *        Sends each subject's due transmissions in their own timezone. `&dry=1&at=<ISO>` previews
 *        without sending or logging.
 *
 * Collections: pushSubscriptions (one doc per device endpoint), pushPrefs (one per subject),
 * pushLog (one per subject/type/local date — makes every transmission at-most-once per day).
 */

const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY || '';
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || '';
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || 'mailto:system@white-room-protocol.app';
const CRON_SECRET = process.env.CRON_SECRET || '';

const vapidReady = Boolean(VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY);
if (vapidReady) {
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
} else {
  console.error('[api/push.ts] VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY are not set — push notifications are disabled.');
}

const SUBS = 'pushSubscriptions';
const PREFS = 'pushPrefs';
const LOG = 'pushLog';
const TEST_COOLDOWN_MS = 10_000;
const lastTestAt = new Map<string, number>();

/** A due transmission still goes out if the cron missed runs, but not hours late. */
const CATCH_UP_MINUTES = 120;
/** Midnight check starts a few minutes after the day boundary. */
const MIDNIGHT_CHECK_MINUTE = 5;
/** Same cap as the client's absent-day counting in storage.ts. */
const MAX_ABSENT_DAYS = 7;
const DETOX_STREAK = 3; // mirrors PENALTY_DETOX_STREAK_THRESHOLD in penalty-system.ts

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

export interface PushPrefs {
  timezone: string;
  wakeTime: string; // HH:MM
  warningTime: string; // HH:MM
  arrival: boolean;
  warning: boolean;
  penalty: boolean;
}

const DEFAULT_PREFS: PushPrefs = {
  timezone: 'UTC',
  wakeTime: '07:00',
  warningTime: '22:00',
  arrival: true,
  warning: true,
  penalty: true,
};

interface Transmission {
  title: string;
  body: string;
  tag: string;
  url?: string;
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

const isHHMM = (v: unknown): v is string => typeof v === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(v);

const isValidTimezone = (tz: unknown): tz is string => {
  if (typeof tz !== 'string' || !tz) return false;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
};

function sanitizePrefs(input: any, base: PushPrefs = DEFAULT_PREFS): PushPrefs {
  return {
    timezone: isValidTimezone(input?.timezone) ? input.timezone : base.timezone,
    wakeTime: isHHMM(input?.wakeTime) ? input.wakeTime : base.wakeTime,
    warningTime: isHHMM(input?.warningTime) ? input.warningTime : base.warningTime,
    arrival: typeof input?.arrival === 'boolean' ? input.arrival : base.arrival,
    warning: typeof input?.warning === 'boolean' ? input.warning : base.warning,
    penalty: typeof input?.penalty === 'boolean' ? input.penalty : base.penalty,
  };
}

// ---------------------------------------------------------------------------
// Time helpers — everything is evaluated in the subject's own timezone.
// ---------------------------------------------------------------------------

/** Local calendar date (YYYY-MM-DD) and minutes-since-midnight for `now` in `tz`. */
function localClock(now: Date, tz: string): { date: string; minutes: number } {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(now);
  const get = (t: string) => parts.find((p) => p.type === t)?.value || '00';
  return { date: `${get('year')}-${get('month')}-${get('day')}`, minutes: Number(get('hour')) * 60 + Number(get('minute')) };
}

const toMinutes = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));

const dayNumber = (ymd: string) => Math.round(Date.UTC(+ymd.slice(0, 4), +ymd.slice(5, 7) - 1, +ymd.slice(8, 10)) / 86_400_000);

const MONTHS: Record<string, string> = {
  Jan: '01', Feb: '02', Mar: '03', Apr: '04', May: '05', Jun: '06',
  Jul: '07', Aug: '08', Sep: '09', Oct: '10', Nov: '11', Dec: '12',
};

/** The client stores the quest day as `Date.toDateString()` ("Tue Nov 03 2026") in its own local time. */
function parseDateString(v: unknown): string | null {
  const m = typeof v === 'string' ? v.match(/^\w{3} (\w{3}) (\d{2}) (\d{4})$/) : null;
  return m && MONTHS[m[1]] ? `${m[3]}-${MONTHS[m[1]]}-${m[2]}` : null;
}

const inWindow = (minutes: number, start: number) => minutes >= start && minutes < start + CATCH_UP_MINUTES;

// ---------------------------------------------------------------------------
// Reading the Player's synced state — same rules as the client (storage.ts applyVitalsRegeneration).
// ---------------------------------------------------------------------------

interface DayStatus {
  /** Local date the synced quest list belongs to, or null if unknown. */
  questDate: string | null;
  incompleteTitles: string[];
  /** A failure landed on yesterday (incomplete quests, or the app was never opened). */
  newFailure: boolean;
  /** Streak the client will hold once it next opens (before the penalty is cleared). */
  projectedStreak: number;
  absentDays: number;
}

function readDayStatus(doc: any, today: string): DayStatus {
  const ls = doc?.localStorage || {};
  let quests: any[] = Array.isArray(ls.quests) ? ls.quests : [];
  if (!quests.length && typeof ls.whiteroom_quests === 'string') {
    try {
      quests = JSON.parse(ls.whiteroom_quests);
    } catch {}
  }
  const profile = ls.userProfile || {};
  const questDate = parseDateString(ls.dailyReset) || (typeof profile.lastRestDate === 'string' ? profile.lastRestDate : null);

  // Mandatory = System-issued, not a chain bonus — identical to the client's missed-day rule.
  const incompleteTitles = quests
    .filter((q) => q && q.origin === 'system' && !q.completed && !q.isChainBonus)
    .map((q) => String(q.title || 'Directive'));

  const streak = Number(profile.missedQuestStreak) || 0;
  if (!questDate || questDate >= today) {
    return { questDate, incompleteTitles, newFailure: false, projectedStreak: streak, absentDays: 0 };
  }

  const absentDays = Math.min(MAX_ABSENT_DAYS, Math.max(0, dayNumber(today) - dayNumber(questDate) - 1));
  const failedQuestDay = incompleteTitles.length > 0;
  const added = (failedQuestDay ? 1 : 0) + absentDays;
  return {
    questDate,
    incompleteTitles,
    newFailure: added > 0,
    projectedStreak: streak + added,
    absentDays,
  };
}

// ---------------------------------------------------------------------------
// Messages
// ---------------------------------------------------------------------------

function penaltyLine(status: DayStatus): string {
  if (status.projectedStreak >= DETOX_STREAK) {
    return `Consecutive failures: ${status.projectedStreak}. DETOX PROTOCOL ENFORCED.`;
  }
  if (status.projectedStreak >= 2) return 'Second consecutive failure. The System is losing patience.';
  return status.absentDays > 0
    ? 'You did not report to the System yesterday. A penalty has been assigned.'
    : "Yesterday's Daily Quest failed. A penalty has been assigned.";
}

function arrivalMessage(status: DayStatus, includePenalty: boolean): Transmission {
  if (includePenalty && status.newFailure) {
    return {
      title: status.projectedStreak >= DETOX_STREAK ? '[PENALTY ZONE] DAILY QUEST HAS ARRIVED' : '[DAILY QUEST HAS ARRIVED] PENALTY ATTACHED',
      body: `${penaltyLine(status)} Today's directives await.`,
      tag: 'wrp-arrival',
    };
  }
  return {
    title: '[DAILY QUEST HAS ARRIVED]',
    body: 'Preparation to become strong. Your directives await, Hunter.',
    tag: 'wrp-arrival',
  };
}

function warningMessage(status: DayStatus, today: string): Transmission | null {
  if (status.questDate !== today) {
    return {
      title: '[WARNING]',
      body: 'You have not reported to the System today. Failure will result in a penalty.',
      tag: 'wrp-warning',
    };
  }
  const n = status.incompleteTitles.length;
  if (n === 0) return null;
  const listed = status.incompleteTitles.slice(0, 3).join(', ') + (n > 3 ? ` +${n - 3} more` : '');
  return {
    title: '[WARNING]',
    body: `${n} directive${n === 1 ? '' : 's'} incomplete: ${listed}. Failure will result in a penalty.`,
    tag: 'wrp-warning',
  };
}

function midnightMessage(status: DayStatus): Transmission {
  return {
    title: status.projectedStreak >= DETOX_STREAK ? '[PENALTY ZONE]' : '[WARNING] REPEATED FAILURE',
    body: `${penaltyLine(status)} Open the System.`,
    tag: 'wrp-penalty',
  };
}

// ---------------------------------------------------------------------------
// Delivery
// ---------------------------------------------------------------------------

async function sendToSubject(col: any, docs: any[], message: Transmission): Promise<{ sent: number; removed: number }> {
  const payload = JSON.stringify({ url: '/', ...message });
  let sent = 0;
  let removed = 0;
  for (const doc of docs) {
    try {
      await webpush.sendNotification(doc.subscription, payload, { TTL: 60 * 60 * 6, urgency: 'high' });
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
  return { sent, removed };
}

function isAuthorizedCron(req: VercelRequest): boolean {
  if (!CRON_SECRET) return false;
  const header = String(req.headers.authorization || '');
  return header === `Bearer ${CRON_SECRET}`;
}

async function runTick(db: any, now: Date, dry: boolean) {
  const subsCol = db.collection(SUBS);
  const prefsCol = db.collection(PREFS);
  const logCol = db.collection(LOG);

  const allSubs: any[] = await subsCol.find({}).toArray();
  const bySubject = new Map<string, any[]>();
  for (const s of allSubs) {
    if (!s?.subjectId) continue;
    const list = bySubject.get(s.subjectId) || [];
    list.push(s);
    bySubject.set(s.subjectId, list);
  }

  const report: any[] = [];
  for (const [subjectId, devices] of bySubject) {
    const prefs = sanitizePrefs(await prefsCol.findOne({ subjectId }));
    const { date: today, minutes } = localClock(now, prefs.timezone);

    const due: Array<'midnight' | 'arrival' | 'warning'> = [];
    if (prefs.penalty && inWindow(minutes, MIDNIGHT_CHECK_MINUTE)) due.push('midnight');
    if (prefs.arrival && inWindow(minutes, toMinutes(prefs.wakeTime))) due.push('arrival');
    if (prefs.warning && inWindow(minutes, toMinutes(prefs.warningTime))) due.push('warning');
    if (!due.length) continue;

    // Only load the (large) save document when something is actually due.
    let status: DayStatus | null = null;
    const getStatus = async () => {
      if (!status) {
        const found = await findUserDocAcrossDatabases(subjectId);
        status = readDayStatus(found?.doc, today);
      }
      return status;
    };

    for (const type of due) {
      if (await logCol.findOne({ subjectId, type, date: today })) continue;

      const s = await getStatus();
      let message: Transmission | null = null;
      if (type === 'midnight') {
        // One slip waits for the wake-up transmission; a repeat breaks through immediately.
        if (s.newFailure && s.projectedStreak >= 2) message = midnightMessage(s);
      } else if (type === 'arrival') {
        message = arrivalMessage(s, prefs.penalty);
      } else {
        message = warningMessage(s, today);
      }

      const entry: any = { subjectId, type, date: today, localMinutes: minutes, message: message?.title || null };
      if (!dry) {
        if (message) Object.assign(entry, await sendToSubject(subsCol, devices, message));
        await logCol.insertOne({ subjectId, type, date: today, sentAt: now.toISOString(), skipped: !message });
      }
      if (dry && message) entry.body = message.body;
      report.push(entry);
    }
  }
  return { subjects: bySubject.size, events: report };
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const action = String((req.method === 'GET' ? req.query.action : req.body?.action) || '');

  if (req.method === 'GET' && action === 'key') {
    if (!vapidReady) return res.status(503).json({ error: 'Push uplink not configured on the server.' });
    return res.status(200).json({ publicKey: VAPID_PUBLIC_KEY });
  }

  if (!vapidReady) return res.status(503).json({ error: 'Push uplink not configured on the server.' });

  const db = await getDb();

  try {
    if (action === 'tick') {
      if (!isAuthorizedCron(req)) return res.status(401).json({ error: 'Unauthorized' });
      const dry = String(req.query.dry || '') === '1';
      const at = dry && req.query.at ? new Date(String(req.query.at)) : new Date();
      if (Number.isNaN(at.getTime())) return res.status(400).json({ error: 'Invalid at' });
      const result = await runTick(db, at, dry);
      return res.status(200).json({ ok: true, dry, at: at.toISOString(), ...result });
    }

    if (req.method === 'GET' && action === 'prefs') {
      const subjectId = norm(req.query.subjectId);
      if (!subjectId) return res.status(400).json({ error: 'subjectId required' });
      const stored = await db.collection(PREFS).findOne({ subjectId });
      return res.status(200).json({ prefs: sanitizePrefs(stored), saved: Boolean(stored) });
    }

    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const col = db.collection(SUBS);

    if (action === 'prefs') {
      const subjectId = norm(req.body?.subjectId);
      if (!subjectId) return res.status(400).json({ error: 'subjectId required' });
      const prefsCol = db.collection(PREFS);
      const current = sanitizePrefs(await prefsCol.findOne({ subjectId }));
      const prefs = sanitizePrefs(req.body?.prefs, current);
      await prefsCol.updateOne(
        { subjectId },
        { $set: { ...prefs, updatedAt: new Date().toISOString() } },
        { upsert: true }
      );
      return res.status(200).json({ ok: true, prefs });
    }

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

      const { sent, removed } = await sendToSubject(col, docs, {
        title: '[SYSTEM] UPLINK ESTABLISHED',
        body: 'The System can now reach you. Transmission test successful.',
        tag: 'wrp-test',
      });
      return res.status(200).json({ ok: sent > 0, sent, removed, devices: docs.length });
    }

    return res.status(400).json({ error: `Unknown action: ${action}` });
  } catch (err: any) {
    console.error('[api/push.ts] error:', err?.message || err);
    return res.status(500).json({ error: 'Push uplink error' });
  }
}
