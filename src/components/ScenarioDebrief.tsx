import { SocialScenario, Attributes } from '@/lib/types';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { CheckCircle2, XCircle, AlertTriangle, TrendingUp } from 'lucide-react';

interface ScenarioDebriefProps {
  scenario: SocialScenario;
  score: number;
  missedCues: string[];
  observationsUsed: number;
  timeTaken: number;
  pathTaken: string[];
  rewards: Partial<Attributes>;
}

export const ScenarioDebrief = ({
  scenario,
  score,
  missedCues,
  observationsUsed,
  timeTaken,
  pathTaken,
  rewards,
}: ScenarioDebriefProps) => {
  const efficiency = score >= 0.8 ? 'OPTIMAL' : score >= 0.6 ? 'ADEQUATE' : 'SUBOPTIMAL';
  const efficiencyColor = score >= 0.8 ? 'text-success' : score >= 0.6 ? 'text-primary' : 'text-critical';

  const optimalLen = scenario.optimalPath?.length ?? 0;
  const pathAlignment =
    optimalLen > 0
      ? pathTaken.filter((nodeId) => scenario.optimalPath.includes(nodeId)).length / optimalLen
      : 1;

  return (
    <div className="space-y-4">
      {/* Performance Summary */}
      <Card className="border-primary/20 bg-surface">
        <div className="p-6 space-y-4">
          <div>
            <h3 className="text-xs font-mono text-muted-foreground mb-2">PERFORMANCE ANALYSIS</h3>
            <div className="flex items-end gap-4">
              <div>
                <span className={`text-4xl font-mono ${efficiencyColor}`}>
                  {Math.round(score * 100)}%
                </span>
              </div>
              <div className="flex-1">
                <Progress value={score * 100} className="h-2" />
              </div>
            </div>
            <p className={`text-sm font-mono mt-2 ${efficiencyColor}`}>{efficiency}</p>
          </div>

          <div className="grid grid-cols-3 gap-4 pt-4 border-t border-border/30">
            <div>
              <p className="text-xs text-muted-foreground mb-1">TIME ELAPSED</p>
              <p className="text-lg font-mono">{timeTaken}s</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">OBSERVATIONS</p>
              <p className="text-lg font-mono">{observationsUsed}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">PATH ALIGNMENT</p>
              <p className="text-lg font-mono">{Math.round(pathAlignment * 100)}%</p>
            </div>
          </div>
        </div>
      </Card>

      {/* Objectives Review */}
      <Card className="border-border bg-background">
        <div className="p-6 space-y-4">
          <h3 className="text-xs font-mono text-muted-foreground">OBJECTIVES</h3>
          
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-success mt-0.5" />
              <div>
                <p className="text-xs text-muted-foreground mb-1">PRIMARY</p>
                <p className="text-sm">{scenario.objectives.primary}</p>
              </div>
            </div>

            {scenario.objectives.secondary && scenario.objectives.secondary.map((obj, idx) => (
              <div key={idx} className="flex items-start gap-3">
                {score >= 0.7 ? (
                  <CheckCircle2 className="w-5 h-5 text-success mt-0.5" />
                ) : (
                  <XCircle className="w-5 h-5 text-critical mt-0.5" />
                )}
                <div>
                  <p className="text-xs text-muted-foreground mb-1">SECONDARY</p>
                  <p className="text-sm">{obj}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </Card>

      {/* Missed Cues */}
      {missedCues.length > 0 && (
        <Card className="border-critical/30 bg-critical/5">
          <div className="p-6 space-y-3">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-critical" />
              <h3 className="text-xs font-mono text-critical">MISSED OBSERVATIONS</h3>
              <Badge variant="destructive" className="text-xs">{missedCues.length}</Badge>
            </div>
            
            <div className="space-y-2">
              {missedCues.map((cue, idx) => (
                <div key={idx} className="border-l-2 border-critical/30 pl-3 py-1">
                  <p className="text-xs text-foreground/80">{cue}</p>
                </div>
              ))}
            </div>
          </div>
        </Card>
      )}

      {/* Attribute Rewards */}
      {Object.keys(rewards).length > 0 && (
        <Card className="border-success/30 bg-success/5">
          <div className="p-6 space-y-3">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-success" />
              <h3 className="text-xs font-mono text-success">ACCUMULATED DEVELOPMENT</h3>
            </div>
            
            <div className="grid grid-cols-3 gap-3">
              {Object.entries(rewards).map(([attr, value]) => (
                <div key={attr} className="space-y-1">
                  <p className="text-xs text-muted-foreground font-mono">{attr}</p>
                  <p className="text-lg font-mono text-success">+{value}</p>
                </div>
              ))}
            </div>
          </div>
        </Card>
      )}

      {/* Recommendations */}
      <Card className="border-border bg-background">
        <div className="p-6 space-y-3">
          <h3 className="text-xs font-mono text-muted-foreground">SYSTEM ANALYSIS</h3>
          
          <div className="space-y-2 text-sm text-foreground/80">
            {score < 0.6 && (
              <p>• Performance below acceptable threshold. Review missed observations and decision patterns.</p>
            )}
            {observationsUsed > 2 && (
              <p>• Excessive observation usage detected. Work on baseline perception skills.</p>
            )}
            {pathAlignment < 0.5 && (
              <p>• Significant deviation from optimal path. Analyze consequences of each decision point.</p>
            )}
            {missedCues.length > 3 && (
              <p>• Critical information overlooked. Increase attention to contextual details.</p>
            )}
            {score >= 0.8 && missedCues.length === 0 && (
              <p>• Optimal performance. Advance to higher difficulty scenarios.</p>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
};
