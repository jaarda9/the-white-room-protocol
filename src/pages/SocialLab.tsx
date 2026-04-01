import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { UserProfile } from '@/lib/types';
import { getUserProfile, saveUserProfile, addXP } from '@/lib/storage';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ArrowLeft, Users, CheckCircle2, Circle, Target, Zap, MessageSquare, Eye, Shield } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { scaleHiddenRewards } from '@/lib/attribute-scaling';

interface SocialChallenge {
  id: string;
  title: string;
  description: string;
  category: 'observation' | 'interaction' | 'influence' | 'defense';
  difficulty: 1 | 2 | 3;
  xp: number;
  completed: boolean;
}

const DAILY_CHALLENGES: SocialChallenge[] = [
  // Observation
  {
    id: 'obs-1',
    title: 'Read the Room',
    description: 'In your next group interaction, identify the dominant person and the most reserved. Note their body language differences.',
    category: 'observation',
    difficulty: 1,
    xp: 25,
    completed: false,
  },
  {
    id: 'obs-2',
    title: 'Micro-Expression Hunt',
    description: 'During a conversation, catch one moment where someone\'s face briefly shows an emotion different from their words.',
    category: 'observation',
    difficulty: 2,
    xp: 40,
    completed: false,
  },
  // Interaction
  {
    id: 'int-1',
    title: 'Active Listening',
    description: 'In one conversation today, use the mirroring technique: repeat back the last 3 words they said as a question.',
    category: 'interaction',
    difficulty: 1,
    xp: 25,
    completed: false,
  },
  {
    id: 'int-2',
    title: 'Cold Approach',
    description: 'Start a conversation with someone you don\'t normally talk to. Ask them one genuine question about their interests.',
    category: 'interaction',
    difficulty: 2,
    xp: 50,
    completed: false,
  },
  // Influence
  {
    id: 'inf-1',
    title: 'Reciprocity Trigger',
    description: 'Do a small, unexpected favor for someone without expecting anything in return. Note their reaction.',
    category: 'influence',
    difficulty: 1,
    xp: 30,
    completed: false,
  },
  {
    id: 'inf-2',
    title: 'Frame Control',
    description: 'In a disagreement, reframe the discussion by finding common ground before stating your position.',
    category: 'influence',
    difficulty: 3,
    xp: 60,
    completed: false,
  },
  // Defense
  {
    id: 'def-1',
    title: 'Pressure Immunity',
    description: 'When someone asks you for something, practice saying "I\'ll think about it" instead of an immediate yes.',
    category: 'defense',
    difficulty: 1,
    xp: 25,
    completed: false,
  },
  {
    id: 'def-2',
    title: 'Manipulation Detection',
    description: 'Identify one instance where someone used guilt, flattery, or urgency to influence your decision.',
    category: 'defense',
    difficulty: 2,
    xp: 45,
    completed: false,
  },
];

const CATEGORY_INFO = {
  observation: {
    icon: Eye,
    label: 'Observation',
    color: 'text-blue-400',
    description: 'Reading people and situations',
  },
  interaction: {
    icon: MessageSquare,
    label: 'Interaction',
    color: 'text-green-400',
    description: 'Engaging with others effectively',
  },
  influence: {
    icon: Zap,
    label: 'Influence',
    color: 'text-amber-400',
    description: 'Ethical persuasion techniques',
  },
  defense: {
    icon: Shield,
    label: 'Defense',
    color: 'text-red-400',
    description: 'Protecting against manipulation',
  },
};

