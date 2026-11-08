import type { VercelRequest, VercelResponse } from '@vercel/node';
import { randomBytes } from 'crypto';
import {
  findUserDocAcrossDatabases,
  getDayRecord,
  getDb,
  handlesFor,
  normSubject,
  requireSubject,
  subjectForHandle,
} from './lib/mongodb.js';
import { absencePredicate, getPushPrefs, localClock, sendPartyTransmission, toMinutes } from './push.js';

/**
 * Parties — co-op accountability for 2–4 Hunters.
 *
 *   GET  ?action=state&tz=<IANA>     → { party, invites, rewards, joinBlockedUntil }
 *   POST { action: 'create', name, tz }
 *   POST { action: 'invite', handle }               (leader)
 *   POST { action: 'respond', inviteId, accept, tz }
 *   POST { action: 'leave' }
 *   POST { action: 'kick', handle }                 (leader)
 *   POST { action: 'summon', handle }               once per teammate per day, during their waking hours
 *   POST { action: 'cover', handle }                once per party per week
 *   POST { action: 'claim', rewardId }              → { xp } once
 *
 * Party Bond: a day counts when every member (who joined before it) cleared their Daily Quest,
 * judged in each member's own timezone once that day has closed for everyone. Declared absences
 * are excused. Cover: a teammate who clears their own day and two bonus directives saves one
 * member's missed day (once per party per week). Rewards are shared; penalties stay personal —
 * a broken bond only costs the bonus.
 *
 * What teammates see of each other: handle, name, rank, and today's status light. Nothing else.
 * Day outcomes come from dayRecords (api/lib/mongodb.ts), written on every save.
 */

const PARTIES = 'parties';
const INVITES = 'partyInvites';
const META = 'partyMeta';
const COVERS = 'partyCovers';
const REWARDS = 'partyRewards';
const SUMMONS = 'partySummons';

const MAX_MEMBERS = 4;
const MAX_PENDING_INVITES = 10;
const INVITE_TTL_MS = 3 * 86_400_000;
const LEAVE_COOLDOWN_MS = 7 * 86_400_000;
const MAX_SETTLE_DAYS = 14;
const COVER_BONUS_REQUIRED = 2;
const BOND_DAY_XP = 20;
const BOND_MILESTONES: Record<number, number> = { 3: 50, 7: 100, 14: 200, 30: 400 };
const RECORD_TTL_MS = 60 * 86_400_000;

const RANKS = ['E', 'D', 'C', 'B', 'A', 'S'] as const;
const rankFor = (level: number) => RANKS[Math.min(5, Math.max(0, Math.floor((Math.max(1, level) - 1) / 10)))];

const dayNumber = (ymd: string) => Math.round(Date.UTC(+ymd.slice(0, 4), +ymd.slice(5, 7) - 1, +ymd.slice(8, 10)) / 86_400_000);
const dayKey = (n: number) => new Date(n * 86_400_000).toISOString().slice(0, 10);
const nextDay = (ymd: string) => dayKey(dayNumber(ymd) + 1);
/** Monday-based week id of a local date, for the weekly Cover limit. */
const weekOf = (ymd: string) => {
  const n = dayNumber(ymd);
  const weekday = (new Date(n * 86_400_000).getUTCDay() + 6) % 7; // Mon = 0
  return dayKey(n - weekday);
};

const newId = () => randomBytes(9).toString('base64url');

const isValidTimezone = (tz: unknown): tz is string => {
  if (typeof tz !== 'string' || !tz || tz.length > 64) return false;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
};

function cleanPartyName(raw: unknown): string {
  return String(raw || '')
    .replace(/[\u0000-\u001f<>]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 24);
}

interface Member {
  subjectId: string;
  joinedAt: string;
  /** Member's local date when they joined; their days count from the day after. */
  joinedDay: string;
  tz: string;
}

interface Party {
  id: string;
  name: string;
  leader: string;
  members: Member[];
  createdAt: string;
  bond: {
    streak: number;
    best: number;
    settledThrough: string | null;
    lastResult: 'kept' | 'fractured' | null;
    lastResultDate: string | null;
  };
  version: number;
}

