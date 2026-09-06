import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  getUserProfile,
  getDailyQuests,
  completeQuest,
  saveUserProfile,
  addXP,
  saveQuestAttempt,
  QUESTS_UPDATED_EVENT,
  getPhysicalQuestLog,
  savePhysicalQuestLog,
  type PhysicalExerciseLog,
  type PhysicalLogRowKind,
  type PhysicalSetLog,
} from '@/lib/storage';
import { Quest, UserProfile, Attributes } from '@/lib/types';
import { scaleHiddenRewards } from '@/lib/attribute-scaling';
import { updateQuestCompletion } from '@/lib/achievements';
import { systemSound } from '@/lib/system-sound';
import {
  ArrowLeft,
  Clock,
  CheckCircle2,
  Plus,
  Trash2,
  Play,
  RotateCcw,
  Sparkles,
  Brain,
  Dumbbell,
  ExternalLink,
} from 'lucide-react';
import { toast } from 'sonner';

const parsePhysicalExercises = (description: string): string[] => {
  const trimmed = description.trim();
  if (!trimmed) return [];
  if (trimmed.includes('•')) {
    return trimmed
      .split('•')
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return [trimmed];
};

const inferKind = (exercise: string): PhysicalLogRowKind => {
  const x = exercise.toLowerCase();
  if (x.includes('jog') || x.includes('run') || x.includes('km') || x.includes('cardio')) return 'cardio';
  if (x.includes('stretch') || x.includes('pose') || x.includes('mobility') || x.includes('flow')) return 'flexibility';
  return 'strength';
};

const buildDefaultPhysicalRows = (description: string): PhysicalExerciseLog[] =>
  parsePhysicalExercises(description).map((exercise) => {
    const kind = inferKind(exercise);
    return {
      exercise,
      kind,
      sets: kind === 'strength' ? [{ reps: '', weightKg: '' }] : undefined,
      timeMinutes: kind !== 'strength' ? '' : undefined,
      notes: '',
    };
  });

const QuestSession = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [quest, setQuest] = useState<Quest | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [timeElapsed, setTimeElapsed] = useState(0);
  const [isActive, setIsActive] = useState(false);
  const startedAtMsRef = useRef<number | null>(null);
  const [physicalLogRows, setPhysicalLogRows] = useState<PhysicalExerciseLog[]>([]);

  // Spiritual / Contemplation specific state
  const [beadCount, setBeadCount] = useState(0);
  const [reflectionNote, setReflectionNote] = useState('');

  const isPhysicalQuest = quest?.type === 'physical';
  const isMentalQuest = quest?.type === 'mental';
  const isSpiritualQuest = quest?.type === 'social' || (quest?.id ? quest.id.startsWith('spiritual') : false);
  const todayKey = new Date().toISOString().slice(0, 10);

  useEffect(() => {
    let active = true;

    const loadQuest = async () => {
      try {
        const quests = await getDailyQuests();
        if (!active) return;
        const foundQuest = quests.find((q) => q.id === id);
        setQuest(foundQuest ?? null);
        setProfile(getUserProfile());
      } catch (error) {
        console.error('Failed to load quest', error);
      }
    };

    loadQuest();

    const handleQuestUpdate = () => {
      loadQuest();
    };

    window.addEventListener(QUESTS_UPDATED_EVENT, handleQuestUpdate);
    return () => {
      active = false;
      window.removeEventListener(QUESTS_UPDATED_EVENT, handleQuestUpdate);
    };
  }, [id]);

  useEffect(() => {
    if (!quest || quest.type !== 'physical') return;
    const saved = getPhysicalQuestLog(quest.id, todayKey);
    if (saved && saved.length > 0) {
      setPhysicalLogRows(saved);
      return;
    }
    setPhysicalLogRows(buildDefaultPhysicalRows(quest.description));
  }, [quest, todayKey]);

  useEffect(() => {
    if (!quest || quest.type !== 'physical') return;
    if (physicalLogRows.length === 0) return;
    savePhysicalQuestLog(quest.id, todayKey, physicalLogRows);
  }, [quest, todayKey, physicalLogRows]);

  useEffect(() => {
    if (!isActive) return;
    if (quest?.type === 'physical') return;
    const startedAtMs = startedAtMsRef.current;
    if (!startedAtMs) return;

    const computeAndSet = () => {
      const elapsedSeconds = Math.max(0, Math.floor((Date.now() - startedAtMs) / 1000));
      setTimeElapsed(elapsedSeconds);
    };

    computeAndSet();
    const intervalId = window.setInterval(computeAndSet, 500);

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') computeAndSet();
    };
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      clearInterval(intervalId);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [isActive, quest?.type]);

  const handleStart = () => {
    if (quest?.type === 'physical') return;
    systemSound.playSystemChime();
    setIsActive(true);
    startedAtMsRef.current = Date.now();
    setTimeElapsed(0);
  };

  const handleComplete = () => {
    if (!quest || !profile) return;

    const isPhysical = quest.type === 'physical';
    setIsActive(false);

    const finalTimeElapsed = isPhysical
      ? 0
      : startedAtMsRef.current !== null
        ? Math.max(0, Math.floor((Date.now() - startedAtMsRef.current) / 1000))
        : timeElapsed;

    const targetTimeSeconds = Math.max(1, quest.duration * 60);

    const totalLoggedMinutes = isPhysical
      ? physicalLogRows.reduce((sum, row) => {
          if (!row || typeof row !== 'object') return sum;
          if (row.kind !== 'cardio' && row.kind !== 'flexibility') return sum;
          const v = Number.parseFloat(row.timeMinutes || '');
          return Number.isFinite(v) && v > 0 ? sum + v : sum;
        }, 0)
      : 0;

    const completionRatio = isPhysical ? 1 : Math.min(1, finalTimeElapsed / targetTimeSeconds);
    const rawXp = quest.xp * completionRatio;
    const xpEarned = isPhysical ? quest.xp : finalTimeElapsed > 0 ? Math.max(1, Math.round(rawXp)) : 0;

    const HIDDEN_REWARD_MULTIPLIER = 0.4;
    const MIN_RATIO_FOR_HIDDEN_REWARDS = 0.3;
    const scaledHiddenRewards: Partial<Attributes> = scaleHiddenRewards(
      profile,
      quest.hiddenRewards,
      {
        completionRatio,
        baseMultiplier: HIDDEN_REWARD_MULTIPLIER,
        minCompletionRatio: MIN_RATIO_FOR_HIDDEN_REWARDS,
      }
    );

    const withHidden: UserProfile = {
      ...profile,
      accumulatedPoints: { ...profile.accumulatedPoints },
    };
    Object.keys(scaledHiddenRewards).forEach((key) => {
      const attr = key as keyof Attributes;
      withHidden.accumulatedPoints[attr] += scaledHiddenRewards[attr] || 0;
    });

    const finalProfile = addXP(withHidden, xpEarned);

    saveUserProfile(finalProfile);
    completeQuest(quest.id);
    updateQuestCompletion();

    saveQuestAttempt({
      id: crypto.randomUUID(),
      questId: quest.id,
      userId: profile.id,
      timeTaken: isPhysical ? Math.round(totalLoggedMinutes * 60) : finalTimeElapsed,
      success: true,
      xpGained: xpEarned,
      timestamp: new Date().toISOString(),
    });

    systemSound.playQuestComplete();

    toast.success('QUEST OBJECTIVE COMPLETE', {
      description: `+${xpEarned} EXP acquired for Hunter ${profile.displayName || profile.pseudo}.`,
    });

    startedAtMsRef.current = null;
    setTimeout(() => navigate('/?view=quests'), 1200);
  };

  if (!quest || !profile) {
    return (
      <div className="min-h-screen pt-6 pb-28 bg-[#071322] text-[#e5ecf4] flex flex-col system-blueprint-bg font-mono">
        <main className="max-w-3xl mx-auto px-4 py-16 flex-1 flex flex-col items-center justify-center">
          <div className="p-6 border border-white/40 bg-[#061424]/90 text-center space-y-3">
            <p className="text-sm font-bold text-white tracking-widest">[ SYSTEM: QUEST DATA NOT LOCATED ]</p>
            <button
              onClick={() => navigate('/?view=quests')}
              className="px-4 py-2 border border-white/50 bg-white/10 hover:bg-white/20 text-xs text-white transition-all"
            >
              [ RETURN TO DAILY QUESTS ]
            </button>
          </div>
        </main>
      </div>
    );
  }

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const targetTime = quest.duration * 60;
  const isOvertime = timeElapsed > targetTime;

  const updatePhysicalNotes = (rowIndex: number, value: string) => {
    setPhysicalLogRows((prev) => prev.map((row, idx) => (idx === rowIndex ? { ...row, notes: value } : row)));
  };

  const updatePhysicalTimeMinutes = (rowIndex: number, value: string) => {
    setPhysicalLogRows((prev) =>
      prev.map((row, idx) => (idx === rowIndex ? { ...row, timeMinutes: value } : row))
    );
  };

  const updateSet = (rowIndex: number, setIndex: number, patch: Partial<PhysicalSetLog>) => {
    setPhysicalLogRows((prev) =>
      prev.map((row, idx) => {
        if (idx !== rowIndex) return row;
        const sets = Array.isArray(row.sets) ? row.sets.slice() : [];
        const current = sets[setIndex] ?? { reps: '', weightKg: '' };
        sets[setIndex] = { ...current, ...patch };
        return { ...row, sets };
      })
    );
  };

  const addSet = (rowIndex: number) => {
    systemSound.playClick();
    setPhysicalLogRows((prev) =>
      prev.map((row, idx) => {
        if (idx !== rowIndex) return row;
        const sets = Array.isArray(row.sets) ? row.sets.slice() : [];
        sets.push({ reps: '', weightKg: '' });
        return { ...row, sets };
      })
    );
  };

  const removeSet = (rowIndex: number, setIndex: number) => {
    systemSound.playClick();
    setPhysicalLogRows((prev) =>
      prev.map((row, idx) => {
        if (idx !== rowIndex) return row;
        const sets = Array.isArray(row.sets) ? row.sets.slice() : [];
        sets.splice(setIndex, 1);
        return { ...row, sets: sets.length > 0 ? sets : [{ reps: '', weightKg: '' }] };
      })
    );
  };

  const categoryLabel = isPhysicalQuest
    ? 'PHYSICAL CONDITIONING'
    : isMentalQuest
      ? 'COGNITIVE PROTOCOL'
      : 'SPIRITUAL & PERCEPTION PROTOCOL';

  return (
    <div className="min-h-screen pt-6 pb-28 bg-[#071322] text-[#e5ecf4] flex flex-col system-blueprint-bg font-mono">
      <main className="max-w-3xl mx-auto w-full px-4 py-4 flex-1 space-y-5">
        {/* Navigation Bar */}
        <div className="flex items-center justify-between">
          <button
            onClick={() => {
              systemSound.playClick();
              navigate('/?view=quests');
            }}
            className="flex items-center gap-2 px-3 py-1.5 border border-white/50 bg-[#061426]/80 text-[#9fd3ff] text-xs font-mono hover:bg-white/10 hover:border-white transition-all shadow-[0_0_10px_rgba(0,212,255,0.2)]"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>[ RETURN TO DAILY QUESTS ]</span>
          </button>

          <span className="text-[11px] font-mono border border-white/30 bg-black/50 px-2 py-0.5 text-cyan-300">
            {quest.completed ? 'STATUS: COMPLETED' : isActive ? 'STATUS: IN PROGRESS' : 'STATUS: READY'}
          </span>
        </div>

        {/* Central Card Shell */}
        <div className="relative bg-[#0a1b2e]/90 border-2 border-white/50 rounded-[4px] p-5 sm:p-7 text-white shadow-[0_0_30px_rgba(0,0,0,0.85),inset_0_0_24px_rgba(0,212,255,0.08)] backdrop-blur-md anime-dropdown font-mono space-y-5">
          {/* Header Tag */}
          <div className="text-center">
            <div className="inline-block px-8 py-1 border border-white/70 bg-[#061426]/60 shadow-[0_0_14px_rgba(0,212,255,0.35)]">
              <h2 className="font-mono font-extrabold tracking-[0.25em] text-sm sm:text-base text-white anime-glow-text uppercase">
                [ {categoryLabel} ]
              </h2>
            </div>
          </div>

          {/* Subtitle Line */}
          <div className="text-center text-xs text-white/90">
            [ TARGET: {quest.duration} MIN | DIFFICULTY: RANK {quest.difficulty} | REWARD: +{quest.xp} EXP ]
          </div>

          {/* Quest Title & Description */}
          <div className="p-4 border border-white/30 bg-[#061424]/90 rounded-[2px] space-y-2 shadow-[inset_0_0_14px_rgba(0,212,255,0.06)]">
            <h1 className="text-base sm:text-lg font-bold text-white anime-glow-text tracking-wide">
              {quest.title}
            </h1>
            <p className="text-xs sm:text-sm text-gray-300 whitespace-pre-line leading-relaxed">
              {quest.description}
            </p>
          </div>

          {/* Direct Training Lab Shortcut Banner */}
          {isPhysicalQuest && (
            <div className="flex items-center justify-between p-2.5 border border-cyan-400/50 bg-cyan-950/30 rounded-[2px] text-xs">
              <div className="flex items-center gap-2">
                <Dumbbell className="w-4 h-4 text-cyan-400" />
                <span className="text-[#9fd3ff] font-bold">Physical Conditioning Lab & Workout Gates</span>
              </div>
              <button
                onClick={() => {
                  systemSound.playClick();
                  navigate('/physical-lab');
                }}
                className="px-2.5 py-1 border border-cyan-400 text-cyan-300 hover:bg-cyan-400/20 text-[10px] font-bold tracking-wider flex items-center gap-1"
              >
                OPEN LAB <ExternalLink className="w-3 h-3" />
              </button>
            </div>
          )}

          {isMentalQuest && (
            <div className="flex items-center justify-between p-2.5 border border-cyan-400/50 bg-cyan-950/30 rounded-[2px] text-xs">
              <div className="flex items-center gap-2">
                <Brain className="w-4 h-4 text-cyan-400" />
                <span className="text-[#9fd3ff] font-bold">Cognitive Trial Chamber & Minigames</span>
              </div>
              <button
                onClick={() => {
                  systemSound.playClick();
                  navigate('/mental-lab');
                }}
                className="px-2.5 py-1 border border-cyan-400 text-cyan-300 hover:bg-cyan-400/20 text-[10px] font-bold tracking-wider flex items-center gap-1"
              >
                OPEN LAB <ExternalLink className="w-3 h-3" />
              </button>
            </div>
          )}

          {isSpiritualQuest && (
            <div className="flex items-center justify-between p-2.5 border border-cyan-400/50 bg-cyan-950/30 rounded-[2px] text-xs">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-cyan-400" />
                <span className="text-[#9fd3ff] font-bold">Social Dynamics & Perception Lab</span>
              </div>
              <button
                onClick={() => {
                  systemSound.playClick();
                  navigate('/social-lab');
                }}
                className="px-2.5 py-1 border border-cyan-400 text-cyan-300 hover:bg-cyan-400/20 text-[10px] font-bold tracking-wider flex items-center gap-1"
              >
                OPEN LAB <ExternalLink className="w-3 h-3" />
              </button>
            </div>
          )}

          {/* 1. Physical Exercise Set Logger */}
          {isPhysicalQuest && (
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-white/20 pb-2">
                <span className="text-xs font-bold text-white tracking-wider">
                  [ REPS & SETS PROTOCOL LOG ]
                </span>
                <span className="text-[11px] text-gray-400">{todayKey}</span>
              </div>

              <div className="space-y-3">
                {physicalLogRows.map((row, idx) => (
                  <div key={`${row.exercise}-${idx}`} className="p-3 border border-white/30 bg-[#061424]/80 rounded-[2px]">
                    <div className="font-bold text-xs sm:text-sm text-white mb-2 tracking-wide text-[#9fd3ff]">
                      {row.exercise}
                    </div>

                    {row.kind === 'strength' ? (
                      <div className="space-y-2">
                        <div className="space-y-1.5">
                          {(row.sets && row.sets.length > 0 ? row.sets : [{ reps: '', weightKg: '' }]).map((set, sIdx) => (
                            <div key={sIdx} className="flex items-center gap-2 text-xs font-mono">
                              <span className="text-cyan-300 font-bold w-12 shrink-0">
                                SET {sIdx + 1}:
                              </span>
                              <input
                                value={set.reps}
                                onChange={(e) => updateSet(idx, sIdx, { reps: e.target.value })}
                                placeholder="Reps"
                                className="bg-black/60 border border-white/30 px-2 py-1 text-white w-20 focus:border-cyan-400 outline-none rounded-[2px]"
                              />
                              <input
                                value={set.weightKg}
                                onChange={(e) => updateSet(idx, sIdx, { weightKg: e.target.value })}
                                placeholder="Kg / Lbs"
                                className="bg-black/60 border border-white/30 px-2 py-1 text-white w-20 focus:border-cyan-400 outline-none rounded-[2px]"
                              />
                              <button
                                type="button"
                                onClick={() => removeSet(idx, sIdx)}
                                className="ml-auto p-1 text-red-400 hover:text-red-300 border border-red-500/40 hover:bg-red-950/40 rounded-[2px]"
                                title="Remove set"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ))}
                        </div>

                        <div className="flex items-center gap-2 pt-1">
                          <button
                            type="button"
                            onClick={() => addSet(idx)}
                            className="px-2.5 py-1 text-xs border border-white/40 bg-white/10 hover:bg-white/20 text-white flex items-center gap-1 rounded-[2px]"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            ADD SET
                          </button>
                          <input
                            value={row.notes}
                            onChange={(e) => updatePhysicalNotes(idx, e.target.value)}
                            placeholder="Hunter execution notes..."
                            className="bg-black/60 border border-white/30 px-2.5 py-1 text-xs text-white flex-1 focus:border-cyan-400 outline-none rounded-[2px]"
                          />
                        </div>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs font-mono">
                        <input
                          value={row.timeMinutes ?? ''}
                          onChange={(e) => updatePhysicalTimeMinutes(idx, e.target.value)}
                          placeholder="Minutes taken"
                          className="bg-black/60 border border-white/30 px-2 py-1.5 text-white outline-none focus:border-cyan-400 rounded-[2px]"
                        />
                        <input
                          value={row.notes}
                          onChange={(e) => updatePhysicalNotes(idx, e.target.value)}
                          placeholder="Pace / notes..."
                          className="bg-black/60 border border-white/30 px-2 py-1.5 text-white sm:col-span-2 outline-none focus:border-cyan-400 rounded-[2px]"
                        />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 2. Spiritual / Contemplation Specific Counter */}
          {isSpiritualQuest && (
            <div className="p-4 border border-white/30 bg-[#061424]/80 rounded-[2px] space-y-4">
              <div className="flex items-center justify-between border-b border-white/20 pb-2">
                <span className="text-xs font-bold text-white tracking-wider">
                  [ CONTEMPLATION & REPETITION COUNTER ]
                </span>
                <span className="text-[11px] text-cyan-300 font-bold">
                  COUNT: {beadCount}
                </span>
              </div>

              <div className="flex flex-col sm:flex-row items-center justify-center gap-4 py-2">
                <button
                  onClick={() => {
                    systemSound.playClick();
                    setBeadCount((c) => c + 1);
                  }}
                  className="w-28 h-28 rounded-full border-2 border-cyan-400 bg-cyan-950/40 hover:bg-cyan-900/60 active:scale-95 transition-all flex flex-col items-center justify-center shadow-[0_0_20px_rgba(0,212,255,0.25)] text-center cursor-pointer"
                >
                  <span className="text-2xl font-black text-white font-mono">{beadCount}</span>
                  <span className="text-[9px] text-cyan-300 font-bold uppercase tracking-widest mt-1">TAP COUNT</span>
                </button>

                <div className="flex flex-col gap-2 w-full sm:w-auto">
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        systemSound.playClick();
                        setBeadCount((c) => c + 33);
                      }}
                      className="px-3 py-1.5 border border-white/30 bg-white/5 hover:bg-white/10 text-xs text-white rounded-[2px]"
                    >
                      +33
                    </button>
                    <button
                      onClick={() => {
                        systemSound.playClick();
                        setBeadCount((c) => c + 100);
                      }}
                      className="px-3 py-1.5 border border-white/30 bg-white/5 hover:bg-white/10 text-xs text-white rounded-[2px]"
                    >
                      +100
                    </button>
                    <button
                      onClick={() => {
                        systemSound.playClick();
                        setBeadCount(0);
                      }}
                      className="px-3 py-1.5 border border-red-500/40 bg-red-950/20 text-xs text-red-300 hover:bg-red-900/30 flex items-center gap-1 rounded-[2px]"
                    >
                      <RotateCcw className="w-3 h-3" /> RESET
                    </button>
                  </div>
                  <input
                    value={reflectionNote}
                    onChange={(e) => setReflectionNote(e.target.value)}
                    placeholder="Contemplation or reflection note..."
                    className="bg-black/60 border border-white/30 px-3 py-1.5 text-xs text-white focus:border-cyan-400 outline-none rounded-[2px]"
                  />
                </div>
              </div>
            </div>
          )}

          {/* 3. Stopwatch Timer (Non-Physical) */}
          {!isPhysicalQuest && (
            <div className="p-6 border border-white/30 bg-[#061424]/90 rounded-[2px] text-center space-y-3">
              <div className="flex items-center justify-center gap-2 text-xs font-mono text-cyan-300">
                <Clock className="w-4 h-4 text-cyan-400" />
                <span>{isActive ? '[ PROTOCOL ACTIVE ]' : '[ STANDBY - READY TO COMMENCE ]'}</span>
              </div>

              <div className={`font-mono text-5xl sm:text-6xl font-black tracking-wider ${isOvertime ? 'text-red-400' : 'text-white anime-glow-text'}`}>
                {formatTime(timeElapsed)}
              </div>

              {isActive && (
                <div className="text-xs font-mono text-gray-400">
                  {isOvertime ? 'OVERTIME ENGAGED' : `TARGET GOAL: ${formatTime(targetTime)}`}
                </div>
              )}
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            {!isPhysicalQuest && !isActive && !quest.completed && (
              <button
                onClick={handleStart}
                className="w-full py-3.5 text-xs font-bold flex items-center justify-center gap-2 border border-white/60 bg-white/10 hover:bg-white/20 text-white tracking-wider rounded-[2px] shadow-[0_0_12px_rgba(0,212,255,0.2)] transition-all"
              >
                <Play className="w-4 h-4 fill-current" />
                [ COMMENCE QUEST SESSION ]
              </button>
            )}

            {(isPhysicalQuest ? !quest.completed : isActive) && (
              <button
                onClick={handleComplete}
                className="w-full py-3.5 text-xs font-bold flex items-center justify-center gap-2 border-2 border-emerald-400/80 bg-emerald-950/50 text-emerald-300 hover:bg-emerald-900/60 tracking-wider rounded-[2px] shadow-[0_0_15px_rgba(52,211,153,0.3)] transition-all"
              >
                <CheckCircle2 className="w-4 h-4" />
                [ CONFIRM PROTOCOL COMPLETION ]
              </button>
            )}

            {quest.completed && (
              <div className="w-full py-3 text-center text-xs font-bold text-emerald-400 border border-emerald-400/40 bg-emerald-950/20 rounded-[2px]">
                PROTOCOL ALREADY COMPLETED FOR TODAY
              </div>
            )}
          </div>

          {/* System Warning Footer */}
          <div className="p-3 border border-white/20 bg-black/40 text-[11px] font-mono text-gray-400">
            <span className="text-cyan-300 font-bold block mb-0.5">
              ※ SYSTEM DIRECTIVE:
            </span>
            Accurate logging directly conditions hunter stats. All hidden attribute potential will be applied upon subsequent hunter level advancement.
          </div>
        </div>
      </main>
    </div>
  );
};

export default QuestSession;
