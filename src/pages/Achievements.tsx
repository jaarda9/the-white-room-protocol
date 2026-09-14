import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Trophy, Swords, Target, CheckCircle2, Shield, Flame } from 'lucide-react';
import { ActiveChallenges } from '@/components/ActiveChallenges';
import {
  ACHIEVEMENTS,
  getAchievementStats,
  getAchievementProgress,
  getActiveChallenges,
  AchievementCategory,
} from '@/lib/achievements';
import { getUserProfile } from '@/lib/storage';
import { systemSound } from '@/lib/system-sound';

export default function Achievements() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialTab = searchParams.get('tab') === 'challenges'
    ? 'challenges'
    : searchParams.get('tab') === 'trophies'
    ? 'trophies'
    : 'all';

  const [activeTab, setActiveTab] = useState<'all' | 'challenges' | 'trophies'>(initialTab);
  const [stats, setStats] = useState(getAchievementStats());
  const [profile, setProfile] = useState(getUserProfile());
  const [selectedCategory, setSelectedCategory] = useState<'all' | AchievementCategory>('all');

  useEffect(() => {
    setProfile(getUserProfile());
    setStats(getAchievementStats());
  }, []);

  const unlockedCount = Object.values(stats.achievements).filter((a) => a.unlocked).length;
  const totalCount = ACHIEVEMENTS.filter((a) => !a.hidden).length;
  const completionPercentage = Math.round((unlockedCount / Math.max(1, totalCount)) * 100);
  const activeChallengesCount = getActiveChallenges().length;

  const filteredAchievements = ACHIEVEMENTS.filter((achievement) => {
    if (achievement.hidden && !stats.achievements[achievement.id]?.unlocked) return false;
    if (selectedCategory === 'all') return true;
    return achievement.category === selectedCategory;
  });

  const handleTabChange = (tab: 'all' | 'challenges' | 'trophies') => {
    systemSound.playClick();
    setActiveTab(tab);
    setSearchParams(tab === 'all' ? {} : { tab });
  };

  return (
    <div className="min-h-screen pt-8 sm:pt-14 md:pt-16 pb-36 sm:pb-40 bg-[#071322] text-[#e5ecf4] flex flex-col system-blueprint-bg font-mono">
      <main className="max-w-[680px] w-full mx-auto px-4 py-6 sm:py-10 flex-1 flex flex-col my-auto">
        {/* Single unified window, matching Status/Daily Quest/Codex — one bordered panel with
            a plain vertical flow inside, not a stack of separate boxed-in sub-panels. */}
        <div className="relative w-full bg-[#0a1b2e]/90 border-2 border-white/50 rounded-[4px] p-5 sm:p-8 text-white shadow-[0_0_30px_rgba(0,0,0,0.85),inset_0_0_24px_rgba(0,212,255,0.08)] backdrop-blur-md anime-dropdown font-mono">
          {/* Title plate */}
          <div className="relative flex flex-col items-center justify-center pb-2 mb-4">
            <div className="inline-block px-6 sm:px-8 py-1 border border-white/70 bg-[#061426]/60 shadow-[0_0_14px_rgba(0,212,255,0.35)]">
              <h1 className="text-sm sm:text-base font-mono font-extrabold text-white anime-glow-text tracking-[0.15em] flex items-center gap-2">
                <Trophy className="w-4 h-4 text-[#9fd3ff]" />
                FEATS, TROPHIES & AWAKENED RAIDS
                <Swords className="w-4 h-4 text-[#9fd3ff]" />
              </h1>
            </div>
            <p className="text-[10px] font-mono text-white/50 mt-2.5 text-center">
              [ System Accolades, Time-Limited Raid Operations & Attribute Multipliers ]
            </p>
          </div>

          {/* Stat row */}
          <div className="grid grid-cols-3 gap-2 mb-4 font-mono text-xs">
            <div className="py-2 border border-white/25 bg-[#061424]/70 text-center rounded-[2px]">
              <div className="text-[9px] text-gray-400">UNLOCKED</div>
              <div className="text-sm font-bold text-white">{unlockedCount}/{totalCount}</div>
            </div>
            <div className="py-2 border border-white/25 bg-[#061424]/70 text-center rounded-[2px]">
              <div className="text-[9px] text-gray-400">SCORE</div>
              <div className="text-sm font-bold text-[#9fd3ff] anime-glow-text">{stats.totalPoints} PTS</div>
            </div>
            <div className="py-2 border border-white/25 bg-[#061424]/70 text-center rounded-[2px]">
              <div className="text-[9px] text-gray-400">RAIDS</div>
              <div className="text-sm font-bold text-amber-400">{activeChallengesCount} ACTIVE</div>
            </div>
          </div>

          {/* Progress */}
          <div className="mb-4">
            <div className="flex justify-between text-[10px] font-mono text-gray-400 mb-1.5">
              <span>SYSTEM TROPHIES PROGRESS</span>
              <span className="text-[#9fd3ff] font-bold">{completionPercentage}%</span>
            </div>
            <div className="h-2 bg-[#061424] border border-white/30 overflow-hidden rounded-[2px]">
              <div
                className="h-full bg-gradient-to-r from-blue-500 to-[#9fd3ff] shadow-[0_0_10px_rgba(0,212,255,0.5)] transition-all duration-300"
                style={{ width: `${completionPercentage}%` }}
              />
            </div>
          </div>

          {/* Sub-view Navigation Filter Tabs */}
          <div className="flex items-center justify-center gap-2 mb-5 pb-4 border-b border-white/15 flex-wrap">
            <button
              onClick={() => handleTabChange('all')}
              className={`px-3 py-1.5 border rounded-[2px] text-xs transition-all ${
                activeTab === 'all'
                  ? 'border-cyan-400 bg-cyan-950/80 text-cyan-300 font-bold shadow-[0_0_8px_rgba(0,212,255,0.4)]'
                  : 'border-white/20 bg-[#061424]/80 text-gray-400 hover:text-white hover:border-white/60'
              }`}
            >
              ALL PROTOCOLS
            </button>
            <button
              onClick={() => handleTabChange('challenges')}
              className={`px-3 py-1.5 border rounded-[2px] text-xs transition-all flex items-center gap-1.5 ${
                activeTab === 'challenges'
                  ? 'border-cyan-400 bg-cyan-950/80 text-cyan-300 font-bold shadow-[0_0_8px_rgba(0,212,255,0.4)]'
                  : 'border-white/20 bg-[#061424]/80 text-gray-400 hover:text-white hover:border-white/60'
              }`}
            >
              <Target className="w-3.5 h-3.5" />
              RAID CHALLENGES
            </button>
            <button
              onClick={() => handleTabChange('trophies')}
              className={`px-3 py-1.5 border rounded-[2px] text-xs transition-all flex items-center gap-1.5 ${
                activeTab === 'trophies'
                  ? 'border-cyan-400 bg-cyan-950/80 text-cyan-300 font-bold shadow-[0_0_8px_rgba(0,212,255,0.4)]'
                  : 'border-white/20 bg-[#061424]/80 text-gray-400 hover:text-white hover:border-white/60'
              }`}
            >
              <Trophy className="w-3.5 h-3.5" />
              SYSTEM TROPHIES
            </button>
          </div>

          {/* Raid Challenges */}
          {(activeTab === 'all' || activeTab === 'challenges') && (
            <div className={activeTab === 'all' ? 'mb-6' : ''}>
              <div className="flex items-center gap-1.5 text-[10px] tracking-[0.2em] text-cyan-300/80 mb-1">
                <Target className="w-3.5 h-3.5" />
                TIME-LIMITED RAID OPERATIONS
              </div>
              <p className="text-[10px] text-white/40 mb-3">
                Complete protocol operations before expiration to claim bonus rewards.
              </p>
              <ActiveChallenges />
            </div>
          )}

          {/* System Trophies */}
          {(activeTab === 'all' || activeTab === 'trophies') && (
            <div>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
                <span className="flex items-center gap-1.5 text-[10px] tracking-[0.2em] text-cyan-300/80">
                  <Trophy className="w-3.5 h-3.5" />
                  FEATS & SYSTEM TROPHIES
                </span>
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-[10px] font-mono scrollbar-none">
                  {[
                    { id: 'all', label: 'ALL' },
                    { id: 'training', label: 'TRAINING' },
                    { id: 'mastery', label: 'MASTERY' },
                    { id: 'streak', label: 'STREAKS' },
                    { id: 'milestone', label: 'MILESTONES' },
                    { id: 'special', label: 'SPECIAL' },
                  ].map((cat) => (
                    <button
                      key={cat.id}
                      onClick={() => {
                        systemSound.playClick();
                        setSelectedCategory(cat.id as any);
                      }}
                      className={`px-2.5 py-1 border rounded-[2px] transition-all whitespace-nowrap ${
                        selectedCategory === cat.id
                          ? 'border-cyan-400 bg-cyan-950/80 text-cyan-300 font-bold shadow-[0_0_8px_rgba(0,212,255,0.3)]'
                          : 'border-white/20 bg-[#061424]/75 text-gray-400 hover:text-white hover:border-white/60'
                      }`}
                    >
                      {cat.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Achievement List */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 font-mono">
                {filteredAchievements.map((achievement) => {
                  const progress = getAchievementProgress(achievement.id);
                  const isUnlocked = progress?.unlocked || false;
                  const currentProgress = progress?.progress || 0;
                  const target = achievement.requirement.target;
                  const progressPct = Math.min(100, (currentProgress / Math.max(1, target)) * 100);

                  return (
                    <div
                      key={achievement.id}
                      className={`border rounded-[2px] p-3 space-y-2 ${
                        isUnlocked
                          ? 'border-emerald-500/40 bg-emerald-950/20'
                          : 'border-white/25 bg-[#061424]/75 opacity-80'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="font-bold text-xs text-white">{achievement.name}</div>
                          <p className="text-[11px] text-gray-300 mt-0.5">{achievement.description}</p>
                        </div>
                        <span className="text-[9px] px-1.5 py-0.5 border border-white/30 text-[#9fd3ff] uppercase bg-black/40 shrink-0">
                          {achievement.tier}
                        </span>
                      </div>

                      {!isUnlocked && (
                        <div>
                          <div className="flex justify-between text-[9px] text-gray-400 mb-1">
                            <span>PROGRESS</span>
                            <span>
                              {currentProgress}/{target} ({progressPct.toFixed(0)}%)
                            </span>
                          </div>
                          <div className="h-1.5 bg-[#061424] border border-white/20 overflow-hidden">
                            <div
                              className="h-full bg-gradient-to-r from-blue-500 to-[#9fd3ff]"
                              style={{ width: `${progressPct}%` }}
                            />
                          </div>
                        </div>
                      )}

                      {isUnlocked && (
                        <div className="flex items-center gap-1.5 text-[9px] text-emerald-400 pt-0.5 font-bold">
                          <CheckCircle2 className="w-3 h-3" />
                          <span>UNLOCKED</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
