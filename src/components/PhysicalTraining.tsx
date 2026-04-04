import { useState, useEffect, useRef } from 'react';
import { PhysicalExercise } from '@/lib/types';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Play, Pause, RotateCcw, CheckCircle2, AlertCircle, Dumbbell } from 'lucide-react';

interface PhysicalTrainingProps {
  exercises: PhysicalExercise[];
  onComplete: (exerciseId: string) => void;
  onWorkoutComplete: () => void;
}

export const PhysicalTraining = ({
  exercises,
  onComplete,
  onWorkoutComplete,
}: PhysicalTrainingProps) => {
  const [currentExerciseIndex, setCurrentExerciseIndex] = useState(0);
  const [isActive, setIsActive] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [isResting, setIsResting] = useState(false);
  const [currentSet, setCurrentSet] = useState(1);

  const endAtMsRef = useRef<number | null>(null);
  const remainingAtPauseRef = useRef<number>(0);
  const didTimeUpRef = useRef(false);
  /** Avoid double-calling parent when `onWorkoutComplete` identity changes and effect re-runs */
  const workoutCompleteFiredRef = useRef(false);

  const liveRef = useRef({
    isResting,
    currentSet,
    currentExerciseIndex,
    currentExercise: exercises[0],
    exercises,
  });
  liveRef.current = {
    isResting,
    currentSet,
    currentExerciseIndex,
    currentExercise: exercises[currentExerciseIndex] ?? exercises[0],
    exercises,
  };

  const onTimerFireRef = useRef<() => void>(() => {});

  const currentExercise = exercises[currentExerciseIndex];
  const completedCount = exercises.filter((e) => e.completed).length;
  const progressPercent = exercises.length > 0 ? (completedCount / exercises.length) * 100 : 0;

  useEffect(() => {
    workoutCompleteFiredRef.current = false;
  }, [exercises]);

  const advanceToNextExercise = () => {
    setTimeout(() => {
      setCurrentExerciseIndex((i) => {
        const len = liveRef.current.exercises.length;
        return i < len - 1 ? i + 1 : i;
      });
    }, 500);
  };

  const completeCurrentExercise = () => {
    const ex = liveRef.current.currentExercise;
    if (!ex) return;
    endAtMsRef.current = null;
    didTimeUpRef.current = false;
    onComplete(ex.id);
    setIsActive(false);
    setIsResting(false);
    setCurrentSet(1);
    advanceToNextExercise();
  };

  onTimerFireRef.current = () => {
    didTimeUpRef.current = true;
    const { isResting: resting, currentSet: setNum, currentExercise: ex } = liveRef.current;
    if (!ex) return;

    if (resting) {
      endAtMsRef.current = null;
      setIsResting(false);
      setIsActive(false);
      return;
    }

    const hasMultiSets = Boolean(ex.sets && ex.sets > 1);
    if (hasMultiSets && setNum < (ex.sets as number)) {
      setCurrentSet(setNum + 1);
      didTimeUpRef.current = false;
      setIsResting(true);
      const restSec = Math.max(0, ex.restPeriod ?? 0);
      setTimeRemaining(restSec);
      endAtMsRef.current = Date.now() + restSec * 1000;
      setIsActive(true);
      return;
    }

    completeCurrentExercise();
  };

  useEffect(() => {
    if (completedCount === exercises.length && exercises.length > 0 && !workoutCompleteFiredRef.current) {
      workoutCompleteFiredRef.current = true;
      onWorkoutComplete();
    }
  }, [completedCount, exercises.length, onWorkoutComplete]);

  useEffect(() => {
    if (!isActive || isPaused) return;
    if (endAtMsRef.current === null) return;

    const computeRemaining = () => {
      const endAtMs = endAtMsRef.current;
      if (endAtMs === null) return 0;
      return Math.max(0, Math.ceil((endAtMs - Date.now()) / 1000));
    };

    const onTick = () => {
      if (endAtMsRef.current === null) return;
      const remainingSeconds = computeRemaining();
      setTimeRemaining(remainingSeconds);
      if (remainingSeconds <= 0 && !didTimeUpRef.current) {
        didTimeUpRef.current = true;
        endAtMsRef.current = null;
        onTimerFireRef.current();
      }
    };

    onTick();
    const intervalId = window.setInterval(onTick, 500);

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') onTick();
    };
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [isActive, isPaused]);

  const startExercise = () => {
    const ex = liveRef.current.currentExercise;
    if (!ex?.duration) return;
    didTimeUpRef.current = false;
    setTimeRemaining(ex.duration);
    endAtMsRef.current = Date.now() + ex.duration * 1000;
    setIsActive(true);
    setIsPaused(false);
  };

  const togglePause = () => {
    if (!isPaused) {
      remainingAtPauseRef.current = timeRemaining;
      endAtMsRef.current = null;
      setIsPaused(true);
    } else {
      didTimeUpRef.current = false;
      endAtMsRef.current = Date.now() + Math.max(0, remainingAtPauseRef.current) * 1000;
      setIsPaused(false);
    }
  };

  const resetTimer = () => {
    const ex = liveRef.current.currentExercise;
    endAtMsRef.current = null;
    remainingAtPauseRef.current = 0;
    didTimeUpRef.current = false;
    setIsActive(false);
    setIsPaused(false);
    setTimeRemaining(ex?.duration ?? 0);
    setIsResting(false);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const formatExerciseMeta = (exercise: PhysicalExercise) => {
    if (exercise.sets) {
      const repOrDur =
        exercise.reps != null
          ? String(exercise.reps)
          : exercise.duration != null
            ? `${exercise.duration}s`
            : '—';
      return `${exercise.sets}×${repOrDur}`;
    }
    if (exercise.duration != null) return `${exercise.duration}s`;
    if (exercise.reps != null) return `${exercise.reps} reps`;
    return '';
  };

  if (!currentExercise) {
    return null;
  }

  if (completedCount === exercises.length && exercises.length > 0) {
    return (
      <Card className="bg-card border-primary/30 p-6 sm:p-8 text-center border">
        <CheckCircle2 className="w-12 h-12 sm:w-16 sm:h-16 mx-auto mb-4 text-primary" />
        <h3 className="text-lg sm:text-xl font-bold text-primary data-readout mb-2">WORKOUT COMPLETE</h3>
        <p className="text-sm text-muted-foreground font-mono-data">All exercises completed successfully.</p>
      </Card>
    );
  }

  const detailCount = [
    currentExercise.sets != null,
    currentExercise.reps != null,
    currentExercise.duration != null,
  ].filter(Boolean).length;

  return (
    <div className="space-y-4 sm:space-y-6 w-full min-w-0">
      <Card className="bg-card border-border p-4 sm:p-6">
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs sm:text-sm data-readout text-muted-foreground">WORKOUT PROGRESS</span>
            <span className="font-mono-data text-sm sm:text-base font-bold text-primary tabular-nums">
              {completedCount}/{exercises.length}
            </span>
          </div>
          <Progress value={progressPercent} className="h-2" />
        </div>
      </Card>

      <Card className="bg-card border-primary/25 p-4 sm:p-6 border overflow-hidden">
        <div className="space-y-4 sm:space-y-6 min-w-0">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
            <div className="space-y-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <Dumbbell className="h-4 w-4 text-primary shrink-0" />
                <span className="text-[10px] sm:text-xs font-mono-data text-muted-foreground">
                  EXERCISE {currentExerciseIndex + 1}/{exercises.length}
                </span>
                {currentExercise.completed && <CheckCircle2 className="w-4 h-4 text-primary shrink-0" />}
              </div>
              <h3 className="text-lg sm:text-xl font-bold text-foreground break-words">{currentExercise.name}</h3>
              <p className="text-xs sm:text-sm text-muted-foreground font-mono-data uppercase tracking-wide">
                {currentExercise.type}
              </p>
            </div>
          </div>

          {detailCount > 0 && (
            <div
              className={`grid gap-2 sm:gap-3 ${
                detailCount === 1
                  ? 'grid-cols-1 max-w-xs mx-auto sm:mx-0'
                  : detailCount === 2
                    ? 'grid-cols-2'
                    : 'grid-cols-1 sm:grid-cols-3'
              }`}
            >
              {currentExercise.sets != null && (
                <div className="text-center p-3 bg-background/60 rounded-lg border border-border min-w-0">
                  <div className="text-xl sm:text-2xl font-bold text-primary font-mono-data tabular-nums">
                    {currentSet}/{currentExercise.sets}
                  </div>
                  <div className="text-[10px] sm:text-xs text-muted-foreground font-mono-data mt-1">SETS</div>
                </div>
              )}
              {currentExercise.reps != null && (
                <div className="text-center p-3 bg-background/60 rounded-lg border border-border min-w-0">
                  <div className="text-xl sm:text-2xl font-bold text-primary font-mono-data tabular-nums">
                    {currentExercise.reps}
                  </div>
                  <div className="text-[10px] sm:text-xs text-muted-foreground font-mono-data mt-1">REPS</div>
                </div>
              )}
              {currentExercise.duration != null && (
                <div className="text-center p-3 bg-background/60 rounded-lg border border-border min-w-0">
                  <div className="text-xl sm:text-2xl font-bold text-primary font-mono-data tabular-nums">
                    {currentExercise.duration}s
                  </div>
                  <div className="text-[10px] sm:text-xs text-muted-foreground font-mono-data mt-1">DURATION</div>
                </div>
              )}
            </div>
          )}

          {currentExercise.duration != null && (
            <div className="text-center space-y-3 sm:space-y-4 px-1">
              <div
                className={`text-4xl sm:text-5xl md:text-6xl font-mono-data font-bold tabular-nums tracking-tight ${
                  isResting ? 'text-muted-foreground' : 'text-primary text-glow'
                }`}
              >
                {formatTime(timeRemaining)}
              </div>
              {isResting && (
                <div className="text-xs sm:text-sm font-mono-data text-primary/80 animate-pulse">REST PERIOD</div>
              )}
              <div className="flex flex-wrap gap-2 justify-center items-stretch">
                {!isActive ? (
                  <Button onClick={startExercise} className="min-w-[7rem] font-mono-data flex-1 sm:flex-none">
                    <Play className="w-4 h-4 mr-2 shrink-0" />
                    Start
                  </Button>
                ) : (
                  <>
                    <Button
                      onClick={togglePause}
                      variant="secondary"
                      className="min-w-[7rem] font-mono-data flex-1 sm:flex-none"
                    >
                      {isPaused ? (
                        <>
                          <Play className="w-4 h-4 mr-2 shrink-0" />
                          Resume
                        </>
                      ) : (
                        <>
                          <Pause className="w-4 h-4 mr-2 shrink-0" />
                          Pause
                        </>
                      )}
                    </Button>
                    <Button
                      onClick={resetTimer}
                      variant="outline"
                      size="icon"
                      className="shrink-0 font-mono-data"
                      aria-label="Reset timer"
                    >
                      <RotateCcw className="w-4 h-4" />
                    </Button>
                  </>
                )}
              </div>
            </div>
          )}

          {currentExercise.formCues?.length > 0 && (
            <div className="space-y-2 border-t border-border pt-4">
              <div className="flex items-center gap-2 text-xs sm:text-sm data-readout text-muted-foreground">
                <AlertCircle className="w-4 h-4 text-primary shrink-0" />
                FORM CUES
              </div>
              <ul className="space-y-2 text-left">
                {currentExercise.formCues.map((cue, idx) => (
                  <li key={idx} className="text-xs sm:text-sm flex items-start gap-2 text-foreground/90">
                    <span className="text-primary shrink-0">›</span>
                    <span className="min-w-0 break-words">{cue}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {!currentExercise.completed && (
            <Button onClick={completeCurrentExercise} variant="outline" className="w-full font-mono-data">
              Mark as complete
            </Button>
          )}
        </div>
      </Card>

      <Card className="bg-card border-border p-4 sm:p-6">
        <h4 className="text-xs sm:text-sm data-readout text-muted-foreground mb-3 sm:mb-4">ALL EXERCISES</h4>
        <div className="space-y-2">
          {exercises.map((exercise, idx) => (
            <div
              key={exercise.id}
              className={`p-2.5 sm:p-3 rounded-lg border transition-all min-w-0 ${
                idx === currentExerciseIndex
                  ? 'border-primary/50 bg-primary/5'
                  : 'border-border bg-background/50'
              }`}
            >
              <div className="flex items-center justify-between gap-2 min-w-0">
                <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
                  <div
                    className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 font-mono-data ${
                      exercise.completed ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
                    }`}
                  >
                    {exercise.completed ? '✓' : idx + 1}
                  </div>
                  <span
                    className={`text-xs sm:text-sm truncate ${
                      exercise.completed ? 'line-through text-muted-foreground' : 'text-foreground'
                    }`}
                  >
                    {exercise.name}
                  </span>
                </div>
                {formatExerciseMeta(exercise) && (
                  <span className="text-[10px] sm:text-xs text-muted-foreground font-mono-data tabular-nums shrink-0">
                    {formatExerciseMeta(exercise)}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
};
