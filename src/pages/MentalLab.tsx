import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { MentalChallenge, UserProfile, Attributes } from '@/lib/types';
import { getUserProfile, saveUserProfile } from '@/lib/storage';
import { MentalChallengeComponent } from '@/components/MentalChallenge';
import { ScenarioDebrief } from '@/components/ScenarioDebrief';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Brain, Zap, Puzzle, Focus } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { enhanceMentalChallenges } from '@/lib/lab-ai';

const SAMPLE_CHALLENGES: MentalChallenge[] = [
  {
    id: 'mental-001',
    title: 'Pattern Recognition Alpha',
    description: 'Identify the logical sequence in complex visual patterns',
    type: 'pattern',
    difficulty: 2,
    xp: 25,
    hiddenRewards: { INT: 2, PER: 1 },
    timeLimit: 120,
    data: {
      questions: [
        {
          question: 'What comes next in the sequence: 2, 4, 8, 16, ?',
          options: ['24', '32', '20', '30'],
          correctIndex: 1,
          correct: true,
        },
        {
          question: 'Which shape completes the pattern: Circle, Square, Triangle, Circle, Square, ?',
          options: ['Circle', 'Triangle', 'Square', 'Pentagon'],
          correctIndex: 1,
          correct: true,
        },
        {
          question: 'Logic: If all A are B, and all B are C, then all A are ?',
          options: ['Not C', 'C', 'Sometimes C', 'Neither'],
          correctIndex: 1,
          correct: true,
        },
      ],
    },
  },
  {
    id: 'mental-002',
    title: 'Memory Protocol Delta',
    description: 'Memorize and recall increasingly complex numerical sequences',
    type: 'memory',
    difficulty: 3,
    xp: 30,
    hiddenRewards: { INT: 3, WIS: 1 },
    timeLimit: 90,
    data: {
      sequenceLength: 8,
    },
  },
  {
    id: 'mental-003',
    title: 'Logic Gates Challenge',
    description: 'Solve complex logical problems under time pressure',
    type: 'logic',
    difficulty: 4,
    xp: 35,
    hiddenRewards: { INT: 2, WIS: 2 },
    timeLimit: 180,
    data: {
      questions: [
        {
          question: 'Three people: Alice always tells the truth, Bob always lies, Charlie alternates. Alice says "Bob is lying." Is Charlie telling the truth now?',
          options: ['Yes', 'No', 'Cannot determine', 'Sometimes'],
          correctIndex: 2,
          correct: true,
        },
        {
          question: 'You have 12 balls, one is slightly heavier. You have a balance scale and can use it twice. Can you find the heavy ball?',
          options: ['Yes, always', 'No, impossible', 'Only sometimes', 'Need more information'],
          correctIndex: 0,
          correct: true,
        },
        {
          question: 'A farmer needs to cross a river with a fox, chicken, and grain. The boat holds the farmer plus one item. Fox eats chicken, chicken eats grain. What\'s the minimum number of trips?',
          options: ['5', '7', '9', '11'],
          correctIndex: 1,
          correct: true,
        },
        {
          question: 'In a group of 6 people, everyone shakes hands once with everyone else. How many handshakes total?',
          options: ['12', '15', '18', '21'],
          correctIndex: 1,
          correct: true,
        },
      ],
    },
  },
  {
    id: 'mental-004',
    title: 'Focus Endurance Test',
    description: 'Maintain sustained attention and reaction speed',
    type: 'focus',
    difficulty: 2,
    xp: 22,
    hiddenRewards: { PER: 2, AGI: 1 },
    timeLimit: 60,
    data: {
      targetClicks: 50,
    },
  },
  {
    id: 'mental-005',
    title: 'Advanced Pattern Matrix',
    description: 'Decode multi-dimensional logical patterns',
    type: 'pattern',
    difficulty: 5,
    xp: 40,
    hiddenRewards: { INT: 3, WIS: 2 },
    timeLimit: 240,
    data: {
      questions: [
        {
          question: 'If Monday is coded as 13 and Wednesday as 23, what is Friday?',
          options: ['33', '43', '53', '63'],
          correctIndex: 2,
          correct: true,
        },
        {
          question: 'Pattern: 1, 1, 2, 3, 5, 8, 13, 21, ?',
          options: ['29', '34', '38', '42'],
          correctIndex: 1,
          correct: true,
        },
        {
          question: 'If BRAIN = 2-18-1-9-14, what does LOGIC equal in sum?',
          options: ['50', '56', '62', '58'],
          correctIndex: 3,
          correct: true,
        },
        {
          question: 'Complete: △ ○ □ △ ○ ? △',
          options: ['○', '△', '□', '◇'],
          correctIndex: 2,
          correct: true,
        },
        {
          question: 'A clock shows 3:15. What is the angle between hour and minute hands?',
          options: ['0°', '7.5°', '15°', '22.5°'],
          correctIndex: 1,
          correct: true,
        },
      ],
    },
  },
  {
    id: 'mental-006',
    title: 'Memory Matrix Elite',
    description: 'Master-level sequence memorization',
    type: 'memory',
    difficulty: 5,
    xp: 45,
    hiddenRewards: { INT: 4, PER: 2 },
    timeLimit: 60,
    data: {
      sequenceLength: 12,
    },
  },
];

