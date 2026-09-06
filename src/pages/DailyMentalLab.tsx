import { useState, useEffect, useMemo, useRef } from 'react';
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
  Brain,
  Play,
  Pause,
  RotateCcw,
  Check,
  Clock,
  BookOpen,
  Sparkles,
  Dumbbell,
} from 'lucide-react';
import { toast } from 'sonner';

export default function DailyMentalLab() {
  const navigate = useNavigate();
  const [profile, setProfile] = useState<UserProfile>(getUserProfile());
  const [quests, setQuests] = useState<Quest[]>([]);

  // Focus Timer state
  const [timerDuration, setTimerDuration] = useState(25 * 60); // 25 min default
  const [timeRemaining, setTimeRemaining] = useState(25 * 60);
  const [timerActive, setTimerActive] = useState(false);
  const timerEndRef = useRef<number | null>(null);

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

  // Focus timer effect
  useEffect(() => {
    if (!timerActive) return;

    const interval = setInterval(() => {
      if (!timerEndRef.current) return;
      const remaining = Math.max(0, Math.ceil((timerEndRef.current - Date.now()) / 1000));
      setTimeRemaining(remaining);

      if (remaining === 0) {
        setTimerActive(false);
        timerEndRef.current = null;
        systemSound.playLevelUp();
        toast.success('STUDY PROTOCOL INTERVAL CONCLUDED', {
          description: 'Cognitive focus period completed. Log your quest progress.',
        });
      }
    }, 500);

    return () => clearInterval(interval);
  }, [timerActive]);

  const startTimer = (mins: number) => {
    systemSound.playSystemChime();
    setTimerDuration(mins * 60);
    setTimeRemaining(mins * 60);
    timerEndRef.current = Date.now() + mins * 60 * 1000;
    setTimerActive(true);
  };

  const pauseTimer = () => {
    systemSound.playClick();
    setTimerActive(false);
    timerEndRef.current = null;
  };

  const resumeTimer = () => {
    systemSound.playClick();
    timerEndRef.current = Date.now() + timeRemaining * 1000;
    setTimerActive(true);
  };

  const resetTimer = () => {
    systemSound.playClick();
    setTimerActive(false);
    timerEndRef.current = null;
    setTimeRemaining(timerDuration);
  };

  const formatTimer = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const secs = sec % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

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
      toast.success('MENTAL PROTOCOL OBJECTIVE COMPLETE', {
        description: `+${target.xp} EXP acquired for Hunter ${profile.displayName || profile.pseudo}.`,
      });
    }
  };

  return (
    <div className="min-h-screen pt-6 pb-28 bg-[#071322] text-[#e5ecf4] flex flex-col system-blueprint-bg font-mono">
      <main className="max-w-[660px] w-full mx-auto px-4 py-6 flex-1 flex flex-col items-center">
        {/* Solo Leveling Holographic Container */}
        <div className="relative w-full bg-[#0a1b2e]/90 border-2 border-white/50 rounded-[4px] p-5 sm:p-8 text-white shadow-[0_0_30px_rgba(0,0,0,0.85),inset_0_0_24px_rgba(0,212,255,0.08)] backdrop-blur-md anime-dropdown font-mono space-y-5">
          {/* Top Controls */}
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
              onClick={() => {
                systemSound.playClick();
                navigate('/daily-protocol/physical');
              }}
              className="py-1.5 px-2 border border-white/30 bg-[#061424]/90 hover:bg-white/10 text-white/70 text-center transition-all rounded-[2px]"
            >
              [ PHYSICAL ]
            </button>
            <button
              className="py-1.5 px-2 border-2 border-cyan-400 bg-cyan-950/60 text-cyan-300 font-bold text-center shadow-[0_0_10px_rgba(0,212,255,0.25)] rounded-[2px]"
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
                [ DAILY PROTOCOL: MENTAL LAB ]
              </h1>
            </div>
            <p className="text-[11px] sm:text-xs text-white/80 mt-2">
              TARGET: COGNITIVE ACUITY • INTELLECT & PERCEPTION EXPANSION
            </p>
          </div>

          {/* Progress Header */}
          <div className="flex items-center justify-between p-3 border border-white/30 bg-[#061424]/80 rounded-[2px] text-xs">
            <span className="font-bold text-white flex items-center gap-1.5">
              <Brain className="w-4 h-4 text-cyan-400" />
              DAILY COGNITIVE PROTOCOLS
            </span>
            <span className={`font-bold ${completedCount === mentalQuests.length && mentalQuests.length > 0 ? 'text-emerald-400' : 'text-cyan-300'}`}>
              [{completedCount} / {mentalQuests.length} COMPLETED]
            </span>
          </div>

          {/* Integrated Study Session Timer */}
          <div className="p-4 border border-white/40 bg-[#061424]/90 rounded-[2px] text-center space-y-3 shadow-[inset_0_0_14px_rgba(0,212,255,0.06)]">
            <div className="flex items-center justify-between text-xs text-gray-300">
              <span className="font-bold text-cyan-300 flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" />
                [ DEEP FOCUS CHRONOMETER ]
              </span>
              <div className="flex gap-1.5">
                <button
                  onClick={() => startTimer(15)}
                  className="px-2 py-0.5 border border-white/30 hover:border-cyan-400 bg-white/5 text-[10px] text-gray-200 rounded-[2px]"
                >
                  15M
                </button>
                <button
                  onClick={() => startTimer(25)}
                  className="px-2 py-0.5 border border-white/30 hover:border-cyan-400 bg-white/5 text-[10px] text-gray-200 rounded-[2px]"
                >
                  25M
                </button>
                <button
                  onClick={() => startTimer(45)}
                  className="px-2 py-0.5 border border-white/30 hover:border-cyan-400 bg-white/5 text-[10px] text-gray-200 rounded-[2px]"
                >
                  45M
                </button>
              </div>
            </div>

            <div className="text-4xl sm:text-5xl font-black text-white font-mono anime-glow-text tracking-wider py-1">
              {formatTimer(timeRemaining)}
            </div>

            <div className="flex justify-center gap-2 text-xs">
              {!timerActive ? (
                <button
                  onClick={timeRemaining < timerDuration ? resumeTimer : () => startTimer(timerDuration / 60)}
                  className="px-4 py-1.5 border border-cyan-400 bg-cyan-950/40 hover:bg-cyan-900/60 text-cyan-300 font-bold rounded-[2px] flex items-center gap-1.5"
                >
                  <Play className="w-3 h-3 fill-current" /> START FOCUS
                </button>
              ) : (
                <button
                  onClick={pauseTimer}
                  className="px-4 py-1.5 border border-amber-400/80 bg-amber-950/40 hover:bg-amber-900/60 text-amber-300 font-bold rounded-[2px] flex items-center gap-1.5"
                >
                  <Pause className="w-3 h-3 fill-current" /> PAUSE
                </button>
              )}
              <button
                onClick={resetTimer}
                className="px-3 py-1.5 border border-white/30 hover:border-white bg-white/5 text-gray-300 rounded-[2px] flex items-center gap-1"
              >
                <RotateCcw className="w-3 h-3" /> RESET
              </button>
            </div>
          </div>

          {/* List of Mental Daily Quests */}
          <div className="space-y-2.5">
            {mentalQuests.map((quest) => (
              <div
                key={quest.id}
                className={`p-3.5 border rounded-[2px] transition-all ${
                  quest.completed
                    ? 'border-emerald-500/40 bg-emerald-950/20 shadow-[0_0_10px_rgba(52,211,153,0.15)]'
                    : 'border-white/30 bg-[#061424]/80 hover:border-cyan-400/60'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-center gap-2">
                      <BookOpen className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                      <h3 className={`text-xs sm:text-sm font-bold truncate ${quest.completed ? 'text-emerald-300 line-through' : 'text-white'}`}>
                        {quest.title}
                      </h3>
                    </div>
                    <p className="text-[11px] text-gray-300 line-clamp-2">
                      {quest.description}
                    </p>
                    <div className="flex items-center gap-3 text-[10px] text-[#9fd3ff]">
                      <span>{quest.duration} MIN</span>
                      <span>•</span>
                      <span>+{quest.xp} EXP</span>
                      <span>•</span>
                      <span>RANK {quest.difficulty}</span>
                    </div>
                  </div>

                  {/* Play & Checkbox */}
                  <div className="flex items-center gap-2 shrink-0 pt-0.5">
                    <button
                      onClick={() => {
                        systemSound.playClick();
                        navigate(`/quest/${quest.id}`);
                      }}
                      className="p-2 border border-white/40 bg-white/5 hover:border-cyan-300 hover:bg-cyan-950/40 text-cyan-300 transition-all rounded-[2px]"
                      title="Launch active timer session"
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

          {/* System Footer Note */}
          <div className="p-3 border border-white/20 bg-black/40 text-[11px] text-gray-400 leading-relaxed">
            <span className="text-cyan-300 font-bold block mb-0.5">※ SYSTEM NOTICE:</span>
            Mental training protocols feed directly into your Intelligence (INT), Wisdom (WIS), and Perception (PER) parameters. Complete all daily sessions to claim daily AP rewards.
          </div>
        </div>
      </main>
    </div>
  );
}
