import { useState, useEffect } from 'react';
import { UserProfile, Attributes } from '@/lib/types';
import { getHunterVitals, calculateXPForLevel } from '@/lib/storage';
import { systemSound } from '@/lib/system-sound';
import {
  User,
  ListTodo,
  Bot,
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
  X,
} from 'lucide-react';

interface Props {
  profile: UserProfile;
  onProfileUpdated?: (profile: UserProfile) => void;
  onOpenQuests?: () => void;
  onLogout?: () => void;
}

export const SoloStatusWindow = ({
  profile,
  onOpenQuests,
  onLogout,
}: Props) => {
  const [showPlayerDetails, setShowPlayerDetails] = useState(false);
  const [showArchitect, setShowArchitect] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    // Trigger filling animation shortly after mount so DOM paints initial 0% state
    const timer = setTimeout(() => {
      setIsLoaded(true);
    }, 180);
    return () => clearTimeout(timer);
  }, []);

  const vitals = getHunterVitals(profile);
  const stats: Attributes = {
    STR: profile.visibleStats?.STR ?? 0,
    AGI: profile.visibleStats?.AGI ?? 0,
    VIT: profile.visibleStats?.VIT ?? 0,
    INT: profile.visibleStats?.INT ?? 0,
    PER: profile.visibleStats?.PER ?? 0,
    WIS: profile.visibleStats?.WIS ?? 0,
  };

  // Stamina & EXP percentage calculation
  const fatigueVal = Math.max(0, Math.min(100, vitals.fatigue ?? 0));
  const stmVal = Math.max(0, 100 - fatigueVal);
  const xpCurrent = (profile.xp !== undefined && profile.xp !== null ? profile.xp : (profile as any).exp) ?? 0;
  const xpMax = profile.xpToNextLevel || calculateXPForLevel(profile.level || 1);
  const xpPct = Math.min(100, Math.round((xpCurrent / xpMax) * 100));

  const hpPct = vitals.hp.max > 0 ? Math.min(100, (vitals.hp.current / vitals.hp.max) * 100) : 0;
  const mpPct = vitals.mp.max > 0 ? Math.min(100, (vitals.mp.current / vitals.mp.max) * 100) : 0;

  // Fatigue SVG Ring Math (r = 24, Circumference = 150.796)
  const ringRadius = 24;
  const circumference = 2 * Math.PI * ringRadius;
  const fatigueOffset = circumference - (fatigueVal / 100) * circumference;

  return (
    <div className="relative max-w-[560px] w-full mx-auto">
      {/* The Iconic Solo Leveling Status Box */}
      <div className="relative bg-[#0a1b2e]/90 border-2 border-white/50 rounded-[4px] p-6 sm:p-9 text-white shadow-[0_0_30px_rgba(0,0,0,0.85),inset_0_0_24px_rgba(0,212,255,0.08)] backdrop-blur-md anime-dropdown">
        
        {/* Top Header Bar */}
        <div className="relative flex items-center justify-between pb-3">
          {/* Top-Left Action Buttons */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                systemSound.playClick();
                setShowPlayerDetails(true);
              }}
              className="w-8 h-8 rounded-lg border border-white/70 bg-white/5 text-white flex items-center justify-center hover:bg-white/15 hover:border-white hover:scale-105 transition-all shadow-[0_0_10px_rgba(0,0,0,0.6)]"
              title="Hunter Details"
              aria-label="Hunter Details"
            >
              <User className="w-4 h-4" />
            </button>

            <button
              onClick={() => {
                systemSound.playClick();
                onOpenQuests?.();
              }}
              className="w-8 h-8 rounded-lg border border-white/70 bg-white/5 text-white flex items-center justify-center hover:bg-white/15 hover:border-white hover:scale-105 transition-all shadow-[0_0_10px_rgba(0,0,0,0.6)]"
              title="Active Quests"
              aria-label="Active Quests"
            >
              <ListTodo className="w-4 h-4" />
            </button>

            <button
              onClick={() => {
                systemSound.playClick();
                setShowArchitect(true);
              }}
              className="w-8 h-8 rounded-lg border border-purple-400/90 bg-purple-950/80 text-purple-200 flex items-center justify-center hover:bg-purple-900/90 hover:scale-105 transition-all shadow-[0_0_12px_rgba(168,85,247,0.6)]"
              title="THE ARCHITECT"
              aria-label="THE ARCHITECT"
            >
              <Bot className="w-4 h-4" />
            </button>
          </div>

          {/* Centered STATUS Header Box */}
          <div className="absolute left-1/2 -translate-x-1/2 top-0">
            <div className="inline-block px-10 py-1 border border-white/70 bg-[#061426]/60 shadow-[0_0_14px_rgba(0,212,255,0.35)]">
              <span className="font-mono font-extrabold tracking-[0.28em] text-lg sm:text-xl text-white anime-glow-text">
                STATUS
              </span>
            </div>
          </div>

          {/* Top-Right Logout Button */}
          <button
            onClick={() => {
              systemSound.playClick();
              onLogout?.();
            }}
            className="w-8 h-8 rounded-lg border border-white/70 bg-white/5 text-white flex items-center justify-center hover:border-red-400 hover:text-red-300 hover:bg-white/15 hover:scale-105 transition-all shadow-[0_0_10px_rgba(0,0,0,0.6)]"
            title="Logout / Disconnect"
            aria-label="Logout"
          >
            <Power className="w-4 h-4" />
          </button>
        </div>

        {/* Level & Player Meta Section */}
        <div className="flex items-center justify-center gap-7 my-5 font-mono">
          {/* Level Number & Label */}
          <div className="flex flex-col items-center">
            <div className="text-6xl sm:text-7xl font-sans font-black text-white anime-glow-text leading-none tracking-tight">
              {profile.level || 1}
            </div>
            <div className="text-[11px] font-mono font-bold tracking-[0.25em] text-white/80 uppercase mt-1">
              LEVEL
            </div>
          </div>

          {/* Job & Title */}
          <div className="space-y-1.5 text-left">
            <div className="flex items-baseline gap-2">
              <span className="text-xs text-white/70 tracking-wider font-semibold">JOB:</span>
              <span className="text-white font-bold text-base sm:text-lg">
                {profile.job || 'None'}
              </span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-xs text-white/70 tracking-wider font-semibold">TITLE:</span>
              <span className="text-white font-bold text-base sm:text-lg">
                {profile.title || 'None'}
              </span>
            </div>
          </div>
        </div>

        {/* Middle Panel: Resources (HP, MP, Fatigue, STM, EXP) */}
        <div className="border border-white/45 bg-[#061424]/75 p-3.5 sm:p-4 mb-4 shadow-[inset_0_0_14px_rgba(0,212,255,0.1)] rounded-[2px]">
          <div className="grid grid-cols-[1fr_1fr_78px] gap-x-4 gap-y-3.5 items-center font-mono">
            {/* Row 1, Col 1: HP */}
            <div className="space-y-1">
              <div className="flex items-center gap-1.5 text-xs font-bold text-white">
                <Plus className="w-3.5 h-3.5 text-[#9fd3ff] stroke-[3]" />
                <span className="tracking-wider">HP</span>
              </div>
              <div className="w-full h-3 border border-[#5a94e8] bg-[#040e1b] rounded-full p-[2px] shadow-[0_0_6px_rgba(90,148,232,0.6)] relative overflow-hidden">
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
              <div className="text-right text-[11px] font-bold text-white leading-none">
                <span>{vitals.hp.current}</span>
                <span className="text-white/60">/{vitals.hp.max}</span>
              </div>
            </div>

            {/* Row 1, Col 2: MP */}
            <div className="space-y-1">
              <div className="flex items-center gap-1.5 text-xs font-bold text-white">
                <FlaskConical className="w-3.5 h-3.5 text-[#9fd3ff] stroke-[2.5]" />
                <span className="tracking-wider">MP</span>
              </div>
              <div className="w-full h-3 border border-[#5a94e8] bg-[#040e1b] rounded-full p-[2px] shadow-[0_0_6px_rgba(90,148,232,0.6)] relative overflow-hidden">
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
              <div className="text-right text-[11px] font-bold text-white leading-none">
                <span>{vitals.mp.current}</span>
                <span className="text-white/60">/{vitals.mp.max}</span>
              </div>
            </div>

            {/* Fatigue Ring (spans 2 rows) */}
            <div className="row-span-2 flex flex-col items-center justify-center text-center pl-1">
              <div className="relative w-14 h-14 flex items-center justify-center">
                <svg className="w-14 h-14 -rotate-90" viewBox="0 0 56 56">
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
                    stroke="#56ccf2"
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
              <div className="mt-1 text-[9px] tracking-wider text-white/80 uppercase font-mono whitespace-nowrap">
                FATIGUE: <span className="text-xs font-bold text-[#56ccf2] anime-cyan-glow">{fatigueVal}%</span>
              </div>
            </div>

            {/* Row 2, Col 1: STM */}
            <div className="space-y-1">
              <div className="flex items-center gap-1.5 text-xs font-bold text-white">
                <Zap className="w-3.5 h-3.5 text-[#9fd3ff]" />
                <span className="tracking-wider">STM</span>
              </div>
              <div className="w-full h-3 border border-[#5a94e8] bg-[#040e1b] rounded-full p-[2px] shadow-[0_0_6px_rgba(90,148,232,0.6)] relative overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-[#5a94e8] to-[#9fd3ff] shadow-[0_0_8px_#5a94e8] relative overflow-hidden"
                  style={{
                    width: isLoaded ? `${stmVal}%` : '0%',
                    transition: 'width 1.5s cubic-bezier(0.25, 0.46, 0.45, 0.94) 0.16s',
                  }}
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-bar-glow" />
                </div>
              </div>
              <div className="text-right text-[11px] font-bold text-white leading-none">
                <span>{stmVal}</span>
                <span className="text-white/60">/100</span>
              </div>
            </div>

            {/* Row 2, Col 2: EXP */}
            <div className="space-y-1">
              <div className="flex items-center gap-1.5 text-xs font-bold text-white">
                <Star className="w-3.5 h-3.5 text-[#9fd3ff]" />
                <span className="tracking-wider">EXP</span>
              </div>
              <div className="w-full h-3 border border-[#5a94e8] bg-[#040e1b] rounded-full p-[2px] shadow-[0_0_6px_rgba(90,148,232,0.6)] relative overflow-hidden">
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
              <div className="text-right text-[11px] font-bold text-white leading-none">
                <span>{xpCurrent}</span>
                <span className="text-white/60">/{xpMax}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Panel: Attributes Panel (Clean, No Manual Points, No Available AP) */}
        <div className="border border-white/45 bg-[#061424]/75 p-5 sm:p-6 shadow-[inset_0_0_14px_rgba(0,212,255,0.1)] rounded-[2px]">
          <div className="grid grid-cols-2 gap-x-12 gap-y-4 font-mono">
            {/* Left Column: STR, AGI, PER */}
            <div className="space-y-4">
              {/* STR */}
              <div className="flex items-center gap-2.5">
                <Dumbbell className="w-4 h-4 text-[#9fd3ff] shrink-0 filter drop-shadow-[0_0_6px_rgba(159,211,255,0.9)]" />
                <span className="text-xs sm:text-sm font-bold tracking-wider text-white">
                  STR:
                </span>
                <span className="text-base sm:text-lg font-bold text-white anime-glow-text pl-1">
                  {stats.STR}
                </span>
              </div>

              {/* AGI */}
              <div className="flex items-center gap-2.5">
                <Footprints className="w-4 h-4 text-[#9fd3ff] shrink-0 filter drop-shadow-[0_0_6px_rgba(159,211,255,0.9)]" />
                <span className="text-xs sm:text-sm font-bold tracking-wider text-white">
                  AGI:
                </span>
                <span className="text-base sm:text-lg font-bold text-white anime-glow-text pl-1">
                  {stats.AGI}
                </span>
              </div>

              {/* PER */}
              <div className="flex items-center gap-2.5">
                <Radio className="w-4 h-4 text-[#9fd3ff] shrink-0 filter drop-shadow-[0_0_6px_rgba(159,211,255,0.9)]" />
                <span className="text-xs sm:text-sm font-bold tracking-wider text-white">
                  PER:
                </span>
                <span className="text-base sm:text-lg font-bold text-white anime-glow-text pl-1">
                  {stats.PER}
                </span>
              </div>
            </div>

            {/* Right Column: VIT, INT, WIS */}
            <div className="space-y-4">
              {/* VIT */}
              <div className="flex items-center gap-2.5">
                <Heart className="w-4 h-4 text-[#9fd3ff] shrink-0 filter drop-shadow-[0_0_6px_rgba(159,211,255,0.9)]" />
                <span className="text-xs sm:text-sm font-bold tracking-wider text-white">
                  VIT:
                </span>
                <span className="text-base sm:text-lg font-bold text-white anime-glow-text pl-1">
                  {stats.VIT}
                </span>
              </div>

              {/* INT */}
              <div className="flex items-center gap-2.5">
                <Brain className="w-4 h-4 text-[#9fd3ff] shrink-0 filter drop-shadow-[0_0_6px_rgba(159,211,255,0.9)]" />
                <span className="text-xs sm:text-sm font-bold tracking-wider text-white">
                  INT:
                </span>
                <span className="text-base sm:text-lg font-bold text-white anime-glow-text pl-1">
                  {stats.INT}
                </span>
              </div>

              {/* WIS */}
              <div className="flex items-center gap-2.5">
                <Lightbulb className="w-4 h-4 text-[#9fd3ff] shrink-0 filter drop-shadow-[0_0_6px_rgba(159,211,255,0.9)]" />
                <span className="text-xs sm:text-sm font-bold tracking-wider text-white">
                  WIS:
                </span>
                <span className="text-base sm:text-lg font-bold text-white anime-glow-text pl-1">
                  {stats.WIS}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Character Details Modal */}
      {showPlayerDetails && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="relative max-w-md w-full bg-[#0a1b2e] border-2 border-white/60 p-6 rounded-[4px] shadow-[0_0_30px_rgba(0,0,0,0.9)] font-mono text-white">
            <div className="flex items-center justify-between pb-3 border-b border-white/20 mb-4">
              <h3 className="font-bold text-lg tracking-wider text-white anime-glow-text">
                CHARACTER DETAILS
              </h3>
              <button
                onClick={() => setShowPlayerDetails(false)}
                className="text-gray-400 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-2.5 text-xs sm:text-sm">
              <div className="flex justify-between py-1 border-b border-white/10">
                <span className="text-white/60">JOB:</span>
                <span className="text-white font-bold">{profile.job || 'None'}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-white/10">
                <span className="text-white/60">TITLE:</span>
                <span className="text-white font-bold">{profile.title || 'None'}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-white/10">
                <span className="text-white/60">NAME:</span>
                <span className="text-white font-bold">{profile.displayName || profile.pseudo || 'Hunter'}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-white/10">
                <span className="text-white/60">GUILD:</span>
                <span className="text-white font-bold">None</span>
              </div>
              <div className="flex justify-between py-1 border-b border-white/10">
                <span className="text-white/60">RACE:</span>
                <span className="text-white font-bold">Awakened Human</span>
              </div>
              <div className="flex justify-between py-1 border-b border-white/10">
                <span className="text-white/60">REGION:</span>
                <span className="text-white font-bold">Global Sector</span>
              </div>
              <div className="flex justify-between py-1 border-b border-white/10">
                <span className="text-white/60">LOCATION:</span>
                <span className="text-white font-bold">System Gate</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-white/60">PING:</span>
                <span className="text-[#56ccf2] font-bold">24 ms</span>
              </div>
            </div>

            <button
              onClick={() => setShowPlayerDetails(false)}
              className="mt-5 w-full py-2 border border-white/40 bg-white/10 hover:bg-white/20 text-white font-bold tracking-wider text-xs uppercase transition-all"
            >
              CLOSE
            </button>
          </div>
        </div>
      )}

      {/* THE ARCHITECT Modal */}
      {showArchitect && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm animate-fade-in">
          <div className="relative max-w-lg w-full bg-[#110b24] border-2 border-purple-400/80 p-6 rounded-[4px] shadow-[0_0_40px_rgba(168,85,247,0.4)] font-mono text-white">
            <div className="flex items-center justify-between pb-3 border-b border-purple-500/30 mb-4">
              <div className="flex items-center gap-2">
                <Bot className="w-5 h-5 text-purple-300" />
                <h3 className="font-bold text-lg tracking-wider text-purple-200">
                  THE ARCHITECT
                </h3>
              </div>
              <button
                onClick={() => setShowArchitect(false)}
                className="text-purple-300/60 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs sm:text-sm text-purple-100/90 leading-relaxed">
              <p className="italic border-l-2 border-purple-400/70 pl-3 text-purple-200">
                &ldquo;System observer active. Performance metrics and daily training parameters are actively synchronized with the Sovereign Matrix.&rdquo;
              </p>
              <p>
                Continue completing designated trial workloads. Attributes distribute automatically upon milestone completion. Discipline is the only prerequisite to absolute mastery.
              </p>
            </div>

            <div className="mt-5 flex justify-end">
              <button
                onClick={() => setShowArchitect(false)}
                className="px-5 py-2 border border-purple-400/80 bg-purple-900/60 hover:bg-purple-800 text-purple-100 font-bold tracking-wider text-xs uppercase transition-all shadow-[0_0_10px_rgba(168,85,247,0.4)]"
              >
                ACKNOWLEDGE
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
