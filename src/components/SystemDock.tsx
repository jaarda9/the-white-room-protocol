import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Activity,
  Swords,
  DoorOpen,
  MessageSquare,
  LayoutGrid,
  Bell,
  Stamp,
  GitBranch,
  Archive,
  User,
  Trophy,
  Play,
  X,
} from 'lucide-react';
import { systemSound } from '@/lib/system-sound';
import { getUnreadNotificationCount, NOTIFICATIONS_UPDATED_EVENT } from '@/lib/notifications';
import { useAnyModalOpen } from '@/hooks/use-lock-body-scroll';
import { getAllStoredQuests, getTodayKeyLocal, QUESTS_UPDATED_EVENT } from '@/lib/storage';
import { isDailyClearClaimed } from '@/lib/rank-load';
import { getGates, isGateTaskUnlocked, isSprintMode, isWaveDayLocked, GATES_UPDATED_EVENT } from '@/lib/gates';
import { getActivePenaltyQuest, PENALTY_UPDATED_EVENT } from '@/lib/penalty-system';
import { fetchUnreadSummary } from '@/lib/messaging-service';
import { SESSION_SUBJECT_KEY } from '@/lib/subject-auth';

type Slot = 'status' | 'quests' | 'gates' | 'comms' | 'system';

const SYSTEM_ITEMS: Array<{ id: string; label: string; to: string; icon: typeof Bell }> = [
  { id: 'notifications', label: 'NOTICES', to: '/?view=notifications', icon: Bell },
  { id: 'seals', label: 'SEALS', to: '/?view=seals', icon: Stamp },
  { id: 'skilltree', label: 'SKILL TREE', to: '/?view=skilltree', icon: GitBranch },
  { id: 'records', label: 'RECORDS', to: '/?view=records', icon: Archive },
  { id: 'profile', label: 'PROFILE', to: '/profile', icon: User },
  { id: 'leaderboard', label: 'RANKINGS', to: '/leaderboard', icon: Trophy },
];

/** Which slot lights up for the current page, so the Hunter always knows where they are. */
export function slotForLocation(pathname: string, search: string): Slot {
  if (pathname === '/') {
    const view = new URLSearchParams(search).get('view') || 'status';
    if (view === 'status') return 'status';
    if (view === 'quests') return 'quests';
    if (view === 'dungeons') return 'gates';
    return 'system';
  }
  if (pathname.startsWith('/quest/') || pathname.startsWith('/daily')) return 'quests';
  if (pathname.startsWith('/gates/')) return 'gates';
  if (pathname === '/messages' || pathname === '/party') return 'comms';
  if (/^\/(mental-lab|physical-lab|social-lab|knowledge-lab|knowledge|kinnu-lab|chess-lab|skill-forge|challenges)/.test(pathname)) return 'quests';
  return 'system';
}

/** Mandatory directives left today, or 'claim' once they're all done and the reward waits. */
export function questBadge(): number | 'claim' | null {
  const mandatory = getAllStoredQuests().filter(
    (q) => (q.type === 'mental' || q.type === 'physical' || q.type === 'social') && !q.isChainBonus
  );
  if (mandatory.length === 0) return null;
  const left = mandatory.filter((q) => !q.completed).length;
  if (left > 0) return left;
  return isDailyClearClaimed(getTodayKeyLocal()) ? null : 'claim';
}

/** True when some open Gate has work available right now (a task open today, a Wave waiting
 * to be broken down, or a Gate ready to clear). A Wave on its midnight cooldown doesn't count. */
export function gatesNeedYou(): boolean {
  return getGates().some((g) => {
    if (g.status === 'cleared') return false;
    const i = g.milestones.findIndex((m) => !m.completed);
    if (i < 0) return g.milestones.length > 0; // every Wave done: the Gate can be cleared
    if (isWaveDayLocked(g, i)) return false;
    const m = g.milestones[i];
    if (m.tasks.length === 0) return true;
    const sprint = isSprintMode(g);
    return m.tasks.some((t, ti) => !t.completed && isGateTaskUnlocked(m.tasks, ti, sprint, g.origin !== 'theia-chain'));
  });
}

