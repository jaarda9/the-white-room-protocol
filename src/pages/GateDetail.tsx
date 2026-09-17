import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  getGateById,
  toggleGateTask,
  setWaveTasks,
  generateWaveTasks,
  syncActiveGateTasks,
  isGateTaskUnlocked,
  clearGate,
  deleteGate,
  GATES_UPDATED_EVENT,
  type Gate,
  type GateClearReward,
} from '@/lib/gates';
import { getToDos, TODOS_UPDATED_EVENT } from '@/lib/storage';
import {
  isSprintMode,
  isChainWaveLocked,
  clearChainGate,
  recordChainEffortDay,
  submitChainWaveReports,
  generateChainSubjectQuiz,
  submitChainQuizAnswers,
} from '@/lib/chain-gates';
import type { QuizQuestion } from '@/lib/types';
import { systemSound } from '@/lib/system-sound';
import { useLockBodyScroll } from '@/hooks/use-lock-body-scroll';
import { ArrowLeft, DoorOpen, Check, Trash2, Skull, Sparkles, Award, Zap, Lock } from 'lucide-react';
import { toast } from 'sonner';

const RANK_COLOR: Record<string, string> = {
  E: '#9fd3ff',
  D: '#38bdf8',
  C: '#34d399',
  B: '#fbbf24',
  A: '#fb923c',
  S: '#f87171',
};

