import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, XCircle, BookOpen, ArrowLeft } from 'lucide-react';
import { KnowledgeDomain, QuizResult } from '@/lib/types';
import { getUserProfile, saveUserProfile, addXP } from '@/lib/storage';
import { useEffect } from 'react';

interface KnowledgeResultsProps {
  domain: KnowledgeDomain;
  domainInfo: { name: string; icon: string; description: string };
  results: QuizResult;
  onReturn: () => void;
}

export function KnowledgeResults({
  domain,
  domainInfo,
  results,
  onReturn,
}: KnowledgeResultsProps) {
  useEffect(() => {
    // Apply rewards
    const profile = getUserProfile();
    const xpGained = results.score * 2; // 2 XP per percentage point
    const intGained = results.score / 20; // 0.05 INT per percentage point

    let updatedProfile = addXP(profile, xpGained);
    
    // Apply INT attribute reward
    const newAccumulated = { ...updatedProfile.accumulatedPoints };
    newAccumulated.INT = (newAccumulated.INT || 0) + intGained;
    updatedProfile = { ...updatedProfile, accumulatedPoints: newAccumulated };

    saveUserProfile(updatedProfile);
  }, [results]);

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-500';
    if (score >= 60) return 'text-yellow-500';
    return 'text-red-500';
  };

  return (
    <div className="min-h-screen bg-[#071322] text-[#e5ecf4] flex flex-col system-blueprint-bg font-mono">
      <div className="border-b border-white/20 bg-[#061222]/90 backdrop-blur-md">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
            <button
              onClick={onReturn}
              className="flex items-center gap-2 px-3 py-1.5 border border-white/50 bg-[#061426]/80 text-[#9fd3ff] text-xs font-mono hover:bg-white/10 hover:border-white transition-all shadow-[0_0_10px_rgba(0,212,255,0.2)] w-max"
            >
              <ArrowLeft className="w-4 h-4 mr-1" />
              <span>[ RETURN TO ARCHIVES ]</span>
            </button>
            <div className="flex-1 text-center sm:text-left">
              <h1 className="text-xl sm:text-2xl font-bold flex items-center justify-center sm:justify-start gap-2 text-white anime-glow-text">
                <BookOpen className="w-5 h-5 text-[#9fd3ff]" />
                Trial Evaluation Results
              </h1>
              <p className="text-white/70 text-xs mt-0.5">{domainInfo.name}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6 flex-1 w-full">
        {/* Score Summary */}
        <div className="relative bg-[#0a1b2e]/90 border-2 border-white/50 rounded-[4px] p-6 sm:p-8 text-white shadow-[0_0_30px_rgba(0,0,0,0.85),inset_0_0_24px_rgba(0,212,255,0.08)] backdrop-blur-md anime-dropdown">
          <div className="text-center space-y-4">
            <div className="inline-block px-8 py-1 border border-white/70 bg-[#061426]/60 shadow-[0_0_14px_rgba(0,212,255,0.35)] mb-2">
              <h2 className="text-sm font-mono tracking-[0.2em] text-white">TRIAL CLEAR SCORE</h2>
            </div>
            <div className={`text-6xl font-bold anime-glow-text ${results.score >= 80 ? 'text-emerald-400' : results.score >= 60 ? 'text-yellow-400' : 'text-red-400'}`}>
              {results.score}%
            </div>
            <p className="text-xs text-gray-300 font-mono">
              Evaluated {results.correctAnswers} of {results.totalQuestions} protocols successfully
            </p>
            <div className="grid grid-cols-3 gap-4 pt-4 border-t border-white/20 text-xs sm:text-sm">
              <div className="text-center space-y-1 p-3 bg-[#061424]/75 border border-white/30 rounded-[2px]">
                <div className="text-xl sm:text-2xl font-bold text-emerald-400">{results.correctAnswers}</div>
                <div className="text-[10px] text-gray-400">CORRECT</div>
              </div>
              <div className="text-center space-y-1 p-3 bg-[#061424]/75 border border-white/30 rounded-[2px]">
                <div className="text-xl sm:text-2xl font-bold text-red-400">
                  {results.totalQuestions - results.correctAnswers}
                </div>
                <div className="text-[10px] text-gray-400">INCORRECT</div>
              </div>
              <div className="text-center space-y-1 p-3 bg-[#061424]/75 border border-white/30 rounded-[2px]">
                <div className="text-xl sm:text-2xl font-bold text-white font-mono">
                  {Math.floor(results.timeTaken / 60)}:{(results.timeTaken % 60).toString().padStart(2, '0')}
                </div>
                <div className="text-[10px] text-gray-400">DURATION</div>
              </div>
            </div>
          </div>
        </div>

        {/* Rewards */}
        <div className="relative bg-[#0a1b2e]/90 border-2 border-emerald-400/60 rounded-[4px] p-5 text-center space-y-2 shadow-[0_0_20px_rgba(0,0,0,0.7),inset_0_0_15px_rgba(16,185,129,0.1)] anime-dropdown">
          <p className="text-xs font-mono text-gray-400">[ PROTOCOL REWARDS GRANTED ]</p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-6 text-emerald-400 font-bold text-base anime-glow-text">
            <div>+{results.score * 2} XP ACQUIRED</div>
            <div>+{(results.score / 20).toFixed(1)} INT INCREASE</div>
          </div>
        </div>

        {/* Answer Review */}
        <div className="relative bg-[#0a1b2e]/90 border-2 border-white/50 rounded-[4px] p-6 text-white shadow-[0_0_30px_rgba(0,0,0,0.85),inset_0_0_24px_rgba(0,212,255,0.08)] backdrop-blur-md anime-dropdown space-y-4">
          <h2 className="text-base font-bold font-mono text-white tracking-wider">[ PROTOCOL LOG ANALYSIS ]</h2>
          <div className="space-y-3">
            {results.results.map((result, index) => (
              <div
                key={index}
                className={`p-4 rounded-[2px] border ${
                  result.isCorrect
                    ? 'border-emerald-500/50 bg-emerald-950/20'
                    : 'border-red-500/50 bg-red-950/20'
                }`}
              >
                <div className="flex items-start gap-3 mb-2">
                  {result.isCorrect ? (
                    <CheckCircle2 className="w-5 h-5 text-emerald-400 mt-0.5 flex-shrink-0" />
                  ) : (
                    <XCircle className="w-5 h-5 text-red-400 mt-0.5 flex-shrink-0" />
                  )}
                  <div className="flex-1 text-xs sm:text-sm">
                    <div className="font-bold mb-1 text-white">
                      Protocol {index + 1}: {result.question}
                    </div>
                    <div className="text-xs text-gray-300 mb-1">
                      Submitted: <span className={result.isCorrect ? 'text-emerald-400 font-bold' : 'text-red-400 font-bold'}>
                        {result.userAnswer || 'No answer'}
                      </span>
                    </div>
                    {!result.isCorrect && (
                      <div className="text-xs text-gray-300 mb-2">
                        Correct Solution: <span className="text-emerald-400 font-bold">{result.correctAnswer}</span>
                      </div>
                    )}
                    <div className="text-xs bg-[#061424]/80 p-2.5 rounded-[2px] border border-white/20 mt-2 text-gray-300">
                      <strong className="text-[#9fd3ff]">Explanation:</strong> {result.explanation}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <button
          onClick={onReturn}
          className="w-full py-3.5 border border-white/60 bg-white/10 hover:bg-white/25 text-white font-mono font-bold text-xs tracking-wider transition-all shadow-[0_0_15px_rgba(0,212,255,0.2)] hover:border-white"
        >
          CONFIRM AND RETURN TO ARCHIVE
        </button>
      </div>
    </div>
  );
}

