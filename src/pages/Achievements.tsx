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
    <div className="min-h-screen pt-6 pb-28 sm:pb-36 bg-[#071322] text-[#e5ecf4] flex flex-col system-blueprint-bg font-mono">
      <main className="max-w-5xl mx-auto w-full px-3 sm:px-6 py-4 sm:py-8 flex-1 space-y-6 overflow-x-hidden">
        {/* Top Header Card in anime window style */}
        <div className="relative bg-[#0a1b2e]/90 border-2 border-white/50 rounded-[4px] p-4 sm:p-6 text-white shadow-[0_0_30px_rgba(0,0,0,0.85),inset_0_0_24px_rgba(0,212,255,0.08)] backdrop-blur-md anime-dropdown">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/20 pb-4 mb-4">
            <div>
              <div className="inline-block px-6 sm:px-8 py-1 border border-white/70 bg-[#061426]/60 shadow-[0_0_14px_rgba(0,212,255,0.35)] mb-2">
                <h1 className="text-base sm:text-2xl font-mono font-bold text-white anime-glow-text tracking-[0.2em] flex items-center gap-2">
                  <Trophy className="w-5 h-5 text-[#9fd3ff]" />
                  FEATS, TROPHIES & AWAKENED RAIDS
                  <Swords className="w-5 h-5 text-[#9fd3ff]" />
                </h1>
              </div>
              <p className="text-[11px] sm:text-xs font-mono text-white/80 mt-1">
                [System Accolades, Time-Limited Raid Operations & Attribute Multipliers]
              </p>
            </div>

            <div className="flex items-center gap-2 sm:gap-3 font-mono text-xs flex-wrap">
              <div className="px-3 py-1.5 sm:py-2 bg-[#061424]/80 border border-white/30 text-center rounded-[2px] min-w-[70px]">
                <div className="text-[9px] sm:text-[10px] text-gray-400">UNLOCKED</div>
                <div className="text-xs sm:text-sm font-bold text-white">
                  {unlockedCount} / {totalCount}
                </div>
              </div>
              <div className="px-3 py-1.5 sm:py-2 bg-[#061424]/80 border border-white/30 text-center rounded-[2px] min-w-[70px]">
                <div className="text-[9px] sm:text-[10px] text-gray-400">SCORE</div>
                <div className="text-xs sm:text-sm font-bold text-[#9fd3ff] anime-glow-text">
                  {stats.totalPoints} PTS
                </div>
              </div>
              <div className="px-3 py-1.5 sm:py-2 bg-[#061424]/80 border border-white/30 text-center rounded-[2px] min-w-[70px]">
                <div className="text-[9px] sm:text-[10px] text-gray-400">RAIDS</div>
                <div className="text-xs sm:text-sm font-bold text-amber-400">
                  {activeChallengesCount} ACTIVE
                </div>
              </div>
            </div>
          </div>

          <div>
            <div className="flex justify-between text-xs font-mono text-gray-300 mb-1.5">
              <span>SYSTEM TROPHIES PROGRESS</span>
              <span className="text-[#9fd3ff] font-bold">{completionPercentage}%</span>
            </div>
            <div className="h-2 bg-[#061424] border border-white/30 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-blue-500 to-[#9fd3ff] shadow-[0_0_10px_rgba(0,212,255,0.5)] transition-all duration-300"
                style={{ width: `${completionPercentage}%` }}
              />
            </div>
          </div>

          {/* Sub-view Navigation Filter Tabs */}
          <div className="flex items-center justify-center gap-2 mt-4 pt-4 border-t border-white/15 flex-wrap">
            <button
              onClick={() => handleTabChange('all')}
              className={`px-3 py-1.5 border rounded-[2px] text-xs transition-all ${
                activeTab === 'all'
                  ? 'border-white bg-white/20 text-white font-bold shadow-[0_0_10px_rgba(0,212,255,0.3)]'
                  : 'border-white/30 bg-[#061424]/80 text-gray-400 hover:text-white hover:border-white/60'
              }`}
            >
              ALL PROTOCOLS
            </button>
            <button
              onClick={() => handleTabChange('challenges')}
              className={`px-3 py-1.5 border rounded-[2px] text-xs transition-all flex items-center gap-1.5 ${
                activeTab === 'challenges'
                  ? 'border-white bg-white/20 text-white font-bold shadow-[0_0_10px_rgba(0,212,255,0.3)]'
                  : 'border-white/30 bg-[#061424]/80 text-gray-400 hover:text-white hover:border-white/60'
              }`}
            >
              <Target className="w-3.5 h-3.5 text-[#9fd3ff]" />
              RAID CHALLENGES
            </button>
            <button
              onClick={() => handleTabChange('trophies')}
              className={`px-3 py-1.5 border rounded-[2px] text-xs transition-all flex items-center gap-1.5 ${
                activeTab === 'trophies'
                  ? 'border-white bg-white/20 text-white font-bold shadow-[0_0_10px_rgba(0,212,255,0.3)]'
                  : 'border-white/30 bg-[#061424]/80 text-gray-400 hover:text-white hover:border-white/60'
              }`}
            >
              <Trophy className="w-3.5 h-3.5 text-[#9fd3ff]" />
              SYSTEM TROPHIES
            </button>
          </div>
        </div>

        {/* ============================================================ */}
        {/* RAID CHALLENGES SECTION: Time-Limited Operations */}
        {/* ============================================================ */}
        {(activeTab === 'all' || activeTab === 'challenges') && (
          <div className="space-y-4 anime-dropdown">
            <div className="relative bg-[#0a1b2e]/90 border-2 border-white/50 rounded-[4px] p-4 text-white shadow-[0_0_20px_rgba(0,0,0,0.7)] backdrop-blur-md flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Target className="w-4 h-4 text-[#9fd3ff] shrink-0" />
                <h2 className="font-mono font-bold text-sm text-white anime-glow-text">
                  [ TIME-LIMITED RAID OPERATIONS ]
                </h2>
              </div>
              <p className="text-[11px] font-mono text-gray-300">
                Complete protocol operations before expiration to claim bonus rewards.
              </p>
            </div>

            <ActiveChallenges />
          </div>
        )}

        {/* ============================================================ */}
        {/* SYSTEM TROPHIES SECTION: Feats and Accolades */}
        {/* ============================================================ */}
        {(activeTab === 'all' || activeTab === 'trophies') && (
          <div className="space-y-4 anime-dropdown">
            <div className="relative bg-[#0a1b2e]/90 border-2 border-white/50 rounded-[4px] p-4 text-white shadow-[0_0_20px_rgba(0,0,0,0.7)] backdrop-blur-md flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Trophy className="w-4 h-4 text-[#9fd3ff] shrink-0" />
                <h2 className="font-mono font-bold text-sm text-white anime-glow-text">
                  [ FEATS & SYSTEM TROPHIES ]
                </h2>
              </div>

              {/* Category Filter Pills */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-[11px] font-mono scrollbar-none">
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
                        ? 'border-white bg-white/20 text-white font-bold shadow-[0_0_10px_rgba(0,212,255,0.25)]'
                        : 'border-white/30 bg-[#061424]/75 text-gray-400 hover:text-white hover:border-white/60'
                    }`}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Achievement List */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4 font-mono">
              {filteredAchievements.map((achievement) => {
                const progress = getAchievementProgress(achievement.id);
                const isUnlocked = progress?.unlocked || false;
                const currentProgress = progress?.progress || 0;
                const target = achievement.requirement.target;
                const progressPct = Math.min(100, (currentProgress / Math.max(1, target)) * 100);

                return (
                  <div
                    key={achievement.id}
                    className={`bg-[#0a1b2e]/85 border-2 rounded-[4px] p-4 space-y-3 shadow-[0_0_20px_rgba(0,0,0,0.7),inset_0_0_15px_rgba(0,212,255,0.05)] anime-dropdown ${
                      isUnlocked
                        ? 'border-emerald-400/80 bg-emerald-950/20'
                        : 'border-white/35 opacity-75'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="font-bold text-sm text-white flex items-center gap-2">
                          <span>{achievement.name}</span>
                        </div>
                        <p className="text-xs text-gray-300 mt-1">{achievement.description}</p>
                      </div>
                      <span className="text-[10px] px-1.5 py-0.5 border border-white/40 text-[#9fd3ff] uppercase bg-black/40 shrink-0">
                        {achievement.tier}
                      </span>
                    </div>

                    {!isUnlocked && (
                      <div>
                        <div className="flex justify-between text-[10px] text-gray-400 mb-1">
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
                      <div className="flex items-center gap-1.5 text-[10px] text-emerald-400 pt-1 font-bold">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                        <span>UNLOCKED</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
