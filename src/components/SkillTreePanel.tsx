import { useEffect, useMemo, useState } from 'react';
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

/** Hex, not Tailwind classes — these get used directly as SVG stroke/fill attributes for the
 * per-node proficiency ring, not just className strings. */
const CATEGORY_HEX: Record<SkillCategory, string> = {
  skill: '#34d399',
  subject: '#22d3ee',
  habit: '#fbbf24',
  technique: '#c084fc',
};

const NODE_SIZE = 44; // px diameter — a real mobile tap target, not just a decorative dot
const MIN_GAP = NODE_SIZE + 18; // minimum clear space wanted between two same-radius neighbors
const BASE_RADIUS = 70; // floor for the first (root) ring — actual value scales up from this
const DEPTH_STEP = 100; // floor for spacing per tier outward — also scales up with node count
const TOTAL_ANGLE = Math.PI; // semicircle — the fan opens upward from the origin

interface LayoutNode {
  entry: SkillLedgerEntry;
  x: number; // px, relative to the fan's origin (bottom-center of the diagram)
  y: number; // px, relative to the same origin — always <= 0 (fan opens upward)
  depth: number;
}

/**
 * Radial tree layout using the standard Reingold-Tilford trick applied to angle instead of x:
 * every LEAF gets an evenly-spaced angular slot, and each internal node's angle is the average
 * of its children's — so branches never cross or crowd each other regardless of how lopsided
 * the tree is (allocating angle by subtree *size* instead, an earlier attempt here, let a single
 * lightly-branched skill get squeezed into a sliver next to a heavily-branched one and the whole
 * fan collapsed into an overlapping cluster). Radius grows with depth as normal.
 *
 * The Ledger is a DAG (a node can have >1 parent — see skill-ledger.ts), which a tree layout
 * can't position perfectly for every edge at once. Each node slots into the fan under its FIRST
 * listed parent only; a line is still drawn to every OTHER parent afterward, it just doesn't
 * influence anyone's position.
 */
function layoutTree(entries: SkillLedgerEntry[]): { nodes: LayoutNode[]; width: number; height: number } {
  const byId = new Map(entries.map((e) => [e.id, e]));
  const childrenOf = new Map<string, SkillLedgerEntry[]>();
  const roots: SkillLedgerEntry[] = [];

  entries.forEach((e) => {
    const primaryParent = e.parentIds.find((pid) => byId.has(pid));
    if (!primaryParent) {
      roots.push(e);
    } else {
      if (!childrenOf.has(primaryParent)) childrenOf.set(primaryParent, []);
      childrenOf.get(primaryParent)!.push(e);
    }
  });

  const slotOf = new Map<string, number>(); // leaves: index + 0.5; internal: avg of children
  const depthOf = new Map<string, number>();
  let nextLeafSlot = 0;
  let maxDepth = 0;

  const visit = (entry: SkillLedgerEntry, depth: number) => {
    depthOf.set(entry.id, depth);
    maxDepth = Math.max(maxDepth, depth);
    const kids = childrenOf.get(entry.id) || [];
    if (kids.length === 0) {
      slotOf.set(entry.id, nextLeafSlot + 0.5);
      nextLeafSlot += 1;
      return;
    }
    kids.forEach((kid) => visit(kid, depth + 1));
    const avg = kids.reduce((sum, k) => sum + (slotOf.get(k.id) ?? 0), 0) / kids.length;
    slotOf.set(entry.id, avg);
  };
  roots.forEach((root) => visit(root, 0));

  const leafCount = Math.max(1, nextLeafSlot);
  const slotAngle = TOTAL_ANGLE / leafCount;
  // Two adjacent leaves are exactly one slotAngle apart — solve for the radius that keeps their
  // chord distance at MIN_GAP, so the fan auto-widens as the Ledger grows instead of relying on
  // a hardcoded guess that only happens to work for today's handful of skills.
  const requiredRadius = MIN_GAP / (2 * Math.sin(slotAngle / 2));
  const baseRadius = Math.max(BASE_RADIUS, requiredRadius);
  const depthStep = Math.max(DEPTH_STEP, requiredRadius * 0.55);

  const nodes: LayoutNode[] = entries.map((entry) => {
    const slot = slotOf.get(entry.id) ?? 0;
    const depth = depthOf.get(entry.id) ?? 0;
    const angle = TOTAL_ANGLE - slot * slotAngle;
    const radius = baseRadius + depth * depthStep;
    return { entry, x: Math.cos(angle) * radius, y: -Math.sin(angle) * radius, depth };
  });

  const maxRadius = baseRadius + maxDepth * depthStep;
  const pad = NODE_SIZE * 1.5;
  return {
    nodes,
    width: maxRadius * 2 + pad * 2,
    height: maxRadius + pad * 2,
  };
}

