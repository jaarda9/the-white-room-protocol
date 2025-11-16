import { useState } from 'react';
import { SocialScenario, DialogueNode, DialogueChoice } from '@/lib/types';
import { Button } from './ui/button';
import { Card } from './ui/card';
import { Badge } from './ui/badge';
import { Eye, Brain, MessageSquare } from 'lucide-react';

interface SocialSimulationProps {
  scenario: SocialScenario;
  onComplete: (data: {
    timeTaken: number;
    choices: string[];
    hintsUsed: number;
    score: number;
  }) => void;
}

export function SocialSimulation({ scenario, onComplete }: SocialSimulationProps) {
  const [currentNodeId, setCurrentNodeId] = useState(scenario.startNodeId);
  const [choiceHistory, setChoiceHistory] = useState<string[]>([]);
  const [startTime] = useState(Date.now());
  const [hintsUsed, setHintsUsed] = useState(0);
  const [showContext, setShowContext] = useState(false);

  const currentNode = scenario.nodes[currentNodeId];

  const handleChoice = (choice: DialogueChoice) => {
    const newHistory = [...choiceHistory, choice.id];
    setChoiceHistory(newHistory);

    if (choice.nextNodeId) {
      const nextNode = scenario.nodes[choice.nextNodeId];
      if (nextNode.isEndNode) {
        completeScenario(newHistory);
      } else {
        setCurrentNodeId(choice.nextNodeId);
      }
    } else {
      completeScenario(newHistory);
    }
  };

  const completeScenario = (finalChoices: string[]) => {
    const timeTaken = Math.floor((Date.now() - startTime) / 1000);
    const score = calculateScore(finalChoices);
    onComplete({
      timeTaken,
      choices: finalChoices,
      hintsUsed,
      score
    });
  };

  const calculateScore = (choices: string[]): number => {
    const optimalSet = new Set(scenario.optimalPath);
    const choiceSet = new Set(choices);
    const intersection = [...choiceSet].filter(c => optimalSet.has(c));
    return intersection.length / scenario.optimalPath.length;
  };

  const getObservationLevel = (level: string) => {
    const colors = {
      low: 'bg-critical/20 text-critical',
      medium: 'bg-secondary-accent/20 text-secondary-accent',
      high: 'bg-primary/20 text-primary'
    };
    return colors[level as keyof typeof colors] || colors.low;
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-2xl font-mono text-foreground">{scenario.title}</h2>
          <p className="text-muted-foreground mt-1">{scenario.description}</p>
        </div>
        <Badge variant="outline" className="font-mono">
          DIFF_{scenario.difficulty}
        </Badge>
      </div>

      {/* Current Node */}
      <Card className="p-6 bg-surface border-grid">
        <div className="space-y-4">
          <div className="flex items-start gap-3">
            <MessageSquare className="w-5 h-5 text-primary mt-1" />
            <div className="flex-1">
              <div className="font-mono text-sm text-muted-foreground mb-2">
                [{currentNode.speaker.toUpperCase()}]
                {currentNode.emotionalState && (
                  <span className="ml-3 text-secondary-accent">
                    STATE: {currentNode.emotionalState.toUpperCase()}
                  </span>
                )}
              </div>
              <p className="text-foreground leading-relaxed">{currentNode.text}</p>
            </div>
          </div>

          {/* Context/Observation */}
          {currentNode.context && (
            <div className="mt-4 pt-4 border-t border-grid">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setShowContext(!showContext);
                  if (!showContext) setHintsUsed(hintsUsed + 1);
                }}
                className="gap-2 text-muted-foreground hover:text-primary"
              >
                <Eye className="w-4 h-4" />
                {showContext ? 'Hide Observation' : 'Use Observation (reduces score)'}
              </Button>
              {showContext && (
                <div className="mt-3 p-3 bg-background/50 rounded border border-primary/20">
                  <div className="flex items-start gap-2">
                    <Brain className="w-4 h-4 text-primary mt-0.5" />
                    <p className="text-sm text-muted-foreground italic">{currentNode.context}</p>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </Card>

      {/* Choices */}
      {!currentNode.isEndNode && currentNode.choices.length > 0 && (
        <div className="space-y-3">
          <div className="text-xs font-mono text-muted-foreground uppercase tracking-wider">
            Response Options
          </div>
          {currentNode.choices.map((choice) => (
            <Card
              key={choice.id}
              className="p-4 bg-surface border-grid hover:border-primary/40 transition-all cursor-pointer group"
              onClick={() => handleChoice(choice)}
            >
              <div className="flex items-start justify-between gap-4">
                <p className="text-foreground group-hover:text-primary transition-colors flex-1">
                  {choice.text}
                </p>
                <Badge 
                  variant="outline" 
                  className={`${getObservationLevel(choice.observationLevel)} text-xs font-mono shrink-0`}
                >
                  {choice.observationLevel.toUpperCase()}
                </Badge>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* End State */}
      {currentNode.isEndNode && (
        <div className="text-center py-8">
          <div className="inline-block px-6 py-3 bg-primary/10 border border-primary/20 rounded">
            <p className="text-sm font-mono text-primary">SCENARIO COMPLETE</p>
          </div>
        </div>
      )}

      {/* Stats Footer */}
      <div className="flex items-center justify-between text-xs font-mono text-muted-foreground pt-4 border-t border-grid">
        <div>CHOICES: {choiceHistory.length}</div>
        <div>HINTS: {hintsUsed}</div>
        <div>TIME: {Math.floor((Date.now() - startTime) / 1000)}s</div>
      </div>
    </div>
  );
}
