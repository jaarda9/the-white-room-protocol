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
    <div className="min-h-screen bg-background">
      <div className="border-b border-border/40 bg-card/50 backdrop-blur supports-[backdrop-filter]:bg-card/50">
        <div className="max-w-4xl mx-auto px-4 py-6">
          <div className="flex items-center gap-4">
            <Button variant="ghost" onClick={onReturn}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Knowledge Lab
            </Button>
            <div className="flex-1">
              <h1 className="text-3xl font-bold flex items-center gap-3">
                <BookOpen className="w-8 h-8 text-primary" />
                Quiz Results
              </h1>
              <p className="text-muted-foreground mt-1">
                {domainInfo.name}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
        {/* Score Summary */}
        <Card className="p-6">
          <div className="text-center space-y-4">
            <div className={`text-6xl font-bold ${getScoreColor(results.score)}`}>
              {results.score}%
            </div>
            <p className="text-muted-foreground">
              You got {results.correctAnswers} out of {results.totalQuestions} questions correct
            </p>
            <div className="flex items-center justify-center gap-6 pt-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-green-500">{results.correctAnswers}</div>
                <div className="text-xs text-muted-foreground">Correct</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-red-500">
                  {results.totalQuestions - results.correctAnswers}
                </div>
                <div className="text-xs text-muted-foreground">Incorrect</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold">
                  {Math.floor(results.timeTaken / 60)}:{(results.timeTaken % 60).toString().padStart(2, '0')}
                </div>
                <div className="text-xs text-muted-foreground">Time</div>
              </div>
            </div>
          </div>
        </Card>

        {/* Answer Review */}
        <Card className="p-6">
          <h2 className="text-xl font-bold mb-4">Answer Review</h2>
          <div className="space-y-4">
            {results.results.map((result, index) => (
              <div
                key={index}
                className={`p-4 rounded-lg border-2 ${
                  result.isCorrect
                    ? 'border-green-500/50 bg-green-500/10'
                    : 'border-red-500/50 bg-red-500/10'
                }`}
              >
                <div className="flex items-start gap-3 mb-2">
                  {result.isCorrect ? (
                    <CheckCircle2 className="w-5 h-5 text-green-500 mt-0.5" />
                  ) : (
                    <XCircle className="w-5 h-5 text-red-500 mt-0.5" />
                  )}
                  <div className="flex-1">
                    <div className="font-bold mb-1">
                      Question {index + 1}: {result.question}
                    </div>
                    <div className="text-sm text-muted-foreground mb-2">
                      Your answer: <span className={result.isCorrect ? 'text-green-500' : 'text-red-500'}>
                        {result.userAnswer || 'No answer'}
                      </span>
                    </div>
                    {!result.isCorrect && (
                      <div className="text-sm text-muted-foreground mb-2">
                        Correct answer: <span className="text-green-500">{result.correctAnswer}</span>
                      </div>
                    )}
                    <div className="text-sm bg-background/50 p-2 rounded mt-2">
                      <strong>Explanation:</strong> {result.explanation}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* Rewards */}
        <Card className="p-6 bg-primary/5 border-primary/20">
          <div className="text-center space-y-2">
            <p className="text-sm text-muted-foreground">Rewards Earned</p>
            <div className="flex items-center justify-center gap-4">
              <div>
                <div className="text-lg font-bold text-primary">+{results.score * 2} XP</div>
              </div>
              <div>
                <div className="text-lg font-bold text-primary">+{(results.score / 20).toFixed(1)} INT</div>
              </div>
            </div>
          </div>
        </Card>

        {/* Tomorrow Message */}
        <Card className="p-6 border-dashed border-border">
          <div className="text-center text-muted-foreground">
            <p className="font-mono text-sm">Come back tomorrow for a new topic and quiz.</p>
          </div>
        </Card>

        <Button onClick={onReturn} className="w-full" size="lg">
          Return to Knowledge Lab
        </Button>
      </div>
    </div>
  );
}

