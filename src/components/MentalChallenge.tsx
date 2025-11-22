import { useState, useEffect, useCallback } from 'react';
import { MentalChallenge } from '@/lib/types';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Brain, Clock, Zap, Target, CheckCircle2, XCircle } from 'lucide-react';

interface MentalChallengeProps {
  challenge: MentalChallenge;
  onComplete: (result: { accuracy: number; timeTaken: number; focusScore: number }) => void;
}

export function MentalChallengeComponent({ challenge, onComplete }: MentalChallengeProps) {
  const data = challenge.data || {};
  const [timeLeft, setTimeLeft] = useState(challenge.timeLimit);
  const [isActive, setIsActive] = useState(false);
  const [currentPhase, setCurrentPhase] = useState<'ready' | 'active' | 'complete'>('ready');
  
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
    
    if (challenge.type === 'working-memory') {
      initWorkingMemory();
    } else if (challenge.type === 'speed-processing') {
      initSpeedProcessing();
    } else if (challenge.type === 'strategic-planning') {
      initStrategicPlanning();
    }
  };

  const initWorkingMemory = useCallback(() => {
    const items = data.items || generateWorkingMemoryItems();
    setMemoryItems(items);
    setShowingItems(true);
    
    setTimeout(() => {
      setShowingItems(false);
    }, items.length * 1000);
  }, [data]);

  const generateWorkingMemoryItems = () => {
    const count = 5 + challenge.difficulty;
    return Array.from({ length: count }, (_, i) => ({
      id: i,
      value: Math.floor(Math.random() * 100),
      position: i
    }));
  };

  const initSpeedProcessing = () => {
    const questions = data.questions || generateSpeedQuestions();
    setSpeedQuestions(questions);
  };

  const generateSpeedQuestions = () => {
    const count = 10 + challenge.difficulty * 2;
    return Array.from({ length: count }, () => {
      const a = Math.floor(Math.random() * 50) + 1;
      const b = Math.floor(Math.random() * 50) + 1;
      const ops = ['+', '-', '*'];
      const op = ops[Math.floor(Math.random() * ops.length)];
      const answer = op === '+' ? a + b : op === '-' ? a - b : a * b;
      return { question: `${a} ${op} ${b}`, answer };
    });
  };

  const initStrategicPlanning = () => {
    const scenario = data.scenario || generatePlanningScenario();
    setPlanningScenario(scenario);
  };

  const generatePlanningScenario = () => {
    return {
      situation: "You have 3 tasks with different priorities and dependencies",
      tasks: [
        { id: 1, name: "Task A", priority: "high", duration: 2, depends: [] },
        { id: 2, name: "Task B", priority: "medium", duration: 3, depends: [1] },
        { id: 3, name: "Task C", priority: "low", duration: 1, depends: [] }
      ],
      question: "What is the optimal order to complete these tasks?"
    };
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
    
    const timeTaken = challenge.timeLimit - timeLeft;
    let accuracy = 0;
    let focusScore = Math.max(0, 100 - (timeTaken / challenge.timeLimit) * 50);

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
