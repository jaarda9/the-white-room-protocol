import { useState } from 'react';
import { createPortal } from 'react-dom';
import {
  createGate,
  assessGate,
  RANK_ORDER,
  MIN_GATE_MILESTONES,
  type Gate,
  type GateDuration,
  type GateAssessment,
  type CreateGateMilestoneInput,
} from '@/lib/gates';
import { getHunterRank } from '@/lib/storage';
import type { Attributes, HunterRank, UserProfile } from '@/lib/types';
import { systemSound } from '@/lib/system-sound';
import { X, DoorOpen, Plus, Trash2, Check, Sparkles, AlertTriangle, ChevronDown, ChevronUp, ArrowLeft, Pencil } from 'lucide-react';
import { toast } from 'sonner';
import { useLockBodyScroll } from '@/hooks/use-lock-body-scroll';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onCreated: (gate: Gate) => void;
  profile: UserProfile;
}

/** Four timeframes instead of six: "under 2 weeks" folds into 2-4 weeks, "6-12 months" and
 * "over a year" into 6+ months. The value still sets the Gate's clock (see DURATION_DAYS). */
const TIMEFRAMES: Array<{ value: GateDuration; label: string }> = [
  { value: '2-4w', label: '2-4 weeks' },
  { value: '1-3m', label: '1-3 months' },
  { value: '3-6m', label: '3-6 months' },
  { value: '6-12m', label: '6+ months' },
];

const MAX_WAVES = 10;

interface Proposal {
  assessment: GateAssessment;
  title: string;
  bossCondition: string;
  rank: HunterRank;
  primaryAttribute: keyof Attributes;
  waves: CreateGateMilestoneInput[];
}

const inputClass =
  'w-full bg-black/60 border border-white/30 rounded-[2px] px-2.5 py-1.5 text-xs text-white focus:border-cyan-400 focus:outline-none';

/**
 * Declaring a Gate in two steps. The Hunter states the goal and a timeframe; THEIA proposes
 * everything else (designated name, Threat Rank, attribute, finish line, Waves), which the
 * Hunter reviews, optionally edits, and opens. A Gate still can't open without an assessment,
 * without at least MIN_GATE_MILESTONES Waves, or above the Hunter's rank clearance.
 */
