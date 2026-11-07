import type { Quest } from '@/lib/types';

/**
 * Status chip for a directive that is not mandatory today: a bonus Instant Dungeon floor, or a
 * directive above the Hunter's rank (rank-load.ts) — optional now, required from that rank.
 */
export default function DirectiveBadge({ quest }: { quest: Pick<Quest, 'isChainBonus' | 'rankOptional'> }) {
  if (quest.rankOptional) {
    return (
      <span
        className="text-[9px] px-1.5 py-0.5 rounded-[2px] bg-violet-950/70 border border-violet-400/50 text-violet-200 font-mono tracking-wider whitespace-nowrap"
        title={`Optional bonus at your rank. Becomes mandatory at ${quest.rankOptional}-rank.`}
      >
        BONUS · {quest.rankOptional}-RANK
      </span>
    );
  }
  if (quest.isChainBonus) {
    return (
      <span className="text-[9px] px-1.5 py-0.5 rounded-[2px] bg-cyan-950/80 border border-cyan-400/50 text-cyan-300 font-mono tracking-wider whitespace-nowrap">
        EXTRA SESSION
      </span>
    );
  }
  return null;
}