const TIMER_PREFIX = 'wrp_quest_timer:'; // QuestSession.tsx's persisted timer

/** The quest whose session timer is running (latest started), if it's still open today. */
function findRunningTimer(): { id: string; title: string; elapsedSec: number } | null {
  try {
    const quests = getAllStoredQuests();
    let best: { id: string; title: string; elapsedSec: number; started: number } | null = null;
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key || !key.startsWith(TIMER_PREFIX)) continue;
      const t = JSON.parse(localStorage.getItem(key) || 'null');
      if (!t?.isActive || typeof t.startedAtMs !== 'number') continue;
      const id = key.slice(TIMER_PREFIX.length);
      const quest = quests.find((q) => q.id === id);
      if (!quest || quest.completed) continue;
      if (!best || t.startedAtMs > best.started) {
        const elapsedSec = Math.max(0, Math.floor((Number(t.pausedElapsedSec) || 0) + (Date.now() - t.startedAtMs) / 1000));
        best = { id, title: quest.title.split(' — ')[0], elapsedSec, started: t.startedAtMs };
      }
    }
    return best ? { id: best.id, title: best.title, elapsedSec: best.elapsedSec } : null;
  } catch {
    return null;
  }
}

const formatElapsed = (sec: number) => {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}` : `${m}:${String(s).padStart(2, '0')}`;
};

/**
 * Global bottom navigation — five fixed slots (no sideways scrolling): Status, Quests, Gates,
 * Comms (Messages + Party) and System (a panel with everything else). Badges say when something
 * needs the Hunter; the bar glows red during a Penalty Quest; a running quest timer shows as a
 * Resume chip above it.
 */
export function SystemDock() {
  const navigate = useNavigate();
  const location = useLocation();
  const anyModalOpen = useAnyModalOpen();
  const [systemOpen, setSystemOpen] = useState(false);
  const [noticeCount, setNoticeCount] = useState(0);
  const [quests, setQuests] = useState<number | 'claim' | null>(null);
  const [gatesDot, setGatesDot] = useState(false);
  const [penalty, setPenalty] = useState(false);
  const [unreadMessages, setUnreadMessages] = useState(0);
  const [timer, setTimer] = useState<ReturnType<typeof findRunningTimer>>(null);

  const refresh = useCallback(() => {
    setNoticeCount(getUnreadNotificationCount());
    try {
      setQuests(questBadge());
      setGatesDot(gatesNeedYou());
      setPenalty(Boolean(getActivePenaltyQuest()));
    } catch {
      // a badge must never break navigation
    }
    setTimer(findRunningTimer());
  }, []);

  useEffect(() => {
    refresh();
    const events = [NOTIFICATIONS_UPDATED_EVENT, QUESTS_UPDATED_EVENT, GATES_UPDATED_EVENT, PENALTY_UPDATED_EVENT, 'storage', 'focus'];
    events.forEach((e) => window.addEventListener(e, refresh));
    // Midnight unlocks and day changes have no event of their own.
    const t = window.setInterval(refresh, 30_000);
    return () => {
      events.forEach((e) => window.removeEventListener(e, refresh));
      window.clearInterval(t);
    };
  }, [refresh]);

  // Page changes can complete quests/tasks without an event reaching here first.
  useEffect(() => {
    refresh();
    setSystemOpen(false);
  }, [location.pathname, location.search, refresh]);

  // The Resume chip's clock ticks only while a timer is actually running.
  useEffect(() => {
    if (!timer) return;
    const t = window.setInterval(() => setTimer(findRunningTimer()), 1000);
    return () => window.clearInterval(t);
  }, [timer?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Unread Hunter messages: server-side, so polled lightly — once a minute while the app is
  // visible, when it comes back to the foreground, and when leaving Messages (reading clears it).
  const loadUnread = useCallback(async () => {
    const subject = localStorage.getItem(SESSION_SUBJECT_KEY);
    if (!subject || document.visibilityState !== 'visible') return;
    const s = await fetchUnreadSummary(subject.toUpperCase());
    setUnreadMessages(s.unreadCount || 0);
  }, []);
  useEffect(() => {
    loadUnread();
    const t = window.setInterval(loadUnread, 60_000);
    const onVisible = () => {
      if (document.visibilityState === 'visible') loadUnread();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.clearInterval(t);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [loadUnread]);
  const prevPath = useRef(location.pathname);
  useEffect(() => {
    if (prevPath.current === '/messages' && location.pathname !== '/messages') loadUnread();
    prevPath.current = location.pathname;
  }, [location.pathname, loadUnread]);

  useEffect(() => {
    if (!systemOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSystemOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [systemOpen]);

  if (location.pathname === '/login') return null;
  // A full-screen modal's backdrop is only ~80% opaque + blurred, so the bar would otherwise
  // still bleed through it. Simplest correct fix: don't render it while one is open.
  if (anyModalOpen) return null;

  const active = slotForLocation(location.pathname, location.search);
  const go = (to: string) => {
    systemSound.playClick();
    setSystemOpen(false);
    navigate(to);
  };
  const onQuestPage = timer && location.pathname === `/quest/${encodeURIComponent(timer.id)}`;

  const slots: Array<{ id: Slot; label: string; icon: typeof Bell; onClick: () => void; badge?: string; dot?: boolean }> = [
    { id: 'status', label: 'STATUS', icon: Activity, onClick: () => go('/') },
    {
      id: 'quests',
      label: 'QUESTS',
      icon: Swords,
      onClick: () => go('/?view=quests'),
      badge: quests === 'claim' ? '!' : quests ? String(quests) : undefined,
    },
    { id: 'gates', label: 'GATES', icon: DoorOpen, onClick: () => go('/?view=dungeons'), dot: gatesDot },
    {
      id: 'comms',
      label: 'COMMS',
      icon: MessageSquare,
      onClick: () => go('/messages'),
      badge: unreadMessages > 0 ? (unreadMessages > 9 ? '9+' : String(unreadMessages)) : undefined,
    },
    {
      id: 'system',
      label: 'SYSTEM',
      icon: LayoutGrid,
      onClick: () => {
        systemSound.playClick();
        setSystemOpen((v) => !v);
      },
      badge: noticeCount > 0 ? (noticeCount > 9 ? '9+' : String(noticeCount)) : undefined,
    },
  ];

  return (
    <>
      {systemOpen && <div className="fixed inset-0 z-40" aria-hidden="true" onClick={() => setSystemOpen(false)} />}
      <nav
        aria-label="System navigation"
        className="fixed bottom-0 left-0 right-0 z-50 flex flex-col items-center px-2 pt-2 pointer-events-none"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 0.4rem)' }}
      >
        {systemOpen && (
          <div
            role="menu"
            aria-label="System menu"
            className="pointer-events-auto mb-2 w-full max-w-[420px] grid grid-cols-3 gap-1.5 p-2 rounded-2xl border border-cyan-400/40 bg-[#061222]/95 backdrop-blur-md shadow-[0_0_24px_rgba(0,212,255,0.25)] font-mono anime-dropdown-safe"
          >
            {SYSTEM_ITEMS.map((item) => {
              const Icon = item.icon;
              const isHere =
                (item.to.startsWith('/?view=') && location.pathname === '/' && location.search === item.to.slice(1)) ||
                location.pathname === item.to;
              return (
                <button
                  key={item.id}
                  role="menuitem"
                  type="button"
                  onClick={() => go(item.to)}
                  className={`relative flex flex-col items-center gap-1 py-2.5 rounded-xl border text-[9px] tracking-wider transition-colors ${
                    isHere ? 'border-cyan-400/70 bg-cyan-950/60 text-white' : 'border-white/10 bg-black/30 text-white/70 hover:text-white hover:border-white/30'
                  }`}
                >
                  <Icon className="w-4 h-4 text-cyan-300" />
                  {item.label}
                  {item.id === 'notifications' && noticeCount > 0 && (
                    <span className="absolute top-1 right-2 min-w-[16px] h-4 px-1 rounded-full bg-rose-500 text-white text-[9px] font-bold flex items-center justify-center">
                      {noticeCount > 9 ? '9+' : noticeCount}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}

        {timer && !onQuestPage && !systemOpen && (
          <button
            type="button"
            onClick={() => go(`/quest/${encodeURIComponent(timer.id)}`)}
            className="pointer-events-auto mb-1.5 flex items-center gap-1.5 px-3 py-1 rounded-full border border-emerald-400/60 bg-emerald-950/80 text-emerald-200 text-[10px] font-mono shadow-[0_0_12px_rgba(16,185,129,0.4)] animate-pulse max-w-[90vw]"
          >
            <Play className="w-3 h-3 shrink-0" />
            <span className="truncate">RESUME · {timer.title}</span>
            <span className="font-bold tabular-nums">{formatElapsed(timer.elapsedSec)}</span>
          </button>
        )}

        <div
          className={`pointer-events-auto w-full max-w-[420px] grid grid-cols-5 rounded-2xl border bg-[#061222]/92 backdrop-blur-md font-mono transition-shadow ${
            penalty
              ? 'border-rose-500/80 shadow-[0_0_18px_rgba(244,63,94,0.55)]'
              : 'border-white/20 shadow-[0_0_20px_rgba(0,0,0,0.8)]'
          }`}
          data-penalty={penalty ? 'true' : undefined}
        >
          {slots.map((s) => {
            const Icon = s.id === 'system' && systemOpen ? X : s.icon;
            const isActive = s.id === 'system' ? systemOpen || active === 'system' : active === s.id && !systemOpen;
            return (
              <button
                key={s.id}
                type="button"
                onClick={s.onClick}
                aria-label={s.badge ? `${s.label} (${s.badge === '!' ? 'reward ready' : s.badge})` : s.label}
                aria-current={active === s.id ? 'page' : undefined}
                aria-expanded={s.id === 'system' ? systemOpen : undefined}
                className={`relative flex flex-col items-center justify-center gap-0.5 py-1.5 text-[9px] tracking-wider transition-colors ${
                  isActive ? 'text-white' : 'text-white/55 hover:text-white'
                }`}
              >
                <span className="relative">
                  <Icon className={`w-[18px] h-[18px] ${isActive ? 'text-cyan-300 drop-shadow-[0_0_6px_rgba(0,212,255,0.8)]' : ''}`} />
                  {s.badge && (
                    <span
                      className={`absolute -top-1.5 -right-2.5 min-w-[15px] h-[15px] px-1 rounded-full text-white text-[8px] font-bold flex items-center justify-center ${
                        s.badge === '!' ? 'bg-amber-500 shadow-[0_0_6px_rgba(245,158,11,0.8)]' : 'bg-rose-500 shadow-[0_0_6px_rgba(244,63,94,0.7)]'
                      }`}
                    >
                      {s.badge}
                    </span>
                  )}
                  {!s.badge && s.dot && (
                    <span className="absolute -top-0.5 -right-1 w-2 h-2 rounded-full bg-cyan-300 shadow-[0_0_6px_rgba(0,212,255,0.9)]" />
                  )}
                </span>
                <span className={isActive ? 'font-bold' : ''}>{s.label}</span>
                {isActive && <span className="absolute bottom-0.5 h-[2px] w-6 rounded-full bg-cyan-300 shadow-[0_0_6px_rgba(0,212,255,0.9)]" />}
              </button>
            );
          })}
        </div>
      </nav>
    </>
  );
}
