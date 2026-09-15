import { useEffect, useState } from 'react';
import {
  Seal,
  getSeals,
  createSeal,
  logSlip,
  deleteSeal,
  updateSealPlan,
  assessSeal,
  startUrgeTimer,
  cancelUrgeTimer,
  resolveUrgeTimer,
  getUrgeTimerMinutes,
  acknowledgeSealEvents,
  addWard,
  toggleWard,
  removeWard,
  SEALS_UPDATED_EVENT,
  type SealRank,
  type SealAssessment,
} from '@/lib/seals';
import { systemSound } from '@/lib/system-sound';
import { toast } from 'sonner';
import {
  ShieldAlert,
  AlertTriangle,
  Trash2,
  Plus,
  Pencil,
  Check,
  X,
  Sparkles,
  Zap,
  Clock,
  ShieldCheck,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

const RANK_COLOR: Record<SealRank, string> = {
  E: 'text-gray-400 border-gray-500/40',
  D: 'text-emerald-300 border-emerald-500/40',
  C: 'text-cyan-300 border-cyan-500/40',
  B: 'text-blue-300 border-blue-500/40',
  A: 'text-purple-300 border-purple-500/40',
  S: 'text-amber-300 border-amber-400/50',
};

const RANK_BAR_COLOR: Record<SealRank, string> = {
  E: 'bg-gray-500',
  D: 'bg-emerald-500',
  C: 'bg-cyan-500',
  B: 'bg-blue-500',
  A: 'bg-purple-500',
  S: 'bg-amber-400',
};

const daysClean = (streakStartedAt: string): number =>
  Math.max(0, Math.floor((Date.now() - new Date(streakStartedAt).getTime()) / 86_400_000));

const URGE_TIMER_MS = getUrgeTimerMinutes() * 60_000;

export default function SealsPanel() {
  const [seals, setSeals] = useState<Seal[]>(() => getSeals());
  const [now, setNow] = useState(Date.now());
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [newCue, setNewCue] = useState('');
  const [newPlan, setNewPlan] = useState('');
  const [assessing, setAssessing] = useState(false);
  const [assessment, setAssessment] = useState<SealAssessment | null>(null);
  const [editingPlanId, setEditingPlanId] = useState<string | null>(null);
  const [planDraft, setPlanDraft] = useState('');
  const [expandedWardsId, setExpandedWardsId] = useState<string | null>(null);
  const [wardDraft, setWardDraft] = useState('');

  useEffect(() => {
    const sync = () => setSeals(getSeals());
    window.addEventListener(SEALS_UPDATED_EVENT, sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener(SEALS_UPDATED_EVENT, sync);
      window.removeEventListener('storage', sync);
    };
  }, []);

  // Live 1s ticker, only while at least one Seal has an urge timer running — same pattern as
  // SoloInventoryModal's cooldown countdown.
  useEffect(() => {
    if (!seals.some((s) => s.activeUrgeStartedAt)) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [seals]);

  // Celebrates a Rank-Up/Arisen exactly once — driven by the synced `lastAcknowledgedEventId`
  // on the Seal itself, not a local-only "seen" key, so it can't replay on a new device or a
  // reinstalled PWA the way a local-only marker did earlier for the Hunter Rank ceremony.
  useEffect(() => {
    seals.forEach((seal) => {
      const lastEvent = seal.events[seal.events.length - 1];
      if (!lastEvent || lastEvent.id === seal.lastAcknowledgedEventId) return;
      if (lastEvent.type === 'rankUp' || lastEvent.type === 'arisen') {
        systemSound.playLevelUp();
        toast.success(lastEvent.type === 'arisen' ? '[ SEAL ARISEN ]' : '[ SEAL RANK UP ]', {
          description: lastEvent.message,
        });
      }
      acknowledgeSealEvents(seal.id);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seals]);

  const canAssess = newName.trim().length > 0 && newCue.trim().length > 0;

  const handleAssess = async (forceAlgorithmic = false) => {
    if (!canAssess || assessing) return;
    systemSound.playClick();
    setAssessing(true);
    try {
      const result = await assessSeal({ name: newName, cue: newCue, ifThenPlan: newPlan }, { forceAlgorithmic });
      setAssessment(result);
      toast.success(forceAlgorithmic ? 'PRECISION ESTIMATE COMPILED (0 TOKENS)' : 'THEIA ASSESSMENT COMPLETE');
    } finally {
      setAssessing(false);
    }
  };

  const handleUseSuggestedPlan = () => {
    if (!assessment) return;
    systemSound.playClick();
    setNewPlan(assessment.suggestedPlan);
  };

  const resetCreateForm = () => {
    setNewName('');
    setNewCue('');
    setNewPlan('');
    setAssessment(null);
    setCreating(false);
  };

  const handleCreate = () => {
    if (!newName.trim() || !newCue.trim() || !assessment) {
      toast.error('Request a System Assessment before forging the Seal.');
      return;
    }
    systemSound.playLevelUp();
    createSeal(newName, newCue, assessment.threatRank, newPlan);
    toast.success(`Seal forged. THEIA reads Threat Rank ${assessment.threatRank} — hold the line.`);
    resetCreateForm();
  };

  const handleSlip = (seal: Seal) => {
    const confirmed = window.confirm(
      `Log a slip for "${seal.name}"? This resets the current streak and dents Integrity — it will never destroy the Seal.`
    );
    if (!confirmed) return;
    systemSound.playSystemChime();
    logSlip(seal.id);
    toast('Logged honestly. The Seal held.', { description: 'Integrity dented, not destroyed — begin again.' });
  };

  const handleDelete = (seal: Seal) => {
    const confirmed = window.confirm(`Remove the Seal on "${seal.name}"? This deletes its whole history — cannot be undone.`);
    if (!confirmed) return;
    systemSound.playClick();
    deleteSeal(seal.id);
  };

  const handleStartUrge = (seal: Seal) => {
    systemSound.playSystemChime();
    startUrgeTimer(seal.id);
    toast(`${getUrgeTimerMinutes()}-minute hold started.`, {
      description: seal.ifThenPlan ? `Your plan: ${seal.ifThenPlan}` : 'The urge passes faster than it feels like it will.',
    });
  };

  const handleCancelUrge = (seal: Seal) => {
    systemSound.playClick();
    cancelUrgeTimer(seal.id);
  };

  const handleResolveUrge = (seal: Seal, outcome: 'held' | 'slipped') => {
    if (outcome === 'slipped') {
      const confirmed = window.confirm(
        `Log a slip for "${seal.name}"? This resets the current streak and dents Integrity — it will never destroy the Seal.`
      );
      if (!confirmed) return;
      systemSound.playSystemChime();
      resolveUrgeTimer(seal.id, 'slipped');
      toast('Logged honestly. The Seal held.', { description: 'Integrity dented, not destroyed — begin again.' });
      return;
    }
    systemSound.playLevelUp();
    resolveUrgeTimer(seal.id, 'held');
    toast.success('Urge weathered.', { description: 'It passed. Integrity nudged up for holding through it.' });
  };

  const handleAddWard = (sealId: string) => {
    if (!wardDraft.trim()) return;
    systemSound.playClick();
    addWard(sealId, wardDraft);
    setWardDraft('');
  };

  const startEditPlan = (seal: Seal) => {
    setEditingPlanId(seal.id);
    setPlanDraft(seal.ifThenPlan || '');
  };

  const saveEditPlan = (sealId: string) => {
    updateSealPlan(sealId, planDraft);
    setEditingPlanId(null);
  };

  return (
    <div className="space-y-3">
      <p className="text-[10px] text-white/50 leading-relaxed">
        Name a weakness, name what triggers it, and pre-commit a plan for when that trigger hits. A slip is logged
        honestly and never punished — Integrity dents, it doesn't shatter.
      </p>

      {seals.length === 0 && !creating && (
        <div className="text-[11px] text-white/40 italic p-3 border border-dashed border-white/15 rounded-[2px] text-center">
          No Seals forged yet.
        </div>
      )}

      <div className="space-y-2.5">
        {seals.map((seal) => {
          const clean = daysClean(seal.streakStartedAt);
          const recentEvents = seal.events.slice(-2).reverse();
          return (
            <div
              key={seal.id}
              className="border border-white/25 bg-[#061424]/85 rounded-[2px] p-3 space-y-2"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <ShieldAlert className="w-4 h-4 text-cyan-400 shrink-0" />
                  <span className="font-bold text-xs text-white truncate">{seal.name}</span>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <span
                    className="text-[9px] border border-white/15 px-1.5 py-0.5 bg-black/40 text-white/40"
                    title="THEIA's one-time read on how entrenched this weakness is — tunes recovery speed and slip cost"
                  >
                    THREAT {seal.threatRank}
                  </span>
                  <span className={`text-[10px] border px-1.5 py-0.5 bg-black/40 font-bold ${RANK_COLOR[seal.rank]}`}>
                    {seal.rank}-RANK
                  </span>
                  <button
                    type="button"
                    onClick={() => handleDelete(seal)}
                    className="w-6 h-6 flex items-center justify-center text-white/30 hover:text-rose-400 transition-colors"
                    title="Remove Seal"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              <div className="text-[10px] text-white/50">
                Trigger: <span className="text-white/70">{seal.cue}</span>
              </div>

              {/* Integrity bar */}
              <div className="space-y-1">
                <div className="flex items-center justify-between text-[9px] text-white/40 font-mono">
                  <span>INTEGRITY</span>
                  <span>{seal.integrity}%</span>
                </div>
                <div className="h-1.5 w-full bg-black/50 rounded-full overflow-hidden">
                  <div
                    className={`h-full ${RANK_BAR_COLOR[seal.rank]} transition-all`}
                    style={{ width: `${seal.integrity}%` }}
                  />
                </div>
              </div>

              <div className="flex items-center justify-between text-[10px] text-white/50">
                <span>{clean} day{clean === 1 ? '' : 's'} clean</span>
                <span>{seal.totalSlips} slip{seal.totalSlips === 1 ? '' : 's'} logged</span>
              </div>

              {/* If-then plan */}
              {editingPlanId === seal.id ? (
                <div className="flex items-center gap-1.5">
                  <input
                    type="text"
                    value={planDraft}
                    onChange={(e) => setPlanDraft(e.target.value)}
                    placeholder="When [trigger], I will [replacement action]..."
                    className="flex-1 min-w-0 bg-black/60 border border-white/30 rounded-[2px] px-2 py-1 text-[11px] text-white placeholder:text-white/30 focus:border-cyan-400 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => saveEditPlan(seal.id)}
                    className="w-6 h-6 flex items-center justify-center text-emerald-400 hover:text-emerald-300"
                  >
                    <Check className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingPlanId(null)}
                    className="w-6 h-6 flex items-center justify-center text-white/40 hover:text-white"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => startEditPlan(seal)}
                  className="w-full text-left text-[10px] text-white/50 hover:text-white/80 flex items-start gap-1.5 border border-white/10 hover:border-white/25 rounded-[2px] px-2 py-1.5 transition-colors"
                >
                  <Pencil className="w-3 h-3 mt-0.5 shrink-0 text-white/30" />
                  {seal.ifThenPlan ? (
                    <span>
                      <span className="text-cyan-300/80">Plan:</span> {seal.ifThenPlan}
                    </span>
                  ) : (
                    <span className="italic">Add an if-then plan for when the trigger hits...</span>
                  )}
                </button>
              )}

              {/* Wards — environment/friction changes against the cue itself, collapsible */}
              <div className="border border-white/10 rounded-[2px] overflow-hidden">
                <button
                  type="button"
                  onClick={() => setExpandedWardsId(expandedWardsId === seal.id ? null : seal.id)}
                  className="w-full flex items-center justify-between px-2 py-1.5 hover:bg-white/5 transition-colors text-left"
                >
                  <span className="text-[9px] text-white/50 flex items-center gap-1.5">
                    <ShieldCheck className="w-3 h-3 text-emerald-400/70" />
                    WARDS ({seal.wards.filter((w) => w.active).length} active)
                  </span>
                  {expandedWardsId === seal.id ? (
                    <ChevronUp className="w-3 h-3 text-white/30" />
                  ) : (
                    <ChevronDown className="w-3 h-3 text-white/30" />
                  )}
                </button>
                {expandedWardsId === seal.id && (
                  <div className="p-2 pt-0 space-y-1.5">
                    <p className="text-[9px] text-white/35 leading-relaxed">
                      Removing the cue itself works better than resisting it — each active Ward adds a small
                      Integrity regen bonus.
                    </p>
                    {seal.wards.map((ward) => (
                      <div key={ward.id} className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => toggleWard(seal.id, ward.id)}
                          className={`flex-1 min-w-0 text-left text-[10px] px-2 py-1 rounded-[2px] border transition-colors truncate ${
                            ward.active
                              ? 'border-emerald-500/40 bg-emerald-950/20 text-emerald-200'
                              : 'border-white/10 bg-black/20 text-white/35 line-through'
                          }`}
                        >
                          {ward.label}
                        </button>
                        <button
                          type="button"
                          onClick={() => removeWard(seal.id, ward.id)}
                          className="w-6 h-6 shrink-0 flex items-center justify-center text-white/25 hover:text-rose-400"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                    <div className="flex items-center gap-1.5">
                      <input
                        type="text"
                        value={wardDraft}
                        onChange={(e) => setWardDraft(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleAddWard(seal.id);
                        }}
                        placeholder="e.g. Phone charges outside the bedroom after 9pm"
                        className="flex-1 min-w-0 bg-black/60 border border-white/20 rounded-[2px] px-2 py-1 text-[10px] text-white placeholder:text-white/25 focus:border-emerald-400 focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => handleAddWard(seal.id)}
                        className="w-6 h-6 shrink-0 flex items-center justify-center text-emerald-400 hover:text-emerald-300"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Recent log */}
              {recentEvents.length > 0 && (
                <div className="space-y-0.5 pt-1 border-t border-white/5">
                  {recentEvents.map((ev) => (
                    <p key={ev.id} className="text-[9px] text-white/35 font-mono truncate">
                      {ev.message}
                    </p>
                  ))}
                </div>
              )}

              {/* Urge-surfing (the 10-minute rule) vs. an immediate honest slip report */}
              {seal.activeUrgeStartedAt ? (
                (() => {
                  const elapsedMs = now - new Date(seal.activeUrgeStartedAt).getTime();
                  const remainingMs = Math.max(0, URGE_TIMER_MS - elapsedMs);
                  const remainingSec = Math.ceil(remainingMs / 1000);
                  const mm = Math.floor(remainingSec / 60);
                  const ss = remainingSec % 60;
                  const timerDone = remainingMs <= 0;
                  return (
                    <div className="border border-cyan-500/30 bg-cyan-950/20 rounded-[2px] p-2.5 space-y-2 text-center">
                      <div className="flex items-center justify-center gap-1.5 text-cyan-300 font-mono">
                        <Clock className={`w-3.5 h-3.5 ${timerDone ? '' : 'animate-pulse'}`} />
                        <span className="text-lg font-bold">
                          {timerDone ? "TIME'S UP" : `${mm}:${ss < 10 ? `0${ss}` : ss}`}
                        </span>
                      </div>
                      {seal.ifThenPlan && (
                        <p className="text-[10px] text-white/60 italic">"{seal.ifThenPlan}"</p>
                      )}
                      {timerDone ? (
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleResolveUrge(seal, 'held')}
                            className="flex-1 py-1.5 border border-emerald-500/50 bg-emerald-950/40 hover:bg-emerald-900/50 text-emerald-300 rounded-[2px] text-[10px] font-bold tracking-wider"
                          >
                            IT PASSED
                          </button>
                          <button
                            type="button"
                            onClick={() => handleResolveUrge(seal, 'slipped')}
                            className="flex-1 py-1.5 border border-rose-500/30 bg-rose-950/20 hover:bg-rose-950/40 text-rose-300/80 rounded-[2px] text-[10px] font-bold tracking-wider"
                          >
                            I SLIPPED
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleCancelUrge(seal)}
                          className="text-[9px] text-white/30 hover:text-white/60 underline"
                        >
                          cancel
                        </button>
                      )}
                    </div>
                  );
                })()
              ) : (
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => handleStartUrge(seal)}
                    className="flex-1 py-1.5 border border-cyan-500/40 bg-cyan-950/20 hover:bg-cyan-950/40 text-cyan-300 rounded-[2px] text-[10px] font-bold tracking-wider flex items-center justify-center gap-1.5 transition-colors"
                    title={`Start a ${getUrgeTimerMinutes()}-minute hold — most urges pass on their own within it`}
                  >
                    <Clock className="w-3 h-3" />
                    FEELING THE PULL?
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSlip(seal)}
                    className="flex-1 py-1.5 border border-rose-500/30 bg-rose-950/20 hover:bg-rose-950/40 text-rose-300/80 hover:text-rose-300 rounded-[2px] text-[10px] font-bold tracking-wider flex items-center justify-center gap-1.5 transition-colors"
                  >
                    <AlertTriangle className="w-3 h-3" />
                    I SLIPPED
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {creating ? (
        <div className="border border-cyan-500/30 bg-cyan-950/10 rounded-[2px] p-3 space-y-2">
          <input
            type="text"
            value={newName}
            onChange={(e) => {
              setNewName(e.target.value);
              setAssessment(null);
            }}
            placeholder="Weakness to seal (e.g. Doomscrolling after midnight)"
            className="w-full bg-black/60 border border-white/30 rounded-[2px] px-2.5 py-1.5 text-xs text-white placeholder:text-white/30 focus:border-cyan-400 focus:outline-none"
          />
          <input
            type="text"
            value={newCue}
            onChange={(e) => {
              setNewCue(e.target.value);
              setAssessment(null);
            }}
            placeholder="Its trigger (time, place, or feeling)"
            className="w-full bg-black/60 border border-white/30 rounded-[2px] px-2.5 py-1.5 text-xs text-white placeholder:text-white/30 focus:border-cyan-400 focus:outline-none"
          />
          <input
            type="text"
            value={newPlan}
            onChange={(e) => {
              setNewPlan(e.target.value);
              setAssessment(null);
            }}
            placeholder="Optional: when [trigger], I will [replacement]..."
            className="w-full bg-black/60 border border-white/30 rounded-[2px] px-2.5 py-1.5 text-xs text-white placeholder:text-white/30 focus:border-cyan-400 focus:outline-none"
          />

          {/* THEIA assessment request — mirrors Gate creation's flow. Forging is gated on this
              having run at least once, same as a Gate can't be declared without an assessment. */}
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => handleAssess(true)}
              disabled={!canAssess || assessing}
              className="py-2 px-3 border border-emerald-500/50 bg-emerald-950/50 hover:bg-emerald-900/60 text-emerald-300 font-mono text-[10px] font-bold tracking-wider rounded-[2px] transition-all flex items-center justify-center gap-1 disabled:opacity-40"
              title="Precision estimate, no LLM call (0 tokens)"
            >
              <Zap className="w-3 h-3 text-emerald-400" />
              [ 0 TOKENS ]
            </button>
            <button
              type="button"
              onClick={() => handleAssess(false)}
              disabled={!canAssess || assessing}
              className="flex-1 py-2 px-3 border-2 border-cyan-400/60 bg-cyan-950/50 hover:bg-cyan-900/60 text-cyan-300 font-mono text-[11px] font-bold tracking-widest rounded-[2px] transition-all flex items-center justify-center gap-1.5 disabled:opacity-40"
            >
              <Sparkles className={`w-3.5 h-3.5 ${assessing ? 'animate-spin' : ''}`} />
              <span>{assessing ? '[ ANALYZING... ]' : '[ REQUEST THEIA ASSESSMENT ]'}</span>
            </button>
          </div>

          {assessment && (
            <div className="border border-cyan-500/30 bg-[#07172b]/70 rounded-[2px] p-2.5 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] tracking-[0.2em] text-cyan-300/80">THEIA ASSESSMENT</span>
                <span className="text-[9px] text-white/50">
                  {assessment.origin === 'system' ? 'PRECISION ENGINE' : 'AI ADAPTED'}
                </span>
              </div>
              <p className="text-[11px] text-white/85 leading-relaxed italic">"{assessment.rationale}"</p>
              <div className="flex items-center gap-1.5 text-[10px]">
                <span className="text-white/50">Threat Rank:</span>
                <span className="font-bold text-amber-300">{assessment.threatRank}</span>
              </div>

              {!assessment.cueSpecificEnough && assessment.cueFeedback && (
                <div className="border border-amber-500/40 bg-amber-950/30 rounded-[2px] p-2 space-y-1">
                  <div className="flex items-center gap-1.5 text-amber-300 text-[10px] font-bold">
                    <AlertTriangle className="w-3 h-3" />
                    CUE TOO VAGUE
                  </div>
                  <p className="text-[10px] text-white/70">{assessment.cueFeedback}</p>
                </div>
              )}

              <button
                type="button"
                onClick={handleUseSuggestedPlan}
                className="w-full text-left border border-cyan-400/30 bg-cyan-950/20 hover:bg-cyan-950/40 rounded-[2px] p-2 space-y-0.5 transition-colors"
              >
                <div className="flex items-center gap-1.5 text-[9px] text-cyan-300/70 tracking-wider">
                  <Sparkles className="w-3 h-3" />
                  THEIA-CRAFTED PLAN — TAP TO USE
                </div>
                <p className="text-[11px] text-white">{assessment.suggestedPlan}</p>
              </button>
            </div>
          )}

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCreate}
              disabled={!assessment}
              className="flex-1 py-1.5 border-2 border-cyan-400 bg-cyan-950/80 hover:bg-cyan-900 text-cyan-300 hover:text-white rounded-[2px] text-[11px] font-bold tracking-wider disabled:opacity-40 disabled:cursor-not-allowed"
            >
              FORGE SEAL
            </button>
            <button
              type="button"
              onClick={resetCreateForm}
              className="px-3 py-1.5 border border-white/20 text-white/60 hover:text-white rounded-[2px] text-[11px]"
            >
              CANCEL
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => {
            systemSound.playClick();
            setCreating(true);
          }}
          className="w-full py-2 border border-cyan-500/40 bg-cyan-950/20 hover:bg-cyan-950/40 text-cyan-300 rounded-[2px] text-[11px] font-bold tracking-wider flex items-center justify-center gap-1.5"
        >
          <Plus className="w-3.5 h-3.5" />
          FORGE NEW SEAL
        </button>
      )}
    </div>
  );
}
