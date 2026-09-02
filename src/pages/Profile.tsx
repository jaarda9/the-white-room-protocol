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
    const p = getUserProfile();
    setProfile(p);
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
    <div className="min-h-screen bg-[#070d18] text-[#e5ecf4] flex flex-col">
      <SoloLevelingHeader />

      <main className="max-w-4xl mx-auto w-full px-4 py-8 flex-1 space-y-6">
        <div className="flex items-center justify-between">
          <button
            onClick={() => {
              systemSound.playClick();
              navigate('/');
            }}
            className="flex items-center gap-2 text-xs font-mono text-gray-400 hover:text-cyan-300 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>[ RETURN TO COMMAND ]</span>
          </button>
        </div>

        {/* Status License Card */}
        <div className="anime-window system-blueprint-bg system-window-corners p-6 relative">
          <div className="corner-ticks" />
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-cyan-500/20 pb-4 mb-6">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 border border-cyan-400 bg-cyan-950/40 flex items-center justify-center font-display font-black text-2xl text-cyan-300 anime-glow-text shadow-[0_0_15px_rgba(82,210,246,0.2)]">
                {rank}
              </div>
              <div>
                <div className="text-[10px] font-mono text-cyan-400 tracking-wider uppercase">
                  HUNTER REGISTRATION DOSSIER
                </div>
                <h1 className="text-xl sm:text-2xl font-display font-bold text-white tracking-wider flex items-center gap-2">
                  {profile.displayName || profile.pseudo}
                  <span className="text-xs px-2 py-0.5 border border-cyan-400 bg-cyan-950/50 text-cyan-300">
                    {rank}-RANK
                  </span>
                </h1>
              </div>
            </div>

            <div className="text-xs font-mono text-gray-400">
              HUNTER ID: <span className="text-cyan-300 font-bold">{profile.pseudo}</span>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 font-mono text-xs">
            <div className="p-3 border border-cyan-500/20 bg-black/40">
              <div className="text-gray-400 text-[10px]">JOB CLASS</div>
              <div className="text-sm font-bold text-white mt-1">{job}</div>
            </div>
            <div className="p-3 border border-cyan-500/20 bg-black/40">
              <div className="text-gray-400 text-[10px]">EQUIPPED TITLE</div>
              <div className="text-sm font-bold text-cyan-300 mt-1">{title}</div>
            </div>
            <div className="p-3 border border-cyan-500/20 bg-black/40">
              <div className="text-gray-400 text-[10px]">HUNTER LEVEL</div>
              <div className="text-sm font-bold text-white mt-1">LV.{profile.level}</div>
            </div>
            <div className="p-3 border border-cyan-500/20 bg-black/40">
              <div className="text-gray-400 text-[10px]">ACTIVE DAYS</div>
              <div className="text-sm font-bold text-cyan-300 mt-1">{daysActive} DAYS</div>
            </div>
          </div>
        </div>

        {/* Titles & Awakened Perks */}
        <div className="anime-window p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-cyan-500/20 pb-3">
            <div className="flex items-center gap-2">
              <Crown className="w-4 h-4 text-cyan-400" />
              <h3 className="font-display font-bold text-base text-white anime-glow-text">
                HUNTER TITLES & DESIGNATIONS
              </h3>
            </div>
            <span className="text-[10px] font-mono text-gray-400">
              CLICK TO EQUIP
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 font-mono">
            {titlesAvailable.map((t) => {
              const isEquipped = title === t.name;
              return (
                <div
                  key={t.name}
                  onClick={() => handleSelectTitle(t.name)}
                  className={`p-3.5 border cursor-pointer transition-all ${
                    isEquipped
                      ? 'border-cyan-400 bg-cyan-950/40 text-cyan-300 shadow-[0_0_12px_rgba(82,210,246,0.2)]'
                      : 'border-cyan-500/20 bg-black/40 text-gray-400 hover:border-cyan-400'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-bold text-xs text-white">
                      {t.name}
                    </span>
                    <span className="text-[10px] border border-cyan-500/40 px-1 text-cyan-300">
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
        <div className="p-4 border border-red-500/40 bg-black/40 flex flex-col sm:flex-row items-center justify-between gap-3 font-mono text-xs">
          <div>
            <span className="text-red-400 font-bold block">
              TERMINATE HUNTER SESSION
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
            className="px-4 py-2 border border-red-500 bg-red-950/30 text-red-400 hover:bg-red-500 hover:text-black font-bold transition-all"
          >
            {signingOut ? 'DISCONNECTING...' : 'DISCONNECT SESSION'}
          </button>
        </div>
      </main>
    </div>
  );
};

export default Profile;
