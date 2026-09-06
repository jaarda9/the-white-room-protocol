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
  ArrowLeft, Clock, CheckCircle2, Plus, Trash2,
  AlertTriangle, Shield, Play, Sparkles, Award
} from 'lucide-react';
import { toast } from 'sonner';

const QuestSession = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [quest, setQuest] = useState<Quest | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [timeElapsed, setTimeElapsed] = useState(0);
  const [isActive, setIsActive] = useState(false);
  const startedAtMsRef = useRef<number | null>(null);
  const [physicalLogRows, setPhysicalLogRows] = useState<PhysicalExerciseLog[]>([]);

  const isPhysicalQuest = quest?.type === 'physical';
  const todayKey = new Date().toISOString().slice(0, 10);

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
  }, [isActive]);

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
    setTimeout(() => navigate('/'), 1200);
  };

  if (!quest || !profile) {
    return (
      <div className="min-h-screen bg-[#030712] flex items-center justify-center">
        <div className="system-window p-6 text-center font-mono text-primary">
          [ SYSTEM: QUEST DATA NOT LOCATED ]
        </div>
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

  return (
    <div className="min-h-screen pt-6 pb-28 bg-[#030712] text-foreground scanlines">
      <main className="max-w-3xl mx-auto px-3 sm:px-6 py-6 space-y-6">
        
        {/* Navigation Top */}
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <button
            onClick={() => {
              systemSound.playClick();
              navigate('/');
            }}
            disabled={isActive}
            className="system-btn px-3 py-1.5 flex items-center gap-1.5 text-xs disabled:opacity-40"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>[ RETURN TO COMMAND ]</span>
          </button>

          <span className="text-xs font-mono text-primary/80 border border-primary/40 px-2 py-0.5 bg-primary/10 shrink-0">
            QUEST EXECUTION
          </span>
        </div>

        {/* Quest Info Hologram Window */}
        <div className="system-window tech-corners p-5 sm:p-6">
          <div className="flex items-center justify-between gap-2 flex-wrap border-b border-primary/30 pb-3 mb-4">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[10px] font-mono px-2 py-0.5 border border-primary text-primary font-bold">
                {quest.type.toUpperCase()} PROTOCOL
              </span>
              <span className="text-[10px] font-mono text-muted-foreground">
                LV.{quest.difficulty} DIFFICULTY
              </span>
            </div>
            <span className="text-xs font-mono text-amber-400 font-bold shrink-0">
              +{quest.xp} EXP REWARD
            </span>
          </div>

          <h2 className="text-xl sm:text-2xl font-display font-black text-white tracking-wider mb-2 system-glow-text">
            {quest.title}
          </h2>

          <p className="text-sm font-tech text-gray-300 whitespace-pre-line leading-relaxed mb-4">
            {quest.description}
          </p>

          <div className="grid grid-cols-2 gap-3 pt-3 border-t border-primary/20 text-xs font-mono">
            <div className="p-2.5 bg-black/40 border border-primary/20">
              <div className="text-muted-foreground text-[10px]">TARGET DURATION</div>
              <div className="text-sm font-bold text-primary">{quest.duration} MIN</div>
            </div>
            <div className="p-2.5 bg-black/40 border border-primary/20">
              <div className="text-muted-foreground text-[10px]">SYSTEM STATUS</div>
              <div className="text-sm font-bold text-emerald-400">
                {quest.completed ? 'COMPLETED' : isActive ? 'IN PROGRESS' : 'READY'}
              </div>
            </div>
          </div>
        </div>

        {/* Physical Exercise Set Logger */}
        {isPhysicalQuest && (
          <div className="system-window tech-corners p-5 sm:p-6">
            <div className="flex items-center justify-between border-b border-primary/30 pb-3 mb-4">
              <h3 className="font-display font-bold text-sm text-white tracking-wider">
                [ PHYSICAL TRAINING REPS & SETS LOG ]
              </h3>
              <span className="text-xs font-mono text-muted-foreground">{todayKey}</span>
            </div>

            <div className="space-y-4">
              {physicalLogRows.map((row, idx) => (
                <div key={`${row.exercise}-${idx}`} className="p-3.5 bg-black/50 border border-primary/30">
                  <div className="font-display font-bold text-sm text-white mb-2 tracking-wide">
                    {row.exercise}
                  </div>

                  {row.kind === 'strength' ? (
                    <div className="space-y-2">
                      <div className="space-y-2">
                        {(row.sets && row.sets.length > 0 ? row.sets : [{ reps: '', weightKg: '' }]).map((set, sIdx) => (
                          <div key={sIdx} className="flex items-center gap-2 text-xs font-mono">
                            <span className="text-primary font-bold w-12 shrink-0">
                              SET {sIdx + 1}:
                            </span>
                            <input
                              value={set.reps}
                              onChange={(e) => updateSet(idx, sIdx, { reps: e.target.value })}
                              placeholder="Reps"
                              className="bg-black/80 border border-primary/40 px-2 py-1 text-white w-20 focus:border-primary outline-none"
                            />
                            <input
                              value={set.weightKg}
                              onChange={(e) => updateSet(idx, sIdx, { weightKg: e.target.value })}
                              placeholder="Kg / Lbs"
                              className="bg-black/80 border border-primary/40 px-2 py-1 text-white w-20 focus:border-primary outline-none"
                            />
                            <button
                              type="button"
                              onClick={() => removeSet(idx, sIdx)}
                              className="ml-auto p-1 text-red-400 hover:text-red-300 border border-red-500/40 hover:bg-red-950/40"
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
                          className="system-btn px-2.5 py-1 text-xs flex items-center gap-1"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          ADD SET
                        </button>
                        <input
                          value={row.notes}
                          onChange={(e) => updatePhysicalNotes(idx, e.target.value)}
                          placeholder="Hunter execution notes..."
                          className="bg-black/80 border border-primary/30 px-2.5 py-1 text-xs text-white flex-1 focus:border-primary outline-none"
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs font-mono">
                      <input
                        value={row.timeMinutes ?? ''}
                        onChange={(e) => updatePhysicalTimeMinutes(idx, e.target.value)}
                        placeholder="Minutes taken"
                        className="bg-black/80 border border-primary/40 px-2 py-1.5 text-white outline-none focus:border-primary"
                      />
                      <input
                        value={row.notes}
                        onChange={(e) => updatePhysicalNotes(idx, e.target.value)}
                        placeholder="Pace / notes..."
                        className="bg-black/80 border border-primary/40 px-2 py-1.5 text-white sm:col-span-2 outline-none focus:border-primary"
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Stopwatch Timer (Non-Physical) */}
        {!isPhysicalQuest && (
          <div className="system-window tech-corners p-8 text-center">
            <div className="flex items-center justify-center gap-2 mb-2 text-xs font-mono text-primary/80">
              <Clock className="w-4 h-4 text-primary" />
              <span>{isActive ? '[ PROTOCOL ACTIVE ]' : '[ STANDBY - READY TO COMMENCE ]'}</span>
            </div>

            <div className={`font-mono text-5xl sm:text-6xl font-black mb-2 tracking-wider ${isOvertime ? 'text-red-400 animate-penalty-pulse' : 'text-white system-glow-text'}`}>
              {formatTime(timeElapsed)}
            </div>

            {isActive && (
              <div className="text-xs font-mono text-muted-foreground">
                {isOvertime ? 'OVERTIME ENGAGED' : `TARGET GOAL: ${formatTime(targetTime)}`}
              </div>
            )}
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-3">
          {!isPhysicalQuest && !isActive && !quest.completed && (
            <button
              onClick={handleStart}
              className="system-btn w-full py-3.5 text-sm font-bold flex items-center justify-center gap-2"
            >
              <Play className="w-4 h-4 fill-current" />
              COMMENCE QUEST SESSION
            </button>
          )}

          {(isPhysicalQuest ? !quest.completed : isActive) && (
            <button
              onClick={handleComplete}
              className="system-btn-monarch w-full py-3.5 text-sm font-bold flex items-center justify-center gap-2 text-amber-300"
            >
              <CheckCircle2 className="w-4 h-4" />
              CONFIRM PROTOCOL COMPLETION
            </button>
          )}
        </div>

        {/* System Warning Footer */}
        <div className="p-3.5 bg-black/40 border border-primary/20 text-xs font-mono text-gray-400">
          <span className="text-primary font-bold font-tech block mb-0.5">
            ※ SYSTEM DIRECTIVE:
          </span>
          Accurate logging directly conditions hunter stats. All hidden attribute potential will be applied upon subsequent hunter level advancement.
        </div>
      </main>
    </div>
  );
};

export default QuestSession;