export default function MentalLab() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [challenges, setChallenges] = useState<MentalChallenge[]>(SAMPLE_CHALLENGES);
  const [aiStatus, setAiStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [selectedChallenge, setSelectedChallenge] = useState<MentalChallenge | null>(null);
  const [showDebrief, setShowDebrief] = useState(false);
  const [debriefData, setDebriefData] = useState<any>(null);

  useEffect(() => {
    const userProfile = getUserProfile();
    setProfile(userProfile);
  }, []);

  useEffect(() => {
    if (!profile) return;
    let active = true;
    setAiStatus(prev => (prev === 'ready' ? prev : 'loading'));
    enhanceMentalChallenges(profile, SAMPLE_CHALLENGES)
      .then(data => {
        if (!active) return;
        setChallenges(data);
        setAiStatus('ready');
        setSelectedChallenge(prev => (prev ? data.find(ch => ch.id === prev.id) ?? prev : prev));
      })
      .catch(error => {
        console.warn('Mental lab AI enhancement failed:', error);
        if (active) setAiStatus(prev => (prev === 'ready' ? prev : 'error'));
      });
    return () => {
      active = false;
    };
  }, [profile]);

  const handleChallengeSelect = (challenge: MentalChallenge) => {
    setSelectedChallenge(challenge);
    setShowDebrief(false);
  };

  const handleChallengeComplete = (result: { accuracy: number; timeTaken: number; focusScore: number }) => {
    if (!profile || !selectedChallenge) return;

    const success = result.accuracy >= 70;
    const xpGained = success ? selectedChallenge.xp : Math.floor(selectedChallenge.xp * 0.5);
    const performanceMultiplier = result.accuracy / 100;

    // Calculate attribute rewards
    const attributeRewards: Partial<Attributes> = {};
    Object.entries(selectedChallenge.hiddenRewards).forEach(([key, value]) => {
      attributeRewards[key as keyof Attributes] = Math.round((value as number) * performanceMultiplier);
    });

    // Update profile
    const updatedProfile = {
      ...profile,
      xp: profile.xp + xpGained,
      accumulatedPoints: {
        ...profile.accumulatedPoints,
        ...Object.fromEntries(
          Object.entries(attributeRewards).map(([key, value]) => [
            key,
            (profile.accumulatedPoints[key as keyof Attributes] || 0) + (value || 0),
          ])
        ),
      } as Attributes,
    };

    // Check for level up
    while (updatedProfile.xp >= updatedProfile.xpToNextLevel) {
      updatedProfile.xp -= updatedProfile.xpToNextLevel;
      updatedProfile.level += 1;
      updatedProfile.xpToNextLevel = Math.floor(100 * Math.pow(1.5, updatedProfile.level - 1));
      
      // Apply accumulated points on level up
      Object.keys(updatedProfile.accumulatedPoints).forEach((key) => {
        const attr = key as keyof Attributes;
        updatedProfile.visibleStats[attr] += updatedProfile.accumulatedPoints[attr];
        updatedProfile.accumulatedPoints[attr] = 0;
      });
    }

    saveUserProfile(updatedProfile);
    setProfile(updatedProfile);

    // Prepare debrief
    const debrief = {
      challenge: selectedChallenge,
      performance: {
        accuracy: result.accuracy,
        timeTaken: result.timeTaken,
        focusScore: result.focusScore,
      },
      rewards: {
        xp: xpGained,
        attributes: attributeRewards,
      },
      objectives: {
        primary: success ? 'Challenge completed successfully' : 'Challenge incomplete',
      },
    };

    setDebriefData(debrief);
    setShowDebrief(true);

    toast({
      title: success ? 'Challenge Complete!' : 'Challenge Incomplete',
      description: `Earned ${xpGained} XP${success ? '' : ' (partial credit)'}`,
    });
  };

  const handleContinue = () => {
    setSelectedChallenge(null);
    setShowDebrief(false);
  };

  if (selectedChallenge && !showDebrief) {
    return (
      <div className="min-h-screen bg-background p-4">
        <div className="max-w-4xl mx-auto space-y-4">
          <Button
            variant="ghost"
            onClick={() => setSelectedChallenge(null)}
            className="mb-4"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Challenges
          </Button>

          <MentalChallengeComponent
            challenge={selectedChallenge}
            onComplete={handleChallengeComplete}
          />
        </div>
      </div>
    );
  }

  if (showDebrief && debriefData) {
    return (
      <div className="min-h-screen bg-background p-4">
        <div className="max-w-4xl mx-auto">
          <ScenarioDebrief
            scenario={{
              id: debriefData.challenge.id,
              title: debriefData.challenge.title,
              description: debriefData.challenge.description,
              difficulty: debriefData.challenge.difficulty,
              xp: debriefData.challenge.xp,
              hiddenRewards: debriefData.challenge.hiddenRewards,
              context: `Mental challenge: ${debriefData.challenge.type}`,
              initialNodeId: '',
              nodes: {},
              objectives: {
                primary: debriefData.objectives.primary,
              },
              optimalPath: []
            }}
            score={debriefData.performance.accuracy / 100}
            missedCues={[]}
            observationsUsed={0}
            timeTaken={debriefData.performance.timeTaken}
            pathTaken={[]}
            rewards={debriefData.rewards.attributes}
          />
          <div className="mt-4 text-center">
            <Button onClick={handleContinue}>
              Continue Training
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const getChallengeIcon = (type: string) => {
    switch (type) {
      case 'memory':
        return <Brain className="w-5 h-5" />;
      case 'logic':
        return <Zap className="w-5 h-5" />;
      case 'pattern':
        return <Puzzle className="w-5 h-5" />;
      case 'focus':
        return <Focus className="w-5 h-5" />;
      default:
        return <Brain className="w-5 h-5" />;
    }
  };

  const getDifficultyColor = (difficulty: number) => {
    if (difficulty <= 2) return 'text-green-500';
    if (difficulty <= 3) return 'text-yellow-500';
    return 'text-red-500';
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b border-border/40 bg-card/50 backdrop-blur supports-[backdrop-filter]:bg-card/50">
        <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="flex items-center gap-4">
            <Button variant="ghost" onClick={() => navigate('/')}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Dashboard
            </Button>
            <div className="flex-1">
              <h1 className="text-3xl font-bold flex items-center gap-3">
                <Brain className="w-8 h-8 text-primary" />
                Mental Training Laboratory
              </h1>
              <p className="text-muted-foreground mt-1">
                Cognitive challenges, memory games, and problem-solving puzzles
              </p>
            </div>
          <Badge variant={aiStatus === 'ready' ? 'default' : 'outline'} className="font-mono text-xs">
            ARCHITECT: {aiStatus === 'ready' ? 'OPTIMIZED' : aiStatus === 'loading' ? 'CALIBRATING' : aiStatus === 'error' ? 'OFFLINE' : 'STANDBY'}
          </Badge>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {challenges.map((challenge) => (
            <Card
              key={challenge.id}
              className="p-6 hover:shadow-lg transition-all cursor-pointer group"
              onClick={() => handleChallengeSelect(challenge)}
            >
              <div className="space-y-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                      {getChallengeIcon(challenge.type)}
                    </div>
                    <Badge variant="outline" className="capitalize">
                      {challenge.type}
                    </Badge>
                  </div>
                  <div className={`font-bold ${getDifficultyColor(challenge.difficulty)}`}>
                    L{challenge.difficulty}
                  </div>
                </div>

                <div>
                  <h3 className="text-xl font-bold mb-2 group-hover:text-primary transition-colors">
                    {challenge.title}
                  </h3>
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    {challenge.description}
                  </p>
                  {challenge.aiContext && (
                    <p className="text-xs text-primary/70 mt-2 font-mono line-clamp-2">
                      {challenge.aiContext}
                    </p>
                  )}
                </div>

                <div className="flex items-center justify-between pt-4 border-t border-border/40">
                  <div className="flex gap-4 text-sm text-muted-foreground">
                    <span>{challenge.timeLimit}s</span>
                    <span>•</span>
                    <span className="text-primary font-semibold">{challenge.xp} XP</span>
                  </div>
                  <Button size="sm" variant="ghost">
                    Start →
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
