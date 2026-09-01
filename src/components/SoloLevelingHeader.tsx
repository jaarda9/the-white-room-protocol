import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { getUserProfile } from '@/lib/storage';
import { UserProfile } from '@/lib/types';
import { useAuth } from '@/contexts/AuthContext';
import { systemSound } from '@/lib/system-sound';
import {
  Volume2, VolumeX, LogOut, ChevronDown, 
  Menu, X, Sparkles, Brain, Dumbbell, Users, Crown, Target, TestTube,
  Trophy, Calendar, BarChart2, ScrollText, Swords, User
} from 'lucide-react';


interface Props {
  onOpenAIChat?: () => void;
}

export const SoloLevelingHeader = ({ onOpenAIChat }: Props) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { signOut } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [dungeonsOpen, setDungeonsOpen] = useState(false);
  const [archivesOpen, setArchivesOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    setProfile(getUserProfile());
    setAudioEnabled(systemSound.isEnabled());

    const handleStorageUpdate = () => {
      setProfile(getUserProfile());
    };

    window.addEventListener('storage', handleStorageUpdate);
    window.addEventListener('wrp:quests-updated', handleStorageUpdate);
    return () => {
      window.removeEventListener('storage', handleStorageUpdate);
      window.removeEventListener('wrp:quests-updated', handleStorageUpdate);
    };
  }, [location.pathname]);

  if (!profile) return null;

  const toggleAudio = () => {
    const newState = systemSound.toggle();
    setAudioEnabled(newState);
  };

  const navTo = (path: string) => {
    systemSound.playClick();
    setDungeonsOpen(false);
    setArchivesOpen(false);
    setMobileMenuOpen(false);
    navigate(path);
  };

  const dungeons = [
    { label: 'Physical Dungeon', path: '/physical-lab', icon: Dumbbell, rank: 'E-Rank', minLvl: 10 },
    { label: 'Cognitive Trial', path: '/mental-lab', icon: Brain, rank: 'D-Rank', minLvl: 10 },
    { label: 'Social Simulation', path: '/social-lab', icon: Users, rank: 'D-Rank', minLvl: 10 },
    { label: 'Knowledge Vault', path: '/knowledge-lab', icon: TestTube, rank: 'C-Rank', minLvl: 15 },
    { label: 'Strategic Chess', path: '/chess-lab', icon: Crown, rank: 'C-Rank', minLvl: 15 },
    { label: 'Skill Forge', path: '/skill-forge', icon: Target, rank: 'B-Rank', minLvl: 20 },
    { label: 'Kinnu Skill Tree', path: '/kinnu-lab', icon: TestTube, rank: 'D-Rank', minLvl: 10 },
  ];

  const archives = [
    { label: 'Hunter Dossier', path: '/profile', icon: User },
    { label: 'Daily Protocol', path: '/daily-protocol', icon: ScrollText },
    { label: 'Feats & Titles', path: '/achievements', icon: Trophy },
    { label: 'Special Challenges', path: '/challenges', icon: Swords },
    { label: 'Global Rankings', path: '/leaderboard', icon: Crown },
    { label: 'Calendar Logs', path: '/calendar', icon: Calendar },
    { label: 'Analytics', path: '/analytics', icon: BarChart2 },
  ];

  return (
    <header className="sticky top-0 z-50 w-full bg-[#070d18]/95 backdrop-blur-md border-b border-cyan-500/20">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3">
        <div className="flex items-center justify-between gap-4">
          
          {/* Brand Logo / System indicator */}
          <button
            onClick={() => navTo('/')}
            className="flex items-center gap-3 text-left focus:outline-none group"
          >
            <div className="w-2.5 h-2.5 rounded-full bg-cyan-400 shadow-[0_0_8px_#52d2f6]" />
            <div className="flex items-center gap-2">
              <span className="font-display font-bold text-base sm:text-lg text-white tracking-widest anime-glow-text group-hover:text-cyan-300 transition-colors">
                THE SYSTEM
              </span>
              <span className="text-[10px] font-mono px-1.5 py-0.5 border border-cyan-500/40 text-cyan-300 bg-cyan-950/30">
                LV.{profile.level}
              </span>
            </div>
          </button>

          {/* Desktop Nav Links */}
          <nav className="hidden md:flex items-center gap-2 text-xs font-mono">
            <button
              onClick={() => navTo('/')}
              className={`px-3 py-1.5 border transition-all ${
                location.pathname === '/'
                  ? 'border-cyan-400 bg-cyan-400/20 text-cyan-300 shadow-[0_0_10px_rgba(82,210,246,0.2)]'
                  : 'border-transparent text-gray-400 hover:text-white hover:border-gray-800'
              }`}
            >
              STATUS & QUESTS
            </button>

            {/* Dungeons Dropdown */}
            <div className="relative">
              <button
                onClick={() => setDungeonsOpen(!dungeonsOpen)}
                className={`px-3 py-1.5 border flex items-center gap-1.5 transition-all ${
                  location.pathname.includes('-lab') || location.pathname === '/skill-forge'
                    ? 'border-cyan-400 bg-cyan-400/20 text-cyan-300 shadow-[0_0_10px_rgba(82,210,246,0.2)]'
                    : 'border-transparent text-gray-400 hover:text-white hover:border-gray-800'
                }`}
              >
                <span>DUNGEONS</span>
                <ChevronDown className="w-3 h-3 text-cyan-400" />
              </button>

              {dungeonsOpen && (
                <div className="absolute top-full right-0 mt-2 w-56 anime-window p-2 z-50 shadow-2xl">
                  <div className="text-[10px] font-mono text-cyan-400/80 px-2 py-1 border-b border-cyan-500/20 mb-1">
                    INSTANCE GATES
                  </div>
                  {dungeons.map((d) => {
                    const Icon = d.icon;
                    return (
                      <button
                        key={d.path}
                        onClick={() => navTo(d.path)}
                        className="w-full flex items-center justify-between px-2.5 py-2 text-left text-xs font-mono hover:bg-cyan-500/20 hover:text-white text-gray-300 transition-colors"
                      >
                        <div className="flex items-center gap-2">
                          <Icon className="w-3.5 h-3.5 text-cyan-400" />
                          <span>{d.label}</span>
                        </div>
                        <span className="text-[10px] text-cyan-400/70">{d.rank}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Archives Dropdown */}
            <div className="relative">
              <button
                onClick={() => setArchivesOpen(!archivesOpen)}
                className={`px-3 py-1.5 border flex items-center gap-1.5 transition-all ${
                  archives.some((a) => a.path === location.pathname)
                    ? 'border-cyan-400 bg-cyan-400/20 text-cyan-300 shadow-[0_0_10px_rgba(82,210,246,0.2)]'
                    : 'border-transparent text-gray-400 hover:text-white hover:border-gray-800'
                }`}
              >
                <span>ARCHIVES</span>
                <ChevronDown className="w-3 h-3 text-cyan-400" />
              </button>

              {archivesOpen && (
                <div className="absolute top-full right-0 mt-2 w-56 anime-window p-2 z-50 shadow-2xl">
                  <div className="text-[10px] font-mono text-cyan-400/80 px-2 py-1 border-b border-cyan-500/20 mb-1">
                    SYSTEM RECORDS
                  </div>
                  {archives.map((a) => {
                    const Icon = a.icon;
                    return (
                      <button
                        key={a.path}
                        onClick={() => navTo(a.path)}
                        className="w-full flex items-center gap-2 px-2.5 py-2 text-left text-xs font-mono hover:bg-cyan-500/20 hover:text-white text-gray-300 transition-colors"
                      >
                        <Icon className="w-3.5 h-3.5 text-cyan-400" />
                        <span>{a.label}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

          </nav>

          {/* Quick Action Tools */}
          <div className="flex items-center gap-2">
            <button
              onClick={toggleAudio}
              className="p-2 border border-cyan-500/30 bg-black/40 text-cyan-300 hover:border-cyan-400 transition-colors"
              title={audioEnabled ? 'Sound On' : 'Sound Muted'}
            >
              {audioEnabled ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5 text-gray-500" />}
            </button>

            {onOpenAIChat && (
              <button
                onClick={() => {
                  systemSound.playSystemChime();
                  onOpenAIChat();
                }}
                className="px-3 py-1.5 border border-cyan-400/60 bg-cyan-400/10 hover:bg-cyan-400 hover:text-black text-cyan-300 font-mono text-xs font-bold transition-all flex items-center gap-1.5"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">ARCHITECT</span>
              </button>
            )}

            <button
              onClick={async () => {
                systemSound.playClick();
                await signOut();
                navigate('/login');
              }}
              className="p-2 border border-gray-800 text-gray-400 hover:text-red-400 hover:border-red-500/40 transition-colors"
              title="Disconnect"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>

            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 border border-cyan-500/30 text-cyan-300 hover:border-cyan-400"
            >
              {mobileMenuOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Mobile Navigation */}
        {mobileMenuOpen && (
          <div className="md:hidden mt-3 pt-3 border-t border-cyan-500/20 grid grid-cols-2 gap-2 text-xs font-mono pb-2">
            <button
              onClick={() => navTo('/')}
              className="p-2 text-left border border-cyan-500/30 bg-black/40 text-cyan-300 col-span-2"
            >
              [ STATUS & QUESTS ]
            </button>
            <div className="col-span-2 pt-1 text-[10px] text-cyan-400/80">ARCHIVES:</div>
            {archives.map((a) => (
              <button
                key={a.path}
                onClick={() => navTo(a.path)}
                className="p-2 text-left border border-gray-800 text-gray-300 text-[11px]"
              >
                {a.label}
              </button>
            ))}
            <div className="col-span-2 pt-2 text-[10px] text-cyan-400/80">DUNGEONS:</div>
            {dungeons.map((d) => (
              <button
                key={d.path}
                onClick={() => navTo(d.path)}
                className="p-2 text-left border border-gray-800 text-gray-300 text-[11px]"
              >
                {d.label}
              </button>
            ))}
          </div>

        )}
      </div>
    </header>
  );
};
