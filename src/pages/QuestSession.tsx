import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { getUserProfile, getDailyQuests, completeQuest, saveUserProfile, addXP, saveQuestAttempt, QUESTS_UPDATED_EVENT } from '@/lib/storage';
import { Quest, UserProfile, Attributes } from '@/lib/types';
import { ArrowLeft, Clock, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';

const QuestSession = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [quest, setQuest] = useState<Quest | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [timeElapsed, setTimeElapsed] = useState(0);
  const [isActive, setIsActive] = useState(false);

  useEffect(() => {
    let active = true;

    const loadQuest = async () => {
      try {
        const quests = await getDailyQuests();
        if (!active) return;
        const foundQuest = quests.find(q => q.id === id);
        setQuest(foundQuest ?? null);
        setProfile(getUserProfile());
      } catch (error) {
        console.error('Failed to load quest', error);
      }
    };

    loadQuest();

    const handleQuestUpdate = () => {
      loadQuest();
    };

    window.addEventListener(QUESTS_UPDATED_EVENT, handleQuestUpdate);
    return () => {
      active = false;
      window.removeEventListener(QUESTS_UPDATED_EVENT, handleQuestUpdate);
    };
  }, [id]);

  useEffect(() => {
    let interval: number;
    if (isActive) {
      interval = window.setInterval(() => {
        setTimeElapsed(t => t + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isActive]);

  const handleStart = () => {
    setIsActive(true);
    setTimeElapsed(0);
  };

  const handleComplete = () => {
    if (!quest || !profile) return;

    setIsActive(false);

    // Add XP
    const updatedProfile = addXP(profile, quest.xp);

    // Add hidden rewards to accumulated points
    const newAccumulated: Attributes = { ...updatedProfile.accumulatedPoints };
    Object.keys(quest.hiddenRewards).forEach((key) => {
      const attr = key as keyof Attributes;
      newAccumulated[attr] += quest.hiddenRewards[attr] || 0;
    });

    const finalProfile = {
      ...updatedProfile,
      accumulatedPoints: newAccumulated,
    };

    saveUserProfile(finalProfile);
    completeQuest(quest.id);

    // Save attempt
    saveQuestAttempt({
      id: crypto.randomUUID(),
      questId: quest.id,
      userId: profile.id,
      timeTaken: timeElapsed,
      success: true,
      xpGained: quest.xp,
      timestamp: new Date().toISOString(),
    });

    toast.success('Quest Complete', {
      description: `+${quest.xp} XP earned. Hidden attributes accumulated.`,
    });

    setTimeout(() => navigate('/'), 1500);
  };

  if (!quest || !profile) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground font-mono-data">Quest not found</p>
      </div>
    );
  }

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const targetTime = quest.duration * 60;
  const isOvertime = timeElapsed > targetTime;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="container mx-auto px-4 py-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/')}
            className="mb-2 font-mono-data"
            disabled={isActive}
          >
            <ArrowLeft className="h-4 w-4 mr-1" />
            Return
          </Button>
          <h1 className="text-xl font-bold">Quest Session</h1>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8 max-w-2xl">
        {/* Quest Info */}
        <div className="bg-card border border-border p-6 mb-6">
          <div className="flex items-start justify-between mb-4">
            <div>
              <div className="text-xs font-mono-data text-muted-foreground mb-1">
                {quest.type.toUpperCase()} / LV.{quest.difficulty}
              </div>
              <h2 className="text-lg font-bold mb-2">{quest.title}</h2>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {quest.description}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 pt-4 border-t border-border">
            <div>
              <div className="text-xs text-muted-foreground mb-1">TARGET DURATION</div>
              <div className="font-mono-data text-lg">{quest.duration} minutes</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground mb-1">XP REWARD</div>
              <div className="font-mono-data text-lg">+{quest.xp}</div>
            </div>
          </div>
        </div>

        {/* Timer */}
        <div className="bg-surface border border-border p-8 mb-6 text-center">
          <div className="flex items-center justify-center gap-2 mb-2">
            <Clock className="h-5 w-5 text-muted-foreground" />
            <span className="text-xs font-mono-data text-muted-foreground">
              {isActive ? 'SESSION ACTIVE' : 'STANDBY'}
            </span>
          </div>
          <div className={`font-mono-data text-6xl font-bold mb-2 ${isOvertime ? 'text-critical' : ''}`}>
            {formatTime(timeElapsed)}
          </div>
          {isActive && (
            <div className="text-xs text-muted-foreground">
              {isOvertime ? 'OVERTIME' : `Target: ${formatTime(targetTime)}`}
            </div>
          )}
        </div>

        {/* Instructions */}
        {!isActive && !quest.completed && (
          <div className="bg-surface border border-border p-6 mb-6">
            <h3 className="font-bold mb-3 text-sm">Protocol Instructions</h3>
            <ol className="space-y-2 text-xs text-muted-foreground leading-relaxed">
              <li>1. Click START to begin timer and commence training</li>
              <li>2. Complete assigned objectives within target duration</li>
              <li>3. Click COMPLETE when all requirements satisfied</li>
              <li>4. Attribute development will be recorded automatically</li>
            </ol>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3">
          {!isActive && !quest.completed && (
            <Button
              onClick={handleStart}
              className="flex-1 font-mono-data"
            >
              START SESSION
            </Button>
          )}
          
          {isActive && (
            <Button
              onClick={handleComplete}
              className="flex-1 font-mono-data"
            >
              <CheckCircle2 className="h-4 w-4 mr-2" />
              MARK COMPLETE
            </Button>
          )}
        </div>

        {/* Note */}
        <div className="mt-6 bg-surface border border-border p-4">
          <p className="text-xs text-muted-foreground leading-relaxed">
            <span className="font-mono-data font-bold">NOTE:</span> Self-reporting system. 
            Accurate completion tracking improves adaptation algorithms. 
            Hidden attribute rewards applied immediately. Visible statistics update at level advancement.
          </p>
        </div>
      </div>
    </div>
  );
};

export default QuestSession;
