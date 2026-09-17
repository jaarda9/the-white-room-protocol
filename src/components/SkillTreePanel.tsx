import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  getSkillLedger,
  SKILL_LEDGER_UPDATED_EVENT,
  type SkillLedgerEntry,
  type SkillCategory,
} from '@/lib/skill-ledger';
import { useLockBodyScroll } from '@/hooks/use-lock-body-scroll';
import { Sparkles, Dumbbell, BookOpen, Repeat, Target, X, Calendar, TrendingUp } from 'lucide-react';

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

/**
 * Nested outline instead of horizontal tiers-with-drawn-lines. Two earlier attempts (mixed-
 * category tiers, then per-category tiers with measured SVG connectors) both broke down on
 * mobile: once chips have to be full-width to keep names readable, a tier can only fit ONE chip
 * per row, so every branch collapses into a single shared column — a connector then has to
 * physically cross through OTHER, unrelated branches' chips just to reach its own child a few
 * rows down. A nested list sidesteps the problem entirely: a skill's children render indented
 * directly beneath it, so a branch is always one uninterrupted block and never has to reach past
 * anyone else's chip. The "connecting line" is just a plain CSS left border on the indent
 * wrapper — no SVG, no measurement, nothing that can desync from real layout on a given screen.
 */
interface SkillNodeProps {
  entry: SkillLedgerEntry;
  childrenOf: Map<string, SkillLedgerEntry[]>;
  byId: Map<string, SkillLedgerEntry>;
  color: string;
  selectedId: string | null;
  onSelect: (id: string) => void;
  visited: Set<string>;
}

function SkillNode({ entry, childrenOf, byId, color, selectedId, onSelect, visited }: SkillNodeProps) {
  if (visited.has(entry.id)) return null; // cycle guard — a malformed DAG can't loop forever
  const nextVisited = new Set(visited);
  nextVisited.add(entry.id);

  const Icon = CATEGORY_ICON[entry.category];
  const proficiency = Math.max(0, Math.min(100, entry.proficiency));
  const isSelected = entry.id === selectedId;
  const primaryParentId = entry.parentIds.find((pid) => byId.get(pid)?.category === entry.category);
  const otherParents = entry.parentIds
    .filter((pid) => pid !== primaryParentId)
    .map((pid) => byId.get(pid))
    .filter((p): p is SkillLedgerEntry => !!p);
  const kids = childrenOf.get(entry.id) || [];

  return (
    <div>
      <button
        type="button"
        onClick={() => onSelect(entry.id)}
        className="relative flex items-center gap-2 border rounded-[3px] pl-2 pr-3 py-1.5 bg-[#061424]/90 w-full text-left transition-transform hover:scale-[1.01]"
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
          {otherParents.length > 0 && (
            <div className="mt-1 text-[8px] text-white/40 truncate">
              ⇢ also from {otherParents.map((p) => p.name).join(', ')}
            </div>
          )}
        </div>
      </button>
      {kids.length > 0 && (
        <div className="ml-3.5 pl-3 mt-2 space-y-2 border-l-2" style={{ borderColor: `${color}35` }}>
          {kids.map((kid) => (
            <SkillNode
              key={kid.id}
              entry={kid}
              childrenOf={childrenOf}
              byId={byId}
              color={color}
              selectedId={selectedId}
              onSelect={onSelect}
              visited={nextVisited}
            />
          ))}
        </div>
      )}
    </div>
  );
}

interface CategorySection {
  category: SkillCategory;
  roots: SkillLedgerEntry[];
  childrenOf: Map<string, SkillLedgerEntry[]>;
  count: number;
}

interface SkillDetailModalProps {
  entry: SkillLedgerEntry;
  byId: Map<string, SkillLedgerEntry>;
  onClose: () => void;
}

