import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  getDailyQuests,
  toggleQuestCompletion,
  getUserProfile,
  saveUserProfile,
  addXP,
  getPhysicalDayPlan,
  getPhysicalQuestLog,
  savePhysicalQuestLog,
  QUESTS_UPDATED_EVENT,
  type PhysicalExerciseLog,
} from '@/lib/storage';
import { Quest, UserProfile } from '@/lib/types';
import { systemSound } from '@/lib/system-sound';
import {
  ArrowLeft,
  Dumbbell,
  Play,
  Check,
  RotateCcw,
  Calendar,
  Clock,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Brain,
  Sparkles,
  ListTodo,
} from 'lucide-react';
import { toast } from 'sonner';

export default function DailyPhysicalLab() {
  const navigate = useNavigate();
  const [profile, setProfile] = useState<UserProfile>(getUserProfile());
  const [quests, setQuests] = useState<Quest[]>([]);
  const [completedStretches, setCompletedStretches] = useState<Record<string, boolean>>({});
  const [showSchedule, setShowSchedule] = useState(false);
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

  // Parse exercise bullet items
  const exerciseList = useMemo(() => {
    const raw = activeQuest.description || currentPlan.description;
    return raw
      .split('•')
      .map((s) => s.trim())
      .filter(Boolean);
  }, [activeQuest.description, currentPlan.description]);

  // Load stretch completion state from localStorage
  useEffect(() => {
    try {
      const key = `wrp:stretches:${todayKey}:${activeQuest.id}`;
      const saved = localStorage.getItem(key);
      if (saved) {
        setCompletedStretches(JSON.parse(saved));
      }
    } catch {
      // non-fatal
    }
  }, [todayKey, activeQuest.id]);

  const toggleStretch = (name: string) => {
    systemSound.playClick();
    setCompletedStretches((prev) => {
      const next = { ...prev, [name]: !prev[name] };
      try {
        const key = `wrp:stretches:${todayKey}:${activeQuest.id}`;
        localStorage.setItem(key, JSON.stringify(next));
      } catch {
        // non-fatal
      }
      return next;
    });
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

  const stretchesFinishedCount = exerciseList.filter((e) => completedStretches[e]).length;

  // 7-day schedule breakdown
  const scheduleDays = [
    { day: 'Sunday', plan: getPhysicalDayPlan(new Date(2026, 8, 6)) },
    { day: 'Monday', plan: getPhysicalDayPlan(new Date(2026, 8, 7)) },
    { day: 'Tuesday', plan: getPhysicalDayPlan(new Date(2026, 8, 8)) },
    { day: 'Wednesday', plan: getPhysicalDayPlan(new Date(2026, 8, 9)) },
    { day: 'Thursday', plan: getPhysicalDayPlan(new Date(2026, 8, 10)) },
    { day: 'Friday', plan: getPhysicalDayPlan(new Date(2026, 8, 11)) },
    { day: 'Saturday', plan: getPhysicalDayPlan(new Date(2026, 8, 12)) },
  ];

  return (
    <div className="min-h-screen pt-6 pb-28 bg-[#071322] text-[#e5ecf4] flex flex-col system-blueprint-bg font-mono">
      <main className="max-w-[660px] w-full mx-auto px-4 py-6 flex-1 flex flex-col items-center">
        {/* Solo Leveling Holographic Container */}
        <div className="relative w-full bg-[#0a1b2e]/90 border-2 border-white/50 rounded-[4px] p-5 sm:p-8 text-white shadow-[0_0_30px_rgba(0,0,0,0.85),inset_0_0_24px_rgba(0,212,255,0.08)] backdrop-blur-md anime-dropdown font-mono space-y-5">
          {/* Top Controls: Return to All Daily Quests + Return to Status */}
          <div className="flex items-center justify-between pb-2 border-b border-white/20 text-xs">
            <button
              onClick={() => {
                systemSound.playClick();
                navigate('/daily-protocol');
              }}
              className="flex items-center gap-1.5 text-cyan-300 hover:text-white transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>[ RETURN TO ALL DAILY QUESTS ]</span>
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

          {/* Quick Lab Switcher Tabs */}
          <div className="grid grid-cols-4 gap-1.5 text-[10px] sm:text-xs">
            <button
              onClick={() => {
                systemSound.playClick();
                navigate('/daily-protocol');
              }}
              className="py-1.5 px-2 border border-white/30 bg-[#061424]/90 hover:bg-white/10 text-white/70 text-center transition-all rounded-[2px]"
            >
              [ ALL ]
            </button>
            <button
              className="py-1.5 px-2 border-2 border-cyan-400 bg-cyan-950/60 text-cyan-300 font-bold text-center shadow-[0_0_10px_rgba(0,212,255,0.25)] rounded-[2px]"
            >
              [ PHYSICAL ]
            </button>
            <button
              onClick={() => {
                systemSound.playClick();
                navigate('/daily-protocol/mental');
              }}
              className="py-1.5 px-2 border border-white/30 bg-[#061424]/90 hover:bg-white/10 text-white/70 text-center transition-all rounded-[2px]"
            >
              [ MENTAL ]
            </button>
            <button
              onClick={() => {
                systemSound.playClick();
                navigate('/daily-protocol/spiritual');
              }}
              className="py-1.5 px-2 border border-white/30 bg-[#061424]/90 hover:bg-white/10 text-white/70 text-center transition-all rounded-[2px]"
            >
              [ SPIRITUAL ]
            </button>
          </div>

          {/* Header Title in Solo Leveling System Frame */}
          <div className="text-center">
            <div className="inline-block px-8 py-1.5 border border-white/70 bg-[#061426]/60 shadow-[0_0_14px_rgba(0,212,255,0.35)]">
              <h1 className="font-mono font-extrabold tracking-[0.22em] text-sm sm:text-base text-white anime-glow-text uppercase">
                [ DAILY PROTOCOL: PHYSICAL LAB ]
              </h1>
            </div>
            <p className="text-[11px] sm:text-xs text-white/80 mt-2">
              TARGET: DAILY KINETIC CONDITIONING • SYSTEM SYNCHRONIZATION
            </p>
          </div>

          {/* Today's Active Physical Quest Card (EXACT match to user's screenshot) */}
          <div className="border border-white/40 bg-[#061424]/90 rounded-[2px] p-4 sm:p-5 shadow-[inset_0_0_14px_rgba(0,212,255,0.06)] space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <Dumbbell className="w-4 h-4 text-cyan-400 shrink-0" />
                  <h2 className="text-sm sm:text-base font-bold text-white tracking-wide">
                    {activeQuest.title}
                  </h2>
                </div>
                <div className="text-[11px] text-[#9fd3ff] font-mono">
                  [ DURATION: {activeQuest.duration} MIN | DIFFICULTY: RANK {activeQuest.difficulty} | REWARD: +{activeQuest.xp} EXP ]
                </div>
              </div>

              {/* Action Buttons: Play + Checkbox */}
              <div className="flex items-center gap-2 shrink-0 pt-0.5">
                <button
                  onClick={() => {
                    systemSound.playClick();
                    navigate(`/quest/${activeQuest.id}`);
                  }}
                  className="p-2 border border-white/40 bg-white/5 hover:border-cyan-300 hover:bg-cyan-950/40 text-cyan-300 transition-all rounded-[2px] shadow-[0_0_10px_rgba(0,212,255,0.2)]"
                  title="Launch active timer & set logger"
                >
                  <Play className="w-4 h-4 fill-current" />
                </button>

                <button
                  onClick={handleToggleQuest}
                  className={`w-8 h-8 border-2 rounded-[2px] flex items-center justify-center transition-all ${
                    activeQuest.completed
                      ? 'border-emerald-400 bg-emerald-950/60 text-emerald-300 shadow-[0_0_12px_rgba(52,211,153,0.5)]'
                      : 'border-white/50 bg-black/50 hover:border-cyan-300'
                  }`}
                  title={activeQuest.completed ? 'Mark incomplete' : 'Mark complete'}
                >
                  {activeQuest.completed && <Check className="w-5 h-5 stroke-[3]" />}
                </button>
              </div>
            </div>

            {/* Description Text (matching screenshot style) */}
            <p className="text-xs sm:text-[13px] text-gray-300 leading-relaxed font-mono whitespace-pre-line border-t border-white/15 pt-3">
              {activeQuest.description}
            </p>
          </div>

          {/* Interactive Movement Checklist */}
          <div className="border border-white/30 bg-[#061424]/80 rounded-[2px] p-4 space-y-3">
            <div className="flex items-center justify-between border-b border-white/20 pb-2 text-xs">
              <span className="font-bold text-white tracking-wider flex items-center gap-1.5">
                <ListTodo className="w-3.5 h-3.5 text-cyan-400" />
                [ INDIVIDUAL MOVEMENT CHECKLIST ]
              </span>
              <span className="text-cyan-300 font-bold">
                {stretchesFinishedCount} / {exerciseList.length} COMPLETED
              </span>
            </div>

            {/* Progress bar */}
            <div className="w-full bg-black/60 h-2 border border-white/20 rounded-[2px] overflow-hidden">
              <div
                className="h-full bg-cyan-400 transition-all duration-300 shadow-[0_0_8px_rgba(0,212,255,0.6)]"
                style={{
                  width: `${exerciseList.length > 0 ? (stretchesFinishedCount / exerciseList.length) * 100 : 0}%`,
                }}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
              {exerciseList.map((exercise, idx) => {
                const isDone = Boolean(completedStretches[exercise]);
                return (
                  <button
                    key={`${exercise}-${idx}`}
                    onClick={() => toggleStretch(exercise)}
                    className={`flex items-center gap-2 p-2 text-left border rounded-[2px] transition-all text-xs ${
                      isDone
                        ? 'border-emerald-500/50 bg-emerald-950/30 text-emerald-300 line-through'
                        : 'border-white/20 bg-black/40 hover:border-cyan-400/60 hover:bg-cyan-950/20 text-gray-200'
                    }`}
                  >
                    <div
                      className={`w-3.5 h-3.5 rounded-[1px] border flex items-center justify-center shrink-0 ${
                        isDone ? 'border-emerald-400 bg-emerald-500/30 text-emerald-300' : 'border-white/40'
                      }`}
                    >
                      {isDone && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                    </div>
                    <span className="truncate">{exercise}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Direct Session Launcher CTA */}
          <div className="flex gap-2">
            <button
              onClick={() => {
                systemSound.playClick();
                navigate(`/quest/${activeQuest.id}`);
              }}
              className="flex-1 py-3 border border-cyan-400 bg-cyan-950/40 hover:bg-cyan-900/60 text-cyan-300 font-bold text-xs flex items-center justify-center gap-2 rounded-[2px] shadow-[0_0_12px_rgba(0,212,255,0.2)] transition-all"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              [ COMMENCE FULL TIMED PROTOCOL SESSION ]
            </button>
          </div>

          {/* 7-Day Protocol Schedule Accordion */}
          <div className="border border-white/30 bg-[#061424]/70 rounded-[2px] overflow-hidden">
            <button
              onClick={() => {
                systemSound.playClick();
                setShowSchedule(!showSchedule);
              }}
              className="w-full flex items-center justify-between p-3 bg-white/5 hover:bg-white/10 transition-colors text-left text-xs"
            >
              <span className="font-bold text-white flex items-center gap-2">
                <Calendar className="w-3.5 h-3.5 text-cyan-400" />
                [ 7-DAY PHYSICAL PROTOCOL SCHEDULE ]
              </span>
              {showSchedule ? <ChevronUp className="w-4 h-4 text-white/50" /> : <ChevronDown className="w-4 h-4 text-white/50" />}
            </button>

            {showSchedule && (
              <div className="p-3 border-t border-white/20 space-y-2 text-xs">
                {scheduleDays.map(({ day, plan }) => {
                  const isCurrent = day.toLowerCase() === today.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
                  return (
                    <div
                      key={day}
                      className={`p-2.5 border rounded-[2px] transition-all ${
                        isCurrent
                          ? 'border-cyan-400 bg-cyan-950/40 text-white shadow-[0_0_10px_rgba(0,212,255,0.15)]'
                          : 'border-white/15 bg-black/40 text-gray-300'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className={`font-bold ${isCurrent ? 'text-cyan-300' : 'text-white'}`}>
                          {day} {isCurrent && '★ (TODAY)'}
                        </span>
                        <span className="text-[11px] text-gray-400">
                          {plan.duration}m | +{plan.xp}xp
                        </span>
                      </div>
                      <div className="text-[11px] text-[#9fd3ff] font-semibold mb-0.5">{plan.title}</div>
                      <div className="text-[11px] text-gray-400 leading-relaxed truncate">{plan.description}</div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* System Footer Note */}
          <div className="p-3 border border-white/20 bg-black/40 text-[11px] text-gray-400 leading-relaxed">
            <span className="text-cyan-300 font-bold block mb-0.5">※ SYSTEM NOTICE:</span>
            Physical protocols adapt automatically to your hunter rank and daily training cycle. Hidden physical attributes (STR, AGI, VIT) accumulate and unlock on level progression.
          </div>
        </div>
      </main>
    </div>
  );
}
