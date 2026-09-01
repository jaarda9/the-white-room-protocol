import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { SoloLevelingHeader } from '@/components/SoloLevelingHeader';
import { ArrowLeft, Trophy, Lock, CheckCircle2 } from 'lucide-react';
import { ActiveChallenges } from '@/components/ActiveChallenges';
import {
  ACHIEVEMENTS,
  getAchievementStats,
  getAchievementProgress,
  AchievementCategory,
  AchievementTier,
} from '@/lib/achievements';
import { getUserProfile } from '@/lib/storage';
import { systemSound } from '@/lib/system-sound';

export default function Achievements() {
  const navigate = useNavigate();
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

  const filteredAchievements = ACHIEVEMENTS.filter((achievement) => {
    if (achievement.hidden && !stats.achievements[achievement.id]?.unlocked) return false;
    if (selectedCategory === 'all') return true;
    return achievement.category === selectedCategory;
  });

  return (
    <div className="min-h-screen bg-[#070d18] text-[#e5ecf4] flex flex-col">
      <SoloLevelingHeader />

      <main className="max-w-4xl mx-auto w-full px-4 py-8 flex-1 space-y-6">
        {/* Navigation Breadcrumb */}
        <div className="flex items-center justify-between">
          <button
            onClick={() => {
              systemSound.playClick();
              navigate('/');
            }}
            className="flex items-center gap-2 text-xs font-mono text-gray-400 hover:text-cyan-300 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>[ RETURN TO COMMAND ]</span>
          </button>
        </div>

        {/* Top Header Card in anime window style */}
        <div className="anime-window p-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-cyan-500/20 pb-4 mb-4">
            <div>
              <h1 className="text-xl sm:text-2xl font-display font-bold text-white anime-glow-text">
                TITLES & ACHIEVEMENTS
              </h1>
              <p className="text-xs font-mono text-gray-400 mt-1">
                Conquer challenges to unlock prestige titles and system attribute multipliers.
              </p>
            </div>

            <div className="flex items-center gap-3 font-mono text-xs">
              <div className="px-3 py-2 bg-black/40 border border-cyan-500/30 text-center">
                <div className="text-[10px] text-cyan-400">UNLOCKED</div>
                <div className="text-sm font-bold text-white">
                  {unlockedCount} / {totalCount}
                </div>
              </div>
              <div className="px-3 py-2 bg-black/40 border border-cyan-500/30 text-center">
                <div className="text-[10px] text-cyan-400">COMPLETION</div>
                <div className="text-sm font-bold text-cyan-300">
                  {completionPercentage}%
                </div>
              </div>
            </div>
          </div>

          <div>
            <div className="flex justify-between text-xs font-mono text-gray-400 mb-1.5">
              <span>OVERALL PROGRESS</span>
              <span className="text-cyan-300 font-bold">{completionPercentage}%</span>
            </div>
            <div className="h-2 bg-black/60 border border-cyan-500/30">
              <div
                className="h-full bg-cyan-400 shadow-[0_0_8px_#52d2f6]"
                style={{ width: `${completionPercentage}%` }}
              />
            </div>
          </div>
        </div>

        {/* Active Challenges Module */}
        <ActiveChallenges />

        {/* Category Filters */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs font-mono">
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
              className={`px-3 py-1.5 border transition-all whitespace-nowrap ${
                selectedCategory === cat.id
                  ? 'border-cyan-400 bg-cyan-400/20 text-cyan-300 shadow-[0_0_10px_rgba(82,210,246,0.2)]'
                  : 'border-gray-800 bg-black/40 text-gray-400 hover:text-white'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* Achievement List */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 font-mono">
          {filteredAchievements.map((achievement) => {
            const progress = getAchievementProgress(achievement.id);
            const isUnlocked = progress?.unlocked || false;
            const currentProgress = progress?.progress || 0;
            const target = achievement.requirement.target;
            const progressPct = Math.min(100, (currentProgress / Math.max(1, target)) * 100);

            return (
              <div
                key={achievement.id}
                className={`anime-window p-4 space-y-3 ${
                  isUnlocked ? 'border-cyan-400 bg-cyan-950/20' : 'opacity-70'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="font-bold text-sm text-white flex items-center gap-2">
                      <span>{achievement.name}</span>
                    </div>
                    <p className="text-xs text-gray-400 mt-1">
                      {achievement.description}
                    </p>
                  </div>
                  <span className="text-[10px] px-1.5 py-0.5 border border-cyan-500/40 text-cyan-300 uppercase">
                    {achievement.tier}
                  </span>
                </div>

                {!isUnlocked && (
                  <div>
                    <div className="flex justify-between text-[10px] text-gray-400 mb-1">
                      <span>PROGRESS</span>
                      <span>{currentProgress}/{target} ({progressPct.toFixed(0)}%)</span>
                    </div>
                    <div className="h-1.5 bg-black/60 border border-cyan-500/20">
                      <div
                        className="h-full bg-cyan-400"
                        style={{ width: `${progressPct}%` }}
                      />
                    </div>
                  </div>
                )}

                {isUnlocked && (
                  <div className="flex items-center gap-1.5 text-[10px] text-cyan-300 pt-1">
                    <CheckCircle2 className="w-3.5 h-3.5 text-cyan-400" />
                    <span>UNLOCKED</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </main>
    </div>
  );
}
