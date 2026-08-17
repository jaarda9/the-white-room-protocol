import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { getUserProfile, getHunterRank, getHunterJob, getHunterTitle, getHunterVitals } from '@/lib/storage';
import { UserProfile } from '@/lib/types';
import { useAuth } from '@/contexts/AuthContext';
import { systemSound } from '@/lib/system-sound';
import {
  Shield, Volume2, VolumeX, LogOut, ChevronDown, 
  Menu, X, Sparkles, MessageSquare, Flame, Zap, Trophy,
  CalendarDays, BookOpen, Brain, Dumbbell, Users, Crown, Target, TestTube
} from 'lucide-react';

interface Props {
  onOpenAIChat?: () => void;
}

export const SoloLevelingHeader = ({ onOpenAIChat }: Props) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [dungeonsOpen, setDungeonsOpen] = useState(false);
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

  const rank = getHunterRank(profile.level);
  const job = getHunterJob(profile.level, profile.job);
  const title = getHunterTitle(profile.level, profile.title);
  const vitals = getHunterVitals(profile);

  const toggleAudio = () => {
    const newState = systemSound.toggle();
    setAudioEnabled(newState);
  };

  const navTo = (path: string) => {
    systemSound.playClick();
    setDungeonsOpen(false);
    setMobileMenuOpen(false);
    navigate(path);
  };

  const dungeons = [
    { label: 'Physical Dungeon', path: '/physical-lab', icon: Dumbbell, rank: 'E-Rank', minLvl: 10 },
    { label: 'Mental Trial', path: '/mental-lab', icon: Brain, rank: 'D-Rank', minLvl: 10 },
    { label: 'Social Gate', path: '/social-lab', icon: Users, rank: 'D-Rank', minLvl: 10 },
    { label: 'Knowledge Vault', path: '/knowledge-lab', icon: BookOpen, rank: 'C-Rank', minLvl: 15 },
    { label: 'Chess Trial', path: '/chess-lab', icon: Crown, rank: 'C-Rank', minLvl: 15 },
    { label: 'Skill Forge', path: '/skill-forge', icon: Target, rank: 'B-Rank', minLvl: 20 },
    { label: 'Kinnu Skill Tree', path: '/kinnu-lab', icon: TestTube, rank: 'D-Rank', minLvl: 10 },
  ];

  const rankColor = {
    E: 'text-gray-400 border-gray-600 bg-gray-950/60',
    D: 'text-green-400 border-green-500 bg-green-950/40',
    C: 'text-blue-400 border-blue-500 bg-blue-950/40',
    B: 'text-purple-400 border-purple-500 bg-purple-950/40',
    A: 'text-pink-400 border-pink-500 bg-pink-950/40',
    S: 'text-amber-300 border-amber-400 bg-amber-950/50 system-glow-text shadow-[0_0_15px_rgba(251,191,36,0.3)]',
  }[rank] || 'text-primary border-primary';

  return (
    <header className="sticky top-0 z-50 w-full bg-[#030712]/95 backdrop-blur-md border-b border-primary/30 shadow-[0_4px_25px_rgba(0,240,255,0.08)]">
      {/* Top Holographic Scan Glow Line */}
      <div className="h-[2px] w-full bg-gradient-to-r from-transparent via-[#00f0ff] to-transparent animate-pulse" />

      <div className="max-w-7xl mx-auto px-3 sm:px-6 py-2.5">
        <div className="flex items-center justify-between gap-2">
          
          {/* Brand / System Logo */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => navTo('/')}
              className="flex items-center gap-2.5 group text-left focus:outline-none"
            >
              <div className="relative flex items-center justify-center w-9 h-9 border border-primary/60 bg-primary/10 shadow-[0_0_12px_rgba(0,240,255,0.35)] group-hover:border-primary group-hover:shadow-[0_0_20px_rgba(0,240,255,0.7)] transition-all">
                <div className="absolute inset-0 border border-primary/30 rotate-45 scale-75 pointer-events-none" />
                <span className="font-display font-black text-primary text-base tracking-wider group-hover:scale-110 transition-transform">
                  S
                </span>
              </div>
              <div className="hidden sm:block">
                <div className="flex items-center gap-1.5">
                  <span className="font-display font-black text-white text-sm tracking-widest group-hover:text-primary transition-colors">
                    THE SYSTEM
                  </span>
                  <span className="text-[10px] px-1 py-0.2 bg-primary/20 text-primary border border-primary/40 font-mono tracking-tighter">
                    v2.4
                  </span>
                </div>
                <div className="text-[10px] font-mono text-muted-foreground flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping inline-block" />
                  HUNTER SYNC: ACTIVE
                </div>
              </div>
            </button>

            {/* Hunter Rank & Level Chip */}
            <div className="flex items-center gap-1.5 pl-2 border-l border-primary/20">
              <span className={`px-2 py-0.5 border text-xs font-display font-black tracking-wider ${rankColor}`}>
                {rank}-RANK
              </span>
              <div className="flex flex-col">
                <span className="text-xs font-display font-bold text-white tracking-wider">
                  LV.{profile.level}
                </span>
                <span className="text-[10px] text-primary/80 font-mono hidden md:inline truncate max-w-[110px]">
                  {job}
                </span>
              </div>
            </div>
          </div>

          {/* Center Mini HUD Vitals (Desktop) */}
          <div className="hidden lg:flex items-center gap-4 px-4 py-1.5 bg-[#060e22]/80 border border-primary/20 text-[11px] font-mono">
            {/* HP */}
            <div className="flex items-center gap-2">
              <span className="text-emerald-400 font-bold">HP</span>
              <div className="w-20 h-2 bg-black/60 border border-emerald-500/40 overflow-hidden">
                <div className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 w-full shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
              </div>
              <span className="text-emerald-300 text-[10px]">{vitals.hp.max}</span>
            </div>

            {/* MP */}
            <div className="flex items-center gap-2">
              <span className="text-cyan-400 font-bold">MP</span>
              <div className="w-20 h-2 bg-black/60 border border-cyan-500/40 overflow-hidden">
                <div className="h-full bg-gradient-to-r from-blue-500 to-cyan-400 w-full shadow-[0_0_8px_rgba(0,240,255,0.5)]" />
              </div>
              <span className="text-cyan-300 text-[10px]">{vitals.mp.max}</span>
            </div>

            {/* Fatigue */}
            <div className="flex items-center gap-1.5">
              <span className="text-amber-400 font-bold">FATIGUE</span>
              <span className={`px-1.5 py-0.2 border text-[10px] ${vitals.fatigue > 70 ? 'border-red-500 text-red-400 bg-red-950/50 animate-pulse' : 'border-amber-500/50 text-amber-300'}`}>
                {vitals.fatigue}%
              </span>
            </div>
          </div>

          {/* Navigation Links (Desktop) */}
          <nav className="hidden xl:flex items-center gap-1 text-xs font-display font-semibold tracking-wider">
            <button
              onClick={() => navTo('/')}
              className={`px-2.5 py-1.5 transition-all border ${location.pathname === '/' ? 'border-primary bg-primary/15 text-primary system-glow-text shadow-[0_0_10px_rgba(0,240,255,0.3)]' : 'border-transparent text-gray-300 hover:text-primary hover:border-primary/40'}`}
            >
              [ QUESTS ]
            </button>

            <button
              onClick={() => navTo('/profile')}
              className={`px-2.5 py-1.5 transition-all border ${location.pathname === '/profile' ? 'border-primary bg-primary/15 text-primary system-glow-text shadow-[0_0_10px_rgba(0,240,255,0.3)]' : 'border-transparent text-gray-300 hover:text-primary hover:border-primary/40'}`}
            >
              [ STATUS ]
            </button>

            {/* Dungeons Dropdown */}
            <div className="relative">
              <button
                onClick={() => setDungeonsOpen(!dungeonsOpen)}
                className={`px-2.5 py-1.5 flex items-center gap-1 transition-all border ${location.pathname.includes('-lab') || location.pathname === '/skill-forge' ? 'border-primary bg-primary/15 text-primary system-glow-text' : 'border-transparent text-gray-300 hover:text-primary hover:border-primary/40'}`}
              >
                [ DUNGEONS ]
                <ChevronDown className="w-3 h-3 text-primary" />
              </button>

              {dungeonsOpen && (
                <div className="absolute top-full right-0 mt-2 w-56 bg-[#040a18] border border-primary/50 shadow-[0_10px_30px_rgba(0,240,255,0.25)] p-1.5 z-50 tech-corners">
                  <div className="text-[10px] font-mono text-primary/70 px-2 py-1 border-b border-primary/20 mb-1">
                    INSTANCE GATES
                  </div>
                  {dungeons.map((d) => {
                    const Icon = d.icon;
                    const isLocked = profile.level < d.minLvl;
                    return (
                      <button
                        key={d.path}
                        disabled={isLocked}
                        onClick={() => navTo(d.path)}
                        className={`w-full flex items-center justify-between px-2 py-1.5 text-left text-xs transition-colors ${isLocked ? 'opacity-40 cursor-not-allowed text-gray-500' : 'hover:bg-primary/20 hover:text-white text-gray-300'}`}
                      >
                        <div className="flex items-center gap-2">
                          <Icon className="w-3.5 h-3.5 text-primary" />
                          <span>{d.label}</span>
                        </div>
                        <span className="text-[10px] font-mono text-primary/80">
                          {isLocked ? `Lv.${d.minLvl}` : d.rank}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <button
              onClick={() => navTo('/achievements')}
              className={`px-2.5 py-1.5 transition-all border ${location.pathname === '/achievements' || location.pathname === '/challenges' ? 'border-primary bg-primary/15 text-primary system-glow-text shadow-[0_0_10px_rgba(0,240,255,0.3)]' : 'border-transparent text-gray-300 hover:text-primary hover:border-primary/40'}`}
            >
              [ TITLES ]
            </button>

            <button
              onClick={() => navTo('/leaderboard')}
              className={`px-2.5 py-1.5 transition-all border ${location.pathname === '/leaderboard' ? 'border-primary bg-primary/15 text-primary system-glow-text shadow-[0_0_10px_rgba(0,240,255,0.3)]' : 'border-transparent text-gray-300 hover:text-primary hover:border-primary/40'}`}
            >
              [ RANKINGS ]
            </button>

            <button
              onClick={() => navTo('/calendar')}
              className={`px-2.5 py-1.5 transition-all border ${location.pathname === '/calendar' ? 'border-primary bg-primary/15 text-primary system-glow-text shadow-[0_0_10px_rgba(0,240,255,0.3)]' : 'border-transparent text-gray-300 hover:text-primary hover:border-primary/40'}`}
            >
              [ CALENDAR ]
            </button>
          </nav>

          {/* Quick Actions (Audio, AI Architect, Logout, Mobile Menu) */}
          <div className="flex items-center gap-1.5">
            {/* Audio Toggle */}
            <button
              onClick={toggleAudio}
              title={audioEnabled ? 'System Audio: Active' : 'System Audio: Muted'}
              className="p-1.5 border border-primary/40 bg-primary/10 text-primary hover:bg-primary/25 hover:border-primary transition-all"
            >
              {audioEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4 text-gray-500" />}
            </button>

            {/* AI Architect / System Assistant */}
            {onOpenAIChat && (
              <button
                onClick={() => {
                  systemSound.playSystemChime();
                  onOpenAIChat();
                }}
                className="px-2.5 py-1 flex items-center gap-1.5 border border-purple-500/70 bg-purple-950/40 text-purple-300 hover:bg-purple-900/60 hover:border-purple-400 hover:text-white shadow-[0_0_12px_rgba(168,85,247,0.3)] transition-all font-display text-xs font-bold"
              >
                <Sparkles className="w-3.5 h-3.5 text-purple-400 animate-pulse" />
                <span className="hidden sm:inline">ARCHITECT</span>
              </button>
            )}

            {/* Logout */}
            <button
              onClick={() => {
                systemSound.playClick();
                logout();
              }}
              title="Terminate Hunter Session"
              className="p-1.5 border border-red-500/40 bg-red-950/30 text-red-400 hover:bg-red-900/50 hover:border-red-500 transition-all"
            >
              <LogOut className="w-4 h-4" />
            </button>

            {/* Mobile Menu Toggle */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="xl:hidden p-1.5 border border-primary/40 bg-primary/10 text-primary hover:bg-primary/20"
            >
              {mobileMenuOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Mobile Navigation Drawer */}
        {mobileMenuOpen && (
          <div className="xl:hidden mt-3 pt-3 border-t border-primary/20 flex flex-col gap-2 pb-2">
            <div className="grid grid-cols-2 gap-2 text-xs font-display font-semibold">
              <button
                onClick={() => navTo('/')}
                className="p-2 text-left border border-primary/30 bg-primary/10 text-primary"
              >
                [ 01 DAILY QUESTS ]
              </button>
              <button
                onClick={() => navTo('/profile')}
                className="p-2 text-left border border-primary/30 bg-primary/10 text-primary"
              >
                [ 02 STATUS WINDOW ]
              </button>
              <button
                onClick={() => navTo('/daily-protocol')}
                className="p-2 text-left border border-primary/30 bg-primary/10 text-primary"
              >
                [ 03 QUEST PROTOCOL ]
              </button>
              <button
                onClick={() => navTo('/achievements')}
                className="p-2 text-left border border-primary/30 bg-primary/10 text-primary"
              >
                [ 04 TITLES & BADGES ]
              </button>
              <button
                onClick={() => navTo('/leaderboard')}
                className="p-2 text-left border border-primary/30 bg-primary/10 text-primary"
              >
                [ 05 RANKINGS ]
              </button>
              <button
                onClick={() => navTo('/calendar')}
                className="p-2 text-left border border-primary/30 bg-primary/10 text-primary"
              >
                [ 06 CALENDAR ]
              </button>
            </div>

            <div className="text-[10px] font-mono text-primary/70 mt-2 px-1">
              INSTANCE GATES:
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
              {dungeons.map((d) => {
                const Icon = d.icon;
                const isLocked = profile.level < d.minLvl;
                return (
                  <button
                    key={d.path}
                    disabled={isLocked}
                    onClick={() => navTo(d.path)}
                    className={`flex items-center gap-1.5 p-2 text-xs border ${isLocked ? 'border-gray-800 text-gray-600 bg-black/40' : 'border-primary/40 bg-[#060e22] text-gray-200 hover:text-primary hover:border-primary'}`}
                  >
                    <Icon className="w-3 h-3 text-primary" />
                    <span className="truncate">{d.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </header>
  );
};
