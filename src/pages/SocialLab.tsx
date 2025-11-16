import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { SocialSimulation } from '@/components/SocialSimulation';
import { ScenarioDebrief } from '@/components/ScenarioDebrief';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  getSocialScenarios, 
  getSocialScenarioById, 
  saveScenarioAttempt,
  getCurrentProfile,
  addXPWithAttributes
} from '@/lib/storage';
import { ArrowLeft, Users } from 'lucide-react';
import { ScenarioAttempt } from '@/lib/types';
import { toast } from '@/hooks/use-toast';

export default function SocialLab() {
  const navigate = useNavigate();
  const { id } = useParams();
  const [activeScenario, setActiveScenario] = useState<string | null>(id || null);
  const [completedAttempt, setCompletedAttempt] = useState<ScenarioAttempt | null>(null);

  const scenarios = getSocialScenarios();
  const currentScenario = activeScenario ? getSocialScenarioById(activeScenario) : null;
  const profile = getCurrentProfile();

  const handleStartScenario = (scenarioId: string) => {
    setActiveScenario(scenarioId);
    setCompletedAttempt(null);
  };

  const handleComplete = (data: {
    timeTaken: number;
    choices: string[];
    hintsUsed: number;
    score: number;
  }) => {
    if (!currentScenario || !profile) return;

    const xpMultiplier = 1 - (data.hintsUsed * 0.15);
    const xpGained = Math.floor(currentScenario.xpReward * data.score * xpMultiplier);

    const analysis = generateAnalysis(currentScenario, data);

    const attempt = saveScenarioAttempt({
      scenarioId: currentScenario.id,
      scenarioType: 'social',
      userId: profile.id,
      timeTaken: data.timeTaken,
      success: data.score >= 0.6,
      score: data.score,
      choices: data.choices,
      hintsUsed: data.hintsUsed,
      xpGained,
      analysis
    });

    addXPWithAttributes(xpGained, currentScenario.attributeRewards);
    setCompletedAttempt(attempt);
    
    toast({
      title: 'Scenario Complete',
      description: `+${xpGained} XP gained`
    });
  };

  const generateAnalysis = (scenario: any, data: any) => {
    const optimalSet = new Set(scenario.optimalPath);
    const choiceSet = new Set(data.choices);
    const missedOptimal = [...optimalSet].filter(c => !choiceSet.has(c));
    
    return {
      observationScore: data.hintsUsed === 0 ? 1.0 : Math.max(0.3, 1 - (data.hintsUsed * 0.2)),
      missedCues: missedOptimal.length > 0 
        ? ['Failed to identify optimal response paths', 'Overlooked key contextual information']
        : [],
      optimalChoices: missedOptimal.length > 0
        ? ['Consider observing before acting', 'Analyze emotional states and context']
        : [],
      strengths: data.score >= 0.7 
        ? ['Demonstrated strong decision-making', 'Maintained situational awareness']
        : data.score >= 0.4
        ? ['Showed adequate response capability']
        : [],
      improvements: data.score < 0.7
        ? ['Increase observation before action', 'Practice reading emotional cues', 'Consider multiple perspectives']
        : []
    };
  };

  const handleContinue = () => {
    setActiveScenario(null);
    setCompletedAttempt(null);
  };

  if (!profile) {
    navigate('/');
    return null;
  }

  if (completedAttempt) {
    return (
      <div className="min-h-screen bg-background p-6">
        <ScenarioDebrief attempt={completedAttempt} onContinue={handleContinue} />
      </div>
    );
  }

  if (currentScenario) {
    return (
      <div className="min-h-screen bg-background p-6">
        <div className="max-w-4xl mx-auto mb-6">
          <Button
            variant="ghost"
            onClick={() => setActiveScenario(null)}
            className="gap-2 text-muted-foreground hover:text-primary"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Scenarios
          </Button>
        </div>
        <SocialSimulation scenario={currentScenario} onComplete={handleComplete} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-6xl mx-auto space-y-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              onClick={() => navigate('/')}
              className="gap-2 text-muted-foreground hover:text-primary"
            >
              <ArrowLeft className="w-4 h-4" />
              Dashboard
            </Button>
            <div className="h-8 w-px bg-grid" />
            <div className="flex items-center gap-3">
              <Users className="w-6 h-6 text-primary" />
              <h1 className="text-3xl font-mono text-foreground">Social Lab</h1>
            </div>
          </div>
        </div>

        <Card className="p-6 bg-surface border-grid">
          <p className="text-muted-foreground leading-relaxed">
            Navigate complex interpersonal scenarios. Observe body language, detect hidden agendas, 
            and make strategic choices. Your perception and wisdom will be tested through branching 
            dialogue trees with multiple outcomes.
          </p>
        </Card>

        <div className="grid gap-4 md:grid-cols-2">
          {scenarios.map((scenario) => (
            <Card
              key={scenario.id}
              className="p-6 bg-surface border-grid hover:border-primary/40 transition-all cursor-pointer group"
              onClick={() => handleStartScenario(scenario.id)}
            >
              <div className="space-y-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <h3 className="text-lg font-mono text-foreground group-hover:text-primary transition-colors mb-2">
                      {scenario.title}
                    </h3>
                    <p className="text-sm text-muted-foreground">{scenario.description}</p>
                  </div>
                  <Badge variant="outline" className="font-mono shrink-0">
                    DIFF_{scenario.difficulty}
                  </Badge>
                </div>
                <div className="flex items-center justify-between pt-4 border-t border-grid">
                  <div className="flex gap-4 text-xs font-mono text-muted-foreground">
                    <span>+{scenario.xpReward} XP</span>
                    <span>•</span>
                    <span>{Object.keys(scenario.nodes).length} NODES</span>
                  </div>
                  <Button variant="outline" size="sm" className="font-mono">
                    START
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
