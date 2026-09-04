import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { PhysicalTraining } from '@/components/PhysicalTraining';
import { ScenarioDebrief } from '@/components/ScenarioDebrief';
import { SoloLevelingHeader } from '@/components/SoloLevelingHeader';
import { getUserProfile, saveUserProfile, addXP } from '@/lib/storage';
import { PhysicalWorkout, UserProfile, WorkoutAttempt } from '@/lib/types';
import { ArrowLeft, Dumbbell, Play, AlertTriangle, Shield, Check } from 'lucide-react';
import { toast } from 'sonner';
import { enhancePhysicalWorkouts, markPhysicalWorkoutCompleted } from '@/lib/lab-ai';
import { updatePhysicalCompletion } from '@/lib/achievements';
import { scaleHiddenRewards } from '@/lib/attribute-scaling';
import { scheduleSyncAfterGeneratedContentSave } from '@/lib/sync-manager';
import { systemSound } from '@/lib/system-sound';

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
        console.error('Failed to load physical workouts:', error);
        setAiStatus('error');
      }
    };
    loadData();
  }, []);

  const handleStartWorkout = (workout: PhysicalWorkout) => {
    systemSound.playClick();
    if (workout.completedAt) {
      toast.info('This training protocol is already completed today.');
      return;
    }
    const workoutCopy = {
      ...workout,
      exercises: workout.exercises.map(e => ({ ...e, completed: false }))
    };
    setSelectedWorkout(workoutCopy);
    setWorkoutStartTime(Date.now());
  };

  const handleExerciseComplete = (exerciseId: string) => {
    systemSound.playSystemChime();
    setSelectedWorkout((prev) => {
      if (!prev) return prev;
      const updatedExercises = prev.exercises.map((ex) =>
        ex.id === exerciseId ? { ...ex, completed: true } : ex
      );
      return { ...prev, exercises: updatedExercises };
    });
  };

  const handleWorkoutComplete = () => {
    if (!selectedWorkout || !profile) return;
    systemSound.playLevelUp();

    const timeTaken = Math.floor((Date.now() - workoutStartTime) / 1000);
    const completedCount = selectedWorkout.exercises.filter(e => e.completed).length;
    const totalExercises = selectedWorkout.exercises.length;
    const completionRate = completedCount / totalExercises;

    const attempt: WorkoutAttempt = {
      id: crypto.randomUUID(),
      workoutId: selectedWorkout.id,
      userId: profile.id,
      exercisesCompleted: selectedWorkout.exercises.filter(e => e.completed).map(e => e.id),
      totalTime: timeTaken,
      formRating: 90,
      success: completionRate >= 0.8,
      timestamp: new Date().toISOString()
    };

    const scaledRewards = scaleHiddenRewards(profile, selectedWorkout.hiddenRewards, {
      completionRatio: completionRate,
      baseMultiplier: 1,
      minCompletionRatio: 0.3,
    });

    const withHidden = {
      ...profile,
      accumulatedPoints: { ...profile.accumulatedPoints },
    };
    Object.entries(scaledRewards).forEach(([attr, value]) => {
      withHidden.accumulatedPoints[attr as keyof typeof withHidden.accumulatedPoints] += value || 0;
    });
    const updatedProfile = addXP(withHidden, selectedWorkout.xp);

    saveUserProfile(updatedProfile);
    setProfile(updatedProfile);
    scheduleSyncAfterGeneratedContentSave();

    const completedAt = new Date().toISOString();
    const syncedWorkouts =
      markPhysicalWorkoutCompleted(selectedWorkout.id, completedAt) ||
      workouts.map((w) => (w.id === selectedWorkout.id ? { ...w, completedAt } : w));
    setWorkouts(syncedWorkouts);

    setDebriefData({
      workout: { ...selectedWorkout, completedAt },
      attempt,
      xpGained: selectedWorkout.xp,
      attributesGained: scaledRewards,
      performance: {
        completionRate: Math.round(completionRate * 100),
        timeTaken,
        formRating: 90,
      }
    });

    setShowDebrief(true);
  };

  if (!profile) return null;

  return (
    <div className="min-h-screen bg-[#071322] text-[#e5ecf4] flex flex-col system-blueprint-bg font-mono">
      <SoloLevelingHeader />

      <main className="max-w-4xl mx-auto w-full px-4 py-8 flex-1">
        {/* Navigation Breadcrumb */}
        <div className="flex items-center justify-between mb-6">
          <button
            onClick={() => {
              systemSound.playClick();
              if (selectedWorkout) setSelectedWorkout(null);
              else navigate('/');
            }}
            className="flex items-center gap-2 px-3 py-1.5 border border-white/50 bg-[#061426]/80 text-[#9fd3ff] text-xs font-mono hover:bg-white/10 hover:border-white transition-all shadow-[0_0_10px_rgba(0,212,255,0.2)]"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>[ RETURN TO STATUS ]</span>
          </button>
        </div>

        {/* Selected Workout Infiltration */}
        {selectedWorkout ? (
          <div className="relative bg-[#0a1b2e]/90 border-2 border-white/50 rounded-[4px] p-6 sm:p-8 text-white shadow-[0_0_30px_rgba(0,0,0,0.85),inset_0_0_24px_rgba(0,212,255,0.08)] backdrop-blur-md anime-dropdown space-y-6">
            <div className="border-b border-white/20 pb-4 text-center">
              <div className="inline-block px-8 py-1 border border-white/70 bg-[#061426]/60 shadow-[0_0_14px_rgba(0,212,255,0.35)] mb-2">
                <h2 className="text-xl sm:text-2xl font-mono font-bold text-white anime-glow-text tracking-[0.2em]">
                  {selectedWorkout.title}
                </h2>
              </div>
              <p className="text-xs font-mono text-white/80 mt-1">
                {selectedWorkout.description}
              </p>
            </div>

            <PhysicalTraining
              key={selectedWorkout.id}
              exercises={selectedWorkout.exercises}
              onComplete={handleExerciseComplete}
              onWorkoutComplete={handleWorkoutComplete}
            />
          </div>
        ) : showDebrief && debriefData ? (
          <div className="relative max-w-xl mx-auto bg-[#0a1b2e]/90 border-2 border-white/50 rounded-[4px] p-6 sm:p-8 text-white shadow-[0_0_30px_rgba(0,0,0,0.85),inset_0_0_24px_rgba(0,212,255,0.08)] backdrop-blur-md anime-dropdown space-y-6 text-center">
            <div className="border-b border-white/20 pb-4">
              <div className="inline-block px-8 py-1 border border-white/70 bg-[#061426]/60 shadow-[0_0_14px_rgba(0,212,255,0.35)] mb-2">
                <h2 className="text-xl sm:text-2xl font-mono font-bold text-white anime-glow-text tracking-[0.2em]">
                  DUNGEON CLEARED
                </h2>
              </div>
              <div className="text-emerald-400 font-mono text-sm mt-1 anime-glow-text">
                +{debriefData.xpGained} XP ACQUIRED
              </div>
            </div>

            <div className="p-4 bg-[#061424]/75 border border-white/45 font-mono text-xs space-y-2 rounded-[2px]">
              <div>COMPLETION RATE: {debriefData.performance.completionRate}%</div>
              <div>TIME ELAPSED: {debriefData.performance.timeTaken}s</div>
            </div>

            <button
              onClick={() => {
                setShowDebrief(false);
                setSelectedWorkout(null);
                setDebriefData(null);
              }}
              className="w-full py-3 border border-white/60 bg-white/10 hover:bg-white/25 text-white font-mono font-bold text-xs tracking-wider transition-all shadow-[0_0_15px_rgba(0,212,255,0.2)]"
            >
              CONFIRM REWARDS & RETURN
            </button>
          </div>
        ) : (
          /* Main Dungeon Gate List */
          <div className="space-y-6">
            <div className="relative bg-[#0a1b2e]/90 border-2 border-white/50 rounded-[4px] p-6 text-center text-white shadow-[0_0_30px_rgba(0,0,0,0.85),inset_0_0_24px_rgba(0,212,255,0.08)] backdrop-blur-md anime-dropdown">
              <div className="inline-block px-4 sm:px-8 py-1 border border-white/70 bg-[#061426]/60 shadow-[0_0_14px_rgba(0,212,255,0.35)] mb-2 max-w-full">
                <h2 className="text-sm sm:text-xl md:text-2xl font-mono font-bold text-white anime-glow-text tracking-[0.1em] sm:tracking-[0.2em]">
                  PHYSICAL GATE
                </h2>
              </div>
              <p className="text-xs font-mono text-white/80 mt-1">
                High-gravity kinetic resistance dungeon for muscular conditioning and agility ascension.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {workouts.map((workout) => (
                <div
                  key={workout.id}
                  className="bg-[#0a1b2e]/85 border-2 border-white/40 rounded-[4px] p-5 space-y-4 hover:border-white/90 hover:bg-[#0a1b2e] transition-all flex flex-col justify-between shadow-[0_0_20px_rgba(0,0,0,0.7),inset_0_0_15px_rgba(0,212,255,0.05)] anime-dropdown"
                >
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-mono px-2 py-0.5 border border-white/40 text-[#9fd3ff] bg-black/50">
                        RANK {workout.difficulty}
                      </span>
                      <span className="text-xs font-mono text-emerald-400 font-bold">
                        +{workout.xp} XP
                      </span>
                    </div>

                    <h3 className="font-mono font-bold text-base text-white">
                      {workout.title}
                    </h3>
                    <p className="text-xs font-mono text-gray-300 mt-1 line-clamp-2">
                      {workout.description}
                    </p>
                  </div>

                  <div className="pt-3 border-t border-white/20 flex items-center justify-between">
                    <span className="text-xs font-mono text-gray-400">
                      {workout.exercises.length} Exercises • {workout.totalDuration}m
                    </span>
                    <button
                      onClick={() => handleStartWorkout(workout)}
                      className={`px-4 py-1.5 font-mono text-xs font-bold transition-all ${
                        workout.completedAt
                          ? 'border border-gray-700 bg-black/40 text-gray-500'
                          : 'border border-white/60 bg-white/10 text-white hover:bg-white/25 hover:border-white shadow-[0_0_10px_rgba(0,212,255,0.2)]'
                      }`}
                    >
                      {workout.completedAt ? 'CLEARED' : 'ENTER GATE'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default PhysicalLab;
