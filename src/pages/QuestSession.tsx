import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  getUserProfile,
  getDailyQuests,
  completeQuest,
  toggleQuestCompletion,
  getQuestById,
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
  Plus,
  Trash2,
  Play,
  Pause,
  RotateCcw,
  Sparkles,
  Brain,
  Dumbbell,
  BookOpen,
  Moon,
  Info,
  Check,
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
        const found = id ? getQuestById(id) : null;
        if (!active) return;
        if (found) {
          setQuest(found);
        } else {
          const quests = await getDailyQuests();
          const q = quests.find((item) => item.id === id);
          setQuest(q ?? null);
        }
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
    startedAtMsRef.current = Date.now() - (timeElapsed * 1000);
  };

  const handlePause = () => {
    systemSound.playClick();
    setIsActive(false);
    startedAtMsRef.current = null;
  };

  const handleReset = () => {
    systemSound.playClick();
    setIsActive(false);
    startedAtMsRef.current = null;
    setTimeElapsed(0);
  };

  const handleToggleCheckbox = () => {
    if (!quest || !profile) return;

    systemSound.playClick();
    const nextCompleted = !quest.completed;
    toggleQuestCompletion(quest.id, nextCompleted);
    setQuest((prev) => (prev ? { ...prev, completed: nextCompleted } : null));

    if (nextCompleted) {
      systemSound.playQuestComplete();
      setIsActive(false);
      startedAtMsRef.current = null;

      const isPhysical = quest.type === 'physical';
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

      const completionRatio = isPhysical ? 1 : Math.max(0.5, Math.min(1, finalTimeElapsed / targetTimeSeconds));
      const xpEarned = quest.xp;

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
      setProfile(finalProfile);
      updateQuestCompletion();

      saveQuestAttempt({
        id: crypto.randomUUID(),
        questId: quest.id,
        userId: profile.id,
        timeTaken: isPhysical ? Math.round(totalLoggedMinutes * 60) : (finalTimeElapsed || quest.duration * 60),
        success: true,
        xpGained: xpEarned,
        timestamp: new Date().toISOString(),
      });

      toast.success('QUEST OBJECTIVE COMPLETE', {
        description: `+${xpEarned} EXP acquired for Hunter ${profile.displayName || profile.pseudo}.`,
      });

      // Chain session unlock announcement
      const titleLower = quest.title.toLowerCase();
      if (quest.id.startsWith('mental-work1') || titleLower.startsWith('work session 1') || titleLower.startsWith('study session 1')) {
        setTimeout(() => {
          systemSound.playSystemChime();
          toast.info('CHAIN PROTOCOL UNLOCKED', {
            description: 'Work Session 2 (45 Min) is now available if you wish to perform another session.',
          });
        }, 500);
      } else if (quest.id.startsWith('mental-work2') || titleLower.startsWith('work session 2') || titleLower.startsWith('study session 2')) {
        setTimeout(() => {
          systemSound.playSystemChime();
          toast.info('CHAIN PROTOCOL UNLOCKED', {
            description: 'Work Session 3 (45 Min) is now available if you wish to perform another session.',
          });
        }, 500);
      } else if (quest.id.startsWith('mental-work3') || titleLower.startsWith('work session 3') || titleLower.startsWith('study session 3')) {
        setTimeout(() => {
          systemSound.playSystemChime();
          toast.info('CHAIN PROTOCOL UNLOCKED', {
            description: 'Work Session 4 (45 Min) is now available if you wish to perform another session.',
          });
        }, 500);
      }
    } else {
      toast.info('DIRECTIVE RESET', {
        description: `Directive [${quest.title}] status toggled to incomplete.`,
      });
    }
  };

  const handleComplete = () => {
    if (!quest?.completed) {
      handleToggleCheckbox();
    } else {
      toast.info('DIRECTIVE ALREADY FULFILLED', {
        description: 'Protocol has already been completed today.',
      });
    }
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

  const getQuestIcon = () => {
    if (isPhysicalQuest) return Dumbbell;
    if (isSpiritualQuest) return Moon;
    const titleLower = quest.title.toLowerCase();
    if (titleLower.includes('reading') || quest.id.includes('book')) return BookOpen;
    return Brain;
  };
  const QuestIcon = getQuestIcon();

  return (
    <div className="min-h-screen pt-8 sm:pt-14 md:pt-16 pb-36 sm:pb-40 bg-[#071322] text-[#e5ecf4] flex flex-col system-blueprint-bg font-mono">
      <main className="max-w-[620px] w-full mx-auto px-4 py-6 sm:py-10 flex-1 flex flex-col items-center justify-center my-auto">
        {/* Solo Leveling Holographic Container matching Daily Quests page */}
        <div className="relative w-full bg-[#0a1b2e]/90 border-2 border-white/50 rounded-[4px] p-5 sm:p-8 text-white shadow-[0_0_30px_rgba(0,0,0,0.85),inset_0_0_24px_rgba(0,212,255,0.08)] backdrop-blur-md anime-dropdown font-mono">
          {/* Top Return Header Controls */}
          <div className="flex items-center justify-between pb-2 mb-3 border-b border-white/20 text-xs">
            <button
              onClick={() => {
                systemSound.playClick();
                navigate('/?view=quests');
              }}
              className="flex items-center gap-1.5 text-cyan-300/80 hover:text-white transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>[ RETURN TO DAILY QUESTS ]</span>
            </button>

            <div className="text-[11px] font-mono border border-white/30 bg-black/50 px-2 py-0.5 text-cyan-300">
              {quest.completed ? 'STATUS: COMPLETED' : isActive ? 'STATUS: IN PROGRESS' : 'STATUS: READY'}
            </div>
          </div>

          {/* Centered Solo Leveling QUEST INFO Box */}
          <div className="relative flex items-center justify-center pb-2 mb-2">
            <div className="inline-block px-8 py-1 border border-white/70 bg-[#061426]/60 shadow-[0_0_14px_rgba(0,212,255,0.35)]">
              <div className="flex items-center gap-2">
                <Info className="w-4 h-4 text-[#9fd3ff]" />
                <span className="font-mono font-extrabold tracking-[0.28em] text-base sm:text-lg text-white anime-glow-text uppercase">
                  QUEST INFO
                </span>
              </div>
            </div>
          </div>

          {/* Subtitle Line */}
          <div className="text-center font-mono text-xs sm:text-sm text-white/90 mb-1">
            [Daily Quest: {quest.title} has arrived.]
          </div>
          <div className="text-center font-mono text-[11px] text-[#9fd3ff]/80 mb-4">
            [ TARGET: {quest.duration} MIN • RANK {quest.difficulty} • +{quest.xp} EXP ]
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

          {/* Quest Directive Card with Checkbox matching Daily Quests page */}
          <div
            className={`border rounded-[2px] overflow-hidden transition-all shadow-[inset_0_0_14px_rgba(0,212,255,0.06)] mb-4 ${
              quest.completed
                ? 'border-emerald-500/40 bg-[#061825]/90'
                : 'border-white/40 bg-[#061424]/80 hover:border-cyan-400/60'
            }`}
          >
            <div className="w-full flex items-start justify-between p-3.5 sm:p-4 bg-white/5 transition-colors gap-3">
              <div className="flex items-start gap-2.5 flex-1 text-left">
                <QuestIcon className={`w-4 h-4 mt-0.5 shrink-0 ${quest.completed ? 'text-emerald-400' : 'text-[#9fd3ff]'}`} />
                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`font-bold text-xs sm:text-sm tracking-wider ${quest.completed ? 'text-emerald-300 font-mono' : 'text-white'}`}>
                      {quest.title}
                    </span>
                    <span className="text-[10px] text-cyan-300/70 font-mono">
                      [{quest.duration} MIN • +{quest.xp} EXP]
                    </span>
                    {quest.isChainBonus && (
                      <span className="text-[9px] px-1.5 py-0.5 rounded-[2px] bg-cyan-950/80 border border-cyan-400/50 text-cyan-300 font-mono tracking-wider">
                        EXTRA SESSION
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-300 leading-relaxed">
                    {quest.description}
                  </p>
                </div>
              </div>

              {/* The Signature Solo Leveling Checkbox */}
              <button
                type="button"
                onClick={handleToggleCheckbox}
                className={`w-7 h-7 shrink-0 border-2 rounded-[2px] flex items-center justify-center transition-all cursor-pointer ${
                  quest.completed
                    ? 'border-emerald-400 bg-emerald-950/60 text-emerald-300 shadow-[0_0_10px_rgba(52,211,153,0.5)]'
                    : 'border-white/30 bg-black/50 text-white/20 hover:border-cyan-400/60 hover:text-cyan-300'
                }`}
                title={
                  quest.completed
                    ? 'Directive completed. Click to toggle status.'
                    : 'Click to toggle directive completion'
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

          {/* 1. Physical Exercise Set Logger */}
          {isPhysicalQuest && (
            <div className="space-y-4 mb-5">
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
            <div className="p-4 border border-white/30 bg-[#061424]/80 rounded-[2px] space-y-4 mb-5">
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
            <div className="p-4 sm:p-5 border border-white/30 bg-[#061424]/90 rounded-[2px] text-center space-y-3 mb-5 shadow-[inset_0_0_14px_rgba(0,212,255,0.06)]">
              <div className="flex items-center justify-center gap-2 text-xs font-mono text-cyan-300">
                <Clock className="w-4 h-4 text-cyan-400" />
                <span>{isActive ? '[ PROTOCOL ACTIVE ]' : '[ STANDBY - READY TO COMMENCE ]'}</span>
              </div>

              <div className={`font-mono text-5xl sm:text-6xl font-black tracking-wider ${isOvertime ? 'text-red-400' : 'text-white anime-glow-text'}`}>
                {formatTime(timeElapsed)}
              </div>

              <div className="text-xs font-mono text-gray-400">
                {isOvertime ? 'OVERTIME ENGAGED' : `TARGET GOAL: ${formatTime(targetTime)}`}
              </div>

              <div className="flex items-center justify-center gap-2 pt-1 flex-wrap">
                {!isActive ? (
                  <button
                    onClick={handleStart}
                    className="px-4 py-2 border border-white/60 bg-white/10 hover:bg-white/20 text-white text-xs font-bold font-mono tracking-wider rounded-[2px] shadow-[0_0_12px_rgba(0,212,255,0.2)] transition-all flex items-center gap-1.5"
                  >
                    <Play className="w-3.5 h-3.5 fill-current" />
                    <span>[ {timeElapsed > 0 ? 'RESUME SESSION' : 'COMMENCE SESSION'} ]</span>
                  </button>
                ) : (
                  <button
                    onClick={handlePause}
                    className="px-4 py-2 border border-yellow-400/60 bg-yellow-950/30 hover:bg-yellow-900/50 text-yellow-300 text-xs font-bold font-mono tracking-wider rounded-[2px] transition-all flex items-center gap-1.5"
                  >
                    <Pause className="w-3.5 h-3.5" />
                    <span>[ PAUSE SESSION ]</span>
                  </button>
                )}

                {timeElapsed > 0 && (
                  <button
                    onClick={handleReset}
                    className="px-3 py-2 border border-red-500/40 bg-red-950/20 hover:bg-red-900/40 text-red-300 text-xs font-bold font-mono rounded-[2px] transition-all flex items-center gap-1"
                    title="Reset timer"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>RESET</span>
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Warning Text: red penalty highlight matching Daily Quests page */}
          <div className="text-center font-mono text-xs text-white/80 mb-5 leading-relaxed max-w-sm mx-auto">
            <div>WARNING: Failure to complete</div>
            <div>
              the daily quest will result in an appropriate{' '}
              <span className="text-red-400 font-bold tracking-wide">penalty.</span>
            </div>
          </div>

          {/* Bottom Action Button: Signature Solo Leveling Checkmark Box */}
          <div className="flex flex-col items-center justify-center mb-5">
            <button
              type="button"
              onClick={handleToggleCheckbox}
              className={`w-12 h-12 border-2 rounded-[2px] flex items-center justify-center transition-all shadow-[0_0_15px_rgba(0,212,255,0.2)] cursor-pointer ${
                quest.completed
                  ? 'border-emerald-400/80 bg-emerald-950/60 text-emerald-300 shadow-[0_0_20px_rgba(52,211,153,0.6)] hover:scale-105 active:scale-95'
                  : 'border-white/30 bg-black/50 text-gray-500 hover:border-cyan-500/40'
              }`}
              title={
                quest.completed
                  ? 'Directive verified. Click to toggle status.'
                  : 'Click to verify and complete directive'
              }
            >
              <Check className="w-7 h-7 stroke-[3]" />
            </button>

            <div className="mt-2 text-center font-mono text-[11px] text-white/50">
              {quest.completed ? (
                <span className="text-emerald-400 font-bold anime-glow-text">
                  [ DIRECTIVE FULFILLED • PROTOCOL VERIFIED ]
                </span>
              ) : (
                <span>[0 of 1 directives fulfilled]</span>
              )}
            </div>
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
