import { useEffect, useState } from 'react';
import {
  getSkillLedger,
  SKILL_LEDGER_UPDATED_EVENT,
  type SkillLedgerEntry,
  type SkillCategory,
} from '@/lib/skill-ledger';
import { Sparkles, Dumbbell, BookOpen, Repeat, Target } from 'lucide-react';

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

const CATEGORY_COLOR: Record<SkillCategory, string> = {
  skill: 'text-emerald-300 border-emerald-400/50',
  subject: 'text-cyan-300 border-cyan-400/50',
  habit: 'text-amber-300 border-amber-400/50',
  technique: 'text-purple-300 border-purple-400/50',
};

/** A node's tier is 1 + the deepest of its parents (0 for a root with no parents) — this is
 * what turns the flat parentIds-linked array into the layered rows rendered below. Memoized
 * since a node can be a parent of several others and its own depth would otherwise be
 * recomputed once per child. Safe against cycles (can't occur in practice — a skill's parents
 * always existed before it, chronologically) via the visiting-set guard, so a data anomaly
 * degrades to depth 0 instead of infinite-looping. */
const computeDepth = (
  entry: SkillLedgerEntry,
  byId: Map<string, SkillLedgerEntry>,
  memo: Map<string, number>,
  visiting: Set<string>
): number => {
  if (memo.has(entry.id)) return memo.get(entry.id)!;
  if (visiting.has(entry.id) || entry.parentIds.length === 0) {
    memo.set(entry.id, 0);
    return 0;
  }
  visiting.add(entry.id);
  const parentDepths = entry.parentIds.map((pid) => {
    const parent = byId.get(pid);
    return parent ? computeDepth(parent, byId, memo, visiting) : 0;
  });
  visiting.delete(entry.id);
  const depth = 1 + Math.max(...parentDepths, 0);
  memo.set(entry.id, depth);
  return depth;
};

export default function SkillTreePanel() {
  const [entries, setEntries] = useState<SkillLedgerEntry[]>(() => getSkillLedger());

  useEffect(() => {
    const sync = () => setEntries(getSkillLedger());
    window.addEventListener(SKILL_LEDGER_UPDATED_EVENT, sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener(SKILL_LEDGER_UPDATED_EVENT, sync);
      window.removeEventListener('storage', sync);
    };
  }, []);

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

  const byId = new Map(entries.map((e) => [e.id, e]));
  const memo = new Map<string, number>();
  const tiers: SkillLedgerEntry[][] = [];
  entries.forEach((entry) => {
    const depth = computeDepth(entry, byId, memo, new Set());
    if (!tiers[depth]) tiers[depth] = [];
    tiers[depth].push(entry);
  });

  return (
    <div className="space-y-4">
      <p className="text-xs text-white/70 leading-relaxed">
        Everything THEIA has taught you through Directives, tiered by how each skill builds on the last.
      </p>

      {tiers.map(
        (tier, depth) =>
          tier && (
            <div key={depth} className="space-y-2">
              <div className="text-[10px] tracking-[0.2em] text-white/40">
                {depth === 0 ? 'FOUNDATIONS' : `TIER ${depth}`}
              </div>
              <div className="flex flex-wrap gap-2">
                {tier.map((entry) => {
                  const Icon = CATEGORY_ICON[entry.category];
                  const parentNames = entry.parentIds
                    .map((pid) => byId.get(pid)?.name)
                    .filter((n): n is string => Boolean(n));
                  return (
                    <div
                      key={entry.id}
                      className={`min-w-[150px] flex-1 border rounded-[2px] p-2.5 bg-[#061424]/85 shadow-[inset_0_0_10px_rgba(0,212,255,0.05)] ${CATEGORY_COLOR[entry.category]}`}
                    >
                      <div className="flex items-center gap-1.5 mb-1">
                        <Icon className="w-3.5 h-3.5" />
                        <span className="text-[9px] font-bold tracking-wider">{CATEGORY_LABEL[entry.category]}</span>
                      </div>
                      <div className="text-xs font-bold text-white truncate">{entry.name}</div>
                      {parentNames.length > 0 && (
                        <div className="text-[9px] text-white/50 mt-1 truncate">↳ from {parentNames.join(', ')}</div>
                      )}
                      <div className="mt-1.5 h-1 bg-black/40 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-cyan-400"
                          style={{ width: `${Math.max(0, Math.min(100, entry.proficiency))}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )
      )}
    </div>
  );
}
