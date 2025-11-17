import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { PhysicalTraining } from '@/components/PhysicalTraining';
import { ScenarioDebrief } from '@/components/ScenarioDebrief';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { getUserProfile, saveUserProfile, addXP } from '@/lib/storage';
import { PhysicalWorkout, PhysicalExercise, UserProfile, WorkoutAttempt } from '@/lib/types';
import { ArrowLeft, Dumbbell, Play } from 'lucide-react';
import { toast } from 'sonner';
import { enhancePhysicalWorkouts } from '@/lib/lab-ai';

const PhysicalLab = () => {
  const navigate = useNavigate();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [workouts, setWorkouts] = useState<PhysicalWorkout[]>([]);
  const [aiStatus, setAiStatus] = useState<'idle' | 'loading' | 'ready'>('idle');
  const [selectedWorkout, setSelectedWorkout] = useState<PhysicalWorkout | null>(null);
  const [workoutStartTime, setWorkoutStartTime] = useState<number>(0);
  const [showDebrief, setShowDebrief] = useState(false);
  const [debriefData, setDebriefData] = useState<any>(null);

  useEffect(() => {
    setProfile(getUserProfile());
  }, []);

  useEffect(() => {
    if (!profile) return;
    let active = true;
    setAiStatus(prev => (prev === 'ready' ? prev : 'loading'));
    let active = true;
    let retryTimer: number | undefined;

    const loadWorkouts = async () => {
      if (!active) return;
      setAiStatus('loading');
      try {
        const data = await enhancePhysicalWorkouts(profile);
        if (!active) return;
        setWorkouts(data);
        setAiStatus('ready');
      } catch (error) {
        console.warn('Physical lab AI enhancement failed, retrying...', error);
        if (!active) return;
        retryTimer = window.setTimeout(loadWorkouts, 5000);
      }
    };

    loadWorkouts();

    return () => {
      active = false;
      if (retryTimer) window.clearTimeout(retryTimer);
    };
  }, [profile]);

  useEffect(() => {
    if (!selectedWorkout) return;
    const updated = workouts.find(w => w.id === selectedWorkout.id);
    if (!updated) {
      setSelectedWorkout(null);
    } else {
      setSelectedWorkout(updated);
    }
  }, [workouts]);

  const handleStartWorkout = (workout: PhysicalWorkout) => {
    const workoutCopy = {
      ...workout,
      exercises: workout.exercises.map(e => ({ ...e, completed: false }))
    };
    setSelectedWorkout(workoutCopy);
    setWorkoutStartTime(Date.now());
  };

  const handleExerciseComplete = (exerciseId: string) => {
    if (!selectedWorkout) return;

    const updatedExercises = selectedWorkout.exercises.map(ex =>
      ex.id === exerciseId ? { ...ex, completed: true } : ex
    );

    setSelectedWorkout({
      ...selectedWorkout,
      exercises: updatedExercises
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

    // Calculate rewards
    let updatedProfile = addXP(profile, selectedWorkout.xp);
    
    // Apply hidden attribute rewards
    const newAccumulated = { ...updatedProfile.accumulatedPoints };
    Object.entries(selectedWorkout.hiddenRewards).forEach(([attr, value]) => {
      newAccumulated[attr as keyof typeof newAccumulated] += value || 0;
    });
    updatedProfile = { ...updatedProfile, accumulatedPoints: newAccumulated };

    saveUserProfile(updatedProfile);
    setProfile(updatedProfile);

    // Show debrief
    setDebriefData({
      workout: selectedWorkout,
      attempt,
      xpGained: selectedWorkout.xp,
      attributesGained: selectedWorkout.hiddenRewards,
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
        <div className="border-b border-border/40 bg-card/50 backdrop-blur supports-[backdrop-filter]:bg-card/50">
          <div className="max-w-7xl mx-auto px-4 py-6">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h1 className="text-2xl font-mono tracking-tight">PHYSICAL TRAINING LAB</h1>
                <p className="text-sm text-muted">Workout debrief</p>
              </div>
              <Badge variant={aiStatus === 'ready' ? 'default' : 'outline'} className="font-mono text-xs">
                ARCHITECT: {aiStatus === 'ready' ? 'OPTIMIZED' : 'CALIBRATING'}
              </Badge>
            </div>
          </div>
        </div>

        <div className="container mx-auto px-4 py-8 max-w-3xl">
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
        <div className="border-b border-border/40 bg-card/50 backdrop-blur supports-[backdrop-filter]:bg-card/50">
          <div className="max-w-7xl mx-auto px-4 py-6 space-y-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSelectedWorkout(null)}
              className="mb-1"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div className="flex items-center justify-between gap-4">
              <div>
                <h1 className="text-2xl font-mono tracking-tight">{selectedWorkout.title}</h1>
                <p className="text-sm text-muted">{selectedWorkout.description}</p>
              </div>
              <Badge variant={aiStatus === 'ready' ? 'default' : 'outline'} className="font-mono text-xs">
                ARCHITECT: {aiStatus === 'ready' ? 'OPTIMIZED' : 'CALIBRATING'}
              </Badge>
            </div>
          </div>
        </div>

        <div className="container mx-auto px-4 py-8 max-w-3xl">
          <PhysicalTraining
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
      <div className="border-b border-border/40 bg-card/50 backdrop-blur supports-[backdrop-filter]:bg-card/50">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate('/')}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div className="flex-1">
              <h1 className="text-2xl font-mono tracking-tight">PHYSICAL TRAINING LAB</h1>
              <p className="text-sm text-muted">Exercise monitoring • Form analysis • Progress tracking</p>
            </div>
            <Badge variant={aiStatus === 'ready' ? 'default' : 'outline'} className="font-mono text-xs">
              ARCHITECT: {aiStatus === 'ready' ? 'OPTIMIZED' : 'CALIBRATING'}
            </Badge>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8 max-w-5xl">
        <div className="mb-8">
          <p className="text-muted-foreground mb-6">
            Build strength, endurance, and flexibility through structured workouts with 
            real-time timers, form guidance, and rest period management.
          </p>
        </div>

        {aiStatus !== 'ready' ? (
          <Card className="p-6 border-dashed border-border text-center text-sm text-muted-foreground font-mono">
            ARCHITECT: Calibrating physical protocols...
          </Card>
        ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {workouts.map((workout) => (
            <Card key={workout.id} className="bg-surface border-border hover:border-primary/50 transition-all">
              <div className="p-6 space-y-4">
                <div className="flex items-start justify-between">
                  <div className="p-3 bg-primary/10 rounded-lg">
                    <Dumbbell className="w-6 h-6 text-primary" />
                  </div>
                  <Badge variant="secondary" className="font-mono text-xs">
                    LVL {workout.difficulty}/5
                  </Badge>
                </div>

                <div>
                  <h3 className="text-lg font-bold mb-2">{workout.title}</h3>
                  <p className="text-sm text-muted-foreground mb-2">
                    {workout.description}
                  </p>
                  {workout.aiContext && (
                    <p className="text-xs text-primary/70 font-mono">
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
                  <div className="text-xs font-mono">+{workout.xp} XP</div>
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
