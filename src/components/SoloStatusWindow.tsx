import { useState } from 'react';
import { UserProfile, Attributes } from '@/lib/types';
import { getHunterRank, getHunterJob, getHunterTitle, getHunterVitals, allocateStatPoint } from '@/lib/storage';
import { systemSound } from '@/lib/system-sound';
import { Shield, Zap, Flame, Sparkles, Activity, Plus, Award } from 'lucide-react';

interface Props {
  profile: UserProfile;
  onProfileUpdated?: (updated: UserProfile) => void;
}

export const SoloStatusWindow = ({ profile, onProfileUpdated }: Props) => {
  const [allocating, setAllocating] = useState<string | null>(null);

  const rank = getHunterRank(profile.level);
  const job = getHunterJob(profile.level, profile.job);
  const title = getHunterTitle(profile.level, profile.title);
  const vitals = getHunterVitals(profile);
  const availableAP = profile.availableAP ?? 0;

  const xpPct = Math.min(100, Math.max(0, (profile.xp / profile.xpToNextLevel) * 100));

  const handleAllocate = (attrKey: keyof Attributes) => {
    if (availableAP <= 0) return;
    setAllocating(attrKey);
    systemSound.playStatPoint();
    const updated = allocateStatPoint(attrKey);
    if (onProfileUpdated) {
      onProfileUpdated(updated);
    }
    setTimeout(() => setAllocating(null), 250);
  };

  const statConfig: Array<{
    key: keyof Attributes;
    name: string;
    code: string;
    color: string;
    desc: string;
    bgAccent: string;
  }> = [
    { key: 'STR', name: 'STRENGTH', code: 'STR', color: 'text-red-400', desc: 'Physical power & muscle output', bgAccent: 'border-red-500/30 bg-red-950/20' },
    { key: 'AGI', name: 'AGILITY', code: 'AGI', color: 'text-cyan-400', desc: 'Speed, reaction & swiftness', bgAccent: 'border-cyan-500/30 bg-cyan-950/20' },
    { key: 'VIT', name: 'VITALITY', code: 'VIT', color: 'text-emerald-400', desc: 'Endurance, stamina & HP regeneration', bgAccent: 'border-emerald-500/30 bg-emerald-950/20' },
    { key: 'INT', name: 'INTELLIGENCE', code: 'INT', color: 'text-blue-400', desc: 'Mana capacity & cognitive acuity', bgAccent: 'border-blue-500/30 bg-blue-950/20' },
    { key: 'PER', name: 'PERCEPTION', code: 'PER', code2: 'SENSE', color: 'text-purple-400', desc: 'Sensory awareness & hidden intuition', bgAccent: 'border-purple-500/30 bg-purple-950/20' },
    { key: 'WIS', name: 'DISCIPLINE', code: 'WIS', color: 'text-amber-400', desc: 'Mental fortitude & focus control', bgAccent: 'border-amber-500/30 bg-amber-950/20' },
  ];

  return (
    <div className="system-window tech-corners p-5 sm:p-6 w-full relative overflow-hidden">
      {/* Subtle background mana grid */}
      <div className="absolute inset-0 bg-[radial-gradient(#00f0ff_1px,transparent_1px)] [background-size:20px_20px] opacity-10 pointer-events-none" />

      {/* Header Bar */}
      <div className="flex items-center justify-between border-b border-primary/40 pb-3 mb-5">
        <div className="flex items-center gap-3">
          <div className="w-3 h-3 bg-primary animate-ping" />
          <h2 className="text-xl sm:text-2xl font-display font-black tracking-widest text-white system-glow-text">
            [ STATUS ]
          </h2>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono text-primary/80 border border-primary/40 px-2 py-0.5 bg-primary/10">
            HUNTER LICENSE
          </span>
        </div>
      </div>

      {/* Main Status Grid (Top Info + Vitals) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-6">
        
        {/* Hunter Identity Block */}
        <div className="space-y-2.5 font-mono text-xs sm:text-sm bg-black/40 p-4 border border-primary/20">
          <div className="flex justify-between items-center border-b border-white/10 pb-1.5">
            <span className="text-muted-foreground font-tech">NAME:</span>
            <span className="font-bold text-white tracking-wider">{profile.displayName || profile.pseudo}</span>
          </div>

          <div className="flex justify-between items-center border-b border-white/10 pb-1.5">
            <span className="text-muted-foreground font-tech">LEVEL:</span>
            <span className="font-bold text-primary font-display text-base system-glow-text">{profile.level}</span>
          </div>

          <div className="flex justify-between items-center border-b border-white/10 pb-1.5">
            <span className="text-muted-foreground font-tech">JOB:</span>
            <span className="font-bold text-purple-400 shadow-glow-text">{job}</span>
          </div>

          <div className="flex justify-between items-center border-b border-white/10 pb-1.5">
            <span className="text-muted-foreground font-tech">TITLE:</span>
            <span className="font-bold text-amber-300 monarch-glow-text">{title}</span>
          </div>

          <div className="flex justify-between items-center">
            <span className="text-muted-foreground font-tech">RANK:</span>
            <span className="px-2 py-0.5 border border-primary/50 text-primary font-display font-black text-xs bg-primary/15">
              {rank}-RANK HUNTER
            </span>
          </div>
        </div>

        {/* Vital Gauges (HP / MP / Fatigue / EXP) */}
        <div className="space-y-3.5 bg-black/40 p-4 border border-primary/20 font-mono">
          {/* HP Bar */}
          <div>
            <div className="flex justify-between text-xs mb-1">
              <span className="text-emerald-400 font-bold font-tech tracking-wider">HP [ HEALTH POINTS ]</span>
              <span className="text-emerald-300 font-bold">{vitals.hp.current} / {vitals.hp.max}</span>
            </div>
            <div className="h-3 bg-black/70 border border-emerald-500/40 p-0.5 relative overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-emerald-600 via-teal-400 to-emerald-300 shadow-[0_0_12px_rgba(16,185,129,0.7)] transition-all duration-500"
                style={{ width: '100%' }}
              />
            </div>
          </div>

          {/* MP Bar */}
          <div>
            <div className="flex justify-between text-xs mb-1">
              <span className="text-cyan-400 font-bold font-tech tracking-wider">MP [ MANA POINTS ]</span>
              <span className="text-cyan-300 font-bold">{vitals.mp.current} / {vitals.mp.max}</span>
            </div>
            <div className="h-3 bg-black/70 border border-cyan-500/40 p-0.5 relative overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-blue-600 via-cyan-400 to-sky-300 shadow-[0_0_12px_rgba(0,240,255,0.7)] transition-all duration-500"
                style={{ width: '100%' }}
              />
            </div>
          </div>

          {/* Fatigue Bar */}
          <div>
            <div className="flex justify-between text-xs mb-1">
              <span className="text-amber-400 font-bold font-tech tracking-wider">FATIGUE</span>
              <span className={`font-bold ${vitals.fatigue > 60 ? 'text-red-400' : 'text-amber-300'}`}>
                {vitals.fatigue} / 100
              </span>
            </div>
            <div className="h-2.5 bg-black/70 border border-amber-500/40 p-0.5 relative overflow-hidden">
              <div
                className={`h-full transition-all duration-500 ${vitals.fatigue > 60 ? 'bg-gradient-to-r from-red-600 to-rose-400 shadow-[0_0_10px_rgba(239,68,68,0.7)]' : 'bg-gradient-to-r from-amber-600 to-yellow-400'}`}
                style={{ width: `${Math.max(2, vitals.fatigue)}%` }}
              />
            </div>
          </div>

          {/* EXP Progress */}
          <div>
            <div className="flex justify-between text-xs mb-1">
              <span className="text-primary font-bold font-tech tracking-wider">EXP TO NEXT LEVEL</span>
              <span className="text-primary/90 font-bold">{profile.xp} / {profile.xpToNextLevel} ({xpPct.toFixed(1)}%)</span>
            </div>
            <div className="h-2.5 bg-black/70 border border-primary/50 p-0.5 relative overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-cyan-600 to-primary shadow-[0_0_12px_rgba(0,240,255,0.8)] transition-all duration-500"
                style={{ width: `${Math.max(2, xpPct)}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Available AP Banner */}
      <div className="flex items-center justify-between px-4 py-2.5 mb-5 bg-[#05132d] border border-primary/50 shadow-[0_0_15px_rgba(0,240,255,0.2)]">
        <div className="flex items-center gap-2">
          <Sparkles className={`w-4 h-4 ${availableAP > 0 ? 'text-amber-400 animate-spin' : 'text-primary/60'}`} />
          <span className="font-tech font-bold text-xs sm:text-sm tracking-wider text-white">
            AVAILABLE STAT POINTS (AP):
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className={`font-display font-black text-base sm:text-lg px-2.5 py-0.5 border ${availableAP > 0 ? 'border-amber-400 text-amber-300 bg-amber-950/50 monarch-glow-text animate-pulse' : 'border-gray-700 text-gray-400 bg-black/40'}`}>
            +{availableAP}
          </span>
        </div>
      </div>

      {/* Attributes Grid (The Iconic 6 Stat Blocks) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {statConfig.map((stat) => {
          const val = profile.visibleStats[stat.key] || 10;
          const isAllocatingThis = allocating === stat.key;

          return (
            <div
              key={stat.key}
              className={`p-3.5 border transition-all ${stat.bgAccent} ${isAllocatingThis ? 'border-primary scale-[1.02] shadow-[0_0_20px_rgba(0,240,255,0.4)]' : 'hover:border-primary/50'}`}
            >
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-1.5">
                  <span className={`font-display font-black text-sm tracking-wider ${stat.color}`}>
                    {stat.name}
                  </span>
                  <span className="text-[10px] font-mono text-muted-foreground">
                    [{stat.code}]
                  </span>
                </div>
                
                <div className="flex items-center gap-2">
                  <span className="font-mono font-bold text-lg text-white">
                    {val}
                  </span>

                  {availableAP > 0 && (
                    <button
                      onClick={() => handleAllocate(stat.key)}
                      title={`Allocate 1 AP to ${stat.name}`}
                      className="w-6 h-6 flex items-center justify-center border border-primary bg-primary/20 text-primary hover:bg-primary hover:text-black font-bold text-xs shadow-[0_0_8px_rgba(0,240,255,0.4)] active:scale-90 transition-transform"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              <p className="text-[10px] font-tech text-gray-400 line-clamp-1">
                {stat.desc}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
};
