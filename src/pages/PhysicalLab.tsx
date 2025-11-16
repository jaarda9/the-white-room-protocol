import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { PhysicalTraining } from '@/components/PhysicalTraining';
import { ScenarioDebrief } from '@/components/ScenarioDebrief';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  getPhysicalExercises, 
  getPhysicalExerciseById, 
  saveScenarioAttempt,
  getCurrentProfile,
  addXP
} from '@/lib/storage';
import { ArrowLeft, Activity } from 'lucide-react';
import { ScenarioAttempt } from '@/lib/types';
import { toast } from '@/hooks/use-toast';

export default function PhysicalLab() {
  const navigate = useNavigate();
  const { id } = useParams();
  const [activeExercise, setActiveExercise] = useState<string | null>(id || null);
  const [completedAttempt, setCompletedAttempt] = useState<ScenarioAttempt | null>(null);

  const exercises = getPhysicalExercises();
  const currentExercise = activeExercise ? getPhysicalExerciseById(activeExercise) : null;
  const profile = getCurrentProfile();

  const handleStartExercise = (exerciseId: string) => {
    setActiveExercise(exerciseId);
    setCompletedAttempt(null);
  };

  const handleComplete = (data: { timeTaken: number; completed: boolean }) => {
    if (!currentExercise || !profile) return;

    const targetTime = currentExercise.duration * 60;
    const timeDiff = Math.abs(data.timeTaken - targetTime);
    const timeScore = Math.max(0.5, 1 - (timeDiff / targetTime) * 0.5);
    
    const score = data.completed ? timeScore : 0.3;
    const xpGained = Math.floor(currentExercise.xpReward * score);

    const analysis = {
      strengths: data.completed
        ? [
            'Protocol completed successfully',
            data.timeTaken <= targetTime ? 'Excellent time management' : 'Adequate pacing'
          ]
        : [],
      improvements: !data.completed
        ? ['Complete full protocol duration', 'Build endurance gradually']
        : data.timeTaken > targetTime * 1.2
        ? ['Work on pacing and consistency']
        : []
    };

    const attempt = saveScenarioAttempt({
      scenarioId: currentExercise.id,
      scenarioType: 'physical',
      userId: profile.id,
      timeTaken: data.timeTaken,
      success: data.completed,
      score,
      hintsUsed: 0,
      xpGained,
      analysis
    });

    addXP(xpGained, currentExercise.attributeRewards);
    setCompletedAttempt(attempt);
    
    toast({
      title: 'Training Complete',
      description: `+${xpGained} XP gained`
    });
  };

  const handleContinue = () => {
    setActiveExercise(null);
    setCompletedAttempt(null);
  };

  if (!profile) {
    navigate('/');
    return null;
  }

  if (completedAttempt) {
    return (
      <div className="min-h-screen bg-background p-6">
        <ScenarioDebrief attempt={completedAttempt} onContinue={handleContinue} />
      </div>
    );
  }

  if (currentExercise) {
    return (
      <div className="min-h-screen bg-background p-6">
        <div className="max-w-4xl mx-auto mb-6">
          <Button
            variant="ghost"
            onClick={() => setActiveExercise(null)}
            className="gap-2 text-muted-foreground hover:text-primary"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Protocols
          </Button>
        </div>
        <PhysicalTraining exercise={currentExercise} onComplete={handleComplete} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-6xl mx-auto space-y-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              onClick={() => navigate('/')}
              className="gap-2 text-muted-foreground hover:text-primary"
            >
              <ArrowLeft className="w-4 h-4" />
              Dashboard
            </Button>
            <div className="h-8 w-px bg-grid" />
            <div className="flex items-center gap-3">
              <Activity className="w-6 h-6 text-primary" />
              <h1 className="text-3xl font-mono text-foreground">Physical Lab</h1>
            </div>
          </div>
        </div>

        <Card className="p-6 bg-surface border-grid">
          <p className="text-muted-foreground leading-relaxed">
            Build physical capabilities through structured training protocols. Each session targets strength, 
            agility, vitality, or endurance. Follow timed sequences and track progress toward peak physical condition.
          </p>
        </Card>

        <div className="grid gap-4 md:grid-cols-2">
          {exercises.map((exercise) => (
            <Card
              key={exercise.id}
              className="p-6 bg-surface border-grid hover:border-primary/40 transition-all cursor-pointer group"
              onClick={() => handleStartExercise(exercise.id)}
            >
              <div className="space-y-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <h3 className="text-lg font-mono text-foreground group-hover:text-primary transition-colors mb-2">
                      {exercise.title}
                    </h3>
                    <p className="text-sm text-muted-foreground">{exercise.description}</p>
                  </div>
                  <Badge variant="outline" className="font-mono shrink-0">
                    DIFF_{exercise.difficulty}
                  </Badge>
                </div>
                <div className="flex items-center justify-between pt-4 border-t border-grid">
                  <div className="flex gap-4 text-xs font-mono text-muted-foreground">
                    <span>+{exercise.xpReward} XP</span>
                    <span>•</span>
                    <span>{exercise.duration} MIN</span>
                    {exercise.sets && (
                      <>
                        <span>•</span>
                        <span>{exercise.sets}×{exercise.reps}</span>
                      </>
                    )}
                  </div>
                  <Button variant="outline" size="sm" className="font-mono">
                    START
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
