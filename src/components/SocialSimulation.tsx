import { useState, useEffect } from 'react';
import { SocialScenario, DialogueNode, DialogueChoice } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Eye, AlertTriangle } from 'lucide-react';

interface SocialSimulationProps {
  scenario: SocialScenario;
  onComplete: (data: {
    choicesMade: string[];
    pathTaken: string[];
    observationsUsed: number;
    timeTaken: number;
    missedCues: string[];
  }) => void;
}

export const SocialSimulation = ({ scenario, onComplete }: SocialSimulationProps) => {
  const [currentNodeId, setCurrentNodeId] = useState<string>(scenario.initialNodeId);
  const [pathTaken, setPathTaken] = useState<string[]>([scenario.initialNodeId]);
  const [choicesMade, setChoicesMade] = useState<string[]>([]);
  const [observationsUsed, setObservationsUsed] = useState(0);
  const [showObservation, setShowObservation] = useState(false);
  const [startTime] = useState(Date.now());
  const [revealedCues, setRevealedCues] = useState<Set<string>>(new Set());

  const currentNode = scenario.nodes[currentNodeId];

  useEffect(() => {
    if (currentNode?.isEndNode) {
      const timeTaken = Math.floor((Date.now() - startTime) / 1000);
      const allCues = Object.values(scenario.nodes)
        .flatMap(node => node.hiddenCues || []);
      const missedCues = allCues.filter(cue => !revealedCues.has(cue));

      onComplete({
        choicesMade,
        pathTaken,
        observationsUsed,
        timeTaken,
        missedCues,
      });
    }
  }, [currentNode, startTime, choicesMade, pathTaken, observationsUsed, revealedCues, scenario, onComplete]);

  const handleChoice = (choice: DialogueChoice) => {
    setChoicesMade([...choicesMade, choice.id]);
    
    if (choice.nextNodeId) {
      setPathTaken([...pathTaken, choice.nextNodeId]);
      setCurrentNodeId(choice.nextNodeId);
    }
    
    setShowObservation(false);
  };

  const handleObserve = () => {
    setShowObservation(true);
    setObservationsUsed(observationsUsed + 1);
    
    if (currentNode.hiddenCues) {
      setRevealedCues(new Set([...revealedCues, ...currentNode.hiddenCues]));
    }
  };

  if (!currentNode) {
    return <div className="text-critical">ERROR: Invalid node state</div>;
  }

  return (
    <div className="space-y-4">
      {/* Context Header */}
      <Card className="border-primary/20 bg-surface">
        <div className="p-4 space-y-2">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="text-sm font-mono text-muted mb-1">CONTEXT</h3>
              <p className="text-xs text-foreground/70">{scenario.context}</p>
            </div>
            <Badge variant="outline" className="text-xs font-mono">
              OBS: {observationsUsed}
            </Badge>
          </div>
        </div>
      </Card>

      {/* Dialogue Display */}
      <Card className="border-border bg-background">
        <div className="p-6 space-y-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono text-primary">{currentNode.speaker}</span>
              {currentNode.context && (
                <span className="text-xs text-muted">• {currentNode.context}</span>
              )}
            </div>
            <p className="text-sm leading-relaxed text-foreground">
              {currentNode.text}
            </p>
          </div>

          {/* Hidden Cues (if observation used) */}
          {showObservation && currentNode.hiddenCues && currentNode.hiddenCues.length > 0 && (
            <div className="border-l-2 border-critical/50 pl-4 py-2 bg-critical/5">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-critical mt-0.5" />
                <div>
                  <p className="text-xs font-mono text-critical mb-1">OBSERVATION</p>
                  {currentNode.hiddenCues.map((cue, idx) => (
                    <p key={idx} className="text-xs text-foreground/80">{cue}</p>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </Card>

      {/* Action Panel */}
      {!currentNode.isEndNode && (
        <div className="space-y-3">
          {/* Observation Button */}
          {currentNode.hiddenCues && currentNode.hiddenCues.length > 0 && !showObservation && (
            <Button
              variant="outline"
              onClick={handleObserve}
              className="w-full justify-start border-primary/30 hover:border-primary/50"
            >
              <Eye className="w-4 h-4 mr-2" />
              <span className="font-mono text-xs">OBSERVE [REDUCES SCORE]</span>
            </Button>
          )}

          {/* Choice Buttons */}
          <div className="space-y-2">
            {currentNode.choices.map((choice) => (
              <Button
                key={choice.id}
                onClick={() => handleChoice(choice)}
                variant="secondary"
                className="w-full justify-start text-left h-auto py-3 px-4"
              >
                <div className="space-y-1">
                  <p className="text-sm text-foreground">{choice.text}</p>
                  {choice.skillCheck && (
                    <p className="text-xs text-muted font-mono">
                      [{choice.skillCheck.attribute} CHECK: {choice.skillCheck.difficulty}]
                    </p>
                  )}
                </div>
              </Button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
