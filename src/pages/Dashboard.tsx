import { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { SoloStatusWindow } from '@/components/SoloStatusWindow';
import { SoloDailyQuestWindow } from '@/components/SoloDailyQuestWindow';
import { SoloNotificationWindow } from '@/components/SoloNotificationWindow';
import { getUserProfile } from '@/lib/storage';
import { syncManager } from '@/lib/sync-manager';
import { UserProfile } from '@/lib/types';
import { systemSound } from '@/lib/system-sound';
import { checkSystemEvents } from '@/lib/system-events';
import { checkRankAdvancement, type RankAdvancement } from '@/lib/rank-advancement';
import RankAdvancementCeremony from '@/components/RankAdvancementCeremony';
import GateCreationModal from '@/components/GateCreationModal';
import SealsPanel from '@/components/SealsPanel';
import SkillTreePanel from '@/components/SkillTreePanel';
import { getGates, checkAndApplyGateBreaches, syncActiveGateTasks, GATES_UPDATED_EVENT, type Gate } from '@/lib/gates';
import { checkAndAssignPendingPenalty } from '@/lib/penalty-system';
import { spawnNextChainGateIfDue } from '@/lib/chain-gates';
import { pushNotification } from '@/lib/notifications';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import {
  Sparkles,
  Sword,
  Crown,
  Trophy,
  Calendar,
  LogOut,
  MessageSquare,
  ChevronRight,
  ScrollText,
  DoorOpen,
  Plus,
  ShieldAlert,
  GitBranch,
} from 'lucide-react';

export default function Dashboard() {
  const navigate = useNavigate();
  const { signOut } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [rankAdvancement, setRankAdvancement] = useState<RankAdvancement | null>(null);
  const [gates, setGates] = useState<Gate[]>(() => getGates());
  const [gateModalOpen, setGateModalOpen] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();
  const activeView = (searchParams.get('view') || 'status') as
    | 'status'
    | 'quests'
    | 'notifications'
    | 'dungeons'
    | 'records'
    | 'seals'
    | 'skilltree';
  const setActiveView = (view: string) => {
    if (view === 'status') setSearchParams({});
    else setSearchParams({ view });
  };

  // Installed PWAs have no browser "reload" button, so if this device's local copy ever falls
  // behind (e.g. a change made on another device), there was previously no way to catch up
  // short of force-closing and reopening the whole app. This forces a real pull from the
  // server — not just a local re-read — at the two moments that matter most: the app coming
  // back to the foreground (the PWA equivalent of "reopening it"), and landing on Status or
  // Daily Quest specifically, since those are what most visibly go stale. A successful pull
  // dispatches 'wrp:profile-updated'/'wrp:quests-updated' internally (see sync-manager.ts's
  // restoreToLocalStorage), which the existing listeners below and in SoloDailyQuestWindow
  // already react to — no need to duplicate that handling here.
  const lastForcedSyncAtRef = useRef(0);
  const FORCE_SYNC_MIN_INTERVAL_MS = 15_000;
  const maybeForceSync = () => {
    const now = Date.now();
    if (now - lastForcedSyncAtRef.current < FORCE_SYNC_MIN_INTERVAL_MS) return;
    if (!syncManager.getUserId()) return;
    lastForcedSyncAtRef.current = now;
    // Push this device's own pending changes BEFORE pulling — a bare pull risks overwriting a
    // completion made moments ago that's still sitting in the 1200ms debounce window (e.g. the
    // player finishes a quest, then immediately checks Status) with older server data. Pushing
    // first means the pull can never come back staler than what's already on this device.
    syncManager
      .saveUserData()
      .catch((e) => console.warn('[Dashboard] Pre-refresh push failed (continuing to pull anyway):', e))
      .finally(() => {
        syncManager.loadUserData().catch((e) => console.warn('[Dashboard] Foreground refresh pull failed:', e));
      });
  };

  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') maybeForceSync();
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('focus', maybeForceSync);
    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('focus', maybeForceSync);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (activeView === 'status' || activeView === 'quests') {
      maybeForceSync();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeView]);

  // Skill Tree specifically: a large, deeply-nested Ledger (many skills, several tiers) takes
  // real synchronous time to lay out — enough that .anime-dropdown's CSS animation clock (which
  // starts ticking the instant the class is applied, not when the browser actually paints) can
  // burn through its early keyframes before the first paint ever happens. The wipe then looks
  // like it already finished — reproduced directly: an empty Ledger animates fine, a full one
  // doesn't. Fix: hold the view invisible (plain opacity-0, not the animation itself) for two
  // rAFs — guaranteeing the expensive layout has already completed — before applying
  // anime-dropdown, so the class is only ever added to an already-laid-out box. Two rAFs
  // (not one) is the standard reliable way to guarantee a real paint has happened in between;
  // a single rAF can still land before the browser's next paint in some cases.
  const [skillTreeAnimReady, setSkillTreeAnimReady] = useState(false);
  useEffect(() => {
    if (activeView !== 'skilltree') {
      setSkillTreeAnimReady(false);
      return;
    }
    let raf2 = 0;
    const raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => setSkillTreeAnimReady(true));
    });
    return () => {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
    };
  }, [activeView]);

  useEffect(() => {
    const syncProfile = () => {
      const p = getUserProfile();
      setProfile(p);

      // On a cold client (no cached local profile yet), getUserProfile() can momentarily
      // hand back a freshly-created default (Level 1) profile before the real cloud data
      // restores moments later. Evaluating rank-advancement / system-events against that
      // transient profile would poison their "last seen" markers with a bogus low value,
      // firing a false ceremony/notice once the real (much higher) profile lands right
      // after. Skip both until the restore settles — this effect re-runs automatically via
      // the wrp:profile-updated event once it does.
      if (syncManager.isInitialLoadPending()) return;

      // Full-screen ceremony the instant a Rank threshold is actually crossed — takes
      // priority over the ambient toasts below, which only warn one level in advance.
      const advancement = checkRankAdvancement(p);
      if (advancement) {
        setRankAdvancement(advancement);
        pushNotification({
          key: `rank-advancement-${advancement.rank}`,
          severity: 'milestone',
          title: `[ SYSTEM: RANK ${advancement.rank} ACHIEVED ]`,
          description: `You are now Rank ${advancement.rank} — ${advancement.job}, Level ${advancement.level}.`,
        });
      }

      // Ambient "[SYSTEM]" notices for state that's otherwise invisible (fatigue, streaks,
      // approaching rank-ups) — each is deduped internally so it surfaces at most once. Also
      // pushed into the persisted Notification Log so missing the toast doesn't mean missing
      // the notice entirely.
      checkSystemEvents(p).forEach((evt, i) => {
        pushNotification({
          key: `system-event-${evt.key}`,
          severity: evt.severity,
          title: evt.title,
          description: evt.description,
        });
        setTimeout(() => {
          if (evt.severity === 'critical') {
            systemSound.playPenaltyWarning();
            toast.warning(evt.title, { description: evt.description });
          } else if (evt.severity === 'milestone') {
            systemSound.playSystemChime();
            toast.success(evt.title, { description: evt.description });
          } else {
            systemSound.playSystemChime();
            toast.info(evt.title, { description: evt.description });
          }
        }, i * 900);
      });
    };

    syncProfile();

    window.addEventListener('wrp:profile-updated', syncProfile);
    window.addEventListener('wrp:quests-updated', syncProfile);
    window.addEventListener('storage', syncProfile);

    return () => {
      window.removeEventListener('wrp:profile-updated', syncProfile);
      window.removeEventListener('wrp:quests-updated', syncProfile);
      window.removeEventListener('storage', syncProfile);
    };
  }, []);

  useEffect(() => {
    // One-time per mount: any active Gate whose clock ran out gets marked breached here —
    // NOT inside syncGates below, since that also fires off the event this dispatches and
    // would otherwise re-run the check pointlessly on its own update.
    const newlyBreached = checkAndApplyGateBreaches();
    newlyBreached.forEach((g, i) => {
      pushNotification({
        key: `gate-breach-${g.id}`,
        severity: 'critical',
        title: '[ SYSTEM: GATE BREACH ]',
        description: `"${g.title}" was not cleared in time. -20% Fatigue, -12 HP. Logged permanently — it can still be cleared.`,
        route: `/gates/${g.id}`,
      });
      setTimeout(() => {
        systemSound.playPenaltyWarning();
        toast.warning('[ SYSTEM: GATE BREACH ]', {
          description: `"${g.title}" was not cleared in time. -20% Fatigue, -12 HP. Logged permanently — it can still be cleared.`,
        });
      }, i * 900);
    });

    const syncGates = () => setGates(getGates());
    syncGates();
    window.addEventListener(GATES_UPDATED_EVENT, syncGates);
    window.addEventListener('storage', syncGates);
    return () => {
      window.removeEventListener(GATES_UPDATED_EVENT, syncGates);
      window.removeEventListener('storage', syncGates);
    };
  }, []);

  useEffect(() => {
    // One-time per mount: schedules each active Gate's current unlocked task into Tactical
    // To-Dos automatically (no manual "schedule" step) and rolls a skipped one's due date
    // forward so it doesn't vanish from "today" — see syncActiveGateTasks in gates.ts. Also
    // runs from GateDetail.tsx's own mount, so a direct visit doesn't depend on this having
    // fired first.
    const newlyUnlocked = syncActiveGateTasks();
    newlyUnlocked.forEach((u, i) => {
      setTimeout(() => {
        systemSound.playSystemChime();
        toast.info(`[ ${u.gate.title.toUpperCase()} ]`, {
          description: `"${u.task.label}" is now active — scheduled in today's To-Dos.`,
        });
      }, i * 900);
    });
  }, []);

  useEffect(() => {
    // A missed mandatory day queues a marker in storage.ts (applyVitalsRegeneration, no HP hit
    // anymore) — consumed here since generation may call the AI gateway, which storage.ts must
    // not depend on directly (same reasoning as the Gates breach check above).
    //
    // NOT a one-time mount effect: applyVitalsRegeneration only runs inside getUserProfile()
    // once syncManager.isInitialLoadPending() is false, so right after switching subjects (a
    // fresh pull from the server takes real time) the marker may not exist yet the instant
    // Dashboard mounts. A pure `useEffect(..., [])` would check once, find nothing, and never
    // look again — the marker could get queued moments later (e.g. the next getUserProfile()
    // call once the restore settles) with nothing left to consume it into a visible Penalty
    // Quest. checkAndAssignPendingPenalty() is a safe no-op when nothing is pending (checked
    // first thing, before anything else), so re-running it on every profile update costs
    // nothing and closes that window.
    const checkPenalty = async () => {
      const quest = await checkAndAssignPendingPenalty();
      if (quest) {
        setProfile(getUserProfile());
        const description =
          quest.kind === 'detox'
            ? 'A repeated slide has triggered a full Detox Protocol. Open Daily Quest to begin.'
            : quest.flavorText;
        pushNotification({
          key: `penalty-quest-${quest.id}`,
          severity: 'critical',
          title: quest.title,
          description,
          route: '/?view=quests',
        });
        systemSound.playPenaltyWarning();
        toast.warning(quest.title, { description });
      }

      // THEIA chain-Gates (see chain-gates.ts) — same reasoning as the penalty check above:
      // generation calls the AI gateway, so it lives here, not in storage.ts, and re-running on
      // every profile update (rather than only on mount) closes the same "settled after mount"
      // race. spawnNextChainGateIfDue() is a safe no-op whenever a chain-Gate is already open
      // or the rest window hasn't elapsed, so this costs nothing on the common case. No
      // pause/opt-out — unconditional, by design.
      const chainGate = await spawnNextChainGateIfDue();
      if (chainGate) {
        setProfile(getUserProfile());
        pushNotification({
          key: `chain-gate-${chainGate.id}`,
          severity: 'milestone',
          title: `[ SYSTEM: DIRECTIVE ASSIGNED ]`,
          description: `${chainGate.title} — ${chainGate.chainDurationDays} days, Rank ${chainGate.rank}.`,
          route: `/gates/${chainGate.id}`,
        });
        systemSound.playSystemChime();
        toast.info(`[ SYSTEM: DIRECTIVE ASSIGNED ]`, { description: chainGate.title });
      }
    };

    checkPenalty();

    window.addEventListener('wrp:profile-updated', checkPenalty);
    window.addEventListener('storage', checkPenalty);
    return () => {
      window.removeEventListener('wrp:profile-updated', checkPenalty);
      window.removeEventListener('storage', checkPenalty);
    };
  }, []);

  if (!profile) return null;

  const hunterRecords = [
    {
      title: 'Global Hunter Rankings',
      tag: 'LEADERBOARD',
      desc: 'Real-time hunter ranking hierarchy, sovereign standing, and global tier leaderboard.',
      path: '/leaderboard',
      icon: Sword,
    },
    {
      title: 'Mission & Calendar Logs',
      tag: 'ACTIVITY LOGS',
      desc: 'Comprehensive daily activity logs, training history, and protocol completion streaks.',
      path: '/calendar',
      icon: Calendar,
    },
    {
      title: 'Hunter Dossier & Combat Analytics',
      tag: 'DOSSIER & ANALYTICS',
      desc: 'Awakened rank designations, hunter titles, attribute profile matrix, and combat telemetry.',
      path: '/profile',
      icon: Crown,
    },
    {
      title: 'Hunter Codex',
      tag: 'MONTHLY CHRONICLE',
      desc: "THEIA's monthly System Archive — a narrated recap of your EXP, streaks, and unlocked feats.",
      path: '/codex',
      icon: ScrollText,
    },
    {
      title: 'Feats, Trophies & Awakened Raids',
      tag: 'FEATS & RAIDS',
      desc: 'Milestone rewards, persistent trophies, time-limited raid operations, and bonus bounties.',
      path: '/achievements',
      icon: Trophy,
    },
    {
      title: 'Hunter Comms Channel',
      tag: 'MESSAGES',
      desc: 'Encrypted hunter-to-hunter transmissions and active conversation channels.',
      path: '/messages',
      icon: MessageSquare,
    },
  ];

  const handleLogout = async () => {
    systemSound.playClick();
    await signOut();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-[#071322] text-[#e5ecf4] flex flex-col justify-between px-3 sm:px-6 md:px-8 pt-8 sm:pt-14 md:pt-16 pb-36 sm:pb-40 system-blueprint-bg">

      {/* Main Content Area */}
      <main className="max-w-4xl mx-auto w-full flex-1 flex flex-col items-center justify-center my-auto py-6 sm:py-10">
        {activeView === 'status' && (
          <SoloStatusWindow
            profile={profile}
            onProfileUpdated={(updated) => setProfile(updated)}
            onOpenQuests={() => setActiveView('quests')}
            onLogout={handleLogout}
          />
        )}

        {activeView === 'quests' && (
          <SoloDailyQuestWindow
            profile={profile}
            onProfileUpdated={(updated) => setProfile(updated)}
            onReturnToStatus={() => setActiveView('status')}
          />
        )}

        {activeView === 'notifications' && <SoloNotificationWindow />}

        {activeView === 'dungeons' && (
          <div className="relative max-w-md w-full mx-auto bg-[#0a1b2e]/90 border-2 border-white/50 rounded-[4px] p-4 sm:p-6 text-white shadow-[0_0_30px_rgba(0,0,0,0.85),inset_0_0_24px_rgba(0,212,255,0.08)] backdrop-blur-md anime-dropdown font-mono">
            <div className="text-center mb-4">
              <div className="inline-block px-6 sm:px-8 py-1 border border-white/70 bg-[#061426]/60 shadow-[0_0_14px_rgba(0,212,255,0.35)] mb-1.5">
                <h2 className="text-lg sm:text-xl font-mono font-bold text-white anime-glow-text tracking-[0.2em] flex items-center justify-center gap-2">
                  <DoorOpen className="w-4 h-4 sm:w-5 sm:h-5 text-[#9fd3ff]" />
                  DUNGEON GATES
                </h2>
              </div>
              <p className="text-[10px] sm:text-xs font-mono text-white/70">
                {gates.length > 0
                  ? `[${gates.filter((g) => g.status === 'active').length} active campaign(s)]`
                  : '[No Gates declared]'}
              </p>
            </div>

            {gates.length > 0 ? (
              <div className="flex flex-col divide-y divide-white/10 border border-white/30 rounded-[2px] mb-3">
                {gates.map((gate) => {
                  const done = gate.milestones.filter((m) => m.completed).length;
                  const total = gate.milestones.length;
                  return (
                    <button
                      key={gate.id}
                      onClick={() => {
                        systemSound.playClick();
                        navigate(`/gates/${gate.id}`);
                      }}
                      className="flex items-center gap-3 px-3 py-2.5 sm:px-4 sm:py-3 text-left bg-[#061424]/60 hover:bg-white/10 transition-all group"
                    >
                      <DoorOpen className="w-4 h-4 text-[#9fd3ff] shrink-0" />
                      <span className="flex-1 min-w-0 truncate text-xs sm:text-sm font-semibold text-white group-hover:text-[#9fd3ff]">
                        {gate.title}
                      </span>
                      {gate.status === 'cleared' ? (
                        <span className="text-[9px] sm:text-[10px] px-1.5 py-0.5 border border-emerald-500/50 text-emerald-300 bg-emerald-950/40 shrink-0">
                          CLEARED
                        </span>
                      ) : gate.status === 'breached' ? (
                        <span className="text-[9px] sm:text-[10px] px-1.5 py-0.5 border border-rose-500/50 text-rose-300 bg-rose-950/40 shrink-0">
                          BREACHED
                        </span>
                      ) : (
                        <span className="text-[9px] sm:text-[10px] px-1.5 py-0.5 border border-white/40 text-white bg-black/50 shrink-0">
                          {total > 0 ? `${done}/${total}` : `RANK ${gate.rank}`}
                        </span>
                      )}
                      <ChevronRight className="w-3.5 h-3.5 text-[#9fd3ff] shrink-0 group-hover:translate-x-1 transition-transform" />
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="border border-white/30 bg-[#061424]/80 rounded-[2px] p-6 text-center space-y-4 shadow-[inset_0_0_14px_rgba(0,212,255,0.06)] mb-3">
                <div className="w-12 h-12 mx-auto border border-cyan-400/40 bg-cyan-950/40 rounded-[2px] flex items-center justify-center text-cyan-300 shadow-[0_0_15px_rgba(0,212,255,0.25)] relative">
                  <DoorOpen className="w-6 h-6 animate-pulse" />
                </div>

                <div className="space-y-1.5">
                  <div className="text-xs sm:text-sm font-bold tracking-widest text-cyan-300 font-mono anime-glow-text">
                    [ NO GATES DETECTED ]
                  </div>
                  <div className="text-sm font-bold text-white font-mono tracking-wide">
                    Gates are not found. They are opened.
                  </div>
                </div>

                <div className="p-3.5 border border-white/10 bg-black/40 rounded-[2px] text-xs text-gray-300 leading-relaxed text-left space-y-2">
                  <div className="text-cyan-400 font-bold text-[10px] tracking-wider flex items-center gap-1.5">
                    <Sparkles className="w-3 h-3 text-cyan-400" />
                    <span>SYSTEM DIRECTIVE:</span>
                  </div>
                  <p className="text-[11px] sm:text-xs text-gray-300 leading-relaxed">
                    A Gate is a campaign of your own declaration — a real goal spanning weeks or months, broken into waves with a defined boss condition. Declare one to begin, or continue focusing on your Daily Quests.
                  </p>
                </div>
              </div>
            )}

            <button
              type="button"
              onClick={() => {
                systemSound.playClick();
                setGateModalOpen(true);
              }}
              className="w-full py-2.5 border-2 border-cyan-400 bg-cyan-950/80 hover:bg-cyan-900 text-cyan-300 hover:text-white rounded-[2px] text-xs font-bold tracking-widest transition-all shadow-[0_0_14px_rgba(0,212,255,0.4)] flex items-center justify-center gap-2"
            >
              <Plus className="w-4 h-4" />
              [ DECLARE NEW GATE ]
            </button>
          </div>
        )}

        {activeView === 'records' && (
          <div className="relative max-w-md w-full mx-auto bg-[#0a1b2e]/90 border-2 border-white/50 rounded-[4px] p-4 sm:p-6 text-white shadow-[0_0_30px_rgba(0,0,0,0.85),inset_0_0_24px_rgba(0,212,255,0.08)] backdrop-blur-md anime-dropdown font-mono">
            <div className="text-center mb-4">
              <div className="inline-block px-6 sm:px-8 py-1 border border-white/70 bg-[#061426]/60 shadow-[0_0_14px_rgba(0,212,255,0.35)] mb-1.5">
                <h2 className="text-lg sm:text-xl font-mono font-bold text-white anime-glow-text tracking-[0.2em] flex items-center justify-center gap-2">
                  <Trophy className="w-4 h-4 sm:w-5 sm:h-5 text-[#9fd3ff]" />
                  HUNTER RECORDS
                </h2>
              </div>
              <p className="text-[10px] sm:text-xs font-mono text-white/70">
                [Rankings, logs, accolades & telemetry]
              </p>
            </div>

            <div className="flex flex-col divide-y divide-white/10 border border-white/30 rounded-[2px]">
              {hunterRecords.map((feat, idx) => {
                const Icon = feat.icon;
                return (
                  <button
                    key={idx}
                    onClick={() => {
                      systemSound.playClick();
                      navigate(feat.path);
                    }}
                    className="flex items-center gap-3 px-3 py-2.5 sm:px-4 sm:py-3 text-left bg-[#061424]/60 hover:bg-white/10 transition-all group"
                  >
                    <Icon className="w-4 h-4 text-[#9fd3ff] shrink-0" />
                    <span className="flex-1 min-w-0 truncate text-xs sm:text-sm font-semibold text-white group-hover:text-[#9fd3ff]">
                      {feat.title}
                    </span>
                    <span className="hidden xs:inline text-[9px] sm:text-[10px] px-1.5 py-0.5 border border-white/30 text-[#9fd3ff] bg-black/50 shrink-0">
                      {feat.tag}
                    </span>
                    <ChevronRight className="w-3.5 h-3.5 text-[#9fd3ff] shrink-0 group-hover:translate-x-1 transition-transform" />
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {activeView === 'seals' && (
          <div className="relative max-w-md w-full mx-auto bg-[#0a1b2e]/90 border-2 border-white/50 rounded-[4px] p-4 sm:p-6 text-white shadow-[0_0_30px_rgba(0,0,0,0.85),inset_0_0_24px_rgba(0,212,255,0.08)] backdrop-blur-md anime-dropdown font-mono">
            <div className="text-center mb-4">
              <div className="inline-block px-6 sm:px-8 py-1 border border-white/70 bg-[#061426]/60 shadow-[0_0_14px_rgba(0,212,255,0.35)] mb-1.5">
                <h2 className="text-lg sm:text-xl font-mono font-bold text-white anime-glow-text tracking-[0.2em] flex items-center justify-center gap-2">
                  <ShieldAlert className="w-4 h-4 sm:w-5 sm:h-5 text-[#9fd3ff]" />
                  SEALS
                </h2>
              </div>
              <p className="text-[10px] sm:text-xs font-mono text-white/70">
                [Weakness suppression — non-punishing, THEIA-assessed]
              </p>
            </div>

            <SealsPanel />
          </div>
        )}

        {activeView === 'skilltree' && (
          <div
            className={`relative max-w-md w-full mx-auto bg-[#0a1b2e]/90 border-2 border-white/50 rounded-[4px] p-4 sm:p-6 text-white shadow-[0_0_30px_rgba(0,0,0,0.85),inset_0_0_24px_rgba(0,212,255,0.08)] backdrop-blur-md font-mono ${
              skillTreeAnimReady ? 'anime-dropdown' : 'opacity-0'
            }`}
          >
            <div className="text-center mb-4">
              <div className="inline-block px-6 sm:px-8 py-1 border border-white/70 bg-[#061426]/60 shadow-[0_0_14px_rgba(0,212,255,0.35)] mb-1.5">
                <h2 className="text-lg sm:text-xl font-mono font-bold text-white anime-glow-text tracking-[0.2em] flex items-center justify-center gap-2">
                  <GitBranch className="w-4 h-4 sm:w-5 sm:h-5 text-[#9fd3ff]" />
                  SKILL TREE
                </h2>
              </div>
              <p className="text-[10px] sm:text-xs font-mono text-white/70">
                [THEIA's record of everything trained through Directives]
              </p>
            </div>

            <SkillTreePanel />
          </div>
        )}
      </main>

      {rankAdvancement && (
        <RankAdvancementCeremony
          advancement={rankAdvancement}
          onDismiss={() => setRankAdvancement(null)}
        />
      )}

      <GateCreationModal
        isOpen={gateModalOpen}
        onClose={() => setGateModalOpen(false)}
        onCreated={(gate) => {
          setGateModalOpen(false);
          navigate(`/gates/${gate.id}`);
        }}
        profile={profile}
      />
    </div>
  );
}
