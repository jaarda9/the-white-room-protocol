import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import {
  getUserProfile,
  getDailyQuests,
  completeQuest,
  saveUserProfile,
  addXP,
  saveQuestAttempt,
  QUESTS_UPDATED_EVENT,
  getPhysicalQuestLog,
  savePhysicalQuestLog,
  type PhysicalExerciseLog,
} from '@/lib/storage';
import { Quest, UserProfile, Attributes } from '@/lib/types';
import { scaleHiddenRewards } from '@/lib/attribute-scaling';
import { updateQuestCompletion } from '@/lib/achievements';
import { ArrowLeft, Clock, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';

const QuestSession = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [quest, setQuest] = useState<Quest | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [timeElapsed, setTimeElapsed] = useState(0);
  const [isActive, setIsActive] = useState(false);
  const startedAtMsRef = useRef<number | null>(null);
  const [physicalLogRows, setPhysicalLogRows] = useState<PhysicalExerciseLog[]>([]);

  const isPhysicalQuest = quest?.type === 'physical';
  const todayKey = new Date().toISOString().slice(0, 10);

  const parsePhysicalExercises = (description: string): string[] => {
    const trimmed = description.trim();
    if (!trimmed) return [];
    if (trimmed.includes('•')) {
      return trimmed
        .split('•')
        .map((s) => s.trim())
        .filter(Boolean);
    }
    return [trimmed];
  };

  const buildDefaultPhysicalRows = (description: string): PhysicalExerciseLog[] =>
    parsePhysicalExercises(description).map((exercise) => ({
      exercise,
      sets: '',
      reps: '',
      weightKg: '',
      notes: '',
    }));

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
    if (!quest || quest.type !== 'physical') return;
    const saved = getPhysicalQuestLog(quest.id, todayKey);
    if (saved && saved.length > 0) {
      setPhysicalLogRows(saved);
      return;
    }
    setPhysicalLogRows(buildDefaultPhysicalRows(quest.description));
  }, [quest, todayKey]);

  useEffect(() => {
    if (!quest || quest.type !== 'physical') return;
    if (physicalLogRows.length === 0) return;
    savePhysicalQuestLog(quest.id, todayKey, physicalLogRows);
  }, [quest, todayKey, physicalLogRows]);

  useEffect(() => {
    if (!isActive) return;
    const startedAtMs = startedAtMsRef.current;
    if (!startedAtMs) return;

    const computeAndSet = () => {
      const elapsedSeconds = Math.max(0, Math.floor((Date.now() - startedAtMs) / 1000));
      setTimeElapsed(elapsedSeconds);
    };

    // Use Date.now deltas so the timer remains accurate in background/throttled tabs.
    computeAndSet();
    const intervalId = window.setInterval(computeAndSet, 500);

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') computeAndSet();
    };
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      clearInterval(intervalId);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [isActive]);

  const handleStart = () => {
    setIsActive(true);
    startedAtMsRef.current = Date.now();
    setTimeElapsed(0);
  };

  const handleComplete = () => {
    if (!quest || !profile) return;

    setIsActive(false);
    const finalTimeElapsed =
      startedAtMsRef.current !== null
        ? Math.max(0, Math.floor((Date.now() - startedAtMsRef.current) / 1000))
        : timeElapsed;

    const targetTimeSeconds = Math.max(1, quest.duration * 60);
    const completionRatio = Math.min(1, finalTimeElapsed / targetTimeSeconds);
    const rawXp = quest.xp * completionRatio;
    const xpEarned = finalTimeElapsed > 0 ? Math.max(1, Math.round(rawXp)) : 0;

    // Hidden rewards scale with completion ratio and a global balance multiplier.
    // Rewards below 30% completion are discarded to prevent ultra-short farming.
    const HIDDEN_REWARD_MULTIPLIER = 0.4;
    const MIN_RATIO_FOR_HIDDEN_REWARDS = 0.3;
    const scaledHiddenRewards: Partial<Attributes> = scaleHiddenRewards(
      profile,
      quest.hiddenRewards,
      {
        completionRatio,
        baseMultiplier: HIDDEN_REWARD_MULTIPLIER,
        minCompletionRatio: MIN_RATIO_FOR_HIDDEN_REWARDS,
      }
    );

    // Add scaled hidden rewards first, then apply XP.
    // If this completion causes a level-up, addXP() will convert accumulated points to visible stats.
    const withHidden: UserProfile = {
      ...profile,
      accumulatedPoints: { ...profile.accumulatedPoints },
    };
    Object.keys(scaledHiddenRewards).forEach((key) => {
      const attr = key as keyof Attributes;
      withHidden.accumulatedPoints[attr] += scaledHiddenRewards[attr] || 0;
    });
    const finalProfile = addXP(withHidden, xpEarned);

    saveUserProfile(finalProfile);
    completeQuest(quest.id);
    updateQuestCompletion();

    // Save attempt
    saveQuestAttempt({
      id: crypto.randomUUID(),
      questId: quest.id,
      userId: profile.id,
      timeTaken: finalTimeElapsed,
      success: true,
      xpGained: xpEarned,
      timestamp: new Date().toISOString(),
    });

    toast.success('Quest Complete', {
      description: `+${xpEarned} XP earned (${Math.round(completionRatio * 100)}% of target).`,
    });

    startedAtMsRef.current = null;
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

  const updatePhysicalLogCell = (
    rowIndex: number,
    field: keyof Pick<PhysicalExerciseLog, 'sets' | 'reps' | 'weightKg' | 'notes'>
  ) => (value: string) => {
    setPhysicalLogRows((prev) =>
      prev.map((row, idx) => (idx === rowIndex ? { ...row, [field]: value } : row))
    );
  };

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

        {/* Physical Protocol UI */}
        {isPhysicalQuest && (
          <div className="bg-card border border-border p-6 mb-6">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold text-sm">Daily Physical Protocol</h3>
              <span className="text-xs text-muted-foreground font-mono-data">{todayKey}</span>
            </div>
            <p className="text-xs text-muted-foreground mb-4">
              Log sets, reps, and weight for future trend analysis.
            </p>
            <div className="space-y-3">
              {physicalLogRows.map((row, idx) => (
                <div key={`${row.exercise}-${idx}`} className="border border-border p-3 bg-surface">
                  <div className="text-sm font-medium mb-2">{row.exercise}</div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    <input
                      value={row.sets}
                      onChange={(e) => updatePhysicalLogCell(idx, 'sets')(e.target.value)}
                      placeholder="Sets"
                      className="bg-background border border-border px-2 py-1.5 text-xs"
                    />
                    <input
                      value={row.reps}
                      onChange={(e) => updatePhysicalLogCell(idx, 'reps')(e.target.value)}
                      placeholder="Reps"
                      className="bg-background border border-border px-2 py-1.5 text-xs"
                    />
                    <input
                      value={row.weightKg}
                      onChange={(e) => updatePhysicalLogCell(idx, 'weightKg')(e.target.value)}
                      placeholder="Weight (kg)"
                      className="bg-background border border-border px-2 py-1.5 text-xs"
                    />
                    <input
                      value={row.notes}
                      onChange={(e) => updatePhysicalLogCell(idx, 'notes')(e.target.value)}
                      placeholder="Notes"
                      className="bg-background border border-border px-2 py-1.5 text-xs"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

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
            Hidden attribute rewards accumulate in reserve. Visible statistics update only when leveling up.
          </p>
        </div>
      </div>
    </div>
  );
};

export default QuestSession;
