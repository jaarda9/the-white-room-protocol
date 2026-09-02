import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { MentalChallenge, UserProfile, Attributes } from '@/lib/types';
import { getUserProfile, saveUserProfile, addXP } from '@/lib/storage';
import { MentalChallengeComponent } from '@/components/MentalChallenge';
import { ScenarioDebrief } from '@/components/ScenarioDebrief';
import { SoloLevelingHeader } from '@/components/SoloLevelingHeader';
import { ArrowLeft, Brain, Zap, Target } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { enhanceMentalChallenges } from '@/lib/lab-ai';
import { updateMentalCompletion } from '@/lib/achievements';
import { scaleHiddenRewards } from '@/lib/attribute-scaling';
import { systemSound } from '@/lib/system-sound';

export default function MentalLab() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [challenges, setChallenges] = useState<MentalChallenge[]>([]);
  const [aiStatus, setAiStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [selectedChallenge, setSelectedChallenge] = useState<MentalChallenge | null>(null);
  const [showDebrief, setShowDebrief] = useState(false);
  const [debriefData, setDebriefData] = useState<any>(null);

  useEffect(() => {
    const userProfile = getUserProfile();
    setProfile(userProfile);
    const load = async () => {
      setAiStatus('loading');
      try {
        const data = await enhanceMentalChallenges(userProfile);
        setChallenges(data);
        setAiStatus('ready');
      } catch (e) {
        setAiStatus('error');
      }
    };
    load();
  }, []);

  const handleChallengeSelect = (challenge: MentalChallenge) => {
    systemSound.playClick();
    setSelectedChallenge(challenge);
    setShowDebrief(false);
  };

  const handleChallengeComplete = (result: { accuracy: number; timeTaken: number; focusScore: number }) => {
    if (!profile || !selectedChallenge) return;
    systemSound.playLevelUp();

    const success = result.accuracy >= 70;
    const xpGained = success ? selectedChallenge.xp : Math.floor(selectedChallenge.xp * 0.5);
    const performanceMultiplier = result.accuracy / 100;

    const attributeRewards = scaleHiddenRewards(profile, selectedChallenge.hiddenRewards, {
      completionRatio: performanceMultiplier,
      baseMultiplier: 1,
      minCompletionRatio: 0,
    });

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

    setDebriefData({
      challenge: selectedChallenge,
      performance: result,
      rewards: { xp: xpGained, attributes: attributeRewards },
    });
    setShowDebrief(true);
  };

  if (!profile) return null;

  return (
    <div className="min-h-screen bg-[#070d18] text-[#e5ecf4] flex flex-col">
      <SoloLevelingHeader />

      <main className="max-w-4xl mx-auto w-full px-4 py-8 flex-1">
        <div className="flex items-center justify-between mb-6">
          <button
            onClick={() => {
              systemSound.playClick();
              if (selectedChallenge) setSelectedChallenge(null);
              else navigate('/');
            }}
            className="flex items-center gap-2 text-xs font-mono text-gray-400 hover:text-cyan-300 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>[ RETURN TO COMMAND ]</span>
          </button>
        </div>

        {selectedChallenge && !showDebrief ? (
          <div className="anime-window system-blueprint-bg system-window-corners p-6 sm:p-8 space-y-6 relative">
            <div className="corner-ticks" />
            <MentalChallengeComponent
              challenge={selectedChallenge}
              onComplete={handleChallengeComplete}
            />
          </div>
        ) : showDebrief && debriefData ? (
          <div className="anime-window system-blueprint-bg system-window-corners p-6 sm:p-8 space-y-6 text-center relative">
            <div className="corner-ticks" />
            <h2 className="text-xl sm:text-2xl font-display font-bold text-white anime-glow-text">
              [ COGNITIVE TRIAL COMPLETE ]
            </h2>
            <div className="text-cyan-300 font-mono text-sm">
              +{debriefData.rewards.xp} XP ACQUIRED
            </div>
            <div className="p-4 bg-black/40 border border-cyan-500/30 font-mono text-xs text-gray-300 space-y-1">
              <div>ACCURACY: {debriefData.performance.accuracy}%</div>
              <div>FOCUS SCORE: {debriefData.performance.focusScore}</div>
            </div>
            <button
              onClick={() => {
                setShowDebrief(false);
                setSelectedChallenge(null);
              }}
              className="w-full py-3 bg-cyan-400 text-black font-mono font-bold text-xs hover:bg-cyan-300 transition-colors"
            >
              CONFIRM & RETURN
            </button>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="anime-window system-blueprint-bg system-window-corners p-6 text-center relative">
              <div className="corner-ticks" />
              <h2 className="text-xl sm:text-2xl font-display font-bold text-white anime-glow-text">
                COGNITIVE TRIAL CHAMBER
              </h2>
              <p className="text-xs font-mono text-gray-400 mt-1">
                Neuro-synaptic dungeons designed to enhance perception, recall, and strategic calculation.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {challenges.map((challenge) => (
                <div
                  key={challenge.id}
                  onClick={() => handleChallengeSelect(challenge)}
                  className="anime-window p-5 space-y-4 hover:border-cyan-400 cursor-pointer transition-all group"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono px-2 py-0.5 border border-cyan-500/40 text-cyan-300 bg-black/40">
                      RANK {challenge.difficulty}
                    </span>
                    <span className="text-xs font-mono text-cyan-400 font-bold">
                      +{challenge.xp} XP
                    </span>
                  </div>

                  <div>
                    <h3 className="font-display font-bold text-base text-white group-hover:text-cyan-300 transition-colors">
                      {challenge.title}
                    </h3>
                    <p className="text-xs font-mono text-gray-400 mt-1 line-clamp-2">
                      {challenge.description}
                    </p>
                  </div>

                  <div className="pt-3 border-t border-cyan-500/20 flex items-center justify-between text-xs font-mono text-gray-400">
                    <span>{challenge.timeLimit}s Trial</span>
                    <span className="text-cyan-300 group-hover:underline">ENTER TRIAL →</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
