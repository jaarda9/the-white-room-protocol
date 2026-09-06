import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  getDailyQuests,
  toggleQuestCompletion,
  getUserProfile,
  saveUserProfile,
  addXP,
  QUESTS_UPDATED_EVENT,
} from '@/lib/storage';
import { Quest, UserProfile } from '@/lib/types';
import { systemSound } from '@/lib/system-sound';
import {
  ArrowLeft,
  Info,
  Brain,
  Play,
  Check,
} from 'lucide-react';
import { toast } from 'sonner';

export default function DailyMentalLab() {
  const navigate = useNavigate();
  const [profile, setProfile] = useState<UserProfile>(getUserProfile());
  const [quests, setQuests] = useState<Quest[]>([]);

  const loadData = async () => {
    try {
      const q = await getDailyQuests();
      setQuests(q);
      setProfile(getUserProfile());
    } catch (e) {
      console.error('Failed to load quests in DailyMentalLab:', e);
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

  const mentalQuests = useMemo(
    () => quests.filter((q) => q.type === 'mental'),
    [quests]
  );

  const completedCount = mentalQuests.filter((q) => q.completed).length;

  const handleToggleQuest = (questId: string) => {
    systemSound.playClick();
    const updated = toggleQuestCompletion(questId);
    setQuests(updated);

    const target = updated.find((q) => q.id === questId);
    if (target?.completed) {
      systemSound.playQuestComplete();
      const updatedProfile = addXP(profile, target.xp);
      saveUserProfile(updatedProfile);
      setProfile(updatedProfile);
      toast.success('MENTAL PROTOCOL COMPLETED', {
        description: `+${target.xp} EXP acquired for Hunter ${profile.displayName || profile.pseudo}.`,
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
            [Daily Quest: Mental Training has arrived.]
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

          {/* Progress Header */}
          <div className="flex items-center justify-between text-xs text-[#9fd3ff] pb-1 border-b border-white/20">
            <span className="font-bold flex items-center gap-1.5 text-white">
              <Brain className="w-3.5 h-3.5 text-cyan-400" />
              COGNITIVE PROTOCOLS
            </span>
            <span className={completedCount === mentalQuests.length && mentalQuests.length > 0 ? 'text-emerald-400 font-bold' : 'text-cyan-300 font-bold'}>
              [{completedCount} / {mentalQuests.length} COMPLETED]
            </span>
          </div>

          {/* Clean List of Mental Quests */}
          <div className="space-y-2.5">
            {mentalQuests.map((quest) => (
              <div
                key={quest.id}
                className={`p-3 sm:p-4 border rounded-[2px] transition-all ${
                  quest.completed
                    ? 'border-emerald-500/40 bg-emerald-950/20 shadow-[0_0_10px_rgba(52,211,153,0.15)]'
                    : 'border-white/30 bg-[#061424]/90 hover:border-cyan-400/60'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0 space-y-1">
                    <h3 className={`text-xs sm:text-sm font-bold truncate ${quest.completed ? 'text-gray-400 line-through' : 'text-white'}`}>
                      {quest.title}
                    </h3>
                    <p className="text-[11px] text-gray-300 leading-relaxed">
                      {quest.description}
                    </p>
                    <div className="text-[10px] text-[#9fd3ff] font-mono">
                      [ {quest.duration} MIN • +{quest.xp} EXP • RANK {quest.difficulty} ]
                    </div>
                  </div>

                  {/* Play & Checkbox */}
                  <div className="flex items-center gap-2 shrink-0 pt-0.5">
                    <button
                      onClick={() => {
                        systemSound.playClick();
                        navigate(`/quest/${quest.id}`);
                      }}
                      className="p-1.5 border border-white/40 bg-white/5 hover:border-cyan-300 hover:bg-cyan-950/40 text-cyan-300 transition-all rounded-[2px]"
                      title="Launch timer session"
                    >
                      <Play className="w-3.5 h-3.5 fill-current" />
                    </button>

                    <button
                      onClick={() => handleToggleQuest(quest.id)}
                      className={`w-7 h-7 border-2 rounded-[2px] flex items-center justify-center transition-all ${
                        quest.completed
                          ? 'border-emerald-400 bg-emerald-950/60 text-emerald-300 shadow-[0_0_10px_rgba(52,211,153,0.5)]'
                          : 'border-white/50 bg-black/50 hover:border-cyan-300'
                      }`}
                      title={quest.completed ? 'Mark incomplete' : 'Mark complete'}
                    >
                      {quest.completed && <Check className="w-4 h-4 stroke-[3]" />}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

        </div>
      </main>
    </div>
  );
}
