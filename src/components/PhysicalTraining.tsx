import { useState, useEffect } from 'react';
import { PhysicalExercise } from '@/lib/types';
import { Button } from './ui/button';
import { Card } from './ui/card';
import { Badge } from './ui/badge';
import { Progress } from './ui/progress';
import { Play, Pause, CheckCircle2, Activity } from 'lucide-react';

interface PhysicalTrainingProps {
  exercise: PhysicalExercise;
  onComplete: (data: {
    timeTaken: number;
    completed: boolean;
  }) => void;
}

export function PhysicalTraining({ exercise, onComplete }: PhysicalTrainingProps) {
  const [isActive, setIsActive] = useState(false);
  const [timeElapsed, setTimeElapsed] = useState(0);
  const [currentStep, setCurrentStep] = useState(0);
  const [startTime, setStartTime] = useState<number | null>(null);
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set());

  const totalDuration = exercise.duration * 60; // convert to seconds

  useEffect(() => {
    let interval: NodeJS.Timeout;
    
    if (isActive && startTime) {
      interval = setInterval(() => {
        const elapsed = Math.floor((Date.now() - startTime) / 1000);
        setTimeElapsed(elapsed);
        
        if (elapsed >= totalDuration) {
          handleComplete();
        }
      }, 1000);
    }

    return () => clearInterval(interval);
  }, [isActive, startTime, totalDuration]);

  const handleStart = () => {
    setIsActive(true);
    setStartTime(Date.now() - (timeElapsed * 1000));
  };

  const handlePause = () => {
    setIsActive(false);
  };

  const handleStepComplete = (index: number) => {
    const newCompleted = new Set(completedSteps);
    newCompleted.add(index);
    setCompletedSteps(newCompleted);
    
    if (index < exercise.instructions.length - 1) {
      setCurrentStep(index + 1);
    }
  };

  const handleComplete = () => {
    setIsActive(false);
    onComplete({
      timeTaken: timeElapsed,
      completed: true
    });
  };

  const progressPercent = (timeElapsed / totalDuration) * 100;
  const allStepsComplete = completedSteps.size === exercise.instructions.length;

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-primary/10 rounded flex items-center justify-center">
            <Activity className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h2 className="text-2xl font-mono text-foreground">{exercise.title}</h2>
            <p className="text-sm text-muted-foreground mt-1">
              {exercise.duration} MIN · DIFFICULTY_{exercise.difficulty}
            </p>
          </div>
        </div>
        <Badge variant="outline" className="font-mono">
          {exercise.xpReward} XP
        </Badge>
      </div>

      {/* Timer & Progress */}
      <Card className="p-6 bg-surface border-grid">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs font-mono text-muted-foreground mb-1">
                SESSION TIME
              </div>
              <div className="text-3xl font-mono text-primary">
                {formatTime(timeElapsed)} <span className="text-lg text-muted-foreground">/ {formatTime(totalDuration)}</span>
              </div>
            </div>
            <div className="flex gap-2">
              {!isActive ? (
                <Button onClick={handleStart} size="lg" className="gap-2">
                  <Play className="w-4 h-4" />
                  {timeElapsed > 0 ? 'RESUME' : 'START'}
                </Button>
              ) : (
                <Button onClick={handlePause} variant="secondary" size="lg" className="gap-2">
                  <Pause className="w-4 h-4" />
                  PAUSE
                </Button>
              )}
            </div>
          </div>
          <Progress value={progressPercent} className="h-2" />
          {exercise.sets && (
            <div className="flex gap-6 text-xs font-mono text-muted-foreground">
              <div>SETS: {exercise.sets}</div>
              {exercise.reps && <div>REPS: {exercise.reps}</div>}
              {exercise.restPeriod && <div>REST: {exercise.restPeriod}s</div>}
            </div>
          )}
        </div>
      </Card>

      {/* Description */}
      <Card className="p-6 bg-surface border-grid">
        <p className="text-muted-foreground leading-relaxed">{exercise.description}</p>
      </Card>

      {/* Instructions */}
      <div className="space-y-3">
        <div className="text-xs font-mono text-muted-foreground uppercase tracking-wider">
          Protocol Sequence
        </div>
        {exercise.instructions.map((instruction, index) => (
          <Card
            key={index}
            className={`p-4 transition-all ${
              completedSteps.has(index)
                ? 'bg-primary/5 border-primary/20'
                : index === currentStep
                ? 'bg-surface border-primary'
                : 'bg-surface border-grid opacity-60'
            }`}
          >
            <div className="flex items-start gap-4">
              <div className={`w-8 h-8 rounded border flex items-center justify-center font-mono text-sm shrink-0 ${
                completedSteps.has(index)
                  ? 'border-primary text-primary bg-primary/10'
                  : 'border-grid text-muted-foreground'
              }`}>
                {completedSteps.has(index) ? (
                  <CheckCircle2 className="w-5 h-5" />
                ) : (
                  index + 1
                )}
              </div>
              <div className="flex-1 flex items-start justify-between gap-4">
                <p className={`flex-1 ${
                  completedSteps.has(index)
                    ? 'text-muted-foreground line-through'
                    : index === currentStep
                    ? 'text-primary font-medium'
                    : 'text-foreground'
                }`}>
                  {instruction}
                </p>
                {index === currentStep && !completedSteps.has(index) && isActive && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleStepComplete(index)}
                    className="font-mono"
                  >
                    COMPLETE
                  </Button>
                )}
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Finish Button */}
      {allStepsComplete && (
        <div className="flex justify-center pt-4">
          <Button
            onClick={handleComplete}
            size="lg"
            className="font-mono gap-2"
          >
            <CheckCircle2 className="w-5 h-5" />
            FINISH PROTOCOL
          </Button>
        </div>
      )}
    </div>
  );
}
