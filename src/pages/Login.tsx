import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getUserProfile, saveUserProfile } from '@/lib/storage';
import {
  SESSION_SUBJECT_KEY,
  initializeNewSubject,
  loginWithSubjectId,
} from '@/lib/subject-auth';
import { syncManager } from '@/lib/sync-manager';
import { systemSound } from '@/lib/system-sound';
import { Key, UserPlus, ArrowLeft, Copy, Check, ShieldAlert, Sparkles } from 'lucide-react';

type Screen = 'choose-role' | 'returning-login' | 'new-notification' | 'new-memorize' | 'new-name';

const Login = () => {
  const navigate = useNavigate();
  const [screen, setScreen] = useState<Screen>('choose-role');
  const [keyInput, setKeyInput] = useState('');
  const [nameInput, setNameInput] = useState('');
  const [newSubjectId, setNewSubjectId] = useState('');
  const [copied, setCopied] = useState(false);
  const [memorizedChecked, setMemorizedChecked] = useState(false);
  const [countdown, setCountdown] = useState(2);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Countdown timer on notification modal like Solo Leveling: "Your heart will stop in 0:02 seconds"
  useEffect(() => {
    if (screen !== 'new-notification') return;
    setCountdown(2);
    const interval = setInterval(() => {
      setCountdown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(interval);
  }, [screen]);

  // Handle Returning Subject Login
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
      window.dispatchEvent(new Event('wrp:profile-updated'));
      navigate('/');
    }
  };

  // Handle Accepting to become a New Player
  const handleAcceptPlayer = async () => {
    systemSound.playSystemChime();
    setLoading(true);
    setError('');
    const { subjectId, error } = await initializeNewSubject();
    setLoading(false);
    if (error || !subjectId) {
      setError(error || 'Failed to initialize subject. Please retry.');
      return;
    }
    setNewSubjectId(subjectId);
    setMemorizedChecked(false);
    setScreen('new-memorize');
  };

  // Handle Declining the New Player quest
  const handleDecline = () => {
    systemSound.playPenaltyWarning();
    setScreen('choose-role');
  };

  // Copy newly assigned Subject ID
  const handleCopyId = () => {
    if (!newSubjectId) return;
    navigator.clipboard.writeText(newSubjectId);
    setCopied(true);
    systemSound.playClick();
    setTimeout(() => setCopied(false), 2500);
  };

  // Proceed from memorizing to first-time login
  const handleProceedToFirstLogin = () => {
    systemSound.playClick();
    setScreen('new-name');
  };

  // Handle Hunter Name Submission (asked only once for first-time registration)
  const handleNameSubmit = async () => {
    if (!nameInput.trim()) return;
    systemSound.playLevelUp();
    setLoading(true);

    const enteredName = nameInput.trim();
    const profile = getUserProfile();
    profile.id = newSubjectId;
    profile.pseudo = `SUBJECT-${newSubjectId}`;
    profile.fullName = enteredName;
    profile.displayName = enteredName;
    saveUserProfile(profile);

    try {
      const gdRaw = localStorage.getItem('gameData');
      if (gdRaw) {
        const gd = JSON.parse(gdRaw);
        gd.name = enteredName;
        localStorage.setItem('gameData', JSON.stringify(gd));
      }
    } catch {
      // ignore
    }

    if (newSubjectId) {
      localStorage.setItem(SESSION_SUBJECT_KEY, newSubjectId);
    }

    // Force sync with MongoDB so name and profile are saved permanently
    try {
      await syncManager.forceSaveUserData();
    } catch (e) {
      console.warn('Initial sync warning:', e);
    }

    window.dispatchEvent(new Event('wrp:profile-updated'));
    window.location.href = '/';
  };

  return (
    <div className="min-h-screen bg-[#071322] flex items-center justify-center px-4 pt-6 pb-28 system-blueprint-bg font-mono">
      {/* 1. INITIAL CHOICE SCREEN: RETURNING SUBJECT OR NEW SUBJECT */}
      {screen === 'choose-role' && (
        <div className="relative bg-[#0a1b2e]/95 border-2 border-white/50 rounded-[4px] p-6 sm:p-8 max-w-md w-full text-center text-white shadow-[0_0_35px_rgba(0,0,0,0.85),inset_0_0_24px_rgba(0,212,255,0.1)] backdrop-blur-md anime-dropdown space-y-6">
          <div className="border border-white/30 p-5 space-y-4 rounded-[2px] bg-[#061426]/70">
            {/* Header Badge */}
            <div className="inline-flex items-center gap-2 px-5 py-1.5 border border-white/60 bg-[#061426]/90 shadow-[0_0_12px_rgba(0,212,255,0.3)]">
              <span className="w-2.5 h-2.5 rounded-full bg-[#00d4ff] animate-pulse" />
              <h2 className="font-mono font-bold text-sm sm:text-base text-white anime-glow-text tracking-widest">
                SYSTEM ACCESS GATEWAY
              </h2>
            </div>

            <div className="font-mono text-xs text-gray-300">
              IDENTIFY YOUR STATUS IN THE MONARCH PROTOCOL
            </div>

            <div className="pt-2 space-y-3">
              {/* Option A: Returning Subject */}
              <button
                onClick={() => {
                  systemSound.playClick();
                  setError('');
                  setScreen('returning-login');
                }}
                className="w-full text-left p-4 border border-white/40 hover:border-white bg-[#061426]/90 hover:bg-[#0c243d] transition-all rounded-[2px] group shadow-[0_0_15px_rgba(0,0,0,0.5)]"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 border border-white/40 bg-black/40 flex items-center justify-center text-[#9fd3ff] group-hover:border-white group-hover:text-white transition-colors">
                    <Key className="w-5 h-5" />
                  </div>
                  <div className="flex-1">
                    <div className="font-bold text-sm text-white group-hover:text-[#9fd3ff] transition-colors flex items-center justify-between">
                      <span>RETURNING SUBJECT</span>
                      <span className="text-[10px] text-gray-400 group-hover:text-gray-200">ACCESS &gt;</span>
                    </div>
                    <div className="text-[11px] text-gray-400 group-hover:text-gray-300 pt-0.5">
                      I have an existing Subject ID to resume my progress
                    </div>
                  </div>
                </div>
              </button>

              {/* Option B: New Subject */}
              <button
                onClick={() => {
                  systemSound.playClick();
                  setError('');
                  setScreen('new-notification');
                }}
                className="w-full text-left p-4 border border-[#00d4ff]/50 hover:border-[#00d4ff] bg-[#061426]/90 hover:bg-[#082038] transition-all rounded-[2px] group shadow-[0_0_15px_rgba(0,212,255,0.15)]"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 border border-[#00d4ff]/60 bg-[#00d4ff]/10 flex items-center justify-center text-[#00d4ff] group-hover:bg-[#00d4ff]/20 transition-colors">
                    <UserPlus className="w-5 h-5" />
                  </div>
                  <div className="flex-1">
                    <div className="font-bold text-sm text-white group-hover:text-[#00d4ff] transition-colors flex items-center justify-between">
                      <span>NEW SUBJECT</span>
                      <span className="text-[10px] text-[#00d4ff] group-hover:text-white">AWAKEN &gt;</span>
                    </div>
                    <div className="text-[11px] text-gray-400 group-hover:text-gray-300 pt-0.5">
                      Awaken as a new player and generate a new Subject ID
                    </div>
                  </div>
                </div>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 2. RETURNING SUBJECT: ENTER SUBJECT ID */}
      {screen === 'returning-login' && (
        <div className="relative bg-[#0a1b2e]/95 border-2 border-white/50 rounded-[4px] p-6 sm:p-8 max-w-sm w-full text-center text-white shadow-[0_0_35px_rgba(0,0,0,0.85),inset_0_0_24px_rgba(0,212,255,0.1)] backdrop-blur-md space-y-5 anime-dropdown">
          <div className="inline-block px-6 py-1.5 border border-white/70 bg-[#061426]/70 shadow-[0_0_14px_rgba(0,212,255,0.35)]">
            <h2 className="font-mono font-bold text-base sm:text-lg text-white anime-glow-text tracking-wider">
              ENTER THE DUNGEON
            </h2>
          </div>

          <div className="text-xs text-gray-300 space-y-1">
            <p className="text-gray-400">Provide your 6-character Subject ID to synchronize your status dossier:</p>
          </div>

          <div className="space-y-4 pt-1">
            <div className="relative">
              <input
                type="text"
                value={keyInput}
                onChange={(e) => setKeyInput(e.target.value.toUpperCase())}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleKeySubmit();
                }}
                placeholder="PLACE YOUR KEY 🗝️ (e.g. M4HNZZ)"
                className="w-full bg-[#061426] border border-white/40 px-4 py-2.5 text-center text-white font-mono text-sm tracking-widest placeholder:text-gray-500 placeholder:tracking-normal focus:border-[#00d4ff] outline-none rounded-[2px]"
                autoFocus
              />
            </div>

            {error && (
              <div className="text-rose-400 font-mono text-xs bg-rose-950/40 border border-rose-500/40 p-2 rounded-[2px]">
                {error}
              </div>
            )}

            <div className="flex gap-2 pt-2">
              <button
                onClick={() => {
                  systemSound.playClick();
                  setError('');
                  setScreen('choose-role');
                }}
                className="px-4 py-2 border border-white/30 bg-[#061426] text-gray-300 font-mono text-xs hover:text-white hover:border-white transition-colors rounded-[2px] flex items-center gap-1.5"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                Back
              </button>
              <button
                onClick={handleKeySubmit}
                disabled={loading || !keyInput.trim()}
                className="flex-1 py-2 bg-white text-black hover:bg-gray-200 font-mono text-xs font-bold transition-all disabled:opacity-40 rounded-[2px] shadow-[0_0_12px_rgba(0,212,255,0.3)]"
              >
                {loading ? 'Verifying...' : 'Unlock & Enter'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 3. NEW PLAYER: NOTIFICATION & AWAKENING CHALLENGE */}
      {screen === 'new-notification' && (
        <div className="relative bg-[#0a1b2e]/95 border-2 border-white/50 rounded-[4px] p-6 sm:p-8 max-w-md w-full text-center text-white shadow-[0_0_35px_rgba(0,0,0,0.85),inset_0_0_24px_rgba(0,212,255,0.1)] backdrop-blur-md anime-dropdown">
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

            {error && (
              <div className="text-rose-400 font-mono text-xs bg-rose-950/40 border border-rose-500/40 p-2 rounded-[2px]">
                {error}
              </div>
            )}

            {/* Yes / No Buttons */}
            <div className="flex items-center justify-center gap-6 pt-3 font-mono">
              <button
                onClick={handleAcceptPlayer}
                disabled={loading}
                className="w-28 py-2 border border-white bg-white text-black hover:bg-gray-200 text-xs font-bold transition-all shadow-[0_0_15px_rgba(0,212,255,0.4)] rounded-[2px]"
              >
                {loading ? 'GENERATING...' : 'Yes'}
              </button>
              <button
                onClick={handleDecline}
                className="w-28 py-2 border border-white/30 bg-[#061426]/80 hover:border-white text-gray-300 hover:text-white text-xs transition-colors rounded-[2px]"
              >
                No
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 4. NEW PLAYER: SUBJECT ID ASSIGNED & MEMORIZATION STAGE */}
      {screen === 'new-memorize' && (
        <div className="relative bg-[#0a1b2e]/95 border-2 border-white/50 rounded-[4px] p-6 sm:p-8 max-w-md w-full text-center text-white shadow-[0_0_35px_rgba(0,0,0,0.85),inset_0_0_24px_rgba(0,212,255,0.1)] backdrop-blur-md space-y-5 anime-dropdown">
          <div className="inline-block px-5 py-1.5 border border-white/70 bg-[#061426]/70 shadow-[0_0_14px_rgba(0,212,255,0.35)]">
            <div className="font-mono font-bold text-sm sm:text-base text-white anime-glow-text tracking-wider flex items-center justify-center gap-2">
              <Sparkles className="w-4 h-4 text-[#00d4ff]" />
              <span>[ SYSTEM ID ASSIGNED ]</span>
            </div>
          </div>

          <div className="text-xs text-gray-300">
            A unique hunter key has been registered in the system:
          </div>

          {/* Large Monospace Subject ID Display */}
          <div className="border-2 border-[#00d4ff] bg-[#04101e] p-4 rounded-[3px] shadow-[0_0_25px_rgba(0,212,255,0.25)] space-y-3">
            <div className="text-[10px] text-gray-400 uppercase tracking-widest">
              YOUR PERMANENT SUBJECT ID
            </div>
            <div className="text-2xl sm:text-3xl font-bold tracking-[0.35em] text-[#00d4ff] font-mono select-all pl-2">
              {newSubjectId}
            </div>

            <button
              onClick={handleCopyId}
              className="inline-flex items-center gap-2 px-3 py-1.5 border border-[#00d4ff]/40 hover:border-[#00d4ff] bg-[#061c33] text-xs text-[#9fd3ff] hover:text-white transition-colors rounded-[2px]"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-emerald-400 font-bold">COPIED TO CLIPBOARD</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>COPY SUBJECT ID</span>
                </>
              )}
            </button>
          </div>

          {/* Memorize Warning Box */}
          <div className="border border-amber-500/50 bg-amber-950/20 p-3.5 rounded-[2px] text-left text-xs space-y-1.5">
            <div className="text-amber-400 font-bold flex items-center gap-1.5">
              <ShieldAlert className="w-4 h-4 flex-shrink-0" />
              <span>CRITICAL: MEMORIZE YOUR SUBJECT ID</span>
            </div>
            <p className="text-gray-300 text-[11px] leading-relaxed">
              Write down or save this code. You will need this Subject ID to log back into your account, switch users, or access your character from any device.
            </p>
          </div>

          {/* Memorized Confirmation Checkbox */}
          <label className="flex items-center justify-center gap-2 text-xs text-gray-200 cursor-pointer select-none pt-1">
            <input
              type="checkbox"
              checked={memorizedChecked}
              onChange={(e) => setMemorizedChecked(e.target.checked)}
              className="accent-[#00d4ff] w-4 h-4 rounded"
            />
            <span>I have memorized and saved my Subject ID</span>
          </label>

          {/* Proceed to Login */}
          <button
            onClick={handleProceedToFirstLogin}
            disabled={!memorizedChecked}
            className="w-full py-2.5 bg-white text-black font-mono text-xs font-bold hover:bg-gray-200 transition-all disabled:opacity-40 disabled:hover:bg-white rounded-[2px] shadow-[0_0_15px_rgba(0,212,255,0.3)]"
          >
            LOG IN AS NEW SUBJECT &gt;
          </button>
        </div>
      )}

      {/* 5. FIRST TIME REGISTRATION: ENTER HUNTER NAME */}
      {screen === 'new-name' && (
        <div className="relative bg-[#0a1b2e]/95 border-2 border-white/50 rounded-[4px] p-6 sm:p-8 max-w-sm w-full text-center text-white shadow-[0_0_35px_rgba(0,0,0,0.85),inset_0_0_24px_rgba(0,212,255,0.1)] backdrop-blur-md space-y-5 anime-dropdown">
          <div className="inline-block px-6 py-1.5 border border-white/70 bg-[#061426]/70 shadow-[0_0_14px_rgba(0,212,255,0.35)]">
            <div className="font-mono font-bold text-base sm:text-lg text-white anime-glow-text tracking-wider">
              [ PLAYER REGISTRATION ]
            </div>
          </div>

          <div className="text-xs text-gray-300 space-y-1">
            <div className="text-[11px] text-[#9fd3ff] font-bold">
              ID: SUBJECT-{newSubjectId}
            </div>
            <p className="text-gray-300">
              Enter your Hunter name to register your status dossier (one-time registration):
            </p>
          </div>

          <div className="space-y-4 pt-1">
            <input
              type="text"
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleNameSubmit();
              }}
              placeholder="e.g. Sung Jin-woo"
              className="w-full bg-[#061426] border border-white/40 px-3 py-2.5 text-center text-white font-mono text-base focus:border-[#00d4ff] outline-none rounded-[2px]"
              autoFocus
            />

            <button
              onClick={handleNameSubmit}
              disabled={loading || !nameInput.trim()}
              className="w-full py-2.5 bg-white text-black font-mono text-xs font-bold hover:bg-gray-200 transition-all disabled:opacity-40 rounded-[2px] shadow-[0_0_15px_rgba(0,212,255,0.3)]"
            >
              {loading ? 'REGISTERING...' : 'CONFIRM & ENTER SYSTEM'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Login;
