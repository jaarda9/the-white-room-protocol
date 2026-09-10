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
  Sparkles,
  Play,
  Check,
  ExternalLink,
} from 'lucide-react';
import { toast } from 'sonner';

export default function DailySpiritualLab() {
  const navigate = useNavigate();
  const [profile, setProfile] = useState<UserProfile>(getUserProfile());
  const [quests, setQuests] = useState<Quest[]>([]);

  const loadData = async () => {
    try {
      const q = await getDailyQuests();
      setQuests(q);
      setProfile(getUserProfile());
    } catch (e) {
      console.error('Failed to load quests in DailySpiritualLab:', e);
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

  const spiritualQuests = useMemo(
    () => quests.filter((q) => q.type === 'social' || q.id.startsWith('spiritual')),
    [quests]
  );

  const completedCount = spiritualQuests.filter((q) => q.completed).length;

  const handleOpenMedito = () => {
    systemSound.playClick();
    const appProtocol = 'medito://';
    const fallbackWeb = 'https://meditofoundation.org';

    const start = Date.now();
    const iframe = document.createElement('iframe');
    iframe.style.display = 'none';
    iframe.src = appProtocol;
    document.body.appendChild(iframe);

    setTimeout(() => {
      if (iframe.parentNode) {
        document.body.removeChild(iframe);
      }
      if (Date.now() - start < 2000) {
        window.open(fallbackWeb, '_blank', 'noopener,noreferrer');
      }
    }, 1200);
  };

  const handleLaunchQuest = (questId: string) => {
    systemSound.playClick();
    navigate(`/quest/${questId}`);
  };

  const allCompleted = completedCount === spiritualQuests.length && spiritualQuests.length > 0;

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
              TOTAL: [{completedCount}/{spiritualQuests.length}]
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
            [Daily Quest: Spiritual Training has arrived.]
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

          {/* List of Spiritual Training Quests matching image 2 row style */}
          <div className="space-y-3 mb-5">
            {spiritualQuests.map((quest) => {
              const isMeditation = quest.title.toLowerCase().includes('contemplation') || quest.title.toLowerCase().includes('meditation');
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
                      title="Launch contemplation session to fulfill directive"
                    >
                      <Sparkles className="w-4 h-4 text-[#9fd3ff] shrink-0" />
                      <span className={`font-bold text-xs sm:text-sm tracking-wider ${quest.completed ? 'text-emerald-300 font-mono' : 'text-white'}`}>
                        {quest.title}
                      </span>
                      <span className="text-[10px] text-cyan-300/70 font-mono hidden sm:inline">
                        [{quest.duration} MIN • +{quest.xp} EXP]
                      </span>
                      {isMeditation && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenMedito();
                          }}
                          className="inline-flex items-center gap-1 text-[10px] text-cyan-300 hover:text-white underline underline-offset-2 ml-1"
                          title="Open Medito app"
                        >
                          <ExternalLink className="w-2.5 h-2.5" />
                          <span>MEDITO</span>
                        </button>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleLaunchQuest(quest.id);
                        }}
                        className="p-1.5 border border-white/40 bg-white/5 hover:border-cyan-300 hover:bg-cyan-950/40 text-cyan-300 transition-all rounded-[2px]"
                        title="Launch contemplation session"
                      >
                        <Play className="w-3.5 h-3.5 fill-current" />
                      </button>

                      {/* Automated Condition Checkmark Box (No manual checking) */}
                      <div
                        className={`w-7 h-7 border-2 rounded-[2px] flex items-center justify-center transition-all ${
                          quest.completed
                            ? 'border-emerald-400 bg-emerald-950/60 text-emerald-300 shadow-[0_0_10px_rgba(52,211,153,0.5)]'
                            : 'border-white/30 bg-black/50 text-white/20'
                        }`}
                        title={
                          quest.completed
                            ? 'Directive verified automatically: Session complete'
                            : 'Auto-verification: Launch and finish session to fulfill directive'
                        }
                      >
                        {quest.completed ? (
                          <Check className="w-4 h-4 stroke-[3]" />
                        ) : (
                          <div className="w-1.5 h-1.5 rounded-full bg-white/20" />
                        )}
                      </div>
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

          {/* Bottom Action Button: Automated Checkmark Box matching Image 2 */}
          <div className="flex flex-col items-center justify-center">
            <div
              className={`w-12 h-12 border-2 rounded-[2px] flex items-center justify-center transition-all shadow-[0_0_15px_rgba(0,212,255,0.2)] ${
                allCompleted
                  ? 'border-emerald-400/80 bg-emerald-950/60 text-emerald-300 shadow-[0_0_20px_rgba(52,211,153,0.6)]'
                  : 'border-white/30 bg-black/50 text-gray-500'
              }`}
              title={
                allCompleted
                  ? 'All spiritual directives verified automatically'
                  : 'Directives incomplete: complete all spiritual training sessions'
              }
            >
              <Check className="w-7 h-7 stroke-[3]" />
            </div>

            <div className="mt-2 text-center font-mono text-[11px] text-white/50">
              {allCompleted ? (
                <span className="text-emerald-400 font-bold anime-glow-text">
                  [ ALL SPIRITUAL DIRECTIVES FULFILLED ]
                </span>
              ) : (
                <span>[{completedCount} of {spiritualQuests.length} directives fulfilled]</span>
              )}
            </div>
          </div>

        </div>
      </main>
    </div>
  );
}
