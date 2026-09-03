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
          />
        )}

        {activeView === 'notifications' && (
          <SoloNotificationWindow
            onSelectDailyQuest={() => setActiveView('quests')}
          />
        )}

        {activeView === 'dungeons' && (
          <div className="relative max-w-2xl w-full mx-auto bg-[#0a1b2e]/90 border-2 border-white/50 rounded-[4px] p-6 sm:p-8 text-white shadow-[0_0_30px_rgba(0,0,0,0.85),inset_0_0_24px_rgba(0,212,255,0.08)] backdrop-blur-md anime-dropdown font-mono space-y-5">
            <div className="text-center mb-4">
              <div className="inline-block px-8 py-1 border border-white/70 bg-[#061426]/60 shadow-[0_0_14px_rgba(0,212,255,0.35)] mb-2">
                <h2 className="text-xl sm:text-2xl font-mono font-bold text-white anime-glow-text tracking-[0.2em]">
                  DUNGEON GATES
                </h2>
              </div>
              <p className="text-xs font-mono text-white/80">
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
                    className="p-4 border border-white/45 bg-[#061424]/75 hover:border-white/80 hover:bg-white/10 cursor-pointer flex flex-col justify-between transition-all group shadow-[inset_0_0_14px_rgba(0,212,255,0.08)] rounded-[2px]"
                  >
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center gap-2">
                          <Icon className="w-4 h-4 text-[#9fd3ff]" />
                          <span className="font-semibold text-white text-xs group-hover:text-[#9fd3ff]">
                            {dungeon.title}
                          </span>
                        </div>
                        <span className="text-[10px] px-1.5 py-0.5 border border-white/40 text-white bg-black/50 shrink-0">
                          {dungeon.rank}
                        </span>
                      </div>
                      <div className="text-[11px] text-gray-300 leading-relaxed">{dungeon.desc}</div>
                    </div>
                    <div className="pt-2 mt-3 border-t border-white/20 flex items-center justify-between text-[10px] text-[#9fd3ff] font-bold">
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
          <div className="relative max-w-2xl w-full mx-auto bg-[#0a1b2e]/90 border-2 border-white/50 rounded-[4px] p-6 sm:p-8 text-white shadow-[0_0_30px_rgba(0,0,0,0.85),inset_0_0_24px_rgba(0,212,255,0.08)] backdrop-blur-md anime-dropdown font-mono space-y-5">
            <div className="text-center mb-4">
              <div className="inline-block px-8 py-1 border border-white/70 bg-[#061426]/60 shadow-[0_0_14px_rgba(0,212,255,0.35)] mb-2">
                <h2 className="text-xl sm:text-2xl font-mono font-bold text-white anime-glow-text tracking-[0.2em]">
                  SYSTEM ARCHIVES
                </h2>
              </div>
              <p className="text-xs font-mono text-white/80">
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
                    className="p-4 border border-white/45 bg-[#061424]/75 hover:border-white/80 hover:bg-white/10 cursor-pointer flex flex-col justify-between transition-all group shadow-[inset_0_0_14px_rgba(0,212,255,0.08)] rounded-[2px]"
                  >
                    <div>
                      <div className="flex items-center gap-2 mb-1.5">
                        <Icon className="w-4 h-4 text-[#9fd3ff]" />
                        <span className="font-semibold text-white text-xs group-hover:text-[#9fd3ff]">
                          {feat.title}
                        </span>
                      </div>
                      <div className="text-[11px] text-gray-300 leading-relaxed">{feat.desc}</div>
                    </div>
                    <div className="pt-2 mt-3 border-t border-white/20 flex items-center justify-between text-[10px] text-[#9fd3ff] font-bold">
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
            QUESTS
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
          <button
            onClick={() => {
              systemSound.playClick();
              setActiveView('features');
            }}
            className={`px-3 py-1 rounded-full transition-all ${
              activeView === 'features'
                ? 'bg-white/20 text-white font-bold shadow-[0_0_10px_rgba(255,255,255,0.4)]'
                : 'text-white/60 hover:text-white'
            }`}
          >
            ARCHIVES
          </button>
        </div>
      </nav>
    </div>
  );
}
