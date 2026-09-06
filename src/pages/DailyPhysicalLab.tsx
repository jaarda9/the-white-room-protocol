import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  getDailyQuests,
  toggleQuestCompletion,
  getUserProfile,
  saveUserProfile,
  addXP,
  getPhysicalDayPlan,
  QUESTS_UPDATED_EVENT,
} from '@/lib/storage';
import { Quest, UserProfile } from '@/lib/types';
import { systemSound } from '@/lib/system-sound';
import {
  ArrowLeft,
  Info,
  Dumbbell,
  Play,
  Check,
} from 'lucide-react';
import { toast } from 'sonner';

export default function DailyPhysicalLab() {
  const navigate = useNavigate();
  const [profile, setProfile] = useState<UserProfile>(getUserProfile());
  const [quests, setQuests] = useState<Quest[]>([]);
  const today = useMemo(() => new Date(), []);
  const todayKey = today.toISOString().slice(0, 10);
  const currentPlan = useMemo(() => getPhysicalDayPlan(today), [today]);

  const loadData = async () => {
    try {
      const q = await getDailyQuests();
      setQuests(q);
      setProfile(getUserProfile());
    } catch (e) {
      console.error('Failed to load quests in DailyPhysicalLab:', e);
    }
  };

  useEffect(() => {
    loadData();

    const handleUpdate = () => loadData();
    window.addEventListener(QUESTS_UPDATED_EVENT, handleUpdate);
    window.addEventListener('wrp:profile-updated', handleUpdate);
    window.addEventListener('storage', handleUpdate);

    return () => {
      window.removeEventListener(QUESTS_UPDATED_EVENT, handleUpdate);
      window.removeEventListener('wrp:profile-updated', handleUpdate);
      window.removeEventListener('storage', handleUpdate);
    };
  }, []);

  const physicalQuests = useMemo(
    () => quests.filter((q) => q.type === 'physical'),
    [quests]
  );

  const activeQuest = physicalQuests[0] || {
    id: `physical-workout-${todayKey}`,
    type: 'physical',
    title: currentPlan.title,
    description: currentPlan.description,
    xp: currentPlan.xp,
    duration: currentPlan.duration,
    difficulty: currentPlan.difficulty,
    hiddenRewards: currentPlan.hiddenRewards,
    completed: false,
  };

  const handleToggleQuest = () => {
    systemSound.playClick();
    const updated = toggleQuestCompletion(activeQuest.id);
    setQuests(updated);

    const nowCompleted = updated.find((q) => q.id === activeQuest.id)?.completed;
    if (nowCompleted) {
      systemSound.playQuestComplete();
      const updatedProfile = addXP(profile, activeQuest.xp);
      saveUserProfile(updatedProfile);
      setProfile(updatedProfile);
      toast.success('PHYSICAL PROTOCOL COMPLETED', {
        description: `+${activeQuest.xp} EXP added to Hunter ${profile.displayName || profile.pseudo}.`,
      });
    }
  };

  return (
    <div className="min-h-screen pt-6 pb-28 bg-[#071322] text-[#e5ecf4] flex flex-col system-blueprint-bg font-mono">
      <main className="max-w-[660px] w-full mx-auto px-4 py-6 flex-1 flex flex-col items-center">
        {/* Solo Leveling Holographic Container */}
        <div className="relative w-full bg-[#0a1b2e]/90 border-2 border-white/50 rounded-[4px] p-5 sm:p-8 text-white shadow-[0_0_30px_rgba(0,0,0,0.85),inset_0_0_24px_rgba(0,212,255,0.08)] backdrop-blur-md font-mono space-y-4">
          
          {/* Top Return Header */}
          <div className="flex items-center justify-between pb-2 border-b border-white/20 text-xs">
            <button
              onClick={() => {
                systemSound.playClick();
                navigate('/daily-protocol');
              }}
              className="flex items-center gap-1.5 text-cyan-300 hover:text-white transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>[ RETURN TO ALL QUESTS ]</span>
            </button>

            <button
              onClick={() => {
                systemSound.playClick();
                navigate('/');
              }}
              className="text-white/60 hover:text-cyan-300 transition-colors"
            >
              [ STATUS ]
            </button>
          </div>

          {/* Centered Solo Leveling QUEST INFO Box */}
          <div className="relative flex items-center justify-center pt-2">
            <div className="inline-block px-8 py-1 border border-white/70 bg-[#061426]/60 shadow-[0_0_14px_rgba(0,212,255,0.35)]">
              <div className="flex items-center gap-2">
                <Info className="w-4 h-4 text-[#9fd3ff]" />
                <span className="font-mono font-extrabold tracking-[0.28em] text-base sm:text-lg text-white anime-glow-text">
                  QUEST INFO
                </span>
              </div>
            </div>
          </div>

          {/* Subtitle */}
          <div className="text-center font-mono text-xs sm:text-sm text-white/90">
            [Daily Quest: Physical Training has arrived.]
          </div>

          {/* GOAL Header with double underline */}
          <div className="text-center">
            <div className="inline-block border-b-2 border-t-0 border-white/70 pb-0.5">
              <div className="border-b border-white/40 pb-0.5">
                <span className="font-mono text-sm sm:text-base font-bold text-white tracking-[0.25em] anime-glow-text px-4">
                  GOAL
                </span>
              </div>
            </div>
          </div>

          {/* Solo Leveling Quest Card (Clean Border with Title & Checkbox) */}
          <div className="border border-white/40 bg-[#061424]/90 rounded-[2px] p-4 sm:p-5 shadow-[inset_0_0_14px_rgba(0,212,255,0.06)] space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <Dumbbell className="w-4 h-4 text-cyan-400 shrink-0" />
                  <h2 className={`text-sm sm:text-base font-bold tracking-wide ${activeQuest.completed ? 'line-through text-gray-400' : 'text-white'}`}>
                    {activeQuest.title}
                  </h2>
                </div>
                <div className="text-[11px] text-[#9fd3ff] font-mono">
                  [ {activeQuest.duration} MIN • +{activeQuest.xp} EXP • RANK {activeQuest.difficulty} ]
                </div>
              </div>

              {/* Action Buttons: Play + Checkbox */}
              <div className="flex items-center gap-2 shrink-0 pt-0.5">
                <button
                  onClick={() => {
                    systemSound.playClick();
                    navigate(`/quest/${activeQuest.id}`);
                  }}
                  className="p-1.5 border border-white/40 bg-white/5 hover:border-cyan-300 hover:bg-cyan-950/40 text-cyan-300 transition-all rounded-[2px] shadow-[0_0_10px_rgba(0,212,255,0.2)]"
                  title="Launch active timer session"
                >
                  <Play className="w-3.5 h-3.5 fill-current" />
                </button>

                <button
                  onClick={handleToggleQuest}
                  className={`w-7 h-7 border-2 rounded-[2px] flex items-center justify-center transition-all ${
                    activeQuest.completed
                      ? 'border-emerald-400 bg-emerald-950/60 text-emerald-300 shadow-[0_0_12px_rgba(52,211,153,0.5)]'
                      : 'border-white/50 bg-black/50 hover:border-cyan-300'
                  }`}
                  title={activeQuest.completed ? 'Mark incomplete' : 'Mark complete'}
                >
                  {activeQuest.completed && <Check className="w-4 h-4 stroke-[3]" />}
                </button>
              </div>
            </div>

            {/* Description / Exercises Text */}
            <p className="text-xs sm:text-[13px] text-gray-300 leading-relaxed font-mono whitespace-pre-line border-t border-white/15 pt-3">
              {activeQuest.description}
            </p>
          </div>

          {/* Clean Status Indicator */}
          <div className="text-center text-xs text-[#9fd3ff]">
            {activeQuest.completed ? (
              <span className="text-emerald-400 font-bold">[ PROTOCOL COMPLETED - STATUS SYNCHRONIZED ]</span>
            ) : (
              <span className="text-gray-400 font-mono">[ PROTOCOL INCOMPLETE - COMMENCE TRAINING ]</span>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
