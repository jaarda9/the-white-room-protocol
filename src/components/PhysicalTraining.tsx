import { useState, useEffect, useRef } from 'react';
import { PhysicalExercise } from '@/lib/types';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Play, Pause, RotateCcw, CheckCircle2, AlertCircle } from 'lucide-react';

interface PhysicalTrainingProps {
  exercises: PhysicalExercise[];
  onComplete: (exerciseId: string) => void;
  onWorkoutComplete: () => void;
}

export const PhysicalTraining = ({ 
  exercises, 
  onComplete,
  onWorkoutComplete 
}: PhysicalTrainingProps) => {
  const [currentExerciseIndex, setCurrentExerciseIndex] = useState(0);
  const [isActive, setIsActive] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [isResting, setIsResting] = useState(false);
  const [currentSet, setCurrentSet] = useState(1);

  // Accurate countdown even when the tab is backgrounded:
  // we compute remaining from an absolute end timestamp instead of decrementing by ticks.
  const endAtMsRef = useRef<number | null>(null);
  const remainingAtPauseRef = useRef<number>(0);
  const didTimeUpRef = useRef(false);
  
  const currentExercise = exercises[currentExerciseIndex];
  const completedCount = exercises.filter(e => e.completed).length;
  const progressPercent = (completedCount / exercises.length) * 100;

  useEffect(() => {
    if (completedCount === exercises.length && exercises.length > 0) {
      onWorkoutComplete();
    }
  }, [completedCount, exercises.length, onWorkoutComplete]);

  useEffect(() => {
    if (!isActive || isPaused) return;
    if (endAtMsRef.current === null) return;

    const computeRemaining = () => {
      const endAtMs = endAtMsRef.current;
      if (endAtMs === null) return 0;
      const remainingSeconds = Math.max(0, Math.ceil((endAtMs - Date.now()) / 1000));
      setTimeRemaining(remainingSeconds);
      return remainingSeconds;
    };

    const onTick = () => {
      const remainingSeconds = computeRemaining();
      if (remainingSeconds <= 0 && !didTimeUpRef.current) {
        didTimeUpRef.current = true;
        handleTimerComplete();
      }
    };

    // Update immediately, then on a short interval.
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

  const handleTimerComplete = () => {
    // Prevent multiple triggers while state transitions.
    didTimeUpRef.current = true;

    if (isResting) {
      setIsResting(false);
      setIsActive(false);
    } else {
      if (currentExercise.sets && currentSet < currentExercise.sets) {
        setCurrentSet(currentSet + 1);
        startRest();
      } else {
        handleExerciseComplete();
      }
    }
  };

  const startExercise = () => {
    if (currentExercise.duration) {
      didTimeUpRef.current = false;
      setTimeRemaining(currentExercise.duration);
      endAtMsRef.current = Date.now() + currentExercise.duration * 1000;
      setIsActive(true);
      setIsPaused(false);
    }
  };

  const startRest = () => {
    didTimeUpRef.current = false;
    setIsResting(true);
    setTimeRemaining(currentExercise.restPeriod);
    endAtMsRef.current = Date.now() + currentExercise.restPeriod * 1000;
    setIsActive(true);
  };

  const handleExerciseComplete = () => {
    endAtMsRef.current = null;
    didTimeUpRef.current = false;
    onComplete(currentExercise.id);
    setIsActive(false);
    setIsResting(false);
    setCurrentSet(1);
    
    if (currentExerciseIndex < exercises.length - 1) {
      setTimeout(() => {
        setCurrentExerciseIndex(currentExerciseIndex + 1);
      }, 500);
    }
  };

  const togglePause = () => {
    if (!isPaused) {
      // Going into pause: freeze the remaining seconds and clear the countdown endpoint.
      remainingAtPauseRef.current = timeRemaining;
      endAtMsRef.current = null;
      setIsPaused(true);
    } else {
      // Resuming: re-create the endpoint based on remaining time.
      didTimeUpRef.current = false;
      endAtMsRef.current = Date.now() + Math.max(0, remainingAtPauseRef.current) * 1000;
      setIsPaused(false);
    }
  };

  const resetTimer = () => {
    endAtMsRef.current = null;
    remainingAtPauseRef.current = 0;
    didTimeUpRef.current = false;
    setIsActive(false);
    setIsPaused(false);
    setTimeRemaining(currentExercise.duration || 0);
    setIsResting(false);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  if (completedCount === exercises.length) {
    return (
      <Card className="bg-surface border-primary/20 p-8 text-center">
        <CheckCircle2 className="w-16 h-16 mx-auto mb-4 text-primary" />
        <h3 className="text-xl font-bold mb-2">Workout Complete!</h3>
        <p className="text-muted-foreground">All exercises completed successfully.</p>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Progress Overview */}
      <Card className="bg-surface border-border p-6">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-mono text-muted-foreground">WORKOUT PROGRESS</span>
            <span className="font-bold">{completedCount}/{exercises.length}</span>
          </div>
          <Progress value={progressPercent} className="h-2" />
        </div>
      </Card>

      {/* Current Exercise */}
      <Card className="bg-surface border-primary/20 p-6">
        <div className="space-y-6">
          {/* Exercise Header */}
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono text-muted-foreground">
                  EXERCISE {currentExerciseIndex + 1}/{exercises.length}
                </span>
                {currentExercise.completed && (
                  <CheckCircle2 className="w-4 h-4 text-primary" />
                )}
              </div>
              <h3 className="text-xl font-bold">{currentExercise.name}</h3>
              <p className="text-sm text-muted-foreground capitalize">
                {currentExercise.type}
              </p>
            </div>
          </div>

          {/* Exercise Details */}
          <div className="grid grid-cols-3 gap-4">
            {currentExercise.sets && (
              <div className="text-center p-3 bg-background/50 rounded-lg border border-border">
                <div className="text-2xl font-bold">{currentSet}/{currentExercise.sets}</div>
                <div className="text-xs text-muted-foreground mt-1">SETS</div>
              </div>
            )}
            {currentExercise.reps && (
              <div className="text-center p-3 bg-background/50 rounded-lg border border-border">
                <div className="text-2xl font-bold">{currentExercise.reps}</div>
                <div className="text-xs text-muted-foreground mt-1">REPS</div>
              </div>
            )}
            {currentExercise.duration && (
              <div className="text-center p-3 bg-background/50 rounded-lg border border-border">
                <div className="text-2xl font-bold">{currentExercise.duration}s</div>
                <div className="text-xs text-muted-foreground mt-1">DURATION</div>
              </div>
            )}
          </div>

          {/* Timer Display */}
          {currentExercise.duration && (
            <div className="text-center space-y-4">
              <div className={`text-6xl font-mono font-bold ${isResting ? 'text-muted-foreground' : 'text-primary'}`}>
                {formatTime(timeRemaining)}
              </div>
              {isResting && (
                <div className="text-sm font-mono text-muted-foreground animate-pulse">
                  REST PERIOD
                </div>
              )}
              <div className="flex gap-2 justify-center">
                {!isActive ? (
                  <Button onClick={startExercise} className="w-32">
                    <Play className="w-4 h-4 mr-2" />
                    Start
                  </Button>
                ) : (
                  <>
                    <Button onClick={togglePause} variant="secondary" className="w-32">
                      {isPaused ? <Play className="w-4 h-4 mr-2" /> : <Pause className="w-4 h-4 mr-2" />}
                      {isPaused ? 'Resume' : 'Pause'}
                    </Button>
                    <Button onClick={resetTimer} variant="outline">
                      <RotateCcw className="w-4 h-4" />
                    </Button>
                  </>
                )}
              </div>
            </div>
          )}

          {/* Form Cues */}
          {currentExercise.formCues.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-mono text-muted-foreground">
                <AlertCircle className="w-4 h-4" />
                FORM CUES
              </div>
              <ul className="space-y-2">
                {currentExercise.formCues.map((cue, idx) => (
                  <li key={idx} className="text-sm flex items-start gap-2">
                    <span className="text-muted-foreground">•</span>
                    <span>{cue}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Manual Complete */}
          {!currentExercise.completed && (
            <Button 
              onClick={handleExerciseComplete} 
              variant="outline" 
              className="w-full"
            >
              Mark as Complete
            </Button>
          )}
        </div>
      </Card>

      {/* Exercise List */}
      <Card className="bg-surface border-border p-6">
        <div className="space-y-2">
          <h4 className="text-sm font-mono text-muted-foreground mb-4">ALL EXERCISES</h4>
          {exercises.map((exercise, idx) => (
            <div
              key={exercise.id}
              className={`p-3 rounded-lg border transition-all ${
                idx === currentExerciseIndex
                  ? 'border-primary bg-primary/5'
                  : 'border-border bg-background/50'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                    exercise.completed 
                      ? 'bg-primary text-primary-foreground' 
                      : 'bg-muted text-muted-foreground'
                  }`}>
                    {exercise.completed ? '✓' : idx + 1}
                  </div>
                  <span className={exercise.completed ? 'line-through text-muted-foreground' : ''}>
                    {exercise.name}
                  </span>
                </div>
                {exercise.sets && (
                  <span className="text-xs text-muted-foreground">
                    {exercise.sets}×{exercise.reps || exercise.duration + 's'}
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
