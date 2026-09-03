import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getUserProfile, saveUserProfile } from '@/lib/storage';
import {
  SESSION_SUBJECT_KEY,
  initializeNewSubject,
  loginWithSubjectId,
} from '@/lib/subject-auth';
import { systemSound } from '@/lib/system-sound';
import { Key } from 'lucide-react';

type Screen = 'notification' | 'dungeon-key' | 'name-entry';

const Login = () => {
  const navigate = useNavigate();
  const [screen, setScreen] = useState<Screen>('notification');
  const [keyInput, setKeyInput] = useState('');
  const [nameInput, setNameInput] = useState('');
  const [newSubjectId, setNewSubjectId] = useState('');
  const [countdown, setCountdown] = useState(2);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Countdown timer on notification modal like screenshot: "Your heart will stop in 0:02 seconds"
  useEffect(() => {
    if (screen !== 'notification') return;
    const interval = setInterval(() => {
      setCountdown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(interval);
  }, [screen]);

  const handleAcceptPlayer = async () => {
    systemSound.playSystemChime();
    setLoading(true);
    const { subjectId, error } = await initializeNewSubject();
    setLoading(false);
    if (!error && subjectId) {
      setNewSubjectId(subjectId);
      setScreen('name-entry');
    } else {
      setScreen('name-entry');
    }
  };

  const handleDecline = () => {
    systemSound.playPenaltyWarning();
    setScreen('dungeon-key');
  };

  const handleKeySubmit = async () => {
    if (!keyInput.trim()) return;
    systemSound.playClick();
    setLoading(true);
    setError('');
    const { error } = await loginWithSubjectId(keyInput.trim());
    setLoading(false);
    if (error) {
      systemSound.playPenaltyWarning();
      setError(error);
    } else {
      systemSound.playLevelUp();
      navigate('/');
    }
  };

  const handleNameSubmit = async () => {
    if (!nameInput.trim()) return;
    systemSound.playLevelUp();
    const profile = getUserProfile();
    profile.fullName = nameInput.trim();
    profile.displayName = nameInput.trim();
    saveUserProfile(profile);

    if (newSubjectId) {
      localStorage.setItem(SESSION_SUBJECT_KEY, newSubjectId);
    }

    window.location.href = '/';
  };

  return (
    <div className="min-h-screen bg-[#071322] flex items-center justify-center p-4 system-blueprint-bg font-mono">
      {/* 1. NOTIFICATION MODAL SCREEN */}
      {screen === 'notification' && (
        <div className="relative bg-[#0a1b2e]/90 border-2 border-white/50 rounded-[4px] p-6 sm:p-8 max-w-md w-full text-center text-white shadow-[0_0_30px_rgba(0,0,0,0.85),inset_0_0_24px_rgba(0,212,255,0.08)] backdrop-blur-md anime-dropdown">
          <div className="border border-white/30 p-6 space-y-5 rounded-[2px] bg-[#061426]/60">
            {/* Notification Title Header */}
            <div className="inline-flex items-center gap-2 px-6 py-1.5 border border-white/60 bg-[#061426]/80 shadow-[0_0_12px_rgba(0,212,255,0.3)]">
              <div className="w-4 h-4 rounded-full border border-[#9fd3ff] flex items-center justify-center text-[#9fd3ff] text-xs font-bold">
                !
              </div>
              <h2 className="font-mono font-bold text-base sm:text-lg text-white anime-glow-text tracking-widest">
                NOTIFICATION
              </h2>
            </div>

            {/* Notification Body Text */}
            <div className="font-mono text-xs sm:text-sm text-gray-200 space-y-2 py-2">
              <div>You are qualified to be a <span className="font-bold text-[#9fd3ff]">Player</span></div>
              <div>
                Your heart will stop in{' '}
                <span className="text-rose-400 font-bold">0:0{countdown} seconds</span>
              </div>
              <div>If you choose not to accept</div>
              <div className="font-bold text-white pt-1">Will you accept?</div>
            </div>

            {/* Yes / No Buttons */}
            <div className="flex items-center justify-center gap-6 pt-3 font-mono">
              <button
                onClick={handleAcceptPlayer}
                disabled={loading}
                className="w-24 py-1.5 border border-white bg-white text-black hover:bg-gray-200 text-xs font-bold transition-all shadow-[0_0_12px_rgba(0,212,255,0.3)] rounded-[2px]"
              >
                {loading ? '...' : 'Yes'}
              </button>
              <button
                onClick={handleDecline}
                className="w-24 py-1.5 border border-white/30 bg-[#061426]/80 hover:border-white text-gray-300 hover:text-white text-xs transition-colors rounded-[2px]"
              >
                No
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 2. ENTER THE DUNGEON SCREEN */}
      {screen === 'dungeon-key' && (
        <div className="relative bg-[#0a1b2e]/90 border-2 border-white/50 rounded-[4px] p-8 max-w-sm w-full text-center text-white shadow-[0_0_30px_rgba(0,0,0,0.85),inset_0_0_24px_rgba(0,212,255,0.08)] backdrop-blur-md space-y-6 anime-dropdown">
          <div className="inline-block px-6 py-1 border border-white/70 bg-[#061426]/60 shadow-[0_0_14px_rgba(0,212,255,0.35)]">
            <h2 className="font-mono font-bold text-lg sm:text-xl text-white anime-glow-text tracking-wider">
              Enter The Dungeon
            </h2>
          </div>

          <div className="space-y-4">
            <div className="relative">
              <input
                type="text"
                value={keyInput}
                onChange={(e) => setKeyInput(e.target.value.toUpperCase())}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleKeySubmit();
                }}
                placeholder="Place Your Key 🗝️"
                className="w-full bg-[#061426] border border-white/30 px-4 py-2.5 text-center text-white font-mono text-sm placeholder:text-gray-400 focus:border-white outline-none rounded-[2px]"
                autoFocus
              />
            </div>

            {error && (
              <div className="text-rose-400 font-mono text-xs">{error}</div>
            )}

            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setScreen('notification')}
                className="px-4 py-2 border border-white/30 bg-[#061426] text-gray-300 font-mono text-xs hover:text-white hover:border-white rounded-[2px]"
              >
                Back
              </button>
              <button
                onClick={handleKeySubmit}
                disabled={loading || !keyInput.trim()}
                className="flex-1 py-2 bg-white text-black hover:bg-gray-200 font-mono text-xs font-bold transition-all disabled:opacity-40 rounded-[2px] shadow-[0_0_10px_rgba(0,212,255,0.25)]"
              >
                {loading ? 'Verifying...' : 'Unlock Dungeon'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 3. NAME ENTRY SCREEN */}
      {screen === 'name-entry' && (
        <div className="relative bg-[#0a1b2e]/90 border-2 border-white/50 rounded-[4px] p-8 max-w-sm w-full text-center text-white shadow-[0_0_30px_rgba(0,0,0,0.85),inset_0_0_24px_rgba(0,212,255,0.08)] backdrop-blur-md space-y-5 anime-dropdown">
          <div className="inline-block px-6 py-1 border border-white/70 bg-[#061426]/60 shadow-[0_0_14px_rgba(0,212,255,0.35)]">
            <div className="font-mono font-bold text-base sm:text-lg text-white anime-glow-text tracking-wider">
              [ PLAYER REGISTRATION ]
            </div>
          </div>
          <div className="text-xs font-mono text-gray-300">
            Enter your Hunter name to register your status dossier:
          </div>

          <input
            type="text"
            value={nameInput}
            onChange={(e) => setNameInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleNameSubmit();
            }}
            placeholder="e.g. Sung Jin-woo"
            className="w-full bg-[#061426] border border-white/30 px-3 py-2 text-center text-white font-mono text-base focus:border-white outline-none rounded-[2px]"
            autoFocus
          />

          <button
            onClick={handleNameSubmit}
            disabled={!nameInput.trim()}
            className="w-full py-2.5 bg-white text-black font-mono text-xs font-bold hover:bg-gray-200 transition-all disabled:opacity-40 rounded-[2px] shadow-[0_0_10px_rgba(0,212,255,0.25)]"
          >
            CONFIRM & ENTER
          </button>
        </div>
      )}
    </div>
  );
};

export default Login;
