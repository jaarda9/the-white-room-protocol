import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { PhysicalTraining } from '@/components/PhysicalTraining';
import { ScenarioDebrief } from '@/components/ScenarioDebrief';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { getUserProfile, saveUserProfile, addXP } from '@/lib/storage';
import { PhysicalWorkout, PhysicalExercise, UserProfile, WorkoutAttempt } from '@/lib/types';
import { ArrowLeft, Dumbbell, Play } from 'lucide-react';
import { toast } from 'sonner';
import { enhancePhysicalWorkouts } from '@/lib/lab-ai';

const SAMPLE_WORKOUTS: PhysicalWorkout[] = [
  {
    id: 'strength-basics',
    title: 'Strength Fundamentals',
    description: 'Build foundational strength with compound movements',
    difficulty: 2,
    xp: 150,
    totalDuration: 30,
    hiddenRewards: { STR: 3, VIT: 2, AGI: 1 },
    exercises: [
      {
        id: 'pushups',
        name: 'Push-ups',
        sets: 3,
        reps: 15,
        duration: 0,
        restPeriod: 60,
        type: 'strength',
        formCues: [
          'Keep core tight and body straight',
          'Lower until chest nearly touches ground',
          'Push through palms, not fingers',
          'Full range of motion each rep'
        ],
        completed: false
      },
      {
        id: 'squats',
        name: 'Bodyweight Squats',
        sets: 3,
        reps: 20,
        duration: 0,
        restPeriod: 60,
        type: 'strength',
        formCues: [
          'Feet shoulder-width apart',
          'Lower until thighs parallel to ground',
          'Keep knees tracking over toes',
          'Drive through heels to stand'
        ],
        completed: false
      },
      {
        id: 'plank',
        name: 'Plank Hold',
        sets: 3,
        duration: 45,
        restPeriod: 45,
        type: 'strength',
        formCues: [
          'Forearms flat, elbows under shoulders',
          'Body forms straight line',
          'Engage core throughout',
          'Breathe steadily'
        ],
        completed: false
      }
    ]
  },
  {
    id: 'cardio-endurance',
    title: 'Cardio Conditioning',
    description: 'Improve cardiovascular endurance and stamina',
    difficulty: 3,
    xp: 180,
    totalDuration: 25,
    hiddenRewards: { VIT: 3, AGI: 2, STR: 1 },
    exercises: [
      {
        id: 'jumping-jacks',
        name: 'Jumping Jacks',
        sets: 3,
        duration: 60,
        restPeriod: 30,
        type: 'cardio',
        formCues: [
          'Jump with feet wide, arms overhead',
          'Land softly on balls of feet',
          'Maintain steady rhythm',
          'Keep core engaged'
        ],
        completed: false
      },
      {
        id: 'high-knees',
        name: 'High Knees',
        sets: 3,
        duration: 45,
        restPeriod: 45,
        type: 'cardio',
        formCues: [
          'Drive knees up to hip height',
          'Quick, explosive movements',
          'Pump arms in running motion',
          'Stay on balls of feet'
        ],
        completed: false
      },
      {
        id: 'burpees',
        name: 'Burpees',
        sets: 3,
        reps: 10,
        duration: 0,
        restPeriod: 60,
        type: 'cardio',
        formCues: [
          'Drop to plank position',
          'Perform push-up',
          'Jump feet to hands',
          'Explosive jump at top'
        ],
        completed: false
      }
    ]
  },
  {
    id: 'mobility-flow',
    title: 'Mobility & Flexibility',
    description: 'Enhance range of motion and prevent injury',
    difficulty: 1,
    xp: 100,
    totalDuration: 20,
    hiddenRewards: { AGI: 3, VIT: 2 },
    exercises: [
      {
        id: 'cat-cow',
        name: 'Cat-Cow Stretch',
        sets: 3,
        duration: 60,
        restPeriod: 30,
        type: 'flexibility',
        formCues: [
          'Start on hands and knees',
          'Arch back, lift head (cow)',
          'Round spine, tuck chin (cat)',
          'Move with breath, smooth flow'
        ],
        completed: false
      },
      {
        id: 'hip-circles',
        name: 'Hip Circles',
        sets: 2,
        reps: 10,
        duration: 0,
        restPeriod: 20,
        type: 'flexibility',
        formCues: [
          'Hands on hips, feet shoulder-width',
          'Large circular motion',
          'Do both directions',
          'Keep core stable'
        ],
        completed: false
      },
      {
        id: 'child-pose',
        name: "Child's Pose",
        sets: 2,
        duration: 90,
        restPeriod: 30,
        type: 'flexibility',
        formCues: [
          'Sit back on heels',
          'Extend arms forward',
          'Rest forehead on ground',
          'Deep, relaxed breathing'
        ],
        completed: false
      }
    ]
  }
];

