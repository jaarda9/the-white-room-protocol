import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Brain, Check, Loader2, RefreshCw, X, Target, Bed } from 'lucide-react';
import { toast } from 'sonner';
import { systemSound } from '@/lib/system-sound';
import { useLockBodyScroll } from '@/hooks/use-lock-body-scroll';
import {
  acceptProgram,
  designProgram,
  swapExercise,
  type TrainingBrief,
  type TrainingGear,
  type TrainingLevel,
  type TrainingProgram,
} from '@/lib/training-architect';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  /** Called after the plan became the Hunter's training plan. */
  onAccepted: (program: TrainingProgram) => void;
  /** Adjust mode: re-design this program from its benchmark results. */
  previous?: TrainingProgram | null;
}

const GOAL_IDEAS = ['Pass a military fitness test', 'Run 5 km without stopping', 'My first 10 pull-ups', 'Agile and strong like an archer hero'];
const GEAR: Array<{ id: TrainingGear; label: string; homeOnly?: boolean }> = [
  { id: 'pullup-bar', label: 'Pull-up bar', homeOnly: true },
  { id: 'dumbbells', label: 'Dumbbells', homeOnly: true },
  { id: 'kettlebell', label: 'Kettlebell', homeOnly: true },
  { id: 'bands', label: 'Bands', homeOnly: true },
  { id: 'pool', label: 'Pool access' },
];
const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0];
const SHORT_DAY = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

const emptyBrief = (): TrainingBrief => ({ goal: '', daysPerWeek: 3, minutesPerSession: 45, place: 'home', gear: [], level: 'beginner', limits: '' });

const chip = (active: boolean) =>
  `px-2.5 py-1.5 rounded-[2px] border text-[11px] font-mono transition-all ${
    active ? 'border-cyan-400 bg-cyan-950/70 text-white shadow-[0_0_8px_rgba(0,212,255,0.3)]' : 'border-white/20 bg-black/30 text-white/60 hover:border-white/40 hover:text-white'
  }`;
const label = 'text-[10px] font-bold text-[#9fd3ff] uppercase tracking-wider mb-1.5';

