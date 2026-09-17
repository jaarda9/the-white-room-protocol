import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  getSkillLedger,
  SKILL_LEDGER_UPDATED_EVENT,
  type SkillLedgerEntry,
  type SkillCategory,
} from '@/lib/skill-ledger';
import { Sparkles, Dumbbell, BookOpen, Repeat, Target, X } from 'lucide-react';

const CATEGORY_ORDER: SkillCategory[] = ['skill', 'subject', 'habit', 'technique'];

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
  path: string;
  color: string;
}

interface CategorySection {
  category: SkillCategory;
  tiers: SkillLedgerEntry[][];
  count: number;
}

/** Rounded right-angle "elbow" connector (vertical -> horizontal -> vertical), the standard
 * flowchart/org-chart connector style — reads cleanly even when a child isn't directly under
 * its parent, unlike a straight diagonal line which just looks like clutter at an angle. */
function elbowPath(x1: number, y1: number, x2: number, y2: number): string {
  if (Math.abs(x1 - x2) < 1) return `M ${x1} ${y1} L ${x2} ${y2}`;
  const midY = y1 + (y2 - y1) / 2;
  const dir = x2 > x1 ? 1 : -1;
  const r = Math.max(0, Math.min(10, Math.abs(x2 - x1) / 2, midY - y1, y2 - midY));
  return [
    `M ${x1} ${y1}`,
    `L ${x1} ${midY - r}`,
    `Q ${x1} ${midY} ${x1 + dir * r} ${midY}`,
    `L ${x2 - dir * r} ${midY}`,
    `Q ${x2} ${midY} ${x2} ${midY + r}`,
    `L ${x2} ${y2}`,
  ].join(' ');
}

/**
 * Depth is computed WITHIN a category only — a node's tier is its distance from the nearest
 * root along same-category ancestors. Earlier version chained through ANY parent regardless of
 * category and rendered one mixed-category tier per row; the result was a wall of crossing
 * lines, since most real chains (grip -> weighted carries, finance -> investing, etc.) are
 * single-category but got scattered across a shared row alongside unrelated skills. Splitting
 * into one lane per category keeps almost every line a short vertical drop within its own lane.
 *
 * A rarer cross-category parent (a technique built partly on a subject, say) doesn't get a
 * drawn line at all — it's surfaced as a text tag on the chip instead (see `crossParentNames`
 * below). Drawing a line across lanes would recreate the exact crossing-lines problem this
 * redesign exists to fix, for a case that comes up occasionally, not constantly.
 */
