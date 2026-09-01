import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { MentalChallenge, UserProfile, Attributes } from '@/lib/types';
import { getUserProfile, saveUserProfile, addXP } from '@/lib/storage';
import { MentalChallengeComponent } from '@/components/MentalChallenge';
import { ScenarioDebrief } from '@/components/ScenarioDebrief';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Brain, Zap, Target } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { enhanceMentalChallenges } from '@/lib/lab-ai';
import { updateMentalCompletion } from '@/lib/achievements';
import { scaleHiddenRewards } from '@/lib/attribute-scaling';

export default function MentalLab() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [challenges, setChallenges] = useState<MentalChallenge[]>([]);
  const [aiStatus, setAiStatus] = useState<'idle' | 'loading' | 'ready' | 'error' | 'rate-limited'>('idle');
  const [retryDelay, setRetryDelay] = useState<number>(0);
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
    let retryCount = 0;

    const loadChallenges = async () => {
      if (!active) return;
      setAiStatus('loading');
      setRetryDelay(0);
      try {
        const data = await enhanceMentalChallenges(profile);
        if (!active) return;
        setChallenges(data);
        setAiStatus('ready');
        retryCount = 0; // Reset retry count on success
      } catch (error: any) {
        console.warn('Mental lab AI enhancement failed', error);
        if (!active) return;
        
        // Don't retry on authentication errors (401) - these won't recover without fixing the API key
        if (error?.isAuthError || error?.statusCode === 401 || (error?.message && error.message.includes('401'))) {
          console.error('API authentication failed - check your GEMINI_API_KEY or GOOGLE_GENERATIVE_AI_API_KEY environment variable');
          setAiStatus('error');
          return;
        }
        
        // Handle rate limit errors with exponential backoff
        if (error?.isRateLimitError || error?.statusCode === 429 || (error?.message && error.message.includes('Rate Limited'))) {
          const retryAfter = error?.retryAfter || Math.min(60 * (2 ** retryCount), 300); // Exponential backoff, max 5 minutes
          console.warn(`Rate limited. Retrying in ${retryAfter} seconds...`);
          setAiStatus('rate-limited');
          setRetryDelay(retryAfter);
          retryCount++;

          // Accurate countdown even if the tab is backgrounded: compute from an absolute end time.
          const retryEndAtMs = Date.now() + retryAfter * 1000;
          const countdownInterval = window.setInterval(() => {
            if (!active) return;
            const remainingSeconds = Math.max(0, Math.ceil((retryEndAtMs - Date.now()) / 1000));
            setRetryDelay(remainingSeconds);

            if (remainingSeconds <= 0) {
              window.clearInterval(countdownInterval);
              setRetryDelay(0);
              if (retryTimer) window.clearTimeout(retryTimer);
              document.removeEventListener('visibilitychange', onVisibility);
              loadChallenges();
            }
          }, 500);

          // Also recompute immediately when the tab becomes visible.
          const onVisibility = () => {
            if (!active) return;
            if (document.visibilityState === 'visible') {
              const remainingSeconds = Math.max(0, Math.ceil((retryEndAtMs - Date.now()) / 1000));
              setRetryDelay(remainingSeconds);
            }
          };
          document.addEventListener('visibilitychange', onVisibility);

          retryTimer = window.setTimeout(() => {
            window.clearInterval(countdownInterval);
            document.removeEventListener('visibilitychange', onVisibility);
            loadChallenges();
          }, retryAfter * 1000);
          return;
        }
        
        // Retry for other errors with exponential backoff
        const delay = Math.min(5 * (2 ** retryCount), 60); // Exponential backoff, max 60 seconds
        retryCount++;
        retryTimer = window.setTimeout(loadChallenges, delay * 1000);
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
    const attributeRewards = scaleHiddenRewards(profile, selectedChallenge.hiddenRewards, {
      completionRatio: performanceMultiplier,
      baseMultiplier: 1,
      minCompletionRatio: 0,
    });

    // Update profile:
    // 1) add hidden rewards to accumulated points
    // 2) add XP and let addXP() handle level-up + accumulated-to-visible conversion
    const withHidden: UserProfile = {
      ...profile,
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
    const updatedProfile = addXP(withHidden, xpGained);

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
            size="sm"
            onClick={() => navigate(-1)}
            className="mb-4 w-full sm:w-auto justify-start font-mono-data"
          >
            <ArrowLeft className="h-4 w-4 mr-1" />
            Return
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
      <header className="border-b border-border/40 bg-card/50 backdrop-blur supports-[backdrop-filter]:bg-card/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 sm:py-6">
        <div className="flex flex-col gap-3 sm:gap-4 md:flex-row md:items-center">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate(-1)}
              className="w-full md:w-auto justify-start font-mono-data"
            >
              <ArrowLeft className="h-4 w-4 mr-1" />
              Return
            </Button>
            <div className="flex-1 w-full text-center md:text-left">
              <h1 className="text-2xl sm:text-3xl font-bold flex flex-wrap items-center justify-center md:justify-start gap-2 sm:gap-3">
                <Brain className="w-6 h-6 sm:w-8 sm:h-8 text-primary" />
                Mental Training Laboratory
              </h1>
              <p className="text-muted-foreground mt-1 text-sm">
                Cognitive Speed & Depth • Psychological Immunity • Strategic Forecasting • Environmental Memory & Reconstruction
              </p>
            </div>
          <Badge
            variant={aiStatus === 'ready' ? 'default' : aiStatus === 'error' ? 'destructive' : aiStatus === 'rate-limited' ? 'secondary' : 'outline'}
            className="font-mono text-xs self-start md:self-auto"
          >
            THEIA: {aiStatus === 'ready' ? 'OPTIMIZED' : aiStatus === 'error' ? 'OFFLINE' : aiStatus === 'rate-limited' ? 'RATE LIMITED' : 'CALIBRATING'}
          </Badge>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        {aiStatus === 'loading' ? (
          <Card className="p-6 border-dashed border-border text-muted-foreground text-sm font-mono">
            THEIA: Calibrating cognitive modules...
          </Card>
        ) : aiStatus === 'error' ? (
          <Card className="p-6 border-destructive/50 bg-destructive/5">
            <div className="space-y-2">
              <h3 className="text-lg font-bold text-destructive">THEIA: AUTHENTICATION FAILURE</h3>
              <p className="text-sm text-muted-foreground">
                The Gemini API key is invalid or missing. Please check your Vercel environment variables.
              </p>
              <p className="text-xs text-muted-foreground font-mono mt-2">
                Required: GEMINI_API_KEY or GOOGLE_GENERATIVE_AI_API_KEY
              </p>
            </div>
          </Card>
        ) : aiStatus === 'rate-limited' ? (
          <Card className="p-6 border-orange-500/50 bg-orange-500/5">
            <div className="space-y-2">
              <h3 className="text-lg font-bold text-orange-600">THEIA: RATE LIMIT REACHED</h3>
              <p className="text-sm text-muted-foreground">
                Too many requests to Gemini API. Rate limit exceeded.
              </p>
              {retryDelay > 0 && (
                <p className="text-xs text-orange-600 font-mono mt-2">
                  Retrying in {retryDelay} seconds...
                </p>
              )}
              <p className="text-xs text-muted-foreground mt-2">
                Tip: Check rate limits at{' '}
                <a href="https://ai.google.dev/pricing" target="_blank" rel="noopener noreferrer" className="text-primary underline">
                  ai.google.dev/pricing
                </a>
              </p>
            </div>
          </Card>
        ) : aiStatus === 'ready' ? (
          <div className="grid gap-5 sm:gap-6 sm:grid-cols-2 lg:grid-cols-3">
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
                      {challenge.protocolName || challenge.title}
                    </h3>
                    <p className="text-sm text-muted-foreground line-clamp-2 mb-2">
                      {challenge.objective || challenge.description}
                    </p>
                    {challenge.executionProcedure && challenge.executionProcedure.length > 0 && (
                      <div className="mt-2 space-y-1">
                        <p className="text-xs font-mono text-muted-foreground uppercase">Execution:</p>
                        <ol className="text-xs text-muted-foreground space-y-1 ml-4 list-decimal">
                          {challenge.executionProcedure.slice(0, 2).map((step, idx) => (
                            <li key={idx} className="line-clamp-1">{step}</li>
                          ))}
                          {challenge.executionProcedure.length > 2 && (
                            <li className="text-primary/70 italic">+{challenge.executionProcedure.length - 2} more steps</li>
                          )}
                        </ol>
                      </div>
                    )}
                    {challenge.successMetric && (
                      <p className="text-xs text-primary/70 mt-2 font-mono line-clamp-1">
                        Metric: {challenge.successMetric}
                      </p>
                    )}
                    {challenge.aiContext && !challenge.successMetric && (
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
        ) : null}
      </div>
    </div>
  );
}
