import { useEffect, useState } from 'react';
import { Brain, ChevronDown, ChevronUp, Target } from 'lucide-react';
import { toast } from 'sonner';
import { systemSound } from '@/lib/system-sound';
import TrainingArchitectModal from '@/components/TrainingArchitectModal';
import {
  benchmarkDue,
  currentPhase,
  endTrainingProgram,
  getTrainingProgram,
  programWeek,
  TRAINING_PROGRAM_EVENT,
  recordBenchmark,
  type TrainingProgram,
} from '@/lib/training-architect';

/**
 * Physical Lab: the Hunter's THEIA program (week, phase, benchmark tests, adjust) — or, with no
 * program, one quiet link to ask THEIA for one.
 */
export default function TrainingProgramCard({ onPlanChanged }: { onPlanChanged: () => void }) {
  const [program, setProgram] = useState<TrainingProgram | null>(() => getTrainingProgram());
  const [architect, setArchitect] = useState<'new' | 'adjust' | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [values, setValues] = useState<Record<string, string>>({});

  // Created from the Training Plan builder, or arrived from another device.
  useEffect(() => {
    const reread = () => setProgram(getTrainingProgram());
    window.addEventListener(TRAINING_PROGRAM_EVENT, reread);
    window.addEventListener('wrp:quests-updated', reread);
    return () => {
      window.removeEventListener(TRAINING_PROGRAM_EVENT, reread);
      window.removeEventListener('wrp:quests-updated', reread);
    };
  }, []);

  const modal = (
    <TrainingArchitectModal
      isOpen={architect !== null}
      previous={architect === 'adjust' ? program : null}
      onClose={() => setArchitect(null)}
      onAccepted={(p) => {
        setProgram(p);
        onPlanChanged();
      }}
    />
  );

  if (!program) {
    return (
      <div className="text-center mb-4">
        <button
          type="button"
          onClick={() => {
            systemSound.playClick();
            setArchitect('new');
          }}
          className="text-[11px] text-cyan-300/70 hover:text-white transition-colors inline-flex items-center gap-1.5"
        >
          <Brain className="w-3.5 h-3.5" /> [ HAVE A GOAL? ASK THEIA FOR A TRAINING PLAN ]
        </button>
        {modal}
      </div>
    );
  }

  const week = programWeek(program);
  const phase = currentPhase(program);
  const due = benchmarkDue(program);
  const last = program.results[program.results.length - 1];
  const first = program.results[0];
  const finished = !phase;

  const saveResults = () => {
    const parsed: Record<string, number> = {};
    for (const [k, v] of Object.entries(values)) {
      const n = parseFloat(v.replace(',', '.'));
      if (Number.isFinite(n) && n >= 0) parsed[k] = n;
    }
    if (Object.keys(parsed).length === 0) {
      toast.error('Enter at least one result.');
      return;
    }
    const next = recordBenchmark(parsed);
    if (next) setProgram(next);
    setValues({});
    systemSound.playClick();
    toast.success(program.results.length === 0 ? 'BASELINE RECORDED' : 'BENCHMARK RECORDED', {
      description: program.results.length === 0 ? 'Your starting scores are saved. Retest in a few weeks to see the change.' : 'You can ask THEIA to adjust the plan from these results.',
    });
  };

  const delta = (id: string, better: 'higher' | 'lower') => {
    if (!first || !last || first === last) return null;
    const a = first.values[id];
    const b = last.values[id];
    if (a === undefined || b === undefined) return null;
    const diff = Math.round((b - a) * 100) / 100;
    const good = better === 'higher' ? diff > 0 : diff < 0;
    if (diff === 0) return <span className="text-white/40">±0</span>;
    return <span className={good ? 'text-emerald-300' : 'text-red-300'}>{diff > 0 ? `+${diff}` : diff}</span>;
  };

  return (
    <div className="mb-4 border border-cyan-400/40 bg-[#061424]/85 rounded-[2px] text-xs">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center justify-between gap-2 p-3 text-left hover:bg-white/5"
      >
        <span className="min-w-0">
          <span className="flex items-center gap-1.5 text-[10px] font-bold text-cyan-300 uppercase tracking-wider">
            <Target className="w-3 h-3 shrink-0" /> <span className="truncate">THEIA PROGRAM: {program.goal}</span>
          </span>
          <span className="block text-[11px] text-white/70 mt-0.5">
            {finished ? 'Program complete: take the final test' : `Week ${week} of ${program.totalWeeks} · ${phase!.name}`}
            {due && <span className="text-amber-300"> · Benchmark due</span>}
          </span>
        </span>
        {expanded ? <ChevronUp className="w-3.5 h-3.5 text-cyan-300/60 shrink-0" /> : <ChevronDown className="w-3.5 h-3.5 text-cyan-300/60 shrink-0" />}
      </button>

      {expanded && (
        <div className="px-3 pb-3 space-y-3 border-t border-white/10 pt-3">
          {phase && <p className="text-[11px] text-white/65">Focus now: {phase.focus}</p>}

          <div>
            <div className="text-[10px] font-bold text-[#9fd3ff] uppercase tracking-wider mb-1.5">
              {due ? (program.results.length ? 'BENCHMARK DUE: RETEST' : 'TAKE YOUR BASELINE TEST') : 'BENCHMARKS'}
            </div>
            <div className="space-y-1.5">
              {program.benchmarks.map((b) => (
                <div key={b.id} className="flex items-center justify-between gap-2">
                  <span className="min-w-0">
                    <span className="block text-[11px] text-white truncate">{b.name}</span>
                    {due && b.how && <span className="block text-[10px] text-white/40">{b.how}</span>}
                  </span>
                  <span className="flex items-center gap-2 shrink-0 text-[11px]">
                    {last?.values[b.id] !== undefined && (
                      <span className="text-white/55">
                        {last.values[b.id]} {b.unit} {delta(b.id, b.better)}
                      </span>
                    )}
                    {due && (
                      <input
                        inputMode="decimal"
                        aria-label={`${b.name} result`}
                        value={values[b.id] || ''}
                        onChange={(e) => setValues((v) => ({ ...v, [b.id]: e.target.value.slice(0, 8) }))}
                        placeholder={b.unit}
                        className="w-20 px-2 py-1 bg-black/60 border border-white/30 rounded-[2px] text-white text-xs placeholder:text-white/30 focus:border-cyan-400 focus:outline-none"
                      />
                    )}
                  </span>
                </div>
              ))}
            </div>
            {due && (
              <button type="button" onClick={saveResults} className="mt-2 px-3 py-1.5 border border-cyan-400/60 bg-cyan-950/50 text-white text-[11px] font-bold rounded-[2px] hover:bg-cyan-900/60">
                SAVE RESULTS
              </button>
            )}
          </div>

          <div className="flex flex-wrap gap-2 pt-1 border-t border-white/10">
            {program.results.length >= 2 && (
              <button
                type="button"
                onClick={() => {
                  systemSound.playClick();
                  setArchitect('adjust');
                }}
                className="px-3 py-1.5 border border-cyan-400/50 text-cyan-200 text-[11px] rounded-[2px] hover:bg-cyan-950/50 flex items-center gap-1"
              >
                <Brain className="w-3 h-3" /> ASK THEIA TO ADJUST THE PLAN
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                systemSound.playClick();
                setArchitect('new');
              }}
              className="px-3 py-1.5 border border-white/25 text-white/65 hover:text-white text-[11px] rounded-[2px]"
            >
              NEW GOAL
            </button>
            <button
              type="button"
              onClick={() => {
                if (!window.confirm('End this program? Your current training plan stays as it is.')) return;
                endTrainingProgram();
                setProgram(null);
              }}
              className="px-3 py-1.5 border border-white/15 text-white/45 hover:text-red-300 text-[11px] rounded-[2px]"
            >
              END PROGRAM
            </button>
          </div>
        </div>
      )}
      {modal}
    </div>
  );
}
