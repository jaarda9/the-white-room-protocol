import { useCallback, useEffect, useRef, useState } from 'react';
import { Siren, Timer, X } from 'lucide-react';
import { toast } from 'sonner';
import { systemSound } from '@/lib/system-sound';
import { addXP, getUserProfile, saveUserProfile } from '@/lib/storage';
import { pushNotification } from '@/lib/notifications';
import { fetchEmergencyQuest, respondToEmergencyQuest, type EmergencyQuest } from '@/lib/push-notifications';

const POLL_MS = 2 * 60_000;

const formatClock = (ms: number) => {
  const total = Math.max(0, Math.ceil(ms / 1000));
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
};

/** Read-only: getUserProfile() creates + saves a default profile when none exists, which must not
 * happen from a watcher mounted on every page (including Login). */
const subjectIdNow = (): string => {
  try {
    const raw = localStorage.getItem('whiteroom_user_profile');
    return raw ? String(JSON.parse(raw)?.id || '') : '';
  } catch {
    return '';
  }
};

/**
 * Surfaces the Emergency Quest issued by the push tick (api/push.ts) whenever the app is open —
 * whether the Player tapped the notification or just opened the app. The server owns the clock
 * (accept window, deadline); this only displays it and reports the Player's answer.
 */
export default function EmergencyQuestWatcher() {
  const [quest, setQuest] = useState<EmergencyQuest | null>(null);
  const [minimized, setMinimized] = useState(false);
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(Date.now());
  const clockOffset = useRef(0); // serverNow - deviceNow, so a wrong phone clock can't skew the timer
  const seenId = useRef<string | null>(null);

  const refresh = useCallback(async () => {
    const subjectId = subjectIdNow();
    if (!subjectId || document.visibilityState !== 'visible') return;
    try {
      const { quest: next, serverNow } = await fetchEmergencyQuest(subjectId);
      clockOffset.current = Date.parse(serverNow) - Date.now();
      setQuest(next);
      if (next && next.id !== seenId.current) {
        seenId.current = next.id;
        setMinimized(false);
        systemSound.playPenaltyWarning();
      }
    } catch {
      // offline — try again on the next poll
    }
  }, []);

  useEffect(() => {
    refresh();
    const onVisible = () => document.visibilityState === 'visible' && refresh();
    document.addEventListener('visibilitychange', onVisible);
    const poll = window.setInterval(refresh, POLL_MS);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      window.clearInterval(poll);
    };
  }, [refresh]);

  useEffect(() => {
    if (!quest) return;
    const tick = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(tick);
  }, [quest]);

  const serverNow = now + clockOffset.current;
  const endsAt = quest
    ? quest.status === 'accepted' && quest.deadline
      ? Date.parse(quest.deadline)
      : Date.parse(quest.acceptBy)
    : 0;
  const remaining = endsAt - serverNow;
  const timedOut = Boolean(quest) && remaining <= 0;

  useEffect(() => {
    if (!timedOut) return;
    // Let the server settle it (expired / failed) — no penalty either way — then the window closes.
    const t = window.setTimeout(refresh, 1500);
    return () => window.clearTimeout(t);
  }, [timedOut, refresh]);

  if (!quest) return null;

  const respond = async (response: 'accept' | 'decline' | 'complete') => {
    const subjectId = subjectIdNow();
    if (!subjectId) return;
    systemSound.playClick();
    setBusy(true);
    try {
      const result = await respondToEmergencyQuest(subjectId, quest.id, response);
      if (!result.ok) {
        toast.error('[SYSTEM] REQUEST REJECTED', { description: result.error || 'The quest is no longer active.' });
        await refresh();
        return;
      }
      if (result.status === 'accepted' && result.deadline) {
        setQuest({ ...quest, status: 'accepted', deadline: result.deadline });
        toast('[SYSTEM] EMERGENCY QUEST ACCEPTED', { description: `Time limit: ${quest.timeLimitMinutes}:00. Begin.` });
      } else if (result.status === 'declined') {
        setQuest(null);
        toast('[SYSTEM] EMERGENCY QUEST DECLINED', { description: 'No penalty is applied.' });
      } else if (result.status === 'completed') {
        // Reward is granted only on the server-confirmed transition, so it can't be claimed twice.
        const xp = result.rewardXp || quest.rewardXp;
        saveUserProfile(addXP(getUserProfile(), xp, quest.category === 'physical' ? 'physical' : 'mental'));
        pushNotification({
          key: `emergency-clear-${quest.id}`,
          severity: 'milestone',
          title: '[EMERGENCY QUEST CLEARED]',
          description: `${quest.title} — +${xp} EXP.`,
        });
        systemSound.playQuestComplete();
        toast.success('[EMERGENCY QUEST CLEARED]', { description: `+${xp} EXP` });
        setQuest(null);
      }
    } finally {
      setBusy(false);
    }
  };

  const accepted = quest.status === 'accepted';

  if (minimized) {
    return (
      <button
        onClick={() => setMinimized(false)}
        className="fixed bottom-20 right-4 z-[90] flex items-center gap-2 px-3 py-2 rounded-[2px] border border-red-500/70 bg-red-950/90 text-red-200 font-mono text-xs shadow-[0_0_16px_rgba(255,40,40,0.45)] animate-pulse"
      >
        <Siren className="w-4 h-4" />
        EMERGENCY {formatClock(remaining)}
      </button>
    );
  }

  const btn = 'flex-1 px-3 py-2 rounded-[2px] text-xs font-bold font-mono transition-all disabled:opacity-40';

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
      <div className="w-full max-w-sm border-2 border-red-500/80 bg-[#14060a]/95 rounded-[2px] shadow-[0_0_32px_rgba(255,40,40,0.4)] font-mono">
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-red-500/40 bg-red-500/10">
          <div className="flex items-center gap-2 text-red-300 text-xs font-bold tracking-widest">
            <Siren className="w-4 h-4" />
            [EMERGENCY QUEST]
          </div>
          <button onClick={() => setMinimized(true)} className="text-red-200/60 hover:text-white" aria-label="Minimize">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 space-y-3">
          <div>
            <div className="text-white text-base font-bold">{quest.title}</div>
            <div className="text-[11px] text-gray-300 mt-1 leading-relaxed">{quest.description}</div>
          </div>

          <div className="grid grid-cols-3 gap-2 text-[10px]">
            <div className="p-2 border border-white/15 bg-black/30">
              <div className="text-gray-500 uppercase">Limit</div>
              <div className="text-white">{quest.timeLimitMinutes}:00</div>
            </div>
            <div className="p-2 border border-white/15 bg-black/30">
              <div className="text-gray-500 uppercase">Reward</div>
              <div className="text-cyan-300">+{quest.rewardXp} EXP</div>
            </div>
            <div className="p-2 border border-white/15 bg-black/30">
              <div className="text-gray-500 uppercase">Rank</div>
              <div className="text-white">{quest.rank}</div>
            </div>
          </div>

          <div className="flex items-center justify-center gap-2 py-2 border border-red-500/40 bg-red-500/5 text-red-200">
            <Timer className="w-4 h-4" />
            <span className="text-[10px] uppercase">{accepted ? 'Time remaining' : 'Accept within'}</span>
            <span className="text-lg font-bold tabular-nums">{formatClock(remaining)}</span>
          </div>

          <div className="flex gap-2">
            {accepted ? (
              <>
                <button onClick={() => respond('decline')} disabled={busy} className={`${btn} border border-white/25 text-gray-300 hover:text-white bg-black/30`}>
                  [ ABANDON ]
                </button>
                <button onClick={() => respond('complete')} disabled={busy || remaining <= 0} className={`${btn} border-2 border-cyan-400 text-cyan-200 bg-cyan-950/70 hover:bg-cyan-900`}>
                  [ QUEST COMPLETE ]
                </button>
              </>
            ) : (
              <>
                <button onClick={() => respond('decline')} disabled={busy} className={`${btn} border border-white/25 text-gray-300 hover:text-white bg-black/30`}>
                  [ DECLINE ]
                </button>
                <button onClick={() => respond('accept')} disabled={busy || remaining <= 0} className={`${btn} border-2 border-red-400 text-red-100 bg-red-900/60 hover:bg-red-800/70`}>
                  [ ACCEPT ]
                </button>
              </>
            )}
          </div>
          <p className="text-[10px] text-white/40 text-center">Declining carries no penalty.</p>
        </div>
      </div>
    </div>
  );
}