export default function SkillTreePanel() {
  const [entries, setEntries] = useState<SkillLedgerEntry[]>(() => getSkillLedger());
  const [selectedId, setSelectedId] = useState<string | null>(null);

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
  const layout = useMemo(() => layoutTree(entries), [entries]);
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

  const originX = layout.width / 2;
  const originY = layout.height - NODE_SIZE; // fan's origin sits near the bottom of the diagram

  return (
    <div className="space-y-3">
      {selected ? (
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
      ) : (
        <p className="text-xs text-white/70 leading-relaxed">
          Everything THEIA has taught you through Directives. Tap a node for details.
        </p>
      )}

      {/* Natural size, not scaled to fit — a deep tree can run wider than the screen, and
          panning/scrolling to explore it is normal for a skill tree (real games do the same)
          rather than shrinking nodes past a comfortable tap target. */}
      <div className="overflow-x-auto overflow-y-hidden border border-white/20 bg-[#050d18]/80 rounded-[2px]">
        <div className="relative mx-auto" style={{ width: layout.width, height: layout.height }}>
          <svg
            className="absolute inset-0 pointer-events-none"
            width={layout.width}
            height={layout.height}
          >
            {entries.map((entry) =>
              entry.parentIds.map((parentId) => {
                const child = layout.nodes.find((n) => n.entry.id === entry.id);
                const parent = layout.nodes.find((n) => n.entry.id === parentId);
                if (!child || !parent) return null;
                return (
                  <line
                    key={`${parentId}-${entry.id}`}
                    x1={originX + parent.x}
                    y1={originY + parent.y}
                    x2={originX + child.x}
                    y2={originY + child.y}
                    stroke="rgba(255,255,255,0.25)"
                    strokeWidth={1.5}
                  />
                );
              })
            )}
          </svg>

          {layout.nodes.map(({ entry, x, y }) => {
            const Icon = CATEGORY_ICON[entry.category];
            const color = CATEGORY_HEX[entry.category];
            const proficiency = Math.max(0, Math.min(100, entry.proficiency));
            const ringRadius = NODE_SIZE / 2 - 3;
            const circumference = 2 * Math.PI * ringRadius;
            const isSelected = entry.id === selectedId;
            return (
              <button
                key={entry.id}
                type="button"
                onClick={() => setSelectedId(entry.id)}
                title={entry.name}
                className="absolute flex items-center justify-center rounded-full bg-[#0a1b2e] transition-transform hover:scale-110"
                style={{
                  left: originX + x - NODE_SIZE / 2,
                  top: originY + y - NODE_SIZE / 2,
                  width: NODE_SIZE,
                  height: NODE_SIZE,
                  boxShadow: isSelected ? `0 0 14px ${color}` : `0 0 6px rgba(0,0,0,0.6)`,
                }}
              >
                <svg width={NODE_SIZE} height={NODE_SIZE} className="absolute inset-0">
                  <circle cx={NODE_SIZE / 2} cy={NODE_SIZE / 2} r={ringRadius} fill="none" stroke={color} strokeOpacity={0.25} strokeWidth={2.5} />
                  <circle
                    cx={NODE_SIZE / 2}
                    cy={NODE_SIZE / 2}
                    r={ringRadius}
                    fill="none"
                    stroke={color}
                    strokeWidth={2.5}
                    strokeDasharray={circumference}
                    strokeDashoffset={circumference * (1 - proficiency / 100)}
                    strokeLinecap="round"
                    transform={`rotate(-90 ${NODE_SIZE / 2} ${NODE_SIZE / 2})`}
                  />
                </svg>
                <Icon className="w-4 h-4" style={{ color }} />
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