const PhysicalLab = () => {
  const navigate = useNavigate();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [workouts, setWorkouts] = useState<PhysicalWorkout[]>(SAMPLE_WORKOUTS);
  const [aiStatus, setAiStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
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
    enhancePhysicalWorkouts(profile, SAMPLE_WORKOUTS)
      .then(data => {
        if (!active) return;
        setWorkouts(data);
        setAiStatus('ready');
        setSelectedWorkout(prev => (prev ? data.find(w => w.id === prev.id) ?? prev : prev));
      })
      .catch(error => {
        console.warn('Physical lab AI enhancement failed:', error);
        if (active) setAiStatus(prev => (prev === 'ready' ? prev : 'error'));
      });
    return () => {
      active = false;
    };
  }, [profile]);

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
        <header className="border-b border-border bg-card">
          <div className="container mx-auto px-4 py-4">
            <h1 className="text-xl font-bold tracking-tight">PHYSICAL TRAINING LAB</h1>
            <p className="text-xs text-muted-foreground font-mono-data mt-0.5">
              Workout Debrief
            </p>
          </div>
        </header>

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
        <header className="border-b border-border bg-card">
          <div className="container mx-auto px-4 py-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSelectedWorkout(null)}
              className="mb-2"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Workouts
            </Button>
            <h1 className="text-xl font-bold tracking-tight">{selectedWorkout.title}</h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              {selectedWorkout.description}
            </p>
          </div>
        </header>

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
      <header className="border-b border-border bg-card">
          <div className="container mx-auto px-4 py-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/')}
            className="mb-2"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Dashboard
          </Button>
          <h1 className="text-xl font-bold tracking-tight">PHYSICAL TRAINING LAB</h1>
          <p className="text-xs text-muted-foreground font-mono-data mt-0.5">
            Exercise Monitoring • Form Analysis • Progress Tracking
          </p>
            <div className="mt-2">
              <Button variant="outline" size="sm" className="font-mono text-xs" disabled>
                ARCHITECT: {aiStatus === 'ready' ? 'OPTIMIZED' : aiStatus === 'loading' ? 'CALIBRATING' : aiStatus === 'error' ? 'OFFLINE' : 'STANDBY'}
              </Button>
            </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8 max-w-5xl">
        <div className="mb-8">
          <p className="text-muted-foreground mb-6">
            Build strength, endurance, and flexibility through structured workouts with 
            real-time timers, form guidance, and rest period management.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {workouts.map((workout) => (
            <Card key={workout.id} className="bg-surface border-border hover:border-primary/50 transition-all">
              <div className="p-6 space-y-4">
                <div className="flex items-start justify-between">
                  <div className="p-3 bg-primary/10 rounded-lg">
                    <Dumbbell className="w-6 h-6 text-primary" />
                  </div>
                  <div className="text-right">
                    <div className="text-xs font-mono text-muted-foreground">DIFFICULTY</div>
                    <div className="text-lg font-bold">
                      {'★'.repeat(workout.difficulty)}
                      {'☆'.repeat(5 - workout.difficulty)}
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="text-lg font-bold mb-2">{workout.title}</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    {workout.description}
                  </p>
                  {workout.aiContext && (
                    <p className="text-xs text-primary/70 font-mono mb-2">
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
      </div>
    </div>
  );
};

export default PhysicalLab;
