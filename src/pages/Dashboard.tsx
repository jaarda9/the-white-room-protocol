import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { SoloStatusWindow } from '@/components/SoloStatusWindow';
import { SoloDailyQuestWindow } from '@/components/SoloDailyQuestWindow';
import { getUserProfile, saveUserProfile } from '@/lib/storage';
import { UserProfile } from '@/lib/types';
import { systemSound } from '@/lib/system-sound';
import {
  Sparkles,
  Sword,
  Brain,
  MessageSquare,
  LogOut,
  Trophy,
  Calendar,
  Layers,
  ChevronRight,
} from 'lucide-react';

export default function Dashboard() {
  const navigate = useNavigate();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [activeView, setActiveView] = useState<'status' | 'quests' | 'dungeons'>('status');

  useEffect(() => {
    setProfile(getUserProfile());
  }, []);

  if (!profile) return null;

  return (
    <div className="min-h-screen bg-[#070d18] text-[#e5ecf4] flex flex-col justify-between p-4 sm:p-8">
      {/* Clean Minimalist Top System Bar */}
      <header className="max-w-4xl mx-auto w-full flex items-center justify-between border-b border-cyan-500/20 pb-4 mb-8">
        <div className="flex items-center gap-3">
          <div className="w-2.5 h-2.5 rounded-full bg-cyan-400 shadow-[0_0_8px_#52d2f6]" />
          <h1 className="font-display font-bold text-lg sm:text-xl text-white tracking-widest anime-glow-text">
            THE SYSTEM
          </h1>
        </div>

        {/* Minimal Navigation Buttons */}
        <div className="flex items-center gap-1 sm:gap-2">
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
          <div className="anime-window p-6 sm:p-8 max-w-xl mx-auto w-full space-y-4">
            <div className="text-center mb-6">
              <h2 className="text-xl sm:text-2xl font-display font-bold text-white anime-glow-text">
                DUNGEON GATES
              </h2>
              <p className="text-xs font-mono text-gray-400 mt-1">
                Select a training dungeon to initiate instant instance infiltration.
              </p>
            </div>

            <div className="space-y-3 font-mono text-sm">
              {[
                {
                  title: 'E-Rank: Physical Conditioning Gate',
                  desc: 'High-gravity conditioning zone for push-ups, squats, and running.',
                  path: '/lab/physical',
                  rank: 'E-Rank',
                },
                {
                  title: 'D-Rank: Cognitive Trial Chamber',
                  desc: 'Stroop color clashes and memory recall challenges.',
                  path: '/lab/mental',
                  rank: 'D-Rank',
                },
                {
                  title: 'C-Rank: Strategic Chess Dungeon',
                  desc: 'Tactical spatial calculations and grandmaster endgame analysis.',
                  path: '/lab/chess',
                  rank: 'C-Rank',
                },
                {
                  title: 'B-Rank: Knowledge & Logic Forge',
                  desc: 'Spaced repetition modules and mastery quiz trials.',
                  path: '/lab/kinnu',
                  rank: 'B-Rank',
                },
              ].map((dungeon, idx) => (
                <div
                  key={idx}
                  onClick={() => {
                    systemSound.playClick();
                    navigate(dungeon.path);
                  }}
                  className="p-3.5 border border-cyan-500/20 bg-black/40 hover:border-cyan-400 hover:bg-cyan-500/10 cursor-pointer flex items-center justify-between transition-all group"
                >
                  <div>
                    <div className="font-semibold text-white group-hover:text-cyan-300 flex items-center gap-2">
                      <span>{dungeon.title}</span>
                      <span className="text-[10px] px-1.5 py-0.5 border border-cyan-500/40 text-cyan-300">
                        {dungeon.rank}
                      </span>
                    </div>
                    <div className="text-xs text-gray-400 mt-1">{dungeon.desc}</div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-cyan-400 group-hover:translate-x-1 transition-transform shrink-0" />
                </div>
              ))}
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
