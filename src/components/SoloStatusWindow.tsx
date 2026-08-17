import { useState } from 'react';
import { UserProfile } from '@/lib/types';
import { saveUserProfile, addXP } from '@/lib/storage';
import { systemSound } from '@/lib/system-sound';
import { Plus } from 'lucide-react';

interface Props {
  profile: UserProfile;
  onProfileUpdated: (profile: UserProfile) => void;
}

export const SoloStatusWindow = ({ profile, onProfileUpdated }: Props) => {
  const [allocating, setAllocating] = useState(false);

  const stats = profile.visibleStats || {
    strength: 10,
    agility: 10,
    vitality: 10,
    intelligence: 10,
    perception: 10,
  };

  const availableAP = profile.availableStatPoints || 0;

  // Calculate HP and MP based on vitality and intelligence like the anime
  const maxHP = (stats.vitality || 10) * 80 + profile.level * 20;
  const currentHP = maxHP;
  const maxMP = (stats.intelligence || 10) * 15 + profile.level * 10;
  const currentMP = maxMP;
  const fatigue = 0;

  const handleAddStat = (statKey: keyof typeof stats) => {
    if (availableAP <= 0) return;
    systemSound.playClick();

    const updatedStats = {
      ...stats,
      [statKey]: (stats[statKey] || 0) + 1,
    };

    const updated: UserProfile = {
      ...profile,
      visibleStats: updatedStats,
      availableStatPoints: availableAP - 1,
    };

    saveUserProfile(updated);
    onProfileUpdated(updated);
  };

  return (
    <div className="anime-window p-6 sm:p-8 max-w-2xl mx-auto w-full relative">
      {/* Title Box: STATUS */}
      <div className="text-center mb-6">
        <div className="inline-block px-10 py-1.5 border border-cyan-400/40 bg-black/40">
          <h2 className="text-xl sm:text-2xl font-display font-bold tracking-[0.2em] text-white anime-glow-text">
            STATUS
          </h2>
        </div>
      </div>

      {/* Level + Job + Title */}
      <div className="flex items-center justify-between border-b border-cyan-500/20 pb-5 mb-6">
        <div className="flex flex-col items-center">
          <div className="text-4xl sm:text-5xl font-mono font-black text-cyan-300 anime-glow-text">
            {profile.level}
          </div>
          <div className="text-[11px] font-mono text-cyan-300/80 tracking-widest uppercase mt-0.5">
            LEVEL
          </div>
        </div>

        <div className="space-y-1.5 text-right font-mono text-xs sm:text-sm">
          <div className="text-gray-300">
            <span className="text-cyan-400/70 mr-2">JOB:</span>
            <span className="text-white font-semibold">{profile.job || 'None'}</span>
          </div>
          <div className="text-gray-300">
            <span className="text-cyan-400/70 mr-2">TITLE:</span>
            <span className="text-white font-semibold">{profile.title || 'Wolf Assassin'}</span>
          </div>
        </div>
      </div>

      {/* Vitals: HP / MP / FATIGUE Gauge Bar (Exact anime style) */}
      <div className="border border-cyan-500/30 bg-black/40 p-4 mb-6 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* HP Bar */}
          <div>
            <div className="flex justify-between text-xs font-mono mb-1">
              <span className="text-cyan-300 font-bold flex items-center gap-1">
                + HP
              </span>
              <span className="text-gray-300">
                {currentHP} / {maxHP}
              </span>
            </div>
            <div className="h-2.5 bg-black/80 border border-cyan-500/40 p-0.5 rounded-full">
              <div className="h-full bg-cyan-400 rounded-full w-full shadow-[0_0_8px_rgba(82,210,246,0.8)]" />
            </div>
          </div>

          {/* MP Bar */}
          <div>
            <div className="flex justify-between text-xs font-mono mb-1">
              <span className="text-cyan-300 font-bold flex items-center gap-1">
                ◈ MP
              </span>
              <span className="text-gray-300">
                {currentMP} / {maxMP}
              </span>
            </div>
            <div className="h-2.5 bg-black/80 border border-cyan-500/40 p-0.5 rounded-full">
              <div className="h-full bg-cyan-400 rounded-full w-full shadow-[0_0_8px_rgba(82,210,246,0.8)]" />
            </div>
          </div>
        </div>

        {/* Fatigue */}
        <div className="text-center pt-2 border-t border-cyan-500/10 text-xs font-mono">
          <span className="text-cyan-400/80 mr-2">FATIGUE:</span>
          <span className="text-white font-bold">{fatigue}</span>
        </div>
      </div>

      {/* Attributes Grid (STR, VIT, AGI, INT, PER) */}
      <div className="border border-cyan-500/30 bg-black/40 p-5 mb-5">
        <div className="grid grid-cols-2 gap-x-8 gap-y-4 font-mono text-sm">
          {/* Strength */}
          <div className="flex items-center justify-between">
            <span className="text-cyan-300/90 font-semibold">STR:</span>
            <div className="flex items-center gap-3">
              <span className="text-white text-base font-bold anime-cyan-glow">
                {stats.strength || 10}
              </span>
              {availableAP > 0 && (
                <button
                  onClick={() => handleAddStat('strength')}
                  className="w-5 h-5 border border-cyan-400/60 bg-cyan-400/10 hover:bg-cyan-400 hover:text-black flex items-center justify-center text-cyan-300 text-xs transition-colors"
                >
                  +
                </button>
              )}
            </div>
          </div>

          {/* Vitality */}
          <div className="flex items-center justify-between">
            <span className="text-cyan-300/90 font-semibold">VIT:</span>
            <div className="flex items-center gap-3">
              <span className="text-white text-base font-bold anime-cyan-glow">
                {stats.vitality || 10}
              </span>
              {availableAP > 0 && (
                <button
                  onClick={() => handleAddStat('vitality')}
                  className="w-5 h-5 border border-cyan-400/60 bg-cyan-400/10 hover:bg-cyan-400 hover:text-black flex items-center justify-center text-cyan-300 text-xs transition-colors"
                >
                  +
                </button>
              )}
            </div>
          </div>

          {/* Agility */}
          <div className="flex items-center justify-between">
            <span className="text-cyan-300/90 font-semibold">AGI:</span>
            <div className="flex items-center gap-3">
              <span className="text-white text-base font-bold anime-cyan-glow">
                {stats.agility || 10}
              </span>
              {availableAP > 0 && (
                <button
                  onClick={() => handleAddStat('agility')}
                  className="w-5 h-5 border border-cyan-400/60 bg-cyan-400/10 hover:bg-cyan-400 hover:text-black flex items-center justify-center text-cyan-300 text-xs transition-colors"
                >
                  +
                </button>
              )}
            </div>
          </div>

          {/* Intelligence */}
          <div className="flex items-center justify-between">
            <span className="text-cyan-300/90 font-semibold">INT:</span>
            <div className="flex items-center gap-3">
              <span className="text-white text-base font-bold anime-cyan-glow">
                {stats.intelligence || 10}
              </span>
              {availableAP > 0 && (
                <button
                  onClick={() => handleAddStat('intelligence')}
                  className="w-5 h-5 border border-cyan-400/60 bg-cyan-400/10 hover:bg-cyan-400 hover:text-black flex items-center justify-center text-cyan-300 text-xs transition-colors"
                >
                  +
                </button>
              )}
            </div>
          </div>

          {/* Perception */}
          <div className="flex items-center justify-between">
            <span className="text-cyan-300/90 font-semibold">PER:</span>
            <div className="flex items-center gap-3">
              <span className="text-white text-base font-bold anime-cyan-glow">
                {stats.perception || 10}
              </span>
              {availableAP > 0 && (
                <button
                  onClick={() => handleAddStat('perception')}
                  className="w-5 h-5 border border-cyan-400/60 bg-cyan-400/10 hover:bg-cyan-400 hover:text-black flex items-center justify-center text-cyan-300 text-xs transition-colors"
                >
                  +
                </button>
              )}
            </div>
          </div>

          {/* Available Ability Points */}
          <div className="flex items-center justify-between pt-1">
            <span className="text-[11px] text-gray-400">Available Points:</span>
            <span className="text-cyan-300 font-bold text-base anime-glow-text">
              {availableAP}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
