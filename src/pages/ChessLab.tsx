import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import Chessboard from 'chessboardjsx';
import { Chess } from 'chess.js';
import { 
  ArrowLeft, Crown, RotateCw, Lightbulb, 
  BookOpen, Play, GraduationCap
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { getUserProfile, saveUserProfile, addXP } from '@/lib/storage';
import { UserProfile } from '@/lib/types';
import { chessLessons, Lesson, getLessonById } from '@/lib/chess-lessons';
import { getBestMove, evaluateCurrentPosition, getHintMove } from '@/lib/chess-ai';
import { systemSound } from '@/lib/system-sound';

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
  const [moveHistory, setMoveHistory] = useState<string[]>([]);
  const [boardOrientation, setBoardOrientation] = useState<'white' | 'black'>('white');
  
  // Lesson state
  const [currentLesson, setCurrentLesson] = useState<Lesson | null>(null);
  const [currentLessonStep, setCurrentLessonStep] = useState(0);
  
  const aiMoveTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setProfile(getUserProfile());
  }, []);

  useEffect(() => {
    return () => {
      if (aiMoveTimeout.current) {
        clearTimeout(aiMoveTimeout.current);
      }
    };
  }, []);

  const startFreePlay = () => {
    systemSound.playClick();
    setGameMode('free-play');
    const newGame = new Chess();
    setGame(newGame);
    setFen(newGame.fen());
    setMoveHistory([]);
    setAiCoaching(['[SYSTEM NOTIFICATION]: Strategic Chess Infiltration initiated. White to move against Grandmaster Engine.']);
    setCurrentLesson(null);
    setCurrentLessonStep(0);
  };

  const startLesson = (lessonId: string) => {
    const lesson = getLessonById(lessonId);
    if (!lesson) return;
    systemSound.playClick();

    setShowLessonList(false);
    setGameMode('lessons');
    setCurrentLesson(lesson);
    setCurrentLessonStep(0);
    
    const newGame = new Chess(lesson.startingFen);
    setGame(newGame);
    setFen(newGame.fen());
    setMoveHistory([]);
    setAiCoaching([
      `[TACTICAL TRIAL]: ${lesson.title}`,
      lesson.description,
      lesson.moves[0].text
    ]);
  };

  const onDrop = useCallback((move: { sourceSquare: string; targetSquare: string }) => {
    if (!gameMode) return;

    const gameCopy = new Chess(game.fen());
    try {
      const result = gameCopy.move({
        from: move.sourceSquare,
        to: move.targetSquare,
        promotion: 'q',
      });

      if (!result) return;
      systemSound.playSystemChime();

      setGame(gameCopy);
      setFen(gameCopy.fen());
      const newHistory = [...moveHistory, result.san];
      setMoveHistory(newHistory);

      if (gameMode === 'free-play') {
        setTimeout(() => {
          const best = getBestMove(gameCopy, 3);
          if (best) {
            gameCopy.move(best);
            setGame(new Chess(gameCopy.fen()));
            setFen(gameCopy.fen());
            setMoveHistory([...newHistory, best]);
            setAiCoaching(prev => [...prev, `[ENGINE MOVE]: Opponent played ${best}.`]);
          }
        }, 500);
      }
    } catch (e) {
      return;
    }
  }, [gameMode, game, moveHistory]);

  const getHint = () => {
    systemSound.playClick();
    const hint = getHintMove(game);
    if (hint) {
      setAiCoaching(prev => [...prev, `[PERCEPTION HINT]: Optimal candidate move detected: ${hint}`]);
    }
  };

  const completeSession = () => {
    if (!profile) return;
    systemSound.playLevelUp();
    const xpGained = Math.min(Math.max(20, moveHistory.length * 5), 100);
    const updated = addXP(profile, xpGained);
    saveUserProfile(updated);
    setProfile(updated);

    toast({
      title: 'Dungeon Trial Cleared',
      description: `+${xpGained} XP awarded to Hunter Status!`,
    });
    setGameMode(null);
    setShowLessonList(false);
  };

  if (!profile) return null;

  return (
    <div className="min-h-screen pt-6 pb-28 bg-[#071322] text-[#e5ecf4] flex flex-col system-blueprint-bg font-mono">
      <main className="max-w-4xl mx-auto w-full px-4 py-8 flex-1 space-y-6">
        <div className="flex items-center justify-between">
          <button
            onClick={() => {
              systemSound.playClick();
              if (gameMode || showLessonList) {
                setGameMode(null);
                setShowLessonList(false);
              } else {
                navigate('/');
              }
            }}
            className="flex items-center gap-2 px-3 py-1.5 border border-white/50 bg-[#061426]/80 text-[#9fd3ff] text-xs font-mono hover:bg-white/10 hover:border-white transition-all shadow-[0_0_10px_rgba(0,212,255,0.2)]"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>[ RETURN TO STATUS ]</span>
          </button>
        </div>

        <div className="relative bg-[#0a1b2e]/90 border-2 border-white/50 rounded-[4px] p-6 text-center text-white shadow-[0_0_30px_rgba(0,0,0,0.85),inset_0_0_24px_rgba(0,212,255,0.08)] backdrop-blur-md anime-dropdown">
          <div className="inline-block px-8 py-1 border border-white/70 bg-[#061426]/60 shadow-[0_0_14px_rgba(0,212,255,0.35)] mb-2">
            <h1 className="text-xl sm:text-2xl font-mono font-bold text-white anime-glow-text tracking-[0.2em]">
              STRATEGIC CHESS DUNGEON
            </h1>
          </div>
          <p className="text-xs font-mono text-white/80 mt-1">
            Grandmaster tactical calculation gate for cognitive intellect and foresight conditioning.
          </p>
        </div>

        {!gameMode && !showLessonList ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div
              onClick={() => setShowLessonList(true)}
              className="bg-[#0a1b2e]/85 border-2 border-white/40 rounded-[4px] p-6 cursor-pointer hover:border-white/90 hover:bg-[#0a1b2e] transition-all text-center space-y-3 group shadow-[0_0_20px_rgba(0,0,0,0.7),inset_0_0_15px_rgba(0,212,255,0.05)] anime-dropdown"
            >
              <GraduationCap className="w-8 h-8 text-[#9fd3ff] mx-auto group-hover:scale-110 transition-transform" />
              <h2 className="font-mono font-bold text-lg text-white">
                TACTICAL LESSONS
              </h2>
              <p className="text-xs font-mono text-gray-300">
                Step-by-step master endgame maneuvers, pin tactics, and opening theory.
              </p>
            </div>

            <div
              onClick={startFreePlay}
              className="bg-[#0a1b2e]/85 border-2 border-white/40 rounded-[4px] p-6 cursor-pointer hover:border-white/90 hover:bg-[#0a1b2e] transition-all text-center space-y-3 group shadow-[0_0_20px_rgba(0,0,0,0.7),inset_0_0_15px_rgba(0,212,255,0.05)] anime-dropdown"
            >
              <Play className="w-8 h-8 text-[#9fd3ff] mx-auto group-hover:scale-110 transition-transform" />
              <h2 className="font-mono font-bold text-lg text-white">
                FREE PLAY SIMULATION
              </h2>
              <p className="text-xs font-mono text-gray-300">
                Real-time tactical combat simulation against advanced engine intelligence.
              </p>
            </div>
          </div>
        ) : showLessonList ? (
          <div className="relative bg-[#0a1b2e]/90 border-2 border-white/50 rounded-[4px] p-6 space-y-4 text-white shadow-[0_0_30px_rgba(0,0,0,0.85),inset_0_0_24px_rgba(0,212,255,0.08)] backdrop-blur-md anime-dropdown">
            <h2 className="text-base font-mono font-bold text-white anime-glow-text border-b border-white/20 pb-3">
              [ SELECT TACTICAL TRIAL ]
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 font-mono">
              {chessLessons.map((lesson) => (
                <div
                  key={lesson.id}
                  onClick={() => startLesson(lesson.id)}
                  className="p-3.5 border border-white/30 bg-[#061424]/75 hover:border-white hover:bg-white/10 cursor-pointer transition-all rounded-[2px]"
                >
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="text-[#9fd3ff] font-bold">{lesson.title}</span>
                    <span className="text-[10px] text-gray-400 uppercase">{lesson.difficulty}</span>
                  </div>
                  <p className="text-[11px] text-gray-300 line-clamp-2">{lesson.description}</p>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="md:col-span-2 relative bg-[#0a1b2e]/90 border-2 border-white/50 rounded-[4px] p-4 flex flex-col items-center space-y-4 text-white shadow-[0_0_30px_rgba(0,0,0,0.85),inset_0_0_24px_rgba(0,212,255,0.08)] backdrop-blur-md anime-dropdown">
              <div className="w-full flex items-center justify-between font-mono text-xs text-[#9fd3ff] border-b border-white/20 pb-2">
                <span className="font-bold">{gameMode === 'lessons' ? currentLesson?.title : 'Simulation Match'}</span>
                <span className="text-white">MOVES: {moveHistory.length}</span>
              </div>

              <div className="max-w-md w-full border border-white/40 p-1 bg-black/70 shadow-[0_0_15px_rgba(0,0,0,0.8)]">
                <Chessboard
                  position={fen}
                  onDrop={onDrop}
                  orientation={boardOrientation}
                  width={340}
                />
              </div>

              <div className="flex gap-2 w-full font-mono text-xs">
                <button
                  onClick={getHint}
                  className="flex-1 py-2 border border-white/50 bg-[#061426]/80 text-[#9fd3ff] hover:bg-white/10 hover:border-white transition-all shadow-[0_0_10px_rgba(0,212,255,0.2)]"
                >
                  HINT
                </button>
                <button
                  onClick={() => setBoardOrientation(prev => prev === 'white' ? 'black' : 'white')}
                  className="px-4 py-2 border border-white/30 text-gray-300 hover:text-white hover:border-white bg-black/40"
                >
                  FLIP
                </button>
                <button
                  onClick={completeSession}
                  className="flex-1 py-2 border border-emerald-400/80 bg-emerald-950/40 hover:bg-emerald-900/60 text-emerald-300 font-bold tracking-wider transition-all shadow-[0_0_15px_rgba(16,185,129,0.25)]"
                >
                  CLAIM EXP
                </button>
              </div>
            </div>

            <div className="relative bg-[#0a1b2e]/90 border-2 border-white/50 rounded-[4px] p-4 flex flex-col justify-between font-mono text-xs text-white shadow-[0_0_30px_rgba(0,0,0,0.85),inset_0_0_24px_rgba(0,212,255,0.08)] backdrop-blur-md anime-dropdown">
              <div className="space-y-3">
                <div className="text-[#9fd3ff] font-bold border-b border-white/20 pb-2">
                  [ SYSTEM INTEL ]
                </div>
                <div className="space-y-2 text-gray-300 max-h-64 overflow-y-auto">
                  {aiCoaching.map((c, i) => (
                    <div key={i} className="p-2 border border-white/20 bg-[#061424]/80 text-[11px] rounded-[2px]">
                      {c}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
