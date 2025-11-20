import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Chessboard } from 'react-chessboard';
import { Chess, Square } from 'chess.js';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Crown, Loader2, MessageSquare } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import chatGPTService from '@/lib/chatgpt-service';
import { getUserProfile, saveUserProfile } from '@/lib/storage';
import { UserProfile, Attributes } from '@/lib/types';
import { Textarea } from '@/components/ui/textarea';

type TrainingMode = 'openings' | 'middlegame' | 'endgame' | 'tactics' | 'free';

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

  useEffect(() => {
    const userProfile = getUserProfile();
    setProfile(userProfile);
  }, []);

  const startTraining = async (mode: TrainingMode) => {
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
    };
    return modePrompts[mode];
  };

  const onDrop = useCallback(async (sourceSquare: Square, targetSquare: Square) => {
    if (!selectedMode) return false;

    const gameCopy = new Chess(game.fen());
    try {
      const move = gameCopy.move({
        from: sourceSquare,
        to: targetSquare,
        promotion: 'q',
      });

      if (!move) return false;

      setGame(gameCopy);
      setFen(gameCopy.fen());
      const newHistory = [...moveHistory, move.san];
      setMoveHistory(newHistory);

      // Get AI analysis of the move
      analyzeMove(move.san, gameCopy.fen(), newHistory);

      return true;
    } catch (error) {
      return false;
    }
  }, [selectedMode, game, moveHistory]);

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
    const newGame = new Chess();
    setGame(newGame);
    setFen(newGame.fen());
    setMoveHistory([]);
    setAiCoaching([]);
  };

  const resetBoard = () => {
    if (selectedMode) {
      const newGame = new Chess();
      setGame(newGame);
      setFen(newGame.fen());
      setMoveHistory([]);
      setAiCoaching(prev => [...prev, 'Board reset. Try again!']);
    }
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
              onClick={() => navigate('/dashboard')}
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
              </div>
            </Card>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Chess Board */}
            <div className="lg:col-span-2 space-y-4">
              <Card className="p-4">
                <div className="flex items-center justify-between mb-4">
                  <Badge variant="outline" className="capitalize">
                    {selectedMode} Training
                  </Badge>
                  <div className="text-sm text-muted-foreground">
                    Moves: {moveHistory.length}
                  </div>
                </div>

                <div className="w-full max-w-2xl mx-auto aspect-square">
                  <Chessboard
                    position={fen}
                    onPieceDrop={({ sourceSquare, targetSquare }: any) => {
                      onDrop(sourceSquare as Square, targetSquare as Square);
                      return true;
                    }}
                  />
                </div>

                <div className="flex gap-2 mt-4 flex-wrap">
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
                  <div className="flex flex-wrap gap-2">
                    {moveHistory.map((move, idx) => (
                      <Badge key={idx} variant="secondary" className="text-xs">
                        {Math.floor(idx / 2) + 1}. {move}
                      </Badge>
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
