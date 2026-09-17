import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  getSkillLedger,
  SKILL_LEDGER_UPDATED_EVENT,
  type SkillLedgerEntry,
  type SkillCategory,
} from '@/lib/skill-ledger';
import { Sparkles, Dumbbell, BookOpen, Repeat, Target, X } from 'lucide-react';

const CATEGORY_ICON: Record<SkillCategory, typeof Dumbbell> = {
  skill: Dumbbell,
  subject: BookOpen,
  habit: Repeat,
  technique: Target,
};

const CATEGORY_LABEL: Record<SkillCategory, string> = {
  skill: 'SKILL',
  subject: 'SUBJECT',
  habit: 'HABIT',
  technique: 'TECHNIQUE',
};

const CATEGORY_HEX: Record<SkillCategory, string> = {
  skill: '#34d399',
  subject: '#22d3ee',
  habit: '#fbbf24',
  technique: '#c084fc',
};

interface Edge {
  id: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  color: string;
}

/** Depth = distance from the nearest root along a node's FIRST listed parent (the Ledger is a
 * DAG — a node can have >1 parent — so "depth" only tracks one lineage; every parent still gets
 * a drawn connector, it just doesn't affect which tier the node lands in). Cycle-guarded and
 * memoized the same defensive way gates.ts normalizes on read. */
function computeDepth(
  entry: SkillLedgerEntry,
  byId: Map<string, SkillLedgerEntry>,
  memo: Map<string, number>,
  visiting: Set<string>
): number {
  if (memo.has(entry.id)) return memo.get(entry.id)!;
  if (visiting.has(entry.id)) return 0;
  const primaryParentId = entry.parentIds.find((pid) => byId.has(pid));
  if (!primaryParentId) {
    memo.set(entry.id, 0);
    return 0;
  }
  visiting.add(entry.id);
  const depth = computeDepth(byId.get(primaryParentId)!, byId, memo, visiting) + 1;
  visiting.delete(entry.id);
  memo.set(entry.id, depth);
  return depth;
}