function computeCategoryDepth(
  entry: SkillLedgerEntry,
  byId: Map<string, SkillLedgerEntry>,
  memo: Map<string, number>,
  visiting: Set<string>
): number {
  if (memo.has(entry.id)) return memo.get(entry.id)!;
  if (visiting.has(entry.id)) return 0;
  const sameCategoryParentId = entry.parentIds.find((pid) => byId.get(pid)?.category === entry.category);
  if (!sameCategoryParentId) {
    memo.set(entry.id, 0);
    return 0;
  }
  visiting.add(entry.id);
  const depth = computeCategoryDepth(byId.get(sameCategoryParentId)!, byId, memo, visiting) + 1;
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

  const sections = useMemo((): CategorySection[] => {
    const memo = new Map<string, number>();
    return CATEGORY_ORDER.map((category) => {
      const catEntries = entries.filter((e) => e.category === category);
      const tiers: SkillLedgerEntry[][] = [];
      catEntries.forEach((entry) => {
        const depth = computeCategoryDepth(entry, byId, memo, new Set());
        if (!tiers[depth]) tiers[depth] = [];
        tiers[depth].push(entry);
      });

      // Reorder each tier so a node's siblings cluster together in the same left-to-right
      // order as their parent appeared in the tier above — a simple one-pass barycenter sort.
      // Flex-wrap otherwise renders each tier in raw insertion order, so a child could land far
      // from its parent's horizontal position purely by coincidence, forcing every connector
      // into a long, crossing diagonal even though the underlying tree is clean.
      for (let depth = 1; depth < tiers.length; depth++) {
        const tier = tiers[depth];
        const prevTier = tiers[depth - 1];
        if (!tier || !prevTier) continue;
        const parentIndex = new Map(prevTier.map((e, i) => [e.id, i]));
        tier.sort((a, b) => {
          const pa = a.parentIds.find((pid) => byId.get(pid)?.category === category);
          const pb = b.parentIds.find((pid) => byId.get(pid)?.category === category);
          return (pa ? parentIndex.get(pa) ?? 0 : 0) - (pb ? parentIndex.get(pb) ?? 0 : 0);
        });
      }

      return { category, tiers, count: catEntries.length };
    }).filter((s) => s.count > 0);
  }, [entries, byId]);

  // Lines are drawn from MEASURED card positions, not computed math — chip widths vary with
  // name length and wrap with the viewport, so real DOM rects are the only thing that stays
  // correct across screen sizes without hand-tuning coordinates. Only same-category parent
  // links get a line; see computeCategoryDepth's note on why cross-category ones don't.
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
        const sameCategoryParentId = entry.parentIds.find((pid) => byId.get(pid)?.category === entry.category);
        if (!sameCategoryParentId) return;
        const parentEl = nodeRefs.current.get(sameCategoryParentId);
        if (!parentEl) return;
        const pr = parentEl.getBoundingClientRect();
        const x1 = pr.left + pr.width / 2 - containerRect.left;
        const y1 = pr.bottom - containerRect.top;
        const x2 = cr.left + cr.width / 2 - containerRect.left;
        const y2 = cr.top - containerRect.top;
        next.push({
          id: `${sameCategoryParentId}-${entry.id}`,
          path: elbowPath(x1, y1, x2, y2),
          color: CATEGORY_HEX[entry.category],
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
  }, [entries, byId]);

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
        Everything THEIA has taught you, grouped by discipline and tiered by how each skill builds on the last.
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

      <div ref={containerRef} className="relative space-y-6 py-1">
        <svg className="absolute inset-0 pointer-events-none" width="100%" height="100%" style={{ overflow: 'visible' }}>
          {edges.map((e) => (
            <path key={e.id} d={e.path} fill="none" stroke={e.color} strokeOpacity={0.45} strokeWidth={1.5} strokeLinecap="round" />
          ))}
        </svg>

        {sections.map(({ category, tiers }) => {
          const SectionIcon = CATEGORY_ICON[category];
          const color = CATEGORY_HEX[category];
          return (
            <div key={category} className="relative border-t pt-4 first:border-t-0 first:pt-0" style={{ borderColor: `${color}30` }}>
              <div className="flex items-center gap-1.5 mb-3">
                <SectionIcon className="w-3.5 h-3.5" style={{ color }} />
                <span className="text-xs font-bold tracking-[0.15em]" style={{ color }}>
                  {CATEGORY_LABEL[category]}
                </span>
              </div>
              <div className="space-y-3">
                {tiers.map(
                  (tier, depth) =>
                    tier && (
                      <div key={depth} className="relative space-y-2">
                        <div className="text-[9px] tracking-[0.2em] text-white/30">
                          {depth === 0 ? 'ROOT' : `+${depth}`}
                        </div>
                        <div className="flex flex-wrap gap-3">
                          {tier.map((entry) => {
                            const Icon = CATEGORY_ICON[entry.category];
                            const proficiency = Math.max(0, Math.min(100, entry.proficiency));
                            const isSelected = entry.id === selectedId;
                            const crossParentNames = entry.parentIds
                              .map((pid) => byId.get(pid))
                              .filter((p): p is SkillLedgerEntry => !!p && p.category !== entry.category)
                              .map((p) => p.name);
                            return (
                              <button
                                key={entry.id}
                                ref={(el) => {
                                  if (el) nodeRefs.current.set(entry.id, el);
                                  else nodeRefs.current.delete(entry.id);
                                }}
                                type="button"
                                onClick={() => setSelectedId(isSelected ? null : entry.id)}
                                className="relative flex items-center gap-2 border rounded-[3px] pl-2 pr-3 py-1.5 bg-[#061424]/90 w-full sm:w-auto sm:min-w-[160px] sm:max-w-[220px] text-left transition-transform hover:scale-[1.03]"
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
                                  <div className="text-xs font-bold text-white truncate">{entry.name}</div>
                                  <div className="mt-1 h-1 bg-black/40 rounded-full overflow-hidden">
                                    <div className="h-full" style={{ width: `${proficiency}%`, backgroundColor: color }} />
                                  </div>
                                  {crossParentNames.length > 0 && (
                                    <div className="mt-1 text-[8px] text-white/40 truncate">
                                      ⇢ also from {crossParentNames.join(', ')}
                                    </div>
                                  )}
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
        })}
      </div>
    </div>
  );
}
