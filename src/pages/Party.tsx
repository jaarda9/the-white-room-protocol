import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Users, Crown, BellRing, Shield, UserPlus, Search, LogOut, ChevronDown, Gift, UserMinus } from 'lucide-react';
import { toast } from 'sonner';
import { systemSound } from '@/lib/system-sound';
import FirstContactCard from '@/components/FirstContactCard';
import CommsTabs from '@/components/CommsTabs';
import { fetchHunters, type HunterEntry } from '@/lib/messaging-service';
import {
  claimPartyRewards,
  fetchPartyState,
  getCachedPartyState,
  partyAction,
  type MemberStatus,
  type PartyMember,
  type PartyState,
} from '@/lib/party-service';

const STATUS_STYLE: Record<MemberStatus, { dot: string; label: string }> = {
  cleared: { dot: 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]', label: 'CLEARED' },
  active: { dot: 'bg-amber-300 shadow-[0_0_8px_rgba(252,211,77,0.7)]', label: 'IN PROGRESS' },
  idle: { dot: 'bg-white/25', label: 'NOT STARTED' },
  excused: { dot: 'bg-sky-400/60', label: 'ABSENT (DECLARED)' },
};

const shell =
  'relative max-w-md w-full mx-auto bg-[#0a1b2e]/90 border-2 border-white/50 rounded-[4px] p-4 sm:p-6 text-white shadow-[0_0_30px_rgba(0,0,0,0.85),inset_0_0_24px_rgba(0,212,255,0.08)] backdrop-blur-md anime-dropdown font-mono';

