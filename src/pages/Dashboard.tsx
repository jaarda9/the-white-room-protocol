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
} from 'lucide-react';

export default function Dashboard() {
  const navigate = useNavigate();
  const { signOut } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [activeView, setActiveView] = useState<'status' | 'quests' | 'notifications' | 'dungeons' | 'features'>('status');

  useEffect(() => {
    setProfile(getUserProfile());
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

  const systemFeatures = [
    {
      title: 'Hunter Dossier & Titles',
      desc: 'View unlocked rank designations, awakened titles, and player dossier.',
      path: '/profile',
      icon: Crown,
    },
    {
      title: 'Feats & Achievements',
      desc: 'System trophies, milestone rewards, and persistent hunter accolades.',
      path: '/achievements',
      icon: Trophy,
    },
    {
      title: 'Global Hunter Rankings',
      desc: 'Real-time hunter ranking hierarchy and global leaderboard standings.',
      path: '/leaderboard',
      icon: Sword,
    },
    {
      title: 'Mission & Calendar Logs',
      desc: 'Comprehensive activity logs, completed trial history, and training schedules.',
      path: '/calendar',
      icon: Calendar,
    },
    {
      title: 'Performance Analytics',
      desc: 'Long-term attribute progression graphs, XP trajectory, and radar stats.',
      path: '/analytics',
      icon: Sparkles,
    },
    {
      title: 'Special Challenges',
      desc: 'Time-limited raid contracts, penalty trials, and awakened quests.',
      path: '/challenges',
      icon: Target,
    },
  ];

  return (
    <div className="min-h-screen bg-[#040812] text-[#e5ecf4] flex flex-col justify-between p-3 sm:p-6 md:p-8 system-blueprint-bg">
      {/* Top Authentic System HUD Bar */}
      <header className="max-w-4xl mx-auto w-full flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-cyan-500/25 pb-4 mb-6 sm:mb-8">
        <div className="flex items-center gap-3">
          <div className="w-2.5 h-2.5 rounded-full bg-cyan-400 shadow-[0_0_10px_#52d2f6]" />
          <h1 className="font-mono font-bold text-lg sm:text-xl text-white tracking-[0.2em] anime-glow-text">
            THE SYSTEM
          </h1>
          <span className="text-[11px] font-mono px-2 py-0.5 border border-cyan-400/50 text-cyan-200 bg-black/60 shadow-[0_0_8px_rgba(82,210,246,0.2)]">
            LV.{profile.level}
          </span>
          <span className="text-[11px] font-mono text-cyan-400/80 hidden sm:inline">
            [{profile.title || 'Wolf Assassin'}]
          </span>
        </div>

        {/* Navigation Tabs corresponding to System Windows */}
        <div className="flex items-center gap-1 sm:gap-2 flex-wrap">
          <button
            onClick={() => {
              systemSound.playClick();
              setActiveView('status');
            }}
            className={`px-3 py-1.5 text-xs font-mono border transition-all ${
              activeView === 'status'
                ? 'border-cyan-400 bg-cyan-400/20 text-cyan-200 shadow-[0_0_12px_rgba(82,210,246,0.4)]'
                : 'border-cyan-500/20 text-gray-400 hover:text-white hover:border-cyan-500/50 bg-black/40'
            }`}
          >
            STATUS
          </button>
          <button
            onClick={() => {
              systemSound.playClick();
              setActiveView('quests');
            }}
            className={`px-3 py-1.5 text-xs font-mono border transition-all ${
              activeView === 'quests'
                ? 'border-cyan-400 bg-cyan-400/20 text-cyan-200 shadow-[0_0_12px_rgba(82,210,246,0.4)]'
                : 'border-cyan-500/20 text-gray-400 hover:text-white hover:border-cyan-500/50 bg-black/40'
            }`}
          >
            QUEST INFO
          </button>
          <button
            onClick={() => {
              systemSound.playClick();
              setActiveView('notifications');
            }}
            className={`px-3 py-1.5 text-xs font-mono border transition-all flex items-center gap-1.5 ${
              activeView === 'notifications'
                ? 'border-cyan-400 bg-cyan-400/20 text-cyan-200 shadow-[0_0_12px_rgba(82,210,246,0.4)]'
                : 'border-cyan-500/20 text-gray-400 hover:text-white hover:border-cyan-500/50 bg-black/40'
            }`}
          >
            <Bell className="w-3 h-3 text-cyan-400" />
            <span>NOTIFICATION</span>
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-300 shadow-[0_0_6px_#52d2f6]" />
          </button>
          <button
            onClick={() => {
              systemSound.playClick();
              setActiveView('dungeons');
            }}
            className={`px-3 py-1.5 text-xs font-mono border transition-all ${
              activeView === 'dungeons'
                ? 'border-cyan-400 bg-cyan-400/20 text-cyan-200 shadow-[0_0_12px_rgba(82,210,246,0.4)]'
                : 'border-cyan-500/20 text-gray-400 hover:text-white hover:border-cyan-500/50 bg-black/40'
            }`}
          >
            DUNGEONS
          </button>
          <button
            onClick={() => {
              systemSound.playClick();
              setActiveView('features');
            }}
            className={`px-3 py-1.5 text-xs font-mono border transition-all ${
              activeView === 'features'
                ? 'border-cyan-400 bg-cyan-400/20 text-cyan-200 shadow-[0_0_12px_rgba(82,210,246,0.4)]'
                : 'border-cyan-500/20 text-gray-400 hover:text-white hover:border-cyan-500/50 bg-black/40'
            }`}
          >
            SYSTEM ARCHIVES
          </button>
          <button
            onClick={async () => {
              systemSound.playClick();
              await signOut();
              navigate('/login');
            }}
            className="p-1.5 text-gray-400 hover:text-red-400 transition-colors ml-2"
            title="Disconnect"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Main Single-Window Content based on screenshots */}
      <main className="max-w-4xl mx-auto w-full flex-1 flex flex-col items-center justify-center">
        {activeView === 'status' && (
          <SoloStatusWindow
            profile={profile}
            onProfileUpdated={(updated) => setProfile(updated)}
          />
        )}

        {activeView === 'quests' && (
          <SoloDailyQuestWindow
            profile={profile}
            onProfileUpdated={(updated) => setProfile(updated)}
          />
        )}

        {activeView === 'notifications' && (
          <SoloNotificationWindow
            onSelectDailyQuest={() => setActiveView('quests')}
          />
        )}

        {activeView === 'dungeons' && (
          <div className="anime-window system-blueprint-bg system-window-corners p-6 sm:p-8 max-w-2xl mx-auto w-full space-y-4">
            <div className="corner-ticks" />
            <div className="text-center mb-6">
              <div className="inline-block px-8 py-1 border border-cyan-400/80 bg-black/60 shadow-[0_0_12px_rgba(82,210,246,0.3)] mb-2">
                <h2 className="text-xl sm:text-2xl font-mono font-bold text-white anime-glow-text tracking-[0.2em]">
                  DUNGEON GATES
                </h2>
              </div>
              <p className="text-xs font-mono text-cyan-300/80">
                [Select an awakened gate to initiate instance infiltration]
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 font-mono text-sm">
              {dungeons.map((dungeon, idx) => {
                const Icon = dungeon.icon;
                return (
                  <div
                    key={idx}
                    onClick={() => {
                      systemSound.playClick();
                      navigate(dungeon.path);
                    }}
                    className="p-3.5 border border-cyan-500/30 bg-black/60 hover:border-cyan-400 hover:bg-cyan-500/10 cursor-pointer flex flex-col justify-between transition-all group shadow-[0_0_10px_rgba(0,0,0,0.5)]"
                  >
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center gap-2">
                          <Icon className="w-4 h-4 text-cyan-300" />
                          <span className="font-semibold text-white text-xs group-hover:text-cyan-200">
                            {dungeon.title}
                          </span>
                        </div>
                        <span className="text-[10px] px-1.5 py-0.5 border border-cyan-400/50 text-cyan-200 bg-black/50 shrink-0">
                          {dungeon.rank}
                        </span>
                      </div>
                      <div className="text-[11px] text-gray-400 leading-relaxed">{dungeon.desc}</div>
                    </div>
                    <div className="pt-2 mt-2 border-t border-cyan-500/15 flex items-center justify-between text-[10px] text-cyan-400/90 font-bold">
                      <span>ENTER GATE</span>
                      <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {activeView === 'features' && (
          <div className="anime-window system-blueprint-bg system-window-corners p-6 sm:p-8 max-w-2xl mx-auto w-full space-y-4">
            <div className="corner-ticks" />
            <div className="text-center mb-6">
              <div className="inline-block px-8 py-1 border border-cyan-400/80 bg-black/60 shadow-[0_0_12px_rgba(82,210,246,0.3)] mb-2">
                <h2 className="text-xl sm:text-2xl font-mono font-bold text-white anime-glow-text tracking-[0.2em]">
                  SYSTEM ARCHIVES
                </h2>
              </div>
              <p className="text-xs font-mono text-cyan-300/80">
                [Hunter dossier, rankings, trophies, and historical performance]
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 font-mono text-sm">
              {systemFeatures.map((feat, idx) => {
                const Icon = feat.icon;
                return (
                  <div
                    key={idx}
                    onClick={() => {
                      systemSound.playClick();
                      navigate(feat.path);
                    }}
                    className="p-3.5 border border-cyan-500/30 bg-black/60 hover:border-cyan-400 hover:bg-cyan-500/10 cursor-pointer flex flex-col justify-between transition-all group shadow-[0_0_10px_rgba(0,0,0,0.5)]"
                  >
                    <div>
                      <div className="flex items-center gap-2 mb-1.5">
                        <Icon className="w-4 h-4 text-cyan-300" />
                        <span className="font-semibold text-white text-xs group-hover:text-cyan-200">
                          {feat.title}
                        </span>
                      </div>
                      <div className="text-[11px] text-gray-400 leading-relaxed">{feat.desc}</div>
                    </div>
                    <div className="pt-2 mt-2 border-t border-cyan-500/15 flex items-center justify-between text-[10px] text-cyan-400/90 font-bold">
                      <span>ACCESS MODULE</span>
                      <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </main>

      {/* Clean System Footer */}
      <footer className="max-w-4xl mx-auto w-full text-center font-mono text-[11px] text-gray-500 pt-6">
        <span>THE SYSTEM — PLAYER: {profile.displayName || 'Sung Jin-woo'} • RANK: {profile.hunterRank || 'E'} • TITLE: {profile.title || 'Wolf Assassin'}</span>
      </footer>
    </div>
  );
}
