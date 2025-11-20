import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import Chessboard from 'chessboardjsx';
import { Chess, Square } from 'chess.js';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Crown, Loader2, MessageSquare, RotateCw, Lightbulb, BarChart3, BookOpen } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import chatGPTService from '@/lib/chatgpt-service';
import { getUserProfile, saveUserProfile } from '@/lib/storage';
import { UserProfile, Attributes } from '@/lib/types';
import { Textarea } from '@/components/ui/textarea';

type TrainingMode = 'openings' | 'middlegame' | 'endgame' | 'tactics' | 'free' | 'lesson';

interface LessonStep {
  move: string;
  color: 'w' | 'b';
  text: string;
}

interface Lesson {
  title: string;
  moves: LessonStep[];
}

const lessons: Record<string, Lesson> = {
  italian: {
    title: "Italian Game Opening",
    moves: [
      { move: "e4", color: "w", text: "Start with e4 to control the center and open lines for your pieces." },
      { move: "e5", color: "b", text: "Black mirrors with e5." },
      { move: "Nf3", color: "w", text: "Develop your knight to f3, attacking e5 and developing toward the center." },
      { move: "Nc6", color: "b", text: "Black defends with Nc6." },
      { move: "Bc4", color: "w", text: "The Italian Game! Bishop to c4 targets f7, the weakest point in Black's position." }
    ]
  },
  sicilian: {
    title: "Sicilian Defense",
    moves: [
      { move: "e4", color: "w", text: "White opens with e4." },
      { move: "c5", color: "b", text: "The Sicilian Defense! Black counters from the side, preparing asymmetric play." },
      { move: "Nf3", color: "w", text: "Develop the knight, preparing d4." },
      { move: "d6", color: "b", text: "Black supports the center with d6." },
      { move: "d4", color: "w", text: "White strikes in the center with d4." },
      { move: "cxd4", color: "b", text: "Black captures on d4." },
      { move: "Nxd4", color: "w", text: "Recapture with the knight - the Open Sicilian position is reached." }
    ]
  },
  queens_gambit: {
    title: "Queen's Gambit",
    moves: [
      { move: "d4", color: "w", text: "Start with d4, controlling the center from a distance." },
      { move: "d5", color: "b", text: "Black mirrors with d5." },
      { move: "c4", color: "w", text: "The Queen's Gambit! Offer a pawn to gain central control." },
      { move: "e6", color: "b", text: "Black declines the gambit with e6, keeping a solid position." },
      { move: "Nc3", color: "w", text: "Develop the knight, maintaining pressure on d5." }
    ]
  }
};

