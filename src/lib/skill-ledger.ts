/**
 * Skill Ledger — the record of everything THEIA has taught the player through chain-Gates
 * (see chain-gates.ts), structured as a DAG so a skill can branch into further skills instead
 * of just being a flat completed-list. THEIA reads this before generating the next chain-Gate
 * so it doesn't repeat a skill and can prefer branching from something already learned.
 *
 * Stored as a flat array with `parentIds` links (not nested parent/child objects) — the
 * standard sync-safe representation for a DAG: trivial to derive a node's children from (scan
 * for matches), supports a node having more than one parent (a technique combining two prior
 * skills), and avoids the nested-mutation/JSON-diffing headaches of a real tree structure.
 * Mirrors gates.ts's own GATES_KEY/GATES_UPDATED_EVENT pattern exactly.
 */

export const SKILL_LEDGER_KEY = 'wrp_skill_ledger';
export const SKILL_LEDGER_UPDATED_EVENT = 'wrp:skill-ledger-updated';

export type SkillCategory = 'skill' | 'subject' | 'habit' | 'technique';

export interface SkillLedgerEntry {
  id: string;
  name: string;
  category: SkillCategory;
  /** 0+ branch points this grew from — [] means it's a root skill, not derived from anything. */
  parentIds: string[];
  taughtByChainGateId: string;
  /** The ongoing chain this belongs to (a chain spans many Gates over time), distinct from the
   * single Gate instance that actually taught it. */
  taughtByChainId: string;
  acquiredAt: string;
  /** 0-100 — seeded from the teaching Gate's effort score, bumped if a later Gate reinforces it. */
  proficiency: number;
  lastReinforcedAt?: string;
  /** THEIA's own Gate.description, carried over verbatim at clear time — the Skill Tree's detail
   * view explains a skill using what THEIA already wrote about it rather than a second AI call. */
  description?: string;
}

// Exported so gates.ts's player-created-Gate assessment can validate THEIA's category judgment
// the same way chain-gates.ts does, instead of a third copy of this same guard.
export const isSkillCategory = (v: unknown): v is SkillCategory =>
  v === 'skill' || v === 'subject' || v === 'habit' || v === 'technique';

/** Defensive read-time normalization, same spirit as gates.ts's normalizeGate — never let a
 * malformed/older-shape entry crash a `.map`/`.filter` downstream. */
const normalizeEntry = (raw: any): SkillLedgerEntry | null => {
  if (!raw || typeof raw.id !== 'string' || typeof raw.name !== 'string') return null;
  return {
    id: raw.id,
    name: raw.name,
    category: isSkillCategory(raw.category) ? raw.category : 'skill',
    parentIds: Array.isArray(raw.parentIds) ? raw.parentIds.filter((p: unknown) => typeof p === 'string') : [],
    taughtByChainGateId: typeof raw.taughtByChainGateId === 'string' ? raw.taughtByChainGateId : '',
    taughtByChainId: typeof raw.taughtByChainId === 'string' ? raw.taughtByChainId : '',
    acquiredAt: typeof raw.acquiredAt === 'string' ? raw.acquiredAt : new Date().toISOString(),
    proficiency: typeof raw.proficiency === 'number' ? Math.max(0, Math.min(100, raw.proficiency)) : 0,
    lastReinforcedAt: typeof raw.lastReinforcedAt === 'string' ? raw.lastReinforcedAt : undefined,
    description: typeof raw.description === 'string' && raw.description.trim() ? raw.description : undefined,
  };
};

export const getSkillLedger = (): SkillLedgerEntry[] => {
  try {
    const raw = localStorage.getItem(SKILL_LEDGER_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed)) return [];
    return parsed.map(normalizeEntry).filter((e): e is SkillLedgerEntry => e !== null);
  } catch {
    return [];
  }
};

export const saveSkillLedger = (entries: SkillLedgerEntry[]): void => {
  try {
    localStorage.setItem(SKILL_LEDGER_KEY, JSON.stringify(entries));
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent(SKILL_LEDGER_UPDATED_EVENT));
    }
  } catch {
    // ignore
  }
};

export const getSkillById = (id: string): SkillLedgerEntry | null =>
  getSkillLedger().find((s) => s.id === id) || null;

export const findSkillsByCategory = (category: SkillCategory): SkillLedgerEntry[] =>
  getSkillLedger().filter((s) => s.category === category);

/** Children are derived, not stored — scans for entries whose parentIds include this id. */
export const getChildSkills = (id: string): SkillLedgerEntry[] =>
  getSkillLedger().filter((s) => s.parentIds.includes(id));

export const addSkillLedgerEntry = (entry: Omit<SkillLedgerEntry, 'id' | 'acquiredAt'>): SkillLedgerEntry => {
  const full: SkillLedgerEntry = {
    ...entry,
    id: crypto.randomUUID(),
    acquiredAt: new Date().toISOString(),
  };
  const ledger = getSkillLedger();
  saveSkillLedger([...ledger, full]);
  return full;
};

/** Bumps proficiency and the reinforcement timestamp on an existing entry — used when a later
 * chain-Gate revisits/deepens a skill instead of teaching something brand new. */
export const reinforceSkill = (id: string, proficiencyDelta: number): void => {
  const ledger = getSkillLedger();
  const idx = ledger.findIndex((s) => s.id === id);
  if (idx === -1) return;
  const updated = [...ledger];
  updated[idx] = {
    ...updated[idx],
    proficiency: Math.max(0, Math.min(100, updated[idx].proficiency + proficiencyDelta)),
    lastReinforcedAt: new Date().toISOString(),
  };
  saveSkillLedger(updated);
};