let indexesReady = false;
async function ensureIndexes(db: any) {
  if (indexesReady) return;
  indexesReady = true;
  const safe = (p: Promise<any>) => p.catch((e: any) => console.warn('[party] index:', e?.message || e));
  if (typeof db.collection(PARTIES).createIndex !== 'function') return;
  await Promise.all([
    safe(db.collection(PARTIES).createIndex({ id: 1 }, { unique: true })),
    safe(db.collection(PARTIES).createIndex({ 'members.subjectId': 1 })),
    safe(db.collection(INVITES).createIndex({ id: 1 }, { unique: true })),
    safe(db.collection(INVITES).createIndex({ to: 1 })),
    safe(db.collection(INVITES).createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 })),
    safe(db.collection(META).createIndex({ subjectId: 1 }, { unique: true })),
    safe(db.collection(COVERS).createIndex({ partyId: 1, date: 1, covered: 1 }, { unique: true })),
    safe(db.collection(COVERS).createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 })),
    safe(db.collection(REWARDS).createIndex({ id: 1 }, { unique: true })),
    safe(db.collection(REWARDS).createIndex({ subjectId: 1, claimed: 1 })),
    safe(db.collection(REWARDS).createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 })),
    safe(db.collection(SUMMONS).createIndex({ key: 1 }, { unique: true })),
    safe(db.collection(SUMMONS).createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 })),
  ]);
}

async function partyOf(db: any, subjectId: string): Promise<Party | null> {
  return db.collection(PARTIES).findOne({ 'members.subjectId': subjectId });
}

/** A member's timezone: their notification settings win (kept current by the Uplink panel). */
async function memberTimezone(member: Member): Promise<string> {
  try {
    const prefs = await getPushPrefs(member.subjectId);
    if (prefs.timezone && prefs.timezone !== 'UTC') return prefs.timezone;
  } catch {
    // ignore
  }
  return isValidTimezone(member.tz) ? member.tz : 'UTC';
}

interface Profile {
  name: string;
  level: number;
  ls: any;
}

async function loadProfile(subjectId: string, handle: string): Promise<Profile> {
  const found = await findUserDocAcrossDatabases(subjectId);
  const ls = found?.doc?.localStorage || {};
  let profile = ls.userProfile;
  if (!profile && typeof ls.whiteroom_user_profile === 'string') {
    try {
      profile = JSON.parse(ls.whiteroom_user_profile);
    } catch {
      profile = null;
    }
  }
  let name = String(profile?.displayName || profile?.fullName || '').trim();
  // Never show a name built from the Subject ID (a login credential).
  if (!name || name === 'Subject' || name.toUpperCase().includes(subjectId)) name = `Hunter ${handle}`;
  return { name: name.slice(0, 40), level: Number(profile?.level) || 1, ls };
}

// ---------------------------------------------------------------------------
// Settlement — judges every closed day once, then moves `settledThrough` forward.
// ---------------------------------------------------------------------------

