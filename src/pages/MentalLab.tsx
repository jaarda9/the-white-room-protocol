import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { MentalChallenge, UserProfile, Attributes } from '@/lib/types';
import { getUserProfile, saveUserProfile } from '@/lib/storage';
import { MentalChallengeComponent } from '@/components/MentalChallenge';
import { ScenarioDebrief } from '@/components/ScenarioDebrief';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Brain, Zap, Target } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { enhanceMentalChallenges } from '@/lib/lab-ai';
import { updateMentalCompletion } from '@/lib/achievements';

export default function MentalLab() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [challenges, setChallenges] = useState<MentalChallenge[]>([]);
  const [aiStatus, setAiStatus] = useState<'idle' | 'loading' | 'ready'>('idle');
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
    let retryTimer: number | undefined;

    const loadChallenges = async () => {
      if (!active) return;
      setAiStatus('loading');
      try {
        const data = await enhanceMentalChallenges(profile);
        if (!active) return;
        setChallenges(data);
        setAiStatus('ready');
      } catch (error) {
        console.warn('Mental lab AI enhancement failed, retrying...', error);
        if (!active) return;
        retryTimer = window.setTimeout(loadChallenges, 5000);
      }
    };

    loadChallenges();

    return () => {
      active = false;
      if (retryTimer) {
        window.clearTimeout(retryTimer);
      }
    };
  }, [profile]);

  useEffect(() => {
    if (!selectedChallenge) return;
    const updated = challenges.find(ch => ch.id === selectedChallenge.id);
    if (!updated) {
      setSelectedChallenge(null);
    } else {
      setSelectedChallenge(updated);
    }
  }, [challenges]);

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

    // Check for achievements
    const newAchievements = updateMentalCompletion(updatedProfile.level, updatedProfile.visibleStats);
    if (newAchievements.length > 0) {
      toast({
        title: '🏆 Achievement Unlocked!',
        description: `You unlocked ${newAchievements.length} new achievement${newAchievements.length > 1 ? 's' : ''}!`,
      });
    }

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
      case 'working-memory':
        return <Brain className="w-5 h-5" />;
      case 'speed-processing':
        return <Zap className="w-5 h-5" />;
      case 'strategic-planning':
        return <Target className="w-5 h-5" />;
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
                Working memory • Speed processing • Strategic planning
              </p>
            </div>
          <Badge variant={aiStatus === 'ready' ? 'default' : 'outline'} className="font-mono text-xs">
            ARCHITECT: {aiStatus === 'ready' ? 'OPTIMIZED' : 'CALIBRATING'}
          </Badge>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8">
        {aiStatus !== 'ready' ? (
          <Card className="p-6 border-dashed border-border text-muted-foreground text-sm font-mono">
            ARCHITECT: Calibrating cognitive modules...
          </Card>
        ) : (
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
        )}
      </div>
    </div>
  );
}
