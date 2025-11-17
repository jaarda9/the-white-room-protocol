import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { StatusCard } from '@/components/StatusCard';
import { QuestCard } from '@/components/QuestCard';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { getUserProfile, getDailyQuests } from '@/lib/storage';
import { UserProfile, Quest } from '@/lib/types';
import { BarChart3, User, Users, Brain, Dumbbell } from 'lucide-react';

const Dashboard = () => {
  const navigate = useNavigate();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [quests, setQuests] = useState<Quest[]>([]);

  useEffect(() => {
    setProfile(getUserProfile());
    setQuests(getDailyQuests());
  }, []);

  if (!profile) return null;

  const completedCount = quests.filter(q => q.completed).length;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold tracking-tight">THE WHITE ROOM</h1>
            <p className="text-xs text-muted-foreground font-mono-data mt-0.5">
              Training Protocol v1.0
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate('/analytics')}
              className="font-mono-data"
            >
              <BarChart3 className="h-4 w-4 mr-1" />
              Analytics
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate('/profile')}
              className="font-mono-data"
            >
              <User className="h-4 w-4 mr-1" />
              Profile
            </Button>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8 max-w-6xl">
        {/* Status Section */}
        <div className="mb-8">
          <StatusCard profile={profile} />
        </div>

        {/* Daily Protocol */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-bold">Daily Protocol</h2>
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
              <div className="font-mono-data text-2xl font-bold">
                {completedCount}/{quests.length}
              </div>
              <div className="text-xs text-muted-foreground">COMPLETE</div>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {quests.map((quest) => (
              <QuestCard
                key={quest.id}
                quest={quest}
                onStart={(q) => navigate(`/quest/${q.id}`)}
              />
            ))}
          </div>
        </div>

        {/* Training Labs */}
        <Card className="border-primary/20 bg-surface mb-6">
          <div className="p-6 space-y-4">
            <h2 className="text-sm font-mono text-muted-foreground">SPECIALIZED TRAINING</h2>
            <div className="space-y-2">
              <Button 
                variant="secondary" 
                className="w-full justify-start"
                onClick={() => navigate('/social-lab')}
              >
                <Users className="w-4 h-4 mr-2" />
                Social Lab
              </Button>
              <Button variant="secondary" className="w-full justify-start" disabled>
                <Brain className="w-4 h-4 mr-2" />
                Mental Lab <span className="ml-auto text-xs text-muted-foreground">[LOCKED]</span>
              </Button>
              <Button variant="secondary" className="w-full justify-start" disabled>
                <Dumbbell className="w-4 h-4 mr-2" />
                Physical Lab <span className="ml-auto text-xs text-muted-foreground">[LOCKED]</span>
              </Button>
            </div>
          </div>
        </Card>

        {/* Status Messages */}
        {completedCount === quests.length && quests.length > 0 && (
          <div className="bg-surface border border-border p-4 text-center">
            <p className="text-sm font-mono-data text-muted-foreground">
              Daily protocol complete. All objectives satisfied. Return tomorrow for new assignments.
            </p>
          </div>
        )}

        {completedCount === 0 && (
          <div className="bg-surface border border-border p-4">
            <p className="text-sm text-muted-foreground mb-2">
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
