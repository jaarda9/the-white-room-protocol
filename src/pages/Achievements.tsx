import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { SoloLevelingHeader } from '@/components/SoloLevelingHeader';
import { ArrowLeft, Trophy, Lock, Award, Sparkles, Flame, Shield, CheckCircle2 } from 'lucide-react';
import { ActiveChallenges } from '@/components/ActiveChallenges';
import {
  ACHIEVEMENTS,
  getAchievementStats,
  getAchievementProgress,
  AchievementCategory,
  AchievementTier,
  Achievement,
} from '@/lib/achievements';
import { getUserProfile } from '@/lib/storage';
import { systemSound } from '@/lib/system-sound';

const TIER_STYLES: Record<AchievementTier, { border: string; bg: string; text: string; glow: string }> = {
  bronze: {
    border: 'border-orange-500/50',
    bg: 'bg-orange-950/20',
    text: 'text-orange-400',
    glow: 'shadow-[0_0_10px_rgba(249,115,22,0.2)]',
  },
  silver: {
    border: 'border-slate-400/50',
    bg: 'bg-slate-900/40',
    text: 'text-slate-300',
    glow: 'shadow-[0_0_10px_rgba(203,213,225,0.2)]',
  },
  gold: {
    border: 'border-amber-400/60',
    bg: 'bg-amber-950/30',
    text: 'text-amber-300',
    glow: 'shadow-[0_0_15px_rgba(251,191,36,0.3)]',
  },
  platinum: {
    border: 'border-cyan-400/60',
    bg: 'bg-cyan-950/30',
    text: 'text-cyan-300',
    glow: 'shadow-[0_0_15px_rgba(6,182,212,0.3)]',
  },
  limited: {
    border: 'border-purple-400/70',
    bg: 'bg-purple-950/40',
    text: 'text-purple-300',
    glow: 'shadow-[0_0_20px_rgba(168,85,247,0.4)]',
  },
};

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
    <div className="min-h-screen bg-[#030712] text-foreground scanlines pb-16">
      <SoloLevelingHeader />

      <main className="max-w-5xl mx-auto px-3 sm:px-6 py-6 space-y-6">
        
        {/* Navigation Breadcrumb */}
        <div className="flex items-center justify-between">
          <button
            onClick={() => {
              systemSound.playClick();
              navigate('/');
            }}
            className="system-btn px-3 py-1.5 flex items-center gap-1.5 text-xs"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>[ RETURN TO COMMAND ]</span>
          </button>

          <span className="text-xs font-mono text-primary/80 border border-primary/40 px-2 py-0.5 bg-primary/10">
            SYSTEM ACHIEVEMENTS & FEATS
          </span>
        </div>

        {/* Top Progress Window */}
        <div className="system-window tech-corners p-5 sm:p-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-primary/30 pb-4 mb-4">
            <div>
              <div className="flex items-center gap-2">
                <Trophy className="w-5 h-5 text-amber-400" />
                <h1 className="text-xl sm:text-2xl font-display font-black text-white tracking-wider system-glow-text">
                  [ HUNTER FEATS & MONARCH TRIALS ]
                </h1>
              </div>
              <p className="text-xs font-tech text-gray-400 mt-1">
                Conquer trials to unlock titles, attribute multipliers, and loot caches.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <div className="p-3 bg-black/60 border border-primary/40 text-center">
                <div className="text-[10px] font-mono text-primary">UNLOCKED</div>
                <div className="text-base font-bold font-display text-white">
                  {unlockedCount} / {totalCount}
                </div>
              </div>
              <div className="p-3 bg-black/60 border border-amber-500/40 text-center">
                <div className="text-[10px] font-mono text-amber-400">TOTAL SCORE</div>
                <div className="text-base font-bold font-display text-amber-300">
                  {stats.totalPoints} PTS
                </div>
              </div>
            </div>
          </div>

          {/* Progress Bar */}
          <div>
            <div className="flex justify-between text-xs font-mono text-gray-400 mb-1.5">
              <span>OVERALL FEATS PROGRESS</span>
              <span className="text-primary font-bold">{completionPercentage}%</span>
            </div>
            <div className="h-2.5 bg-black/80 border border-primary/30 p-0.5">
              <div
                className="h-full bg-gradient-to-r from-blue-600 to-primary shadow-[0_0_12px_rgba(0,240,255,0.8)] transition-all duration-500"
                style={{ width: `${completionPercentage}%` }}
              />
            </div>
          </div>
        </div>

        {/* Active Challenges Module */}
        <ActiveChallenges />

        {/* Category Selector */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs font-display font-bold">
          {[
            { id: 'all', label: '[ ALL FEATS ]' },
            { id: 'training', label: '[ TRAINING ]' },
            { id: 'mastery', label: '[ MASTERY ]' },
            { id: 'streak', label: '[ STREAKS ]' },
            { id: 'milestone', label: '[ MILESTONES ]' },
            { id: 'special', label: '[ SPECIAL ]' },
          ].map((cat) => (
            <button
              key={cat.id}
              onClick={() => {
                systemSound.playClick();
                setSelectedCategory(cat.id as any);
              }}
              className={`px-3 py-1.5 border transition-all whitespace-nowrap ${selectedCategory === cat.id ? 'border-primary bg-primary/20 text-primary system-glow-text' : 'border-gray-800 bg-black/40 text-gray-400 hover:border-primary/40 hover:text-white'}`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* Achievement Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredAchievements.map((achievement) => {
            const progress = getAchievementProgress(achievement.id);
            const isUnlocked = progress?.unlocked || false;
            const currentProgress = progress?.progress || 0;
            const target = achievement.requirement.target;
            const progressPct = Math.min(100, (currentProgress / Math.max(1, target)) * 100);
            const style = TIER_STYLES[achievement.tier];

            return (
              <div
                key={achievement.id}
                className={`p-4 border transition-all ${isUnlocked ? `${style.border} ${style.bg} ${style.glow}` : 'border-gray-800 bg-black/40 opacity-70 hover:opacity-90'}`}
              >
                <div className="flex items-start gap-3">
                  <div className={`p-3 border shrink-0 text-xl flex items-center justify-center ${isUnlocked ? 'border-current bg-black/50' : 'border-gray-700 bg-gray-900 text-gray-600'}`}>
                    {isUnlocked ? achievement.icon : <Lock className="w-5 h-5" />}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <h3 className={`font-display font-bold text-sm truncate ${isUnlocked ? 'text-white' : 'text-gray-400'}`}>
                        {achievement.name}
                      </h3>
                      <span className={`text-[10px] font-mono px-1.5 py-0.2 border uppercase font-bold ${style.border} ${style.text}`}>
                        {achievement.tier}
                      </span>
                    </div>

                    <p className="text-xs font-tech text-gray-400 line-clamp-2">
                      {achievement.description}
                    </p>

                    {!isUnlocked && (
                      <div className="mt-3">
                        <div className="flex justify-between text-[10px] font-mono text-gray-400 mb-1">
                          <span>PROGRESS</span>
                          <span>
                            {currentProgress} / {target} ({progressPct.toFixed(0)}%)
                          </span>
                        </div>
                        <div className="h-1.5 bg-black/80 border border-primary/20">
                          <div
                            className="h-full bg-primary"
                            style={{ width: `${progressPct}%` }}
                          />
                        </div>
                      </div>
                    )}

                    {isUnlocked && progress?.unlockedAt && (
                      <div className="flex items-center gap-1.5 text-[10px] font-mono text-emerald-400 mt-2">
                        <CheckCircle2 className="w-3 h-3" />
                        <span>AWAKENED {new Date(progress.unlockedAt).toLocaleDateString()}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </main>
    </div>
  );
}
