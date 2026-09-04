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
    <div className="min-h-screen bg-[#071322] text-[#e5ecf4] flex flex-col system-blueprint-bg font-mono">
      <SoloLevelingHeader />

      <main className="max-w-4xl mx-auto w-full px-4 py-8 flex-1">
        <div className="flex items-center justify-between mb-6">
          <button
            onClick={() => {
              systemSound.playClick();
              if (selectedChallenge) setSelectedChallenge(null);
              else navigate('/');
            }}
            className="flex items-center gap-2 px-3 py-1.5 border border-white/50 bg-[#061426]/80 text-[#9fd3ff] text-xs font-mono hover:bg-white/10 hover:border-white transition-all shadow-[0_0_10px_rgba(0,212,255,0.2)]"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>[ RETURN TO STATUS ]</span>
          </button>
        </div>

        {selectedChallenge && !showDebrief ? (
          <div className="relative bg-[#0a1b2e]/90 border-2 border-white/50 rounded-[4px] p-6 sm:p-8 text-white shadow-[0_0_30px_rgba(0,0,0,0.85),inset_0_0_24px_rgba(0,212,255,0.08)] backdrop-blur-md anime-dropdown space-y-6">
            <MentalChallengeComponent
              challenge={selectedChallenge}
              onComplete={handleChallengeComplete}
            />
          </div>
        ) : showDebrief && debriefData ? (
          <div className="relative max-w-xl mx-auto bg-[#0a1b2e]/90 border-2 border-white/50 rounded-[4px] p-6 sm:p-8 text-white shadow-[0_0_30px_rgba(0,0,0,0.85),inset_0_0_24px_rgba(0,212,255,0.08)] backdrop-blur-md anime-dropdown space-y-6 text-center">
            <div className="border-b border-white/20 pb-4">
              <div className="inline-block px-8 py-1 border border-white/70 bg-[#061426]/60 shadow-[0_0_14px_rgba(0,212,255,0.35)] mb-2">
                <h2 className="text-xl sm:text-2xl font-mono font-bold text-white anime-glow-text tracking-[0.2em]">
                  COGNITIVE TRIAL COMPLETE
                </h2>
              </div>
              <div className="text-emerald-400 font-mono text-sm mt-1 anime-glow-text">
                +{debriefData.rewards.xp} XP ACQUIRED
              </div>
            </div>
            <div className="p-4 bg-[#061424]/75 border border-white/45 font-mono text-xs text-gray-300 space-y-1 rounded-[2px]">
              <div>ACCURACY: {debriefData.performance.accuracy}%</div>
              <div>FOCUS SCORE: {debriefData.performance.focusScore}</div>
            </div>
            <button
              onClick={() => {
                setShowDebrief(false);
                setSelectedChallenge(null);
              }}
              className="w-full py-3 border border-white/60 bg-white/10 hover:bg-white/25 text-white font-mono font-bold text-xs tracking-wider transition-all shadow-[0_0_15px_rgba(0,212,255,0.2)]"
            >
              CONFIRM & RETURN
            </button>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="relative bg-[#0a1b2e]/90 border-2 border-white/50 rounded-[4px] p-6 text-center text-white shadow-[0_0_30px_rgba(0,0,0,0.85),inset_0_0_24px_rgba(0,212,255,0.08)] backdrop-blur-md anime-dropdown">
              <div className="inline-block px-4 sm:px-8 py-1 border border-white/70 bg-[#061426]/60 shadow-[0_0_14px_rgba(0,212,255,0.35)] mb-2 max-w-full">
                <h2 className="text-sm sm:text-xl md:text-2xl font-mono font-bold text-white anime-glow-text tracking-[0.1em] sm:tracking-[0.2em]">
                  COGNITIVE TRIALS
                </h2>
              </div>
              <p className="text-xs font-mono text-white/80 mt-1">
                Neuro-synaptic dungeons designed to enhance perception, recall, and strategic calculation.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {challenges.map((challenge) => (
                <div
                  key={challenge.id}
                  onClick={() => handleChallengeSelect(challenge)}
                  className="bg-[#0a1b2e]/85 border-2 border-white/40 rounded-[4px] p-5 space-y-4 hover:border-white/90 hover:bg-[#0a1b2e] cursor-pointer transition-all group shadow-[0_0_20px_rgba(0,0,0,0.7),inset_0_0_15px_rgba(0,212,255,0.05)] anime-dropdown"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono px-2 py-0.5 border border-white/40 text-[#9fd3ff] bg-black/50">
                      RANK {challenge.difficulty}
                    </span>
                    <span className="text-xs font-mono text-emerald-400 font-bold">
                      +{challenge.xp} XP
                    </span>
                  </div>

                  <div>
                    <h3 className="font-mono font-bold text-base text-white group-hover:text-[#9fd3ff] transition-colors">
                      {challenge.title}
                    </h3>
                    <p className="text-xs font-mono text-gray-300 mt-1 line-clamp-2">
                      {challenge.description}
                    </p>
                  </div>

                  <div className="pt-3 border-t border-white/20 flex items-center justify-between text-xs font-mono text-gray-400">
                    <span>{challenge.timeLimit}s Trial</span>
                    <span className="text-[#9fd3ff] group-hover:underline">ENTER TRIAL →</span>
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
