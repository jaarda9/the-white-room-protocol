import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { UserProfile, Quest, ToDoItem } from '@/lib/types';
import {
  getDailyQuests,
  toggleQuestCompletion,
  addXP,
  saveUserProfile,
  getToDos,
  completeToDo,
  getTodayKeyLocal,
  triggerFullStatusRecovery,
  consumePhysicalEnergy,
  consumeMentalEnergy,
  QUESTS_UPDATED_EVENT,
  TODOS_UPDATED_EVENT,
} from '@/lib/storage';
import { systemSound } from '@/lib/system-sound';
import {
  Info,
  Check,
  Brain,
  Dumbbell,
  Moon,
  ListChecks,
  ChevronDown,
  ChevronUp,
  Play,
  ArrowLeft,
  Sparkles,
  ArrowRight,
  ExternalLink,
} from 'lucide-react';

interface Props {
  profile: UserProfile;
  onProfileUpdated: (profile: UserProfile) => void;
  onReturnToStatus?: () => void;
}

export const SoloDailyQuestWindow = ({ profile, onProfileUpdated, onReturnToStatus }: Props) => {
  const navigate = useNavigate();
  const [quests, setQuests] = useState<Quest[]>([]);
  const [todos, setTodos] = useState<ToDoItem[]>([]);
  const [claimed, setClaimed] = useState(false);
  const [showRecoveryOverlay, setShowRecoveryOverlay] = useState(false);
  const [expandedSections, setExpandedSections] = useState<{
    mental: boolean;
    physical: boolean;
    spiritual: boolean;
    todos: boolean;
  }>({
    mental: false,
    physical: false,
    spiritual: false,
    todos: false,
  });

  const todayKey = useMemo(() => getTodayKeyLocal(new Date()), []);

  const loadData = async () => {
    try {
      const q = await getDailyQuests();
      setQuests(q);
    } catch (e) {
      console.error('Failed to load quests:', e);
    }
    setTodos(getToDos());
  };

  useEffect(() => {
    loadData();

    window.addEventListener(QUESTS_UPDATED_EVENT, loadData);
    window.addEventListener(TODOS_UPDATED_EVENT, loadData);
    window.addEventListener('storage', loadData);

    return () => {
      window.removeEventListener(QUESTS_UPDATED_EVENT, loadData);
      window.removeEventListener(TODOS_UPDATED_EVENT, loadData);
      window.removeEventListener('storage', loadData);
    };
  }, []);

  // Filter into categories
  const mentalQuests = useMemo(
    () => quests.filter((q) => q.type === 'mental'),
    [quests]
  );

  const physicalQuests = useMemo(
    () => quests.filter((q) => q.type === 'physical'),
    [quests]
  );

  const spiritualQuests = useMemo(
    () => quests.filter((q) => q.type === 'social'),
    [quests]
  );

  const todaysToDos = useMemo(
    () =>
      todos.filter(
        (t) => t.dueDate === todayKey && (t.status === 'active' || t.status === 'completed')
      ),
    [todos, todayKey]
  );

  // Counts
  const mentalDone = mentalQuests.filter((q) => q.completed).length;
  const mentalTotal = mentalQuests.length;

  const physicalDone = physicalQuests.filter((q) => q.completed).length;
  const physicalTotal = physicalQuests.length;

  const spiritualDone = spiritualQuests.filter((q) => q.completed).length;
  const spiritualTotal = spiritualQuests.length;

  const todoDone = todaysToDos.filter((t) => t.status === 'completed').length;
  const todoTotal = todaysToDos.length;

  const totalMandatory = mentalTotal + physicalTotal + spiritualTotal;
  const completedMandatory = mentalDone + physicalDone + spiritualDone;
  const allMandatoryCompleted = totalMandatory > 0 && completedMandatory >= totalMandatory;

  const handleToggleQuest = (questId: string) => {
    systemSound.playClick();
    const updated = toggleQuestCompletion(questId);
    setQuests(updated);

    const target = updated.find((q) => q.id === questId);
    if (target?.completed) {
      const isPhysical = target.type === 'physical';
      const intensity = target.difficulty >= 3 ? 'heavy' : target.difficulty === 1 ? 'light' : 'moderate';
      const vitalsResult = isPhysical
        ? consumePhysicalEnergy(profile, intensity)
        : consumeMentalEnergy(profile, intensity);
      const updatedProfile = addXP(vitalsResult.profile, target.xp, isPhysical ? 'physical' : 'mental');
      saveUserProfile(updatedProfile);
      onProfileUpdated(updatedProfile);
    }
  };

  const handleToggleTodo = (todoId: string, currentStatus: string) => {
    systemSound.playClick();
    if (currentStatus === 'completed') return;
    completeToDo(todoId);
    setTodos(getToDos());
  };

  const handleClaimRewards = () => {
    if (!allMandatoryCompleted || claimed) {
      systemSound.playClick();
      return;
    }

    systemSound.playLevelUp();
    setClaimed(true);
    setShowRecoveryOverlay(true);

    const prevLevel = profile.level;
    // Award 3 Ability Points and 200 XP, with 100% full status recovery (HP/MP/STM 100%, fatigue = 0)
    const recovered = triggerFullStatusRecovery(profile);
    const withAP: UserProfile = {
      ...recovered,
      availableAP: (recovered.availableAP ?? 12) + 3,
    };
    const updated = addXP(withAP, 200);
    saveUserProfile(updated);
    onProfileUpdated(updated);
  };

  const toggleSection = (section: 'mental' | 'physical' | 'spiritual' | 'todos') => {
    systemSound.playClick();
    setExpandedSections((prev) => ({
      ...prev,
      [section]: !prev[section],
    }));
  };

  return (
    <div className="relative max-w-[620px] w-full mx-auto my-auto bg-[#0a1b2e]/90 border-2 border-white/50 rounded-[4px] p-5 sm:p-8 text-white shadow-[0_0_30px_rgba(0,0,0,0.85),inset_0_0_24px_rgba(0,212,255,0.08)] backdrop-blur-md anime-dropdown font-mono">
      {/* Top Header Controls: Return button + Status indicator */}
      <div className="flex items-center justify-between pb-2 mb-3 border-b border-white/20 text-xs">
        {onReturnToStatus ? (
          <button
            onClick={() => {
              systemSound.playClick();
              onReturnToStatus();
            }}
            className="flex items-center gap-1.5 text-cyan-300/80 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>[ RETURN TO STATUS ]</span>
          </button>
        ) : (
          <div className="text-cyan-300/60">[ DAILY HUNTER PROTOCOL ]</div>
        )}

        <div className="text-[11px] text-cyan-300/80 font-bold">
          TOTAL: [{completedMandatory}/{totalMandatory}]
        </div>
      </div>

      {/* Top Header: Centered Box matching Status window */}
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
        [Daily Quest: Training has arrived.]
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

      {/* Content Sections: Mental, Physical, Spiritual, To-Dos */}
      <div className="space-y-3 mb-5">
        {/* 1. MENTAL TRAINING */}
        <div className="border border-white/40 bg-[#061424]/80 rounded-[2px] overflow-hidden shadow-[inset_0_0_14px_rgba(0,212,255,0.06)]">
          <button
            onClick={() => toggleSection('mental')}
            className="w-full flex items-center justify-between p-3 sm:p-3.5 bg-white/5 hover:bg-white/10 transition-colors text-left"
          >
            <div className="flex items-center gap-2.5">
              <Brain className="w-4 h-4 text-[#9fd3ff]" />
              <span className="font-bold text-white text-xs sm:text-sm tracking-wider">
                Mental Training
              </span>
            </div>

            <div className="flex items-center gap-2.5">
              <span className={`text-xs font-bold ${mentalDone === mentalTotal && mentalTotal > 0 ? 'text-emerald-400' : 'text-[#9fd3ff]'}`}>
                [{mentalDone}/{mentalTotal}]
              </span>
              {expandedSections.mental ? (
                <ChevronUp className="w-3.5 h-3.5 text-white/50" />
              ) : (
                <ChevronDown className="w-3.5 h-3.5 text-white/50" />
              )}
            </div>
          </button>

          {expandedSections.mental && (
            <div className="p-3 border-t border-white/20 bg-[#05101d]/90 space-y-2.5">
              <div className="p-3 border border-cyan-500/30 bg-[#07172b]/80 rounded-[2px] flex items-center justify-between gap-3 shadow-[0_0_10px_rgba(0,212,255,0.1)]">
                <div className="text-left">
                  <div className="text-xs font-bold text-white tracking-wide flex items-center gap-1.5">
                    <Brain className="w-3.5 h-3.5 text-cyan-400" />
                    <span>Cognitive & Study Protocol Tasks</span>
                  </div>
                  <div className="text-[11px] text-[#9fd3ff] font-mono mt-0.5">
                    [{mentalDone}/{mentalTotal} Tasks Completed Today]
                  </div>
                </div>
                <button
                  onClick={() => {
                    systemSound.playClick();
                    navigate('/dailymental');
                  }}
                  className="py-1.5 px-4 sm:px-6 border-2 border-cyan-400 bg-cyan-950/80 hover:bg-cyan-900 text-cyan-300 hover:text-white font-mono text-xs font-bold tracking-wider rounded-[2px] shadow-[0_0_12px_rgba(0,212,255,0.3)] transition-all flex items-center justify-center gap-1.5 shrink-0"
                >
                  <span>[ ACCESS ]</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* 2. PHYSICAL TRAINING */}
        <div className="border border-white/40 bg-[#061424]/80 rounded-[2px] overflow-hidden shadow-[inset_0_0_14px_rgba(0,212,255,0.06)]">
          <button
            onClick={() => toggleSection('physical')}
            className="w-full flex items-center justify-between p-3 sm:p-3.5 bg-white/5 hover:bg-white/10 transition-colors text-left"
          >
            <div className="flex items-center gap-2.5">
              <Dumbbell className="w-4 h-4 text-[#9fd3ff]" />
              <span className="font-bold text-white text-xs sm:text-sm tracking-wider">
                Physical Training
              </span>
            </div>

            <div className="flex items-center gap-2.5">
              <span className={`text-xs font-bold ${physicalDone === physicalTotal && physicalTotal > 0 ? 'text-emerald-400' : 'text-[#9fd3ff]'}`}>
                [{physicalDone}/{physicalTotal}]
              </span>
              {expandedSections.physical ? (
                <ChevronUp className="w-3.5 h-3.5 text-white/50" />
              ) : (
                <ChevronDown className="w-3.5 h-3.5 text-white/50" />
              )}
            </div>
          </button>

          {expandedSections.physical && (
            <div className="p-3 border-t border-white/20 bg-[#05101d]/90 space-y-2.5">
              <div className="p-3 border border-cyan-500/30 bg-[#07172b]/80 rounded-[2px] flex items-center justify-between gap-3 shadow-[0_0_10px_rgba(0,212,255,0.1)]">
                <div className="text-left">
                  <div className="text-xs font-bold text-white tracking-wide flex items-center gap-1.5">
                    <Dumbbell className="w-3.5 h-3.5 text-cyan-400" />
                    <span>Kinetic Conditioning Protocols</span>
                  </div>
                  <div className="text-[11px] text-[#9fd3ff] font-mono mt-0.5">
                    [{physicalDone}/{physicalTotal} Tasks Completed Today]
                  </div>
                </div>
                <button
                  onClick={() => {
                    systemSound.playClick();
                    navigate('/dailyphysical');
                  }}
                  className="py-1.5 px-4 sm:px-6 border-2 border-cyan-400 bg-cyan-950/80 hover:bg-cyan-900 text-cyan-300 hover:text-white font-mono text-xs font-bold tracking-wider rounded-[2px] shadow-[0_0_12px_rgba(0,212,255,0.3)] transition-all flex items-center justify-center gap-1.5 shrink-0"
                >
                  <span>[ ACCESS ]</span>
                </button>
              </div>

              <div className="p-3 border border-amber-500/30 bg-[#1c1405]/70 rounded-[2px] flex items-center justify-between gap-3 shadow-[0_0_10px_rgba(245,166,35,0.12)]">
                <div className="text-left">
                  <div className="text-xs font-bold text-white tracking-wide flex items-center gap-1.5">
                    <UtensilsCrossed className="w-3.5 h-3.5 text-amber-400" />
                    <span>Nutritional Intake Protocol</span>
                  </div>
                  <div className="text-[11px] text-amber-200/80 font-mono mt-0.5">
                    [{nutritionDone}/{nutritionTotal} Intakes Logged Today]
                  </div>
                </div>
                <button
                  onClick={() => {
                    systemSound.playClick();
                    navigate('/dailynutrition');
                  }}
                  className="py-1.5 px-4 sm:px-6 border-2 border-amber-400 bg-amber-950/70 hover:bg-amber-900 text-amber-300 hover:text-white font-mono text-xs font-bold tracking-wider rounded-[2px] shadow-[0_0_12px_rgba(245,166,35,0.3)] transition-all flex items-center justify-center gap-1.5 shrink-0"
                >
                  <span>[ ACCESS ]</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* 3. SPIRITUAL TRAINING */}
        <div className="border border-white/40 bg-[#061424]/80 rounded-[2px] overflow-hidden shadow-[inset_0_0_14px_rgba(0,212,255,0.06)]">
          <button
            onClick={() => toggleSection('spiritual')}
            className="w-full flex items-center justify-between p-3 sm:p-3.5 bg-white/5 hover:bg-white/10 transition-colors text-left"
          >
            <div className="flex items-center gap-2.5">
              <Moon className="w-4 h-4 text-[#9fd3ff]" />
              <span className="font-bold text-white text-xs sm:text-sm tracking-wider">
                Spiritual Training
              </span>
            </div>

            <div className="flex items-center gap-2.5">
              <span className={`text-xs font-bold ${spiritualDone === spiritualTotal && spiritualTotal > 0 ? 'text-emerald-400' : 'text-[#9fd3ff]'}`}>
                [{spiritualDone}/{spiritualTotal}]
              </span>
              {expandedSections.spiritual ? (
                <ChevronUp className="w-3.5 h-3.5 text-white/50" />
              ) : (
                <ChevronDown className="w-3.5 h-3.5 text-white/50" />
              )}
            </div>
          </button>

          {expandedSections.spiritual && (
            <div className="p-3 border-t border-white/20 bg-[#05101d]/90 space-y-2.5">
              <div className="p-3 border border-cyan-500/30 bg-[#07172b]/80 rounded-[2px] flex items-center justify-between gap-3 shadow-[0_0_10px_rgba(0,212,255,0.1)]">
                <div className="text-left">
                  <div className="text-xs font-bold text-white tracking-wide flex items-center gap-1.5">
                    <Moon className="w-3.5 h-3.5 text-cyan-400" />
                    <span>Adhkar & Contemplation Protocols</span>
                  </div>
                  <div className="text-[11px] text-[#9fd3ff] font-mono mt-0.5">
                    [{spiritualDone}/{spiritualTotal} Tasks Completed Today]
                  </div>
                </div>
                <button
                  onClick={() => {
                    systemSound.playClick();
                    navigate('/dailyspiritual');
                  }}
                  className="py-1.5 px-4 sm:px-6 border-2 border-cyan-400 bg-cyan-950/80 hover:bg-cyan-900 text-cyan-300 hover:text-white font-mono text-xs font-bold tracking-wider rounded-[2px] shadow-[0_0_12px_rgba(0,212,255,0.3)] transition-all flex items-center justify-center gap-1.5 shrink-0"
                >
                  <span>[ ACCESS ]</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* 4. TACTICAL TO-DOS (Optional Extra) */}
        {todaysToDos.length > 0 && (
          <div className="border border-white/30 bg-[#061424]/60 rounded-[2px] overflow-hidden">
            <button
              onClick={() => toggleSection('todos')}
              className="w-full flex items-center justify-between p-3 bg-white/5 hover:bg-white/10 transition-colors text-left"
            >
              <div className="flex items-center gap-2.5">
                <ListChecks className="w-4 h-4 text-cyan-400" />
                <span className="font-bold text-white text-xs tracking-wider">
                  Tactical To-Dos
                </span>
              </div>

              <div className="flex items-center gap-2.5">
                <span className={`text-xs font-bold ${todoDone === todoTotal ? 'text-emerald-400' : 'text-cyan-300'}`}>
                  [{todoDone}/{todoTotal}]
                </span>
                {expandedSections.todos ? (
                  <ChevronUp className="w-3.5 h-3.5 text-white/50" />
                ) : (
                  <ChevronDown className="w-3.5 h-3.5 text-white/50" />
                )}
              </div>
            </button>

            {expandedSections.todos && (
              <div className="p-2 sm:p-3 border-t border-white/20 space-y-2">
                {todaysToDos.map((todo) => (
                  <div
                    key={todo.id}
                    onClick={() => handleToggleTodo(todo.id, todo.status)}
                    className="flex items-center justify-between p-2 border border-white/15 bg-white/5 hover:bg-white/10 cursor-pointer transition-all rounded-[2px] group"
                  >
                    <span className={`text-xs ${todo.status === 'completed' ? 'line-through text-gray-500' : 'text-gray-200'}`}>
                      {todo.title}
                    </span>
                    <div
                      className={`w-4 h-4 border rounded-sm flex items-center justify-center transition-all ${
                        todo.status === 'completed'
                          ? 'border-cyan-300 bg-cyan-950/90 text-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.6)]'
                          : 'border-white/40 bg-black/60 text-transparent'
                      }`}
                    >
                      <Check className="w-3 h-3 stroke-[3]" />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Warning Text: red penalty highlight */}
      <div className="text-center font-mono text-xs text-white/80 mb-5 leading-relaxed max-w-sm mx-auto">
        <div>WARNING: Failure to complete</div>
        <div>
          the daily quest will result in an appropriate{' '}
          <span className="text-red-400 font-bold tracking-wide">penalty.</span>
        </div>
      </div>

      {/* Bottom Action Button: Reward Claim */}
      <div className="flex flex-col items-center justify-center">
        <button
          onClick={handleClaimRewards}
          disabled={!allMandatoryCompleted || claimed}
          className={`w-12 h-12 border-2 rounded-[2px] flex items-center justify-center transition-all shadow-[0_0_15px_rgba(0,212,255,0.2)] ${
            claimed
              ? 'border-emerald-400/80 bg-emerald-950/60 text-emerald-300 shadow-[0_0_20px_rgba(52,211,153,0.6)] cursor-default'
              : allMandatoryCompleted
              ? 'border-white bg-[#061426] hover:bg-white/20 text-emerald-400 hover:scale-105 active:scale-95 shadow-[0_0_20px_rgba(52,211,153,0.5)] cursor-pointer'
              : 'border-white/30 bg-black/50 text-gray-500 cursor-not-allowed'
          }`}
          title={
            claimed
              ? 'Daily Protocol Rewards Claimed'
              : allMandatoryCompleted
              ? 'Claim Daily Protocol Rewards'
              : 'Complete all mandatory training goals first'
          }
        >
          <Check className="w-7 h-7 stroke-[3]" />
        </button>

        {claimed ? (
          <div className="mt-3 text-center font-mono text-xs text-emerald-400 anime-glow-text">
            REWARDS CLAIMED: STATUS RECOVERED • AP +3 • EXP +200
          </div>
        ) : allMandatoryCompleted ? (
          <div className="mt-3 text-center font-mono text-xs text-cyan-300 anime-glow-text flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
            <span>DIRECTIVES SATISFIED. INITIATE REWARD EXTRACTION.</span>
          </div>
        ) : (
          <div className="mt-2 text-center font-mono text-[11px] text-white/50">
            [{completedMandatory} of {totalMandatory} directives fulfilled]
          </div>
        )}
      </div>

      {/* Holographic Full Status Recovery Notification Modal */}
      {showRecoveryOverlay && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in font-mono">
          <div className="relative max-w-[460px] w-full bg-[#0a1b2e] border-2 border-cyan-400 p-6 sm:p-8 rounded-[4px] shadow-[0_0_50px_rgba(0,212,255,0.7),inset_0_0_30px_rgba(0,212,255,0.2)] text-white text-center space-y-4 anime-dropdown">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-cyan-950/80 border border-cyan-400/80 rounded-full text-cyan-300 text-xs font-bold tracking-wider anime-glow-text">
              <Sparkles className="w-4 h-4 text-cyan-400" />
              SYSTEM REWARD GRANTED
            </div>

            <h3 className="text-xl sm:text-2xl font-bold font-sans tracking-wide text-white anime-glow-text">
              STATUS RECOVERY APPLIED
            </h3>

            <div className="text-xs text-gray-300 space-y-2 py-2 border-y border-white/20">
              <div className="flex items-center justify-between text-cyan-200">
                <span>[FATIGUE PURGE]</span>
                <span className="font-bold text-emerald-400">FLUSHED TO 0%</span>
              </div>
              <div className="flex items-center justify-between text-cyan-200">
                <span>[HP / MP / STM]</span>
                <span className="font-bold text-cyan-300">RESTORED TO 100%</span>
              </div>
              <div className="flex items-center justify-between text-amber-200">
                <span>[HUNTER PROGRESSION]</span>
                <span className="font-bold text-amber-300">+200 EXP • +3 AP</span>
              </div>
            </div>

            <p className="text-[11px] text-white/70 italic">
              "The System acknowledges your unwavering daily discipline. Your physiological state has been fully restored."
            </p>

            <button
              onClick={() => {
                systemSound.playClick();
                setShowRecoveryOverlay(false);
              }}
              className="w-full py-2 px-4 bg-cyan-500/20 hover:bg-cyan-500/35 border-2 border-cyan-400 text-cyan-200 text-xs font-bold rounded-[2px] shadow-[0_0_15px_rgba(0,212,255,0.4)] hover:shadow-[0_0_25px_rgba(0,212,255,0.7)] hover:scale-[1.02] active:scale-[0.98] transition-all"
            >
              CONFIRM AND DISMISS
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
export default SoloDailyQuestWindow;
