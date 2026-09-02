import { Heart, Zap, Gauge, Move, Wind, Eye, Brain } from 'lucide-react';
import { SystemFrame, SystemPanel } from '@/components/SystemFrame';
import { UserProfile } from '@/lib/types';

interface SoloStatusWindowProps {
  profile: UserProfile;
  rank: string;
  xpPct: number;
}

/** Exact recreation of the STATUS window Sung Jinwoo opens in Solo Leveling. */
export const SoloStatusWindow = ({ profile, rank, xpPct }: SoloStatusWindowProps) => {
  const hpMax = 100 + profile.level * 120;
  const mpMax = 50 + profile.level * 20;
  const fatigue = 0;
  const points = Object.values(profile.accumulatedPoints ?? {}).reduce((a, b) => a + (b || 0), 0);

  const stats: { key: keyof UserProfile['visibleStats']; label: string; icon: typeof Heart }[] = [
    { key: 'STR', label: 'STR', icon: Move },
    { key: 'VIT', label: 'VIT', icon: Heart },
    { key: 'AGI', label: 'AGI', icon: Wind },
    { key: 'INT', label: 'INT', icon: Brain },
    { key: 'PER', label: 'PER', icon: Eye },
    { key: 'WIS', label: 'WIS', icon: Gauge },
  ];

  return (
    <SystemFrame title="Status">
      {/* LEVEL · JOB · TITLE */}
      <div className="flex items-end justify-center gap-6 sm:gap-10 mb-5">
        <div className="text-center">
          <div className="font-display text-5xl sm:text-6xl font-black text-primary text-glow leading-none">
            {profile.level}
          </div>
          <div className="font-display text-[10px] tracking-[0.35em] text-foreground/85 mt-1">LEVEL</div>
        </div>
        <div className="space-y-1.5 pb-1">
          <div className="flex items-baseline gap-2">
            <span className="data-readout text-[10px] tracking-[0.2em] text-muted-foreground">JOB:</span>
            <span className="text-base sm:text-lg text-foreground">{profile.pseudo || 'None'}</span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="data-readout text-[10px] tracking-[0.2em] text-muted-foreground">TITLE:</span>
            <span
              className="text-base sm:text-lg"
              style={{ color: `hsl(var(--rank-${rank.toLowerCase()}))` }}
            >
              {rank}-Rank Hunter
            </span>
          </div>
        </div>
      </div>

      {/* HP · MP · FATIGUE */}
      <SystemPanel className="mb-4">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 sm:gap-6">
          <div className="flex-1 flex items-center gap-2">
            <div className="text-center shrink-0">
              <Heart className="h-4 w-4 mx-auto" style={{ color: 'hsl(var(--health))' }} />
              <div className="data-readout text-[9px] tracking-[0.2em]" style={{ color: 'hsl(var(--health))' }}>HP</div>
            </div>
            <div className="sys-gauge">
              <span style={{ width: '100%', background: 'hsl(var(--health))', boxShadow: '0 0 10px hsl(var(--health))' }} />
            </div>
            <span className="data-readout text-[10px] text-foreground/80 shrink-0">{hpMax}<span className="text-muted-foreground">/{hpMax}</span></span>
          </div>

          <div className="flex-1 flex items-center gap-2">
            <div className="text-center shrink-0">
              <Zap className="h-4 w-4 mx-auto" style={{ color: 'hsl(var(--mana))' }} />
              <div className="data-readout text-[9px] tracking-[0.2em]" style={{ color: 'hsl(var(--mana))' }}>MP</div>
            </div>
            <div className="sys-gauge">
              <span style={{ width: '100%', background: 'hsl(var(--mana))', boxShadow: '0 0 10px hsl(var(--mana))' }} />
            </div>
            <span className="data-readout text-[10px] text-foreground/80 shrink-0">{mpMax}<span className="text-muted-foreground">/{mpMax}</span></span>
          </div>

          <div className="flex items-center justify-center gap-2 shrink-0">
            <Gauge className="h-4 w-4 text-primary" />
            <span className="data-readout text-[10px] tracking-[0.2em] text-muted-foreground">FATIGUE:</span>
            <span className="data-readout text-sm text-foreground">{fatigue}</span>
          </div>
        </div>
      </SystemPanel>

      {/* ABILITY STATS */}
      <SystemPanel>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-10 gap-y-4">
          {stats.map((s) => {
            const Icon = s.icon;
            return (
              <div key={s.key} className="flex items-center gap-3">
                <Icon className="h-4 w-4 shrink-0" style={{ color: `hsl(var(--attr-${s.label.toLowerCase()}))` }} />
                <span className="font-display text-xs tracking-[0.2em] text-foreground/90 w-12">{s.label}:</span>
                <span className="data-readout text-xl text-foreground">{profile.visibleStats[s.key]}</span>
              </div>
            );
          })}
        </div>

        <div className="mt-5 pt-4 border-t border-primary/20 flex items-center justify-between gap-4">
          <span className="data-readout text-[10px] leading-tight tracking-[0.16em] text-muted-foreground">
            AVAILABLE
            <br />
            ABILITY POINTS
          </span>
          <span className="data-readout text-2xl text-primary text-glow">{points}</span>
        </div>

        <div className="mt-4 flex items-center gap-2">
          <span className="data-readout text-[10px] tracking-[0.2em] text-muted-foreground">EXP</span>
          <div className="sys-gauge">
            <span
              style={{
                width: `${xpPct}%`,
                background: 'hsl(var(--system-glow))',
                boxShadow: '0 0 12px hsl(var(--system-glow))',
              }}
            />
          </div>
          <span className="data-readout text-[10px] text-primary/85 shrink-0">
            {profile.xp}/{profile.xpToNextLevel}
          </span>
        </div>
      </SystemPanel>
    </SystemFrame>
  );
};

export default SoloStatusWindow;
