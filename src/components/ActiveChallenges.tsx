import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import {
  ACHIEVEMENTS_UPDATED_EVENT,
  getActiveChallenges,
  getChallengeProgress,
  getTimeRemaining,
} from '@/lib/achievements';
import { QUESTS_UPDATED_EVENT } from '@/lib/storage';
import { Clock, Trophy } from 'lucide-react';

export const ActiveChallenges = () => {
  const [refreshTick, setRefreshTick] = useState(0);

  useEffect(() => {
    const refresh = () => setRefreshTick((t) => t + 1);
    const timerId = window.setInterval(refresh, 60 * 1000);
    window.addEventListener(ACHIEVEMENTS_UPDATED_EVENT, refresh);
    window.addEventListener(QUESTS_UPDATED_EVENT, refresh);
    return () => {
      window.clearInterval(timerId);
      window.removeEventListener(ACHIEVEMENTS_UPDATED_EVENT, refresh);
      window.removeEventListener(QUESTS_UPDATED_EVENT, refresh);
    };
  }, []);

  // Re-evaluate challenge/progress getters when event/timer tick updates.
  void refreshTick;
  const challenges = getActiveChallenges();
  const weeklyChallenges = challenges.filter(c => c.category === 'weekly');
  const monthlyChallenges = challenges.filter(c => c.category === 'monthly');

  if (challenges.length === 0) return null;

  return (
    <div className="space-y-6">
      {weeklyChallenges.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-mono font-bold flex items-center gap-2 text-white anime-glow-text">
              <Trophy className="h-4 w-4 text-[#9fd3ff]" />
              WEEKLY OPERATIONS
            </h3>
            <span className="flex items-center gap-1 text-[11px] font-mono text-gray-300 border border-white/30 bg-[#061426]/70 px-2.5 py-0.5 rounded-[2px]">
              <Clock className="h-3 w-3 text-[#9fd3ff]" />
              {getTimeRemaining('weekly')}
            </span>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {weeklyChallenges.map(challenge => {
              const progress = getChallengeProgress(challenge);
              return (
                <div
                  key={challenge.id}
                  className="bg-[#0a1b2e]/85 border-2 border-white/40 rounded-[4px] p-4 space-y-3 text-white shadow-[0_0_20px_rgba(0,0,0,0.7),inset_0_0_15px_rgba(0,212,255,0.05)] anime-dropdown"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xl">{challenge.icon}</span>
                        <h4 className="font-mono font-bold text-xs truncate text-white">{challenge.name}</h4>
                      </div>
                      <p className="text-[11px] font-mono text-gray-300 line-clamp-2">
                        {challenge.description}
                      </p>
                    </div>
                  </div>
                  <div className="space-y-1.5 font-mono">
                    <div className="flex justify-between text-[10px]">
                      <span className="text-gray-400">PROGRESS</span>
                      <span className="font-bold text-[#9fd3ff]">
                        {progress.current} / {progress.target}
                      </span>
                    </div>
                    <div className="w-full bg-[#061424] h-1.5 border border-white/20 overflow-hidden">
                      <div
                        className="bg-gradient-to-r from-blue-500 to-[#9fd3ff] h-full transition-all duration-300 shadow-[0_0_8px_rgba(0,212,255,0.5)]"
                        style={{ width: `${Math.min(progress.percentage, 100)}%` }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {monthlyChallenges.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-mono font-bold flex items-center gap-2 text-white anime-glow-text">
              <Trophy className="h-4 w-4 text-[#9fd3ff]" />
              MONTHLY PROTOCOLS
            </h3>
            <span className="flex items-center gap-1 text-[11px] font-mono text-gray-300 border border-white/30 bg-[#061426]/70 px-2.5 py-0.5 rounded-[2px]">
              <Clock className="h-3 w-3 text-[#9fd3ff]" />
              {getTimeRemaining('monthly')}
            </span>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {monthlyChallenges.map(challenge => {
              const progress = getChallengeProgress(challenge);
              return (
                <div
                  key={challenge.id}
                  className="bg-[#0a1b2e]/85 border-2 border-white/40 rounded-[4px] p-4 space-y-3 text-white shadow-[0_0_20px_rgba(0,0,0,0.7),inset_0_0_15px_rgba(0,212,255,0.05)] anime-dropdown"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xl">{challenge.icon}</span>
                        <h4 className="font-mono font-bold text-xs truncate text-white">{challenge.name}</h4>
                      </div>
                      <p className="text-[11px] font-mono text-gray-300 line-clamp-2">
                        {challenge.description}
                      </p>
                    </div>
                  </div>
                  <div className="space-y-1.5 font-mono">
                    <div className="flex justify-between text-[10px]">
                      <span className="text-gray-400">PROGRESS</span>
                      <span className="font-bold text-[#9fd3ff]">
                        {progress.current} / {progress.target}
                      </span>
                    </div>
                    <div className="w-full bg-[#061424] h-1.5 border border-white/20 overflow-hidden">
                      <div
                        className="bg-gradient-to-r from-blue-500 to-[#9fd3ff] h-full transition-all duration-300 shadow-[0_0_8px_rgba(0,212,255,0.5)]"
                        style={{ width: `${Math.min(progress.percentage, 100)}%` }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