export default function GateDetail() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [gate, setGate] = useState<Gate | null>(() => (id ? getGateById(id) : null));
  const [reward, setReward] = useState<GateClearReward | null>(null);
  useLockBodyScroll(Boolean(reward));

  useEffect(() => {
    const reload = () => {
      setGate(id ? getGateById(id) : null);
      // Idempotent — safe even though this also fires GATES_UPDATED_EVENT when it makes a
      // change, which re-triggers this same reload once more and then settles (see
      // syncActiveGateTasks in gates.ts). Covers a direct visit to this page before
      // Dashboard.tsx's own copy of this call ever ran this session.
      syncActiveGateTasks();
    };
    reload();
    window.addEventListener(GATES_UPDATED_EVENT, reload);
    return () => window.removeEventListener(GATES_UPDATED_EVENT, reload);
  }, [id]);

  // A task scheduled as a To-Do auto-verifies here once that To-Do is completed elsewhere in
  // the app — reconciled on mount and whenever any To-Do changes, rather than the reverse
  // (storage.ts reaching into gates.ts), which would create a circular dependency.
  useEffect(() => {
    const reconcile = () => {
      if (!id) return;
      const current = getGateById(id);
      if (!current) return;
      const todos = getToDos();
      current.milestones.forEach((m) => {
        if (m.completed) return;
        m.tasks.forEach((t) => {
          if (t.completed || !t.linkedTodoId) return;
          // Defense in depth: syncActiveGateTasks (gates.ts) no longer schedules a To-Do for
          // 'report'/'quiz' tasks at all, but a Gate created before that fix could still have
          // one linked — checking it off must never auto-complete a task THEIA hasn't graded.
          if (t.verification === 'report' || t.verification === 'quiz') return;
          const linkedTodo = todos.find((td) => td.id === t.linkedTodoId);
          if (linkedTodo?.status === 'completed') {
            const { reward } = toggleGateTask(current.id, m.id, t.id);
            systemSound.playSuccess();
            toast.success('TASK AUTO-VERIFIED', {
              description: reward
                ? `"${t.label}" confirmed complete via its linked To-Do. Wave cleared: +${reward.xpAwarded} XP · +${reward.attributePoints} ${reward.attribute} (hidden).`
                : `"${t.label}" confirmed complete via its linked To-Do.`,
            });
          }
        });
      });
    };
    reconcile();
    window.addEventListener(TODOS_UPDATED_EVENT, reconcile);
    return () => window.removeEventListener(TODOS_UPDATED_EVENT, reconcile);
  }, [id]);

  // The active Wave's task breakdown is generated lazily, exactly once, the moment it becomes
  // current — never all Waves up front at Gate creation (see generateWaveTasks in gates.ts).
  const [generatingTasksFor, setGeneratingTasksFor] = useState<string | null>(null);
  useEffect(() => {
    if (!gate || gate.status === 'cleared') return;
    const activeMilestone = gate.milestones.find((m) => !m.completed);
    if (!activeMilestone || activeMilestone.tasks.length > 0) return;
    if (generatingTasksFor === activeMilestone.id) return;

    setGeneratingTasksFor(activeMilestone.id);
    generateWaveTasks(gate, activeMilestone)
      .then((tasks) => {
        setWaveTasks(gate.id, activeMilestone.id, tasks);
      })
      .finally(() => setGeneratingTasksFor(null));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gate?.id, gate?.milestones.find((m) => !m.completed)?.id]);

  if (!gate) {
    return (
      <div className="min-h-screen pt-8 sm:pt-14 md:pt-16 pb-36 sm:pb-40 bg-[#071322] text-[#e5ecf4] flex flex-col system-blueprint-bg font-mono">
        <main className="max-w-[600px] w-full mx-auto px-4 py-6 sm:py-10 flex-1 flex flex-col items-center justify-center my-auto">
          <div className="text-center text-xs text-cyan-300/80 space-y-3">
            <div>[ GATE RECORD NOT FOUND — IT MAY HAVE COLLAPSED ]</div>
            <button
              onClick={() => navigate('/?view=dungeons')}
              className="py-2 px-5 border border-cyan-400 bg-cyan-950/80 hover:bg-cyan-900 text-cyan-300 rounded text-xs font-bold tracking-wider"
            >
              [ RETURN TO GATES ]
            </button>
          </div>
        </main>
      </div>
    );
  }

  const done = gate.milestones.filter((m) => m.completed).length;
  const total = gate.milestones.length;
  const allWavesCleared = total === 0 || done === total;
  const activeMilestoneIndex = gate.milestones.findIndex((m) => !m.completed);
  const sealedCount = activeMilestoneIndex === -1 ? 0 : total - activeMilestoneIndex - 1;
  // theia-chain only — see chain-gates.ts's isSprintMode. Recomputed on every render (never
  // stored) so it flips live as days pass without needing its own sync/invalidation.
  const sprintMode = gate.origin === 'theia-chain' && isSprintMode(gate);
  const rankColor = RANK_COLOR[gate.rank] || '#9fd3ff';
  const daysRemaining = Math.ceil((new Date(gate.targetDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24));

  const handleToggleTask = (milestoneId: string, taskId: string) => {
    systemSound.playClick();
    const milestone = gate.milestones.find((m) => m.id === milestoneId);
    const taskIndex = milestone?.tasks.findIndex((t) => t.id === taskId) ?? -1;
    const wasCompleting = taskIndex >= 0 && milestone && !milestone.tasks[taskIndex].completed;
    const hasNextTask = Boolean(milestone && taskIndex >= 0 && taskIndex < milestone.tasks.length - 1);

    // toggleGateTask persists + dispatches GATES_UPDATED_EVENT, which the effect above
    // already listens for, so state refreshes on its own.
    const { reward } = toggleGateTask(gate.id, milestoneId, taskId);

    // Feeds the chain-Gate's effort score (see chain-gates.ts's computeChainEffortScore) —
    // any engagement today counts toward consistency, regardless of verification type.
    if (gate.origin === 'theia-chain' && wasCompleting) {
      recordChainEffortDay(gate, true);
    }

    if (reward) {
      systemSound.playSuccess();
      toast.success('WAVE CLEARED', {
        description: `+${reward.xpAwarded} XP · +${reward.attributePoints} ${reward.attribute} (hidden) — ${reward.vitalsMessage}`,
      });
    } else if (wasCompleting && hasNextTask) {
      systemSound.playSuccess();
      toast.success('TASK COMPLETE', {
        description: 'The next task in this Wave unlocks tomorrow — no speedrunning the checkpoint.',
      });
    }
  };

  // Report-verified chain-Gate tasks (see gates.ts's verificationForGate) — draft text and the
  // last rejection feedback, keyed by task id; the in-flight flag is keyed by Wave (milestone)
  // id instead, since one button now submits every filled-in report for that Wave in one call —
  // see submitChainWaveReports for why (this is the actual fix for how fast report grading was
  // burning a free-tier daily AI quota: one call per Wave submission instead of one per task).
  // Ephemeral (not persisted) except for what submitChainWaveReports itself writes onto the Gate.
  const [reportDrafts, setReportDrafts] = useState<Record<string, string>>({});
  const [submittingReportsForWave, setSubmittingReportsForWave] = useState<string | null>(null);
  const [reportRejection, setReportRejection] = useState<Record<string, string>>({});

  const handleSubmitWaveReports = async (milestone: (typeof gate.milestones)[number]) => {
    if (submittingReportsForWave) return;
    const hasAnyDraft = milestone.tasks.some(
      (t) => t.verification === 'report' && !t.completed && (reportDrafts[t.id] || '').trim().length > 0
    );
    if (!hasAnyDraft) return;
    systemSound.playClick();
    setSubmittingReportsForWave(milestone.id);
    try {
      const { results, reward } = await submitChainWaveReports(gate, milestone, reportDrafts);
      const passedCount = results.filter((r) => r.passed).length;

      setReportRejection((prev) => {
        const next = { ...prev };
        results.forEach((r) => {
          if (r.passed) delete next[r.taskId];
          else next[r.taskId] = r.feedback;
        });
        return next;
      });
      setReportDrafts((prev) => {
        const next = { ...prev };
        results.forEach((r) => {
          if (r.passed) delete next[r.taskId];
        });
        return next;
      });

      const waveClearedNote = reward
        ? ` Wave cleared: +${reward.xpAwarded} XP · +${reward.attributePoints} ${reward.attribute} (hidden).`
        : '';

      if (passedCount === 0) {
        toast.warning('REPORTS REJECTED', { description: 'None of these passed — see feedback below and try again.' });
      } else if (passedCount === results.length) {
        systemSound.playSuccess();
        toast.success(
          results.length === 1 ? 'REPORT VERIFIED' : `${passedCount}/${results.length} REPORTS VERIFIED`,
          { description: `${results[0].feedback}${waveClearedNote}` }
        );
      } else {
        systemSound.playSuccess();
        toast.warning(`${passedCount}/${results.length} REPORTS VERIFIED`, {
          description: `The rest need another attempt — see feedback below.${waveClearedNote}`,
        });
      }
    } finally {
      setSubmittingReportsForWave(null);
    }
  };

  // Quiz-verified chain-Gate tasks (subject category — see gates.ts's verificationForGate).
  // The quiz itself and in-progress answers are ephemeral component state (lost on refresh,
  // same tradeoff as report drafts above) — only the graded outcome persists, via
  // submitChainQuizAnswers reusing Phase 3's setChainTaskReport under the hood.
  const [quizzes, setQuizzes] = useState<Record<string, QuizQuestion[]>>({});
  const [quizAnswers, setQuizAnswers] = useState<Record<string, (string | null)[]>>({});
  const [quizIndex, setQuizIndex] = useState<Record<string, number>>({});
  const [generatingQuizFor, setGeneratingQuizFor] = useState<string | null>(null);
  const [submittingQuizFor, setSubmittingQuizFor] = useState<string | null>(null);

  const handleStartQuiz = async (milestone: (typeof gate.milestones)[number], task: (typeof milestone.tasks)[number]) => {
    if (generatingQuizFor) return;
    systemSound.playClick();
    setGeneratingQuizFor(task.id);
    try {
      const quiz = await generateChainSubjectQuiz(gate, milestone);
      setQuizzes((prev) => ({ ...prev, [task.id]: quiz }));
      setQuizAnswers((prev) => ({ ...prev, [task.id]: new Array(quiz.length).fill(null) }));
      setQuizIndex((prev) => ({ ...prev, [task.id]: 0 }));
    } catch {
      // generateQuizQuestions has no local fallback template (unlike report grading) — a
      // network hiccup here just means the button resets so the Hunter can try again.
      toast.error('THEIA could not prepare the quiz — try again.');
    } finally {
      setGeneratingQuizFor(null);
    }
  };

  const handleSubmitQuiz = async (milestone: (typeof gate.milestones)[number], task: (typeof milestone.tasks)[number]) => {
    const quiz = quizzes[task.id];
    const answers = quizAnswers[task.id];
    if (!quiz || !answers || submittingQuizFor) return;
    systemSound.playClick();
    setSubmittingQuizFor(task.id);
    try {
      const { passed, correctCount, total, reward } = await submitChainQuizAnswers(gate, milestone, task, quiz, answers);
      if (passed) {
        systemSound.playSuccess();
        toast.success('QUIZ PASSED', {
          description: reward
            ? `${correctCount}/${total} correct. Wave cleared: +${reward.xpAwarded} XP · +${reward.attributePoints} ${reward.attribute} (hidden).`
            : `${correctCount}/${total} correct.`,
        });
      } else {
        toast.warning('QUIZ FAILED', { description: `${correctCount}/${total} correct — try again once THEIA re-verifies.` });
        // Clear so the task shows [ START QUIZ ] again rather than a stuck, already-answered quiz.
        setQuizzes((prev) => {
          const next = { ...prev };
          delete next[task.id];
          return next;
        });
      }
    } finally {
      setSubmittingQuizFor(null);
    }
  };

  const handleClearGate = () => {
    if (!allWavesCleared || gate.status === 'cleared') return;
    // Chain-Gates route through clearChainGate — same reward path as clearGate, plus scheduling
    // the next spawn and recording the taught skill in the Ledger (see chain-gates.ts).
    const result = gate.origin === 'theia-chain' ? clearChainGate(gate.id) : clearGate(gate.id);
    if (!result) return;
    systemSound.playLevelUp();
    setReward(result.reward);
  };

  const handleDelete = () => {
    const confirmed = window.confirm(`Abandon "${gate.title}"? This closes the Gate permanently.`);
    if (!confirmed) return;
    systemSound.playClick();
    deleteGate(gate.id);
    navigate('/?view=dungeons');
  };

  return (
    <div className="min-h-screen pt-8 sm:pt-14 md:pt-16 pb-36 sm:pb-40 bg-[#071322] text-[#e5ecf4] flex flex-col system-blueprint-bg font-mono">
      <main className="max-w-[600px] w-full mx-auto px-4 py-6 sm:py-10 flex-1 flex flex-col items-center justify-center my-auto">
        <div className="relative w-full bg-[#0a1b2e]/90 border-2 border-white/50 rounded-[4px] p-5 sm:p-8 text-white shadow-[0_0_30px_rgba(0,0,0,0.85),inset_0_0_24px_rgba(0,212,255,0.08)] backdrop-blur-md anime-dropdown font-mono">
          {/* Header controls */}
          <div className="flex items-center justify-between pb-2 mb-3 border-b border-white/20 text-xs gap-2 flex-wrap">
            <button
              onClick={() => {
                systemSound.playClick();
                navigate('/?view=dungeons');
              }}
              className="flex items-center gap-1.5 text-cyan-300/80 hover:text-white transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>[ RETURN TO GATES ]</span>
            </button>
            <div className="text-[11px] font-bold tracking-wider" style={{ color: rankColor }}>
              RANK {gate.rank}
            </div>
          </div>

          {/* Title plate */}
          <div className="relative flex items-center justify-center pb-2 mb-2">
            <div
              className="inline-block px-8 py-1 border bg-[#061426]/60"
              style={{ borderColor: rankColor, boxShadow: `0 0 14px ${rankColor}55` }}
            >
              <div className="flex items-center gap-2">
                <DoorOpen className="w-4 h-4" style={{ color: rankColor }} />
                <span className="font-mono font-extrabold tracking-[0.2em] text-base sm:text-lg text-white anime-glow-text">
                  {gate.title.toUpperCase()}
                </span>
              </div>
            </div>
          </div>

          {gate.status === 'cleared' ? (
            <div className="text-center mb-3">
              <span className="text-[11px] px-2.5 py-1 border border-emerald-500/50 bg-emerald-950/40 text-emerald-300 rounded-[2px] font-bold tracking-wider">
                [ GATE CLEARED ]
              </span>
            </div>
          ) : gate.status === 'breached' ? (
            <div className="text-center mb-3 space-y-1">
              <span className="text-[11px] px-2.5 py-1 border border-rose-500/50 bg-rose-950/40 text-rose-300 rounded-[2px] font-bold tracking-wider">
                [ GATE BREACHED ]
              </span>
              <p className="text-[10px] text-white/40">
                Deadline passed — permanently logged. Still open to clear.
              </p>
            </div>
          ) : (
            <div className="text-center mb-3">
              <span className="text-[10px] text-white/50">
                [ {daysRemaining >= 0 ? `${daysRemaining} day${daysRemaining === 1 ? '' : 's'} remaining` : 'Clock expired'} ]
              </span>
            </div>
          )}

          {gate.description && (
            <p className="text-center text-[11px] sm:text-xs text-white/70 mb-4 leading-relaxed">
              {gate.description}
            </p>
          )}

          {sprintMode && (
            <div className="flex items-center justify-center gap-1.5 border border-amber-400/60 bg-amber-950/30 rounded-[2px] py-1.5 px-3 mb-4 text-[10px] sm:text-[11px] font-bold text-amber-300 tracking-wider">
              <Zap className="w-3.5 h-3.5" />
              [ SPRINT PROTOCOL ACTIVE — ALL TASKS IN THIS WAVE UNLOCKED ]
            </div>
          )}

          {/* Boss condition */}
          <div className="border border-cyan-500/30 bg-[#07172b]/70 rounded-[2px] p-3 mb-4">
            <div className="text-[10px] tracking-[0.2em] text-cyan-300/80 mb-1 flex items-center gap-1.5">
              <Skull className="w-3.5 h-3.5" />
              <span>BOSS CONDITION</span>
            </div>
            <p className="text-[11px] sm:text-xs text-white/85 leading-relaxed">{gate.bossCondition}</p>
          </div>

          {/* Milestones — revealed one at a time, like dungeon floors. Seeing the whole plan
              up front invites speedrunning it in one sitting instead of actually working
              through it, so anything past the current Wave stays sealed until it clears. */}
          {total > 0 && (
            <div className="space-y-2 mb-4">
              <div className="text-[10px] text-[#9fd3ff]/80 tracking-wider font-bold mb-1">
                WAVES [{done}/{total}]
              </div>
              {gate.milestones.map((m, i) => {
                const isRevealed = m.completed || i === activeMilestoneIndex;
                if (!isRevealed) return null;
                const isCurrent = i === activeMilestoneIndex;

                const tasksDone = m.tasks.filter((t) => t.completed).length;
                const isGeneratingTasks = isCurrent && !m.completed && generatingTasksFor === m.id;
                // Wave-to-Wave day-gate for chain-Gates only (see isChainWaveLocked) — Wave
                // reveal itself stays pure sequential-completion for every Gate, same as always;
                // this only blocks a chain-Gate's next Wave from being actionable same-day.
                const chainWaveLocked = gate.origin === 'theia-chain' && isChainWaveLocked(gate, i);

                return (
                  <div
                    key={m.id}
                    className={`border rounded-[2px] p-2.5 transition-all ${
                      m.completed
                        ? 'border-emerald-500/40 bg-[#061825]/90'
                        : isCurrent
                          ? 'border-cyan-400/60 bg-[#061424]/80 shadow-[0_0_12px_rgba(0,212,255,0.15)]'
                          : 'border-white/40 bg-[#061424]/80'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-[10px] text-white/40 w-4 shrink-0 text-center">{i + 1}.</span>
                        <span className={`text-xs ${m.completed ? 'text-emerald-300 line-through' : 'text-white'}`}>
                          {m.label}
                        </span>
                        {isCurrent && (
                          <span className="text-[8px] px-1.5 py-0.5 border border-cyan-400/50 text-cyan-300 bg-cyan-950/40 rounded-[2px] shrink-0">
                            CURRENT
                          </span>
                        )}
                        {!m.completed && m.attribute && (
                          <span className="text-[8px] px-1.5 py-0.5 border border-cyan-400/30 text-cyan-400/90 bg-black/30 rounded-[2px] shrink-0">
                            TRAINS {m.attribute}
                          </span>
                        )}
                      </div>
                      <div
                        className={`w-6 h-6 shrink-0 border-2 rounded-[2px] flex items-center justify-center ${
                          m.completed
                            ? 'border-emerald-400 bg-emerald-950/60 text-emerald-300'
                            : 'border-white/30 bg-black/50 text-white/40'
                        }`}
                      >
                        {m.completed ? (
                          <Check className="w-3.5 h-3.5 stroke-[3]" />
                        ) : (
                          <span className="text-[9px] font-bold">{m.tasks.length > 0 ? `${tasksDone}/${m.tasks.length}` : '·'}</span>
                        )}
                      </div>
                    </div>

                    {m.hint && !m.completed && (
                      <p className="text-[10px] text-cyan-300/70 italic mt-1 pl-[22px]">↳ {m.hint}</p>
                    )}

                    {/* Only the current Wave's tasks are shown — a completed Wave collapses to
                        just its checkmark above, and sealed Waves aren't rendered at all. Within
                        the Wave, tasks unlock one calendar day at a time for player-created Gates
                        (see isGateTaskUnlocked in gates.ts) — the same anti-speedrun reasoning as
                        sealed Waves, one layer deeper. Chain-Gates instead gate at the Wave level
                        (chainWaveLocked, below) and unlock every task in the active Wave together,
                        since a chain-Gate's Wave IS one day's checklist, not a multi-day span.
                        Scheduling into Tactical To-Dos is automatic now (syncActiveGateTasks), no
                        manual step. */}
                    {isCurrent && !m.completed && chainWaveLocked && (
                      <div className="mt-2 pl-[22px]">
                        <div className="border border-dashed border-white/15 bg-black/20 rounded-[2px] p-2 flex items-center gap-1.5 text-[10px] text-white/40">
                          <Lock className="w-3 h-3" />
                          NEXT DIRECTIVE UNLOCKS TOMORROW
                        </div>
                      </div>
                    )}
                    {isCurrent && !m.completed && !chainWaveLocked && (
                      <div className="mt-2 pl-[22px] space-y-1.5">
                        {isGeneratingTasks || m.tasks.length === 0 ? (
                          <div className="flex items-center gap-1.5 text-[10px] text-cyan-300/70">
                            <Sparkles className="w-3 h-3 animate-spin" />
                            THEIA is breaking this checkpoint into tasks...
                          </div>
                        ) : (
                          (() => {
                            const isChainGate = gate.origin === 'theia-chain';
                            const activeTaskIndex = m.tasks.findIndex((t) => !t.completed);
                            // Chain-Gate tasks are all unlocked together (one Wave = one day's
                            // checklist — see isGateTaskUnlocked's taskLevelDayGate param), same
                            // as sprint mode already does for player-created Gates — nothing is
                            // actually "sealed" in either case.
                            const sealedTaskCount =
                              isChainGate || sprintMode || activeTaskIndex === -1
                                ? 0
                                : m.tasks.length - activeTaskIndex - 1;

                            return (
                              <>
                                {m.tasks.map((t, ti) => {
                                  if (!t.completed && ti !== activeTaskIndex && !sprintMode && !isChainGate) return null;
                                  const unlocked =
                                    t.completed || isGateTaskUnlocked(m.tasks, ti, sprintMode, !isChainGate);

                                  return (
                                    <div
                                      key={t.id}
                                      className={`border rounded-[2px] p-2 transition-all ${
                                        t.completed
                                          ? 'border-emerald-500/40 bg-emerald-950/20'
                                          : unlocked
                                            ? 'border-white/30 bg-black/30'
                                            : 'border-dashed border-white/15 bg-black/20'
                                      }`}
                                    >
                                      <div className="flex items-center gap-2">
                                        <button
                                          type="button"
                                          onClick={() =>
                                            t.verification !== 'report' && t.verification !== 'quiz' && handleToggleTask(m.id, t.id)
                                          }
                                          disabled={
                                            gate.status === 'cleared' ||
                                            !unlocked ||
                                            t.verification === 'report' ||
                                            t.verification === 'quiz'
                                          }
                                          className={`w-5 h-5 shrink-0 border-2 rounded-[2px] flex items-center justify-center transition-all disabled:opacity-40 disabled:cursor-not-allowed ${
                                            t.completed
                                              ? 'border-emerald-400 bg-emerald-950/60 text-emerald-300'
                                              : 'border-white/30 bg-black/50 text-white/20 hover:border-cyan-400/60'
                                          }`}
                                        >
                                          {t.completed ? <Check className="w-3 h-3 stroke-[3]" /> : null}
                                        </button>
                                        <span
                                          className={`text-[11px] ${
                                            t.completed ? 'text-emerald-300 line-through' : unlocked ? 'text-white' : 'text-white/40'
                                          }`}
                                        >
                                          {t.label}
                                        </span>
                                      </div>
                                      {!t.completed && gate.status !== 'cleared' && unlocked && t.verification === 'report' && (
                                        <div className="mt-1.5 pl-[26px] space-y-1.5">
                                          {reportRejection[t.id] && (
                                            <p className="text-[9px] text-rose-300/90 italic">↳ {reportRejection[t.id]}</p>
                                          )}
                                          <textarea
                                            value={reportDrafts[t.id] || ''}
                                            onChange={(e) => setReportDrafts((prev) => ({ ...prev, [t.id]: e.target.value }))}
                                            placeholder="Report what you actually did — THEIA verifies it, not a checkbox."
                                            rows={2}
                                            disabled={submittingReportsForWave === m.id}
                                            className="w-full bg-black/50 border border-white/25 rounded-[2px] px-2 py-1.5 text-[10px] text-white placeholder:text-white/30 focus:border-cyan-400 focus:outline-none resize-none disabled:opacity-50"
                                          />
                                        </div>
                                      )}
                                      {!t.completed && gate.status !== 'cleared' && unlocked && t.verification === 'quiz' && (
                                        <div className="mt-1.5 pl-[26px] space-y-1.5">
                                          {!quizzes[t.id] ? (
                                            <button
                                              type="button"
                                              onClick={() => handleStartQuiz(m, t)}
                                              disabled={generatingQuizFor === t.id}
                                              className="w-full flex items-center justify-center gap-1.5 py-1.5 border border-cyan-400/50 bg-cyan-950/30 hover:bg-cyan-900/40 text-cyan-300 text-[9px] font-bold tracking-wider rounded-[2px] disabled:opacity-40 transition-all"
                                            >
                                              {generatingQuizFor === t.id ? (
                                                <>
                                                  <Sparkles className="w-3 h-3 animate-spin" /> THEIA IS PREPARING THE QUIZ...
                                                </>
                                              ) : (
                                                '[ START QUIZ ]'
                                              )}
                                            </button>
                                          ) : (
                                            (() => {
                                              const quiz = quizzes[t.id];
                                              const idx = quizIndex[t.id] || 0;
                                              const q = quiz[idx];
                                              const answers = quizAnswers[t.id] || [];
                                              const isLast = idx === quiz.length - 1;
                                              return (
                                                <div className="space-y-1.5">
                                                  <div className="text-[9px] text-cyan-300/70">
                                                    QUESTION {idx + 1}/{quiz.length}
                                                  </div>
                                                  <p className="text-[10px] text-white">{q.question}</p>
                                                  {q.type === 'free_response' ? (
                                                    <textarea
                                                      value={answers[idx] || ''}
                                                      onChange={(e) => {
                                                        const next = [...answers];
                                                        next[idx] = e.target.value;
                                                        setQuizAnswers((prev) => ({ ...prev, [t.id]: next }));
                                                      }}
                                                      placeholder="Type your answer..."
                                                      rows={2}
                                                      className="w-full bg-black/50 border border-white/25 rounded-[2px] px-2 py-1.5 text-[10px] text-white placeholder:text-white/30 focus:border-cyan-400 focus:outline-none resize-none"
                                                    />
                                                  ) : (
                                                    <div className="space-y-1">
                                                      {q.options.map((opt) => (
                                                        <button
                                                          key={opt}
                                                          type="button"
                                                          onClick={() => {
                                                            const next = [...answers];
                                                            next[idx] = opt;
                                                            setQuizAnswers((prev) => ({ ...prev, [t.id]: next }));
                                                          }}
                                                          className={`w-full text-left px-2 py-1.5 rounded-[2px] border text-[10px] transition-all ${
                                                            answers[idx] === opt
                                                              ? 'border-cyan-400 bg-cyan-950/40 text-white'
                                                              : 'border-white/20 bg-black/30 text-white/70 hover:border-white/40'
                                                          }`}
                                                        >
                                                          {opt}
                                                        </button>
                                                      ))}
                                                    </div>
                                                  )}
                                                  <button
                                                    type="button"
                                                    onClick={() =>
                                                      isLast
                                                        ? handleSubmitQuiz(m, t)
                                                        : setQuizIndex((prev) => ({ ...prev, [t.id]: idx + 1 }))
                                                    }
                                                    disabled={!(answers[idx] || '').trim() || submittingQuizFor === t.id}
                                                    className="w-full flex items-center justify-center gap-1.5 py-1.5 border border-cyan-400/50 bg-cyan-950/30 hover:bg-cyan-900/40 text-cyan-300 text-[9px] font-bold tracking-wider rounded-[2px] disabled:opacity-40 transition-all"
                                                  >
                                                    {submittingQuizFor === t.id ? (
                                                      <>
                                                        <Sparkles className="w-3 h-3 animate-spin" /> THEIA IS GRADING...
                                                      </>
                                                    ) : isLast ? (
                                                      '[ SUBMIT QUIZ ]'
                                                    ) : (
                                                      '[ NEXT QUESTION ]'
                                                    )}
                                                  </button>
                                                </div>
                                              );
                                            })()
                                          )}
                                        </div>
                                      )}
                                      {!t.completed && gate.status !== 'cleared' && t.verification !== 'report' && t.verification !== 'quiz' && (
                                        <div className="mt-1.5 pl-[26px]">
                                          {unlocked ? (
                                            t.linkedTodoId ? (
                                              <span className="inline-flex items-center gap-1 text-[9px] text-emerald-300 border border-emerald-500/40 bg-emerald-950/30 px-1.5 py-0.5 rounded-[2px]">
                                                <Check className="w-2.5 h-2.5" /> SCHEDULED IN TODAY'S TO-DOS
                                              </span>
                                            ) : (
                                              <span className="inline-flex items-center gap-1 text-[9px] text-cyan-300/60">
                                                <Sparkles className="w-2.5 h-2.5" /> scheduling...
                                              </span>
                                            )
                                          ) : (
                                            <span className="inline-flex items-center gap-1 text-[9px] text-white/35">
                                              <Lock className="w-2.5 h-2.5" /> UNLOCKS TOMORROW
                                            </span>
                                          )}
                                        </div>
                                      )}
                                      {!t.completed &&
                                        gate.status !== 'cleared' &&
                                        !unlocked &&
                                        (t.verification === 'report' || t.verification === 'quiz') && (
                                          <div className="mt-1.5 pl-[26px]">
                                            <span className="inline-flex items-center gap-1 text-[9px] text-white/35">
                                              <Lock className="w-2.5 h-2.5" /> UNLOCKS TOMORROW
                                            </span>
                                          </div>
                                        )}
                                    </div>
                                  );
                                })}

                                {sealedTaskCount > 0 && (
                                  <div className="text-[9px] text-white/30 flex items-center gap-1.5 pl-1">
                                    <Lock className="w-2.5 h-2.5" />
                                    {sealedTaskCount} more task{sealedTaskCount === 1 ? '' : 's'} sealed in this Wave
                                  </div>
                                )}

                                {/* One button grades every filled-in report above in a single AI
                                    call — fill in just 1 and only that 1 gets verified, fill in
                                    all of them and all get verified together. Never per-task. */}
                                {(() => {
                                  const reportTasks = m.tasks.filter((t) => t.verification === 'report' && !t.completed);
                                  if (reportTasks.length === 0) return null;
                                  const hasAnyDraft = reportTasks.some((t) => (reportDrafts[t.id] || '').trim().length > 0);
                                  return (
                                    <button
                                      type="button"
                                      onClick={() => handleSubmitWaveReports(m)}
                                      disabled={!hasAnyDraft || submittingReportsForWave === m.id}
                                      className="w-full flex items-center justify-center gap-1.5 py-2 border border-cyan-400/50 bg-cyan-950/30 hover:bg-cyan-900/40 text-cyan-300 text-[9px] font-bold tracking-wider rounded-[2px] disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                                    >
                                      {submittingReportsForWave === m.id ? (
                                        <>
                                          <Sparkles className="w-3 h-3 animate-spin" /> THEIA IS VERIFYING...
                                        </>
                                      ) : (
                                        '[ SUBMIT REPORTS ]'
                                      )}
                                    </button>
                                  );
                                })()}
                              </>
                            );
                          })()
                        )}
                      </div>
                    )}
                  </div>
                );
              })}

              {sealedCount > 0 && (
                <div className="border border-dashed border-white/15 bg-black/20 rounded-[2px] p-2.5 text-center">
                  <span className="text-[10px] text-white/40 flex items-center justify-center gap-1.5">
                    <Lock className="w-3 h-3" />
                    {sealedCount} more Wave{sealedCount === 1 ? '' : 's'} sealed — clear the current one to reveal
                    {sealedCount === 1 ? ' it' : ' the next'}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleDelete}
              className="py-2 px-3 border border-rose-500/40 bg-rose-950/30 hover:bg-rose-900/40 text-rose-300 rounded-[2px] text-[11px] font-bold tracking-wider transition-all flex items-center gap-1.5"
            >
              <Trash2 className="w-3.5 h-3.5" />
              [ ABANDON ]
            </button>
            <button
              type="button"
              onClick={handleClearGate}
              disabled={!allWavesCleared || gate.status === 'cleared'}
              className={`flex-1 py-2 border-2 rounded-[2px] text-xs font-bold tracking-widest transition-all ${
                gate.status === 'cleared'
                  ? 'border-emerald-500/40 text-emerald-400/70 bg-emerald-950/30'
                  : allWavesCleared
                    ? 'border-emerald-400 bg-emerald-950/70 text-emerald-300 hover:bg-emerald-900 shadow-[0_0_14px_rgba(52,211,153,0.4)]'
                    : 'border-white/20 text-white/30 bg-black/40 cursor-not-allowed'
              }`}
            >
              {gate.status === 'cleared' ? '[ GATE CLEARED ]' : '[ CLEAR GATE ]'}
            </button>
          </div>
        </div>
      </main>

      {reward && (
        <div className="modal-safe-pad fixed inset-0 z-[60] flex items-center justify-center bg-black/85 backdrop-blur-md animate-fade-in font-mono">
          <div className="relative max-w-[440px] w-full bg-[#0a1b2e] border-2 border-cyan-400 p-6 sm:p-8 rounded-[4px] shadow-[0_0_50px_rgba(0,212,255,0.7),inset_0_0_30px_rgba(0,212,255,0.2)] text-white text-center space-y-4 anime-dropdown">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-cyan-950/80 border border-cyan-400/80 rounded-full text-cyan-300 text-xs font-bold tracking-wider anime-glow-text">
              <Sparkles className="w-4 h-4 text-cyan-400" />
              GATE CLEARED
            </div>

            <h3 className="text-xl sm:text-2xl font-bold font-sans tracking-wide text-white anime-glow-text">
              {gate.title.toUpperCase()}
            </h3>

            <div className="text-xs text-gray-300 space-y-2 py-2 border-y border-white/20">
              <div className="flex items-center justify-between text-amber-200">
                <span className="flex items-center gap-1.5">
                  <Zap className="w-3.5 h-3.5" /> [ EXP AWARDED ]
                </span>
                <span className="font-bold text-amber-300">+{reward.xpAwarded}</span>
              </div>
              <div className="flex items-center justify-between text-cyan-200">
                <span>[ BLESSING ]</span>
                <span className="font-bold text-cyan-300">
                  +{reward.blessingAmount} {reward.blessingAttribute} (permanent)
                </span>
              </div>
              <div className="flex items-center justify-between text-emerald-200">
                <span className="flex items-center gap-1.5">
                  <Award className="w-3.5 h-3.5" /> [ TITLE UNLOCKED ]
                </span>
                <span className="font-bold text-emerald-300">{reward.titleUnlocked}</span>
              </div>
            </div>

            <p className="text-[11px] text-white/70 italic">
              "A campaign closed. The System records this Blessing as permanent — it does not fade."
            </p>

            <button
              onClick={() => {
                systemSound.playClick();
                setReward(null);
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
}
