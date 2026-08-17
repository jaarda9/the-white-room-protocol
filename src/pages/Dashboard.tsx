import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { SoloStatusWindow } from '@/components/SoloStatusWindow';
import { SoloDailyQuestWindow } from '@/components/SoloDailyQuestWindow';
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
} from 'lucide-react';

export default function Dashboard() {
  const navigate = useNavigate();
  const { signOut } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [activeView, setActiveView] = useState<'status' | 'quests' | 'dungeons' | 'features'>('status');

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
    <div className="min-h-screen bg-[#070d18] text-[#e5ecf4] flex flex-col justify-between p-4 sm:p-8">
      {/* Clean Minimalist Top System Bar */}
      <header className="max-w-4xl mx-auto w-full flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-cyan-500/20 pb-4 mb-8">
        <div className="flex items-center gap-3">
          <div className="w-2.5 h-2.5 rounded-full bg-cyan-400 shadow-[0_0_8px_#52d2f6]" />
          <h1 className="font-display font-bold text-lg sm:text-xl text-white tracking-widest anime-glow-text">
            THE SYSTEM
          </h1>
          <span className="text-[10px] font-mono px-1.5 py-0.5 border border-cyan-500/40 text-cyan-300 bg-cyan-950/30">
            LV.{profile.level}
          </span>
        </div>

        {/* Minimal Navigation Buttons */}
        <div className="flex items-center gap-1 sm:gap-2 flex-wrap">
          <button
            onClick={() => {
              systemSound.playClick();
              setActiveView('status');
            }}
            className={`px-3 py-1.5 text-xs font-mono border transition-all ${
              activeView === 'status'
                ? 'border-cyan-400 bg-cyan-400/20 text-cyan-300 shadow-[0_0_10px_rgba(82,210,246,0.3)]'
                : 'border-transparent text-gray-400 hover:text-white hover:border-gray-700'
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
                ? 'border-cyan-400 bg-cyan-400/20 text-cyan-300 shadow-[0_0_10px_rgba(82,210,246,0.3)]'
                : 'border-transparent text-gray-400 hover:text-white hover:border-gray-700'
            }`}
          >
            DAILY QUESTS
          </button>
          <button
            onClick={() => {
              systemSound.playClick();
              setActiveView('dungeons');
            }}
            className={`px-3 py-1.5 text-xs font-mono border transition-all ${
              activeView === 'dungeons'
                ? 'border-cyan-400 bg-cyan-400/20 text-cyan-300 shadow-[0_0_10px_rgba(82,210,246,0.3)]'
                : 'border-transparent text-gray-400 hover:text-white hover:border-gray-700'
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
                ? 'border-cyan-400 bg-cyan-400/20 text-cyan-300 shadow-[0_0_10px_rgba(82,210,246,0.3)]'
                : 'border-transparent text-gray-400 hover:text-white hover:border-gray-700'
            }`}
          >
            SYSTEM MODULES
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

        {activeView === 'dungeons' && (
          <div className="anime-window p-6 sm:p-8 max-w-2xl mx-auto w-full space-y-4">
            <div className="text-center mb-6">
              <h2 className="text-xl sm:text-2xl font-display font-bold text-white anime-glow-text">
                DUNGEON GATES
              </h2>
              <p className="text-xs font-mono text-gray-400 mt-1">
                Select a training dungeon to initiate instant instance infiltration.
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
                    className="p-3.5 border border-cyan-500/20 bg-black/40 hover:border-cyan-400 hover:bg-cyan-500/10 cursor-pointer flex flex-col justify-between transition-all group"
                  >
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center gap-2">
                          <Icon className="w-4 h-4 text-cyan-400" />
                          <span className="font-semibold text-white text-xs group-hover:text-cyan-300">
                            {dungeon.title}
                          </span>
                        </div>
                        <span className="text-[10px] px-1.5 py-0.2 border border-cyan-500/40 text-cyan-300 shrink-0">
                          {dungeon.rank}
                        </span>
                      </div>
                      <div className="text-[11px] text-gray-400 leading-relaxed">{dungeon.desc}</div>
                    </div>
                    <div className="pt-2 mt-2 border-t border-cyan-500/10 flex items-center justify-between text-[10px] text-cyan-400/80">
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
          <div className="anime-window p-6 sm:p-8 max-w-2xl mx-auto w-full space-y-4">
            <div className="text-center mb-6">
              <h2 className="text-xl sm:text-2xl font-display font-bold text-white anime-glow-text">
                SYSTEM MODULES & ARCHIVES
              </h2>
              <p className="text-xs font-mono text-gray-400 mt-1">
                Access your hunter records, achievements, global leaderboards, and logs.
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
                    className="p-3.5 border border-cyan-500/20 bg-black/40 hover:border-cyan-400 hover:bg-cyan-500/10 cursor-pointer flex flex-col justify-between transition-all group"
                  >
                    <div>
                      <div className="flex items-center gap-2 mb-1.5">
                        <Icon className="w-4 h-4 text-cyan-400" />
                        <span className="font-semibold text-white text-xs group-hover:text-cyan-300">
                          {feat.title}
                        </span>
                      </div>
                      <div className="text-[11px] text-gray-400 leading-relaxed">{feat.desc}</div>
                    </div>
                    <div className="pt-2 mt-2 border-t border-cyan-500/10 flex items-center justify-between text-[10px] text-cyan-400/80">
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

      {/* Clean Footer */}
      <footer className="max-w-4xl mx-auto w-full text-center font-mono text-[11px] text-gray-500 pt-6">
        <span>THE SYSTEM — PLAYER LEVEL: {profile.level}</span>
      </footer>
    </div>
  );
}