export default function SkillTreePanel() {
  const [entries, setEntries] = useState<SkillLedgerEntry[]>(() => getSkillLedger());
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [edges, setEdges] = useState<Edge[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);
  const nodeRefs = useRef(new Map<string, HTMLButtonElement>());

  useEffect(() => {
    const sync = () => setEntries(getSkillLedger());
    window.addEventListener(SKILL_LEDGER_UPDATED_EVENT, sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener(SKILL_LEDGER_UPDATED_EVENT, sync);
      window.removeEventListener('storage', sync);
    };
  }, []);

  const byId = useMemo(() => new Map(entries.map((e) => [e.id, e])), [entries]);

  const tiers = useMemo(() => {
    const memo = new Map<string, number>();
    const tiersArr: SkillLedgerEntry[][] = [];
    entries.forEach((entry) => {
      const depth = computeDepth(entry, byId, memo, new Set());
      if (!tiersArr[depth]) tiersArr[depth] = [];
      tiersArr[depth].push(entry);
    });
    return tiersArr;
  }, [entries, byId]);

  // Lines are drawn from MEASURED card positions, not computed math — chip widths vary with
  // name length and wrap with the viewport, so real DOM rects are the only thing that stays
  // correct across screen sizes without hand-tuning coordinates.
  useLayoutEffect(() => {
    const recompute = () => {
      const container = containerRef.current;
      if (!container) return;
      const containerRect = container.getBoundingClientRect();
      const next: Edge[] = [];
      entries.forEach((entry) => {
        const childEl = nodeRefs.current.get(entry.id);
        if (!childEl) return;
        const cr = childEl.getBoundingClientRect();
        entry.parentIds.forEach((parentId) => {
          const parentEl = nodeRefs.current.get(parentId);
          if (!parentEl) return;
          const pr = parentEl.getBoundingClientRect();
          next.push({
            id: `${parentId}-${entry.id}`,
            x1: pr.left + pr.width / 2 - containerRect.left,
            y1: pr.bottom - containerRect.top,
            x2: cr.left + cr.width / 2 - containerRect.left,
            y2: cr.top - containerRect.top,
            color: CATEGORY_HEX[entry.category],
          });
        });
      });
      setEdges(next);
    };

    recompute();
    const ro = new ResizeObserver(recompute);
    if (containerRef.current) ro.observe(containerRef.current);
    window.addEventListener('resize', recompute);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', recompute);
    };
  }, [entries]);

  const selected = selectedId ? byId.get(selectedId) || null : null;

  if (entries.length === 0) {
    return (
      <div className="border border-white/30 bg-[#061424]/80 rounded-[2px] p-6 text-center space-y-3 shadow-[inset_0_0_14px_rgba(0,212,255,0.06)]">
        <div className="w-12 h-12 mx-auto border border-cyan-400/40 bg-cyan-950/40 rounded-[2px] flex items-center justify-center text-cyan-300 shadow-[0_0_15px_rgba(0,212,255,0.25)]">
          <Sparkles className="w-6 h-6" />
        </div>
        <div className="text-xs sm:text-sm font-bold tracking-widest text-cyan-300 anime-glow-text">
          [ LEDGER EMPTY ]
        </div>
        <p className="text-xs text-white/60 leading-relaxed">
          Nothing taught yet — clear your first THEIA Directive (Dungeon Gates) to begin filling this in.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-white/70 leading-relaxed">
        Everything THEIA has taught you through Directives, tiered by how each skill builds on the last.
      </p>

      {selected && (
        <div className="border border-white/40 bg-[#061424]/90 rounded-[2px] p-3 space-y-1.5 shadow-[inset_0_0_14px_rgba(0,212,255,0.06)]">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-1.5" style={{ color: CATEGORY_HEX[selected.category] }}>
              {(() => {
                const Icon = CATEGORY_ICON[selected.category];
                return <Icon className="w-3.5 h-3.5" />;
              })()}
              <span className="text-[9px] font-bold tracking-wider">{CATEGORY_LABEL[selected.category]}</span>
            </div>
            <button type="button" onClick={() => setSelectedId(null)} className="text-white/40 hover:text-white transition-colors">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="text-sm font-bold text-white">{selected.name}</div>
          {selected.parentIds.length > 0 && (
            <div className="text-[10px] text-white/50">
              ↳ from {selected.parentIds.map((pid) => byId.get(pid)?.name).filter(Boolean).join(', ')}
            </div>
          )}
          <div className="flex items-center gap-2 pt-1">
            <div className="flex-1 h-1.5 bg-black/40 rounded-full overflow-hidden">
              <div
                className="h-full"
                style={{
                  width: `${Math.max(0, Math.min(100, selected.proficiency))}%`,
                  backgroundColor: CATEGORY_HEX[selected.category],
                }}
              />
            </div>
            <span className="text-[10px] text-white/60 font-bold">{Math.round(selected.proficiency)}%</span>
          </div>
        </div>
      )}

      <div ref={containerRef} className="relative space-y-7 py-1">
        <svg className="absolute inset-0 pointer-events-none" width="100%" height="100%" style={{ overflow: 'visible' }}>
          {edges.map((e) => (
            <line key={e.id} x1={e.x1} y1={e.y1} x2={e.x2} y2={e.y2} stroke={e.color} strokeOpacity={0.35} strokeWidth={1.5} />
          ))}
        </svg>

        {tiers.map(
          (tier, depth) =>
            tier && (
              <div key={depth} className="relative space-y-2">
                <div className="text-[10px] tracking-[0.2em] text-white/40">
                  {depth === 0 ? 'FOUNDATIONS' : `TIER ${depth}`}
                </div>
                <div className="flex flex-wrap gap-3">
                  {tier.map((entry) => {
                    const Icon = CATEGORY_ICON[entry.category];
                    const color = CATEGORY_HEX[entry.category];
                    const proficiency = Math.max(0, Math.min(100, entry.proficiency));
                    const isSelected = entry.id === selectedId;
                    return (
                      <button
                        key={entry.id}
                        ref={(el) => {
                          if (el) nodeRefs.current.set(entry.id, el);
                          else nodeRefs.current.delete(entry.id);
                        }}
                        type="button"
                        onClick={() => setSelectedId(isSelected ? null : entry.id)}
                        className="relative flex items-center gap-2 border rounded-[3px] pl-2 pr-3 py-1.5 bg-[#061424]/90 min-w-[150px] max-w-[190px] text-left transition-transform hover:scale-[1.03]"
                        style={{
                          borderColor: isSelected ? color : `${color}66`,
                          boxShadow: isSelected ? `0 0 10px ${color}` : 'inset 0 0 10px rgba(0,212,255,0.05)',
                        }}
                      >
                        <div
                          className="w-7 h-7 rounded-full flex items-center justify-center shrink-0"
                          style={{ backgroundColor: `${color}22`, border: `1px solid ${color}` }}
                        >
                          <Icon className="w-3.5 h-3.5" style={{ color }} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="text-[8px] font-bold tracking-wider" style={{ color }}>
                            {CATEGORY_LABEL[entry.category]}
                          </div>
                          <div className="text-xs font-bold text-white truncate">{entry.name}</div>
                          <div className="mt-1 h-1 bg-black/40 rounded-full overflow-hidden">
                            <div className="h-full" style={{ width: `${proficiency}%`, backgroundColor: color }} />
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )
        )}
      </div>
    </div>
  );
}
