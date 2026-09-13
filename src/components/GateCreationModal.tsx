import { useState } from 'react';
import {
  createGate,
  assessGate,
  RANK_ORDER,
  DURATION_LABELS,
  type Gate,
  type GateDuration,
  type GateAssessment,
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
const ATTRIBUTES: Array<keyof Attributes> = ['STR', 'AGI', 'VIT', 'INT', 'PER', 'WIS'];

export default function GateCreationModal({ isOpen, onClose, onCreated, profile }: Props) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [duration, setDuration] = useState<GateDuration>('1-3m');
  const [rank, setRank] = useState<HunterRank>('E');
  const [primaryAttribute, setPrimaryAttribute] = useState<keyof Attributes>('STR');
  const [bossCondition, setBossCondition] = useState('');
  const [milestones, setMilestones] = useState<string[]>(['', '']);
  const [assessing, setAssessing] = useState(false);
  const [assessment, setAssessment] = useState<GateAssessment | null>(null);

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
    setMilestones(['', '']);
    setAssessment(null);
    onClose();
  };

  const canAssess = title.trim().length > 0 && bossCondition.trim().length > 0;
  const canSubmit = canAssess && !rankLocked;

  const handleAssess = async (forceAlgorithmic = false) => {
    if (!canAssess || assessing) return;
    systemSound.playClick();
    setAssessing(true);
    try {
      const result = await assessGate({ title, description, bossCondition, duration }, { forceAlgorithmic });
      setAssessment(result);
      setRank(result.rank);
      toast.success(
        forceAlgorithmic ? 'PRECISION ESTIMATE COMPILED (0 TOKENS)' : 'SYSTEM ASSESSMENT COMPLETE'
      );
    } finally {
      setAssessing(false);
    }
  };

  const handleUseSuggestedBossCondition = () => {
    if (!assessment?.refinedBossCondition) return;
    systemSound.playClick();
    setBossCondition(assessment.refinedBossCondition);
  };

  const handleAddSuggestedWaves = () => {
    if (!assessment?.suggestedMilestones?.length) return;
    systemSound.playClick();
    setMilestones((prev) => {
      const existing = prev.filter((m) => m.trim().length > 0);
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
      milestoneLabels: milestones,
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
            A Gate is a real goal that spans weeks or months — not a daily quest. Name it,
            define what "cleared" actually means, and let THEIA assess the threat.
          </p>

          {/* Title */}
          <div className="border border-white/30 bg-[#061424]/85 rounded-[2px] p-2.5">
            <label className="text-[10px] font-bold text-[#9fd3ff] tracking-wider block mb-1.5">
              GATE NAME
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

          {/* Primary attribute */}
          <div className="border border-white/30 bg-[#061424]/85 rounded-[2px] p-2.5">
            <label className="text-[10px] font-bold text-[#9fd3ff] tracking-wider block mb-1.5">
              PRIMARY ATTRIBUTE — WHAT DOES THIS TRAIN?
            </label>
            <div className="grid grid-cols-3 gap-1.5">
              {ATTRIBUTES.map((a) => (
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
              Clearing this Gate grants a permanent Blessing to this attribute.
            </p>
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

              {!assessment.bossConditionOk && (
                <div className="border border-amber-500/40 bg-amber-950/30 rounded-[2px] p-2 space-y-1.5">
                  <div className="flex items-center gap-1.5 text-amber-300 text-[10px] font-bold">
                    <AlertTriangle className="w-3 h-3" />
                    BOSS CONDITION FLAGGED
                  </div>
                  {assessment.bossConditionFeedback && (
                    <p className="text-[10px] text-white/70">{assessment.bossConditionFeedback}</p>
                  )}
                  {assessment.refinedBossCondition && (
                    <button
                      type="button"
                      onClick={handleUseSuggestedBossCondition}
                      className="text-[10px] text-amber-300 hover:text-white border border-amber-500/50 hover:border-amber-300 bg-amber-950/40 px-2 py-1 rounded-[2px] transition-all text-left"
                    >
                      [ USE: "{assessment.refinedBossCondition}" ]
                    </button>
                  )}
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

          {/* Rank */}
          <div className="border border-white/30 bg-[#061424]/85 rounded-[2px] p-2.5">
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-[10px] font-bold text-[#9fd3ff] tracking-wider">
                THREAT RANK
              </label>
              <span className="text-[9px] text-white/40">
                YOUR CLEARANCE: <span className="text-cyan-300 font-bold">RANK {hunterRank}</span>
              </span>
            </div>
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
              {assessment
                ? 'Set by System assessment above — still overridable within your clearance.'
                : 'Request an assessment above, or pick manually.'}
            </p>
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
          <div className="border border-white/30 bg-[#061424]/85 rounded-[2px] p-2.5">
            <label className="text-[10px] font-bold text-[#9fd3ff] tracking-wider block mb-1.5">
              WAVES (MILESTONES)
            </label>
            <div className="space-y-1.5">
              {milestones.map((m, i) => (
                <div key={i} className="flex items-center gap-1.5">
                  <span className="text-[10px] text-white/40 w-4 text-center shrink-0">{i + 1}.</span>
                  <input
                    type="text"
                    value={m}
                    onChange={(e) =>
                      setMilestones((prev) => prev.map((v, idx) => (idx === i ? e.target.value : v)))
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
              ))}
            </div>
            {milestones.length < 10 && (
              <button
                type="button"
                onClick={() => setMilestones((prev) => [...prev, ''])}
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
