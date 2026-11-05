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
 *   GET  ?action=emergency&subjectId=X                → the subject's live Emergency Quest, if any
 *   POST { action: 'emergency-respond', subjectId, id, response: 'accept'|'decline'|'complete' }
 *   GET  ?action=tick   (Authorization: Bearer CRON_SECRET)
 *        Called every 5 min by an external cron (cron-job.org — Vercel Hobby crons only run daily).
 *        Sends each subject's due transmissions in their own timezone. `&dry=1` previews
 *        without sending or logging; `&at=<ISO>` simulates the clock.
 *
 * Collections: pushSubscriptions (one doc per device endpoint), pushPrefs (one per subject),
 * pushLog (one per subject/type/local date — makes every transmission at-most-once per day),
 * emergencyQuests (one per subject/day it fires; the server owns its clock).
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
  emergency: boolean;
  gates: boolean;
}

const DEFAULT_PREFS: PushPrefs = {
  timezone: 'UTC',
  wakeTime: '07:00',
  warningTime: '22:00',
  arrival: true,
  warning: true,
  penalty: true,
  emergency: true,
  gates: true,
};

const TOGGLES = ['arrival', 'warning', 'penalty', 'emergency', 'gates'] as const;

interface Transmission {
  title: string;
  body: string;
  tag: string;
  url?: string;
  /** Seconds the push service keeps it for an offline device; stale beyond that (default 6h). */
  ttl?: number;
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
  const prefs: PushPrefs = {
    ...base,
    timezone: isValidTimezone(input?.timezone) ? input.timezone : base.timezone,
    wakeTime: isHHMM(input?.wakeTime) ? input.wakeTime : base.wakeTime,
    warningTime: isHHMM(input?.warningTime) ? input.warningTime : base.warningTime,
  };
  for (const key of TOGGLES) {
    if (typeof input?.[key] === 'boolean') prefs[key] = input[key];
  }
  return prefs;
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

const dayKeyFromNumber = (n: number) => new Date(n * 86_400_000).toISOString().slice(0, 10);

/** Synced generation keys (wrp_*) are stored in the save blob as raw JSON strings. */
function readSyncedJson(ls: any, key: string): any {
  const raw = ls?.[key];
  if (typeof raw !== 'string') return raw ?? null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/** Declared absences (src/lib/absences.ts) → predicate over local YYYY-MM-DD keys. */
function absencePredicate(ls: any): (dateKey: string) => boolean {
  const list = readSyncedJson(ls, 'wrp_declared_absences');
  const ranges: Array<{ from: string; to: string }> = Array.isArray(list)
    ? list.filter((a: any) => typeof a?.from === 'string' && typeof a?.to === 'string')
    : [];
  return (dateKey) => ranges.some((a) => a.from <= dateKey && dateKey <= a.to);
}

/** Deterministic 0..1 from a string — schedules unannounced events without storing a plan. */
function seededRandom(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  h ^= h >>> 13;
  h = Math.imul(h, 0x5bd1e995);
  h ^= h >>> 15;
  return (h >>> 0) / 4294967296;
}

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
  /** Today is covered by an absence declared in advance — the System stays silent. */
  todayDeclared: boolean;
}

export function readDayStatus(doc: any, today: string): DayStatus {
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

  const isDeclared = absencePredicate(ls);
  const todayDeclared = isDeclared(today);
  const streak = Number(profile.missedQuestStreak) || 0;
  if (!questDate || questDate >= today) {
    return { questDate, incompleteTitles, newFailure: false, projectedStreak: streak, absentDays: 0, todayDeclared };
  }

  // Unopened days count, except those covered by a declared absence (same as storage.ts).
  const gap = Math.min(31, Math.max(0, dayNumber(today) - dayNumber(questDate) - 1));
  let undeclared = 0;
  for (let i = 1; i <= gap; i++) {
    if (!isDeclared(dayKeyFromNumber(dayNumber(questDate) + i))) undeclared++;
  }
  const absentDays = Math.min(MAX_ABSENT_DAYS, undeclared);
  const failedQuestDay = incompleteTitles.length > 0 && !isDeclared(questDate);
  const added = (failedQuestDay ? 1 : 0) + absentDays;
  return {
    questDate,
    incompleteTitles,
    newFailure: added > 0,
    projectedStreak: streak + added,
    absentDays,
    todayDeclared,
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

/** Rotates by the Hunter's local date — same voice as src/lib/quest-content.ts. */
const ARRIVAL_LINES = [
  'Preparation to become strong. Your directives await, Hunter.',
  'Status: Awake. Excuses: Not accepted.',
  'The System has prepared today’s trial. Begin.',
  'A new day. The Gate does not care how you feel.',
  'Your directives have been issued. The clock is already running.',
  'Yesterday is recorded. Today is still unwritten.',
  'The weak wait for motivation. Hunters begin.',
];

function arrivalMessage(status: DayStatus, includePenalty: boolean, today: string): Transmission {
  if (includePenalty && status.newFailure) {
    return {
      title: status.projectedStreak >= DETOX_STREAK ? '[PENALTY ZONE] DAILY QUEST HAS ARRIVED' : '[DAILY QUEST HAS ARRIVED] PENALTY ATTACHED',
      body: `${penaltyLine(status)} Today's directives await.`,
      tag: 'wrp-arrival',
      ttl: 3 * 3600,
    };
  }
  return {
    title: '[DAILY QUEST HAS ARRIVED]',
    body: ARRIVAL_LINES[Math.floor(seededRandom(`arrival|${today}`) * ARRIVAL_LINES.length)],
    tag: 'wrp-arrival',
      ttl: 3 * 3600,
  };
}

function warningMessage(status: DayStatus, today: string): Transmission | null {
  if (status.questDate !== today) {
    return {
      title: '[WARNING]',
      body: 'You have not reported to the System today. Failure will result in a penalty.',
      tag: 'wrp-warning',
      ttl: 2 * 3600,
    };
  }
  const n = status.incompleteTitles.length;
  if (n === 0) return null;
  const listed = status.incompleteTitles.slice(0, 3).join(', ') + (n > 3 ? ` +${n - 3} more` : '');
  return {
    title: '[WARNING]',
    body: `${n} directive${n === 1 ? '' : 's'} incomplete: ${listed}. Failure will result in a penalty.`,
    tag: 'wrp-warning',
      ttl: 2 * 3600,
  };
}

function midnightMessage(status: DayStatus): Transmission {
  return {
    title: status.projectedStreak >= DETOX_STREAK ? '[PENALTY ZONE]' : '[WARNING] REPEATED FAILURE',
    body: `${penaltyLine(status)} Open the System.`,
    tag: 'wrp-penalty',
      ttl: 8 * 3600, // must survive a phone that's off overnight
  };
}

// ---------------------------------------------------------------------------
// Gate deadline alerts
// ---------------------------------------------------------------------------

export function gateAlertMessage(ls: any, now: Date, tz: string, today: string): Transmission | null {
  const gates = readSyncedJson(ls, 'wrp_gates');
  if (!Array.isArray(gates)) return null;
  const tomorrow = dayKeyFromNumber(dayNumber(today) + 1);
  const closingToday: string[] = [];
  const closingTomorrow: string[] = [];
  for (const g of gates) {
    if (g?.status !== 'active' || !g?.targetDate) continue;
    const when = new Date(g.targetDate);
    if (Number.isNaN(when.getTime()) || when.getTime() < now.getTime()) continue;
    const day = localClock(when, tz).date;
    if (day === today) closingToday.push(String(g.title || 'Unnamed Gate'));
    else if (day === tomorrow) closingTomorrow.push(String(g.title || 'Unnamed Gate'));
  }
  if (!closingToday.length && !closingTomorrow.length) return null;

  const parts: string[] = [];
  if (closingToday.length) parts.push(`"${closingToday.join('", "')}" closes TODAY.`);
  if (closingTomorrow.length) parts.push(`"${closingTomorrow.join('", "')}" closes in 24 hours.`);
  return {
    title: closingToday.length ? '[GATE ALERT] DUNGEON BREAK IMMINENT' : '[GATE ALERT]',
    body: `${parts.join(' ')} Clear the boss condition before the Gate breaks.`,
    tag: 'wrp-gates',
      ttl: 12 * 3600,
  };
}

// ---------------------------------------------------------------------------
// Emergency Quests — unannounced, short, time-limited. Declining costs nothing (never a cage).
// ---------------------------------------------------------------------------

const EMERGENCY = 'emergencyQuests';
/** Share of days that get an Emergency Quest at all — unannounced means not every day. */
const EMERGENCY_DAILY_CHANCE = 0.6;
/** Late cron runs may still issue it, but an "emergency" hours late makes no sense. */
const EMERGENCY_CATCH_UP_MINUTES = 20;
const EMERGENCY_ACCEPT_WINDOW_MS = 30 * 60_000;
const EMERGENCY_COMPLETE_GRACE_MS = 60_000;

const RANKS = ['E', 'D', 'C', 'B', 'A', 'S'] as const;
const rankIndexForLevel = (level: number) => Math.min(5, Math.max(0, Math.floor((Math.max(1, level) - 1) / 10)));

interface EmergencyTemplate {
  category: 'physical' | 'mental';
  build: (scale: number) => { title: string; description: string; timeLimitMinutes: number };
}

const EMERGENCY_TEMPLATES: EmergencyTemplate[] = [
  { category: 'physical', build: (s) => ({ title: `${Math.round(30 * s)} Push-ups`, description: `Complete ${Math.round(30 * s)} push-ups. Sets may be broken, the count may not.`, timeLimitMinutes: 10 }) },
  { category: 'physical', build: (s) => ({ title: `${Math.round(50 * s)} Bodyweight Squats`, description: `Complete ${Math.round(50 * s)} full-depth squats.`, timeLimitMinutes: 10 }) },
  { category: 'physical', build: (s) => ({ title: `Plank Hold: ${Math.round(90 * s)}s total`, description: `Accumulate ${Math.round(90 * s)} seconds of plank. Rest between holds is allowed.`, timeLimitMinutes: 10 }) },
  { category: 'physical', build: (s) => ({ title: `${Math.round(20 * s)} Burpees`, description: `Complete ${Math.round(20 * s)} burpees.`, timeLimitMinutes: 12 }) },
  { category: 'physical', build: (s) => ({ title: `Wall Sit: ${Math.round(120 * s)}s total`, description: `Accumulate ${Math.round(120 * s)} seconds of wall sit.`, timeLimitMinutes: 10 }) },
  { category: 'mental', build: (s) => ({ title: `${Math.round(15 * s)} Min Deep Reading`, description: `Read for ${Math.round(15 * s)} uninterrupted minutes. Phone face-down.`, timeLimitMinutes: Math.round(15 * s) + 5 }) },
  { category: 'mental', build: () => ({ title: 'Recall Drill', description: 'Write down 10 things you learned this week from memory alone. No notes, no screens.', timeLimitMinutes: 12 }) },
  { category: 'mental', build: (s) => ({ title: `${Math.round(10 * s)} Min Silent Meditation`, description: `Sit in silence for ${Math.round(10 * s)} minutes. Breath only.`, timeLimitMinutes: Math.round(10 * s) + 5 }) },
  { category: 'mental', build: () => ({ title: 'Field Report', description: 'Write a 150-word honest report: what you avoided today, and why.', timeLimitMinutes: 15 }) },
  { category: 'mental', build: () => ({ title: 'Sanctum Reset', description: 'Clear and organize your desk or room completely.', timeLimitMinutes: 15 }) },
];

/** Today's unannounced Emergency Quest time for this subject (local minutes), or null for none today. */
function emergencyMinuteFor(subjectId: string, today: string, prefs: PushPrefs): number | null {
  if (seededRandom(`${subjectId}|${today}|chance`) >= EMERGENCY_DAILY_CHANCE) return null;
  // Not right after waking, not near the evening warning; never before 10:00 or after 20:00.
  const start = Math.max(toMinutes(prefs.wakeTime) + 120, 10 * 60);
  const end = Math.min(toMinutes(prefs.warningTime) - 60, 20 * 60);
  if (end - start < 60) return null;
  return start + Math.floor(seededRandom(`${subjectId}|${today}|time`) * (end - start));
}

function buildEmergencyQuest(subjectId: string, today: string, now: Date, ls: any) {
  const profile = ls?.userProfile || {};
  const level = Number(profile.level) || 1;
  const rankIdx = rankIndexForLevel(level);
  const stm = Number(profile.stm?.current);
  const lowStamina = Number.isFinite(stm) && stm < 30;

  const pool = EMERGENCY_TEMPLATES.filter((t) => !lowStamina || t.category === 'mental');
  const template = pool[Math.floor(seededRandom(`${subjectId}|${today}|pick`) * pool.length)];
  const scale = 1 + rankIdx * 0.25; // E 1.0× … S 2.25×
  const built = template.build(scale);
  const issuedAt = now.getTime();
  return {
    id: `emq-${subjectId}-${today}`,
    subjectId,
    date: today,
    category: template.category,
    rank: RANKS[rankIdx],
    ...built,
    rewardXp: 30 + rankIdx * 15,
    issuedAt: new Date(issuedAt).toISOString(),
    acceptBy: new Date(issuedAt + EMERGENCY_ACCEPT_WINDOW_MS).toISOString(),
    status: 'pending' as const,
  };
}

const formatLimit = (minutes: number) => `${String(minutes).padStart(2, '0')}:00`;

/** Settles time-outs lazily (no background job): an unanswered quest expires, an overdue one fails. */
async function settleEmergency(db: any, quest: any, nowMs: number) {
  let next: string | null = null;
  if (quest.status === 'pending' && nowMs > Date.parse(quest.acceptBy)) next = 'expired';
  if (quest.status === 'accepted' && nowMs > Date.parse(quest.deadline) + EMERGENCY_COMPLETE_GRACE_MS) next = 'failed';
  if (!next) return quest;
  await db.collection(EMERGENCY).updateOne({ id: quest.id, status: quest.status }, { $set: { status: next } });
  return { ...quest, status: next };
}

/** The subject's live Emergency Quest (pending or accepted), if any. */
async function currentEmergency(db: any, subjectId: string) {
  const list: any[] = await db.collection(EMERGENCY).find({ subjectId }).sort({ issuedAt: -1 }).limit(1).toArray();
  if (!list.length) return null;
  const { _id, ...quest } = await settleEmergency(db, list[0], Date.now());
  return quest.status === 'pending' || quest.status === 'accepted' ? quest : null;
}

/**
 * accept → starts the clock server-side (deadline = now + limit); decline → no penalty;
 * complete → only within the deadline. Every transition is a conditional update on the current
 * status, so two devices can't both claim the reward.
 */
async function respondToEmergency(db: any, subjectId: string, id: string, response: string) {
  const col = db.collection(EMERGENCY);
  const found = await col.findOne({ id, subjectId });
  if (!found) return { ok: false, error: 'Emergency Quest not found.' };
  const nowMs = Date.now();
  const quest = await settleEmergency(db, found, nowMs);

  const transition = async (from: string, set: Record<string, unknown>) => {
    const r = await col.updateOne({ id, status: from }, { $set: set });
    return (r?.modifiedCount ?? 0) === 1;
  };

  if (response === 'accept' && quest.status === 'pending') {
    const deadline = new Date(nowMs + quest.timeLimitMinutes * 60_000).toISOString();
    if (await transition('pending', { status: 'accepted', acceptedAt: new Date(nowMs).toISOString(), deadline })) {
      return { ok: true, status: 'accepted', deadline };
    }
  } else if (response === 'decline' && (quest.status === 'pending' || quest.status === 'accepted')) {
    if (await transition(quest.status, { status: 'declined', declinedAt: new Date(nowMs).toISOString() })) {
      return { ok: true, status: 'declined' };
    }
  } else if (response === 'complete' && quest.status === 'accepted') {
    if (await transition('accepted', { status: 'completed', completedAt: new Date(nowMs).toISOString() })) {
      return { ok: true, status: 'completed', rewardXp: quest.rewardXp, category: quest.category };
    }
  }
  return { ok: false, status: quest.status, error: `Quest is ${quest.status}.` };
}

// ---------------------------------------------------------------------------
// Delivery
// ---------------------------------------------------------------------------

async function sendToSubject(col: any, docs: any[], message: Transmission): Promise<{ sent: number; removed: number }> {
  const { ttl = 60 * 60 * 6, ...visible } = message;
  const payload = JSON.stringify({ url: '/', ...visible });
  let sent = 0;
  let removed = 0;
  for (const doc of docs) {
    try {
      await webpush.sendNotification(doc.subscription, payload, { TTL: ttl, urgency: 'high' });
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

/** pushLog / emergencyQuests records are only needed for dedupe and recent history. */
const RECORD_RETENTION_MS = 30 * 86_400_000;
let retentionIndexesReady = false;

/** MongoDB TTL indexes delete old records on their own; the in-memory dev store has no indexes. */
async function ensureRetentionIndexes(db: any) {
  if (retentionIndexesReady) return;
  retentionIndexesReady = true;
  for (const name of [LOG, EMERGENCY]) {
    const col = db.collection(name);
    if (typeof col.createIndex !== 'function') continue;
    try {
      await col.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
    } catch (err: any) {
      console.warn(`[api/push.ts] TTL index on ${name} failed:`, err?.message || err);
    }
  }
}

type TickEvent = 'midnight' | 'arrival' | 'gates' | 'emergency' | 'warning';

async function runTick(db: any, now: Date, dry: boolean) {
  const subsCol = db.collection(SUBS);
  const prefsCol = db.collection(PREFS);
  const logCol = db.collection(LOG);

  await ensureRetentionIndexes(db);
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

    const wake = toMinutes(prefs.wakeTime);
    const emergencyAt = prefs.emergency ? emergencyMinuteFor(subjectId, today, prefs) : null;

    const due: TickEvent[] = [];
    if (prefs.penalty && inWindow(minutes, MIDNIGHT_CHECK_MINUTE)) due.push('midnight');
    if (prefs.arrival && inWindow(minutes, wake)) due.push('arrival');
    if (prefs.gates && inWindow(minutes, wake)) due.push('gates');
    if (emergencyAt !== null && minutes >= emergencyAt && minutes < emergencyAt + EMERGENCY_CATCH_UP_MINUTES) {
      due.push('emergency');
    }
    if (prefs.warning && inWindow(minutes, toMinutes(prefs.warningTime))) due.push('warning');
    if (!due.length) continue;

    // Only load the (large) save document when something is actually due.
    let loaded: { ls: any; status: DayStatus } | null = null;
    const load = async () => {
      if (!loaded) {
        const found = await findUserDocAcrossDatabases(subjectId);
        loaded = { ls: found?.doc?.localStorage || {}, status: readDayStatus(found?.doc, today) };
      }
      return loaded;
    };

    for (const type of due) {
      if (await logCol.findOne({ subjectId, type, date: today })) continue;

      const { ls, status: s } = await load();
      let message: Transmission | null = null;
      let emergency: ReturnType<typeof buildEmergencyQuest> | null = null;

      if (type === 'midnight') {
        // One slip waits for the wake-up transmission; a repeat breaks through immediately.
        // (A failure the day BEFORE a declared absence is still judged — only declared days are exempt.)
        if (s.newFailure && s.projectedStreak >= 2) message = midnightMessage(s);
      } else if (s.todayDeclared) {
        message = null; // declared absence: the System stays silent all day
      } else if (type === 'arrival') {
        message = arrivalMessage(s, prefs.penalty, today);
      } else if (type === 'gates') {
        message = gateAlertMessage(ls, now, prefs.timezone, today);
      } else if (type === 'emergency') {
        const fatigue = Number(ls.userProfile?.fatigue) || 0;
        const penaltyActive = Boolean(readSyncedJson(ls, 'wrp_active_penalty_quest'));
        // A Hunter already serving a penalty, or near collapse, is not summoned.
        if (!penaltyActive && fatigue <= 70) {
          emergency = buildEmergencyQuest(subjectId, today, now, ls);
          message = {
            title: '[EMERGENCY QUEST]',
            body: `${emergency.title}. Time limit: ${formatLimit(emergency.timeLimitMinutes)}. Reward: ${emergency.rewardXp} EXP. Accept within 30 minutes.`,
            tag: 'wrp-emergency',
            ttl: EMERGENCY_ACCEPT_WINDOW_MS / 1000, // worthless once it can no longer be accepted
          };
        }
      } else {
        message = warningMessage(s, today);
      }

      const entry: any = { subjectId, type, date: today, localMinutes: minutes, message: message?.title || null };
      if (!dry) {
        if (emergency) {
          const { id: emergencyId, ...fields } = emergency;
          await db
            .collection(EMERGENCY)
            .updateOne({ id: emergencyId }, { $setOnInsert: { ...fields, expiresAt: new Date(now.getTime() + RECORD_RETENTION_MS) } }, { upsert: true });
        }
        if (message) Object.assign(entry, await sendToSubject(subsCol, devices, message));
        await logCol.insertOne({
          subjectId,
          type,
          date: today,
          sentAt: now.toISOString(),
          skipped: !message,
          expiresAt: new Date(now.getTime() + RECORD_RETENTION_MS),
        });
      }
      if (dry) {
        if (message) entry.body = message.body;
        if (type === 'emergency') entry.scheduledMinute = emergencyAt;
      }
      report.push(entry);
    }
    if (dry && emergencyAt !== null && !due.includes('emergency')) {
      report.push({ subjectId, type: 'emergency-scheduled', date: today, scheduledMinute: emergencyAt });
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
      // `at` simulates the clock (secret holder only) — used to test schedules without waiting.
      const at = req.query.at ? new Date(String(req.query.at)) : new Date();
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

    if (req.method === 'GET' && action === 'emergency') {
      const subjectId = norm(req.query.subjectId);
      if (!subjectId) return res.status(400).json({ error: 'subjectId required' });
      const quest = await currentEmergency(db, subjectId);
      return res.status(200).json({ quest, serverNow: new Date().toISOString() });
    }

    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    if (action === 'emergency-respond') {
      const subjectId = norm(req.body?.subjectId);
      const id = String(req.body?.id || '');
      const response = String(req.body?.response || '');
      if (!subjectId || !id) return res.status(400).json({ error: 'subjectId and id required' });
      const result = await respondToEmergency(db, subjectId, id, response);
      return res.status(result.ok ? 200 : 409).json(result);
    }

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
