import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { PhysicalTraining } from '@/components/PhysicalTraining';
import { ScenarioDebrief } from '@/components/ScenarioDebrief';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { getUserProfile, saveUserProfile, addXP } from '@/lib/storage';
import { PhysicalWorkout, UserProfile, WorkoutAttempt } from '@/lib/types';
import { ArrowLeft, Dumbbell, Play, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { enhancePhysicalWorkouts } from '@/lib/lab-ai';
import { updatePhysicalCompletion } from '@/lib/achievements';
import { scaleHiddenRewards } from '@/lib/attribute-scaling';
import { scheduleSyncAfterGeneratedContentSave } from '@/lib/sync-manager';

const PhysicalLab = () => {
  const navigate = useNavigate();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [workouts, setWorkouts] = useState<PhysicalWorkout[]>([]);
  const [aiStatus, setAiStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [selectedWorkout, setSelectedWorkout] = useState<PhysicalWorkout | null>(null);
  const [workoutStartTime, setWorkoutStartTime] = useState<number>(0);
  const [showDebrief, setShowDebrief] = useState(false);
  const [debriefData, setDebriefData] = useState<any>(null);

  useEffect(() => {
    const loadData = async () => {
      const userProfile = getUserProfile();
      setProfile(userProfile);
      setAiStatus('loading');
      try {
        const aiWorkouts = await enhancePhysicalWorkouts(userProfile);
        setWorkouts(aiWorkouts);
        setAiStatus('ready');
      } catch (error) {
        console.error('Failed to load AI physical workouts:', error);
        setAiStatus('error');
      }
    };
    loadData();
  }, []);

  useEffect(() => {
    if (!selectedWorkout) return;
    // If the workout list is refreshed and the currently open workout no longer exists, exit safely.
    const exists = workouts.some((w) => w.id === selectedWorkout.id);
    if (!exists) setSelectedWorkout(null);
  }, [workouts, selectedWorkout]);

  const handleStartWorkout = (workout: PhysicalWorkout) => {
    const workoutCopy = {
      ...workout,
      exercises: workout.exercises.map(e => ({ ...e, completed: false }))
    };
    setSelectedWorkout(workoutCopy);
    setWorkoutStartTime(Date.now());
  };

  const handleExerciseComplete = (exerciseId: string) => {
    setSelectedWorkout((prev) => {
      if (!prev) return prev;
      const updatedExercises = prev.exercises.map((ex) =>
        ex.id === exerciseId ? { ...ex, completed: true } : ex
      );
      return { ...prev, exercises: updatedExercises };
    });

    toast.success('Exercise completed!');
  };

  const handleWorkoutComplete = () => {
    if (!selectedWorkout || !profile) return;

    const timeTaken = Math.floor((Date.now() - workoutStartTime) / 1000);
    const completedCount = selectedWorkout.exercises.filter(e => e.completed).length;
    const totalExercises = selectedWorkout.exercises.length;
    const completionRate = completedCount / totalExercises;
    const formRating = 85; // Could be user-rated in future

    // Create attempt record
    const attempt: WorkoutAttempt = {
      id: crypto.randomUUID(),
      workoutId: selectedWorkout.id,
      userId: profile.id,
      exercisesCompleted: selectedWorkout.exercises
        .filter(e => e.completed)
        .map(e => e.id),
      totalTime: timeTaken,
      formRating,
      success: completionRate >= 0.8,
      timestamp: new Date().toISOString()
    };

    // Apply hidden rewards first, then XP.
    // If XP triggers level-up, addXP() will convert accumulated points to visible stats.
    const withHidden = {
      ...profile,
      accumulatedPoints: { ...profile.accumulatedPoints },
    };
    const scaledHiddenRewards = scaleHiddenRewards(profile, selectedWorkout.hiddenRewards, {
      completionRatio: completionRate,
      baseMultiplier: 1,
      minCompletionRatio: 0.3,
    });
    const newAccumulated = { ...withHidden.accumulatedPoints };
    Object.entries(scaledHiddenRewards).forEach(([attr, value]) => {
      newAccumulated[attr as keyof typeof newAccumulated] += value || 0;
    });
    const updatedProfile = addXP({ ...withHidden, accumulatedPoints: newAccumulated }, selectedWorkout.xp);

    saveUserProfile(updatedProfile);
    setProfile(updatedProfile);
    // Ensure this session result is pushed promptly (bypass post-load cooldown).
    scheduleSyncAfterGeneratedContentSave();

    // Check for achievements
    const newAchievements = updatePhysicalCompletion(updatedProfile.level, updatedProfile.visibleStats);
    if (newAchievements.length > 0) {
      toast.success(`🏆 Achievement Unlocked! You unlocked ${newAchievements.length} new achievement${newAchievements.length > 1 ? 's' : ''}!`);
    }

    // Show debrief
    setDebriefData({
      workout: selectedWorkout,
      attempt,
      xpGained: selectedWorkout.xp,
      attributesGained: scaledHiddenRewards,
      performance: {
        completionRate: Math.round(completionRate * 100),
        timeTaken,
        formRating
      }
    });

    setShowDebrief(true);
    toast.success('Workout complete! Well done!');
  };

  const handleDebriefClose = () => {
    setShowDebrief(false);
    setSelectedWorkout(null);
    setDebriefData(null);
  };

  if (!profile) return null;

  if (showDebrief && debriefData) {
    return (
      <div className="min-h-screen bg-background">
        <header className="border-b border-border/40 bg-card/50 backdrop-blur supports-[backdrop-filter]:bg-card/50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 sm:py-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-center sm:text-left">
                <h1 className="text-xl sm:text-2xl font-bold text-primary data-readout tracking-wide">
                  PHYSICAL TRAINING LAB
                </h1>
                <p className="text-sm text-muted-foreground font-mono-data mt-1">Workout debrief</p>
              </div>
              <Badge variant={aiStatus === 'ready' ? 'default' : 'outline'} className="font-mono-data text-xs self-start sm:self-auto">
                ARCHITECT: {aiStatus === 'ready' ? 'OPTIMIZED' : 'CALIBRATING'}
              </Badge>
            </div>
          </div>
        </header>

        <div className="container mx-auto px-4 sm:px-6 py-6 sm:py-8 max-w-3xl">
          <ScenarioDebrief
            scenario={{
              id: debriefData.workout.id,
              title: debriefData.workout.title,
              description: debriefData.workout.description,
              difficulty: debriefData.workout.difficulty,
              xp: debriefData.workout.xp,
              hiddenRewards: debriefData.workout.hiddenRewards,
              context: 'Physical training session',
              initialNodeId: '',
              nodes: {},
              objectives: {
                primary: 'Complete all exercises with proper form',
                secondary: [
                  'Maintain consistent rest periods',
                  'Focus on form over speed'
                ]
              },
              optimalPath: []
            }}
            score={debriefData.performance.completionRate / 100}
            missedCues={[]}
            observationsUsed={0}
            timeTaken={debriefData.performance.timeTaken}
            pathTaken={debriefData.attempt.exercisesCompleted}
            rewards={debriefData.attributesGained}
          />
          
          <div className="mt-6">
            <Button onClick={handleDebriefClose} className="w-full">
              Continue
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (selectedWorkout) {
    return (
      <div className="min-h-screen bg-background">
        <header className="border-b border-border/40 bg-card/50 backdrop-blur supports-[backdrop-filter]:bg-card/50">
          <div className="max-w-7xl mx-auto px-3 sm:px-6 py-3 sm:py-5 space-y-3">
            <Button
              variant="ghost"
              size="sm"
              type="button"
              onClick={() => setSelectedWorkout(null)}
              className="mb-1 w-full sm:w-auto justify-start font-mono-data text-muted-foreground hover:text-primary"
            >
              <ArrowLeft className="h-4 w-4 mr-1 shrink-0" />
              Back to workouts
            </Button>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="text-center sm:text-left min-w-0 flex-1">
                <h1 className="text-lg sm:text-2xl font-bold text-primary flex flex-wrap items-center justify-center sm:justify-start gap-2 break-words">
                  <Dumbbell className="h-6 w-6 sm:h-7 sm:w-7 shrink-0 text-primary" aria-hidden />
                  <span className="data-readout">{selectedWorkout.title}</span>
                </h1>
                <p className="text-xs sm:text-sm text-muted-foreground mt-1.5 leading-snug max-w-3xl mx-auto sm:mx-0">
                  {selectedWorkout.description}
                </p>
              </div>
              <Badge
                variant={aiStatus === 'ready' ? 'default' : 'outline'}
                className="font-mono-data text-[10px] sm:text-xs self-center sm:self-start shrink-0 border-primary/30"
              >
                ARCHITECT: {aiStatus === 'ready' ? 'OPTIMIZED' : 'CALIBRATING'}
              </Badge>
            </div>
          </div>
        </header>

        <div className="max-w-3xl mx-auto w-full min-w-0 px-3 sm:px-6 py-4 sm:py-8">
          <PhysicalTraining
            key={selectedWorkout.id}
            exercises={selectedWorkout.exercises}
            onComplete={handleExerciseComplete}
            onWorkoutComplete={handleWorkoutComplete}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/40 bg-card/50 backdrop-blur supports-[backdrop-filter]:bg-card/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 sm:py-6">
          <div className="flex flex-col gap-3 sm:gap-4 md:flex-row md:items-center">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate(-1)}
              className="w-full md:w-auto justify-start font-mono-data"
            >
              <ArrowLeft className="h-4 w-4 mr-1" />
              Return
            </Button>
            <div className="flex-1 w-full text-center md:text-left">
              <h1 className="text-2xl sm:text-3xl font-bold flex flex-wrap items-center justify-center md:justify-start gap-2 sm:gap-3">
                <Dumbbell className="w-6 h-6 sm:w-8 sm:h-8 text-primary" />
                Physical Training Laboratory
              </h1>
              <p className="text-muted-foreground mt-1 text-sm">
                Exercise monitoring • Form analysis • Progress tracking
              </p>
            </div>
            <Badge
              variant={aiStatus === 'ready' ? 'default' : 'outline'}
              className="font-mono-data text-xs self-start md:self-auto"
            >
              ARCHITECT: {aiStatus === 'ready' ? 'OPTIMIZED' : aiStatus === 'loading' ? 'CALIBRATING' : 'OFFLINE'}
            </Badge>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        {aiStatus === 'loading' && (
          <div className="text-center text-muted-foreground py-8">
            <Dumbbell className="w-12 h-12 mx-auto mb-4 animate-pulse" />
            <p>ARCHITECT: CALIBRATING PHYSICAL PROTOCOLS...</p>
          </div>
        )}
        {aiStatus === 'error' && (
          <div className="text-center text-destructive py-8">
            <AlertTriangle className="w-12 h-12 mx-auto mb-4" />
            <p>ARCHITECT: OFFLINE. UNABLE TO CALIBRATE PHYSICAL PROTOCOLS.</p>
          </div>
        )}
        {aiStatus === 'ready' && workouts.length === 0 && (
          <div className="text-center text-muted-foreground py-8">
            <p>No physical workouts available from the Architect today.</p>
          </div>
        )}
        {aiStatus === 'ready' && workouts.length > 0 && (
        <div className="grid gap-5 sm:gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {workouts.map((workout) => (
            <Card key={workout.id} className="bg-surface border-border hover:border-primary/50 transition-all">
              <div className="p-6 space-y-4">
                <div className="flex items-start justify-between">
                  <div className="p-3 bg-primary/10 rounded-lg">
                    <Dumbbell className="w-6 h-6 text-primary" />
                  </div>
                  <Badge variant="secondary" className="font-mono-data text-xs">
                    LVL {workout.difficulty}/5
                  </Badge>
                </div>

                <div className="min-w-0">
                  <h3 className="text-base sm:text-lg font-bold mb-2 text-primary break-words">{workout.title}</h3>
                  <p className="text-xs sm:text-sm text-muted-foreground mb-2 line-clamp-3">
                    {workout.description}
                  </p>
                  {workout.aiContext && (
                    <p className="text-xs text-primary/70 font-mono-data">
                      {workout.aiContext}
                    </p>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="bg-background/50 p-2 rounded border border-border">
                    <div className="text-muted-foreground">EXERCISES</div>
                    <div className="font-bold">{workout.exercises.length}</div>
                  </div>
                  <div className="bg-background/50 p-2 rounded border border-border">
                    <div className="text-muted-foreground">DURATION</div>
                    <div className="font-bold">{workout.totalDuration}m</div>
                  </div>
                </div>

                <div className="pt-2 border-t border-border">
                  <div className="text-xs text-muted-foreground mb-1">REWARDS</div>
                  <div className="text-xs font-mono-data">+{workout.xp} XP</div>
                </div>

                <Button 
                  className="w-full"
                  onClick={() => handleStartWorkout(workout)}
                >
                  <Play className="w-4 h-4 mr-2" />
                  Start Workout
                </Button>
              </div>
            </Card>
          ))}
        </div>
        )}
      </div>
    </div>
  );
};

export default PhysicalLab;
