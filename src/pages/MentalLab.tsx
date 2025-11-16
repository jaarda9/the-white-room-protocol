import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { MentalChallenge } from '@/components/MentalChallenge';
import { ScenarioDebrief } from '@/components/ScenarioDebrief';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  getMentalChallenges, 
  getMentalChallengeById, 
  saveScenarioAttempt,
  getCurrentProfile,
  addXPWithAttributes
} from '@/lib/storage';
import { ArrowLeft, Brain } from 'lucide-react';
import { ScenarioAttempt } from '@/lib/types';
import { toast } from '@/hooks/use-toast';

export default function MentalLab() {
  const navigate = useNavigate();
  const { id } = useParams();
  const [activeChallenge, setActiveChallenge] = useState<string | null>(id || null);
  const [completedAttempt, setCompletedAttempt] = useState<ScenarioAttempt | null>(null);

  const challenges = getMentalChallenges();
  const currentChallenge = activeChallenge ? getMentalChallengeById(activeChallenge) : null;
  const profile = getCurrentProfile();

  const handleStartChallenge = (challengeId: string) => {
    setActiveChallenge(challengeId);
    setCompletedAttempt(null);
  };

  const handleComplete = (data: {
    timeTaken: number;
    selectedAnswer: number;
    correct: boolean;
    hintsUsed: number;
  }) => {
    if (!currentChallenge || !profile) return;

    const baseScore = data.correct ? 1.0 : 0.0;
    const timeBonus = data.correct && data.timeTaken < currentChallenge.timeLimit * 0.5 ? 0.2 : 0;
    const score = Math.min(1.0, baseScore + timeBonus);
    
    const xpMultiplier = 1 - (data.hintsUsed * 0.2);
    const xpGained = Math.floor(currentChallenge.xpReward * score * xpMultiplier);

    const analysis = {
      strengths: data.correct 
        ? ['Correct solution identified', data.timeTaken < currentChallenge.timeLimit * 0.5 ? 'Efficient time management' : 'Adequate time management']
        : [],
      improvements: !data.correct
        ? ['Review solution logic', 'Practice similar problem patterns', 'Strengthen deductive reasoning']
        : data.hintsUsed > 0
        ? ['Aim for independent problem solving']
        : [],
      optimalChoices: !data.correct ? [currentChallenge.explanation] : []
    };

    const attempt = saveScenarioAttempt({
      scenarioId: currentChallenge.id,
      scenarioType: 'mental',
      userId: profile.id,
      timeTaken: data.timeTaken,
      success: data.correct,
      score,
      hintsUsed: data.hintsUsed,
      xpGained,
      analysis
    });

    addXPWithAttributes(xpGained, currentChallenge.attributeRewards);
    setCompletedAttempt(attempt);
    
    toast({
      title: data.correct ? 'Challenge Solved' : 'Challenge Failed',
      description: `+${xpGained} XP gained`
    });
  };

  const handleContinue = () => {
    setActiveChallenge(null);
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

  if (currentChallenge) {
    return (
      <div className="min-h-screen bg-background p-6">
        <div className="max-w-3xl mx-auto mb-6">
          <Button
            variant="ghost"
            onClick={() => setActiveChallenge(null)}
            className="gap-2 text-muted-foreground hover:text-primary"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Challenges
          </Button>
        </div>
        <MentalChallenge challenge={currentChallenge} onComplete={handleComplete} />
      </div>
    );
  }

  const challengeTypes = Array.from(new Set(challenges.map(c => c.type)));

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
              <Brain className="w-6 h-6 text-primary" />
              <h1 className="text-3xl font-mono text-foreground">Mental Lab</h1>
            </div>
          </div>
        </div>

        <Card className="p-6 bg-surface border-grid">
          <p className="text-muted-foreground leading-relaxed">
            Sharpen your cognitive abilities through logic puzzles, pattern recognition, memory tests, 
            and deductive reasoning challenges. Time-limited scenarios test your mental agility and problem-solving speed.
          </p>
        </Card>

        {challengeTypes.map((type) => {
          const typeChallenges = challenges.filter(c => c.type === type);
          return (
            <div key={type} className="space-y-4">
              <h2 className="text-xl font-mono text-foreground uppercase">{type} Challenges</h2>
              <div className="grid gap-4 md:grid-cols-2">
                {typeChallenges.map((challenge) => (
                  <Card
                    key={challenge.id}
                    className="p-6 bg-surface border-grid hover:border-primary/40 transition-all cursor-pointer group"
                    onClick={() => handleStartChallenge(challenge.id)}
                  >
                    <div className="space-y-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <h3 className="text-lg font-mono text-foreground group-hover:text-primary transition-colors mb-2">
                            {challenge.title}
                          </h3>
                          <p className="text-sm text-muted-foreground">{challenge.description}</p>
                        </div>
                        <Badge variant="outline" className="font-mono shrink-0">
                          DIFF_{challenge.difficulty}
                        </Badge>
                      </div>
                      <div className="flex items-center justify-between pt-4 border-t border-grid">
                        <div className="flex gap-4 text-xs font-mono text-muted-foreground">
                          <span>+{challenge.xpReward} XP</span>
                          <span>•</span>
                          <span>{challenge.timeLimit}s LIMIT</span>
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
          );
        })}
      </div>
    </div>
  );
}
