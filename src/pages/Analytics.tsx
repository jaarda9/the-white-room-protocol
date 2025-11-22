import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { getUserProfile, getQuestAttempts } from '@/lib/storage';
import { UserProfile, QuestAttempt } from '@/lib/types';
import { ArrowLeft, TrendingUp, Target, Clock } from 'lucide-react';

const Analytics = () => {
  const navigate = useNavigate();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [attempts, setAttempts] = useState<QuestAttempt[]>([]);

  useEffect(() => {
    setProfile(getUserProfile());
    setAttempts(getQuestAttempts());
  }, []);

  if (!profile) return null;

  const totalXP = attempts.reduce((sum, a) => sum + a.xpGained, 0);
  const completedQuests = attempts.filter(a => a.success).length;
  const avgTime = attempts.length > 0 
    ? Math.round(attempts.reduce((sum, a) => sum + a.timeTaken, 0) / attempts.length)
    : 0;

  const recentAttempts = attempts.slice(-5).reverse();

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="container mx-auto px-4 py-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/dashboard')}
            className="mb-2 font-mono-data"
          >
            <ArrowLeft className="h-4 w-4 mr-1" />
            Return
          </Button>
          <h1 className="text-xl font-bold">Performance Analytics</h1>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8 max-w-6xl">
        {/* Overview Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-card border border-border p-6">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs font-mono-data text-muted-foreground">TOTAL XP</span>
            </div>
            <div className="font-mono-data text-3xl font-bold">{totalXP}</div>
          </div>

          <div className="bg-card border border-border p-6">
            <div className="flex items-center gap-2 mb-2">
              <Target className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs font-mono-data text-muted-foreground">COMPLETED</span>
            </div>
            <div className="font-mono-data text-3xl font-bold">{completedQuests}</div>
          </div>

          <div className="bg-card border border-border p-6">
            <div className="flex items-center gap-2 mb-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs font-mono-data text-muted-foreground">AVG TIME</span>
            </div>
            <div className="font-mono-data text-3xl font-bold">
              {Math.floor(avgTime / 60)}:{(avgTime % 60).toString().padStart(2, '0')}
            </div>
          </div>

          <div className="bg-card border border-border p-6">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs font-mono-data text-muted-foreground">SUCCESS RATE</span>
            </div>
            <div className="font-mono-data text-3xl font-bold">
              {attempts.length > 0 ? Math.round((completedQuests / attempts.length) * 100) : 0}%
            </div>
          </div>
        </div>

        {/* Recent Activity */}
        <div className="bg-card border border-border p-6 mb-8">
          <h2 className="font-bold mb-4">Recent Activity</h2>
          
          {recentAttempts.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              No quest attempts recorded. Complete quests to view analytics.
            </p>
          ) : (
            <div className="space-y-3">
              {recentAttempts.map((attempt) => (
                <div 
                  key={attempt.id}
                  className="flex items-center justify-between p-3 bg-surface border border-border"
                >
                  <div className="flex-1">
                    <div className="font-mono-data text-sm mb-1">
                      Quest #{attempt.questId.substring(0, 8)}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {new Date(attempt.timestamp).toLocaleString()}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-mono-data text-sm font-bold text-success mb-1">
                      +{attempt.xpGained} XP
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {Math.floor(attempt.timeTaken / 60)}m {attempt.timeTaken % 60}s
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* System Note */}
        <div className="bg-surface border border-border p-4">
          <p className="text-xs text-muted-foreground leading-relaxed">
            <span className="font-mono-data font-bold">ANALYTICS NOTE:</span> Performance data 
            tracked locally. Metrics used for adaptive difficulty calibration. Extended analytics 
            and comparative analysis available after 30-day participation minimum.
          </p>
        </div>
      </div>
    </div>
  );
};

export default Analytics;
