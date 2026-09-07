import { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  getDailyQuests,
  getUserProfile,
  saveUserProfile,
  addXP,
  getPhysicalDayPlan,
  getPhysicalQuestLog,
  savePhysicalQuestLog,
  completeQuest,
  toggleQuestCompletion,
  saveQuestAttempt,
  QUESTS_UPDATED_EVENT,
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
  Info,
  Dumbbell,
  Check,
  ChevronDown,
  ChevronUp,
  Plus,
  Trash2,
} from 'lucide-react';
import { toast } from 'sonner';

const parsePhysicalExercises = (description: string): string[] => {
  const trimmed = description.trim();
  if (!trimmed) return [];
  if (trimmed.includes('•')) {
    return trimmed
      .split('•')
      .map((s) => s.trim().replace(/\.$/, ''))
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

const isExerciseConditionMet = (row: PhysicalExerciseLog): boolean => {
  if (row.kind === 'strength') {
    if (!row.sets || row.sets.length === 0) return false;
    return row.sets.every((s) => {
      const repsNum = parseInt(s.reps, 10);
      return !isNaN(repsNum) && repsNum > 0;
    });
  }
  const mins = parseFloat(row.timeMinutes || '');
  return !isNaN(mins) && mins > 0;
};

export default function DailyPhysicalLab() {
  const navigate = useNavigate();
  const [profile, setProfile] = useState<UserProfile>(getUserProfile());
  const [quests, setQuests] = useState<Quest[]>([]);
  const today = useMemo(() => new Date(), []);
  const todayKey = today.toISOString().slice(0, 10);
  const currentPlan = useMemo(() => getPhysicalDayPlan(today), [today]);

  const [exerciseRows, setExerciseRows] = useState<PhysicalExerciseLog[]>([]);
  const [expandedRows, setExpandedRows] = useState<Record<number, boolean>>({});

  const physicalQuest = useMemo(
    () => quests.find((q) => q.type === 'physical'),
    [quests]
  );
  const questId = physicalQuest?.id || `physical-workout-${todayKey}`;

  const loadData = useCallback(async () => {
    try {
      const q = await getDailyQuests();
      setQuests(q);
      const curProfile = getUserProfile();
      setProfile(curProfile);

      const targetQuest = q.find((item) => item.type === 'physical');
      const targetQuestId = targetQuest?.id || `physical-workout-${todayKey}`;

      // Load saved logs or initialize default parsed exercises
      const existingLogs = getPhysicalQuestLog(targetQuestId, todayKey);
      const parsed = parsePhysicalExercises(currentPlan.description);

      if (existingLogs && existingLogs.length > 0) {
        const synced = existingLogs.map((r) => ({
          ...r,
          completed: isExerciseConditionMet(r),
        }));
        setExerciseRows(synced);
      } else {
        const defaultRows: PhysicalExerciseLog[] = parsed.map((exercise) => {
          const kind = inferKind(exercise);
          const initialRow: PhysicalExerciseLog = {
            exercise,
            kind,
            sets: kind === 'strength' ? [{ reps: '', weightKg: '' }] : undefined,
            timeMinutes: kind !== 'strength' ? '' : undefined,
            notes: '',
            completed: false,
          };
          initialRow.completed = isExerciseConditionMet(initialRow);
          return initialRow;
        });
        setExerciseRows(defaultRows);
        savePhysicalQuestLog(targetQuestId, todayKey, defaultRows);
      }
    } catch (e) {
      console.error('Failed to load physical conditioning data:', e);
    }
  }, [currentPlan, todayKey]);

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
  }, [loadData]);

  const completedCount = exerciseRows.filter((r) => r.completed).length;
  const allCompleted = completedCount === exerciseRows.length && exerciseRows.length > 0;

  const checkAndHandleAllConditions = (rows: PhysicalExerciseLog[]) => {
    const allDone = rows.length > 0 && rows.every((r) => r.completed);
    if (allDone && !physicalQuest?.completed) {
      triggerFullProtocolCompletion(rows);
    } else if (!allDone && physicalQuest?.completed) {
      toggleQuestCompletion(questId, false);
    }
  };

  const toggleExpandedRow = (index: number) => {
    systemSound.playClick();
    setExpandedRows((prev) => ({ ...prev, [index]: !prev[index] }));
  };

  const updateSet = (rowIndex: number, setIndex: number, patch: Partial<PhysicalSetLog>) => {
    setExerciseRows((prev) => {
      const updated = prev.map((row, idx) => {
        if (idx !== rowIndex) return row;
        const sets = Array.isArray(row.sets) ? row.sets.slice() : [];
        const current = sets[setIndex] ?? { reps: '', weightKg: '' };
        sets[setIndex] = { ...current, ...patch };
        const updatedRow: PhysicalExerciseLog = { ...row, sets };
        updatedRow.completed = isExerciseConditionMet(updatedRow);
        return updatedRow;
      });
      savePhysicalQuestLog(questId, todayKey, updated);
      checkAndHandleAllConditions(updated);
      return updated;
    });
  };

  const addSet = (rowIndex: number) => {
    systemSound.playClick();
    setExerciseRows((prev) => {
      const updated = prev.map((row, idx) => {
        if (idx !== rowIndex) return row;
        const sets = Array.isArray(row.sets) ? row.sets.slice() : [];
        sets.push({ reps: '', weightKg: '' });
        const updatedRow: PhysicalExerciseLog = { ...row, sets };
        updatedRow.completed = isExerciseConditionMet(updatedRow);
        return updatedRow;
      });
      savePhysicalQuestLog(questId, todayKey, updated);
      checkAndHandleAllConditions(updated);
      return updated;
    });
  };

  const removeSet = (rowIndex: number, setIndex: number) => {
    systemSound.playClick();
    setExerciseRows((prev) => {
      const updated = prev.map((row, idx) => {
        if (idx !== rowIndex) return row;
        const sets = Array.isArray(row.sets) ? row.sets.slice() : [];
        sets.splice(setIndex, 1);
        const safeSets = sets.length > 0 ? sets : [{ reps: '', weightKg: '' }];
        const updatedRow: PhysicalExerciseLog = { ...row, sets: safeSets };
        updatedRow.completed = isExerciseConditionMet(updatedRow);
        return updatedRow;
      });
      savePhysicalQuestLog(questId, todayKey, updated);
      checkAndHandleAllConditions(updated);
      return updated;
    });
  };

  const updateNotes = (rowIndex: number, value: string) => {
    setExerciseRows((prev) => {
      const updated = prev.map((row, idx) => (idx === rowIndex ? { ...row, notes: value } : row));
      savePhysicalQuestLog(questId, todayKey, updated);
      return updated;
    });
  };

  const updateTimeMinutes = (rowIndex: number, value: string) => {
    setExerciseRows((prev) => {
      const updated = prev.map((row, idx) => {
        if (idx !== rowIndex) return row;
        const updatedRow: PhysicalExerciseLog = { ...row, timeMinutes: value };
        updatedRow.completed = isExerciseConditionMet(updatedRow);
        return updatedRow;
      });
      savePhysicalQuestLog(questId, todayKey, updated);
      checkAndHandleAllConditions(updated);
      return updated;
    });
  };

  const triggerFullProtocolCompletion = (rows?: PhysicalExerciseLog[]) => {
    const list = rows || exerciseRows;
    const isReady = list.every((r) => r.completed) && list.length > 0;
    if (!isReady) {
      toast.error('DIRECTIVES INCOMPLETE', {
        description: 'Complete all physical conditioning exercises to fulfill the protocol.',
      });
      return;
    }

    systemSound.playQuestComplete();
    completeQuest(questId);
    updateQuestCompletion();

    // Scale and award rewards
    const scaledRewards = scaleHiddenRewards(
      currentPlan.hiddenRewards || { STR: 3, VIT: 2, AGI: 1 },
      profile.attributes
    );
    const updatedPoints = { ...profile.accumulatedPoints };
    Object.keys(scaledRewards).forEach((k) => {
      const attr = k as keyof Attributes;
      updatedPoints[attr] = (updatedPoints[attr] || 0) + (scaledRewards[attr] || 0);
    });

    const updatedProfile = addXP(
      { ...profile, accumulatedPoints: updatedPoints },
      currentPlan.xp
    );
    saveUserProfile(updatedProfile);
    setProfile(updatedProfile);

    saveQuestAttempt({
      id: crypto.randomUUID(),
      questId,
      userId: profile.id,
      timeTaken: currentPlan.duration * 60,
      success: true,
      xpGained: currentPlan.xp,
      timestamp: new Date().toISOString(),
    });

    toast.success('PHYSICAL PROTOCOL FULFILLED', {
      description: `+${currentPlan.xp} EXP acquired for Hunter ${profile.displayName || profile.pseudo}.`,
    });
  };

  return (
    <div className="min-h-screen pt-8 sm:pt-14 md:pt-16 pb-36 sm:pb-40 bg-[#071322] text-[#e5ecf4] flex flex-col system-blueprint-bg font-mono">
      <main className="max-w-[620px] w-full mx-auto px-4 py-6 sm:py-10 flex-1 flex flex-col items-center justify-center my-auto">
        {/* Solo Leveling Holographic Container matching Daily Quests */}
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
              TOTAL: [{completedCount}/{exerciseRows.length}]
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
          <div className="text-center font-mono text-xs sm:text-sm text-white/90 mb-1">
            [Daily Quest: {currentPlan.title} has arrived.]
          </div>
          <div className="text-center font-mono text-[11px] text-[#9fd3ff]/80 mb-4">
            [ TARGET: {currentPlan.duration} MIN • RANK {currentPlan.difficulty} • +{currentPlan.xp} EXP ]
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

          {/* Integrated List of Physical Conditioning Exercises */}
          <div className="space-y-3 mb-5">
            {exerciseRows.map((row, idx) => (
              <div
                key={idx}
                className={`border rounded-[2px] overflow-hidden transition-all shadow-[inset_0_0_14px_rgba(0,212,255,0.06)] ${
                  row.completed
                    ? 'border-emerald-500/40 bg-[#061825]/90'
                    : 'border-white/40 bg-[#061424]/80 hover:border-cyan-400/60'
                }`}
              >
                {/* Main Exercise Row */}
                <div className="w-full flex items-center justify-between p-3 sm:p-3.5 bg-white/5 transition-colors">
                  <div
                    onClick={() => toggleExpandedRow(idx)}
                    className="flex items-center gap-2.5 flex-1 text-left cursor-pointer select-none pr-2"
                  >
                    <Dumbbell className={`w-4 h-4 shrink-0 ${row.completed ? 'text-emerald-400' : 'text-[#9fd3ff]'}`} />
                    <span className={`font-bold text-xs sm:text-sm tracking-wider ${row.completed ? 'text-emerald-300 font-mono' : 'text-white'}`}>
                      {row.exercise}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {/* Log Sets & Reps Expansion Button */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleExpandedRow(idx);
                      }}
                      className="px-2 py-1 border border-cyan-500/40 bg-cyan-950/40 hover:bg-cyan-900/60 text-cyan-300 font-mono text-[10px] tracking-wider rounded-[2px] transition-all flex items-center gap-1"
                      title="Log sets & reps to automatically verify"
                    >
                      <span>{expandedRows[idx] ? '[ HIDE ]' : '[ LOG ]'}</span>
                      {expandedRows[idx] ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                    </button>

                    {/* Automated Condition Checkmark (No manual checking) */}
                    <div
                      className={`w-7 h-7 border-2 rounded-[2px] flex items-center justify-center transition-all ${
                        row.completed
                          ? 'border-emerald-400 bg-emerald-950/60 text-emerald-300 shadow-[0_0_10px_rgba(52,211,153,0.5)]'
                          : 'border-white/30 bg-black/50 text-white/20'
                      }`}
                      title={
                        row.completed
                          ? 'Condition met: Directives logged and verified'
                          : row.kind === 'strength'
                          ? 'Condition incomplete: Log reps for all sets to auto-verify'
                          : 'Condition incomplete: Log duration to auto-verify'
                      }
                    >
                      {row.completed ? (
                        <Check className="w-4 h-4 stroke-[3]" />
                      ) : (
                        <div className="w-1.5 h-1.5 rounded-full bg-white/20" />
                      )}
                    </div>
                  </div>
                </div>

                {/* Inline Reps/Sets Logger (Directly from Conditioning Page) */}
                {expandedRows[idx] && (
                  <div className="p-3.5 border-t border-white/20 bg-[#05101d]/95 space-y-3 font-mono text-xs">
                    {row.kind === 'strength' ? (
                      <div className="space-y-2">
                        {row.sets?.map((set, setIdx) => (
                          <div key={setIdx} className="flex flex-wrap sm:flex-nowrap items-center gap-2">
                            <span className="text-[11px] font-bold text-cyan-300 w-14 shrink-0">
                              SET {setIdx + 1}:
                            </span>
                            <div className="flex items-center gap-2 flex-1 min-w-0">
                              <input
                                type="text"
                                placeholder="Reps"
                                value={set.reps}
                                onChange={(e) => updateSet(idx, setIdx, { reps: e.target.value })}
                                className="w-20 px-2 py-1 bg-black/60 border border-white/30 rounded-[2px] text-white text-xs placeholder:text-white/30 focus:border-cyan-400 focus:outline-none font-mono"
                              />
                              <input
                                type="text"
                                placeholder="Kg / Lbs"
                                value={set.weightKg}
                                onChange={(e) => updateSet(idx, setIdx, { weightKg: e.target.value })}
                                className="w-24 px-2 py-1 bg-black/60 border border-white/30 rounded-[2px] text-white text-xs placeholder:text-white/30 focus:border-cyan-400 focus:outline-none font-mono"
                              />
                              {row.sets && row.sets.length > 1 && (
                                <button
                                  type="button"
                                  onClick={() => removeSet(idx, setIdx)}
                                  className="p-1 text-red-400/70 hover:text-red-300 transition-colors"
                                  title="Remove set"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          </div>
                        ))}
                        <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                          <button
                            type="button"
                            onClick={() => addSet(idx)}
                            className="px-2.5 py-1 border border-white/30 bg-white/5 hover:bg-white/10 text-cyan-300 text-[11px] flex items-center gap-1 rounded-[2px] transition-all"
                          >
                            <Plus className="w-3 h-3" />
                            <span>ADD SET</span>
                          </button>
                          <input
                            type="text"
                            placeholder="Hunter execution notes..."
                            value={row.notes}
                            onChange={(e) => updateNotes(idx, e.target.value)}
                            className="flex-1 min-w-[140px] px-2 py-1 bg-black/60 border border-white/30 rounded-[2px] text-white text-xs placeholder:text-white/30 focus:border-cyan-400 focus:outline-none font-mono"
                          />
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-wrap items-center gap-2">
                        <input
                          type="text"
                          placeholder="Minutes taken"
                          value={row.timeMinutes || ''}
                          onChange={(e) => updateTimeMinutes(idx, e.target.value)}
                          className="w-32 px-2 py-1 bg-black/60 border border-white/30 rounded-[2px] text-white text-xs placeholder:text-white/30 focus:border-cyan-400 focus:outline-none font-mono"
                        />
                        <input
                          type="text"
                          placeholder="Pace / notes..."
                          value={row.notes}
                          onChange={(e) => updateNotes(idx, e.target.value)}
                          className="flex-1 min-w-[140px] px-2 py-1 bg-black/60 border border-white/30 rounded-[2px] text-white text-xs placeholder:text-white/30 focus:border-cyan-400 focus:outline-none font-mono"
                        />
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
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
                  ? 'All physical directives verified automatically'
                  : 'Directives incomplete: fulfill all exercises to auto-verify'
              }
            >
              <Check className="w-7 h-7 stroke-[3]" />
            </div>

            <div className="mt-2 text-center font-mono text-[11px] text-white/50">
              {allCompleted ? (
                <span className="text-emerald-400 font-bold anime-glow-text">
                  [ ALL DIRECTIVES VERIFIED & COMPLETED ]
                </span>
              ) : (
                <span>[{completedCount} of {exerciseRows.length} directives fulfilled]</span>
              )}
            </div>
          </div>

        </div>
      </main>
    </div>
  );
}