export default function GateCreationModal({ isOpen, onClose, onCreated, profile }: Props) {
  const [goal, setGoal] = useState('');
  const [duration, setDuration] = useState<GateDuration>('1-3m');
  const [showDetails, setShowDetails] = useState(false);
  const [description, setDescription] = useState('');
  const [finishLine, setFinishLine] = useState('');
  const [assessing, setAssessing] = useState(false);
  const [proposal, setProposal] = useState<Proposal | null>(null);
  const [editing, setEditing] = useState(false);

  useLockBodyScroll(isOpen);

  if (!isOpen) return null;

  const hunterRank = getHunterRank(profile.level);
  const hunterRankIndex = RANK_ORDER.indexOf(hunterRank);

  const resetAndClose = () => {
    setGoal('');
    setDuration('1-3m');
    setShowDetails(false);
    setDescription('');
    setFinishLine('');
    setProposal(null);
    setEditing(false);
    onClose();
  };

  const canSummon = goal.trim().length >= 3 && !assessing;

  const handleSummon = async () => {
    if (!canSummon) return;
    systemSound.playClick();
    setAssessing(true);
    try {
      const result = await assessGate({ title: goal.trim(), description: description.trim(), bossCondition: finishLine.trim(), duration });
      const bossCondition = (result.refinedBossCondition || finishLine).trim();
      setProposal({
        assessment: result,
        title: (result.refinedTitle || goal).trim().slice(0, 120),
        bossCondition,
        rank: result.rank,
        primaryAttribute: result.primaryAttribute,
        waves: result.suggestedMilestones.map((m) => ({ label: m.label, hint: m.hint, attribute: m.attribute })).slice(0, MAX_WAVES),
      });
      setEditing(false);
      if (result.origin === 'system') {
        toast.info('[SYSTEM] Basic proposal compiled', {
          description: 'THEIA could not be reached, so the System built a simple plan. You can edit it, or go back and try again.',
        });
      } else {
        systemSound.playSystemChime();
      }
    } catch {
      toast.error('The assessment failed. Try again.');
    } finally {
      setAssessing(false);
    }
  };

  const updateProposal = (patch: Partial<Proposal>) => setProposal((prev) => (prev ? { ...prev, ...patch } : prev));
  const updateWave = (i: number, label: string) =>
    updateProposal({ waves: (proposal?.waves || []).map((w, idx) => (idx === i ? { ...w, label } : w)) });

  const filledWaves = (proposal?.waves || []).filter((w) => w.label.trim().length > 0);
  const rankLocked = proposal ? RANK_ORDER.indexOf(proposal.rank) > hunterRankIndex : false;
  const canOpen =
    Boolean(proposal) &&
    !rankLocked &&
    filledWaves.length >= MIN_GATE_MILESTONES &&
    Boolean(proposal?.title.trim()) &&
    Boolean(proposal?.bossCondition.trim());

  const handleOpen = () => {
    if (!proposal || !canOpen) return;
    systemSound.playLevelUp();
    const gate = createGate({
      title: proposal.title,
      description: description.trim(),
      rank: proposal.rank,
      bossCondition: proposal.bossCondition,
      primaryAttribute: proposal.primaryAttribute,
      milestones: filledWaves,
      duration,
      chainCategory: proposal.assessment.category,
      builtOnSkillId: proposal.assessment.builtOnSkillId,
    });
    toast.success('GATE DECLARED', { description: `"${gate.title}" is now an active campaign.` });
    onCreated(gate);
    resetAndClose();
  };

  // Portalled to <body> — see BiometricsCalibrationModal.tsx for why: an ancestor card using
  // .anime-dropdown or backdrop-blur-* silently traps a plain fixed-positioned backdrop inside
  // its own box instead of the real viewport.
  return createPortal(
    <div className="modal-safe-pad fixed inset-0 z-[60] bg-black/80 backdrop-blur-sm flex items-center justify-center animate-fade-in font-mono">
      <div className="relative max-w-[560px] w-full bg-[#0a1b2e]/95 border-2 border-white/50 rounded-[4px] p-4 sm:p-5 text-white shadow-[0_0_35px_rgba(0,0,0,0.9),inset_0_0_24px_rgba(0,212,255,0.08)] font-mono anime-dropdown modal-card-max-h flex flex-col my-auto">
        {/* Header */}
        <div className="flex items-center justify-between pb-2 mb-2 border-b border-white/15">
          <div className="flex items-center gap-2">
            <div className="px-3 py-1 border border-white/70 bg-[#061426]/70 shadow-[0_0_12px_rgba(0,212,255,0.3)] flex items-center gap-2">
              <DoorOpen className="w-3.5 h-3.5 text-[#9fd3ff]" />
              <span className="font-mono font-extrabold tracking-[0.24em] text-sm sm:text-base text-white anime-glow-text">
                {proposal ? "THEIA'S ASSESSMENT" : 'DECLARE GATE'}
              </span>
            </div>
            <span className="text-[10px] text-cyan-300/70 font-mono hidden sm:inline">[{proposal ? 'STEP 2/2' : 'STEP 1/2'}]</span>
          </div>
          <button
            type="button"
            aria-label="Close"
            onClick={() => {
              systemSound.playClick();
              resetAndClose();
            }}
            className="w-7 h-7 rounded-[2px] border border-white/30 hover:border-white/70 bg-black/40 hover:bg-white/10 text-white/70 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto pr-1 space-y-2.5 text-xs">
          {!proposal ? (
            <>
              {/* STEP 1 — the only things the Hunter has to decide */}
              <p className="text-[10px] text-white/50 leading-relaxed">
                A Gate is a real goal that takes weeks or months. Say what you want to achieve; THEIA designs the
                rest.
              </p>

              <div className="border border-white/30 bg-[#061424]/85 rounded-[2px] p-2.5">
                <label htmlFor="gate-goal" className="text-[10px] font-bold text-[#9fd3ff] tracking-wider block mb-1.5">
                  WHAT DO YOU WANT TO ACHIEVE?
                </label>
                <input
                  id="gate-goal"
                  type="text"
                  value={goal}
                  maxLength={160}
                  onChange={(e) => setGoal(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSummon();
                  }}
                  placeholder="e.g. Hold a 10-minute conversation in Spanish"
                  className={inputClass}
                />
              </div>

              <div className="border border-white/30 bg-[#061424]/85 rounded-[2px] p-2.5">
                <label className="text-[10px] font-bold text-[#9fd3ff] tracking-wider block mb-1.5">
                  HOW LONG DO YOU THINK IT TAKES?
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                  {TIMEFRAMES.map((t) => (
                    <button
                      key={t.value}
                      type="button"
                      aria-pressed={duration === t.value}
                      onClick={() => {
                        systemSound.playClick();
                        setDuration(t.value);
                      }}
                      className={`py-1.5 border rounded-[2px] text-[10px] font-bold transition-all ${
                        duration === t.value
                          ? 'border-cyan-400 bg-cyan-950/80 text-cyan-300 shadow-[0_0_8px_rgba(0,212,255,0.4)]'
                          : 'border-white/20 bg-black/40 text-white/60 hover:text-white'
                      }`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
                <p className="text-[9px] text-white/40 mt-1.5">
                  This is the Gate&apos;s clock. Unfinished past it, the Gate Breaches: still clearable, but logged with a
                  fatigue cost.
                </p>
              </div>

              <div className="border border-white/15 bg-[#061424]/50 rounded-[2px]">
                <button
                  type="button"
                  onClick={() => setShowDetails((v) => !v)}
                  className="w-full flex items-center justify-between px-2.5 py-2 text-[10px] text-white/60 hover:text-white"
                >
                  <span>ADD DETAILS (OPTIONAL)</span>
                  {showDetails ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                </button>
                {showDetails && (
                  <div className="px-2.5 pb-2.5 space-y-2">
                    <div>
                      <label htmlFor="gate-desc" className="text-[9px] text-white/50 block mb-1">
                        Context for THEIA (your level, constraints…)
                      </label>
                      <textarea
                        id="gate-desc"
                        value={description}
                        maxLength={800}
                        onChange={(e) => setDescription(e.target.value)}
                        rows={2}
                        placeholder="e.g. I know basic greetings; I can practice 30 minutes a day."
                        className={`${inputClass} resize-none`}
                      />
                    </div>
                    <div>
                      <label htmlFor="gate-finish" className="text-[9px] text-white/50 block mb-1">
                        Your finish line (THEIA writes one if you leave this empty)
                      </label>
                      <input
                        id="gate-finish"
                        type="text"
                        value={finishLine}
                        maxLength={300}
                        onChange={(e) => setFinishLine(e.target.value)}
                        placeholder="e.g. A 10-minute talk with a native speaker"
                        className={inputClass}
                      />
                    </div>
                  </div>
                )}
              </div>
            </>
          ) : (
            <>
              {/* STEP 2 — THEIA's proposal: review, optionally edit, open */}
              <div className="border border-cyan-500/40 bg-[#07172b]/80 rounded-[2px] p-3 space-y-2.5">
                <div className="flex items-start justify-between gap-2">
                  {editing ? (
                    <input
                      aria-label="Gate name"
                      type="text"
                      value={proposal.title}
                      maxLength={120}
                      onChange={(e) => updateProposal({ title: e.target.value })}
                      className={`${inputClass} font-bold`}
                    />
                  ) : (
                    <h3 className="text-sm font-extrabold tracking-wider text-white anime-glow-text uppercase min-w-0 break-words">
                      {proposal.title}
                    </h3>
                  )}
                  <div className="flex items-center gap-1 shrink-0">
                    <span className="text-[10px] font-bold px-1.5 py-0.5 border border-cyan-400/60 text-cyan-300">
                      RANK {proposal.rank}
                    </span>
                    <span className="text-[10px] font-bold px-1.5 py-0.5 border border-white/30 text-white/80">
                      {proposal.primaryAttribute}
                    </span>
                  </div>
                </div>

                <div>
                  <div className="text-[9px] text-cyan-300/80 tracking-wider mb-0.5">BOSS CONDITION</div>
                  {editing ? (
                    <input
                      aria-label="Boss condition"
                      type="text"
                      value={proposal.bossCondition}
                      maxLength={300}
                      onChange={(e) => updateProposal({ bossCondition: e.target.value })}
                      className={inputClass}
                    />
                  ) : (
                    <p className="text-[11px] text-white/90 leading-relaxed">{proposal.bossCondition}</p>
                  )}
                </div>

                <p className="text-[10px] text-white/60 italic leading-relaxed">&quot;{proposal.assessment.rationale}&quot;</p>

                {!proposal.assessment.bossConditionOk && proposal.assessment.bossConditionFeedback && (
                  <div className="border border-amber-500/40 bg-amber-950/30 rounded-[2px] p-2 flex items-start gap-1.5">
                    <AlertTriangle className="w-3 h-3 text-amber-300 shrink-0 mt-0.5" />
                    <p className="text-[10px] text-white/75">{proposal.assessment.bossConditionFeedback}</p>
                  </div>
                )}
              </div>

              <div className="border border-white/30 bg-[#061424]/85 rounded-[2px] p-2.5">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[10px] font-bold text-[#9fd3ff] tracking-wider">WAVES ({filledWaves.length})</span>
                  <button
                    type="button"
                    onClick={() => {
                      systemSound.playClick();
                      setEditing((v) => !v);
                    }}
                    className="flex items-center gap-1 text-[10px] text-cyan-300 hover:text-white border border-cyan-400/40 hover:border-cyan-300 px-1.5 py-0.5 rounded-[2px]"
                  >
                    {editing ? <Check className="w-3 h-3" /> : <Pencil className="w-3 h-3" />}
                    {editing ? 'DONE' : 'EDIT'}
                  </button>
                </div>
                <ol className="space-y-1.5">
                  {proposal.waves.map((w, i) => (
                    <li key={i} className="flex items-start gap-1.5">
                      <span className="text-[10px] text-white/40 w-4 text-center shrink-0 pt-1">{i + 1}.</span>
                      {editing ? (
                        <>
                          <input
                            aria-label={`Wave ${i + 1}`}
                            type="text"
                            value={w.label}
                            maxLength={160}
                            onChange={(e) => updateWave(i, e.target.value)}
                            placeholder={`Wave ${i + 1}`}
                            className={`${inputClass} flex-1 min-w-0`}
                          />
                          {proposal.waves.length > MIN_GATE_MILESTONES && (
                            <button
                              type="button"
                              aria-label={`Remove wave ${i + 1}`}
                              onClick={() => updateProposal({ waves: proposal.waves.filter((_, idx) => idx !== i) })}
                              className="text-white/40 hover:text-rose-400 p-1 rounded-[2px] shrink-0"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </>
                      ) : (
                        <div className="min-w-0 pt-0.5">
                          <div className="text-[11px] text-white/90">{w.label}</div>
                          {w.hint && <div className="text-[9px] text-cyan-300/60 italic">↳ {w.hint}</div>}
                        </div>
                      )}
                    </li>
                  ))}
                </ol>
                {editing && proposal.waves.length < MAX_WAVES && (
                  <button
                    type="button"
                    onClick={() => updateProposal({ waves: [...proposal.waves, { label: '', attribute: proposal.primaryAttribute }] })}
                    className="mt-2 flex items-center gap-1 text-[10px] text-cyan-300 hover:text-white border border-cyan-400/50 hover:border-cyan-300 bg-cyan-950/40 px-2 py-1 rounded-[2px] transition-all"
                  >
                    <Plus className="w-3 h-3" /> ADD WAVE
                  </button>
                )}
                {filledWaves.length < MIN_GATE_MILESTONES && (
                  <p className="text-[9px] text-amber-300 mt-1.5">A Gate needs at least {MIN_GATE_MILESTONES} named Waves.</p>
                )}
              </div>

              {rankLocked && (
                <div className="border border-rose-500/50 bg-rose-950/30 rounded-[2px] p-2.5 space-y-2">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                    <p className="text-[10px] text-rose-300 leading-relaxed">
                      [ SYSTEM: This Gate is rated Rank {proposal.rank}; your clearance caps at Rank {hunterRank}. ]
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      systemSound.playClick();
                      updateProposal({ rank: hunterRank });
                    }}
                    className="w-full py-1.5 border border-rose-400/50 text-rose-200 hover:text-white text-[10px] font-bold rounded-[2px]"
                  >
                    [ OPEN IT AT RANK {hunterRank} INSTEAD ]
                  </button>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="mt-3 pt-2 border-t border-white/10 flex items-center gap-2">
          {!proposal ? (
            <>
              <button
                type="button"
                onClick={() => {
                  systemSound.playClick();
                  resetAndClose();
                }}
                className="py-2 px-3 border border-white/30 bg-black/40 text-white/70 hover:text-white rounded-[2px] text-[11px] font-bold transition-colors"
              >
                [ CANCEL ]
              </button>
              <button
                type="button"
                onClick={handleSummon}
                disabled={!canSummon}
                className="flex-1 py-2 px-3 border-2 border-cyan-400 bg-cyan-950/80 hover:bg-cyan-900 text-cyan-300 hover:text-white rounded-[2px] text-[11px] font-bold tracking-wider transition-all flex items-center justify-center gap-1.5 shadow-[0_0_14px_rgba(0,212,255,0.4)] disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Sparkles className={`w-3.5 h-3.5 ${assessing ? 'animate-spin' : ''}`} />
                <span>{assessing ? '[ THEIA IS ASSESSING... ]' : '[ SUMMON THEIA ]'}</span>
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => {
                  systemSound.playClick();
                  setProposal(null);
                  setEditing(false);
                }}
                className="py-2 px-3 border border-white/30 bg-black/40 text-white/70 hover:text-white rounded-[2px] text-[11px] font-bold transition-colors flex items-center gap-1"
              >
                <ArrowLeft className="w-3 h-3" /> ADJUST
              </button>
              <button
                type="button"
                onClick={handleOpen}
                disabled={!canOpen}
                className="flex-1 py-2 px-3 border-2 border-cyan-400 bg-cyan-950/80 hover:bg-cyan-900 text-cyan-300 hover:text-white rounded-[2px] text-[11px] font-bold tracking-wider transition-all flex items-center justify-center gap-1.5 shadow-[0_0_14px_rgba(0,212,255,0.4)] disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Check className="w-3.5 h-3.5" />
                <span>[ OPEN GATE ]</span>
              </button>
            </>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
