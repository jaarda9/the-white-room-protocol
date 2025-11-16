import { UserProfile } from '@/lib/types';

interface StatusCardProps {
  profile: UserProfile;
}

export const StatusCard = ({ profile }: StatusCardProps) => {
  const xpPercentage = (profile.xp / profile.xpToNextLevel) * 100;

  return (
    <div className="bg-card border border-border p-4">
      <div className="grid grid-cols-3 gap-4 mb-4">
        <div>
          <div className="text-xs text-muted-foreground mb-1">ID</div>
          <div className="font-mono-data text-sm">{profile.pseudo}</div>
        </div>
        <div>
          <div className="text-xs text-muted-foreground mb-1">LEVEL</div>
          <div className="font-mono-data text-2xl font-bold">{profile.level}</div>
        </div>
        <div>
          <div className="text-xs text-muted-foreground mb-1">XP</div>
          <div className="font-mono-data text-sm">
            {profile.xp} / {profile.xpToNextLevel}
          </div>
        </div>
      </div>
      
      <div className="mb-2">
        <div className="h-1 bg-secondary relative overflow-hidden">
          <div 
            className="h-full bg-primary transition-all duration-500"
            style={{ width: `${xpPercentage}%` }}
          />
        </div>
      </div>

      <div className="text-xs text-muted-foreground">
        {Math.round(xpPercentage)}% to next level
      </div>
    </div>
  );
};
