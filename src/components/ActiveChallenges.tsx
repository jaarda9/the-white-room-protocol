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
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <Trophy className="h-5 w-5 text-primary" />
              Weekly Challenges
            </h3>
            <Badge variant="outline" className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {getTimeRemaining('weekly')}
            </Badge>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {weeklyChallenges.map(challenge => {
              const progress = getChallengeProgress(challenge);
              return (
                <Card key={challenge.id} className="p-4 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-2xl">{challenge.icon}</span>
                        <h4 className="font-semibold text-sm truncate">{challenge.name}</h4>
                      </div>
                      <p className="text-xs text-muted-foreground line-clamp-2">
                        {challenge.description}
                      </p>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">Progress</span>
                      <span className="font-medium">
                        {progress.current}/{progress.target}
                      </span>
                    </div>
                    <Progress value={progress.percentage} className="h-2" />
                  </div>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {monthlyChallenges.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <Trophy className="h-5 w-5 text-primary" />
              Monthly Challenges
            </h3>
            <Badge variant="outline" className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {getTimeRemaining('monthly')}
            </Badge>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {monthlyChallenges.map(challenge => {
              const progress = getChallengeProgress(challenge);
              return (
                <Card key={challenge.id} className="p-4 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-2xl">{challenge.icon}</span>
                        <h4 className="font-semibold text-sm truncate">{challenge.name}</h4>
                      </div>
                      <p className="text-xs text-muted-foreground line-clamp-2">
                        {challenge.description}
                      </p>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">Progress</span>
                      <span className="font-medium">
                        {progress.current}/{progress.target}
                      </span>
                    </div>
                    <Progress value={progress.percentage} className="h-2" />
                  </div>
                </Card>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
