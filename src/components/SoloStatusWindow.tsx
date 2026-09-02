import { useState } from 'react';
import { UserProfile, Attributes } from '@/lib/types';
import { getHunterVitals, allocateStatPoint } from '@/lib/storage';
import { systemSound } from '@/lib/system-sound';
import { AttributeRadarChart } from '@/components/AttributeRadarChart';
import {
  Plus,
  FlaskConical,
  Gauge,
  Dumbbell,
  Footprints,
  Radio,
  Heart,
  Brain,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

interface Props {
  profile: UserProfile;
  onProfileUpdated?: (profile: UserProfile) => void;
}

export const SoloStatusWindow = ({ profile, onProfileUpdated }: Props) => {
  const [showRadar, setShowRadar] = useState(false);

  const vitals = getHunterVitals(profile);
  const stats: Attributes = profile.visibleStats || {
    STR: 48,
    AGI: 27,
    VIT: 27,
    INT: 27,
    PER: 27,
    WIS: 27,
  };

  const availableAP = profile.availableAP ?? 12;

  const handleAllocate = (attr: keyof Attributes) => {
    if (availableAP <= 0) return;
    systemSound.playSystemChime();
    const updated = allocateStatPoint(attr);
    onProfileUpdated?.(updated);
  };

  return (
    <div className="anime-window system-blueprint-bg system-window-corners p-6 sm:p-8 max-w-2xl mx-auto w-full relative">
      <div className="corner-ticks" />

      {/* Top Header: STATUS Box matching screenshot */}
      <div className="text-center mb-6">
        <div className="inline-block px-12 py-1 border border-cyan-400/80 bg-black/60 shadow-[0_0_15px_rgba(82,210,246,0.35)]">
          <h2 className="text-xl sm:text-2xl font-mono font-bold tracking-[0.25em] text-white anime-glow-text">
            STATUS
          </h2>
        </div>
      </div>

      {/* Level + Player Details */}
      <div className="flex items-center justify-between px-2 sm:px-6 mb-6">
        {/* Glowing Level Display */}
        <div className="flex flex-col items-center">
          <div className="text-5xl sm:text-6xl font-sans font-black text-cyan-200 anime-glow-text leading-none tracking-tight">
            {profile.level}
          </div>
          <div className="text-[11px] font-mono font-bold text-cyan-300 tracking-[0.25em] uppercase mt-1">
            LEVEL
          </div>
        </div>

        {/* Job & Title */}
        <div className="space-y-1 text-right font-mono text-xs sm:text-sm">
          <div className="text-gray-300">
            <span className="text-cyan-400/80 mr-2 uppercase tracking-wider">JOB:</span>
            <span className="text-white font-semibold">{profile.job || 'None'}</span>
          </div>
          <div className="text-gray-300">
            <span className="text-cyan-400/80 mr-2 uppercase tracking-wider">TITLE:</span>
            <span className="text-white font-semibold">{profile.title || 'Wolf Assassin'}</span>
          </div>
        </div>
      </div>

      {/* Middle Box: HP, MP, Fatigue (Exact reproduction of screenshot 1) */}
      <div className="border border-cyan-500/40 bg-black/60 p-4 sm:p-5 mb-5 shadow-[inset_0_0_20px_rgba(82,210,246,0.06)]">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6 items-center">
          {/* HP Bar */}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 text-white font-mono font-bold text-xs shrink-0">
              <Plus className="w-3.5 h-3.5 text-cyan-300 stroke-[3]" />
              <span className="tracking-wider">HP</span>
            </div>
            <div className="flex-1 flex items-center gap-2">
              <div className="flex-1 h-3.5 rounded-full border border-cyan-400/60 bg-black/80 p-0.5 relative overflow-hidden shadow-[0_0_8px_rgba(82,210,246,0.2)]">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-white shadow-[0_0_10px_#52d2f6]"
                  style={{ width: `${Math.min(100, (vitals.hp.current / vitals.hp.max) * 100)}%` }}
                />
              </div>
              <span className="font-mono text-[11px] text-cyan-200/90 whitespace-nowrap">
                {vitals.hp.current}
                <span className="text-cyan-400/50">/{vitals.hp.max}</span>
              </span>
            </div>
          </div>

          {/* MP Bar */}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 text-white font-mono font-bold text-xs shrink-0">
              <FlaskConical className="w-3.5 h-3.5 text-cyan-300 stroke-[2.5]" />
              <span className="tracking-wider">MP</span>
            </div>
            <div className="flex-1 flex items-center gap-2">
              <div className="flex-1 h-3.5 rounded-full border border-cyan-400/60 bg-black/80 p-0.5 relative overflow-hidden shadow-[0_0_8px_rgba(82,210,246,0.2)]">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-cyan-200 shadow-[0_0_10px_#52d2f6]"
                  style={{ width: `${Math.min(100, (vitals.mp.current / vitals.mp.max) * 100)}%` }}
                />
              </div>
              <span className="font-mono text-[11px] text-cyan-200/90 whitespace-nowrap">
                {vitals.mp.current}
                <span className="text-cyan-400/50">/{vitals.mp.max}</span>
              </span>
            </div>
          </div>

          {/* Fatigue */}
          <div className="flex items-center justify-center sm:justify-end gap-2 text-white font-mono text-xs">
            <div className="w-5 h-5 rounded-full border border-cyan-400/70 flex items-center justify-center text-cyan-300">
              <Gauge className="w-3.5 h-3.5" />
            </div>
            <span className="text-cyan-400/90 font-bold tracking-wider">FATIGUE:</span>
            <span className="text-cyan-200 font-bold text-sm sm:text-base anime-cyan-glow">
              {vitals.fatigue}
            </span>
          </div>
        </div>
      </div>

      {/* Bottom Attributes Box (Exact reproduction of screenshot 1) */}
      <div className="border border-cyan-500/40 bg-black/60 p-5 sm:p-7 mb-4 shadow-[inset_0_0_20px_rgba(82,210,246,0.06)]">
        <div className="grid grid-cols-2 gap-x-8 gap-y-5 font-mono">
          {/* Left Column: STR, AGI, PER */}
          <div className="space-y-4">
            {/* STR */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-white text-sm sm:text-base">
                <Dumbbell className="w-4 h-4 text-cyan-300 shrink-0" />
                <span className="font-bold tracking-wider text-cyan-100">STR:</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xl sm:text-2xl font-black text-cyan-200 anime-glow-text">
                  {stats.STR}
                </span>
                {availableAP > 0 && (
                  <button
                    onClick={() => handleAllocate('STR')}
                    className="w-5 h-5 border border-cyan-400 bg-cyan-950/60 text-cyan-300 hover:bg-cyan-400 hover:text-black flex items-center justify-center text-xs font-bold transition-colors"
                    title="Add 1 Point"
                  >
                    +
                  </button>
                )}
              </div>
            </div>

            {/* AGI */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-white text-sm sm:text-base">
                <Footprints className="w-4 h-4 text-cyan-300 shrink-0" />
                <span className="font-bold tracking-wider text-cyan-100">AGI:</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xl sm:text-2xl font-black text-cyan-200 anime-glow-text">
                  {stats.AGI}
                </span>
                {availableAP > 0 && (
                  <button
                    onClick={() => handleAllocate('AGI')}
                    className="w-5 h-5 border border-cyan-400 bg-cyan-950/60 text-cyan-300 hover:bg-cyan-400 hover:text-black flex items-center justify-center text-xs font-bold transition-colors"
                    title="Add 1 Point"
                  >
                    +
                  </button>
                )}
              </div>
            </div>

            {/* PER */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-white text-sm sm:text-base">
                <Radio className="w-4 h-4 text-cyan-300 shrink-0" />
                <span className="font-bold tracking-wider text-cyan-100">PER:</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xl sm:text-2xl font-black text-cyan-200 anime-glow-text">
                  {stats.PER}
                </span>
                {availableAP > 0 && (
                  <button
                    onClick={() => handleAllocate('PER')}
                    className="w-5 h-5 border border-cyan-400 bg-cyan-950/60 text-cyan-300 hover:bg-cyan-400 hover:text-black flex items-center justify-center text-xs font-bold transition-colors"
                    title="Add 1 Point"
                  >
                    +
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Right Column: VIT, INT, Available Ability Points */}
          <div className="space-y-4">
            {/* VIT */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-white text-sm sm:text-base">
                <Heart className="w-4 h-4 text-cyan-300 shrink-0" />
                <span className="font-bold tracking-wider text-cyan-100">VIT:</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xl sm:text-2xl font-black text-cyan-200 anime-glow-text">
                  {stats.VIT}
                </span>
                {availableAP > 0 && (
                  <button
                    onClick={() => handleAllocate('VIT')}
                    className="w-5 h-5 border border-cyan-400 bg-cyan-950/60 text-cyan-300 hover:bg-cyan-400 hover:text-black flex items-center justify-center text-xs font-bold transition-colors"
                    title="Add 1 Point"
                  >
                    +
                  </button>
                )}
              </div>
            </div>

            {/* INT */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-white text-sm sm:text-base">
                <Brain className="w-4 h-4 text-cyan-300 shrink-0" />
                <span className="font-bold tracking-wider text-cyan-100">INT:</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xl sm:text-2xl font-black text-cyan-200 anime-glow-text">
                  {stats.INT}
                </span>
                {availableAP > 0 && (
                  <button
                    onClick={() => handleAllocate('INT')}
                    className="w-5 h-5 border border-cyan-400 bg-cyan-950/60 text-cyan-300 hover:bg-cyan-400 hover:text-black flex items-center justify-center text-xs font-bold transition-colors"
                    title="Add 1 Point"
                  >
                    +
                  </button>
                )}
              </div>
            </div>

            {/* Available Ability Points (Bottom Right exactly like screenshot) */}
            <div className="pt-2 flex items-center justify-end gap-3 text-right">
              <div className="text-[10px] sm:text-xs font-mono text-cyan-300/80 leading-tight">
                <div>Available</div>
                <div>Ability Points:</div>
              </div>
              <div className="text-2xl sm:text-3xl font-black text-cyan-200 anime-glow-text">
                {availableAP}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Expandable Radar & Training Analytics */}
      <div className="pt-2">
        <button
          onClick={() => {
            systemSound.playClick();
            setShowRadar((prev) => !prev);
          }}
          className="w-full flex items-center justify-center gap-2 py-1.5 text-[11px] font-mono text-cyan-400/80 hover:text-cyan-200 border border-cyan-500/20 hover:border-cyan-400/50 bg-black/40 transition-colors"
        >
          <span>{showRadar ? 'HIDE RADIAL MATRIX' : 'SHOW RADIAL ATTRIBUTE MATRIX'}</span>
          {showRadar ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </button>

        {showRadar && (
          <div className="mt-3 p-4 border border-cyan-500/30 bg-black/60 flex flex-col items-center">
            <div className="text-[10px] font-mono text-cyan-300/80 mb-2 uppercase tracking-widest">
              HEXAGONAL ATTRIBUTE BALANCE
            </div>
            <AttributeRadarChart attributes={stats} />
          </div>
        )}
      </div>
    </div>
  );
};
