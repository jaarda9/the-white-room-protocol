import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  getDailyQuests,
  toggleQuestCompletion,
  getUserProfile,
  saveUserProfile,
  addXP,
  consumeMentalEnergy,
  QUESTS_UPDATED_EVENT,
  PROTOCOL_CALIBRATED_EVENT,
} from '@/lib/storage';
import { Quest, UserProfile } from '@/lib/types';
import { systemSound } from '@/lib/system-sound';
import {
  ArrowLeft,
  Info,
  Brain,
  Play,
  Check,
  Sparkles,
  BookOpen,
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
    window.addEventListener(PROTOCOL_CALIBRATED_EVENT, handleUpdate);
    window.addEventListener('wrp:profile-updated', handleUpdate);
    window.addEventListener('storage', handleUpdate);

    return () => {
      window.removeEventListener(QUESTS_UPDATED_EVENT, handleUpdate);
      window.removeEventListener(PROTOCOL_CALIBRATED_EVENT, handleUpdate);
      window.removeEventListener('wrp:profile-updated', handleUpdate);
      window.removeEventListener('storage', handleUpdate);
    };
  }, []);

  const mentalQuests = useMemo(
    () => quests.filter((q) => q.type === 'mental'),
    [quests]
  );

  const coreQuests = useMemo(
    () => mentalQuests.filter((q) => !q.isChainBonus),
    [mentalQuests]
  );

  const completedCount = mentalQuests.filter((q) => q.completed).length;
  const coreCompleted = coreQuests.length > 0 && coreQuests.every((q) => q.completed);
  const allCompleted = completedCount === mentalQuests.length && mentalQuests.length > 0;

  const handleLaunchQuest = (questId: string) => {
    systemSound.playClick();
    navigate(`/quest/${questId}`);
  };

  const handleToggleQuest = (questId: string) => {
    systemSound.playClick();
    const updated = toggleQuestCompletion(questId);
    setQuests(updated);
    const target = updated.find((q) => q.id === questId);
    if (target?.completed) {
      systemSound.playSuccess();
      const vitalsResult = consumeMentalEnergy(profile, target.difficulty >= 3 ? 'heavy' : 'moderate');
      const updatedProfile = addXP(vitalsResult.profile, target.xp, 'mental');
      saveUserProfile(updatedProfile);
      setProfile(updatedProfile);

      if (vitalsResult.inOverdrive) {
        toast.warning('OVERDRIVE PROTOCOL ENGAGED', {
          description: 'Pushed through mental exhaustion! Overdrive record logged.',
        });
      }

      toast.success('DIRECTIVE COMPLETED', {
        description: `Marked "${target.title}" as completed (+${target.xp} EXP).`,
      });

      // Unlock notifications when completing Work Sessions
      const titleLower = target.title.toLowerCase();
      if (target.id.startsWith('mental-work1') || titleLower.startsWith('work session 1') || titleLower.startsWith('study session 1')) {
        setTimeout(() => {
          systemSound.playSystemChime();
          toast.info('CHAIN PROTOCOL UNLOCKED', {
            description: 'Work Session 2 (45 Min) is now available if you wish to perform another session.',
          });
        }, 500);
      } else if (target.id.startsWith('mental-work2') || titleLower.startsWith('work session 2') || titleLower.startsWith('study session 2')) {
        setTimeout(() => {
          systemSound.playSystemChime();
          toast.info('CHAIN PROTOCOL UNLOCKED', {
            description: 'Work Session 3 (45 Min) is now available if you wish to perform another session.',
          });
        }, 500);
      } else if (target.id.startsWith('mental-work3') || titleLower.startsWith('work session 3') || titleLower.startsWith('study session 3')) {
        setTimeout(() => {
          systemSound.playSystemChime();
          toast.info('CHAIN PROTOCOL UNLOCKED', {
            description: 'Work Session 4 (45 Min) is now available if you wish to perform another session.',
          });
        }, 500);
      }
    }
  };

  return (
    <div className="min-h-screen pt-8 sm:pt-14 md:pt-16 pb-36 sm:pb-40 bg-[#071322] text-[#e5ecf4] flex flex-col system-blueprint-bg font-mono">
      <main className="max-w-[620px] w-full mx-auto px-4 py-6 sm:py-10 flex-1 flex flex-col items-center justify-center my-auto">
        {/* Solo Leveling Holographic Container matching Image 2 */}
        <div className="relative w-full bg-[#0a1b2e]/90 border-2 border-white/50 rounded-[4px] p-5 sm:p-8 text-white shadow-[0_0_30px_rgba(0,0,0,0.85),inset_0_0_24px_rgba(0,212,255,0.08)] backdrop-blur-md anime-dropdown font-mono">
          
          {/* Top Return Header Controls */}
          <div className="flex items-center justify-between pb-2 mb-3 border-b border-white/20 text-xs">
            <button
              onClick={() => {
                systemSound.playClick();
                navigate('/daily-protocol');
              }}
              className="flex items-center gap-1.5 text-cyan-300/80 hover:text-white transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>[ RETURN TO ALL QUESTS ]</span>
            </button>

            <div className="text-[11px] text-cyan-300/80 font-bold">
              TOTAL: [{completedCount}/{mentalQuests.length}]
            </div>
          </div>

          {/* Centered Solo Leveling QUEST INFO Box */}
          <div className="relative flex items-center justify-center pb-2 mb-2">
            <div className="inline-block px-8 py-1 border border-white/70 bg-[#061426]/60 shadow-[0_0_14px_rgba(0,212,255,0.35)]">
              <div className="flex items-center gap-2">
                <Info className="w-4 h-4 text-[#9fd3ff]" />
                <span className="font-mono font-extrabold tracking-[0.28em] text-base sm:text-lg text-white anime-glow-text">
                  QUEST INFO
                </span>
              </div>
            </div>
          </div>

          {/* Subtitle Line */}
          <div className="text-center font-mono text-xs sm:text-sm text-white/90 mb-4">
            [Daily Quest: Mental Training has arrived.]
          </div>

          {/* GOAL Header with double underline */}
          <div className="text-center mb-4">
            <div className="inline-block border-b-2 border-t-0 border-white/70 pb-0.5">
              <div className="border-b border-white/40 pb-0.5">
                <span className="font-mono text-sm sm:text-base font-bold text-white tracking-[0.25em] anime-glow-text px-4">
                  GOAL
                </span>
              </div>
            </div>
          </div>

          {/* List of Mental Training Quests matching image 2 row style */}
          <div className="space-y-3 mb-5">
            {mentalQuests.map((quest) => {
              const isMeditation = quest.title.toLowerCase().includes('meditation');
              const isReading = quest.title.toLowerCase().includes('reading') || quest.id.includes('book');
              const QuestIcon = isMeditation ? Sparkles : isReading ? BookOpen : Brain;

              return (
                <div
                  key={quest.id}
                  className={`border rounded-[2px] overflow-hidden transition-all shadow-[inset_0_0_14px_rgba(0,212,255,0.06)] ${
                    quest.completed
                      ? 'border-emerald-500/40 bg-[#061825]/90'
                      : 'border-white/40 bg-[#061424]/80 hover:border-cyan-400/60'
                  }`}
                >
                  <div className="w-full flex items-center justify-between p-3 sm:p-3.5 bg-white/5 transition-colors">
                    <div
                      onClick={() => handleLaunchQuest(quest.id)}
                      className="flex items-center gap-2.5 flex-1 text-left cursor-pointer select-none"
                      title="Launch protocol session to fulfill directive"
                    >
                      <QuestIcon className="w-4 h-4 text-[#9fd3ff] shrink-0" />
                    <span className={`font-bold text-xs sm:text-sm tracking-wider ${quest.completed ? 'text-emerald-300 font-mono' : 'text-white'}`}>
                      {quest.title}
                    </span>
                    <span className="text-[10px] text-cyan-300/70 font-mono hidden sm:inline">
                      [{quest.duration} MIN • +{quest.xp} EXP]
                    </span>
                    {quest.isChainBonus && (
                      <span className="text-[9px] px-1.5 py-0.5 rounded-[2px] bg-cyan-950/80 border border-cyan-400/50 text-cyan-300 font-mono tracking-wider">
                        EXTRA SESSION
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleLaunchQuest(quest.id);
                      }}
                      className="p-1.5 border border-white/40 bg-white/5 hover:border-cyan-300 hover:bg-cyan-950/40 text-cyan-300 transition-all rounded-[2px]"
                      title="Launch timer session"
                    >
                      <Play className="w-3.5 h-3.5 fill-current" />
                    </button>

                    {/* Condition Checkmark Box (Manual toggle or verified via timer) */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleToggleQuest(quest.id);
                      }}
                      className={`w-7 h-7 border-2 rounded-[2px] flex items-center justify-center transition-all cursor-pointer ${
                        quest.completed
                          ? 'border-emerald-400 bg-emerald-950/60 text-emerald-300 shadow-[0_0_10px_rgba(52,211,153,0.5)]'
                          : 'border-white/30 bg-black/50 text-white/20 hover:border-cyan-400/60 hover:text-cyan-300'
                      }`}
                      title={
                        quest.completed
                          ? 'Directive completed. Click to toggle status.'
                          : 'Click to toggle directive completion, or click [Play] to run session timer.'
                      }
                    >
                      {quest.completed ? (
                        <Check className="w-4 h-4 stroke-[3]" />
                      ) : (
                        <div className="w-1.5 h-1.5 rounded-full bg-white/20" />
                      )}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

          {/* Warning Text: red penalty highlight matching Image 2 */}
          <div className="text-center font-mono text-xs text-white/80 mb-5 leading-relaxed max-w-sm mx-auto">
            <div>WARNING: Failure to complete</div>
            <div>
              the daily quest will result in an appropriate{' '}
              <span className="text-red-400 font-bold tracking-wide">penalty.</span>
            </div>
          </div>

          {/* Bottom Action Button: Interactive Checkmark Box matching Image 2 */}
          <div className="flex flex-col items-center justify-center">
            <button
              type="button"
              onClick={() => {
                if (allCompleted) {
                  systemSound.playSuccess();
                  toast.success('ALL DIRECTIVES COMPLETE', {
                    description: 'All core disciplines and extra work sessions verified. Maximum INT & WIS growth recorded.',
                  });
                } else if (coreCompleted) {
                  systemSound.playSuccess();
                  toast.success('CORE PROTOCOL FULFILLED', {
                    description: 'All mandatory mental training directives completed! Extra unlocked work sessions remain optional for bonus EXP.',
                  });
                } else {
                  systemSound.playClick();
                  toast.info('DIRECTIVES INCOMPLETE', {
                    description: `Fulfill all core mental directives to verify protocol (${completedCount}/${coreQuests.length} core completed).`,
                  });
                }
              }}
              className={`w-12 h-12 border-2 rounded-[2px] flex items-center justify-center transition-all shadow-[0_0_15px_rgba(0,212,255,0.2)] cursor-pointer ${
                coreCompleted
                  ? 'border-emerald-400/80 bg-emerald-950/60 text-emerald-300 shadow-[0_0_20px_rgba(52,211,153,0.6)] hover:scale-105 active:scale-95'
                  : 'border-white/30 bg-black/50 text-gray-500 hover:border-cyan-500/40'
              }`}
              title={
                coreCompleted
                  ? 'Core mental directives verified. Click to confirm protocol.'
                  : 'Directives incomplete: complete all core mental training sessions'
              }
            >
              <Check className="w-7 h-7 stroke-[3]" />
            </button>

            <div className="mt-2 text-center font-mono text-[11px] text-white/50">
              {allCompleted ? (
                <span className="text-emerald-400 font-bold anime-glow-text">
                  [ ALL MENTAL DIRECTIVES FULFILLED ]
                </span>
              ) : coreCompleted ? (
                <span className="text-emerald-300 font-bold">
                  [ CORE PROTOCOL COMPLETE • {completedCount}/{mentalQuests.length} TOTAL ]
                </span>
              ) : (
                <span>[{completedCount} of {mentalQuests.length} directives fulfilled]</span>
              )}
            </div>
          </div>

        </div>
      </main>
    </div>
  );
}
