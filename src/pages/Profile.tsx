import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { SoloLevelingHeader } from '@/components/SoloLevelingHeader';
import { SoloStatusWindow } from '@/components/SoloStatusWindow';
import { AttributeRadarChart } from '@/components/AttributeRadarChart';
import { getUserProfile, saveUserProfile, getHunterRank, getHunterJob, getHunterTitle, getHunterVitals } from '@/lib/storage';
import { UserProfile } from '@/lib/types';
import { systemSound } from '@/lib/system-sound';
import { useAuth } from '@/contexts/AuthContext';
import {
  ArrowLeft, Shield, Award, Sparkles, Calendar, 
  Crown, Flame, LogOut, CheckCircle2, User, RefreshCw
} from 'lucide-react';

const Profile = () => {
  const navigate = useNavigate();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const { signOut } = useAuth();
  const [signingOut, setSigningOut] = useState(false);
  const [customName, setCustomName] = useState('');
  const [editingName, setEditingName] = useState(false);

  useEffect(() => {
    const p = getUserProfile();
    setProfile(p);
    setCustomName(p.displayName || p.pseudo);
  }, []);

  if (!profile) return null;

  const rank = getHunterRank(profile.level);
  const job = getHunterJob(profile.level, profile.job);
  const title = getHunterTitle(profile.level, profile.title);
  const vitals = getHunterVitals(profile);

  const daysActive = Math.max(
    1,
    Math.floor((new Date().getTime() - new Date(profile.createdAt).getTime()) / (1000 * 60 * 60 * 24))
  );

  const handleSaveName = () => {
    systemSound.playClick();
    const updated: UserProfile = {
      ...profile,
      displayName: customName.trim() || profile.pseudo,
    };
    saveUserProfile(updated);
    setProfile(updated);
    setEditingName(false);
  };

  const titlesAvailable = [
    { name: 'The Awakened', rank: 'E', desc: 'One who stepped into the hunter world.' },
    { name: 'Wolf Slayer', rank: 'D', desc: 'Conqueror of the Lycan dungeon packs.' },
    { name: 'Dungeon Conqueror', rank: 'C', desc: 'Master of instant dungeon trials.' },
    { name: 'Demon Slayer', rank: 'B', desc: 'Breaker of demonic gates.' },
    { name: 'Ruler of the Dead', rank: 'A', desc: 'Commander of lingering shadow souls.' },
    { name: 'Supreme Sovereign', rank: 'S', desc: 'The absolute monarch of the shadow realm.' },
  ];

  const handleSelectTitle = (tName: string) => {
    systemSound.playClick();
    const updated: UserProfile = {
      ...profile,
      title: tName,
    };
    saveUserProfile(updated);
    setProfile(updated);
  };

  return (
    <div className="min-h-screen bg-[#030712] text-foreground scanlines pb-16">
      <SoloLevelingHeader />

      <main className="max-w-5xl mx-auto px-3 sm:px-6 py-6 space-y-6">
        
        {/* Navigation Breadcrumb */}
        <div className="flex items-center justify-between">
          <button
            onClick={() => {
              systemSound.playClick();
              navigate('/');
            }}
            className="system-btn px-3 py-1.5 flex items-center gap-1.5 text-xs"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>[ RETURN TO COMMAND ]</span>
          </button>

          <span className="text-xs font-mono text-primary/80 border border-primary/40 px-2 py-0.5 bg-primary/10">
            HUNTER REGISTRATION DOSSIER
          </span>
        </div>

        {/* Hunter License Identity Card */}
        <div className="system-window-monarch tech-corners p-5 sm:p-6 relative overflow-hidden">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-amber-500/40 pb-4 mb-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 border-2 border-amber-400 bg-amber-950/60 flex items-center justify-center font-display font-black text-2xl text-amber-300 monarch-glow-text shadow-[0_0_20px_rgba(251,191,36,0.5)]">
                {rank}
              </div>
              <div>
                <div className="text-[10px] font-mono text-amber-400 tracking-widest uppercase">
                  KOREAN HUNTER ASSOCIATION OFFICIAL LICENSE
                </div>
                <h1 className="text-xl sm:text-2xl font-display font-black text-white tracking-wider flex items-center gap-2">
                  {profile.displayName || profile.pseudo}
                  <span className="text-xs px-2 py-0.5 border border-amber-400/60 bg-amber-950/50 text-amber-300">
                    {rank}-RANK
                  </span>
                </h1>
              </div>
            </div>

            <div className="flex items-center gap-2 text-xs font-mono">
              <span className="text-muted-foreground">HUNTER ID:</span>
              <span className="text-amber-300 font-bold border border-amber-500/40 px-2 py-0.5 bg-black/50">
                {profile.pseudo}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs font-mono">
            <div className="p-3 bg-black/40 border border-amber-500/20">
              <div className="text-muted-foreground text-[10px] uppercase">JOB CLASS</div>
              <div className="text-sm font-bold text-purple-400 font-display mt-0.5">{job}</div>
            </div>
            <div className="p-3 bg-black/40 border border-amber-500/20">
              <div className="text-muted-foreground text-[10px] uppercase">EQUIPPED TITLE</div>
              <div className="text-sm font-bold text-amber-300 font-display mt-0.5">{title}</div>
            </div>
            <div className="p-3 bg-black/40 border border-amber-500/20">
              <div className="text-muted-foreground text-[10px] uppercase">HUNTER LEVEL</div>
              <div className="text-sm font-bold text-primary font-display mt-0.5">LV.{profile.level}</div>
            </div>
            <div className="p-3 bg-black/40 border border-amber-500/20">
              <div className="text-muted-foreground text-[10px] uppercase">ACTIVE DAYS</div>
              <div className="text-sm font-bold text-emerald-400 font-display mt-0.5">{daysActive} DAYS</div>
            </div>
          </div>
        </div>

        {/* Solo Status Window (Full Stats & AP Allocation) */}
        <SoloStatusWindow
          profile={profile}
          onProfileUpdated={(updated) => setProfile(updated)}
        />

        {/* Attribute Radar Matrix */}
        <div className="system-window tech-corners p-5 sm:p-6">
          <div className="flex items-center justify-between border-b border-primary/30 pb-3 mb-4">
            <h3 className="font-display font-bold text-base text-white tracking-wider system-glow-text">
              [ STATISTICAL MATRIX & RADAR SPECTRUM ]
            </h3>
            <span className="text-xs font-mono text-primary/80">
              6-AXIS SYSTEM ATTRIBUTES
            </span>
          </div>

          <div className="py-2">
            <AttributeRadarChart attributes={profile.visibleStats} />
          </div>
        </div>

        {/* Titles & Awakened Perks */}
        <div className="system-window tech-corners p-5 sm:p-6">
          <div className="flex items-center justify-between border-b border-primary/30 pb-3 mb-4">
            <div className="flex items-center gap-2">
              <Crown className="w-4 h-4 text-amber-400" />
              <h3 className="font-display font-bold text-base text-white tracking-wider monarch-glow-text">
                [ HUNTER TITLES & DESIGNATIONS ]
              </h3>
            </div>
            <span className="text-xs font-mono text-muted-foreground">
              CLICK TO EQUIP TITLE
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {titlesAvailable.map((t) => {
              const isEquipped = title === t.name;
              return (
                <div
                  key={t.name}
                  onClick={() => handleSelectTitle(t.name)}
                  className={`p-3 border cursor-pointer transition-all ${isEquipped ? 'border-amber-400 bg-amber-950/40 shadow-[0_0_15px_rgba(251,191,36,0.3)]' : 'border-primary/20 bg-black/40 hover:border-primary/50'}`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-display font-bold text-sm text-white">
                      {t.name}
                    </span>
                    <span className={`text-[10px] font-mono px-1.5 py-0.2 border ${isEquipped ? 'border-amber-400 text-amber-300' : 'border-gray-700 text-gray-400'}`}>
                      {t.rank}-RANK
                    </span>
                  </div>
                  <p className="text-xs font-tech text-gray-400 line-clamp-2">
                    {t.desc}
                  </p>
                  {isEquipped && (
                    <span className="text-[10px] font-mono text-amber-400 mt-2 block font-bold">
                      [ CURRENTLY EQUIPPED ]
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* System Settings & Terminate Session */}
        <div className="p-4 bg-red-950/20 border border-red-500/40 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs font-mono">
          <div>
            <span className="text-red-400 font-bold font-tech text-sm block">
              TERMINATE HUNTER SESSION
            </span>
            <span className="text-gray-400">
              Synchronize state to cloud storage and securely close system terminal.
            </span>
          </div>

          <button
            onClick={async () => {
              systemSound.playClick();
              setSigningOut(true);
              try {
                await signOut();
                navigate('/login');
              } finally {
                setSigningOut(false);
              }
            }}
            disabled={signingOut}
            className="system-btn-penalty px-4 py-2 text-xs font-bold whitespace-nowrap"
          >
            {signingOut ? 'DISCONNECTING...' : 'DISCONNECT SESSION'}
          </button>
        </div>
      </main>
    </div>
  );
};

export default Profile;
