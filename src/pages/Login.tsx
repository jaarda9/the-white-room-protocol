import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getUserProfile, saveUserProfile } from '@/lib/storage';
import {
  SESSION_SUBJECT_KEY,
  initializeNewSubject,
  loginWithSubjectId,
} from '@/lib/subject-auth';
import { systemSound } from '@/lib/system-sound';
import { Sparkles, Key, UserPlus, ArrowLeft, ShieldAlert, Check } from 'lucide-react';

type Phase = 'menu' | 'login' | 'initializing' | 'briefing' | 'name-entry';

const Login = () => {
  const navigate = useNavigate();
  const [phase, setPhase] = useState<Phase>('menu');
  const [inputId, setInputId] = useState('');
  const [newSubjectId, setNewSubjectId] = useState('');
  const [fullName, setFullName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!inputId.trim()) return;
    systemSound.playClick();
    setLoading(true);
    setError('');
    const { error } = await loginWithSubjectId(inputId);
    if (error) {
      systemSound.playPenaltyWarning();
      setError(error);
      setLoading(false);
    } else {
      systemSound.playLevelUp();
      navigate('/');
    }
  };

  const handleInitialize = async () => {
    systemSound.playSystemChime();
    setPhase('initializing');
    setError('');
    const { subjectId, error } = await initializeNewSubject();
    if (error) {
      systemSound.playPenaltyWarning();
      setError(error);
      setPhase('menu');
    } else {
      setNewSubjectId(subjectId);
      setPhase('briefing');
    }
  };

  const handleBriefingConfirm = () => {
    systemSound.playClick();
    setPhase('name-entry');
  };

  const handleNameSubmit = async () => {
    if (!fullName.trim()) return;
    systemSound.playLevelUp();
    setLoading(true);
    const profile = getUserProfile();
    profile.fullName = fullName.trim();
    profile.displayName = fullName.trim();
    saveUserProfile(profile);

    if (newSubjectId) {
      localStorage.setItem(SESSION_SUBJECT_KEY, newSubjectId);
    }

    try {
      const { syncManager } = await import('@/lib/sync-manager');
      await syncManager.forceSaveUserData();
    } catch (e) {
      console.error('[Login] Failed to sync fullName:', e);
    }

    window.location.href = '/';
  };

  return (
    <div className="min-h-screen bg-[#030712] flex items-center justify-center p-4 scanlines">
      <div className="w-full max-w-lg space-y-6">
        
        {/* Holographic Header Window */}
        <div className="system-window tech-corners p-6 sm:p-8 text-center relative overflow-hidden shadow-[0_0_30px_rgba(0,240,255,0.2)]">
          <div className="inline-flex items-center justify-center p-3 border border-primary/50 bg-primary/10 mb-3 animate-system-pulse">
            <Sparkles className="w-8 h-8 text-primary system-glow-text" />
          </div>

          <div className="text-[10px] font-mono text-primary/80 tracking-widest uppercase mb-1">
            HUNTER ASSOCIATION // SYSTEM TERMINAL
          </div>

          <h1 className="text-2xl sm:text-3xl font-display font-black text-white tracking-widest system-glow-text">
            [ SYSTEM AWAKENING ]
          </h1>
          <p className="text-xs font-tech text-gray-400 mt-2">
            &quot;You have met the requirements to become a Player. Will you accept?&quot;
          </p>
        </div>

        {/* Dynamic Phases */}
        <div className="system-window tech-corners p-6 sm:p-8">
          {/* Menu Phase */}
          {phase === 'menu' && (
            <div className="space-y-4">
              <div className="text-xs font-mono text-primary/80 mb-2">
                &gt; SELECT HUNTER AUTHENTICATION PROTOCOL:
              </div>

              <button
                onClick={() => {
                  systemSound.playClick();
                  setPhase('login');
                }}
                className="system-btn w-full p-4 text-left flex items-center justify-between group"
              >
                <div>
                  <div className="font-display font-bold text-sm text-white group-hover:text-primary">
                    [1] RETURNING HUNTER — ENTER ID
                  </div>
                  <div className="text-xs font-mono text-gray-400 mt-0.5">
                    Resume active player dossier & credentials
                  </div>
                </div>
                <Key className="w-4 h-4 text-primary shrink-0" />
              </button>

              <button
                onClick={handleInitialize}
                className="system-btn-monarch w-full p-4 text-left flex items-center justify-between group text-amber-300"
              >
                <div>
                  <div className="font-display font-bold text-sm text-amber-300 group-hover:text-amber-200">
                    [2] AWAKEN AS NEW PLAYER
                  </div>
                  <div className="text-xs font-mono text-amber-400/80 mt-0.5">
                    Generate new hunter ID & initiate leveling protocol
                  </div>
                </div>
                <UserPlus className="w-4 h-4 text-amber-400 shrink-0" />
              </button>
            </div>
          )}

          {/* Login Phase */}
          {phase === 'login' && (
            <div className="space-y-4">
              <div className="text-xs font-mono text-primary/80">
                &gt; ENTER YOUR HUNTER IDENTIFIER:
              </div>

              <div className="flex items-center gap-2">
                <span className="font-mono text-primary font-bold text-sm">HUNTER-</span>
                <input
                  type="text"
                  value={inputId}
                  onChange={(e) => setInputId(e.target.value.toUpperCase().slice(0, 8))}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleLogin();
                  }}
                  placeholder="XXXX"
                  className="flex-1 bg-black/80 border border-primary/50 px-3 py-2 text-white font-mono font-bold tracking-widest text-lg focus:border-primary outline-none"
                  autoFocus
                />
              </div>

              {error && (
                <div className="p-2.5 bg-red-950/40 border border-red-500/50 text-red-400 font-mono text-xs">
                  {error}
                </div>
              )}

              <div className="flex gap-2 pt-2">
                <button
                  onClick={() => {
                    systemSound.playClick();
                    setPhase('menu');
                  }}
                  className="px-4 py-2 border border-gray-700 text-gray-400 font-mono text-xs hover:border-gray-500 hover:text-white"
                >
                  <ArrowLeft className="w-4 h-4" />
                </button>
                <button
                  onClick={handleLogin}
                  disabled={loading || !inputId.trim()}
                  className="system-btn flex-1 py-2 text-xs font-bold disabled:opacity-40"
                >
                  {loading ? '[ VERIFYING... ]' : '[ ACCESS SYSTEM ]'}
                </button>
              </div>
            </div>
          )}

          {/* Initializing Phase */}
          {phase === 'initializing' && (
            <div className="py-8 text-center space-y-3 font-mono">
              <div className="w-10 h-10 border-2 border-primary border-t-transparent animate-spin mx-auto" />
              <div className="text-sm font-bold text-primary system-glow-text">
                [ COMMENCING HUNTER RE-AWAKENING... ]
              </div>
              <div className="text-xs text-gray-400">
                Allocating spiritual mana cores and configuring player HUD...
              </div>
            </div>
          )}

          {/* Briefing Phase */}
          {phase === 'briefing' && (
            <div className="space-y-4 font-mono text-xs">
              <div className="p-3 bg-primary/10 border border-primary/40 text-primary">
                <div className="font-bold text-sm font-display mb-1">[ SYSTEM DIRECTIVE ASSIGNED ]</div>
                <div>YOUR HUNTER IDENTIFIER IS:</div>
                <div className="text-lg font-bold font-mono text-white tracking-wider my-1">
                  HUNTER-{newSubjectId}
                </div>
                <div className="text-[10px] text-gray-400">
                  Save this identifier to access your player stats on any device.
                </div>
              </div>

              <div className="p-3 bg-black/50 border border-gray-800 text-gray-300 space-y-1">
                <div>• Complete assigned daily protocols to level up.</div>
                <div>• Allocate earned AP points into STR, AGI, INT, VIT, PER.</div>
                <div>• Failure to complete daily quests triggers the Penalty Zone.</div>
              </div>

              <button
                onClick={handleBriefingConfirm}
                className="system-btn w-full py-3 text-xs font-bold text-primary"
              >
                [ ACCEPT CONTRACT & PROCEED ]
              </button>
            </div>
          )}

          {/* Name Entry Phase */}
          {phase === 'name-entry' && (
            <div className="space-y-4">
              <div className="text-xs font-mono text-primary/80">
                &gt; ENTER YOUR HUNTER NAME:
              </div>

              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleNameSubmit();
                }}
                placeholder="e.g. Sung Jin-woo"
                className="w-full bg-black/80 border border-primary/50 px-3 py-2.5 text-white font-mono text-base focus:border-primary outline-none"
                autoFocus
              />

              <button
                onClick={handleNameSubmit}
                disabled={loading || !fullName.trim()}
                className="system-btn-monarch w-full py-3 text-xs font-bold text-amber-300 disabled:opacity-40"
              >
                {loading ? '[ SYNCHRONIZING... ]' : '[ INITIALIZE PLAYER STATUS ]'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Login;