// Same portal + backdrop pattern as every other modal in the app (see GeminiApiKeyModal.tsx) —
// a plain in-flow "selected" card was cheap but got in the way of the tree above it and gave no
// room for more than a line or two of detail. Reusing the established modal shape here means it
// inherits the already-fixed iOS safe-area/backdrop-stacking behavior for free.
function SkillDetailModal({ entry, byId, onClose }: SkillDetailModalProps) {
  useLockBodyScroll(true);
  const Icon = CATEGORY_ICON[entry.category];
  const color = CATEGORY_HEX[entry.category];
  const proficiency = Math.max(0, Math.min(100, entry.proficiency));
  const parentNames = entry.parentIds.map((pid) => byId.get(pid)?.name).filter(Boolean) as string[];
  const acquired = new Date(entry.acquiredAt);
  const acquiredLabel = Number.isNaN(acquired.getTime()) ? null : acquired.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
  const reinforced = entry.lastReinforcedAt ? new Date(entry.lastReinforcedAt) : null;
  const reinforcedLabel = reinforced && !Number.isNaN(reinforced.getTime())
    ? reinforced.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
    : null;

  return createPortal(
    <div className="modal-safe-pad fixed inset-0 z-[60] bg-black/80 backdrop-blur-sm flex items-center justify-center animate-fade-in font-mono">
      <div className="relative max-w-[420px] w-full bg-[#0a1b2e]/95 border-2 border-white/50 rounded-[4px] p-4 sm:p-5 text-white shadow-[0_0_35px_rgba(0,0,0,0.9),inset_0_0_24px_rgba(0,212,255,0.08)] font-mono anime-dropdown modal-card-max-h flex flex-col my-auto">
        {/* Header */}
        <div className="flex items-center justify-between pb-2 mb-2.5 border-b border-white/15">
          <div className="flex items-center gap-2">
            <div
              className="w-8 h-8 rounded-[2px] flex items-center justify-center shrink-0"
              style={{ backgroundColor: `${color}22`, border: `1px solid ${color}` }}
            >
              <Icon className="w-4 h-4" style={{ color }} />
            </div>
            <span className="text-[10px] font-bold tracking-[0.2em]" style={{ color }}>
              {CATEGORY_LABEL[entry.category]}
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-7 h-7 rounded-[2px] border border-white/30 hover:border-white/70 bg-black/40 hover:bg-white/10 text-white/70 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
            title="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto pr-1 space-y-2.5">
          <div className="text-base font-bold text-white anime-glow-text">{entry.name}</div>

          {entry.description && (
            <div className="border border-white/30 bg-[#061424]/85 rounded-[2px] p-2.5">
              <div className="text-[10px] text-white/50 mb-1">TAUGHT BY THEIA</div>
              <p className="text-xs text-white/80 leading-relaxed">{entry.description}</p>
            </div>
          )}

          <div className="border border-white/30 bg-[#061424]/85 rounded-[2px] p-2.5">
            <div className="flex items-center justify-between text-[10px] text-white/50 mb-1">
              <span className="flex items-center gap-1"><TrendingUp className="w-3 h-3" /> PROFICIENCY</span>
              <span className="font-bold" style={{ color }}>{Math.round(proficiency)}%</span>
            </div>
            <div className="h-1.5 bg-black/40 rounded-full overflow-hidden">
              <div className="h-full" style={{ width: `${proficiency}%`, backgroundColor: color }} />
            </div>
          </div>

          {parentNames.length > 0 && (
            <div className="border border-white/30 bg-[#061424]/85 rounded-[2px] p-2.5">
              <div className="text-[10px] text-white/50 mb-1">GREW FROM</div>
              <div className="text-xs text-white/90">{parentNames.join(', ')}</div>
            </div>
          )}

          {acquiredLabel && (
            <div className="border border-white/30 bg-[#061424]/85 rounded-[2px] p-2.5 flex items-center gap-2 text-xs text-white/70">
              <Calendar className="w-3.5 h-3.5 text-white/40 shrink-0" />
              <span>Learned {acquiredLabel}{reinforcedLabel ? ` · last reinforced ${reinforcedLabel}` : ''}</span>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
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

  const sections = useMemo((): CategorySection[] => {
    return CATEGORY_ORDER.map((category) => {
      const catEntries = entries.filter((e) => e.category === category);
      const childrenOf = new Map<string, SkillLedgerEntry[]>();
      const roots: SkillLedgerEntry[] = [];
      catEntries.forEach((entry) => {
        const primaryParentId = entry.parentIds.find((pid) => byId.get(pid)?.category === category);
        if (!primaryParentId) {
          roots.push(entry);
        } else {
          if (!childrenOf.has(primaryParentId)) childrenOf.set(primaryParentId, []);
          childrenOf.get(primaryParentId)!.push(entry);
        }
      });
      return { category, roots, childrenOf, count: catEntries.length };
    }).filter((s) => s.count > 0);
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
        Everything THEIA has taught you, grouped by discipline — each branch nests under the skill it grew from.
      </p>

      {selected && <SkillDetailModal entry={selected} byId={byId} onClose={() => setSelectedId(null)} />}

      <div className="space-y-6">
        {sections.map(({ category, roots, childrenOf }) => {
          const SectionIcon = CATEGORY_ICON[category];
          const color = CATEGORY_HEX[category];
          return (
            <div key={category} className="border-t pt-4 first:border-t-0 first:pt-0" style={{ borderColor: `${color}30` }}>
              <div className="flex items-center gap-1.5 mb-3">
                <SectionIcon className="w-3.5 h-3.5" style={{ color }} />
                <span className="text-xs font-bold tracking-[0.15em]" style={{ color }}>
                  {CATEGORY_LABEL[category]}
                </span>
              </div>
              <div className="space-y-3">
                {roots.map((root) => (
                  <SkillNode
                    key={root.id}
                    entry={root}
                    childrenOf={childrenOf}
                    byId={byId}
                    color={color}
                    selectedId={selectedId}
                    onSelect={(id) => setSelectedId(id === selectedId ? null : id)}
                    visited={new Set()}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
