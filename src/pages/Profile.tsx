import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { AttributeDisplay } from '@/components/AttributeDisplay';
import { Button } from '@/components/ui/button';
import { getUserProfile } from '@/lib/storage';
import { UserProfile } from '@/lib/types';
import { ArrowLeft, Calendar } from 'lucide-react';

const Profile = () => {
  const navigate = useNavigate();
  const [profile, setProfile] = useState<UserProfile | null>(null);

  useEffect(() => {
    setProfile(getUserProfile());
  }, []);

  if (!profile) return null;

  const hasAccumulatedPoints = Object.values(profile.accumulatedPoints).some(v => v > 0);
  const daysActive = Math.floor(
    (new Date().getTime() - new Date(profile.createdAt).getTime()) / (1000 * 60 * 60 * 24)
  );

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="container mx-auto px-4 py-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/')}
            className="mb-2 font-mono-data"
          >
            <ArrowLeft className="h-4 w-4 mr-1" />
            Return
          </Button>
          <h1 className="text-xl font-bold">Subject Profile</h1>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8 max-w-4xl">
        {/* Identity */}
        <div className="bg-card border border-border p-6 mb-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            <div>
              <div className="text-xs text-muted-foreground mb-1">ID</div>
              <div className="font-mono-data text-sm font-bold">{profile.pseudo}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground mb-1">DESIGNATION</div>
              <div className="font-mono-data text-sm">{profile.displayName}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground mb-1">LEVEL</div>
              <div className="font-mono-data text-2xl font-bold">{profile.level}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground mb-1">ACTIVE DAYS</div>
              <div className="font-mono-data text-sm flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                {daysActive}
              </div>
            </div>
          </div>
        </div>

        {/* Visible Statistics */}
        <div className="bg-card border border-border p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold">Visible Statistics</h2>
            <span className="text-xs font-mono-data text-muted-foreground">
              LAST UPDATE: LV.{profile.level}
            </span>
          </div>
          <AttributeDisplay attributes={profile.visibleStats} />
          <p className="text-xs text-muted-foreground mt-4 leading-relaxed">
            Visible statistics represent confirmed attribute values. Updates occur upon level advancement only.
          </p>
        </div>

        {/* Accumulated Points */}
        {hasAccumulatedPoints && (
          <div className="bg-surface border border-info p-6 mb-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold">Accumulated Development</h2>
              <span className="text-xs font-mono-data text-info">PENDING</span>
            </div>
            <AttributeDisplay 
              attributes={profile.visibleStats}
              accumulated={profile.accumulatedPoints}
            />
            <p className="text-xs text-muted-foreground mt-4 leading-relaxed">
              Hidden attribute points accumulate through training completion. 
              Points will be applied to visible statistics upon next level advancement.
            </p>
          </div>
        )}

        {/* Progress */}
        <div className="bg-card border border-border p-6">
          <h2 className="font-bold mb-4">Level Progress</h2>
          <div className="mb-2">
            <div className="flex justify-between text-xs font-mono-data text-muted-foreground mb-1">
              <span>CURRENT XP</span>
              <span>{profile.xp} / {profile.xpToNextLevel}</span>
            </div>
            <div className="h-2 bg-secondary relative overflow-hidden">
              <div 
                className="h-full bg-primary transition-all duration-500"
                style={{ width: `${(profile.xp / profile.xpToNextLevel) * 100}%` }}
              />
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-4">
            {Math.ceil(profile.xpToNextLevel - profile.xp)} XP required for level {profile.level + 1}
          </p>
        </div>

        {/* System Note */}
        <div className="mt-6 bg-surface border border-border p-4">
          <p className="text-xs text-muted-foreground leading-relaxed">
            <span className="font-mono-data font-bold">SYSTEM NOTE:</span> All data stored locally. 
            Subject profile persists across sessions. Export functionality available in settings.
            Training effectiveness increases with consistent participation.
          </p>
        </div>
      </div>
    </div>
  );
};

export default Profile;
