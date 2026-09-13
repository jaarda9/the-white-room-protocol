import { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { getUserProfile } from '@/lib/storage';
import { UserProfile } from '@/lib/types';
import {
  getEligibleMonthKeys,
  getCodexEntry,
  generateCodexEntry,
  getCurrentMonthKey,
  type CodexEntry,
} from '@/lib/codex';
import { systemSound } from '@/lib/system-sound';
import {
  ArrowLeft,
  ScrollText,
  Flame,
  TrendingUp,
  CalendarDays,
  Award,
  Zap,
  RefreshCw,
} from 'lucide-react';
import { toast } from 'sonner';

const formatMonthShort = (monthKey: string): string => {
  const [y, m] = monthKey.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString('en-US', { month: 'short' });
};

export default function HunterCodex() {
  const navigate = useNavigate();
  const [profile] = useState<UserProfile>(getUserProfile());
  const months = useMemo(() => getEligibleMonthKeys(profile), [profile]);
  const [selectedMonth, setSelectedMonth] = useState<string>(months[0] || getCurrentMonthKey());
  const [entry, setEntry] = useState<CodexEntry | null>(() => getCodexEntry(selectedMonth));
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    setEntry(getCodexEntry(selectedMonth));
  }, [selectedMonth]);

  const handleGenerate = useCallback(
    async (forceAlgorithmic = false) => {
      if (generating) return;
      systemSound.playClick();
      setGenerating(true);
      try {
        const fresh = await generateCodexEntry(profile, selectedMonth, { forceAlgorithmic });
        setEntry(fresh);
        toast.success(
          forceAlgorithmic ? 'SYSTEM ARCHIVE COMPILED (0 TOKENS)' : 'CODEX ENTRY ARCHIVED'
        );
      } finally {
        setGenerating(false);
      }
    },
    [generating, profile, selectedMonth]
  );

  const rollup = entry?.rollup;

  return (
    <div className="min-h-screen pt-8 sm:pt-14 md:pt-16 pb-36 sm:pb-40 bg-[#071322] text-[#e5ecf4] flex flex-col system-blueprint-bg font-mono">
      <main className="max-w-[640px] w-full mx-auto px-4 py-6 sm:py-10 flex-1 flex flex-col items-center justify-center my-auto">
        <div className="relative w-full bg-[#0a1b2e]/90 border-2 border-white/50 rounded-[4px] p-5 sm:p-8 text-white shadow-[0_0_30px_rgba(0,0,0,0.85),inset_0_0_24px_rgba(0,212,255,0.08)] backdrop-blur-md anime-dropdown font-mono">
          {/* Header controls */}
          <div className="flex items-center justify-between pb-2 mb-3 border-b border-white/20 text-xs gap-2 flex-wrap">
            <button
              onClick={() => {
                systemSound.playClick();
                navigate('/');
              }}
              className="flex items-center gap-1.5 text-cyan-300/80 hover:text-white transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>[ RETURN TO DASHBOARD ]</span>
            </button>
            <div className="text-[11px] text-cyan-300/80 font-bold tracking-wider">
              LV.{profile.level} • {profile.displayName || profile.pseudo}
            </div>
          </div>

          {/* Title plate */}
          <div className="relative flex items-center justify-center pb-2 mb-2">
            <div className="inline-block px-8 py-1 border border-white/70 bg-[#061426]/60 shadow-[0_0_14px_rgba(0,212,255,0.35)]">
              <div className="flex items-center gap-2">
                <ScrollText className="w-4 h-4 text-[#9fd3ff]" />
                <span className="font-mono font-extrabold tracking-[0.28em] text-base sm:text-lg text-white anime-glow-text">
                  HUNTER CODEX
                </span>
              </div>
            </div>
          </div>
          <div className="text-center font-mono text-[11px] text-[#9fd3ff]/80 mb-4">
            [ MONTHLY SYSTEM ARCHIVE ]
          </div>

          {/* Month selector */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-3 mb-3 border-b border-white/10 scrollbar-none">
            {months.map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => {
                  systemSound.playClick();
                  setSelectedMonth(m);
                }}
                className={`shrink-0 px-2.5 py-1.5 rounded-[2px] border text-[11px] font-bold tracking-wide transition-all ${
                  selectedMonth === m
                    ? 'border-cyan-400 bg-cyan-950/80 text-cyan-300 shadow-[0_0_8px_rgba(0,212,255,0.35)]'
                    : 'border-white/20 bg-black/30 text-white/50 hover:text-white'
                }`}
              >
                {formatMonthShort(m)}
              </button>
            ))}
          </div>

          {entry && rollup ? (
            <>
              {/* Stat chips */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
                {[
                  { icon: Zap, label: 'EXP GAINED', value: rollup.xpGained.toLocaleString() },
                  { icon: TrendingUp, label: 'LEVEL', value: `${rollup.levelStart} → ${rollup.levelEnd}` },
                  { icon: CalendarDays, label: 'ACTIVE DAYS', value: `${rollup.activeDays}` },
                  { icon: Flame, label: 'BEST STREAK', value: `${rollup.longestStreakInMonth}d` },
                ].map((m) => (
                  <div
                    key={m.label}
                    className="border border-white/30 bg-[#061424]/80 rounded-[2px] p-2 text-center"
                  >
                    <div className="flex items-center justify-center gap-1 text-[9px] tracking-[0.15em] text-[#9fd3ff]/70">
                      <m.icon className="w-3 h-3" /> {m.label}
                    </div>
                    <div className="text-xs sm:text-sm font-bold text-white mt-0.5">{m.value}</div>
                  </div>
                ))}
              </div>

              {rollup.achievementsUnlocked.length > 0 && (
                <div className="flex items-center gap-2 flex-wrap mb-4">
                  {rollup.achievementsUnlocked.map((a) => (
                    <span
                      key={a.name}
                      className="flex items-center gap-1 text-[10px] px-2 py-1 border border-amber-400/40 bg-amber-950/30 text-amber-300 rounded-[2px]"
                    >
                      <Award className="w-3 h-3" /> {a.name}
                    </span>
                  ))}
                </div>
              )}

              {/* Narrative */}
              <div className="border border-cyan-500/30 bg-[#07172b]/70 rounded-[2px] p-3.5 mb-4">
                <div className="text-[10px] tracking-[0.2em] text-cyan-300/80 mb-2 flex items-center justify-between">
                  <span>SYSTEM ARCHIVE • {rollup.monthLabel.toUpperCase()}</span>
                  <span className="text-[9px] text-white/50">
                    {entry.origin === 'system' ? 'PRECISION ENGINE' : 'AI ADAPTED'}
                  </span>
                </div>
                {entry.narrative.split('\n\n').map((para, i) => (
                  <p key={i} className="text-[11px] sm:text-xs text-white/85 leading-relaxed mb-2 last:mb-0">
                    {para}
                  </p>
                ))}
              </div>

              {/* Reissue */}
              <div className="flex items-center gap-1.5 justify-end">
                <button
                  onClick={() => handleGenerate(true)}
                  disabled={generating}
                  className="py-2 px-3 border border-emerald-500/50 bg-emerald-950/50 hover:bg-emerald-900/60 text-emerald-300 font-mono text-xs font-bold tracking-wider rounded-[2px] transition-all flex items-center justify-center gap-1 disabled:opacity-50"
                  title="Recompile instantly using the deterministic archive engine (0 LLM tokens)"
                >
                  <Zap className="w-3.5 h-3.5 text-emerald-400" />
                  <span>[ 0 TOKENS ]</span>
                </button>
                <button
                  onClick={() => handleGenerate(false)}
                  disabled={generating}
                  className="py-2 px-4 border-2 border-cyan-400/60 bg-cyan-950/50 hover:bg-cyan-900/60 text-cyan-300 font-mono text-xs font-bold tracking-widest rounded-[2px] transition-all flex items-center justify-center gap-1.5 disabled:opacity-50"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${generating ? 'animate-spin' : ''}`} />
                  <span>{generating ? '[ ... ]' : '[ REISSUE ]'}</span>
                </button>
              </div>
            </>
          ) : (
            <div className="py-10 text-center text-xs text-cyan-300/80 space-y-3">
              <div>[ THIS CYCLE HAS NOT YET BEEN ARCHIVED ]</div>
              <div className="flex items-center gap-1.5 justify-center">
                <button
                  onClick={() => handleGenerate(true)}
                  disabled={generating}
                  className="py-2 px-3 border border-emerald-500/50 bg-emerald-950/50 hover:bg-emerald-900/60 text-emerald-300 font-mono text-xs font-bold tracking-wider rounded-[2px] transition-all flex items-center justify-center gap-1 disabled:opacity-50"
                >
                  <Zap className="w-3.5 h-3.5 text-emerald-400" />
                  <span>[ 0 TOKENS ]</span>
                </button>
                <button
                  onClick={() => handleGenerate(false)}
                  disabled={generating}
                  className="py-2.5 px-5 border-2 border-cyan-400 bg-cyan-950/80 hover:bg-cyan-900 text-cyan-300 rounded-[2px] text-xs font-bold tracking-wider disabled:opacity-50"
                >
                  {generating ? '[ COMPILING... ]' : '[ ARCHIVE THIS CYCLE ]'}
                </button>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
