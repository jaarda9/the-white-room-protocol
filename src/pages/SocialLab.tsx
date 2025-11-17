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

const SAMPLE_SCENARIOS: SocialScenario[] = [
  {
    id: 'social-001',
    title: 'Workplace Negotiation',
    description: 'Navigate a tense project discussion with competing interests',
    difficulty: 3,
    xp: 35,
    hiddenRewards: { PER: 2, WIS: 2, INT: 1 },
    context: 'Team meeting. Budget cuts announced. Your project at risk.',
    initialNodeId: 'start',
    objectives: {
      primary: 'Secure project funding without revealing true resource needs',
      secondary: ['Identify ally among team members', 'Avoid direct confrontation with manager'],
    },
    optimalPath: ['start', 'observe', 'strategic', 'ally', 'success'],
    nodes: {
      start: {
        id: 'start',
        speaker: 'MANAGER',
        text: 'Due to budget constraints, we need to cut one project. I\'m open to arguments, but make them count.',
        context: 'Tense silence. Three other team leads watching.',
        hiddenCues: [
          'Manager\'s eyes briefly on Sarah before speaking - she might be allied',
          'Tom\'s folder already closed - he\'s already decided',
          'Manager\'s right hand tapping - stressed, wants quick resolution',
        ],
        choices: [
          {
            id: 'aggressive',
            text: 'Our project has the highest ROI. Cutting it would be short-sighted.',
            nextNodeId: 'confrontation',
          },
          {
            id: 'strategic',
            text: 'I understand the pressure. What criteria are we using for this decision?',
            nextNodeId: 'strategic',
            skillCheck: { attribute: 'WIS', difficulty: 3 },
          },
          {
            id: 'emotional',
            text: 'My team has worked so hard on this. Please reconsider.',
            nextNodeId: 'weak',
          },
        ],
      },
      confrontation: {
        id: 'confrontation',
        speaker: 'MANAGER',
        text: 'Everyone thinks their project is critical. That\'s not an argument.',
        context: 'Manager visibly irritated. Tom smirking.',
        hiddenCues: [
          'Sarah\'s micro-expression: sympathy mixed with concern',
          'Manager leaning back - defensive posture forming',
        ],
        choices: [
          {
            id: 'double-down',
            text: 'The data speaks for itself. We\'re ahead of all projections.',
            nextNodeId: 'failure',
          },
          {
            id: 'redirect',
            text: 'You\'re right. Let me reframe: what\'s our strategic priority for Q4?',
            nextNodeId: 'recovery',
          },
        ],
      },
      strategic: {
        id: 'strategic',
        speaker: 'MANAGER',
        text: 'Fair question. We\'re looking at Q4 deliverables, resource efficiency, and strategic alignment.',
        context: 'Manager\'s posture relaxes slightly. Opening created.',
        hiddenCues: [
          'Sarah nodding - she agrees with your approach',
          'Manager\'s stress tells decreasing - respects analytical approach',
          'Tom shifting uncomfortably - his project weak on these criteria',
        ],
        choices: [
          {
            id: 'data-dump',
            text: 'Let me pull up our detailed metrics and projections...',
            nextNodeId: 'boring',
          },
          {
            id: 'ally',
            text: 'Sarah, your project interfaces with ours. What\'s your take on strategic alignment?',
            nextNodeId: 'ally',
            skillCheck: { attribute: 'PER', difficulty: 4 },
          },
          {
            id: 'direct',
            text: 'Our project hits all three. Q4 delivery confirmed, minimal overhead, aligns with board priorities.',
            nextNodeId: 'success',
          },
        ],
      },
      ally: {
        id: 'ally',
        speaker: 'SARAH',
        text: 'Actually, cutting this project would delay my deliverables by at least two quarters. We\'re interdependent.',
        context: 'Manager\'s expression shifts. New information registered.',
        hiddenCues: [
          'Manager making mental calculation - cascade effect concerns',
          'Tom realizing his project now most isolated',
        ],
        choices: [
          {
            id: 'clinch',
            text: 'Exactly. The integration work is already 60% complete. Starting over means sunk costs.',
            nextNodeId: 'success',
          },
          {
            id: 'overplay',
            text: 'See? Everyone depends on us. We\'re clearly essential.',
            nextNodeId: 'arrogant',
          },
        ],
      },
      success: {
        id: 'success',
        speaker: 'MANAGER',
        text: 'Alright. Your project stays. Tom, let\'s discuss alternatives for yours after this.',
        context: 'Decision made. Meeting concluding.',
        isEndNode: true,
        choices: [],
      },
      failure: {
        id: 'failure',
        speaker: 'MANAGER',
        text: 'This isn\'t productive. I\'ll make the decision myself. Meeting adjourned.',
        context: 'Manager stands abruptly. Opportunity lost.',
        isEndNode: true,
        choices: [],
      },
      weak: {
        id: 'weak',
        speaker: 'MANAGER',
        text: 'I appreciate your team\'s effort, but emotion isn\'t a business case.',
        context: 'Sympathetic but dismissive. Lost credibility.',
        isEndNode: true,
        choices: [],
      },
      recovery: {
        id: 'recovery',
        speaker: 'MANAGER',
        text: 'Q4 priority is market expansion. How does your project contribute?',
        context: 'Second chance granted. Door still open.',
        hiddenCues: ['Manager checking watch - limited patience remaining'],
        choices: [
          {
            id: 'recovery-success',
            text: 'Direct impact: our platform handles the expansion tech stack. Critical path item.',
            nextNodeId: 'success',
          },
        ],
      },
      boring: {
        id: 'boring',
        speaker: 'MANAGER',
        text: 'We don\'t have time for a presentation. I need a concise answer.',
        context: 'Impatience visible. Window closing.',
        isEndNode: true,
        choices: [],
      },
      arrogant: {
        id: 'arrogant',
        speaker: 'MANAGER',
        text: 'Nobody is irreplaceable. Let\'s not forget that.',
        context: 'Warning issued. Damaged relationship.',
        isEndNode: true,
        choices: [],
      },
    },
  },
];

export default function SocialLab() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [scenarios, setScenarios] = useState<SocialScenario[]>(SAMPLE_SCENARIOS);
  const [aiStatus, setAiStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
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
    setAiStatus(prev => (prev === 'ready' ? prev : 'loading'));
    enhanceSocialScenarios(profile, SAMPLE_SCENARIOS)
      .then(data => {
        if (!active) return;
        setScenarios(data);
        setAiStatus('ready');
        setSelectedScenario(prev => (prev ? data.find(s => s.id === prev.id) ?? prev : prev));
      })
      .catch(error => {
        console.warn('Social lab AI enhancement failed:', error);
        if (active) setAiStatus(prev => (prev === 'ready' ? prev : 'error'));
      });
    return () => {
      active = false;
    };
  }, [profile]);

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
              ARCHITECT: {aiStatus === 'ready' ? 'OPTIMIZED' : aiStatus === 'loading' ? 'CALIBRATING' : aiStatus === 'error' ? 'OFFLINE' : 'STANDBY'}
            </Badge>
          </div>
        </div>

        {/* Scenario Selection */}
        {!selectedScenario && !showDebrief && (
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
