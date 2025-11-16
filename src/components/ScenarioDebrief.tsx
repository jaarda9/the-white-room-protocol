import { ScenarioAttempt } from '@/lib/types';
import { Card } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { 
  CheckCircle2, 
  XCircle, 
  TrendingUp, 
  TrendingDown, 
  Eye, 
  Brain,
  Target,
  Clock
} from 'lucide-react';

interface ScenarioDebriefProps {
  attempt: ScenarioAttempt;
  onContinue: () => void;
}

export function ScenarioDebrief({ attempt, onContinue }: ScenarioDebriefProps) {
  const scorePercent = Math.round(attempt.score * 100);
  const isSuccess = attempt.success;

  const getScoreColor = (score: number) => {
    if (score >= 0.8) return 'text-primary';
    if (score >= 0.5) return 'text-secondary-accent';
    return 'text-critical';
  };

  const getScoreLabel = (score: number) => {
    if (score >= 0.9) return 'OPTIMAL';
    if (score >= 0.7) return 'PROFICIENT';
    if (score >= 0.5) return 'ADEQUATE';
    if (score >= 0.3) return 'SUBOPTIMAL';
    return 'INSUFFICIENT';
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="text-center space-y-4 py-8">
        <div className={`inline-flex items-center gap-3 px-6 py-3 rounded border ${
          isSuccess 
            ? 'bg-primary/10 border-primary/20' 
            : 'bg-critical/10 border-critical/20'
        }`}>
          {isSuccess ? (
            <CheckCircle2 className="w-6 h-6 text-primary" />
          ) : (
            <XCircle className="w-6 h-6 text-critical" />
          )}
          <div className="text-left">
            <div className="font-mono text-sm text-muted-foreground">
              SCENARIO COMPLETE
            </div>
            <div className={`font-mono text-2xl ${isSuccess ? 'text-primary' : 'text-critical'}`}>
              {isSuccess ? 'OBJECTIVE ACHIEVED' : 'OBJECTIVE FAILED'}
            </div>
          </div>
        </div>
      </div>

      {/* Performance Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="p-4 bg-surface border-grid">
          <div className="flex items-center gap-3">
            <Target className="w-5 h-5 text-primary" />
            <div>
              <div className="text-xs font-mono text-muted-foreground">SCORE</div>
              <div className={`text-xl font-mono ${getScoreColor(attempt.score)}`}>
                {scorePercent}%
              </div>
            </div>
          </div>
        </Card>

        <Card className="p-4 bg-surface border-grid">
          <div className="flex items-center gap-3">
            <Clock className="w-5 h-5 text-primary" />
            <div>
              <div className="text-xs font-mono text-muted-foreground">TIME</div>
              <div className="text-xl font-mono text-foreground">
                {Math.floor(attempt.timeTaken / 60)}:{(attempt.timeTaken % 60).toString().padStart(2, '0')}
              </div>
            </div>
          </div>
        </Card>

        <Card className="p-4 bg-surface border-grid">
          <div className="flex items-center gap-3">
            <Brain className="w-5 h-5 text-primary" />
            <div>
              <div className="text-xs font-mono text-muted-foreground">HINTS</div>
              <div className="text-xl font-mono text-foreground">
                {attempt.hintsUsed}
              </div>
            </div>
          </div>
        </Card>

        <Card className="p-4 bg-surface border-grid">
          <div className="flex items-center gap-3">
            <TrendingUp className="w-5 h-5 text-primary" />
            <div>
              <div className="text-xs font-mono text-muted-foreground">XP GAINED</div>
              <div className="text-xl font-mono text-primary">
                +{attempt.xpGained}
              </div>
            </div>
          </div>
        </Card>
      </div>

      {/* Performance Rating */}
      <Card className="p-6 bg-surface border-grid">
        <div className="text-center space-y-2">
          <div className="text-xs font-mono text-muted-foreground uppercase tracking-wider">
            Performance Classification
          </div>
          <Badge 
            variant="outline" 
            className={`text-lg px-4 py-2 font-mono ${getScoreColor(attempt.score)}`}
          >
            {getScoreLabel(attempt.score)}
          </Badge>
        </div>
      </Card>

      {/* Analysis */}
      {attempt.analysis && (
        <Card className="p-6 bg-surface border-grid space-y-6">
          <div className="flex items-center gap-2 pb-4 border-b border-grid">
            <Eye className="w-5 h-5 text-primary" />
            <h3 className="font-mono text-lg text-foreground">DETAILED ANALYSIS</h3>
          </div>

          {/* Observation Score */}
          {attempt.analysis.observationScore !== undefined && (
            <div>
              <div className="text-xs font-mono text-muted-foreground mb-2">
                OBSERVATION CAPABILITY
              </div>
              <div className="flex items-center gap-3">
                <div className="flex-1 h-2 bg-background rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-primary transition-all"
                    style={{ width: `${attempt.analysis.observationScore * 100}%` }}
                  />
                </div>
                <span className="text-sm font-mono text-primary">
                  {Math.round(attempt.analysis.observationScore * 100)}%
                </span>
              </div>
            </div>
          )}

          {/* Strengths */}
          {attempt.analysis.strengths && attempt.analysis.strengths.length > 0 && (
            <div>
              <div className="flex items-center gap-2 text-xs font-mono text-muted-foreground mb-3">
                <TrendingUp className="w-4 h-4 text-primary" />
                IDENTIFIED STRENGTHS
              </div>
              <ul className="space-y-2">
                {attempt.analysis.strengths.map((strength, index) => (
                  <li key={index} className="flex items-start gap-2 text-foreground">
                    <span className="text-primary mt-1">+</span>
                    <span>{strength}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Improvements */}
          {attempt.analysis.improvements && attempt.analysis.improvements.length > 0 && (
            <div>
              <div className="flex items-center gap-2 text-xs font-mono text-muted-foreground mb-3">
                <TrendingDown className="w-4 h-4 text-secondary-accent" />
                IMPROVEMENT AREAS
              </div>
              <ul className="space-y-2">
                {attempt.analysis.improvements.map((improvement, index) => (
                  <li key={index} className="flex items-start gap-2 text-foreground">
                    <span className="text-secondary-accent mt-1">→</span>
                    <span>{improvement}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Missed Cues */}
          {attempt.analysis.missedCues && attempt.analysis.missedCues.length > 0 && (
            <div>
              <div className="flex items-center gap-2 text-xs font-mono text-muted-foreground mb-3">
                <Eye className="w-4 h-4 text-critical" />
                MISSED OBSERVATIONS
              </div>
              <ul className="space-y-2">
                {attempt.analysis.missedCues.map((cue, index) => (
                  <li key={index} className="flex items-start gap-2 text-foreground">
                    <span className="text-critical mt-1">!</span>
                    <span>{cue}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Optimal Choices */}
          {attempt.analysis.optimalChoices && attempt.analysis.optimalChoices.length > 0 && (
            <div>
              <div className="flex items-center gap-2 text-xs font-mono text-muted-foreground mb-3">
                <Target className="w-4 h-4 text-primary" />
                OPTIMAL ALTERNATIVES
              </div>
              <ul className="space-y-2">
                {attempt.analysis.optimalChoices.map((choice, index) => (
                  <li key={index} className="flex items-start gap-2 text-muted-foreground">
                    <span className="text-primary mt-1">•</span>
                    <span>{choice}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Card>
      )}

      {/* Continue Button */}
      <div className="flex justify-center pt-4">
        <Button onClick={onContinue} size="lg" className="font-mono">
          CONTINUE TRAINING
        </Button>
      </div>
    </div>
  );
}