async function settle(db: any, party: Party, now: Date): Promise<Party> {
  const todays = new Map<string, string>();
  for (const m of party.members) todays.set(m.subjectId, localClock(now, await memberTimezone(m)).date);
  const minToday = [...todays.values()].sort()[0];
  if (!minToday) return party;

  const countFrom = (m: Member) => nextDay(m.joinedDay);
  let start = party.bond.settledThrough
    ? nextDay(party.bond.settledThrough)
    : party.members.map(countFrom).sort()[0];
  if (!start || start >= minToday) return party;

  const bond = { ...party.bond };
  // Long silence: more than MAX_SETTLE_DAYS unsettled days means the bond did not hold.
  if (dayNumber(minToday) - dayNumber(start) > MAX_SETTLE_DAYS) {
    bond.streak = 0;
    bond.lastResult = 'fractured';
    start = dayKey(dayNumber(minToday) - MAX_SETTLE_DAYS);
  }

  const rewards: any[] = [];
  const coverResults: Array<{ id: string; applied: boolean }> = [];
  const absence = new Map<string, (d: string) => boolean>();
  const absenceFor = async (subjectId: string) => {
    if (!absence.has(subjectId)) {
      const found = await findUserDocAcrossDatabases(subjectId);
      absence.set(subjectId, absencePredicate(found?.doc?.localStorage || {}));
    }
    return absence.get(subjectId)!;
  };

  for (let d = start; d < minToday; d = nextDay(d)) {
    bond.settledThrough = d;
    const counted = party.members.filter((m) => countFrom(m) <= d);
    if (counted.length === 0) continue;

    const accountable: Member[] = [];
    const missed: Member[] = [];
    for (const m of counted) {
      if ((await absenceFor(m.subjectId))(d)) continue; // declared absence: excused
      accountable.push(m);
      const rec = await getDayRecord(m.subjectId, d);
      if (!rec?.cleared) missed.push(m);
    }
    if (accountable.length === 0) continue; // everyone excused: neutral day

    // Cover pledges for this day.
    const uncovered: Member[] = [];
    for (const m of missed) {
      const pledge = await db.collection(COVERS).findOne({ partyId: party.id, date: d, covered: m.subjectId });
      let applied = false;
      if (pledge) {
        const coverRec = await getDayRecord(pledge.coverer, pledge.covererDate);
        applied = Boolean(coverRec?.cleared) && Number(coverRec?.bonusDone) >= COVER_BONUS_REQUIRED;
        coverResults.push({ id: pledge.id, applied });
      }
      if (!applied) uncovered.push(m);
    }

    if (uncovered.length === 0) {
      bond.streak += 1;
      bond.best = Math.max(bond.best, bond.streak);
      bond.lastResult = 'kept';
      bond.lastResultDate = d;
      const milestone = BOND_MILESTONES[bond.streak] || 0;
      for (const m of accountable) {
        rewards.push({
          id: `${party.id}|${d}|${m.subjectId}`,
          subjectId: m.subjectId,
          partyId: party.id,
          date: d,
          xp: BOND_DAY_XP + milestone,
          reason: milestone ? `Party Bond ${bond.streak} days` : 'Party Bond held',
          claimed: false,
          createdAt: now,
          expiresAt: new Date(now.getTime() + RECORD_TTL_MS),
        });
      }
    } else {
      bond.streak = 0;
      bond.lastResult = 'fractured';
      bond.lastResultDate = d;
    }
  }

  // Only the request that advances `version` writes the results: two members opening the party
  // at the same moment cannot double the rewards.
  const r = await db
    .collection(PARTIES)
    .updateOne({ id: party.id, version: party.version }, { $set: { bond, version: party.version + 1 } });
  if ((r?.modifiedCount ?? 0) !== 1) {
    return (await db.collection(PARTIES).findOne({ id: party.id })) || party;
  }
  for (const reward of rewards) {
    await db
      .collection(REWARDS)
      .updateOne({ id: reward.id }, { $setOnInsert: reward }, { upsert: true })
      .catch(() => {});
  }
  for (const c of coverResults) {
    await db.collection(COVERS).updateOne({ id: c.id }, { $set: { applied: c.applied } }).catch(() => {});
  }
  return { ...party, bond, version: party.version + 1 };
}

/** A pledge that was applied, or is still pending, uses the party's weekly Cover. */
async function coverUsedThisWeek(db: any, partyId: string, week: string): Promise<boolean> {
  const used = await db.collection(COVERS).findOne({ partyId, week, applied: { $ne: false } });
  return Boolean(used);
}

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

