import { useEffect } from 'react';
import { Sparkles, ArrowRight } from 'lucide-react';
import { systemSound } from '@/lib/system-sound';
import type { RankAdvancement } from '@/lib/rank-advancement';
import { useLockBodyScroll } from '@/hooks/use-lock-body-scroll';

interface Props {
  advancement: RankAdvancement;
  onDismiss: () => void;
}

const RANK_FLAVOR: Record<string, string> = {
  D: 'The System recognizes your growth. Basic thresholds are no longer a barrier.',
  C: 'Mid-tier authorization granted. Dungeons of greater danger now register on your radar.',
  B: 'Your presence unsettles lesser Gates. Few Hunters reach this threshold.',
  A: 'You stand among the elite. The System watches closely.',
  S: 'Sovereign-tier reached. There is no ceiling above you now.',
};

export default function RankAdvancementCeremony({ advancement, onDismiss }: Props) {
  useEffect(() => {
    systemSound.playLevelUp();
  }, []);

  // Mount-conditional, not isOpen-gated — this component only exists while it should show.
  useLockBodyScroll(true);

  const flavor = RANK_FLAVOR[advancement.rank] || 'The System acknowledges your advancement.';

  return (
    <div className="modal-safe-pad fixed inset-0 z-[80] flex items-center justify-center bg-black/85 backdrop-blur-md animate-fade-in font-mono">
      <div className="relative max-w-[480px] w-full bg-[#0a1b2e] border-2 border-cyan-400 p-6 sm:p-8 rounded-[4px] shadow-[0_0_60px_rgba(0,212,255,0.8),inset_0_0_30px_rgba(0,212,255,0.2)] text-white text-center space-y-4 anime-dropdown">
        <div className="inline-flex items-center gap-2 px-3 py-1 bg-cyan-950/80 border border-cyan-400/80 rounded-full text-cyan-300 text-xs font-bold tracking-wider anime-glow-text">
          <Sparkles className="w-4 h-4 text-cyan-400" />
          [ SYSTEM: AWAKENING THRESHOLD SURPASSED ]
        </div>

        <div className="flex items-center justify-center gap-3 py-2">
          <span className="text-3xl sm:text-4xl font-black text-white/30">{advancement.previousRank}</span>
          <ArrowRight className="w-6 h-6 text-cyan-400" />
          <span className="text-5xl sm:text-6xl font-black text-cyan-300 anime-glow-text drop-shadow-[0_0_20px_rgba(0,212,255,0.8)]">
            {advancement.rank}
          </span>
        </div>

        <h3 className="text-lg sm:text-xl font-bold font-sans tracking-wide text-white anime-glow-text">
          RANK {advancement.rank} ACHIEVED
        </h3>

        <div className="text-xs text-gray-300 space-y-2 py-3 border-y border-white/20">
          <div className="flex items-center justify-between text-cyan-200">
            <span>[ JOB CLASS ]</span>
            <span className="font-bold text-cyan-300">{advancement.job}</span>
          </div>
          <div className="flex items-center justify-between text-amber-200">
            <span>[ TITLE ]</span>
            <span className="font-bold text-amber-300">{advancement.title}</span>
          </div>
          <div className="flex items-center justify-between text-white/80">
            <span>[ HUNTER LEVEL ]</span>
            <span className="font-bold text-white">LV.{advancement.level}</span>
          </div>
        </div>

        <p className="text-[11px] text-white/70 italic">"{flavor}"</p>

        <button
          onClick={() => {
            systemSound.playClick();
            onDismiss();
          }}
          className="w-full py-2 px-4 bg-cyan-500/20 hover:bg-cyan-500/35 border-2 border-cyan-400 text-cyan-200 text-xs font-bold rounded-[2px] shadow-[0_0_15px_rgba(0,212,255,0.4)] hover:shadow-[0_0_25px_rgba(0,212,255,0.7)] hover:scale-[1.02] active:scale-[0.98] transition-all"
        >
          [ ACKNOWLEDGE ADVANCEMENT ]
        </button>
      </div>
    </div>
  );
}
