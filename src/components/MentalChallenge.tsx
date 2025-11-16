import { useState, useEffect } from 'react';
import { MentalChallenge as MentalChallengeType } from '@/lib/types';
import { Button } from './ui/button';
import { Card } from './ui/card';
import { Badge } from './ui/badge';
import { Progress } from './ui/progress';
import { Brain, Clock, Lightbulb } from 'lucide-react';

interface MentalChallengeProps {
  challenge: MentalChallengeType;
  onComplete: (data: {
    timeTaken: number;
    selectedAnswer: number;
    correct: boolean;
    hintsUsed: number;
  }) => void;
}

export function MentalChallenge({ challenge, onComplete }: MentalChallengeProps) {
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [timeRemaining, setTimeRemaining] = useState(challenge.timeLimit);
  const [showHint, setShowHint] = useState(false);
  const [hintsUsed, setHintsUsed] = useState(0);
  const [startTime] = useState(Date.now());

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          handleSubmit();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const handleSubmit = () => {
    const timeTaken = Math.floor((Date.now() - startTime) / 1000);
    const correct = selectedAnswer === challenge.correctAnswer;
    
    onComplete({
      timeTaken,
      selectedAnswer: selectedAnswer ?? -1,
      correct,
      hintsUsed
    });
  };

  const timeProgress = (timeRemaining / challenge.timeLimit) * 100;
  const isUrgent = timeRemaining <= challenge.timeLimit * 0.25;

  const getChallengeIcon = () => {
    const icons = {
      logic: '∴',
      memory: '◈',
      pattern: '⊞',
      deduction: '⟡'
    };
    return icons[challenge.type] || '◇';
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-primary/10 rounded flex items-center justify-center">
            <span className="text-xl text-primary font-mono">{getChallengeIcon()}</span>
          </div>
          <div>
            <h2 className="text-2xl font-mono text-foreground">{challenge.title}</h2>
            <p className="text-sm text-muted-foreground mt-1">
              {challenge.type.toUpperCase()} · DIFFICULTY_{challenge.difficulty}
            </p>
          </div>
        </div>
        <Badge variant="outline" className="font-mono">
          {challenge.xpReward} XP
        </Badge>
      </div>

      {/* Time Progress */}
      <Card className="p-4 bg-surface border-grid">
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs font-mono">
            <span className="text-muted-foreground flex items-center gap-2">
              <Clock className="w-4 h-4" />
              TIME REMAINING
            </span>
            <span className={isUrgent ? 'text-critical' : 'text-primary'}>
              {Math.floor(timeRemaining / 60)}:{(timeRemaining % 60).toString().padStart(2, '0')}
            </span>
          </div>
          <Progress 
            value={timeProgress} 
            className={`h-1 ${isUrgent ? '[&>div]:bg-critical' : '[&>div]:bg-primary'}`}
          />
        </div>
      </Card>

      {/* Question */}
      <Card className="p-6 bg-surface border-grid">
        <div className="space-y-4">
          <div className="flex items-start gap-3">
            <Brain className="w-5 h-5 text-primary mt-1 shrink-0" />
            <div className="flex-1">
              <div className="font-mono text-sm text-muted-foreground mb-3">
                CHALLENGE PARAMETERS
              </div>
              <p className="text-foreground leading-relaxed text-lg">{challenge.question}</p>
            </div>
          </div>

          {/* Hint */}
          <div className="pt-4 border-t border-grid">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setShowHint(!showHint);
                if (!showHint) setHintsUsed(1);
              }}
              className="gap-2 text-muted-foreground hover:text-secondary-accent"
            >
              <Lightbulb className="w-4 h-4" />
              {showHint ? 'Hide Hint' : 'Request Hint (reduces reward)'}
            </Button>
            {showHint && (
              <div className="mt-3 p-3 bg-secondary-accent/10 rounded border border-secondary-accent/20">
                <p className="text-sm text-muted-foreground">
                  Break down the problem into smaller components. Consider each element's relationship to others.
                </p>
              </div>
            )}
          </div>
        </div>
      </Card>

      {/* Options */}
      <div className="space-y-3">
        <div className="text-xs font-mono text-muted-foreground uppercase tracking-wider">
          Response Selection
        </div>
        {challenge.options.map((option, index) => (
          <Card
            key={index}
            className={`p-4 cursor-pointer transition-all ${
              selectedAnswer === index
                ? 'bg-primary/10 border-primary'
                : 'bg-surface border-grid hover:border-primary/40'
            }`}
            onClick={() => setSelectedAnswer(index)}
          >
            <div className="flex items-center gap-3">
              <div className={`w-8 h-8 rounded border flex items-center justify-center font-mono text-sm ${
                selectedAnswer === index
                  ? 'border-primary text-primary bg-primary/10'
                  : 'border-grid text-muted-foreground'
              }`}>
                {String.fromCharCode(65 + index)}
              </div>
              <p className={`flex-1 ${
                selectedAnswer === index ? 'text-primary' : 'text-foreground'
              }`}>
                {option}
              </p>
            </div>
          </Card>
        ))}
      </div>

      {/* Submit */}
      <div className="flex justify-center pt-4">
        <Button
          onClick={handleSubmit}
          disabled={selectedAnswer === null}
          size="lg"
          className="font-mono"
        >
          SUBMIT RESPONSE
        </Button>
      </div>
    </div>
  );
}
