import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { SoloStatusWindow } from '@/components/SoloStatusWindow';
import { SoloDailyQuestWindow } from '@/components/SoloDailyQuestWindow';
import { SoloNotificationWindow } from '@/components/SoloNotificationWindow';
import { getUserProfile } from '@/lib/storage';
import { UserProfile } from '@/lib/types';
import { systemSound } from '@/lib/system-sound';
import { useAuth } from '@/contexts/AuthContext';
import {
  Sparkles,
  Sword,
  Brain,
  Dumbbell,
  Users,
  TestTube,
  Crown,
  Target,
  Trophy,
  Calendar,
  LogOut,
  ChevronRight,
  Bell,
  ArrowLeft,
} from 'lucide-react';

export default function Dashboard() {
  const navigate = useNavigate();
  const { signOut } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [activeView, setActiveView] = useState<'status' | 'quests' | 'notifications' | 'dungeons' | 'records'>('status');

  useEffect(() => {
    const syncProfile = () => {
      setProfile(getUserProfile());
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

  if (!profile) return null;

  const dungeons = [
    {
      title: 'Physical Conditioning Gate',
      desc: 'High-gravity kinetic resistance zone for push-ups, squats, and running.',
      path: '/physical-lab',
      rank: 'E-Rank',
      icon: Dumbbell,
    },
    {
      title: 'Cognitive Trial Chamber',
      desc: 'Stroop color clashes, working memory, and mental calculation drills.',
      path: '/mental-lab',
      rank: 'D-Rank',
      icon: Brain,
    },
    {
      title: 'Social Simulation Vault',
      desc: 'Interpersonal diplomacy, negotiation drills, and communication scenarios.',
      path: '/social-lab',
      rank: 'D-Rank',
      icon: Users,
    },
    {
      title: 'Knowledge & Concept Vault',
      desc: 'Domain mastery challenges across sciences, philosophy, and history.',
      path: '/knowledge-lab',
      rank: 'C-Rank',
      icon: TestTube,
    },
    {
      title: 'Strategic Chess Dungeon',
      desc: 'Grandmaster tactical endgames and spatial positional analysis.',
      path: '/chess-lab',
      rank: 'C-Rank',
      icon: Crown,
    },
    {
      title: 'Skill Tree Matrix (Kinnu Forge)',
      desc: 'Structured learning trees with spaced repetition mastery paths.',
      path: '/kinnu-lab',
      rank: 'D-Rank',
      icon: TestTube,
    },
    {
      title: 'Skill Forge Arena',
      desc: 'Custom skill crafting, technique mastery, and ability synthesis.',
      path: '/skill-forge',
      rank: 'B-Rank',
      icon: Target,
    },
  ];

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
      title: 'Hunter Dossier & Titles',
      tag: 'PROFILE',
      desc: 'Awakened rank designations, hunter class evolution, titles, and combat bio.',
      path: '/profile',
      icon: Crown,
    },
    {
      title: 'Feats & System Trophies',
      tag: 'ACHIEVEMENTS',
      desc: 'Milestone rewards, persistent accolades, and completed hunter breakthroughs.',
      path: '/achievements',
      icon: Trophy,
    },
    {
      title: 'Combat & Performance Analytics',
      tag: 'ANALYTICS',
      desc: 'Long-term attribute progression graphs, XP trajectory, and radar stat balance.',
      path: '/analytics',
      icon: Sparkles,
    },
    {
      title: 'Awakened Raid Challenges',
      tag: 'CHALLENGES',
      desc: 'High-difficulty penalty trials, time-limited raid contracts, and bonus missions.',
      path: '/challenges',
      icon: Target,
    },
  ];

  const handleLogout = async () => {
    systemSound.playClick();
    await signOut();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-[#071322] text-[#e5ecf4] flex flex-col justify-between p-3 sm:p-6 md:p-8 system-blueprint-bg">
      {/* Top Header shown when in subviews to easily navigate back to Status */}
      {activeView !== 'status' && (
        <header className="max-w-4xl mx-auto w-full flex items-center justify-between gap-4 border-b border-cyan-500/25 pb-3 mb-6">
          <button
            onClick={() => {
              systemSound.playClick();
              setActiveView('status');
            }}
            className="flex items-center gap-2 px-3 py-1.5 border border-cyan-400/50 bg-[#061426]/80 text-cyan-200 text-xs font-mono hover:bg-cyan-950/40 hover:border-cyan-300 transition-all shadow-[0_0_10px_rgba(0,212,255,0.2)]"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>[ RETURN TO STATUS ]</span>
          </button>

          <div className="flex items-center gap-2 text-xs font-mono text-cyan-300/80">
            <span className="w-2 h-2 rounded-full bg-cyan-400 shadow-[0_0_8px_#52d2f6]" />
            <span>LV.{profile.level}</span>
            <span>[{profile.title || 'None'}]</span>
          </div>
        </header>
      )}

      {/* Main Content Area */}
      <main className="max-w-4xl mx-auto w-full flex-1 flex flex-col items-center justify-center py-4">
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
                [Select a gate to infiltrate]
              </p>
            </div>

            <div className="flex flex-col divide-y divide-white/10 border border-white/30 rounded-[2px]">
              {dungeons.map((dungeon, idx) => {
                const Icon = dungeon.icon;
                return (
                  <button
                    key={idx}
                    onClick={() => {
                      systemSound.playClick();
                      navigate(dungeon.path);
                    }}
                    className="flex items-center gap-3 px-3 py-2.5 sm:px-4 sm:py-3 text-left bg-[#061424]/60 hover:bg-white/10 transition-all group"
                  >
                    <Icon className="w-4 h-4 text-[#9fd3ff] shrink-0" />
                    <span className="flex-1 min-w-0 truncate text-xs sm:text-sm font-semibold text-white group-hover:text-[#9fd3ff]">
                      {dungeon.title}
                    </span>
                    <span className="text-[9px] sm:text-[10px] px-1.5 py-0.5 border border-white/40 text-white bg-black/50 shrink-0">
                      {dungeon.rank}
                    </span>
                    <ChevronRight className="w-3.5 h-3.5 text-[#9fd3ff] shrink-0 group-hover:translate-x-1 transition-transform" />
                  </button>
                );
              })}
            </div>
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
      </main>

      {/* Minimalist Floating Quick-Access Dock at the Bottom */}
      <nav aria-label="System View Selector" className="mt-4 flex justify-center pb-2">
        <div className="flex items-center gap-1 sm:gap-2 px-3 py-1.5 rounded-full border border-white/20 bg-[#061222]/85 backdrop-blur-md shadow-[0_0_20px_rgba(0,0,0,0.8)] text-xs font-mono">
          <button
            onClick={() => {
              systemSound.playClick();
              setActiveView('status');
            }}
            className={`px-3 py-1 rounded-full transition-all ${
              activeView === 'status'
                ? 'bg-white/20 text-white font-bold shadow-[0_0_10px_rgba(255,255,255,0.4)]'
                : 'text-white/60 hover:text-white'
            }`}
          >
            STATUS
          </button>
          <button
            onClick={() => {
              systemSound.playClick();
              setActiveView('quests');
            }}
            className={`px-3 py-1 rounded-full transition-all ${
              activeView === 'quests'
                ? 'bg-white/20 text-white font-bold shadow-[0_0_10px_rgba(255,255,255,0.4)]'
                : 'text-white/60 hover:text-white'
            }`}
          >
            DAILY QUEST
          </button>
          <button
            onClick={() => {
              systemSound.playClick();
              setActiveView('dungeons');
            }}
            className={`px-3 py-1 rounded-full transition-all ${
              activeView === 'dungeons'
                ? 'bg-white/20 text-white font-bold shadow-[0_0_10px_rgba(255,255,255,0.4)]'
                : 'text-white/60 hover:text-white'
            }`}
          >
            DUNGEONS
          </button>
          <button
            onClick={() => {
              systemSound.playClick();
              setActiveView('records');
            }}
            className={`px-3 py-1 rounded-full transition-all ${
              activeView === 'records'
                ? 'bg-white/20 text-white font-bold shadow-[0_0_10px_rgba(255,255,255,0.4)]'
                : 'text-white/60 hover:text-white'
            }`}
          >
            RECORDS
          </button>
          <button
            onClick={() => {
              systemSound.playClick();
              setActiveView('notifications');
            }}
            className={`px-3 py-1 rounded-full transition-all flex items-center gap-1.5 ${
              activeView === 'notifications'
                ? 'bg-white/20 text-white font-bold shadow-[0_0_10px_rgba(255,255,255,0.4)]'
                : 'text-white/60 hover:text-white'
            }`}
          >
            <Bell className="w-3 h-3 text-cyan-400" />
            <span>NOTICES</span>
          </button>
        </div>
      </nav>
    </div>
  );
}
