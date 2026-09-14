import { useState } from 'react';
import {
  createGate,
  assessGate,
  RANK_ORDER,
  ATTRIBUTE_ORDER,
  DURATION_LABELS,
  MIN_GATE_MILESTONES,
  type Gate,
  type GateDuration,
  type GateAssessment,
  type CreateGateMilestoneInput,
} from '@/lib/gates';
import { getHunterRank } from '@/lib/storage';
import type { Attributes, HunterRank, UserProfile } from '@/lib/types';
import { systemSound } from '@/lib/system-sound';
import { X, DoorOpen, Plus, Trash2, Check, Zap, Sparkles, AlertTriangle, Lock } from 'lucide-react';
import { toast } from 'sonner';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onCreated: (gate: Gate) => void;
  profile: UserProfile;
}

const DURATIONS: GateDuration[] = ['<2w', '2-4w', '1-3m', '3-6m', '6-12m', '12m+'];

export default function GateCreationModal({ isOpen, onClose, onCreated, profile }: Props) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [duration, setDuration] = useState<GateDuration>('1-3m');
  const [rank, setRank] = useState<HunterRank>('E');
  const [primaryAttribute, setPrimaryAttribute] = useState<keyof Attributes>('STR');
  const [bossCondition, setBossCondition] = useState('');
  const [milestones, setMilestones] = useState<CreateGateMilestoneInput[]>([{ label: '' }, { label: '' }]);
  const [assessing, setAssessing] = useState(false);
  const [assessment, setAssessment] = useState<GateAssessment | null>(null);
  // What the player had actually typed right before THEIA's revisions overwrote them —
  // purely so the result panel can show what changed, since title/bossCondition themselves
  // now hold the revised text immediately.
  const [preAssessmentTitle, setPreAssessmentTitle] = useState('');
  const [preAssessmentBossCondition, setPreAssessmentBossCondition] = useState('');

  if (!isOpen) return null;

  const hunterRank = getHunterRank(profile.level);
  const hunterRankIndex = RANK_ORDER.indexOf(hunterRank);
  const rankLocked = RANK_ORDER.indexOf(rank) > hunterRankIndex;

  const resetAndClose = () => {
    setTitle('');
    setDescription('');
    setDuration('1-3m');
    setRank('E');
    setPrimaryAttribute('STR');
    setBossCondition('');
    setMilestones([{ label: '' }, { label: '' }]);
    setAssessment(null);
    setPreAssessmentTitle('');
    setPreAssessmentBossCondition('');
    onClose();
  };

  const filledMilestoneCount = milestones.filter((m) => m.label.trim().length > 0).length;
  const canAssess = title.trim().length > 0 && bossCondition.trim().length > 0;
  const hasEnoughWaves = filledMilestoneCount >= MIN_GATE_MILESTONES;
  // Rank and Primary Attribute are THEIA's call, not a manual pre-pick — a Gate cannot be
  // opened until an assessment has actually run at least once.
  const canSubmit = canAssess && Boolean(assessment) && !rankLocked && hasEnoughWaves;

  const handleAssess = async (forceAlgorithmic = false) => {
    if (!canAssess || assessing) return;
    systemSound.playClick();
    setAssessing(true);
    setPreAssessmentTitle(title);
    setPreAssessmentBossCondition(bossCondition);
    try {
      const draftWaves = milestones.filter((m) => m.label.trim().length > 0).map((m) => ({ label: m.label }));
      const result = await assessGate(
        { title, description, bossCondition, duration, milestones: draftWaves },
        { forceAlgorithmic }
      );
      setAssessment(result);
      setRank(result.rank);
      // THEIA's naming, phrasing, and attribute reads aren't suggestions to opt into — they
      // ARE the System's designation, applied the moment it assesses the Gate. Still fully
      // editable afterward.
      if (result.refinedTitle) setTitle(result.refinedTitle);
      if (result.refinedBossCondition) setBossCondition(result.refinedBossCondition);
      setPrimaryAttribute(result.primaryAttribute);
      if (result.existingWaveAttributes.length > 0) {
        setMilestones((prev) => {
          let idx = 0;
          return prev.map((m) => {
            if (m.label.trim().length === 0) return m;
            const attr = result.existingWaveAttributes[idx];
            idx++;
            return attr ? { ...m, attribute: attr } : m;
          });
        });
      }
      toast.success(
        forceAlgorithmic ? 'PRECISION ESTIMATE COMPILED (0 TOKENS)' : 'SYSTEM ASSESSMENT COMPLETE'
      );
    } finally {
      setAssessing(false);
    }
  };

  const handleAddSuggestedWaves = () => {
    if (!assessment?.suggestedMilestones?.length) return;
    systemSound.playClick();
    setMilestones((prev) => {
      const existing = prev.filter((m) => m.label.trim().length > 0);
      return [...existing, ...assessment.suggestedMilestones].slice(0, 10);
    });
  };

  const handleSubmit = () => {
    if (!canSubmit) return;
    systemSound.playLevelUp();
    const gate = createGate({
      title,
      description,
      rank,
      bossCondition,
      primaryAttribute,
      milestones,
      duration,
    });
    toast.success('GATE DECLARED', {
      description: `"${gate.title}" is now an active campaign.`,
    });
    onCreated(gate);
    resetAndClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 animate-fade-in font-mono overflow-y-auto">
      <div className="relative max-w-[560px] w-full bg-[#0a1b2e]/95 border-2 border-white/50 rounded-[4px] p-4 sm:p-5 text-white shadow-[0_0_35px_rgba(0,0,0,0.9),inset_0_0_24px_rgba(0,212,255,0.08)] font-mono anime-dropdown max-h-[92vh] flex flex-col my-auto">
        {/* Header */}
        <div className="flex items-center justify-between pb-2 mb-2 border-b border-white/15">
          <div className="flex items-center gap-2">
            <div className="px-3 py-1 border border-white/70 bg-[#061426]/70 shadow-[0_0_12px_rgba(0,212,255,0.3)] flex items-center gap-2">
              <DoorOpen className="w-3.5 h-3.5 text-[#9fd3ff]" />
              <span className="font-mono font-extrabold tracking-[0.24em] text-sm sm:text-base text-white anime-glow-text">
                DECLARE GATE
              </span>
            </div>
            <span className="text-[10px] text-cyan-300/70 font-mono hidden sm:inline">
              [NEW CAMPAIGN]
            </span>
          </div>
          <button
            type="button"
            onClick={() => {
              systemSound.playClick();
              resetAndClose();
            }}
            className="w-7 h-7 rounded-[2px] border border-white/30 hover:border-white/70 bg-black/40 hover:bg-white/10 text-white/70 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto pr-1 space-y-2.5 text-xs">
          <p className="text-[10px] text-white/50 leading-relaxed">
            A Gate is a real goal that spans weeks or months — not a daily quest. Draft a name
            and a finish line below; requesting an assessment has THEIA designate the Gate's
            real name, its Threat Rank, and the Attribute it trains — none of that is picked
            manually, and a Gate cannot be opened until it's been assessed at least once.
          </p>

          {/* Title */}
          <div className="border border-white/30 bg-[#061424]/85 rounded-[2px] p-2.5">
            <label className="text-[10px] font-bold text-[#9fd3ff] tracking-wider block mb-1.5">
              GATE NAME (DRAFT)
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                setAssessment(null);
              }}
              placeholder="e.g. Spanish B1 Fluency"
              className="w-full bg-black/60 border border-white/30 rounded-[2px] px-2.5 py-1.5 text-xs text-white focus:border-cyan-400 focus:outline-none"
            />
            <p className="text-[9px] text-white/40 mt-1.5">
              THEIA overwrites this with the Gate's designated name on assessment.
            </p>
          </div>

          {/* Description */}
          <div className="border border-white/30 bg-[#061424]/85 rounded-[2px] p-2.5">
            <label className="text-[10px] font-bold text-[#9fd3ff] tracking-wider block mb-1.5">
              DESCRIPTION (OPTIONAL)
            </label>
            <textarea
              value={description}
              onChange={(e) => {
                setDescription(e.target.value);
                setAssessment(null);
              }}
              placeholder="What is this campaign about?"
              rows={2}
              className="w-full bg-black/60 border border-white/30 rounded-[2px] px-2.5 py-1.5 text-xs text-white focus:border-cyan-400 focus:outline-none resize-none"
            />
          </div>

          {/* Estimated duration */}
          <div className="border border-white/30 bg-[#061424]/85 rounded-[2px] p-2.5">
            <label className="text-[10px] font-bold text-[#9fd3ff] tracking-wider block mb-1.5">
              ESTIMATED DURATION
            </label>
            <div className="grid grid-cols-3 gap-1.5">
              {DURATIONS.map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => {
                    systemSound.playClick();
                    setDuration(d);
                    setAssessment(null);
                  }}
                  className={`py-1.5 border rounded-[2px] text-[10px] font-bold transition-all ${
                    duration === d
                      ? 'border-cyan-400 bg-cyan-950/80 text-cyan-300 shadow-[0_0_8px_rgba(0,212,255,0.4)]'
                      : 'border-white/20 bg-black/40 text-white/60 hover:text-white'
                  }`}
                >
                  {DURATION_LABELS[d]}
                </button>
              ))}
            </div>
            <p className="text-[9px] text-white/40 mt-1.5">
              Also sets this Gate's clock. Left unresolved past that, it Breaches — not locked,
              but permanently logged, with a fatigue cost.
            </p>
          </div>

          {/* Primary attribute — THEIA-determined, not a manual pre-pick. Clearing grants a
              permanent Blessing here, so it needs to reflect the Gate's real nature. */}
          <div className={`border rounded-[2px] p-2.5 ${assessment ? 'border-white/30 bg-[#061424]/85' : 'border-white/15 bg-[#061424]/40'}`}>
            <label className={`text-[10px] font-bold tracking-wider block mb-1.5 ${assessment ? 'text-[#9fd3ff]' : 'text-white/40'}`}>
              PRIMARY ATTRIBUTE — WHAT DOES THIS TRAIN?
            </label>
            {assessment ? (
              <>
                <div className="grid grid-cols-3 gap-1.5">
                  {ATTRIBUTE_ORDER.map((a) => (
                    <button
                      key={a}
                      type="button"
                      onClick={() => {
                        systemSound.playClick();
                        setPrimaryAttribute(a);
                      }}
                      className={`py-1.5 border rounded-[2px] text-xs font-bold transition-all ${
                        primaryAttribute === a
                          ? 'border-cyan-400 bg-cyan-950/80 text-cyan-300 shadow-[0_0_8px_rgba(0,212,255,0.4)]'
                          : 'border-white/20 bg-black/40 text-white/60 hover:text-white'
                      }`}
                    >
                      {a}
                    </button>
                  ))}
                </div>
                <p className="text-[9px] text-white/40 mt-1.5">
                  THEIA-designated from this Gate's true nature — clearing grants a permanent Blessing here. Still overridable.
                </p>
              </>
            ) : (
              <p className="text-[10px] text-white/30 italic py-1">
                [ Pending System Assessment below — THEIA reads this from the Gate, it isn't picked manually. ]
              </p>
            )}
          </div>

          {/* Boss condition */}
          <div className="border border-cyan-500/30 bg-[#07172b]/70 rounded-[2px] p-2.5">
            <label className="text-[10px] font-bold text-cyan-300 tracking-wider block mb-1.5">
              BOSS CONDITION — WHAT DOES "CLEARED" MEAN?
            </label>
            <input
              type="text"
              value={bossCondition}
              onChange={(e) => {
                setBossCondition(e.target.value);
                setAssessment(null);
              }}
              placeholder="e.g. Hold a 10-minute conversation with a native speaker"
              className="w-full bg-black/60 border border-white/30 rounded-[2px] px-2.5 py-1.5 text-xs text-white focus:border-cyan-400 focus:outline-none"
            />
            <p className="text-[9px] text-white/40 mt-1.5">
              Be specific — a Gate needs a real finish line, not a vague direction.
            </p>
          </div>

          {/* Assessment request */}
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => handleAssess(true)}
              disabled={!canAssess || assessing}
              className="py-2 px-3 border border-emerald-500/50 bg-emerald-950/50 hover:bg-emerald-900/60 text-emerald-300 font-mono text-[10px] font-bold tracking-wider rounded-[2px] transition-all flex items-center justify-center gap-1 disabled:opacity-40"
              title="Precision estimate from declared duration alone (0 LLM tokens)"
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
              <span>{assessing ? '[ ANALYZING... ]' : '[ REQUEST SYSTEM ASSESSMENT ]'}</span>
            </button>
          </div>

          {/* Assessment result */}
          {assessment && (
            <div className="border border-cyan-500/30 bg-[#07172b]/70 rounded-[2px] p-2.5 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] tracking-[0.2em] text-cyan-300/80">
                  SYSTEM ASSESSMENT
                </span>
                <span className="text-[9px] text-white/50">
                  {assessment.origin === 'system' ? 'PRECISION ENGINE' : 'AI ADAPTED'}
                </span>
              </div>
              <p className="text-[11px] text-white/85 leading-relaxed italic">"{assessment.rationale}"</p>

              {assessment.refinedTitle && assessment.refinedTitle.toLowerCase() !== preAssessmentTitle.trim().toLowerCase() && (
                <div className="border border-cyan-400/30 bg-cyan-950/20 rounded-[2px] p-2 space-y-0.5">
                  <div className="text-[9px] text-cyan-300/70 tracking-wider">SYSTEM-DESIGNATED NAME APPLIED</div>
                  <p className="text-[10px] text-white/50 line-through">"{preAssessmentTitle}"</p>
                  <p className="text-[11px] text-cyan-300 font-bold">"{assessment.refinedTitle}"</p>
                </div>
              )}

              {assessment.refinedBossCondition &&
                assessment.refinedBossCondition.toLowerCase() !== preAssessmentBossCondition.trim().toLowerCase() && (
                  <div className="border border-cyan-400/30 bg-cyan-950/20 rounded-[2px] p-2 space-y-0.5">
                    <div className="text-[9px] text-cyan-300/70 tracking-wider">BOSS CONDITION REPHRASED</div>
                    <p className="text-[10px] text-white/50 line-through">"{preAssessmentBossCondition}"</p>
                    <p className="text-[11px] text-cyan-300 font-bold">"{assessment.refinedBossCondition}"</p>
                  </div>
                )}

              {!assessment.bossConditionOk && assessment.bossConditionFeedback && (
                <div className="border border-amber-500/40 bg-amber-950/30 rounded-[2px] p-2 space-y-1">
                  <div className="flex items-center gap-1.5 text-amber-300 text-[10px] font-bold">
                    <AlertTriangle className="w-3 h-3" />
                    WHY IT WAS FLAGGED
                  </div>
                  <p className="text-[10px] text-white/70">{assessment.bossConditionFeedback}</p>
                </div>
              )}

              {assessment.suggestedMilestones.length > 0 && (
                <button
                  type="button"
                  onClick={handleAddSuggestedWaves}
                  className="w-full flex items-center justify-center gap-1 text-[10px] text-cyan-300 hover:text-white border border-cyan-400/50 hover:border-cyan-300 bg-cyan-950/40 px-2 py-1.5 rounded-[2px] transition-all"
                >
                  <Plus className="w-3 h-3" /> ADD {assessment.suggestedMilestones.length} SUGGESTED WAVES
                </button>
              )}
            </div>
          )}

          {/* Rank — THEIA-determined, not a manual pre-pick. Still overridable afterward,
              within the player's actual clearance. */}
          <div className={`border rounded-[2px] p-2.5 ${assessment ? 'border-white/30 bg-[#061424]/85' : 'border-white/15 bg-[#061424]/40'}`}>
            <div className="flex items-center justify-between mb-1.5">
              <label className={`text-[10px] font-bold tracking-wider ${assessment ? 'text-[#9fd3ff]' : 'text-white/40'}`}>
                THREAT RANK
              </label>
              <span className="text-[9px] text-white/40">
                YOUR CLEARANCE: <span className="text-cyan-300 font-bold">RANK {hunterRank}</span>
              </span>
            </div>
            {assessment ? (
              <>
                <div className="flex items-center gap-1.5">
                  {RANK_ORDER.map((r, i) => {
                    const locked = i > hunterRankIndex;
                    return (
                      <button
                        key={r}
                        type="button"
                        onClick={() => {
                          if (locked) {
                            systemSound.playPenaltyWarning();
                            toast.error(`RANK ${r} EXCEEDS CLEARANCE`, {
                              description: `Requires Hunter Rank ${r} — you are Rank ${hunterRank}.`,
                            });
                            return;
                          }
                          systemSound.playClick();
                          setRank(r);
                        }}
                        className={`flex-1 py-1.5 border rounded-[2px] text-xs font-bold transition-all flex items-center justify-center gap-1 ${
                          locked
                            ? 'border-white/10 bg-black/30 text-white/25 cursor-not-allowed'
                            : rank === r
                              ? 'border-cyan-400 bg-cyan-950/80 text-cyan-300 shadow-[0_0_8px_rgba(0,212,255,0.4)]'
                              : 'border-white/20 bg-black/40 text-white/60 hover:text-white'
                        }`}
                      >
                        {locked && <Lock className="w-2.5 h-2.5" />}
                        {r}
                      </button>
                    );
                  })}
                </div>
                <p className="text-[9px] text-white/40 mt-1.5">
                  Set by System assessment above — still overridable within your clearance.
                </p>
              </>
            ) : (
              <p className="text-[10px] text-white/30 italic py-1">
                [ Pending System Assessment below — THEIA reads this from the Gate, it isn't picked manually. ]
              </p>
            )}
          </div>

          {rankLocked && (
            <div className="border border-rose-500/50 bg-rose-950/30 rounded-[2px] p-2.5 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <p className="text-[10px] text-rose-300 leading-relaxed">
                [ SYSTEM: Insufficient Hunter Rank. This Gate is rated Rank {rank} — your clearance
                caps at Rank {hunterRank}. Lower the Rank to open it now, or grow stronger and return. ]
              </p>
            </div>
          )}

          {/* Milestones */}
          <div className={`border rounded-[2px] p-2.5 ${hasEnoughWaves ? 'border-white/30 bg-[#061424]/85' : 'border-amber-500/50 bg-amber-950/10'}`}>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-[10px] font-bold text-[#9fd3ff] tracking-wider">
                WAVES (MILESTONES) — REQUIRED
              </label>
              <span className={`text-[9px] font-bold ${hasEnoughWaves ? 'text-emerald-300' : 'text-amber-300'}`}>
                {filledMilestoneCount}/{MIN_GATE_MILESTONES} MIN
              </span>
            </div>
            <p className="text-[9px] text-white/40 mb-1.5">
              A Gate needs real breakdown, not just a title — add at least {MIN_GATE_MILESTONES}
              waves yourself, or accept THEIA's suggestions above.
            </p>
            <div className="space-y-1.5">
              {milestones.map((m, i) => (
                <div key={i} className="space-y-1">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] text-white/40 w-4 text-center shrink-0">{i + 1}.</span>
                    <input
                      type="text"
                      value={m.label}
                      onChange={(e) =>
                        setMilestones((prev) =>
                          prev.map((v, idx) => (idx === i ? { ...v, label: e.target.value } : v))
                        )
                      }
                      placeholder={`Wave ${i + 1}`}
                      className="flex-1 min-w-0 bg-black/60 border border-white/30 rounded-[2px] px-2.5 py-1.5 text-xs text-white focus:border-cyan-400 focus:outline-none"
                    />
                    {milestones.length > 1 && (
                      <button
                        type="button"
                        onClick={() => setMilestones((prev) => prev.filter((_, idx) => idx !== i))}
                        className="text-white/40 hover:text-rose-400 p-1 rounded-[2px] shrink-0"
                        title="Remove wave"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                  {(m.hint || m.attribute) && (
                    <p className="text-[9px] text-cyan-300/70 italic pl-[22px] flex items-center gap-1.5 flex-wrap">
                      {m.hint && <span>↳ {m.hint}</span>}
                      {m.attribute && (
                        <span className="not-italic text-[8px] font-bold text-cyan-400/90 border border-cyan-400/30 rounded-[2px] px-1 py-0.5">
                          TRAINS {m.attribute}
                        </span>
                      )}
                    </p>
                  )}
                </div>
              ))}
            </div>
            <p className="text-[9px] text-white/40 mt-1.5">
              Each wave's attribute is THEIA-classified on assessment — a fitness Gate's
              "read about recovery" wave can train INT even if the Gate itself trains STR.
            </p>
            {milestones.length < 10 && (
              <button
                type="button"
                onClick={() => setMilestones((prev) => [...prev, { label: '' }])}
                className="mt-2 flex items-center gap-1 text-[10px] text-cyan-300 hover:text-white border border-cyan-400/50 hover:border-cyan-300 bg-cyan-950/40 px-2 py-1 rounded-[2px] transition-all"
              >
                <Plus className="w-3 h-3" /> ADD WAVE
              </button>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="mt-3 pt-2 border-t border-white/10 flex items-center gap-2">
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
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="flex-1 py-2 px-3 border-2 border-cyan-400 bg-cyan-950/80 hover:bg-cyan-900 text-cyan-300 hover:text-white rounded-[2px] text-[11px] font-bold tracking-wider transition-all flex items-center justify-center gap-1.5 shadow-[0_0_14px_rgba(0,212,255,0.4)] disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Check className="w-3.5 h-3.5" />
            <span>[ OPEN GATE ]</span>
          </button>
        </div>
      </div>
    </div>
  );
}