export default function ChessLab() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [game, setGame] = useState(new Chess());
  const [fen, setFen] = useState(game.fen());
  const [selectedMode, setSelectedMode] = useState<TrainingMode | null>(null);
  const [aiCoaching, setAiCoaching] = useState<string[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [userQuestion, setUserQuestion] = useState('');
  const [moveHistory, setMoveHistory] = useState<string[]>([]);
  const [boardOrientation, setBoardOrientation] = useState<'white' | 'black'>('white');
  const [lessonMode, setLessonMode] = useState(false);
  const [currentLesson, setCurrentLesson] = useState<Lesson | null>(null);
  const [currentLessonStep, setCurrentLessonStep] = useState(0);
  const [showLessonList, setShowLessonList] = useState(false);
  const aiMoveTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const userProfile = getUserProfile();
    setProfile(userProfile);
  }, []);

  useEffect(() => {
    return () => {
      if (aiMoveTimeout.current) {
        clearTimeout(aiMoveTimeout.current);
      }
    };
  }, []);

  const resetLessonState = useCallback(() => {
    setLessonMode(false);
    setCurrentLesson(null);
    setCurrentLessonStep(0);
  }, []);

  const startTraining = async (mode: TrainingMode) => {
    resetLessonState();
    setSelectedMode(mode);
    const newGame = new Chess();
    setGame(newGame);
    setFen(newGame.fen());
    setMoveHistory([]);
    setAiCoaching([]);

    // Get initial coaching based on mode
    setIsAnalyzing(true);
    try {
      const prompt = getInitialPrompt(mode);
      const response = await chatGPTService.callChatGPT(prompt, {
        temperature: 0.7,
        maxTokens: 500,
      });
      setAiCoaching([response]);
    } catch (error) {
      console.error('AI coaching error:', error);
      toast({
        title: 'Coaching unavailable',
        description: 'Continue playing, coaching will resume.',
        variant: 'destructive',
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  const getInitialPrompt = (mode: TrainingMode): string => {
    const modePrompts = {
      openings: `You are a chess coach teaching openings. Provide a brief introduction to common chess openings (King's Pawn, Queen's Pawn, etc.) and suggest one to practice. Be concise and encouraging.`,
      middlegame: `You are a chess coach teaching middlegame strategy. Explain key middlegame concepts like piece activity, pawn structure, and king safety. Be concise.`,
      endgame: `You are a chess coach teaching endgames. Explain basic endgame principles like king activity, pawn promotion, and key checkmate patterns. Be concise.`,
      tactics: `You are a chess coach teaching tactics. Explain common tactical motifs like pins, forks, skewers, and discovered attacks. Be concise.`,
      free: `You are a chess coach. Introduce yourself and offer to help with any aspect of chess. Be concise and friendly.`,
      lesson: `You are a chess coach guiding through structured lessons.`,
    };
    return modePrompts[mode];
  };

  const startLesson = async (lessonKey: string) => {
    setLessonMode(true);
    setCurrentLesson(lessons[lessonKey]);
    setCurrentLessonStep(0);
    setSelectedMode('lesson');
    setShowLessonList(false);
    
    const newGame = new Chess();
    setGame(newGame);
    setFen(newGame.fen());
    setMoveHistory([]);
    setAiCoaching([`Starting lesson: ${lessons[lessonKey].title}`]);
    
    // Show first instruction
    const firstStep = lessons[lessonKey].moves[0];
    if (firstStep.color === 'w') {
      setAiCoaching([`Lesson: ${lessons[lessonKey].title}`, firstStep.text]);
    }
  };

  const processLessonMove = useCallback((move: { sourceSquare: string; targetSquare: string }) => {
    if (!currentLesson || !lessonMode) return;

    const step = currentLesson.moves[currentLessonStep];
    if (!step || step.color !== 'w') return;

    const gameCopy = new Chess(game.fen());
    try {
      const result = gameCopy.move({
        from: move.sourceSquare,
        to: move.targetSquare,
        promotion: 'q',
      });

      if (!result) return;

      // Check if it matches the expected move
      if (result.san === step.move) {
        setGame(gameCopy);
        setFen(gameCopy.fen());
        const newHistory = [...moveHistory, result.san];
        setMoveHistory(newHistory);
        
        toast({
          title: 'Correct!',
          description: `Good move: ${result.san}`,
        });

        // Move to next step
        const nextStep = currentLessonStep + 1;
        setCurrentLessonStep(nextStep);

        // If there's a black move, play it automatically
        if (nextStep < currentLesson.moves.length && currentLesson.moves[nextStep].color === 'b') {
          setTimeout(() => {
            const blackStep = currentLesson.moves[nextStep];
            const blackGame = new Chess(gameCopy.fen());
            blackGame.move(blackStep.move);
            setGame(blackGame);
            setFen(blackGame.fen());
            setMoveHistory([...newHistory, blackStep.move]);
            setAiCoaching(prev => [...prev, `AI plays: ${blackStep.move}`, blackStep.text]);
            
            // Move to next step and show instruction
            const afterBlack = nextStep + 1;
            setCurrentLessonStep(afterBlack);
            if (afterBlack < currentLesson.moves.length) {
              setAiCoaching(prev => [...prev, currentLesson.moves[afterBlack].text]);
            } else {
              setAiCoaching(prev => [...prev, `✅ Lesson complete! You've learned the ${currentLesson.title}.`]);
              resetLessonState();
            }
          }, 1000);
        } else if (nextStep < currentLesson.moves.length) {
          setAiCoaching(prev => [...prev, currentLesson.moves[nextStep].text]);
        } else {
          setAiCoaching(prev => [...prev, `✅ Lesson complete! You've learned the ${currentLesson.title}.`]);
          resetLessonState();
        }
      } else {
        toast({
          title: 'Not quite!',
          description: `Expected move: ${step.move}. Try again.`,
          variant: 'destructive',
        });
      }
    } catch (error) {
      return;
    }
  }, [lessonMode, currentLesson, currentLessonStep, game, moveHistory, toast, resetLessonState]);

  const playAIMove = useCallback((currentFen: string) => {
    if (lessonMode || selectedMode !== 'free') return;
    const aiGame = new Chess(currentFen);
    if (aiGame.isGameOver()) return;
    const legalMoves = aiGame.moves({ verbose: true });
    if (!legalMoves.length) return;
    const aiMove = legalMoves[Math.floor(Math.random() * legalMoves.length)];
    aiGame.move(aiMove);
    setGame(aiGame);
    setFen(aiGame.fen());
    setMoveHistory(prev => [...prev, aiMove.san]);
    setAiCoaching(prev => [...prev, `♟️ Architect replies with ${aiMove.san}. Your move.`]);
  }, [lessonMode, selectedMode]);

  const queueAIMove = useCallback((nextFen: string) => {
    if (selectedMode !== 'free' || lessonMode) return;
    if (aiMoveTimeout.current) {
      clearTimeout(aiMoveTimeout.current);
    }
    aiMoveTimeout.current = setTimeout(() => {
      playAIMove(nextFen);
      aiMoveTimeout.current = null;
    }, 800);
  }, [lessonMode, selectedMode, playAIMove]);

  const onDrop = useCallback((move: { sourceSquare: string; targetSquare: string }) => {
    if (!selectedMode) return;

    // Handle lesson mode differently
    if (lessonMode) {
      processLessonMove(move);
      return;
    }

    const gameCopy = new Chess(game.fen());
    try {
      const result = gameCopy.move({
        from: move.sourceSquare,
        to: move.targetSquare,
        promotion: 'q',
      });

      if (!result) return;

      setGame(gameCopy);
      setFen(gameCopy.fen());
      const newHistory = [...moveHistory, result.san];
      setMoveHistory(newHistory);

      // Get AI analysis of the move
      analyzeMove(result.san, gameCopy.fen(), newHistory);

      if (selectedMode === 'free') {
        queueAIMove(gameCopy.fen());
      }
    } catch (error) {
      return;
    }
  }, [selectedMode, game, moveHistory, lessonMode, processLessonMove, analyzeMove, queueAIMove]);

  const analyzeMove = async (move: string, fen: string, history: string[]) => {
    setIsAnalyzing(true);
    try {
      const prompt = `As a chess coach analyzing a ${selectedMode} position, the player just made the move ${move}. 
      Current position (FEN): ${fen}
      Move history: ${history.join(', ')}
      
      Provide brief feedback (2-3 sentences):
      1. Is this move good or could it be improved?
      2. What should the player consider next?
      Keep it concise and educational.`;

      const response = await chatGPTService.callChatGPT(prompt, {
        temperature: 0.7,
        maxTokens: 300,
      });

      setAiCoaching(prev => [...prev, `After ${move}: ${response}`]);
    } catch (error) {
      console.error('Move analysis error:', error);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const getHint = async () => {
    if (game.isGameOver()) {
      toast({
        title: 'Game Over',
        description: 'No hints available - the game has ended.',
      });
      return;
    }

    setIsAnalyzing(true);
    try {
      const moves = game.moves({ verbose: true });
      if (moves.length === 0) return;

      // Get a random legal move as a simple hint
      const randomMove = moves[Math.floor(Math.random() * moves.length)];
      
      const prompt = `As a chess coach, suggest why moving from ${randomMove.from} to ${randomMove.to} might be a good option in this position. Keep it brief (2 sentences).
      Current position (FEN): ${game.fen()}`;

      const response = await chatGPTService.callChatGPT(prompt, {
        temperature: 0.7,
        maxTokens: 200,
      });

      setAiCoaching(prev => [...prev, `💡 Hint: Consider ${randomMove.san}. ${response}`]);
      
      toast({
        title: 'Hint',
        description: `Consider the move ${randomMove.san}`,
      });
    } catch (error) {
      console.error('Hint error:', error);
      toast({
        title: 'Error',
        description: 'Could not generate hint',
        variant: 'destructive',
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  const analyzePosition = async () => {
    setIsAnalyzing(true);
    try {
      const prompt = `As a chess coach, analyze this position briefly (3-4 sentences):
      FEN: ${game.fen()}
      Move history: ${moveHistory.join(', ')}
      
      What's the current evaluation and what should the player focus on?`;

      const response = await chatGPTService.callChatGPT(prompt, {
        temperature: 0.7,
        maxTokens: 400,
      });

      setAiCoaching(prev => [...prev, `📊 Position Analysis: ${response}`]);
    } catch (error) {
      console.error('Analysis error:', error);
      toast({
        title: 'Error',
        description: 'Could not analyze position',
        variant: 'destructive',
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  const flipBoard = () => {
    setBoardOrientation(prev => {
      const next = prev === 'white' ? 'black' : 'white';
      toast({
        title: 'Board Flipped',
        description: `Now viewing from ${next}'s perspective`,
      });
      return next;
    });
  };

  const askCoach = async () => {
    if (!userQuestion.trim() || !selectedMode) return;

    setIsAnalyzing(true);
    try {
      const prompt = `As a chess coach, the student asks: "${userQuestion}"
      Current position (FEN): ${game.fen()}
      Context: We're training ${selectedMode}.
      
      Provide a helpful, concise answer (3-4 sentences).`;

      const response = await chatGPTService.callChatGPT(prompt, {
        temperature: 0.7,
        maxTokens: 400,
      });

      setAiCoaching(prev => [...prev, `Q: ${userQuestion}`, `A: ${response}`]);
      setUserQuestion('');
    } catch (error) {
      console.error('Coach question error:', error);
      toast({
        title: 'Error',
        description: 'Could not get response from coach',
        variant: 'destructive',
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  const completeSession = () => {
    if (!profile || !selectedMode) return;

    // Award XP and attributes based on moves made
    const xpGained = Math.min(moveHistory.length * 5, 100);
    const strategicPoints = Math.floor(moveHistory.length * 0.3);

    const updatedProfile = {
      ...profile,
      xp: profile.xp + xpGained,
      accumulatedPoints: {
        ...profile.accumulatedPoints,
        INT: profile.accumulatedPoints.INT + strategicPoints,
        WIS: profile.accumulatedPoints.WIS + Math.floor(strategicPoints * 0.5),
        PER: profile.accumulatedPoints.PER + Math.floor(strategicPoints * 0.3),
      } as Attributes,
    };

    // Check for level up
    while (updatedProfile.xp >= updatedProfile.xpToNextLevel) {
      updatedProfile.xp -= updatedProfile.xpToNextLevel;
      updatedProfile.level += 1;
      updatedProfile.xpToNextLevel = Math.floor(100 * Math.pow(1.5, updatedProfile.level - 1));

      Object.keys(updatedProfile.accumulatedPoints).forEach((key) => {
        const attr = key as keyof Attributes;
        const accumulated = updatedProfile.accumulatedPoints[attr];
        const toAdd = Math.floor(accumulated / 10);
        if (toAdd > 0) {
          updatedProfile.visibleStats[attr] += toAdd;
          updatedProfile.accumulatedPoints[attr] = accumulated % 10;
        }
      });

      toast({
        title: '🎉 Level Up!',
        description: `You've reached level ${updatedProfile.level}!`,
      });
    }

    saveUserProfile(updatedProfile);
    setProfile(updatedProfile);

    toast({
      title: 'Training Complete',
      description: `+${xpGained} XP earned!`,
    });

    setSelectedMode(null);
    resetLessonState();
    const newGame = new Chess();
    setGame(newGame);
    setFen(newGame.fen());
    setMoveHistory([]);
    setAiCoaching([]);
  };

  const resetBoard = () => {
    if (selectedMode) {
      resetLessonState();
      const newGame = new Chess();
      setGame(newGame);
      setFen(newGame.fen());
      setMoveHistory([]);
      setAiCoaching(prev => [...prev, 'Board reset. Starting fresh!']);
    }
  };

  const getGameStatus = () => {
    if (game.isCheckmate()) {
      return { text: 'Checkmate!', color: 'text-destructive' };
    }
    if (game.isDraw()) {
      return { text: 'Draw', color: 'text-muted-foreground' };
    }
    if (game.isStalemate()) {
      return { text: 'Stalemate', color: 'text-muted-foreground' };
    }
    if (game.inCheck()) {
      return { text: 'Check!', color: 'text-yellow-600' };
    }
    return { text: game.turn() === 'w' ? "White's turn" : "Black's turn", color: 'text-foreground' };
  };

  if (!profile) return null;

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <header className="border-b border-border bg-card sticky top-0 z-10">
        <div className="container mx-auto px-4 py-3 sm:py-4">
          <div className="flex items-center gap-3 sm:gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('/')}
              className="shrink-0"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div className="flex-1 min-w-0">
              <h1 className="text-lg sm:text-xl font-bold tracking-tight flex items-center gap-2">
                <Crown className="h-5 w-5 text-primary shrink-0" />
                <span className="truncate">Chess Training Lab</span>
              </h1>
              <p className="text-xs text-muted-foreground font-mono-data mt-0.5">
                Strategic Mastery Protocol
              </p>
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-6 max-w-6xl">
        {!selectedMode ? (
          <div className="space-y-6">
            <Card className="p-6">
              <h2 className="text-xl font-bold mb-4">Choose Training Mode</h2>
              <p className="text-sm text-muted-foreground mb-6">
                Select a training focus. Your AI coach will guide you through concepts and analyze your moves in real-time.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <Button
                  variant="outline"
                  className="h-auto py-6 flex-col gap-2 hover:bg-primary/10 hover:border-primary"
                  onClick={() => startTraining('openings')}
                >
                  <Crown className="h-6 w-6" />
                  <div>
                    <div className="font-bold">Openings</div>
                    <div className="text-xs text-muted-foreground">Learn opening principles</div>
                  </div>
                </Button>

                <Button
                  variant="outline"
                  className="h-auto py-6 flex-col gap-2 hover:bg-primary/10 hover:border-primary"
                  onClick={() => startTraining('middlegame')}
                >
                  <Crown className="h-6 w-6" />
                  <div>
                    <div className="font-bold">Middlegame</div>
                    <div className="text-xs text-muted-foreground">Master strategy & tactics</div>
                  </div>
                </Button>

                <Button
                  variant="outline"
                  className="h-auto py-6 flex-col gap-2 hover:bg-primary/10 hover:border-primary"
                  onClick={() => startTraining('endgame')}
                >
                  <Crown className="h-6 w-6" />
                  <div>
                    <div className="font-bold">Endgame</div>
                    <div className="text-xs text-muted-foreground">Perfect your technique</div>
                  </div>
                </Button>

                <Button
                  variant="outline"
                  className="h-auto py-6 flex-col gap-2 hover:bg-primary/10 hover:border-primary"
                  onClick={() => startTraining('tactics')}
                >
                  <Crown className="h-6 w-6" />
                  <div>
                    <div className="font-bold">Tactics</div>
                    <div className="text-xs text-muted-foreground">Sharpen calculation</div>
                  </div>
                </Button>

                <Button
                  variant="outline"
                  className="h-auto py-6 flex-col gap-2 hover:bg-primary/10 hover:border-primary"
                  onClick={() => startTraining('free')}
                >
                  <Crown className="h-6 w-6" />
                  <div>
                    <div className="font-bold">Free Play</div>
                    <div className="text-xs text-muted-foreground">Practice with AI guidance</div>
                  </div>
                </Button>

                <Button
                  variant="outline"
                  className="h-auto py-6 flex-col gap-2 hover:bg-primary/10 hover:border-primary"
                  onClick={() => setShowLessonList(true)}
                >
                  <BookOpen className="h-6 w-6" />
                  <div>
                    <div className="font-bold">Structured Lessons</div>
                    <div className="text-xs text-muted-foreground">Step-by-step guided training</div>
                  </div>
                </Button>
              </div>
            </Card>

            {showLessonList && (
              <Card className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-bold">Available Lessons</h2>
                  <Button variant="ghost" size="sm" onClick={() => setShowLessonList(false)}>
                    Close
                  </Button>
                </div>
                <div className="space-y-3">
                  {Object.entries(lessons).map(([key, lesson]) => (
                    <Button
                      key={key}
                      variant="outline"
                      className="w-full justify-between h-auto py-4"
                      onClick={() => startLesson(key)}
                    >
                      <span className="font-semibold">{lesson.title}</span>
                      <Badge variant="secondary">{lesson.moves.length} moves</Badge>
                    </Button>
                  ))}
                </div>
              </Card>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Chess Board */}
            <div className="lg:col-span-2 space-y-4">
              <Card className="p-4">
                <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="capitalize">
                      {lessonMode && currentLesson ? currentLesson.title : `${selectedMode} Training`}
                    </Badge>
                    {lessonMode && currentLesson && (
                      <Badge variant="secondary">
                        Step {currentLessonStep + 1}/{currentLesson.moves.length}
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className={getGameStatus().color}>
                      {getGameStatus().text}
                    </Badge>
                    <div className="text-sm text-muted-foreground">
                      Moves: {moveHistory.length}
                    </div>
                  </div>
                </div>

                <div className="w-full max-w-2xl mx-auto">
                  <Chessboard
                    position={fen}
                    onDrop={onDrop}
                    orientation={boardOrientation}
                  />
                </div>

                <div className="flex gap-2 mt-4 flex-wrap">
                  <Button onClick={getHint} variant="outline" size="sm" disabled={isAnalyzing || game.isGameOver()}>
                    <Lightbulb className="h-4 w-4 mr-1" />
                    Hint
                  </Button>
                  <Button onClick={analyzePosition} variant="outline" size="sm" disabled={isAnalyzing}>
                    <BarChart3 className="h-4 w-4 mr-1" />
                    Analyze
                  </Button>
                  <Button onClick={flipBoard} variant="outline" size="sm">
                    <RotateCw className="h-4 w-4 mr-1" />
                    Flip Board
                  </Button>
                  <Button onClick={resetBoard} variant="outline" size="sm">
                    Reset Board
                  </Button>
                  <Button onClick={completeSession} variant="default" size="sm">
                    Complete Session
                  </Button>
                </div>
              </Card>

              {/* Move History */}
              {moveHistory.length > 0 && (
                <Card className="p-4">
                  <h3 className="font-bold mb-2 text-sm">Move History</h3>
                  <div className="grid grid-cols-[auto_1fr_1fr] gap-2 text-xs">
                    {Array.from({ length: Math.ceil(moveHistory.length / 2) }).map((_, idx) => (
                      <div key={idx} className="contents">
                        <div className="text-muted-foreground">{idx + 1}.</div>
                        <Badge variant="secondary" className="text-xs font-mono">
                          {moveHistory[idx * 2] || ''}
                        </Badge>
                        <Badge variant="secondary" className="text-xs font-mono">
                          {moveHistory[idx * 2 + 1] || ''}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </Card>
              )}
            </div>

            {/* AI Coach Panel */}
            <div className="space-y-4">
              <Card className="p-4">
                <div className="flex items-center gap-2 mb-4">
                  <MessageSquare className="h-5 w-5 text-primary" />
                  <h3 className="font-bold">AI Coach</h3>
                  {isAnalyzing && <Loader2 className="h-4 w-4 animate-spin ml-auto" />}
                </div>

                <div className="space-y-3 max-h-[400px] overflow-y-auto mb-4">
                  {aiCoaching.map((message, idx) => (
                    <div
                      key={idx}
                      className={`text-sm p-3 rounded-lg ${
                        message.startsWith('Q:')
                          ? 'bg-primary/10 text-primary'
                          : 'bg-muted'
                      }`}
                    >
                      {message}
                    </div>
                  ))}
                  {aiCoaching.length === 0 && (
                    <div className="text-sm text-muted-foreground text-center py-8">
                      Make a move to receive coaching...
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <Textarea
                    placeholder="Ask your coach anything..."
                    value={userQuestion}
                    onChange={(e) => setUserQuestion(e.target.value)}
                    className="text-sm min-h-[80px]"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        askCoach();
                      }
                    }}
                  />
                  <Button
                    onClick={askCoach}
                    disabled={!userQuestion.trim() || isAnalyzing}
                    size="sm"
                    className="w-full"
                  >
                    Ask Coach
                  </Button>
                </div>
              </Card>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
