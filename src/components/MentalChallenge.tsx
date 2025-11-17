import { useState, useEffect, useCallback } from 'react';
import { MentalChallenge } from '@/lib/types';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Brain, Clock, Focus, CheckCircle2, XCircle } from 'lucide-react';

interface MentalChallengeProps {
  challenge: MentalChallenge;
  onComplete: (result: { accuracy: number; timeTaken: number; focusScore: number }) => void;
}

export function MentalChallengeComponent({ challenge, onComplete }: MentalChallengeProps) {
  const data = challenge.data || {};
  const [timeLeft, setTimeLeft] = useState(challenge.timeLimit);
  const [isActive, setIsActive] = useState(false);
  const [currentPhase, setCurrentPhase] = useState<'ready' | 'active' | 'complete'>('ready');
  
  // Memory Game State
  const [memorySequence, setMemorySequence] = useState<number[]>(Array.isArray(data.sequence) ? data.sequence : []);
  const [userSequence, setUserSequence] = useState<number[]>([]);
  const [showingSequence, setShowingSequence] = useState(false);
  
  // Logic/Pattern State
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answers, setAnswers] = useState<boolean[]>([]);
  
  // Focus State
  const [focusClicks, setFocusClicks] = useState(0);
  const [targetClicks, setTargetClicks] = useState(data.targetClicks || 50);

  // Timer
  useEffect(() => {
    if (isActive && timeLeft > 0) {
      const timer = setInterval(() => {
        setTimeLeft((prev) => prev - 1);
      }, 1000);
      return () => clearInterval(timer);
    } else if (timeLeft === 0 && isActive) {
      handleTimeUp();
    }
  }, [isActive, timeLeft]);

  const handleStart = () => {
    setIsActive(true);
    setCurrentPhase('active');
    
    if (challenge.type === 'memory') {
      if (Array.isArray(data.sequence) && data.sequence.length) {
        generateMemorySequence(data.sequence);
      } else {
        generateMemorySequence();
      }
    } else if (challenge.type === 'focus') {
      setTargetClicks(data.targetClicks || 50);
    }
  };

  const generateMemorySequence = useCallback((provided?: number[]) => {
    const length = provided?.length ?? challenge.difficulty + 3;
    const sequence =
      provided && provided.length
        ? provided.map(num => Math.max(0, Math.min(9, Math.round(num))))
        : Array.from({ length }, () => Math.floor(Math.random() * 9));
    setMemorySequence(sequence);
    setShowingSequence(true);
    
    setTimeout(() => {
      setShowingSequence(false);
    }, sequence.length * 800);
  }, [challenge.difficulty]);

  const handleMemoryInput = (num: number) => {
    if (showingSequence) return;
    const newSequence = [...userSequence, num];
    setUserSequence(newSequence);
    
    if (newSequence.length === memorySequence.length) {
      completeChallenge();
    }
  };

  const handleLogicAnswer = (answer: boolean) => {
    const newAnswers = [...answers, answer];
    setAnswers(newAnswers);
    
    const totalQuestions = Array.isArray(data.questions) ? data.questions.length : 0;
    if (currentQuestion + 1 < totalQuestions) {
      setCurrentQuestion(currentQuestion + 1);
    } else {
      completeChallenge();
    }
  };

  const handleFocusClick = () => {
    setFocusClicks((prev) => prev + 1);
    if (focusClicks + 1 >= targetClicks) {
      completeChallenge();
    }
  };

  const handleTimeUp = () => {
    completeChallenge();
  };

  const completeChallenge = () => {
    setIsActive(false);
    setCurrentPhase('complete');
    
    const timeTaken = challenge.timeLimit - timeLeft;
    let accuracy = 0;
    let focusScore = 0;

    if (challenge.type === 'memory') {
      const total = memorySequence.length || 1;
      const correct = userSequence.filter((num, idx) => num === memorySequence[idx]).length;
      accuracy = (correct / total) * 100;
      focusScore = accuracy > 80 ? 100 : accuracy;
    } else if (challenge.type === 'logic' || challenge.type === 'pattern') {
      const attempted = answers.length || 1;
      const correct = answers.filter(Boolean).length;
      accuracy = (correct / attempted) * 100;
      focusScore = accuracy > 70 ? 90 : accuracy;
    } else if (challenge.type === 'focus') {
      accuracy = Math.min((focusClicks / targetClicks) * 100, 100);
      focusScore = accuracy;
    }

    onComplete({ accuracy, timeTaken, focusScore });
  };

  const renderChallenge = () => {
    if (currentPhase === 'ready') {
      return (
        <div className="text-center space-y-6 p-8">
          <div className="flex justify-center">
            <Brain className="w-16 h-16 text-primary" />
          </div>
          <div>
            <h3 className="text-2xl font-bold mb-2">{challenge.title}</h3>
            <p className="text-muted-foreground">{challenge.description}</p>
          </div>
          <div className="flex gap-4 justify-center">
            <Badge variant="outline" className="text-lg py-2 px-4">
              <Clock className="w-4 h-4 mr-2" />
              {challenge.timeLimit}s
            </Badge>
            <Badge variant="outline" className="text-lg py-2 px-4">
              Difficulty: {challenge.difficulty}/5
            </Badge>
          </div>
          <Button size="lg" onClick={handleStart} className="mt-6">
            Begin Challenge
          </Button>
        </div>
      );
    }

    if (challenge.type === 'memory') {
      return (
        <div className="space-y-6">
          <div className="text-center">
            <h3 className="text-xl font-bold mb-2">Memory Sequence</h3>
            {showingSequence ? (
              <p className="text-muted-foreground">Memorize the sequence...</p>
            ) : (
              <p className="text-muted-foreground">Enter the sequence you saw</p>
            )}
          </div>
          
          <div className="grid grid-cols-3 gap-4 max-w-xs mx-auto">
            {showingSequence ? (
              memorySequence.map((num, idx) => (
                <Card
                  key={idx}
                  className="aspect-square flex items-center justify-center text-3xl font-bold animate-pulse"
                >
                  {num}
                </Card>
              ))
            ) : (
              Array.from({ length: 9 }, (_, i) => (
                <Button
                  key={i}
                  variant="outline"
                  size="lg"
                  className="aspect-square text-2xl"
                  onClick={() => handleMemoryInput(i)}
                >
                  {i}
                </Button>
              ))
            )}
          </div>
          
          {userSequence.length > 0 && (
            <div className="text-center">
              <p className="text-sm text-muted-foreground mb-2">Your input:</p>
              <p className="text-lg font-mono">{userSequence.join(' ')}</p>
            </div>
          )}
        </div>
      );
    }

    if (challenge.type === 'logic' || challenge.type === 'pattern') {
      const questionSet = Array.isArray(data.questions) && data.questions.length ? data.questions : [];
      const question = questionSet[currentQuestion];
      if (!question) {
        completeChallenge();
        return null;
      }
      return (
        <div className="space-y-6">
          <div className="text-center">
            <Badge variant="outline" className="mb-4">
              Question {currentQuestion + 1} of {questionSet.length}
            </Badge>
            <h3 className="text-xl font-bold mb-4">{question.question}</h3>
          </div>
          
          <div className="grid gap-3">
            {question.options.map((option: string, idx: number) => (
              <Button
                key={idx}
                variant="outline"
                size="lg"
                className="text-left h-auto py-4 px-6"
                onClick={() => handleLogicAnswer(idx === question.correctIndex)}
              >
                {option}
              </Button>
            ))}
          </div>
        </div>
      );
    }

    if (challenge.type === 'focus') {
      return (
        <div className="space-y-6 text-center">
          <div>
            <h3 className="text-xl font-bold mb-2">Focus Test</h3>
            <p className="text-muted-foreground">Click the button as fast as you can!</p>
          </div>
          
          <div className="py-8">
            <Button
              size="lg"
              className="w-48 h-48 rounded-full text-4xl font-bold"
              onClick={handleFocusClick}
            >
              <Focus className="w-16 h-16" />
            </Button>
          </div>
          
          <div className="space-y-2">
            <div className="text-3xl font-bold">{focusClicks} / {targetClicks}</div>
            <Progress value={(focusClicks / targetClicks) * 100} className="h-3" />
          </div>
        </div>
      );
    }

    return null;
  };

  return (
    <Card className="p-6">
      <div className="space-y-6">
        {currentPhase === 'active' && (
          <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
            <div className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-muted-foreground" />
              <span className="font-mono text-lg">
                {Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, '0')}
              </span>
            </div>
            <Progress value={(timeLeft / challenge.timeLimit) * 100} className="flex-1 mx-4 h-2" />
          </div>
        )}
        
        {renderChallenge()}
      </div>
    </Card>
  );
}
