import { useState, useEffect } from 'react';
import { UserProfile, Attributes } from '@/lib/types';
import { getHunterVitals, calculateXPForLevel, applyQuickAction, getPhysicalDayPlan } from '@/lib/storage';
import { systemSound } from '@/lib/system-sound';
import {
  Power,
  Plus,
  FlaskConical,
  Zap,
  Star,
  Dumbbell,
  Footprints,
  Radio,
  Heart,
  Brain,
  Lightbulb,
  Coffee,
  Droplets,
  Sparkles,
} from 'lucide-react';

interface Props {
  profile: UserProfile;
  onProfileUpdated?: (profile: UserProfile) => void;
  onOpenQuests?: () => void;
  onLogout?: () => void;
}

export const SoloStatusWindow = ({
  profile,
  onProfileUpdated,
  onLogout,
}: Props) => {
  const [isLoaded, setIsLoaded] = useState(false);
  const [quickNotice, setQuickNotice] = useState<string | null>(null);

  useEffect(() => {
    // Trigger filling animation shortly after mount so DOM paints initial 0% state
    const timer = setTimeout(() => {
      setIsLoaded(true);
    }, 180);
    return () => clearTimeout(timer);
  }, []);

  const vitals = getHunterVitals(profile);
  const rawStats: any = profile.visibleStats || {};
  const stats: Attributes = {
    STR: Number(rawStats.STR ?? rawStats.sTG ?? rawStats.STG ?? rawStats.stg ?? rawStats.str ?? rawStats.strength ?? 10),
    AGI: Number(rawStats.AGI ?? rawStats.agi ?? rawStats.dex ?? rawStats.DEX ?? rawStats.agility ?? 10),
    VIT: Number(rawStats.VIT ?? rawStats.vit ?? rawStats.con ?? rawStats.CON ?? rawStats.vitality ?? 10),
    INT: Number(rawStats.INT ?? rawStats.int ?? rawStats.intelligence ?? 10),
    PER: Number(rawStats.PER ?? rawStats.per ?? rawStats.sen ?? rawStats.SEN ?? rawStats.perception ?? 10),
    WIS: Number(rawStats.WIS ?? rawStats.wis ?? rawStats.wisdom ?? 10),
  };

  // Stamina & EXP percentage calculation
  const fatigueVal = Math.max(0, Math.min(100, vitals.fatigue ?? 0));
  const stmVal = vitals.stm.current;
  const xpCurrent = (profile.xp !== undefined && profile.xp !== null ? profile.xp : (profile as any).exp) ?? 0;
  const xpMax = profile.xpToNextLevel || calculateXPForLevel(profile.level || 1);
  const xpPct = Math.min(100, Math.round((xpCurrent / Math.max(1, xpMax)) * 100));

  const hpPct = vitals.hp.max > 0 ? Math.min(100, (vitals.hp.current / vitals.hp.max) * 100) : 0;
  const mpPct = vitals.mp.max > 0 ? Math.min(100, (vitals.mp.current / vitals.mp.max) * 100) : 0;
  const stmPct = vitals.stm.max > 0 ? Math.min(100, (stmVal / vitals.stm.max) * 100) : 0;

  const isOverdrive = vitals.stm.current <= 0 || vitals.mp.current <= 0;
  const isRestDay = Boolean(getPhysicalDayPlan(new Date()).isRestDay);
  const isInjured = vitals.hp.current <= Math.max(15, Math.floor(vitals.hp.max * 0.2));
  const isPeakVitality = vitals.hp.current >= Math.floor(vitals.hp.max * 0.9);

  // Exact Fatigue Alert System matching ideas.txt
  // 0-49%: Light blue (Optimal) | 50-74%: Amber (Taxed) | 75-89%: Orange (Exhausted) | 90-100%: Crimson (Critical)
  const ringColor =
    fatigueVal >= 90
      ? '#ef4444'
      : fatigueVal >= 75
      ? '#f97316'
      : fatigueVal >= 50
      ? '#eab308'
      : '#56ccf2';

  // Fatigue SVG Ring Math (r = 24, Circumference = 150.796)
  const ringRadius = 24;
  const circumference = 2 * Math.PI * ringRadius;
  const fatigueOffset = circumference - (fatigueVal / 100) * circumference;

  const handleQuickAction = (action: 'hydrate' | 'elixir' | 'meditate') => {
    systemSound.playClick();
    const result = applyQuickAction(action);
    setQuickNotice(result.message);
    onProfileUpdated?.(result.profile);
    setTimeout(() => {
      setQuickNotice(null);
    }, 2800);
  };

  return (
    <div className="relative max-w-[560px] w-full mx-auto px-1 sm:px-0 my-auto">
      {/* The Iconic Solo Leveling Status Box */}
      <div className="relative bg-[#0a1b2e]/90 border-2 border-white/50 rounded-[4px] p-4 sm:p-7 md:p-9 text-white shadow-[0_0_30px_rgba(0,0,0,0.85),inset_0_0_24px_rgba(0,212,255,0.08)] backdrop-blur-md anime-dropdown">
        
        {/* Top Header Bar */}
        <div className="relative flex items-center justify-center pb-3 mb-1">
          {/* Centered STATUS Header Box with Ahjin Guild Emblem */}
          <div className="flex items-center gap-2 sm:gap-2.5 px-5 sm:px-8 py-0.5 sm:py-1 border border-white/70 bg-[#061426]/60 shadow-[0_0_14px_rgba(0,212,255,0.35)]">
            <img
              src="/ahjin-logo.png"
              alt="Ahjin Guild"
              className="w-5 h-5 sm:w-6 sm:h-6 object-contain drop-shadow-[0_0_8px_rgba(0,212,255,0.6)]"
              referrerPolicy="no-referrer"
            />
            <span className="font-mono font-extrabold tracking-[0.16em] sm:tracking-[0.28em] text-sm sm:text-xl text-white anime-glow-text whitespace-nowrap">
              STATUS
            </span>
          </div>

          {/* Top-Right Logout Button */}
          <div className="absolute right-0 top-1/2 -translate-y-1/2 shrink-0">
            <button
              onClick={() => {
                systemSound.playClick();
                onLogout?.();
              }}
              className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg border border-white/70 bg-white/5 text-white flex items-center justify-center hover:border-red-400 hover:text-red-300 hover:bg-white/15 hover:scale-105 transition-all shadow-[0_0_10px_rgba(0,0,0,0.6)]"
              title="Logout / Disconnect"
              aria-label="Logout"
            >
              <Power className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </button>
          </div>
        </div>

        {/* Level & Player Meta Section */}
        <div className="flex items-center justify-center gap-4 sm:gap-7 my-4 sm:my-5 font-mono px-1">
          {/* Level Number & Label */}
          <div className="flex flex-col items-center shrink-0">
            <div className="text-5xl sm:text-7xl font-sans font-black text-white anime-glow-text leading-none tracking-tight">
              {profile.level || 1}
            </div>
            <div className="text-[10px] sm:text-[11px] font-mono font-bold tracking-[0.25em] text-white/80 uppercase mt-1">
              LEVEL
            </div>
          </div>

          {/* Job & Title */}
          <div className="space-y-1.5 text-left min-w-0 max-w-[260px]">
            <div className="flex items-baseline gap-2 min-w-0">
              <span className="text-xs text-white/70 tracking-wider font-semibold shrink-0">JOB:</span>
              <span className="text-white font-bold text-sm sm:text-lg truncate block">
                {profile.job || 'None'}
              </span>
            </div>
            <div className="flex items-baseline gap-2 min-w-0">
              <span className="text-xs text-white/70 tracking-wider font-semibold shrink-0">TITLE:</span>
              <span className="text-white font-bold text-sm sm:text-lg truncate block" title={profile.title || 'None'}>
                {profile.title || 'None'}
              </span>
            </div>
          </div>
        </div>

        {/* Middle Panel: Resources (HP, MP, Fatigue, STM, EXP) */}
        <div className="border border-white/45 bg-[#061424]/75 p-3 sm:p-4 mb-4 shadow-[inset_0_0_14px_rgba(0,212,255,0.1)] rounded-[2px] overflow-hidden">
          <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_68px] sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_82px] gap-x-2.5 sm:gap-x-4 gap-y-3 sm:gap-y-3.5 items-center font-mono">
            {/* Row 1, Col 1: HP */}
            <div className="space-y-1 min-w-0">
              <div className="flex items-center gap-1.5 text-xs font-bold text-white">
                <Plus className="w-3.5 h-3.5 text-[#9fd3ff] stroke-[3] shrink-0" />
                <span className="tracking-wider">HP</span>
              </div>
              <div className="w-full h-2.5 sm:h-3 border border-[#5a94e8] bg-[#040e1b] rounded-full p-[2px] shadow-[0_0_6px_rgba(90,148,232,0.6)] relative overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-[#5a94e8] to-[#9fd3ff] shadow-[0_0_8px_#5a94e8] relative overflow-hidden"
                  style={{
                    width: isLoaded ? `${hpPct}%` : '0%',
                    transition: 'width 1.5s cubic-bezier(0.25, 0.46, 0.45, 0.94)',
                  }}
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-bar-glow" />
                </div>
              </div>
              <div className="flex items-baseline justify-end text-[10px] sm:text-[11px] font-bold text-white leading-none">
                <span className="truncate">{vitals.hp.current}</span>
                <span className="text-white/60 truncate">/{vitals.hp.max}</span>
              </div>
            </div>

            {/* Row 1, Col 2: MP */}
            <div className="space-y-1 min-w-0">
              <div className="flex items-center gap-1.5 text-xs font-bold text-white">
                <FlaskConical className="w-3.5 h-3.5 text-[#9fd3ff] stroke-[2.5] shrink-0" />
                <span className="tracking-wider">MP</span>
              </div>
              <div className="w-full h-2.5 sm:h-3 border border-[#5a94e8] bg-[#040e1b] rounded-full p-[2px] shadow-[0_0_6px_rgba(90,148,232,0.6)] relative overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-[#5a94e8] to-[#9fd3ff] shadow-[0_0_8px_#5a94e8] relative overflow-hidden"
                  style={{
                    width: isLoaded ? `${mpPct}%` : '0%',
                    transition: 'width 1.5s cubic-bezier(0.25, 0.46, 0.45, 0.94) 0.08s',
                  }}
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-bar-glow" />
                </div>
              </div>
              <div className="flex items-baseline justify-end text-[10px] sm:text-[11px] font-bold text-white leading-none">
                <span className="truncate">{vitals.mp.current}</span>
                <span className="text-white/60 truncate">/{vitals.mp.max}</span>
              </div>
            </div>

            {/* Fatigue Ring (spans 2 rows) */}
            <div className="row-span-2 flex flex-col items-center justify-center text-center px-0.5">
              <div className="relative w-12 h-12 sm:w-14 sm:h-14 flex items-center justify-center">
                <svg className="w-12 h-12 sm:w-14 sm:h-14 -rotate-90" viewBox="0 0 56 56">
                  {/* Track Circle */}
                  <circle
                    cx="28"
                    cy="28"
                    r={ringRadius}
                    fill="transparent"
                    stroke="rgba(255,255,255,0.15)"
                    strokeWidth="4.5"
                  />
                  {/* Active Fatigue Circle */}
                  <circle
                    cx="28"
                    cy="28"
                    r={ringRadius}
                    fill="transparent"
                    stroke={ringColor}
                    strokeWidth="4.5"
                    strokeLinecap="round"
                    style={{
                      strokeDasharray: `${circumference} ${circumference}`,
                      strokeDashoffset: isLoaded ? fatigueOffset : circumference,
                      transition: 'stroke-dashoffset 1.5s cubic-bezier(0.25, 0.46, 0.45, 0.94) 0.12s',
                    }}
                  />
                </svg>
              </div>
              <div className="mt-1 text-[8px] sm:text-[9px] tracking-wider text-white/80 uppercase font-mono text-center leading-tight">
                <div>FATIGUE</div>
                <div
                  className="text-[11px] sm:text-xs font-bold"
                  style={{ color: ringColor, textShadow: `0 0 8px ${ringColor}` }}
                >
                  {fatigueVal}%
                </div>
              </div>
            </div>

            {/* Row 2, Col 1: STM */}
            <div className="space-y-1 min-w-0">
              <div className="flex items-center gap-1.5 text-xs font-bold text-white">
                <Zap className="w-3.5 h-3.5 text-[#9fd3ff] shrink-0" />
                <span className="tracking-wider">STM</span>
              </div>
              <div className="w-full h-2.5 sm:h-3 border border-[#5a94e8] bg-[#040e1b] rounded-full p-[2px] shadow-[0_0_6px_rgba(90,148,232,0.6)] relative overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-[#5a94e8] to-[#9fd3ff] shadow-[0_0_8px_#5a94e8] relative overflow-hidden"
                  style={{
                    width: isLoaded ? `${stmPct}%` : '0%',
                    transition: 'width 1.5s cubic-bezier(0.25, 0.46, 0.45, 0.94) 0.16s',
                  }}
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-bar-glow" />
                </div>
              </div>
              <div className="flex items-baseline justify-end text-[10px] sm:text-[11px] font-bold text-white leading-none">
                <span className="truncate">{vitals.stm.current}</span>
                <span className="text-white/60 truncate">/{vitals.stm.max}</span>
              </div>
            </div>

            {/* Row 2, Col 2: EXP (Percentage Display) */}
            <div className="space-y-1 min-w-0">
              <div className="flex items-center gap-1.5 text-xs font-bold text-white">
                <Star className="w-3.5 h-3.5 text-[#9fd3ff] shrink-0" />
                <span className="tracking-wider">EXP</span>
              </div>
              <div className="w-full h-2.5 sm:h-3 border border-[#5a94e8] bg-[#040e1b] rounded-full p-[2px] shadow-[0_0_6px_rgba(90,148,232,0.6)] relative overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-[#5a94e8] to-[#9fd3ff] shadow-[0_0_8px_#5a94e8] relative overflow-hidden"
                  style={{
                    width: isLoaded ? `${xpPct}%` : '0%',
                    transition: 'width 1.5s cubic-bezier(0.25, 0.46, 0.45, 0.94) 0.22s',
                  }}
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-bar-glow" />
                </div>
              </div>
              <div className="flex items-baseline justify-end text-[10px] sm:text-[11px] font-bold text-white leading-none">
                <span className="truncate text-white font-bold">{xpPct}%</span>
                <span className="text-white/60 truncate ml-0.5">/ 100%</span>
              </div>
            </div>
          </div>

          {/* Vitals Condition & Overdrive Banners */}
          {isOverdrive && (
            <div className="mt-2.5 px-2 py-1 rounded bg-amber-950/40 border border-amber-500/50 text-[10px] text-amber-300 flex items-center justify-between animate-pulse">
              <span className="font-bold tracking-wide">[ OVERDRIVE PROTOCOL: WILLPOWER ACTIVE ]</span>
              <span className="text-[9px] text-amber-400/80">Quests cost extra fatigue</span>
            </div>
          )}

          {isInjured && (
            <div className="mt-2.5 px-2 py-1 rounded bg-red-950/60 border border-red-500/60 text-[10px] text-red-300 flex items-center justify-between animate-pulse">
              <span className="font-bold tracking-wide">[ SYSTEM ALERT: INJURED / BATTLE-FATIGUED ]</span>
              <span className="text-[9px] text-red-400/90">Safety Floor Active • Rest to Recover</span>
            </div>
          )}

          {isRestDay && (
            <div className="mt-2.5 px-2 py-1 rounded bg-teal-950/40 border border-teal-400/50 text-[10px] text-teal-300 flex items-center justify-between">
              <span className="font-bold tracking-wide">[ REST DAY SUPERCOMPENSATION ]</span>
              <span className="text-[9px] text-teal-400/90">2x Vitals Regen • Muscle Synthesis</span>
            </div>
          )}

          {fatigueVal >= 90 && !isOverdrive && (
            <div className="mt-2.5 px-2 py-1 rounded bg-red-950/40 border border-red-500/40 text-[10px] text-red-300 flex items-center justify-between animate-pulse">
              <span className="font-bold tracking-wide">[ CRITICAL BURNOUT ALERT ({fatigueVal}%) ]</span>
              <span className="text-[9px] text-red-400/80">-15% EXP efficiency</span>
            </div>
          )}

          {fatigueVal >= 75 && fatigueVal < 90 && !isOverdrive && (
            <div className="mt-2.5 px-2 py-1 rounded bg-orange-950/40 border border-orange-500/40 text-[10px] text-orange-300 flex items-center justify-between">
              <span className="font-bold tracking-wide">[ EXHAUSTION WARNING ({fatigueVal}%) ]</span>
              <span className="text-[9px] text-orange-400/80">Muscular & mental fatigue elevated</span>
            </div>
          )}

          {fatigueVal < 50 && (
            <div className="mt-2 px-2 py-0.5 rounded bg-emerald-950/20 border border-emerald-500/20 text-[9px] text-emerald-300/90 flex items-center justify-between">
              <span className="tracking-wide">WELL-RESTED CONDITION</span>
              <span className="font-semibold text-emerald-400">+10% EXP Bonus</span>
            </div>
          )}

          {isPeakVitality && !isInjured && (
            <div className="mt-1.5 px-2 py-0.5 rounded bg-cyan-950/30 border border-cyan-400/30 text-[9px] text-cyan-300/90 flex items-center justify-between">
              <span className="tracking-wide">[ TITLE EFFECT: PEAK VITALITY ]</span>
              <span className="font-semibold text-cyan-400">+10% EXP Gain Active</span>
            </div>
          )}

          {quickNotice && (
            <div className="mt-2 px-2 py-1 rounded bg-cyan-950/70 border border-cyan-400/60 text-[10px] text-cyan-200 text-center anime-glow-text font-mono animate-fade-in">
              {quickNotice}
            </div>
          )}

          {/* Quick Recovery micro-actions */}
          <div className="mt-3 pt-2.5 border-t border-white/10">
            <div className="flex items-center justify-between mb-1.5 px-0.5">
              <span className="text-[9px] tracking-wider text-white/50 uppercase font-mono">QUICK RECOVERY</span>
              <span className="text-[9px] text-cyan-300/60 font-mono">Passive Regen: Active</span>
            </div>
            <div className="grid grid-cols-3 gap-1.5 font-mono">
              <button
                type="button"
                onClick={() => handleQuickAction('hydrate')}
                className="flex items-center justify-center gap-1 py-1 px-1.5 rounded bg-sky-500/10 hover:bg-sky-500/25 border border-sky-400/30 text-[9px] sm:text-[10px] text-sky-200 transition-all hover:scale-[1.02] active:scale-[0.98]"
                title="Hydrate: Restores +15 STM and reduces fatigue by -5%"
              >
                <Droplets className="w-3 h-3 text-sky-300 shrink-0" />
                <span className="truncate">Hydrate (+15)</span>
              </button>
              <button
                type="button"
                onClick={() => handleQuickAction('elixir')}
                className="flex items-center justify-center gap-1 py-1 px-1.5 rounded bg-indigo-500/10 hover:bg-indigo-500/25 border border-indigo-400/30 text-[9px] sm:text-[10px] text-indigo-200 transition-all hover:scale-[1.02] active:scale-[0.98]"
                title="Mana Elixir: Restores +25 MP"
              >
                <Coffee className="w-3 h-3 text-indigo-300 shrink-0" />
                <span className="truncate">Elixir (+25)</span>
              </button>
              <button
                type="button"
                onClick={() => handleQuickAction('meditate')}
                className="flex items-center justify-center gap-1 py-1 px-1.5 rounded bg-emerald-500/10 hover:bg-emerald-500/25 border border-emerald-400/30 text-[9px] sm:text-[10px] text-emerald-200 transition-all hover:scale-[1.02] active:scale-[0.98]"
                title="Meditate: Reduces fatigue by -10% and restores +5 HP"
              >
                <Sparkles className="w-3 h-3 text-emerald-300 shrink-0" />
                <span className="truncate">Rest (-10% Fat)</span>
              </button>
            </div>
          </div>
        </div>

        {/* Bottom Panel: Attributes Panel (Clean, No Manual Points, No Available AP) */}
        <div className="border border-white/45 bg-[#061424]/75 p-3 sm:p-5 md:p-6 shadow-[inset_0_0_14px_rgba(0,212,255,0.1)] rounded-[2px] overflow-hidden">
          <div className="grid grid-cols-2 gap-x-2.5 sm:gap-x-8 md:gap-x-12 gap-y-2.5 sm:gap-y-4 font-mono">
            {/* Left Column: STR, AGI, PER */}
            <div className="space-y-2.5 sm:space-y-4">
              {/* STR */}
              <div className="flex items-center justify-between sm:justify-start gap-1.5 sm:gap-2.5 px-2 py-1.5 sm:p-0 rounded bg-white/[0.03] sm:bg-transparent border border-white/10 sm:border-transparent">
                <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
                  <Dumbbell className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#9fd3ff] shrink-0 filter drop-shadow-[0_0_6px_rgba(159,211,255,0.9)]" />
                  <span className="text-[11px] sm:text-sm font-bold tracking-wider text-white">
                    STR:
                  </span>
                </div>
                <span className="text-sm sm:text-lg font-bold text-white anime-glow-text pl-1">
                  {stats.STR}
                </span>
              </div>

              {/* AGI */}
              <div className="flex items-center justify-between sm:justify-start gap-1.5 sm:gap-2.5 px-2 py-1.5 sm:p-0 rounded bg-white/[0.03] sm:bg-transparent border border-white/10 sm:border-transparent">
                <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
                  <Footprints className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#9fd3ff] shrink-0 filter drop-shadow-[0_0_6px_rgba(159,211,255,0.9)]" />
                  <span className="text-[11px] sm:text-sm font-bold tracking-wider text-white">
                    AGI:
                  </span>
                </div>
                <span className="text-sm sm:text-lg font-bold text-white anime-glow-text pl-1">
                  {stats.AGI}
                </span>
              </div>

              {/* PER */}
              <div className="flex items-center justify-between sm:justify-start gap-1.5 sm:gap-2.5 px-2 py-1.5 sm:p-0 rounded bg-white/[0.03] sm:bg-transparent border border-white/10 sm:border-transparent">
                <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
                  <Radio className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#9fd3ff] shrink-0 filter drop-shadow-[0_0_6px_rgba(159,211,255,0.9)]" />
                  <span className="text-[11px] sm:text-sm font-bold tracking-wider text-white">
                    PER:
                  </span>
                </div>
                <span className="text-sm sm:text-lg font-bold text-white anime-glow-text pl-1">
                  {stats.PER}
                </span>
              </div>
            </div>

            {/* Right Column: VIT, INT, WIS */}
            <div className="space-y-2.5 sm:space-y-4">
              {/* VIT */}
              <div className="flex items-center justify-between sm:justify-start gap-1.5 sm:gap-2.5 px-2 py-1.5 sm:p-0 rounded bg-white/[0.03] sm:bg-transparent border border-white/10 sm:border-transparent">
                <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
                  <Heart className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#9fd3ff] shrink-0 filter drop-shadow-[0_0_6px_rgba(159,211,255,0.9)]" />
                  <span className="text-[11px] sm:text-sm font-bold tracking-wider text-white">
                    VIT:
                  </span>
                </div>
                <span className="text-sm sm:text-lg font-bold text-white anime-glow-text pl-1">
                  {stats.VIT}
                </span>
              </div>

              {/* INT */}
              <div className="flex items-center justify-between sm:justify-start gap-1.5 sm:gap-2.5 px-2 py-1.5 sm:p-0 rounded bg-white/[0.03] sm:bg-transparent border border-white/10 sm:border-transparent">
                <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
                  <Brain className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#9fd3ff] shrink-0 filter drop-shadow-[0_0_6px_rgba(159,211,255,0.9)]" />
                  <span className="text-[11px] sm:text-sm font-bold tracking-wider text-white">
                    INT:
                  </span>
                </div>
                <span className="text-sm sm:text-lg font-bold text-white anime-glow-text pl-1">
                  {stats.INT}
                </span>
              </div>

              {/* WIS */}
              <div className="flex items-center justify-between sm:justify-start gap-1.5 sm:gap-2.5 px-2 py-1.5 sm:p-0 rounded bg-white/[0.03] sm:bg-transparent border border-white/10 sm:border-transparent">
                <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
                  <Lightbulb className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#9fd3ff] shrink-0 filter drop-shadow-[0_0_6px_rgba(159,211,255,0.9)]" />
                  <span className="text-[11px] sm:text-sm font-bold tracking-wider text-white">
                    WIS:
                  </span>
                </div>
                <span className="text-sm sm:text-lg font-bold text-white anime-glow-text pl-1">
                  {stats.WIS}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
