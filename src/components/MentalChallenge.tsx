import { useState, useEffect, useCallback, useRef } from 'react';
import { MentalChallenge } from '@/lib/types';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Brain, Clock, Zap, Target, CheckCircle2, XCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface MentalChallengeProps {
  challenge: MentalChallenge;
  onComplete: (result: { accuracy: number; timeTaken: number; focusScore: number }) => void;
}

export function MentalChallengeComponent({ challenge, onComplete }: MentalChallengeProps) {
  const { toast } = useToast();
  const data = challenge.data || {};
  const [timeLeft, setTimeLeft] = useState(challenge.timeLimit);
  const [isActive, setIsActive] = useState(false);
  const [currentPhase, setCurrentPhase] = useState<'ready' | 'active' | 'complete'>('ready');

  // Accurate countdown even when the tab is backgrounded.
  const endAtMsRef = useRef<number | null>(null);
  const didTimeUpRef = useRef(false);
  const startedAtMsRef = useRef<number | null>(null);
  
  // Working Memory State
  const [memoryItems, setMemoryItems] = useState<any[]>([]);
  const [userAnswers, setUserAnswers] = useState<any[]>([]);
  const [showingItems, setShowingItems] = useState(false);
  
  // Speed Processing State
  const [speedQuestions, setSpeedQuestions] = useState<any[]>([]);
  const [speedAnswers, setSpeedAnswers] = useState<any[]>([]);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [inputValue, setInputValue] = useState('');
  
  // Strategic Planning State
  const [planningScenario, setPlanningScenario] = useState<any>(null);
  const [decisions, setDecisions] = useState<any[]>([]);

  // Reset all state when challenge changes
  useEffect(() => {
    setTimeLeft(challenge.timeLimit);
    setIsActive(false);
    setCurrentPhase('ready');
    endAtMsRef.current = null;
    startedAtMsRef.current = null;
    didTimeUpRef.current = false;
    setMemoryItems([]);
    setUserAnswers([]);
    setShowingItems(false);
    setSpeedQuestions([]);
    setSpeedAnswers([]);
    setCurrentQuestion(0);
    setInputValue('');
    setPlanningScenario(null);
    setDecisions([]);
  }, [challenge.id, challenge.timeLimit]);

  // Timer
  useEffect(() => {
    if (!isActive) return;
    if (endAtMsRef.current === null) return;

    const computeRemaining = () => {
      const endAtMs = endAtMsRef.current;
      if (endAtMs === null) return 0;
      return Math.max(0, Math.ceil((endAtMs - Date.now()) / 1000));
    };

    const onTick = () => {
      const remaining = computeRemaining();
      setTimeLeft(remaining);
      if (remaining <= 0 && !didTimeUpRef.current) {
        didTimeUpRef.current = true;
        handleTimeUp();
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
  }, [isActive]);

  const handleStart = () => {
    didTimeUpRef.current = false;
    startedAtMsRef.current = Date.now();
    endAtMsRef.current = Date.now() + challenge.timeLimit * 1000;
    setTimeLeft(challenge.timeLimit);
    setIsActive(true);
    setCurrentPhase('active');
    
    if (challenge.type === 'working-memory') {
      initWorkingMemory();
    } else if (challenge.type === 'speed-processing') {
      initSpeedProcessing();
    } else if (challenge.type === 'strategic-planning') {
      initStrategicPlanning();
    }
  };

  const initWorkingMemory = useCallback(() => {
    // Require AI-generated data - no fallbacks
    if (!data.items || !Array.isArray(data.items) || data.items.length === 0) {
      console.error('AI-generated memory items missing for challenge:', challenge.id);
      toast({
        title: 'Error',
        description: 'Challenge data is incomplete. Please refresh the page to regenerate challenges.',
        variant: 'destructive',
      });
      setCurrentPhase('ready');
      setIsActive(false);
      return;
    }
    
    console.log('Using AI-generated memory items:', data.items.length);
    setMemoryItems(data.items);
    setShowingItems(true);
    
    setTimeout(() => {
      setShowingItems(false);
    }, data.items.length * 1000);
  }, [data, challenge.id]);

  const initSpeedProcessing = () => {
    // Require AI-generated data - no fallbacks
    if (!data.questions || !Array.isArray(data.questions) || data.questions.length === 0) {
      console.error('AI-generated questions missing for challenge:', challenge.id);
      toast({
        title: 'Error',
        description: 'Challenge data is incomplete. Please refresh the page to regenerate challenges.',
        variant: 'destructive',
      });
      setCurrentPhase('ready');
      setIsActive(false);
      return;
    }
    
    console.log('Using AI-generated questions:', data.questions.length);
    setSpeedQuestions(data.questions);
  };

  const initStrategicPlanning = () => {
    // Require AI-generated data - no fallbacks
    if (!data.scenario || typeof data.scenario !== 'object' || !data.scenario.situation) {
      console.error('AI-generated scenario missing for challenge:', challenge.id);
      toast({
        title: 'Error',
        description: 'Challenge data is incomplete. Please refresh the page to regenerate challenges.',
        variant: 'destructive',
      });
      setCurrentPhase('ready');
      setIsActive(false);
      return;
    }
    
    console.log('Using AI-generated scenario:', data.scenario);
    setPlanningScenario(data.scenario);
  };

  const handleWorkingMemoryAnswer = (answer: any) => {
    if (showingItems) return;
    const newAnswers = [...userAnswers, answer];
    setUserAnswers(newAnswers);
    
    if (newAnswers.length === memoryItems.length) {
      completeChallenge();
    }
  };

  const handleSpeedAnswer = (answer: number) => {
    const newAnswers = [...speedAnswers, answer];
    setSpeedAnswers(newAnswers);
    
    if (currentQuestion + 1 < speedQuestions.length) {
      setCurrentQuestion(currentQuestion + 1);
      setInputValue('');
    } else {
      completeChallenge();
    }
  };

  const handlePlanningDecision = (decision: any) => {
    const newDecisions = [...decisions, decision];
    setDecisions(newDecisions);
    
    if (newDecisions.length >= 3) {
      completeChallenge();
    }
  };

  const handleTimeUp = () => {
    completeChallenge();
  };

  const completeChallenge = () => {
    setIsActive(false);
    setCurrentPhase('complete');
    
    // Compute from absolute timestamps so background throttling doesn't skew results.
    const timeTaken =
      startedAtMsRef.current !== null
        ? Math.min(challenge.timeLimit, Math.floor((Date.now() - startedAtMsRef.current) / 1000))
        : challenge.timeLimit - timeLeft;

    endAtMsRef.current = null;
    didTimeUpRef.current = true;
    startedAtMsRef.current = null;
    let accuracy = 0;
    const focusScore = Math.max(0, 100 - (timeTaken / challenge.timeLimit) * 50);

    if (challenge.type === 'working-memory') {
      const correct = userAnswers.filter((ans, idx) => 
        memoryItems[idx] && ans === memoryItems[idx].value
      ).length;
      accuracy = memoryItems.length > 0 ? (correct / memoryItems.length) * 100 : 0;
    } else if (challenge.type === 'speed-processing') {
      const correct = speedAnswers.filter((ans, idx) => 
        speedQuestions[idx] && ans === speedQuestions[idx].answer
      ).length;
      accuracy = speedQuestions.length > 0 ? (correct / speedQuestions.length) * 100 : 0;
    } else if (challenge.type === 'strategic-planning') {
      accuracy = (decisions.length / 3) * 100;
    }

    onComplete({ accuracy, timeTaken, focusScore });
  };

  const renderReadyPhase = () => (
    <Card className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Brain className="w-8 h-8 text-primary" />
          <div>
            <h2 className="text-2xl font-bold">{challenge.protocolName || challenge.title}</h2>
            <p className="text-muted-foreground text-sm">{challenge.objective || challenge.description}</p>
          </div>
        </div>
        <Badge variant="outline" className="text-lg px-4 py-2">
          L{challenge.difficulty}
        </Badge>
      </div>

      {challenge.executionProcedure && challenge.executionProcedure.length > 0 && (
        <div className="p-4 bg-muted/20 rounded-lg space-y-2">
          <p className="text-sm font-mono text-muted-foreground uppercase">Execution Procedure:</p>
          <ol className="space-y-2 ml-4 list-decimal text-sm">
            {challenge.executionProcedure.map((step, idx) => (
              <li key={idx} className="text-foreground">{step}</li>
            ))}
          </ol>
        </div>
      )}

      {challenge.successMetric && (
        <div className="p-4 bg-primary/5 border border-primary/20 rounded-lg">
          <p className="text-xs font-mono text-primary/70 uppercase mb-1">Success Metric:</p>
          <p className="text-sm text-foreground">{challenge.successMetric}</p>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4 p-4 bg-muted/20 rounded-lg">
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm">Time: {challenge.timeLimit}s</span>
        </div>
        <div className="flex items-center gap-2">
          <Target className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm">XP: {challenge.xp}</span>
        </div>
      </div>

      <Button onClick={handleStart} className="w-full" size="lg">
        Begin Challenge
      </Button>
    </Card>
  );

  const renderActivePhase = () => {
    return (
      <Card className="p-6 space-y-6">
        {/* Timer and Progress */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="font-mono text-muted-foreground">TIME REMAINING</span>
            <span className={`font-bold ${timeLeft < 10 ? 'text-destructive' : 'text-foreground'}`}>
              {timeLeft}s
            </span>
          </div>
          <Progress value={(timeLeft / challenge.timeLimit) * 100} className="h-2" />
        </div>

        {/* Challenge Content */}
        {challenge.type === 'working-memory' && renderWorkingMemory()}
        {challenge.type === 'speed-processing' && renderSpeedProcessing()}
        {challenge.type === 'strategic-planning' && renderStrategicPlanning()}
      </Card>
    );
  };

  const renderWorkingMemory = () => {
    if (showingItems) {
      return (
        <div className="space-y-4">
          <p className="text-center text-sm text-muted-foreground font-mono">
            MEMORIZE THESE ITEMS
          </p>
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
            {memoryItems.map((item, idx) => (
              <div key={idx} className="p-4 bg-primary/10 rounded-lg text-center">
                <span className="text-2xl font-bold">{item.value}</span>
              </div>
            ))}
          </div>
        </div>
      );
    }

    return (
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground font-mono">
          RECALL THE ITEMS ({userAnswers.length}/{memoryItems.length})
        </p>
        <div className="grid grid-cols-5 gap-2">
          {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => (
            <Button
              key={num}
              onClick={() => handleWorkingMemoryAnswer(num)}
              variant="outline"
              className="h-12"
            >
              {num}
            </Button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          {userAnswers.map((ans, idx) => (
            <Badge key={idx} variant="secondary">{ans}</Badge>
          ))}
        </div>
      </div>
    );
  };

  const renderSpeedProcessing = () => {
    if (currentQuestion >= speedQuestions.length) return null;
    
    const question = speedQuestions[currentQuestion];

    return (
      <div className="space-y-6">
        <div className="text-center">
          <p className="text-sm text-muted-foreground font-mono mb-2">
            QUESTION {currentQuestion + 1}/{speedQuestions.length}
          </p>
          <p className="text-4xl font-bold">{question.question} = ?</p>
        </div>

        <div className="flex gap-2">
          <input
            type="number"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && inputValue) {
                handleSpeedAnswer(parseInt(inputValue));
              }
            }}
            className="flex-1 px-4 py-3 text-2xl text-center border border-border rounded-lg bg-background"
            placeholder="?"
            autoFocus
          />
          <Button
            onClick={() => {
              if (inputValue) {
                handleSpeedAnswer(parseInt(inputValue));
              }
            }}
            size="lg"
          >
            <Zap className="w-4 h-4" />
          </Button>
        </div>

        <Progress value={(currentQuestion / speedQuestions.length) * 100} className="h-2" />
      </div>
    );
  };

  const renderStrategicPlanning = () => {
    if (!planningScenario) return null;

    return (
      <div className="space-y-6">
        <div className="p-4 bg-muted/20 rounded-lg">
          <p className="text-sm font-mono text-muted-foreground mb-2">SCENARIO</p>
          <p className="text-sm">{planningScenario.situation}</p>
        </div>

        <div className="space-y-3">
          {planningScenario.tasks?.map((task: any) => (
            <Card key={task.id} className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <p className="font-semibold">{task.name}</p>
                  <p className="text-xs text-muted-foreground">
                    Duration: {task.duration}h • Priority: {task.priority}
                    {task.depends.length > 0 && ` • Depends on: Task ${String.fromCharCode(64 + task.depends[0])}`}
                  </p>
                </div>
                <Button
                  onClick={() => handlePlanningDecision(task)}
                  disabled={decisions.some(d => d.id === task.id)}
                  size="sm"
                >
                  {decisions.findIndex(d => d.id === task.id) >= 0 ? decisions.findIndex(d => d.id === task.id) + 1 : 'Select'}
                </Button>
              </div>
            </Card>
          ))}
        </div>

        {decisions.length > 0 && (
          <div className="p-4 bg-primary/10 rounded-lg">
            <p className="text-sm font-mono text-primary mb-2">YOUR PLAN</p>
            <div className="flex gap-2">
              {decisions.map((dec, idx) => (
                <Badge key={idx} variant="default">{dec.name}</Badge>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderCompletePhase = () => {
    const timeTaken = challenge.timeLimit - timeLeft;
    let accuracy = 0;

    if (challenge.type === 'working-memory') {
      const correct = userAnswers.filter((ans, idx) => 
        memoryItems[idx] && ans === memoryItems[idx].value
      ).length;
      accuracy = memoryItems.length > 0 ? (correct / memoryItems.length) * 100 : 0;
    } else if (challenge.type === 'speed-processing') {
      const correct = speedAnswers.filter((ans, idx) => 
        speedQuestions[idx] && ans === speedQuestions[idx].answer
      ).length;
      accuracy = speedQuestions.length > 0 ? (correct / speedQuestions.length) * 100 : 0;
    } else if (challenge.type === 'strategic-planning') {
      accuracy = (decisions.length / 3) * 100;
    }

    const success = accuracy >= 70;

    return (
      <Card className="p-6 space-y-6">
        <div className="text-center space-y-4">
          {success ? (
            <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto" />
          ) : (
            <XCircle className="w-16 h-16 text-orange-500 mx-auto" />
          )}
          
          <div>
            <h3 className="text-2xl font-bold mb-2">
              {success ? 'Challenge Complete!' : 'Challenge Incomplete'}
            </h3>
            <p className="text-muted-foreground">
              {success ? 'Excellent work!' : 'Keep training to improve'}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4 max-w-md mx-auto">
            <div className="p-4 bg-muted/20 rounded-lg">
              <p className="text-sm text-muted-foreground mb-1">Accuracy</p>
              <p className="text-2xl font-bold">{Math.round(accuracy)}%</p>
            </div>
            <div className="p-4 bg-muted/20 rounded-lg">
              <p className="text-sm text-muted-foreground mb-1">Time</p>
              <p className="text-2xl font-bold">{timeTaken}s</p>
            </div>
          </div>
        </div>
      </Card>
    );
  };

  return (
    <div className="space-y-4">
      {currentPhase === 'ready' && renderReadyPhase()}
      {currentPhase === 'active' && renderActivePhase()}
      {currentPhase === 'complete' && renderCompletePhase()}
    </div>
  );
}