export default function Party() {
  const navigate = useNavigate();
  const [state, setState] = useState<PartyState | null>(() => getCachedPartyState());
  const [loading, setLoading] = useState(!getCachedPartyState());
  const [busy, setBusy] = useState(false);
  const [partyName, setPartyName] = useState('');
  const [showInvite, setShowInvite] = useState(false);
  const [hunters, setHunters] = useState<HunterEntry[]>([]);
  const [query, setQuery] = useState('');

  const refresh = useCallback(async () => {
    const next = await fetchPartyState();
    if (next) setState(next);
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
    const t = setInterval(() => {
      if (document.visibilityState === 'visible') refresh();
    }, 60_000);
    return () => clearInterval(t);
  }, [refresh]);

  useEffect(() => {
    if (showInvite && hunters.length === 0) fetchHunters().then(setHunters);
  }, [showInvite, hunters.length]);

  const run = async (body: Record<string, unknown>, success?: string) => {
    if (busy) return;
    setBusy(true);
    systemSound.playClick();
    const result = await partyAction(body);
    setBusy(false);
    if (!result.ok) {
      systemSound.playPenaltyWarning();
      toast.error(result.error);
      return false;
    }
    if (result.state) setState(result.state);
    else refresh();
    if (success) toast.success(success);
    return true;
  };

  const party = state?.party || null;
  const memberHandles = useMemo(() => new Set(party?.members.map((m) => m.handle) || []), [party]);
  const directory = useMemo(() => {
    const q = query.trim().toLowerCase();
    return hunters
      .filter((h) => !h.isYou && !memberHandles.has(h.handle))
      .filter((h) => !q || h.fullName.toLowerCase().includes(q) || h.handle.toLowerCase().includes(q))
      .slice(0, 25);
  }, [hunters, query, memberHandles]);

  const rewardTotal = (state?.rewards || []).reduce((sum, r) => sum + r.xp, 0);

  const claim = async () => {
    if (!state?.rewards.length || busy) return;
    setBusy(true);
    const total = await claimPartyRewards(state.rewards);
    setBusy(false);
    if (total > 0) {
      systemSound.playLevelUp();
      toast.success(`PARTY BOND REWARD: +${total} EXP`);
    }
    refresh();
  };

  const memberActions = (m: PartyMember) => {
    if (m.isYou) return null;
    const behind = m.today.status === 'idle' || m.today.status === 'active';
    return (
      <div className="flex items-center gap-1.5 shrink-0">
        {behind && (
          <button
            type="button"
            disabled={busy}
            onClick={() => run({ action: 'summon', handle: m.handle }, `${m.name} has been summoned.`)}
            className="p-1.5 border border-white/30 text-amber-200 hover:text-white hover:border-amber-300 rounded-[2px] disabled:opacity-40"
            title="Summon: send them a reminder (once a day)"
            aria-label={`Summon ${m.name}`}
          >
            <BellRing className="w-3.5 h-3.5" />
          </button>
        )}
        {m.coverable && party?.coverAvailable && (
          <button
            type="button"
            disabled={busy}
            onClick={() => run({ action: 'cover', handle: m.handle }, `You are covering ${m.name} today.`)}
            className="p-1.5 border border-white/30 text-cyan-200 hover:text-white hover:border-cyan-300 rounded-[2px] disabled:opacity-40"
            title="Cover: clear your own quest + 2 bonus directives to save their day (once a week)"
            aria-label={`Cover ${m.name}`}
          >
            <Shield className="w-3.5 h-3.5" />
          </button>
        )}
        {party?.isLeader && (
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              if (window.confirm(`Remove ${m.name} from the party?`)) run({ action: 'kick', handle: m.handle });
            }}
            className="p-1.5 text-white/30 hover:text-rose-300 rounded-[2px] disabled:opacity-40"
            title="Remove from party"
            aria-label={`Remove ${m.name}`}
          >
            <UserMinus className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-[#071322] text-[#e5ecf4] flex items-center justify-center px-3 sm:px-6 pt-8 pb-36 system-blueprint-bg">
      <div className={shell}>
        <CommsTabs current="party" />
        <div className="text-center mb-4">
          <div className="inline-block px-6 sm:px-8 py-1 border border-white/70 bg-[#061426]/60 shadow-[0_0_14px_rgba(0,212,255,0.35)] mb-1.5">
            <h1 className="text-lg sm:text-xl font-bold text-white anime-glow-text tracking-[0.2em] flex items-center justify-center gap-2">
              <Users className="w-4 h-4 sm:w-5 sm:h-5 text-[#9fd3ff]" />
              PARTY
            </h1>
          </div>
          <p className="text-[10px] sm:text-xs text-white/70">
            {party ? `[ ${party.name} · ${party.size}/${party.max} ]` : '[Hunters who rise together]'}
          </p>
        </div>

        <button
          onClick={() => {
            systemSound.playClick();
            navigate('/?view=records');
          }}
          className="mb-3 inline-flex items-center gap-1.5 px-2.5 py-1 border border-white/40 bg-[#061426]/70 text-[10px] text-[#9fd3ff] hover:bg-white/10 hover:border-white transition-all"
        >
          <ArrowLeft className="w-3 h-3" />
          <span>[ RECORDS ]</span>
        </button>

        <FirstContactCard id="party" title="PARTY" className="mb-4">
          Clear your Daily Quests together. Every day the whole party clears keeps the Party Bond alive and pays
          bonus EXP. A miss only costs the bonus: penalties stay personal.
        </FirstContactCard>

        {loading && <div className="text-center text-xs text-[#9fd3ff] animate-pulse py-6">[ CONNECTING TO PARTY UPLINK… ]</div>}

        {!loading && state && state.rewards.length > 0 && (
          <button
            type="button"
            onClick={claim}
            disabled={busy}
            className="w-full mb-4 flex items-center justify-between gap-2 px-3 py-2.5 border-2 border-amber-300/70 bg-amber-950/30 hover:bg-amber-900/40 rounded-[2px] text-left disabled:opacity-50"
          >
            <span className="flex items-center gap-2 text-xs text-amber-100">
              <Gift className="w-4 h-4 text-amber-300" />
              PARTY BOND REWARD: +{rewardTotal} EXP
            </span>
            <span className="text-[11px] font-bold text-amber-300">[ CLAIM ]</span>
          </button>
        )}

        {/* ---------- No party ---------- */}
        {!loading && state && !party && (
          <div className="space-y-4">
            {state.invites.length > 0 && (
              <div className="space-y-2">
                <div className="text-[10px] tracking-[0.2em] text-white/50">INVITATIONS</div>
                {state.invites.map((inv) => (
                  <div key={inv.id} className="border border-cyan-400/50 bg-cyan-950/20 rounded-[2px] p-2.5">
                    <div className="text-xs text-white">
                      <span className="text-[#9fd3ff] font-bold">{inv.fromName}</span> invites you to{' '}
                      <span className="font-bold">"{inv.partyName}"</span>
                    </div>
                    <div className="flex gap-2 mt-2">
                      <button
                        type="button"
                        disabled={busy || Boolean(state.joinBlockedUntil)}
                        onClick={() => run({ action: 'respond', inviteId: inv.id, accept: true }, 'You joined the party.')}
                        className="flex-1 py-1.5 bg-white text-black text-[11px] font-bold hover:bg-gray-200 rounded-[2px] disabled:opacity-40"
                      >
                        JOIN
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => run({ action: 'respond', inviteId: inv.id, accept: false })}
                        className="px-3 py-1.5 border border-white/30 text-[11px] text-gray-300 hover:text-white rounded-[2px] disabled:opacity-40"
                      >
                        DECLINE
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {state.joinBlockedUntil ? (
              <div className="text-[11px] text-amber-200/90 border border-amber-500/40 bg-amber-950/20 p-2.5 rounded-[2px]">
                You left a party recently. You can join or form a party again on{' '}
                {new Date(state.joinBlockedUntil).toLocaleDateString()}.
              </div>
            ) : (
              <div className="space-y-2">
                <div className="text-[10px] tracking-[0.2em] text-white/50">FORM A PARTY</div>
                <input
                  value={partyName}
                  onChange={(e) => setPartyName(e.target.value.slice(0, 24))}
                  placeholder="Party name"
                  className="w-full px-2.5 py-2 bg-[#061424]/70 border border-white/30 text-xs text-white outline-none focus:border-white/70 placeholder:text-white/35 rounded-[2px]"
                />
                <button
                  type="button"
                  disabled={busy || partyName.trim().length < 2}
                  onClick={() => run({ action: 'create', name: partyName }, 'Party formed. Invite up to 3 Hunters.')}
                  className="w-full py-2 bg-white text-black text-xs font-bold hover:bg-gray-200 rounded-[2px] disabled:opacity-40"
                >
                  FORM PARTY
                </button>
                <p className="text-[10px] text-white/40">Or ask a Hunter to invite you to theirs.</p>
              </div>
            )}
          </div>
        )}

        {/* ---------- In a party ---------- */}
        {!loading && party && (
          <div className="space-y-4">
            <div className="flex items-center justify-between border border-white/25 bg-[#061424]/60 px-3 py-2 rounded-[2px]">
              <div>
                <div className="text-[10px] tracking-[0.2em] text-white/50">PARTY BOND</div>
                <div className="text-sm font-bold text-[#9fd3ff]">
                  {party.bond.streak} DAY{party.bond.streak === 1 ? '' : 'S'}
                </div>
              </div>
              <div className="text-right text-[10px] text-white/50 leading-relaxed">
                <div>BEST {party.bond.best}</div>
                {party.bond.lastResult === 'fractured' && <div className="text-rose-300/80">BOND FRACTURED</div>}
              </div>
            </div>

            <div className="flex flex-col divide-y divide-white/10 border border-white/30 rounded-[2px]">
              {party.members.map((m) => (
                <div key={m.handle} className="flex items-center gap-2.5 px-3 py-2.5 bg-[#061424]/60">
                  <span
                    className={`w-2.5 h-2.5 rounded-full shrink-0 ${STATUS_STYLE[m.today.status].dot}`}
                    title={STATUS_STYLE[m.today.status].label}
                  />
                  <span className="flex-1 min-w-0">
                    <span className="flex items-center gap-1.5 text-xs text-white truncate">
                      {m.isLeader && <Crown className="w-3 h-3 text-amber-300 shrink-0" />}
                      <span className="truncate">{m.isYou ? `${m.name} (you)` : m.name}</span>
                    </span>
                    <span className="block text-[9px] text-white/45 tracking-wider">
                      {STATUS_STYLE[m.today.status].label}
                      {m.coveredToday ? ' · COVERED' : ''}
                    </span>
                  </span>
                  <span className="shrink-0 text-[9px] px-1.5 py-0.5 border border-white/30 text-[#9fd3ff] bg-black/50">
                    {m.rank}-RANK
                  </span>
                  {memberActions(m)}
                </div>
              ))}
            </div>

            {party.coverProgress && (
              <div className="text-[10px] text-cyan-200/90 border border-cyan-400/40 bg-cyan-950/20 px-2.5 py-1.5 rounded-[2px]">
                COVER IN PROGRESS: clear your Daily Quest{party.coverProgress.cleared ? ' ✓' : ''} and{' '}
                {party.coverProgress.bonusRequired} bonus directives ({party.coverProgress.bonusDone}/
                {party.coverProgress.bonusRequired}).
              </div>
            )}

            {party.isLeader && party.size < party.max && (
              <div>
                <button
                  type="button"
                  onClick={() => {
                    systemSound.playClick();
                    setShowInvite((v) => !v);
                  }}
                  className="w-full flex items-center justify-between px-3 py-2 border border-white/30 bg-[#061424]/60 text-[11px] text-[#9fd3ff] hover:bg-white/10 rounded-[2px]"
                >
                  <span className="flex items-center gap-1.5">
                    <UserPlus className="w-3.5 h-3.5" /> INVITE A HUNTER
                  </span>
                  <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showInvite ? 'rotate-180' : ''}`} />
                </button>
                {showInvite && (
                  <div className="mt-2 space-y-2 anime-dropdown">
                    <div className="flex items-center gap-2 px-2 py-1.5 border border-white/30 bg-[#061424]/60">
                      <Search className="w-3.5 h-3.5 text-[#9fd3ff]" />
                      <input
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="Search hunters..."
                        className="flex-1 bg-transparent outline-none text-xs text-white placeholder:text-white/35"
                      />
                    </div>
                    <div className="max-h-48 overflow-y-auto flex flex-col divide-y divide-white/10 border border-white/30 rounded-[2px]">
                      {directory.length === 0 && (
                        <div className="px-3 py-3 text-[11px] text-white/50">[ NO HUNTERS FOUND ]</div>
                      )}
                      {directory.map((h) => (
                        <button
                          key={h.handle}
                          type="button"
                          disabled={busy}
                          onClick={() => run({ action: 'invite', handle: h.handle }, `Invitation sent to ${h.fullName}.`)}
                          className="flex items-center gap-2 px-3 py-2 text-left bg-[#061424]/60 hover:bg-white/10 transition-all disabled:opacity-40"
                        >
                          <span className="flex-1 min-w-0 truncate text-xs text-white">{h.fullName}</span>
                          <span className="shrink-0 text-[9px] px-1.5 py-0.5 border border-white/30 text-[#9fd3ff] bg-black/50">
                            LV.{h.level}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            <details className="group border border-white/15 rounded-[2px] px-3 py-2 text-[10px] text-white/60">
              <summary className="cursor-pointer list-none flex items-center justify-between text-white/50 tracking-[0.2em]">
                HOW THE BOND WORKS
                <ChevronDown className="w-3.5 h-3.5 transition-transform group-open:rotate-180" />
              </summary>
              <ul className="mt-2 space-y-1 leading-relaxed list-disc pl-4">
                <li>A day counts when every member clears their Daily Quest, each in their own timezone.</li>
                <li>Kept day: +20 EXP each. Milestones at 3, 7, 14 and 30 days pay more.</li>
                <li>A miss resets the Bond, nothing more. Declared absences are excused.</li>
                <li>
                  <b>Summon</b> (bell): remind a teammate, once a day, during their waking hours.
                </li>
                <li>
                  <b>Cover</b> (shield): once a week, save a teammate&apos;s day by clearing yours plus 2 bonus
                  directives.
                </li>
                <li>Teammates see only your status light and rank, never your directives.</li>
              </ul>
            </details>

            <button
              type="button"
              disabled={busy}
              onClick={() => {
                if (
                  window.confirm(
                    'Leave the party? You will not be able to join or form another party for 7 days.'
                  )
                ) {
                  run({ action: 'leave' }, 'You left the party.');
                }
              }}
              className="w-full flex items-center justify-center gap-1.5 py-1.5 text-[10px] text-white/40 hover:text-rose-300 transition-colors disabled:opacity-40"
            >
              <LogOut className="w-3 h-3" /> LEAVE PARTY
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
