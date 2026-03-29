// Dashboard - Main application view
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { StatusCard } from '@/components/StatusCard';
import { QuestCard } from '@/components/QuestCard';
import AIChat from '@/components/AIChat';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { getUserProfile, getDailyQuests, QUESTS_UPDATED_EVENT } from '@/lib/storage';
import { UserProfile, Quest } from '@/lib/types';
import { BarChart3, User, Users, Brain, Dumbbell, BookOpen, TestTube, Trophy, Crown, MessageSquare, Target } from 'lucide-react';
import { getAchievementStats } from '@/lib/achievements';

const Dashboard = () => {
  const navigate = useNavigate();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [quests, setQuests] = useState<Quest[]>([]);
  const [questStatus, setQuestStatus] = useState<'loading' | 'ready' | 'error'>('loading');

  useEffect(() => {
    setProfile(getUserProfile());
  }, []);

  useEffect(() => {
    let active = true;

    const loadQuests = async () => {
      try {
        setQuestStatus(prev => (prev === 'ready' ? prev : 'loading'));
        const data = await getDailyQuests();
        if (!active) return;
        setQuests(data);
        setQuestStatus('ready');
      } catch (error) {
        console.error('Failed to load quests', error);
        if (active) setQuestStatus('error');
      }
    };

    loadQuests();
    const handleUpdate = () => {
      loadQuests();
    };

    window.addEventListener(QUESTS_UPDATED_EVENT, handleUpdate);
    return () => {
      active = false;
      window.removeEventListener(QUESTS_UPDATED_EVENT, handleUpdate);
    };
  }, []);

  if (!profile) return null;

  const completedCount = quests.filter(q => q.completed).length;
  const achievementStats = getAchievementStats();
  const unlockedAchievements = Object.values(achievementStats.achievements).filter(a => a.unlocked).length;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card">
        <div className="container mx-auto px-4 py-3 sm:py-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-0">
          <div>
            <h1 className="text-lg sm:text-xl font-bold tracking-tight">THE WHITE ROOM</h1>
            <p className="text-xs text-muted-foreground font-mono-data mt-0.5">
              Training Protocol v1.0
            </p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate('/achievements')}
              className="font-mono-data text-xs"
            >
              <Trophy className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />
              Achievements ({unlockedAchievements})
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate('/analytics')}
              className="font-mono-data text-xs"
            >
              <BarChart3 className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />
              Analytics
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate('/profile')}
              className="font-mono-data text-xs"
            >
              <User className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />
              Profile
            </Button>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-6 sm:py-8 max-w-6xl">
        {/* Status Section */}
        <div className="mb-6 sm:mb-8">
          <StatusCard profile={profile} />
        </div>

        {/* Daily Protocol Summary */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base sm:text-lg font-bold">Daily Protocol</h2>
              <p className="text-xs text-muted-foreground mt-1">
                {new Date().toLocaleDateString('en-US', { 
                  weekday: 'long', 
                  year: 'numeric', 
                  month: 'long', 
                  day: 'numeric' 
                })}
              </p>
            </div>
            <div className="text-right">
              <div className="font-mono-data text-xl sm:text-2xl font-bold">
                {completedCount}/{quests.length}
              </div>
              <div className="text-xs text-muted-foreground uppercase">
                {questStatus === 'loading' ? 'CALIBRATING' : questStatus === 'error' ? 'OFFLINE' : 'COMPLETE'}
              </div>
            </div>
          </div>

          {/* Category progress bars */}
          {(() => {
            const cats = [
              { label: 'Mental', types: ['mental'], color: 'bg-info' },
              { label: 'Physical', types: ['physical'], color: 'bg-critical' },
              { label: 'Spiritual', types: ['social'], color: 'bg-warning' },
            ];
            return (
              <div
                className="space-y-2 cursor-pointer hover:opacity-80 transition-opacity"
                onClick={() => navigate('/daily-protocol')}
              >
                {cats.map(c => {
                  const cq = quests.filter(q => c.types.includes(q.type));
                  const done = cq.filter(q => q.completed).length;
                  const total = cq.length;
                  const pct = total > 0 ? (done / total) * 100 : 0;
                  return (
                    <div key={c.label} className="flex items-center gap-3">
                      <span className="text-xs font-mono-data w-20 text-muted-foreground">{c.label}</span>
                      <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                        <div className={`h-full ${c.color} rounded-full transition-all`} style={{ width: `${pct}%` }} />
                      </div>
                      <span className="text-xs font-mono-data w-10 text-right">{done}/{total}</span>
                    </div>
                  );
                })}
                <p className="text-xs text-muted-foreground text-center mt-2">Click to view full protocol →</p>
              </div>
            );
          })()}
        </div>

        {/* Training Labs */}
        <Card className="border-primary/20 bg-surface mb-6">
          <div className="p-4 sm:p-6 space-y-4">
            <h2 className="text-xs sm:text-sm font-mono text-muted-foreground">SPECIALIZED TRAINING</h2>
            <div className="space-y-2">
              <Button 
                variant="secondary" 
                className="w-full justify-start text-sm"
                onClick={() => navigate('/social-lab')}
              >
                <Users className="w-4 h-4 mr-2" />
                Social Lab
              </Button>
              <Button 
                variant="secondary" 
                className="w-full justify-start text-sm"
                onClick={() => navigate('/mental-lab')}
              >
                <Brain className="w-4 h-4 mr-2" />
                Mental Lab
              </Button>
              <Button 
                variant="secondary" 
                className="w-full justify-start text-sm"
                onClick={() => navigate('/physical-lab')}
              >
                <Dumbbell className="w-4 h-4 mr-2" />
                Physical Lab
              </Button>
              <Button 
                variant="secondary" 
                className="w-full justify-start text-sm"
                onClick={() => navigate('/knowledge-lab')}
              >
                <BookOpen className="w-4 h-4 mr-2" />
                Knowledge Lab
              </Button>
              <Button 
                variant="secondary" 
                className="w-full justify-start text-sm"
                onClick={() => navigate('/chess-lab')}
              >
                <Crown className="w-4 h-4 mr-2" />
                Chess Lab
              </Button>
              <Button 
                variant="secondary" 
                className="w-full justify-start text-sm"
                onClick={() => navigate('/skill-forge')}
              >
                <Target className="w-4 h-4 mr-2" />
                Skill Forge
              </Button>
            </div>
          </div>
        </Card>

        {/* Challenges Section */}
        <Card className="border-border bg-card mb-6">
          <div className="p-4 sm:p-6 space-y-4">
            <h2 className="text-xs sm:text-sm font-mono text-muted-foreground">CHALLENGES</h2>
            <div className="grid gap-2 sm:gap-3">
              <Button 
                variant="secondary" 
                className="w-full justify-start text-sm"
                onClick={() => navigate('/challenges')}
              >
                <Trophy className="w-4 h-4 mr-2" />
                Time-Limited Challenges
              </Button>
            </div>
          </div>
        </Card>

        {/* AI Mentor Chat */}
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-4">
            <MessageSquare className="h-5 w-5 text-primary" />
            <h2 className="text-base sm:text-lg font-bold">AI Mentor</h2>
          </div>
          <AIChat 
            title="The Architect"
            placeholder="Ask The Architect for guidance..."
          />
        </div>

        {/* ChatGPT Test (Development) */}
        <Card className="border-border bg-muted/30 mb-6">
          <div className="p-4 sm:p-6 space-y-4">
            <h2 className="text-xs sm:text-sm font-mono text-muted-foreground">DEVELOPMENT TOOLS</h2>
            <Button 
              variant="outline" 
              className="w-full justify-start text-sm"
              onClick={() => navigate('/chatgpt-test')}
            >
              <TestTube className="w-4 h-4 mr-2" />
              Test ChatGPT Integration
            </Button>
          </div>
        </Card>

        {/* Status Messages */}
        {completedCount === quests.length && quests.length > 0 && (
          <div className="bg-surface border border-border p-3 sm:p-4 text-center">
            <p className="text-xs sm:text-sm font-mono-data text-muted-foreground">
              Daily protocol complete. All objectives satisfied. Return tomorrow for new assignments.
            </p>
          </div>
        )}

        {completedCount === 0 && (
          <div className="bg-surface border border-border p-3 sm:p-4">
            <p className="text-xs sm:text-sm text-muted-foreground mb-2">
              <span className="font-mono-data font-bold">SYSTEM:</span> Three training protocols assigned. 
              Complete all objectives to maximize attribute development.
            </p>
            <p className="text-xs text-muted-foreground">
              Note: Attribute points accumulate in hidden pool. Visible statistics update upon level advancement.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Dashboard;
