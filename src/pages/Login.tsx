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
    <div className="min-h-screen bg-[#070d18] flex items-center justify-center p-4">
      {/* 1. NOTIFICATION MODAL SCREEN (Exact match to screenshot 5) */}
      {screen === 'notification' && (
        <div className="anime-window anime-double-frame p-8 sm:p-10 max-w-md w-full text-center relative">
          <div className="border border-cyan-400/30 p-6 space-y-5">
            {/* Notification Title Header */}
            <div className="inline-flex items-center gap-2 px-6 py-1.5 border border-cyan-400/40 bg-black/40">
              <div className="w-4 h-4 rounded-full border border-cyan-300 flex items-center justify-center text-cyan-300 text-xs font-bold">
                !
              </div>
              <h2 className="font-display font-bold text-base sm:text-lg text-white anime-glow-text tracking-widest">
                NOTIFICATION
              </h2>
            </div>

            {/* Notification Body Text */}
            <div className="font-mono text-xs sm:text-sm text-gray-300 space-y-2 py-2">
              <div>You are qualified to be a <span className="font-bold text-white">Player</span></div>
              <div>
                Your heart will stop in{' '}
                <span className="text-red-500 font-bold">0:0{countdown} seconds</span>
              </div>
              <div>If you choose not to accept</div>
              <div className="font-bold text-white pt-1">Will you accept?</div>
            </div>

            {/* Yes / No Buttons (Exact anime style) */}
            <div className="flex items-center justify-center gap-6 pt-3">
              <button
                onClick={handleAcceptPlayer}
                disabled={loading}
                className="w-24 py-1.5 border border-cyan-400/60 bg-black/60 hover:bg-cyan-400 hover:text-black text-white font-mono text-xs font-bold transition-all shadow-[0_0_10px_rgba(82,210,246,0.2)]"
              >
                {loading ? '...' : 'Yes'}
              </button>
              <button
                onClick={handleDecline}
                className="w-24 py-1.5 border border-gray-700 bg-black/60 hover:border-gray-500 text-gray-400 hover:text-white font-mono text-xs transition-colors"
              >
                No
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 2. ENTER THE DUNGEON SCREEN (Exact match to screenshot 1) */}
      {screen === 'dungeon-key' && (
        <div className="anime-window p-8 max-w-sm w-full text-center relative space-y-6">
          <h2 className="font-display font-bold text-xl sm:text-2xl text-white anime-glow-text tracking-wider">
            Enter The Dungeon
          </h2>

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
                className="w-full bg-[#0e1929] border border-cyan-500/40 px-4 py-2.5 text-center text-white font-mono text-sm placeholder:text-gray-500 focus:border-cyan-400 outline-none"
                autoFocus
              />
            </div>

            {error && (
              <div className="text-red-400 font-mono text-xs">{error}</div>
            )}

            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setScreen('notification')}
                className="px-4 py-2 border border-gray-800 text-gray-400 font-mono text-xs hover:text-white"
              >
                Back
              </button>
              <button
                onClick={handleKeySubmit}
                disabled={loading || !keyInput.trim()}
                className="flex-1 py-2 bg-cyan-400/20 border border-cyan-400 hover:bg-cyan-400 hover:text-black text-cyan-300 font-mono text-xs font-bold transition-all disabled:opacity-40"
              >
                {loading ? 'Verifying...' : 'Unlock Dungeon'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 3. NAME ENTRY SCREEN */}
      {screen === 'name-entry' && (
        <div className="anime-window p-8 max-w-sm w-full text-center relative space-y-5">
          <div className="font-display font-bold text-lg text-white anime-glow-text">
            [ PLAYER REGISTRATION ]
          </div>
          <div className="text-xs font-mono text-gray-400">
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
            className="w-full bg-[#0e1929] border border-cyan-500/40 px-3 py-2 text-center text-white font-mono text-base focus:border-cyan-400 outline-none"
            autoFocus
          />

          <button
            onClick={handleNameSubmit}
            disabled={!nameInput.trim()}
            className="w-full py-2.5 bg-cyan-400 text-black font-mono text-xs font-bold hover:bg-cyan-300 transition-all disabled:opacity-40"
          >
            CONFIRM & ENTER
          </button>
        </div>
      )}
    </div>
  );
};

export default Login;
