import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { SocialScenario, UserProfile, Attributes } from '@/lib/types';
import { getUserProfile, saveUserProfile } from '@/lib/storage';
import { SocialSimulation } from '@/components/SocialSimulation';
import { ScenarioDebrief } from '@/components/ScenarioDebrief';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Users } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { enhanceSocialScenarios } from '@/lib/lab-ai';

export default function SocialLab() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [scenarios, setScenarios] = useState<SocialScenario[]>([]);
  const [aiStatus, setAiStatus] = useState<'idle' | 'loading' | 'ready'>('idle');
  const [selectedScenario, setSelectedScenario] = useState<SocialScenario | null>(null);
  const [showDebrief, setShowDebrief] = useState(false);
  const [debriefData, setDebriefData] = useState<any>(null);

  useEffect(() => {
    const p = getUserProfile();
    setProfile(p);
  }, []);

  useEffect(() => {
    if (!profile) return;
    let active = true;
    let retryTimer: number | undefined;

    const loadScenarios = async () => {
      if (!active) return;
      setAiStatus('loading');
      try {
        const data = await enhanceSocialScenarios(profile);
        if (!active) return;
        setScenarios(data);
        setAiStatus('ready');
      } catch (error) {
        console.warn('Social lab AI enhancement failed, retrying...', error);
        if (!active) return;
        retryTimer = window.setTimeout(loadScenarios, 5000);
      }
    };

    loadScenarios();

    return () => {
      active = false;
      if (retryTimer) window.clearTimeout(retryTimer);
    };
  }, [profile]);

  useEffect(() => {
    if (!selectedScenario) return;
    const updated = scenarios.find(s => s.id === selectedScenario.id);
    if (!updated) {
      setSelectedScenario(null);
    } else {
      setSelectedScenario(updated);
    }
  }, [scenarios]);

  const handleStartScenario = (scenario: SocialScenario) => {
    setSelectedScenario(scenario);
    setShowDebrief(false);
  };

  const calculateScore = (
    scenario: SocialScenario,
    data: {
      pathTaken: string[];
      observationsUsed: number;
      missedCues: string[];
    }
  ): number => {
    let score = 0.5;

    // Path alignment (40% weight)
    const pathAlignment =
      data.pathTaken.filter(nodeId => scenario.optimalPath.includes(nodeId)).length /
      scenario.optimalPath.length;
    score += pathAlignment * 0.4;

    // Observation efficiency (30% weight)
    const observationPenalty = Math.min(data.observationsUsed * 0.1, 0.3);
    score -= observationPenalty;

    // Missed cues penalty (30% weight)
    const totalCues = Object.values(scenario.nodes).reduce(
      (sum, node) => sum + (node.hiddenCues?.length || 0),
      0
    );
    if (totalCues > 0) {
      const cuesPenalty = (data.missedCues.length / totalCues) * 0.3;
      score -= cuesPenalty;
    }

    return Math.max(0, Math.min(1, score));
  };

  const handleScenarioComplete = async (data: {
    choicesMade: string[];
    pathTaken: string[];
    observationsUsed: number;
    timeTaken: number;
    missedCues: string[];
  }) => {
    if (!selectedScenario || !profile) return;

    const score = calculateScore(selectedScenario, data);
    const xpGained = Math.round(selectedScenario.xp * score);
    const rewards = { ...selectedScenario.hiddenRewards };

    // Update profile
    const updatedProfile = { ...profile };
    updatedProfile.xp += xpGained;

    // Add accumulated points
    Object.entries(rewards).forEach(([attr, value]) => {
      updatedProfile.accumulatedPoints[attr as keyof Attributes] += value as number;
    });

    // Handle level up
    while (updatedProfile.xp >= updatedProfile.xpToNextLevel) {
      updatedProfile.xp -= updatedProfile.xpToNextLevel;
      updatedProfile.level += 1;
      updatedProfile.xpToNextLevel = Math.floor(updatedProfile.xpToNextLevel * 1.5);

      // Apply accumulated points to visible stats
      Object.keys(updatedProfile.accumulatedPoints).forEach(attr => {
        const key = attr as keyof Attributes;
        updatedProfile.visibleStats[key] += updatedProfile.accumulatedPoints[key];
        updatedProfile.accumulatedPoints[key] = 0;
      });
    }

    await saveUserProfile(updatedProfile);
    setProfile(updatedProfile);

    setDebriefData({
      scenario: selectedScenario,
      score,
      ...data,
      rewards,
    });
    setShowDebrief(true);

    toast({
      title: 'Scenario Complete',
      description: `+${xpGained} XP • Performance: ${Math.round(score * 100)}%`,
    });
  };

  const handleReturn = () => {
    setSelectedScenario(null);
    setShowDebrief(false);
    setDebriefData(null);
  };

  if (!profile) {
    return <div className="p-8 text-center text-muted">Loading profile...</div>;
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/')}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div className="flex-1">
            <h1 className="text-2xl font-mono tracking-tight">SOCIAL LAB</h1>
            <p className="text-sm text-muted">Simulated interaction analysis</p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="font-mono">
              <Users className="w-3 h-3 mr-1" />
              ACTIVE
            </Badge>
            <Badge variant={aiStatus === 'ready' ? 'default' : 'outline'} className="font-mono text-xs">
              ARCHITECT: {aiStatus === 'ready' ? 'OPTIMIZED' : 'CALIBRATING'}
            </Badge>
          </div>
        </div>

        {/* Scenario Selection */}
        {!selectedScenario && !showDebrief && (
          aiStatus !== 'ready' ? (
            <Card className="p-6 border-dashed border-border text-sm font-mono text-muted-foreground">
              ARCHITECT: Calibrating social overlays...
            </Card>
          ) : (
          <div className="space-y-4">
            {scenarios.map(scenario => (
              <Card key={scenario.id} className="border-border bg-surface hover:border-primary/30 transition-colors">
                <div className="p-6 space-y-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="font-mono text-lg">{scenario.title}</h3>
                        <Badge variant="secondary" className="text-xs">
                          DIFF: {scenario.difficulty}
                        </Badge>
                      </div>
                      <p className="text-sm text-foreground/70 mb-3">{scenario.description}</p>
                      <div className="flex items-center gap-4 text-xs text-muted">
                        <span className="font-mono">XP: {scenario.xp}</span>
                        <span>•</span>
                        <span>{scenario.objectives.primary}</span>
                      </div>
                      {scenario.aiContext && (
                        <p className="text-xs text-primary/70 font-mono mt-2">
                          {scenario.aiContext}
                        </p>
                      )}
                    </div>
                  </div>
                  <Button onClick={() => handleStartScenario(scenario)} className="w-full">
                    BEGIN SIMULATION
                  </Button>
                </div>
              </Card>
            ))}
          </div>
          )
        )}

        {/* Active Simulation */}
        {selectedScenario && !showDebrief && (
          <div className="space-y-4">
            <Card className="border-primary/20 bg-surface">
              <div className="p-4">
                <h2 className="font-mono text-lg mb-1">{selectedScenario.title}</h2>
                <p className="text-xs text-muted">{selectedScenario.description}</p>
              </div>
            </Card>
            <SocialSimulation scenario={selectedScenario} onComplete={handleScenarioComplete} />
          </div>
        )}

        {/* Debrief */}
        {showDebrief && debriefData && (
          <div className="space-y-4">
            <Card className="border-primary/20 bg-surface">
              <div className="p-4">
                <h2 className="font-mono text-lg mb-1">DEBRIEF ANALYSIS</h2>
                <p className="text-xs text-muted">{debriefData.scenario.title}</p>
              </div>
            </Card>
            <ScenarioDebrief {...debriefData} />
            <Button onClick={handleReturn} variant="outline" className="w-full">
              RETURN TO SCENARIO SELECTION
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
