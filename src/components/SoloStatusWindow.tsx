import { UserProfile, Attributes } from '@/lib/types';
import { AttributeRadarChart } from '@/components/AttributeRadarChart';

interface Props {
  profile: UserProfile;
  onProfileUpdated?: (profile: UserProfile) => void;
}

export const SoloStatusWindow = ({ profile }: Props) => {
  const stats: Attributes = profile.visibleStats || {
    STR: 10,
    AGI: 10,
    VIT: 10,
    INT: 10,
    PER: 10,
    WIS: 10,
  };

  const statList: { key: keyof Attributes; label: string; full: string }[] = [
    { key: 'STR', label: 'STR', full: 'STRENGTH' },
    { key: 'AGI', label: 'AGI', full: 'AGILITY' },
    { key: 'VIT', label: 'VIT', full: 'VITALITY' },
    { key: 'INT', label: 'INT', full: 'INTELLIGENCE' },
    { key: 'PER', label: 'PER', full: 'PERCEPTION' },
    { key: 'WIS', label: 'WIS', full: 'WISDOM' },
  ];

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

      {/* Level + Player Details */}
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
            <span className="text-cyan-400/70 mr-2">NAME:</span>
            <span className="text-white font-semibold">{profile.displayName || profile.pseudo}</span>
          </div>
          <div className="text-gray-300">
            <span className="text-cyan-400/70 mr-2">TITLE:</span>
            <span className="text-white font-semibold">{profile.title || 'The Awakened'}</span>
          </div>
          <div className="text-gray-300">
            <span className="text-cyan-400/70 mr-2">EXP:</span>
            <span className="text-cyan-300 font-semibold">{profile.xp} / {profile.xpToNextLevel}</span>
          </div>
        </div>
      </div>

      {/* Attributes Grid (Original 6 Attributes: STR, AGI, VIT, INT, PER, WIS) */}
      <div className="border border-cyan-500/30 bg-black/40 p-5 mb-6">
        <div className="text-[11px] font-mono text-cyan-400/80 mb-3 uppercase tracking-wider border-b border-cyan-500/20 pb-1">
          ATTRIBUTE MATRIX (TRAINING DRIVEN)
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-3 font-mono text-sm">
          {statList.map(({ key, label, full }) => (
            <div key={key} className="flex items-center justify-between p-2 bg-black/30 border border-cyan-500/15">
              <div>
                <span className="text-cyan-300/90 font-bold mr-1">{label}</span>
                <span className="text-[10px] text-gray-500 hidden sm:inline">({full})</span>
              </div>
              <span className="text-white text-base font-bold anime-cyan-glow">
                {stats[key] ?? 10}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Radar Chart (Integrated Attribute Hexagon Visualizer) */}
      <div className="border border-cyan-500/30 bg-black/40 p-4">
        <div className="text-[11px] font-mono text-cyan-400/80 mb-2 uppercase tracking-wider text-center">
          RADIAL ATTRIBUTE BALANCE
        </div>
        <div className="w-full flex justify-center">
          <AttributeRadarChart attributes={stats} />
        </div>
      </div>
    </div>
  );
};