async function buildState(db: any, me: string, now: Date) {
  let party = await partyOf(db, me);
  if (party) party = await settle(db, party, now);

  const meta = await db.collection(META).findOne({ subjectId: me });
  const blockedUntil =
    meta?.lastLeftAt && Date.now() - new Date(meta.lastLeftAt).getTime() < LEAVE_COOLDOWN_MS
      ? new Date(new Date(meta.lastLeftAt).getTime() + LEAVE_COOLDOWN_MS).toISOString()
      : null;

  const inviteDocs: any[] = party
    ? []
    : await db.collection(INVITES).find({ to: me }).sort({ createdAt: -1 }).limit(10).toArray();
  const liveInvites = inviteDocs.filter((i) => new Date(i.expiresAt).getTime() > Date.now());
  const inviterHandles = await handlesFor(liveInvites.map((i) => i.from));
  const invites = [];
  for (const i of liveInvites) {
    const p = await loadProfile(i.from, inviterHandles.get(i.from) || '');
    invites.push({ id: i.id, partyName: i.partyName, fromName: p.name });
  }

  const rewardDocs: any[] = await db.collection(REWARDS).find({ subjectId: me, claimed: false }).limit(20).toArray();
  const rewards = rewardDocs.map((r) => ({ id: r.id, xp: r.xp, reason: r.reason, date: r.date }));

  if (!party) return { party: null, invites, rewards, joinBlockedUntil: blockedUntil };

  const handles = await handlesFor(party.members.map((m) => m.subjectId));
  const members = [];
  let anyCoverPossible = false;
  for (const m of party.members) {
    const handle = handles.get(m.subjectId) || '';
    const tz = await memberTimezone(m);
    const today = localClock(now, tz).date;
    const p = await loadProfile(m.subjectId, handle);
    const rec = await getDayRecord(m.subjectId, today);
    const excused = absencePredicate(p.ls)(today);
    const status = excused
      ? 'excused'
      : rec?.cleared
        ? 'cleared'
        : Number(rec?.done) > 0
          ? 'active'
          : 'idle';
    const pledge = await db.collection(COVERS).findOne({ partyId: party.id, date: today, covered: m.subjectId });
    const isMe = m.subjectId === me;
    const coverable = !isMe && (status === 'active' || status === 'idle') && !pledge;
    if (coverable) anyCoverPossible = true;
    members.push({
      handle,
      name: p.name,
      rank: rankFor(p.level),
      level: p.level,
      isYou: isMe,
      isLeader: m.subjectId === party.leader,
      today: { status, done: Number(rec?.done) || 0, total: Number(rec?.total) || 0 },
      coveredToday: Boolean(pledge),
      coveredByYou: Boolean(pledge && pledge.coverer === me),
      coverable,
    });
  }
  const myToday = localClock(now, await memberTimezone(party.members.find((m) => m.subjectId === me)!)).date;
  const coverAvailable = anyCoverPossible && !(await coverUsedThisWeek(db, party.id, weekOf(myToday)));
  const myPledge = await db.collection(COVERS).findOne({ partyId: party.id, coverer: me, covererDate: myToday });
  let coverProgress = null;
  if (myPledge) {
    const rec = await getDayRecord(me, myToday);
    coverProgress = {
      cleared: Boolean(rec?.cleared),
      bonusDone: Math.min(COVER_BONUS_REQUIRED, Number(rec?.bonusDone) || 0),
      bonusRequired: COVER_BONUS_REQUIRED,
    };
  }

  return {
    party: {
      name: party.name,
      isLeader: party.leader === me,
      size: party.members.length,
      max: MAX_MEMBERS,
      bond: {
        streak: party.bond.streak,
        best: party.bond.best,
        lastResult: party.bond.lastResult,
        lastResultDate: party.bond.lastResultDate,
      },
      coverAvailable,
      coverProgress,
      members,
    },
    invites: [],
    rewards,
    joinBlockedUntil: blockedUntil,
  };
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const me = await requireSubject(req, res);
  if (!me) return;

  let body: any = req.body;
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body);
    } catch {
      body = {};
    }
  }
  body = body || {};
  const action = String((req.method === 'GET' ? req.query.action : body.action) || '');
  const now = new Date();
  const fail = (status: number, error: string) => res.status(status).json({ error });

  try {
    const db = await getDb();
    await ensureIndexes(db);

    // Keep this member's timezone current (used when they have no notification settings).
    const reportedTz = req.method === 'GET' ? req.query.tz : body.tz;
    if (isValidTimezone(reportedTz)) {
      await db
        .collection(PARTIES)
        .updateOne({ 'members.subjectId': me }, { $set: { 'members.$.tz': reportedTz } })
        .catch(() => {});
    }

    if (req.method === 'GET') {
      if (action !== 'state') return fail(400, `Unknown action: ${action}`);
      return res.status(200).json(await buildState(db, me, now));
    }
    if (req.method !== 'POST') return fail(405, 'Method not allowed');

    const myTz = isValidTimezone(body.tz) ? body.tz : 'UTC';
    const meta = await db.collection(META).findOne({ subjectId: me });
    const coolingDown =
      meta?.lastLeftAt && Date.now() - new Date(meta.lastLeftAt).getTime() < LEAVE_COOLDOWN_MS;

    if (action === 'create') {
      if (await partyOf(db, me)) return fail(409, 'You are already in a party.');
      if (coolingDown) return fail(409, 'You left a party recently. You can form a new one 7 days after leaving.');
      const name = cleanPartyName(body.name);
      if (name.length < 2) return fail(400, 'Party name must be 2–24 characters.');
      const prefsTz = (await getPushPrefs(me)).timezone;
      const tz = prefsTz && prefsTz !== 'UTC' ? prefsTz : myTz;
      const party: Party = {
        id: newId(),
        name,
        leader: me,
        members: [{ subjectId: me, joinedAt: now.toISOString(), joinedDay: localClock(now, tz).date, tz }],
        createdAt: now.toISOString(),
        bond: { streak: 0, best: 0, settledThrough: null, lastResult: null, lastResultDate: null },
        version: 0,
      };
      await db.collection(PARTIES).insertOne(party);
      await db.collection(INVITES).deleteMany({ to: me });
      return res.status(200).json(await buildState(db, me, now));
    }

    if (action === 'respond') {
      const invite = await db.collection(INVITES).findOne({ id: String(body.inviteId || ''), to: me });
      if (!invite || new Date(invite.expiresAt).getTime() <= Date.now()) return fail(404, 'This invitation has expired.');
      if (!body.accept) {
        await db.collection(INVITES).deleteMany({ id: invite.id });
        return res.status(200).json(await buildState(db, me, now));
      }
      if (await partyOf(db, me)) return fail(409, 'You are already in a party.');
      if (coolingDown) return fail(409, 'You left a party recently. You can join another 7 days after leaving.');
      const party: Party | null = await db.collection(PARTIES).findOne({ id: invite.partyId });
      if (!party) {
        await db.collection(INVITES).deleteMany({ id: invite.id });
        return fail(404, 'That party no longer exists.');
      }
      const prefsTz = (await getPushPrefs(me)).timezone;
      const tz = prefsTz && prefsTz !== 'UTC' ? prefsTz : myTz;
      const member: Member = { subjectId: me, joinedAt: now.toISOString(), joinedDay: localClock(now, tz).date, tz };
      // Conditional on size, so two acceptances at once cannot exceed the cap.
      const r = await db.collection(PARTIES).updateOne(
        { id: party.id, [`members.${MAX_MEMBERS - 1}`]: { $exists: false }, 'members.subjectId': { $ne: me } },
        { $push: { members: member } }
      );
      if ((r?.modifiedCount ?? 0) !== 1) return fail(409, 'That party is full.');
      await db.collection(INVITES).deleteMany({ to: me });
      return res.status(200).json(await buildState(db, me, now));
    }

    // Earned rewards stay claimable after leaving the party.
    if (action === 'claim') {
      const id = String(body.rewardId || '');
      const reward = await db.collection(REWARDS).findOne({ id, subjectId: me });
      if (!reward) return fail(404, 'Reward not found.');
      const r = await db.collection(REWARDS).updateOne({ id, subjectId: me, claimed: false }, { $set: { claimed: true, claimedAt: now } });
      if ((r?.modifiedCount ?? 0) !== 1) return fail(409, 'Already claimed.');
      return res.status(200).json({ ok: true, xp: reward.xp, reason: reward.reason });
    }

    const party = await partyOf(db, me);
    if (!party) return fail(409, 'You are not in a party.');
    const isLeader = party.leader === me;

    const memberByHandle = async (handle: unknown): Promise<Member | null> => {
      const sid = await subjectForHandle(handle);
      return sid ? party.members.find((m) => m.subjectId === sid) || null : null;
    };

    if (action === 'invite') {
      if (!isLeader) return fail(403, 'Only the party leader can invite.');
      if (party.members.length >= MAX_MEMBERS) return fail(409, 'The party is full.');
      const target = await subjectForHandle(body.handle);
      if (!target || target === me) return fail(400, 'Unknown Hunter.');
      if (party.members.some((m) => m.subjectId === target)) return fail(409, 'Already in your party.');
      if (await partyOf(db, target)) return fail(409, 'That Hunter is already in a party.');
      const blocks = await db.collection('commsPrefs').findOne({ subjectId: target });
      if (Array.isArray(blocks?.blocked) && blocks.blocked.includes(me)) return fail(409, 'That Hunter cannot be invited.');
      const pending = await db.collection(INVITES).find({ partyId: party.id }).toArray();
      const live = pending.filter((i: any) => new Date(i.expiresAt).getTime() > Date.now());
      if (live.some((i: any) => i.to === target)) return fail(409, 'An invitation is already pending.');
      if (live.length >= MAX_PENDING_INVITES) return fail(429, 'Too many pending invitations.');
      await db.collection(INVITES).insertOne({
        id: newId(),
        partyId: party.id,
        partyName: party.name,
        from: me,
        to: target,
        createdAt: now,
        expiresAt: new Date(now.getTime() + INVITE_TTL_MS),
      });
      const myHandle = (await handlesFor([me])).get(me) || '';
      const myName = (await loadProfile(me, myHandle)).name;
      await sendPartyTransmission(target, {
        title: '[PARTY INVITATION]',
        body: `${myName} invites you to join the party "${party.name}".`,
        tag: 'wrp-party-invite',
        url: '/party',
      });
      return res.status(200).json({ ok: true });
    }

    if (action === 'leave' || action === 'kick') {
      let leaving = me;
      if (action === 'kick') {
        if (!isLeader) return fail(403, 'Only the party leader can remove a member.');
        const target = await memberByHandle(body.handle);
        if (!target || target.subjectId === me) return fail(400, 'Not a member of your party.');
        leaving = target.subjectId;
      }
      const remaining = party.members.filter((m) => m.subjectId !== leaving);
      if (remaining.length === 0) {
        await db.collection(PARTIES).deleteMany({ id: party.id });
        await db.collection(INVITES).deleteMany({ partyId: party.id });
      } else {
        // Leadership passes to the longest-standing member.
        const nextLeader =
          party.leader === leaving
            ? [...remaining].sort((a, b) => a.joinedAt.localeCompare(b.joinedAt))[0].subjectId
            : party.leader;
        await db.collection(PARTIES).updateOne(
          { id: party.id },
          { $pull: { members: { subjectId: leaving } }, $set: { leader: nextLeader } }
        );
      }
      // Leaving by choice starts the cooldown; being removed does not.
      if (action === 'leave') {
        await db
          .collection(META)
          .updateOne({ subjectId: me }, { $set: { lastLeftAt: now.toISOString() } }, { upsert: true });
      }
      return res.status(200).json(await buildState(db, me, now));
    }

    if (action === 'summon') {
      const target = await memberByHandle(body.handle);
      if (!target || target.subjectId === me) return fail(400, 'Not a member of your party.');
      const prefs = await getPushPrefs(target.subjectId);
      const tz = await memberTimezone(target);
      const { date, minutes } = localClock(now, tz);
      const rec = await getDayRecord(target.subjectId, date);
      if (rec?.cleared) return fail(409, 'They already cleared today.');
      // Only during their waking hours (wake time → evening warning).
      if (minutes < toMinutes(prefs.wakeTime) || minutes >= toMinutes(prefs.warningTime)) {
        return fail(409, 'They are outside their waking hours. Try again later.');
      }
      const key = `${me}|${target.subjectId}|${date}`;
      try {
        await db.collection(SUMMONS).insertOne({ key, createdAt: now, expiresAt: new Date(now.getTime() + 2 * 86_400_000) });
      } catch (err: any) {
        if (err?.code === 11000) return fail(429, 'You already summoned them today.');
        throw err;
      }
      const myHandle = (await handlesFor([me])).get(me) || '';
      const myName = (await loadProfile(me, myHandle)).name;
      const sent = await sendPartyTransmission(target.subjectId, {
        title: '[PARTY SUMMONS]',
        body: `${myName} is calling you. Your Daily Quest is not cleared yet.`,
        tag: 'wrp-party-summon',
        url: '/?view=quests',
      });
      return res.status(200).json({ ok: true, delivered: sent > 0 });
    }

    if (action === 'cover') {
      const target = await memberByHandle(body.handle);
      if (!target || target.subjectId === me) return fail(400, 'Not a member of your party.');
      const targetToday = localClock(now, await memberTimezone(target)).date;
      const myToday = localClock(now, await memberTimezone(party.members.find((m) => m.subjectId === me)!)).date;
      const rec = await getDayRecord(target.subjectId, targetToday);
      if (rec?.cleared) return fail(409, 'They already cleared today.');
      if (await coverUsedThisWeek(db, party.id, weekOf(myToday))) return fail(409, 'Your party already used its Cover this week.');
      try {
        await db.collection(COVERS).insertOne({
          id: newId(),
          partyId: party.id,
          week: weekOf(myToday),
          date: targetToday,
          covered: target.subjectId,
          coverer: me,
          covererDate: myToday,
          applied: null,
          createdAt: now,
          expiresAt: new Date(now.getTime() + RECORD_TTL_MS),
        });
      } catch (err: any) {
        if (err?.code === 11000) return fail(409, 'Someone is already covering them today.');
        throw err;
      }
      return res.status(200).json(await buildState(db, me, now));
    }

    return fail(400, `Unknown action: ${action}`);
  } catch (err: any) {
    console.error('[api/party.ts] error:', err?.message || err);
    return fail(500, 'Party uplink error');
  }
}