export default function TrainingArchitectModal({ isOpen, onClose, onAccepted, previous }: Props) {
  useLockBodyScroll(isOpen);
  const [step, setStep] = useState<'brief' | 'loading' | 'preview'>('brief');
  const [brief, setBrief] = useState<TrainingBrief>(emptyBrief);
  const [draft, setDraft] = useState<TrainingProgram | null>(null);
  const [openGate, setOpenGate] = useState(false);
  const runId = useRef(0);

  useEffect(() => {
    if (!isOpen) return;
    setStep('brief');
    setDraft(null);
    setOpenGate(false);
    setBrief(previous ? { ...previous.brief } : emptyBrief());
  }, [isOpen, previous]);

  if (!isOpen) return null;
  const adjusting = !!previous;
  const set = <K extends keyof TrainingBrief>(k: K, v: TrainingBrief[K]) => setBrief((b) => ({ ...b, [k]: v }));
  const toggleGear = (g: TrainingGear) => set('gear', brief.gear.includes(g) ? brief.gear.filter((x) => x !== g) : [...brief.gear, g]);

  const close = () => {
    runId.current++; // a late answer from THEIA is ignored
    systemSound.playClick();
    onClose();
  };

  const design = async () => {
    if (brief.goal.trim().length < 3) {
      toast.error('Tell THEIA your goal first.');
      return;
    }
    systemSound.playClick();
    const id = ++runId.current;
    setStep('loading');
    const program = await designProgram(brief, previous || undefined);
    if (id !== runId.current) return;
    setDraft(program);
    setStep('preview');
    if (program.source === 'system') {
      toast.warning('THEIA UNREACHABLE', { description: 'The System built a baseline plan for your goal. You can try again later.' });
    }
  };

  const accept = () => {
    if (!draft) return;
    const saved = acceptProgram(draft, { openGate: openGate && !adjusting && !draft.gateId });
    systemSound.playClick();
    toast.success(adjusting ? 'TRAINING PLAN ADJUSTED' : 'TRAINING PROGRAM ACCEPTED', {
      description: saved.gateId && !previous?.gateId ? 'A Gate was opened for this goal.' : 'Your daily physical quests now follow this plan.',
    });
    onAccepted(saved);
    onClose();
  };

  const trainingDays = draft ? WEEK_ORDER.filter((d) => !draft.split[d]?.isRestDay) : [];

  return createPortal(
    <div className="modal-safe-pad fixed inset-0 z-[75] bg-black/85 backdrop-blur-sm flex items-center justify-center animate-fade-in font-mono">
      <div className="relative w-full max-w-2xl bg-[#0a1b2e]/95 border-2 border-white/50 rounded-[4px] text-white shadow-[0_0_35px_rgba(0,0,0,0.9),inset_0_0_24px_rgba(0,212,255,0.08)] anime-dropdown modal-card-max-h flex flex-col my-auto">
        <div className="flex items-center justify-between px-4 sm:px-5 py-3 border-b border-white/15">
          <div className="px-3 py-1 border border-white/70 bg-[#061426]/70 shadow-[0_0_12px_rgba(0,212,255,0.3)] flex items-center gap-2">
            <Brain className="w-3.5 h-3.5 text-[#9fd3ff]" />
            <span className="font-extrabold tracking-[0.2em] text-sm text-white anime-glow-text">{adjusting ? 'ADJUST PROGRAM' : 'THEIA: TRAINING ARCHITECT'}</span>
          </div>
          <button type="button" onClick={close} aria-label="Close training architect" className="w-7 h-7 rounded-[2px] border border-white/30 hover:border-white/70 bg-black/40 text-white/70 hover:text-white flex items-center justify-center">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-5 space-y-4 text-xs">
          {step === 'brief' && (
            <>
              <p className="text-[11px] text-white/70 leading-relaxed">
                {adjusting
                  ? 'THEIA will re-design your week from your benchmark results: harder where you improved, steadier where you stalled.'
                  : 'Tell THEIA what you want to become. It translates the goal into real abilities and builds a week of training you can actually do.'}
              </p>

              <div>
                <div className={label}>YOUR GOAL</div>
                <textarea
                  value={brief.goal}
                  onChange={(e) => set('goal', e.target.value.slice(0, 200))}
                  disabled={adjusting}
                  rows={2}
                  placeholder='e.g. "Pass the basic Navy SEAL drills" or "Become like Green Arrow"'
                  className="w-full px-2.5 py-2 bg-black/60 border border-white/30 rounded-[2px] text-white text-xs placeholder:text-white/30 focus:border-cyan-400 focus:outline-none disabled:opacity-60 resize-none"
                />
                {!adjusting && !brief.goal && (
                  <div className="flex flex-wrap gap-1.5 mt-1.5">
                    {GOAL_IDEAS.map((g) => (
                      <button key={g} type="button" onClick={() => set('goal', g)} className="px-2 py-1 rounded-[2px] border border-white/15 bg-black/30 text-[10px] text-white/55 hover:text-white hover:border-white/40">
                        {g}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <div className={label}>DAYS PER WEEK</div>
                  <div className="flex gap-1.5">
                    {[2, 3, 4, 5, 6].map((n) => (
                      <button key={n} type="button" className={chip(brief.daysPerWeek === n)} onClick={() => set('daysPerWeek', n)}>
                        {n}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <div className={label}>MINUTES PER SESSION</div>
                  <div className="flex gap-1.5 flex-wrap">
                    {[20, 30, 45, 60, 90].map((n) => (
                      <button key={n} type="button" className={chip(brief.minutesPerSession === n)} onClick={() => set('minutesPerSession', n)}>
                        {n}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div>
                <div className={label}>WHERE YOU TRAIN</div>
                <div className="flex gap-1.5">
                  <button type="button" className={chip(brief.place === 'home')} onClick={() => set('place', 'home')}>HOME</button>
                  <button type="button" className={chip(brief.place === 'gym')} onClick={() => set('place', 'gym')}>GYM</button>
                </div>
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {GEAR.filter((g) => brief.place === 'home' || !g.homeOnly).map((g) => (
                    <button key={g.id} type="button" className={chip(brief.gear.includes(g.id))} onClick={() => toggleGear(g.id)}>
                      {brief.gear.includes(g.id) ? '✓ ' : '+ '}
                      {g.label}
                    </button>
                  ))}
                </div>
                {brief.place === 'home' && <div className="text-[10px] text-white/40 mt-1">Nothing selected = bodyweight only.</div>}
              </div>

              <div>
                <div className={label}>LEVEL</div>
                <div className="flex gap-1.5">
                  {(['beginner', 'intermediate', 'advanced'] as TrainingLevel[]).map((l) => (
                    <button key={l} type="button" className={chip(brief.level === l)} onClick={() => set('level', l)}>
                      {l.toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <div className={label}>INJURIES OR LIMITS (OPTIONAL)</div>
                <input
                  value={brief.limits}
                  onChange={(e) => set('limits', e.target.value.slice(0, 160))}
                  placeholder="e.g. bad left knee, no jumping"
                  className="w-full px-2.5 py-1.5 bg-black/60 border border-white/30 rounded-[2px] text-white text-xs placeholder:text-white/30 focus:border-cyan-400 focus:outline-none"
                />
              </div>
            </>
          )}

          {step === 'loading' && (
            <div className="py-14 flex flex-col items-center gap-3 text-center">
              <Loader2 className="w-7 h-7 text-cyan-300 animate-spin" />
              <div className="text-sm font-bold tracking-[0.2em] text-white anime-glow-text">THEIA IS DESIGNING YOUR PROGRAM</div>
              <div className="text-[11px] text-white/50">Translating your goal into abilities. This can take up to a minute.</div>
            </div>
          )}

          {step === 'preview' && draft && (
            <>
              <div className="border border-cyan-400/40 bg-cyan-950/30 rounded-[2px] p-3">
                <div className="flex items-center gap-1.5 text-[10px] font-bold text-cyan-300 uppercase tracking-wider mb-1">
                  <Target className="w-3 h-3" /> {draft.goal}
                </div>
                <p className="text-[11px] text-white/85 leading-relaxed">{draft.translation}</p>
                {draft.source === 'system' && <p className="text-[10px] text-amber-300/80 mt-1.5">THEIA was unreachable: this is the System baseline plan.</p>}
              </div>

              <div>
                <div className={label}>
                  PHASES · {draft.totalWeeks} WEEKS
                </div>
                <div className="space-y-1">
                  {draft.phases.map((p, i) => (
                    <div key={i} className="flex gap-2 text-[11px]">
                      <span className="text-white font-bold shrink-0">{p.name}</span>
                      <span className="text-white/40 shrink-0">{p.weeks} wk</span>
                      <span className="text-white/60">{p.focus}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <div className={label}>BENCHMARK TESTS · EVERY {draft.retestEveryWeeks} WEEKS</div>
                <ul className="space-y-1">
                  {draft.benchmarks.map((b) => (
                    <li key={b.id} className="text-[11px]">
                      <span className="text-white font-bold">{b.name}</span> <span className="text-white/40">({b.unit})</span>
                      {b.how && <span className="text-white/55"> · {b.how}</span>}
                    </li>
                  ))}
                </ul>
              </div>

              <div>
                <div className={label}>YOUR WEEK · {trainingDays.length} TRAINING DAYS</div>
                <div className="space-y-2">
                  {WEEK_ORDER.map((d) => {
                    const day = draft.split[d];
                    if (!day || day.isRestDay)
                      return (
                        <div key={d} className="flex items-center gap-2 text-[10px] text-white/35 px-2">
                          <Bed className="w-3 h-3" /> {SHORT_DAY[d]} · Rest
                        </div>
                      );
                    return (
                      <div key={d} className="border border-white/20 bg-[#061424]/85 rounded-[2px] p-2.5">
                        <div className="text-[11px] font-bold text-white mb-1.5">
                          {SHORT_DAY[d]} <span className="text-cyan-300/80 font-normal">· {day.focus}</span>
                        </div>
                        <div className="space-y-1">
                          {day.exercises.map((ex, i) => (
                            <div key={`${ex.id}-${i}`} className="flex items-center justify-between gap-2 text-[11px]">
                              <span className="text-white/85 truncate">{ex.name}</span>
                              <span className="flex items-center gap-2 shrink-0">
                                <span className="text-white/45">
                                  {ex.kind === 'strength' ? `${ex.targetSets}×${ex.targetReps}` : `${ex.targetMinutes} min`}
                                </span>
                                <button
                                  type="button"
                                  title="Swap for a similar exercise"
                                  aria-label={`Swap ${ex.name}`}
                                  onClick={() => setDraft((p) => (p ? swapExercise(p, d, i) : p))}
                                  className="w-6 h-6 flex items-center justify-center rounded-[2px] border border-white/20 text-white/50 hover:text-cyan-300 hover:border-cyan-400/50"
                                >
                                  <RefreshCw className="w-3 h-3" />
                                </button>
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {!adjusting && (
                <label className="flex items-start gap-2 text-[11px] text-white/75 cursor-pointer">
                  <input type="checkbox" checked={openGate} onChange={(e) => setOpenGate(e.target.checked)} className="mt-0.5 accent-cyan-400" />
                  <span>Also open a Gate for this goal (its Waves follow the phases, its Boss is the final test).</span>
                </label>
              )}
              <p className="text-[10px] text-white/40">Your current training plan is kept in Saved Templates, so nothing is lost.</p>
            </>
          )}
        </div>

        <div className="px-4 sm:px-5 py-3 border-t border-white/15 flex justify-end gap-2">
          {step === 'brief' && (
            <button type="button" onClick={design} className="px-4 py-2 border border-cyan-400 bg-cyan-950/70 text-white font-bold text-xs tracking-wider rounded-[2px] hover:bg-cyan-900/70 flex items-center gap-1.5">
              <Brain className="w-3.5 h-3.5" /> {adjusting ? 'ADJUST MY PLAN' : 'DESIGN MY PLAN'}
            </button>
          )}
          {step === 'preview' && (
            <>
              <button type="button" onClick={() => setStep('brief')} className="px-3 py-2 border border-white/30 text-white/70 hover:text-white text-xs rounded-[2px]">
                CHANGE ANSWERS
              </button>
              <button type="button" onClick={accept} className="px-4 py-2 border border-emerald-400 bg-emerald-950/60 text-emerald-200 font-bold text-xs tracking-wider rounded-[2px] hover:bg-emerald-900/60 flex items-center gap-1.5">
                <Check className="w-3.5 h-3.5" /> ACCEPT PLAN
              </button>
            </>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
