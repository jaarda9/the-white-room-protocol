import { useState, useEffect } from 'react';
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
import { getGates, checkAndApplyGateBreaches, syncActiveGateTasks, GATES_UPDATED_EVENT, type Gate } from '@/lib/gates';
import { checkAndAssignPendingPenalty } from '@/lib/penalty-system';
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
    | 'seals';
  const setActiveView = (view: string) => {
    if (view === 'status') setSearchParams({});
    else setSearchParams({ view });
  };

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
      }

      // Ambient "[SYSTEM]" notices for state that's otherwise invisible (fatigue, streaks,
      // approaching rank-ups) — each is deduped internally so it surfaces at most once.
      checkSystemEvents(p).forEach((evt, i) => {
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
    // One-time per mount: a missed mandatory day queues a marker in storage.ts (no HP hit
    // anymore); consumed here since generation may call the AI gateway, which storage.ts
    // must not depend on directly (same reasoning as the Gates breach check above).
    (async () => {
      const quest = await checkAndAssignPendingPenalty();
      if (quest) {
        setProfile(getUserProfile());
        systemSound.playPenaltyWarning();
        toast.warning(quest.title, {
          description:
            quest.kind === 'detox'
              ? 'A repeated slide has triggered a full Detox Protocol. Open Daily Quest to begin.'
              : quest.flavorText,
        });
      }
    })();
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

        {activeView === 'notifications' && (
          <SoloNotificationWindow
            onSelectDailyQuest={() => setActiveView('quests')}
          />
        )}

        {activeView === 'dungeons' && (
          <div className="relative max-w-md w-full mx-auto bg-[#0a1b2e]/90 border-2 border-white/50 rounded-[4px] p-4 sm:p-6 text-white shadow-[0_0_30px_rgba(0,0,0,0.85),inset_0_0_24px_rgba(0,212,255,0.08)] backdrop-blur-md anime-dropdown font-mono">
            <div className="text-center mb-4">
              <div className="inline-block px-6 sm:px-8 py-1 border border-white/70 bg-[#061426]/60 shadow-[0_0_14px_rgba(0,212,255,0.35)] mb-1.5">
                <h2 className="text-lg sm:text-xl font-mono font-bold text-white anime-glow-text tracking-[0.2em]">
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
                <h2 className="text-lg sm:text-xl font-mono font-bold text-white anime-glow-text tracking-[0.2em]">
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
                <h2 className="text-lg sm:text-xl font-mono font-bold text-white anime-glow-text tracking-[0.2em]">
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
