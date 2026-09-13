import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  getGateById,
  toggleGateMilestone,
  linkGateMilestoneToTodo,
  clearGate,
  deleteGate,
  GATES_UPDATED_EVENT,
  type Gate,
  type GateClearReward,
} from '@/lib/gates';
import { getToDos, addToDo, TODOS_UPDATED_EVENT, getTodayKeyLocal } from '@/lib/storage';
import { systemSound } from '@/lib/system-sound';
import { ArrowLeft, DoorOpen, Check, Trash2, Skull, Sparkles, Award, Zap, CalendarPlus, Lock } from 'lucide-react';
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

  useEffect(() => {
    const reload = () => setGate(id ? getGateById(id) : null);
    reload();
    window.addEventListener(GATES_UPDATED_EVENT, reload);
    return () => window.removeEventListener(GATES_UPDATED_EVENT, reload);
  }, [id]);

  // A Wave scheduled as a To-Do auto-verifies here once that To-Do is completed elsewhere in
  // the app — reconciled on mount and whenever any To-Do changes, rather than the reverse
  // (storage.ts reaching into gates.ts), which would create a circular dependency.
  useEffect(() => {
    const reconcile = () => {
      if (!id) return;
      const current = getGateById(id);
      if (!current) return;
      const todos = getToDos();
      current.milestones.forEach((m) => {
        if (m.completed || !m.linkedTodoId) return;
        const linkedTodo = todos.find((t) => t.id === m.linkedTodoId);
        if (linkedTodo?.status === 'completed') {
          toggleGateMilestone(current.id, m.id);
          systemSound.playSuccess();
          toast.success('WAVE AUTO-VERIFIED', {
            description: `"${m.label}" confirmed complete via its linked To-Do.`,
          });
        }
      });
    };
    reconcile();
    window.addEventListener(TODOS_UPDATED_EVENT, reconcile);
    return () => window.removeEventListener(TODOS_UPDATED_EVENT, reconcile);
  }, [id]);

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
  const rankColor = RANK_COLOR[gate.rank] || '#9fd3ff';
  const daysRemaining = Math.ceil((new Date(gate.targetDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24));

  const handleToggleMilestone = (milestoneId: string) => {
    systemSound.playClick();
    // toggleGateMilestone persists + dispatches GATES_UPDATED_EVENT, which the effect
    // above already listens for, so state refreshes on its own.
    toggleGateMilestone(gate.id, milestoneId);
  };

  const handleScheduleAsTodo = (milestoneId: string, label: string) => {
    systemSound.playClick();
    const todo = addToDo({
      title: label,
      dueDate: getTodayKeyLocal(),
      origin: 'user',
      xp: 10,
      hiddenRewards: {},
    });
    linkGateMilestoneToTodo(gate.id, milestoneId, todo.id);
    toast.success('WAVE SCHEDULED', {
      description: `"${label}" added to today's To-Dos — find it under Daily Quest → Tactical To-Dos (expand that row to see it).`,
      action: {
        label: 'OPEN',
        onClick: () => navigate('/?view=quests'),
      },
    });
  };

  const handleClearGate = () => {
    if (!allWavesCleared || gate.status === 'cleared') return;
    const result = clearGate(gate.id);
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
                      </div>
                      <button
                        type="button"
                        onClick={() => handleToggleMilestone(m.id)}
                        disabled={gate.status === 'cleared'}
                        className={`w-6 h-6 shrink-0 border-2 rounded-[2px] flex items-center justify-center transition-all disabled:opacity-50 ${
                          m.completed
                            ? 'border-emerald-400 bg-emerald-950/60 text-emerald-300'
                            : 'border-white/30 bg-black/50 text-white/20 hover:border-cyan-400/60'
                        }`}
                      >
                        {m.completed ? <Check className="w-3.5 h-3.5 stroke-[3]" /> : null}
                      </button>
                    </div>

                    {m.hint && !m.completed && (
                      <p className="text-[10px] text-cyan-300/70 italic mt-1 pl-[22px]">↳ {m.hint}</p>
                    )}

                    {!m.completed && gate.status !== 'cleared' && (
                      <div className="mt-1.5 pl-[22px]">
                        {m.linkedTodoId ? (
                          <span className="text-[9px] text-white/40">[ ✓ scheduled in today's To-Dos ]</span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleScheduleAsTodo(m.id, m.label)}
                            className="flex items-center gap-1 text-[9px] text-cyan-300/80 hover:text-cyan-200 transition-colors"
                          >
                            <CalendarPlus className="w-3 h-3" /> [ SCHEDULE AS TO-DO ]
                          </button>
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fade-in font-mono">
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