export default function SocialLab() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [challenges, setChallenges] = useState<SocialChallenge[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  useEffect(() => {
    const p = getUserProfile();
    setProfile(p);
    
    // Load saved progress or reset daily
    const savedData = localStorage.getItem('social-challenges');
    const today = new Date().toDateString();
    
    if (savedData) {
      const { date, data } = JSON.parse(savedData);
      if (date === today) {
        setChallenges(data);
        return;
      }
    }
    
    // New day - reset challenges
    setChallenges(DAILY_CHALLENGES.map(c => ({ ...c, completed: false })));
  }, []);

  const saveProgress = (updated: SocialChallenge[]) => {
    localStorage.setItem('social-challenges', JSON.stringify({
      date: new Date().toDateString(),
      data: updated,
    }));
  };

  const handleComplete = async (challengeId: string) => {
    if (!profile) return;

    const challenge = challenges.find(c => c.id === challengeId);
    if (!challenge || challenge.completed) return;

    const updated = challenges.map(c =>
      c.id === challengeId ? { ...c, completed: true } : c
    );
    setChallenges(updated);
    saveProgress(updated);

    const baseHiddenRewards: Partial<UserProfile['accumulatedPoints']> = {};
    if (challenge.category === 'observation' || challenge.category === 'interaction') {
      baseHiddenRewards.PER = challenge.difficulty;
    } else {
      baseHiddenRewards.WIS = challenge.difficulty;
    }

    const scaledHiddenRewards = scaleHiddenRewards(profile, baseHiddenRewards, {
      completionRatio: 1,
      baseMultiplier: 1,
      minCompletionRatio: 0,
    });

    const withHidden: UserProfile = { ...profile, accumulatedPoints: { ...profile.accumulatedPoints } };
    Object.entries(scaledHiddenRewards).forEach(([attr, value]) => {
      const key = attr as keyof typeof withHidden.accumulatedPoints;
      withHidden.accumulatedPoints[key] += value || 0;
    });
    const updatedProfile = addXP(withHidden, challenge.xp);

    await saveUserProfile(updatedProfile);
    setProfile(updatedProfile);

    toast({
      title: 'Challenge Complete!',
      description: `+${challenge.xp} XP • +${challenge.difficulty} Social`,
    });
  };

  const completedCount = challenges.filter(c => c.completed).length;
  const totalXpAvailable = challenges.reduce((sum, c) => sum + c.xp, 0);
  const earnedXp = challenges.filter(c => c.completed).reduce((sum, c) => sum + c.xp, 0);

  const filteredChallenges = selectedCategory
    ? challenges.filter(c => c.category === selectedCategory)
    : challenges;

  if (!profile) {
    return <div className="p-8 text-center text-muted-foreground">Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border/40 bg-card/50 backdrop-blur">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate(-1)}
              className="font-mono"
            >
              <ArrowLeft className="h-4 w-4 mr-1" />
              Return
            </Button>
            <div className="flex-1">
              <h1 className="text-xl font-bold flex items-center gap-2">
                <Users className="w-5 h-5 text-primary" />
                Social Training Lab
              </h1>
              <p className="text-xs text-muted-foreground">
                Daily challenges for real-world social skill development
              </p>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        {/* Progress Overview */}
        <Card className="border-primary/20">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Target className="w-4 h-4 text-primary" />
                <span className="font-mono text-sm">Daily Progress</span>
              </div>
              <Badge variant="secondary" className="font-mono">
                {completedCount}/{challenges.length}
              </Badge>
            </div>
            <Progress value={(completedCount / challenges.length) * 100} className="h-2" />
            <p className="text-xs text-muted-foreground mt-2 text-right">
              {earnedXp}/{totalXpAvailable} XP earned today
            </p>
          </CardContent>
        </Card>

        {/* Category Filters */}
        <div className="flex flex-wrap gap-2">
          <Button
            variant={selectedCategory === null ? 'default' : 'outline'}
            size="sm"
            onClick={() => setSelectedCategory(null)}
            className="font-mono text-xs"
          >
            All
          </Button>
          {Object.entries(CATEGORY_INFO).map(([key, info]) => {
            const Icon = info.icon;
            return (
              <Button
                key={key}
                variant={selectedCategory === key ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSelectedCategory(key)}
                className="font-mono text-xs"
              >
                <Icon className="w-3 h-3 mr-1" />
                {info.label}
              </Button>
            );
          })}
        </div>

        {/* Challenges Grid */}
        <div className="grid gap-4 sm:grid-cols-2">
          {filteredChallenges.map(challenge => {
            const categoryInfo = CATEGORY_INFO[challenge.category];
            const Icon = categoryInfo.icon;
            
            return (
              <Card
                key={challenge.id}
                className={`transition-all ${
                  challenge.completed
                    ? 'border-primary/30 bg-primary/5'
                    : 'border-border hover:border-primary/20'
                }`}
              >
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <Icon className={`w-4 h-4 ${categoryInfo.color}`} />
                      <Badge variant="outline" className="text-[10px]">
                        {'★'.repeat(challenge.difficulty)}
                      </Badge>
                    </div>
                    <span className="text-xs font-mono text-muted-foreground">
                      +{challenge.xp} XP
                    </span>
                  </div>
                  <CardTitle className="text-sm">{challenge.title}</CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  <p className="text-xs text-muted-foreground mb-4">
                    {challenge.description}
                  </p>
                  <Button
                    onClick={() => handleComplete(challenge.id)}
                    disabled={challenge.completed}
                    variant={challenge.completed ? 'secondary' : 'default'}
                    size="sm"
                    className="w-full"
                  >
                    {challenge.completed ? (
                      <>
                        <CheckCircle2 className="w-4 h-4 mr-1" />
                        Completed
                      </>
                    ) : (
                      <>
                        <Circle className="w-4 h-4 mr-1" />
                        Mark Complete
                      </>
                    )}
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Tips Section */}
        <Card className="border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-mono">Training Protocol</CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground space-y-2">
            <p>• <strong>Observation:</strong> Practice reading body language, tone, and micro-expressions in daily interactions.</p>
            <p>• <strong>Interaction:</strong> Use active listening, mirroring, and genuine curiosity to build rapport.</p>
            <p>• <strong>Influence:</strong> Apply reciprocity, social proof, and framing ethically to guide conversations.</p>
            <p>• <strong>Defense:</strong> Recognize manipulation tactics like guilt-tripping, love-bombing, and artificial urgency.</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
