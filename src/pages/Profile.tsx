import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { SoloLevelingHeader } from '@/components/SoloLevelingHeader';
import { getUserProfile, saveUserProfile, getHunterRank, getHunterJob, getHunterTitle } from '@/lib/storage';
import { UserProfile } from '@/lib/types';
import { systemSound } from '@/lib/system-sound';
import { useAuth } from '@/contexts/AuthContext';
import { ArrowLeft, Crown } from 'lucide-react';

const Profile = () => {
  const navigate = useNavigate();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const { signOut } = useAuth();
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    const update = () => {
      setProfile(getUserProfile());
    };
    update();

    window.addEventListener('wrp:profile-updated', update);
    window.addEventListener('storage', update);
    return () => {
      window.removeEventListener('wrp:profile-updated', update);
      window.removeEventListener('storage', update);
    };
  }, []);

  if (!profile) return null;

  const rank = getHunterRank(profile.level);
  const job = getHunterJob(profile.level, profile.job);
  const title = getHunterTitle(profile.level, profile.title);

  const daysActive = Math.max(
    1,
    Math.floor((new Date().getTime() - new Date(profile.createdAt).getTime()) / (1000 * 60 * 60 * 24))
  );

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
    <div className="min-h-screen pt-6 pb-28 bg-[#071322] text-[#e5ecf4] flex flex-col system-blueprint-bg font-mono">
      <SoloLevelingHeader />

      <main className="max-w-4xl mx-auto w-full px-3 sm:px-6 py-4 sm:py-8 flex-1 space-y-4 sm:space-y-6 overflow-x-hidden">
        <div className="flex items-center justify-between">
          <button
            onClick={() => {
              systemSound.playClick();
              navigate('/');
            }}
            className="flex items-center gap-2 px-3 py-1.5 border border-white/50 bg-[#061426]/80 text-[#9fd3ff] text-xs font-mono hover:bg-white/10 hover:border-white transition-all shadow-[0_0_10px_rgba(0,212,255,0.2)]"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>[ RETURN TO STATUS ]</span>
          </button>
        </div>

        {/* Status License Card */}
        <div className="relative bg-[#0a1b2e]/90 border-2 border-white/50 rounded-[4px] p-4 sm:p-6 text-white shadow-[0_0_30px_rgba(0,0,0,0.85),inset_0_0_24px_rgba(0,212,255,0.08)] backdrop-blur-md anime-dropdown">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 border-b border-white/20 pb-4 mb-4 sm:mb-6">
            <div className="flex items-center gap-3 sm:gap-4 min-w-0">
              <div className="w-12 h-12 sm:w-14 sm:h-14 shrink-0 border-2 border-white/70 bg-[#061426]/80 flex items-center justify-center font-mono font-black text-xl sm:text-2xl text-white anime-glow-text shadow-[0_0_15px_rgba(0,212,255,0.3)]">
                {rank}
              </div>
              <div className="min-w-0">
                <div className="text-[10px] font-mono text-[#9fd3ff] tracking-wider uppercase truncate">
                  HUNTER REGISTRATION DOSSIER
                </div>
                <h1 className="text-base sm:text-2xl font-mono font-bold text-white tracking-wider flex flex-wrap items-center gap-1.5 sm:gap-2">
                  <span className="truncate">{profile.displayName || profile.pseudo}</span>
                  <span className="text-[11px] sm:text-xs px-1.5 sm:px-2 py-0.5 border border-white/50 bg-[#061426]/60 text-[#9fd3ff] shrink-0">
                    {rank}-RANK
                  </span>
                </h1>
              </div>
            </div>

            <div className="text-xs font-mono text-gray-400 shrink-0">
              HUNTER ID: <span className="text-[#9fd3ff] font-bold">{profile.pseudo}</span>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3 font-mono text-xs">
            <div className="p-2.5 sm:p-3 border border-white/30 bg-[#061424]/75 rounded-[2px] min-w-0">
              <div className="text-gray-400 text-[10px] truncate">JOB CLASS</div>
              <div className="text-xs sm:text-sm font-bold text-white mt-1 truncate">{job}</div>
            </div>
            <div className="p-2.5 sm:p-3 border border-white/30 bg-[#061424]/75 rounded-[2px] min-w-0">
              <div className="text-gray-400 text-[10px] truncate">EQUIPPED TITLE</div>
              <div className="text-xs sm:text-sm font-bold text-[#9fd3ff] mt-1 truncate">{title}</div>
            </div>
            <div className="p-2.5 sm:p-3 border border-white/30 bg-[#061424]/75 rounded-[2px] min-w-0">
              <div className="text-gray-400 text-[10px] truncate">HUNTER LEVEL</div>
              <div className="text-xs sm:text-sm font-bold text-white mt-1 truncate">LV.{profile.level}</div>
            </div>
            <div className="p-2.5 sm:p-3 border border-white/30 bg-[#061424]/75 rounded-[2px] min-w-0">
              <div className="text-gray-400 text-[10px] truncate">ACTIVE DAYS</div>
              <div className="text-xs sm:text-sm font-bold text-[#9fd3ff] mt-1 truncate">{daysActive} DAYS</div>
            </div>
          </div>
        </div>

        {/* Titles & Awakened Perks */}
        <div className="relative bg-[#0a1b2e]/90 border-2 border-white/50 rounded-[4px] p-4 sm:p-6 space-y-4 text-white shadow-[0_0_30px_rgba(0,0,0,0.85),inset_0_0_24px_rgba(0,212,255,0.08)] backdrop-blur-md anime-dropdown">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-white/20 pb-3">
            <div className="flex items-center gap-2">
              <Crown className="w-4 h-4 text-[#9fd3ff] shrink-0" />
              <h3 className="font-mono font-bold text-sm sm:text-base text-white anime-glow-text">
                [ HUNTER TITLES & DESIGNATIONS ]
              </h3>
            </div>
            <span className="text-[10px] font-mono text-gray-400">
              CLICK TO EQUIP
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 sm:gap-3 font-mono">
            {titlesAvailable.map((t) => {
              const isEquipped = title === t.name;
              return (
                <div
                  key={t.name}
                  onClick={() => handleSelectTitle(t.name)}
                  className={`p-3 sm:p-3.5 border rounded-[2px] cursor-pointer transition-all ${
                    isEquipped
                      ? 'border-white bg-white/15 text-white shadow-[0_0_12px_rgba(0,212,255,0.25)]'
                      : 'border-white/25 bg-[#061424]/75 text-gray-300 hover:border-white/70 hover:bg-white/5'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1 gap-2">
                    <span className="font-bold text-xs text-white truncate">
                      {t.name}
                    </span>
                    <span className="text-[10px] border border-white/40 px-1 text-[#9fd3ff] bg-black/40 shrink-0">
                      {t.rank}-RANK
                    </span>
                  </div>
                  <p className="text-[11px] text-gray-400 line-clamp-2">
                    {t.desc}
                  </p>
                </div>
              );
            })}
          </div>
        </div>

        {/* Disconnect Session */}
        <div className="p-4 border-2 border-red-500/50 bg-[#0a1b2e]/85 rounded-[4px] flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 font-mono text-xs shadow-[0_0_20px_rgba(0,0,0,0.7)] anime-dropdown">
          <div>
            <span className="text-red-400 font-bold block tracking-wider text-xs sm:text-sm">
              [ TERMINATE HUNTER SESSION ]
            </span>
            <span className="text-gray-400 text-[11px]">
              Disconnect from system network and exit terminal.
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
            className="w-full sm:w-auto px-4 py-2 border border-red-500/80 bg-red-950/40 text-red-300 hover:bg-red-900/60 hover:text-white font-bold transition-all shadow-[0_0_10px_rgba(239,68,68,0.2)] text-center"
          >
            {signingOut ? 'DISCONNECTING...' : 'DISCONNECT SESSION'}
          </button>
        </div>
      </main>
    </div>
  );
};

export default Profile;
