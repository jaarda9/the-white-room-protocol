import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import Chessboard from 'chessboardjsx';
import { Chess } from 'chess.js';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  ArrowLeft, Crown, Loader2, MessageSquare, RotateCw, Lightbulb, 
  BarChart3, BookOpen, Play, GraduationCap, Filter, Zap 
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import chatGPTService from '@/lib/chatgpt-service';
import { getUserProfile, saveUserProfile } from '@/lib/storage';
import { UserProfile, Attributes } from '@/lib/types';
import { Textarea } from '@/components/ui/textarea';
import { chessLessons, Lesson, getLessonsByCategory, getLessonById } from '@/lib/chess-lessons';
import { getBestMove, evaluateCurrentPosition, getHintMove } from '@/lib/chess-ai';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

type GameMode = 'lessons' | 'free-play';

export default function ChessLab() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [game, setGame] = useState(new Chess());
  const [fen, setFen] = useState(game.fen());
  const [gameMode, setGameMode] = useState<GameMode | null>(null);
  const [showLessonList, setShowLessonList] = useState(false);
  const [aiCoaching, setAiCoaching] = useState<string[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isAIThinking, setIsAIThinking] = useState(false);
  const [userQuestion, setUserQuestion] = useState('');
  const [moveHistory, setMoveHistory] = useState<string[]>([]);
  const [boardOrientation, setBoardOrientation] = useState<'white' | 'black'>('white');
  
  // Lesson state
  const [currentLesson, setCurrentLesson] = useState<Lesson | null>(null);
  const [currentLessonStep, setCurrentLessonStep] = useState(0);
  const [selectedCategory, setSelectedCategory] = useState<Lesson['category'] | 'all'>('all');
  const [selectedDifficulty, setSelectedDifficulty] = useState<Lesson['difficulty'] | 'all'>('all');
  
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

  const startFreePlay = async () => {
    setGameMode('free-play');
    const newGame = new Chess();
    setGame(newGame);
    setFen(newGame.fen());
    setMoveHistory([]);
    setAiCoaching(['Welcome to Free Play mode! You play as White against a 1500+ ELO AI opponent. Make your first move!']);
    setCurrentLesson(null);
    setCurrentLessonStep(0);
  };

  const startLesson = async (lessonId: string) => {
    const lesson = getLessonById(lessonId);
    if (!lesson) return;

    setShowLessonList(false);
    setGameMode('lessons');
    setCurrentLesson(lesson);
    setCurrentLessonStep(0);
    
    const newGame = new Chess(lesson.startingFen);
    setGame(newGame);
    setFen(newGame.fen());
    setMoveHistory([]);
    setAiCoaching([
      `📚 Starting lesson: ${lesson.title}`,
      `Difficulty: ${lesson.difficulty}`,
      lesson.description,
      lesson.moves[0].text
    ]);
    
    // If the first move is Black's, play it automatically
    if (lesson.moves[0].color === 'b') {
      setTimeout(() => {
        const firstStep = lesson.moves[0];
        const lessonGame = new Chess(lesson.startingFen);
        lessonGame.move(firstStep.move);
        setGame(lessonGame);
        setFen(lessonGame.fen());
        setMoveHistory([firstStep.move]);
        setCurrentLessonStep(1);
        if (lesson.moves.length > 1) {
          setAiCoaching(prev => [...prev, `AI plays: ${firstStep.move}`, lesson.moves[1].text]);
        }
      }, 1000);
    }
  };

  const processLessonMove = useCallback((move: { sourceSquare: string; targetSquare: string }) => {
    if (!currentLesson) return;

    const step = currentLesson.moves[currentLessonStep];
    if (!step || step.color !== game.turn()) return;

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
          title: '✓ Correct!',
          description: `Good move: ${result.san}`,
        });

        // Move to next step
        const nextStep = currentLessonStep + 1;
        setCurrentLessonStep(nextStep);

        // If there's a next move and it's Black's turn, play it automatically
        if (nextStep < currentLesson.moves.length && currentLesson.moves[nextStep].color === 'b') {
          setTimeout(() => {
            const blackStep = currentLesson.moves[nextStep];
            const blackGame = new Chess(gameCopy.fen());
            blackGame.move(blackStep.move);
            setGame(blackGame);
            setFen(blackGame.fen());
            setMoveHistory([...newHistory, blackStep.move]);
            setAiCoaching(prev => [...prev, `AI plays: ${blackStep.move}`, blackStep.text]);
            
            const afterBlack = nextStep + 1;
            setCurrentLessonStep(afterBlack);
            if (afterBlack < currentLesson.moves.length) {
              setAiCoaching(prev => [...prev, currentLesson.moves[afterBlack].text]);
            } else {
              setAiCoaching(prev => [...prev, `🎓 Lesson complete! You've mastered the ${currentLesson.title}!`]);
            }
          }, 1200);
        } else if (nextStep < currentLesson.moves.length) {
          setAiCoaching(prev => [...prev, currentLesson.moves[nextStep].text]);
        } else {
          setAiCoaching(prev => [...prev, `🎓 Lesson complete! You've mastered the ${currentLesson.title}!`]);
        }
      } else {
        toast({
          title: '✗ Not quite!',
          description: `Expected: ${step.move}. Try again.`,
          variant: 'destructive',
        });
      }
    } catch (error) {
      return;
    }
  }, [currentLesson, currentLessonStep, game, moveHistory, toast]);

  const playAIMove = useCallback(async (currentFen: string) => {
    if (gameMode !== 'free-play') return;
    
    const aiGame = new Chess(currentFen);
    
    // Only play if it's Black's turn (AI plays Black)
    if (aiGame.turn() !== 'b') {
      return;
    }
    
    if (aiGame.isGameOver()) {
      return;
    }

    setIsAIThinking(true);

    // Use the chess AI to get the best move (depth 4 for ~1500 ELO)
    const bestMove = getBestMove(aiGame, 4);
    
    if (bestMove) {
      setTimeout(() => {
        aiGame.move(bestMove);
        setGame(aiGame);
        setFen(aiGame.fen());
        setMoveHistory(prev => [...prev, bestMove]);
        
        const evaluation = evaluateCurrentPosition(aiGame);
        setAiCoaching(prev => [...prev, `♟️ AI plays ${bestMove}. ${evaluation.evaluation}. Your move.`]);
        setIsAIThinking(false);
      }, 500);
    } else {
      setIsAIThinking(false);
    }
  }, [gameMode]);

  const queueAIMove = useCallback((nextFen: string) => {
    if (gameMode !== 'free-play') return;
    if (aiMoveTimeout.current) {
      clearTimeout(aiMoveTimeout.current);
    }
    aiMoveTimeout.current = setTimeout(() => {
      playAIMove(nextFen);
      aiMoveTimeout.current = null;
    }, 800);
  }, [gameMode, playAIMove]);

  const onDrop = useCallback((move: { sourceSquare: string; targetSquare: string }) => {
    if (!gameMode) return;

    // Handle lesson mode
    if (gameMode === 'lessons' && currentLesson) {
      processLessonMove(move);
      return;
    }

    // Handle free play mode
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

      if (gameMode === 'free-play') {
        queueAIMove(gameCopy.fen());
      }
    } catch (error) {
      return;
    }
  }, [gameMode, game, moveHistory, currentLesson, processLessonMove, queueAIMove]);

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
      const hintMove = getHintMove(game);
      
      if (!hintMove) {
        toast({
          title: 'No moves available',
          description: 'The game is over or no legal moves exist.',
        });
        return;
      }

      const prompt = `As a chess coach, briefly explain (2 sentences) why ${hintMove} is a good move in this position. Current position (FEN): ${game.fen()}`;

      const response = await chatGPTService.callChatGPT(prompt, {
        temperature: 0.7,
        maxTokens: 200,
      });

      setAiCoaching(prev => [...prev, `💡 Hint: Consider ${hintMove}. ${response}`]);
      
      toast({
        title: 'Hint',
        description: `Consider the move ${hintMove}`,
      });
    } catch (error) {
      console.error('Hint error:', error);
      toast({
        title: 'Hint',
        description: `Consider ${getHintMove(game)}`,
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  const analyzePosition = async () => {
    setIsAnalyzing(true);
    try {
      const evaluation = evaluateCurrentPosition(game);
      
      const prompt = `As a chess coach, analyze this position briefly (3-4 sentences):
      FEN: ${game.fen()}
      Evaluation: ${evaluation.evaluation}
      Move history: ${moveHistory.join(', ')}
      
      What should the player focus on strategically?`;

      const response = await chatGPTService.callChatGPT(prompt, {
        temperature: 0.7,
        maxTokens: 400,
      });

      setAiCoaching(prev => [...prev, `📊 Position Analysis: ${evaluation.evaluation}`, response]);
    } catch (error) {
      const evaluation = evaluateCurrentPosition(game);
      setAiCoaching(prev => [...prev, `📊 Position Analysis: ${evaluation.evaluation}`]);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const flipBoard = () => {
    setBoardOrientation(prev => prev === 'white' ? 'black' : 'white');
    toast({
      title: 'Board Flipped',
      description: `Now viewing from ${boardOrientation === 'white' ? 'black' : 'white'}'s perspective`,
    });
  };

  const askCoach = async () => {
    if (!userQuestion.trim() || !gameMode) return;

    setIsAnalyzing(true);
    try {
      const prompt = `As a chess coach, the student asks: "${userQuestion}"
      Current position (FEN): ${game.fen()}
      Context: ${gameMode === 'lessons' ? `Learning: ${currentLesson?.title}` : 'Free play practice'}
      
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
    if (!profile || !gameMode) return;

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

    setGameMode(null);
    setShowLessonList(false);
    setCurrentLesson(null);
    const newGame = new Chess();
    setGame(newGame);
    setFen(newGame.fen());
    setMoveHistory([]);
    setAiCoaching([]);
  };

  const resetBoard = () => {
    if (gameMode === 'lessons' && currentLesson) {
      const newGame = new Chess(currentLesson.startingFen);
      setGame(newGame);
      setFen(newGame.fen());
      setMoveHistory([]);
      setCurrentLessonStep(0);
      setAiCoaching(prev => [...prev, '🔄 Board reset to lesson starting position.', currentLesson.moves[0].text]);
    } else if (gameMode === 'free-play') {
      const newGame = new Chess();
      setGame(newGame);
      setFen(newGame.fen());
      setMoveHistory([]);
      setAiCoaching(prev => [...prev, '🔄 Board reset. New game started!']);
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

  const filteredLessons = chessLessons.filter(lesson => {
    const categoryMatch = selectedCategory === 'all' || lesson.category === selectedCategory;
    const difficultyMatch = selectedDifficulty === 'all' || lesson.difficulty === selectedDifficulty;
    return categoryMatch && difficultyMatch;
  });

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
                Strategic Mastery • 1500 ELO AI
              </p>
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-4 sm:py-6 max-w-7xl">
        {!gameMode || showLessonList ? (
          <div className="space-y-6">
            {/* Mode Selection */}
            {!showLessonList && (
              <Card className="p-4 sm:p-6">
                <h2 className="text-xl sm:text-2xl font-bold mb-2">Choose Your Training Path</h2>
                <p className="text-sm text-muted-foreground mb-6">
                  Select structured lessons to learn specific concepts, or practice freely against a strong AI opponent.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Button
                    variant="outline"
                    className="h-auto py-8 flex-col gap-3 hover:bg-primary/10 hover:border-primary"
                    onClick={() => setShowLessonList(true)}
                  >
                    <GraduationCap className="h-8 w-8 text-primary" />
                    <div className="text-center">
                      <div className="font-bold text-lg">Structured Lessons</div>
                      <div className="text-xs text-muted-foreground mt-1">
                        {chessLessons.length} lessons • Step-by-step guided training
                      </div>
                    </div>
                  </Button>

                  <Button
                    variant="outline"
                    className="h-auto py-8 flex-col gap-3 hover:bg-primary/10 hover:border-primary"
                    onClick={startFreePlay}
                  >
                    <Play className="h-8 w-8 text-primary" />
                    <div className="text-center">
                      <div className="font-bold text-lg">Free Play Mode</div>
                      <div className="text-xs text-muted-foreground mt-1">
                        Practice against 1500+ ELO AI • Real-time coaching
                      </div>
                    </div>
                  </Button>
                </div>
              </Card>
            )}

            {/* Lesson Library */}
            {showLessonList && (
              <Card className="p-4 sm:p-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                  <div>
                    <h2 className="text-xl font-bold flex items-center gap-2">
                      <BookOpen className="h-5 w-5" />
                      Lesson Library
                    </h2>
                    <p className="text-sm text-muted-foreground mt-1">
                      {filteredLessons.length} lessons available
                    </p>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="outline" className="flex items-center gap-1">
                      <Filter className="h-3 w-3" />
                      Filters
                    </Badge>
                  </div>
                </div>

                <Tabs defaultValue="all" className="w-full" onValueChange={(v) => setSelectedCategory(v as any)}>
                  <TabsList className="grid w-full grid-cols-3 sm:grid-cols-6 mb-4">
                    <TabsTrigger value="all">All</TabsTrigger>
                    <TabsTrigger value="opening">Openings</TabsTrigger>
                    <TabsTrigger value="middlegame">Middlegame</TabsTrigger>
                    <TabsTrigger value="endgame">Endgame</TabsTrigger>
                    <TabsTrigger value="tactics">Tactics</TabsTrigger>
                    <TabsTrigger value="strategy">Strategy</TabsTrigger>
                  </TabsList>

                  <div className="flex gap-2 mb-4 flex-wrap">
                    <Button
                      variant={selectedDifficulty === 'all' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setSelectedDifficulty('all')}
                    >
                      All Levels
                    </Button>
                    <Button
                      variant={selectedDifficulty === 'beginner' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setSelectedDifficulty('beginner')}
                    >
                      Beginner
                    </Button>
                    <Button
                      variant={selectedDifficulty === 'intermediate' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setSelectedDifficulty('intermediate')}
                    >
                      Intermediate
                    </Button>
                    <Button
                      variant={selectedDifficulty === 'advanced' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setSelectedDifficulty('advanced')}
                    >
                      Advanced
                    </Button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {filteredLessons.map((lesson) => (
                      <Card
                        key={lesson.id}
                        className="p-4 hover:border-primary cursor-pointer transition-colors"
                        onClick={() => startLesson(lesson.id)}
                      >
                        <div className="flex items-start justify-between mb-2">
                          <Badge variant="secondary" className="capitalize text-xs">
                            {lesson.category}
                          </Badge>
                          <Badge 
                            variant={
                              lesson.difficulty === 'beginner' ? 'outline' :
                              lesson.difficulty === 'intermediate' ? 'secondary' : 'default'
                            }
                            className="text-xs capitalize"
                          >
                            {lesson.difficulty}
                          </Badge>
                        </div>
                        <h3 className="font-bold mb-2 text-sm">{lesson.title}</h3>
                        <p className="text-xs text-muted-foreground mb-3">{lesson.description}</p>
                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                          <span>{lesson.moves.length} moves</span>
                          <Zap className="h-3 w-3" />
                        </div>
                      </Card>
                    ))}
                  </div>
                </Tabs>
              </Card>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
            {/* Chess Board */}
            <div className="lg:col-span-2 space-y-4">
              <Card className="p-3 sm:p-4">
                <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="outline" className="capitalize">
                      {gameMode === 'lessons' && currentLesson ? currentLesson.title : 'Free Play vs AI'}
                    </Badge>
                    {gameMode === 'lessons' && currentLesson && (
                      <Badge variant="secondary" className="text-xs">
                        Step {currentLessonStep + 1}/{currentLesson.moves.length}
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="secondary" className={getGameStatus().color}>
                      {getGameStatus().text}
                    </Badge>
                    <div className="text-xs sm:text-sm text-muted-foreground">
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
                  <Button 
                    onClick={getHint} 
                    variant="outline" 
                    size="sm" 
                    disabled={isAnalyzing || isAIThinking || game.isGameOver()}
                  >
                    <Lightbulb className="h-4 w-4 mr-1" />
                    Hint
                  </Button>
                  <Button 
                    onClick={analyzePosition} 
                    variant="outline" 
                    size="sm" 
                    disabled={isAnalyzing || isAIThinking}
                  >
                    <BarChart3 className="h-4 w-4 mr-1" />
                    Analyze
                  </Button>
                  <Button onClick={flipBoard} variant="outline" size="sm">
                    <RotateCw className="h-4 w-4 mr-1" />
                    Flip
                  </Button>
                  <Button onClick={resetBoard} variant="outline" size="sm">
                    Reset
                  </Button>
                  <Button onClick={completeSession} variant="default" size="sm" className="ml-auto">
                    Complete
                  </Button>
                </div>
              </Card>

              {/* Move History */}
              {moveHistory.length > 0 && (
                <Card className="p-3 sm:p-4">
                  <h3 className="font-bold mb-2 text-sm">Move History</h3>
                  <div className="grid grid-cols-[auto_1fr_1fr] gap-2 text-xs max-h-32 overflow-y-auto">
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
                  {(isAnalyzing || isAIThinking) && <Loader2 className="h-4 w-4 animate-spin ml-auto" />}
                </div>

                <div className="space-y-3 max-h-[300px] sm:max-h-[400px] overflow-y-auto mb-4">
                  {aiCoaching.map((message, idx) => (
                    <div
                      key={idx}
                      className={`text-xs sm:text-sm p-3 rounded-lg ${
                        message.startsWith('Q:')
                          ? 'bg-primary/10 text-primary'
                          : message.startsWith('📚') || message.startsWith('🎓')
                          ? 'bg-accent/20 border border-accent'
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
                    disabled={!userQuestion.trim() || isAnalyzing || isAIThinking}
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
