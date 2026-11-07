import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  getUserProfile,
  saveUserProfile,
  getHunterProtocolConfig,
  saveHunterProtocolConfig,
  saveUserGeminiApiKey,
  getUserBodyMetrics,
} from '@/lib/storage';
import {
  SESSION_SUBJECT_KEY,
  initializeNewSubject,
  loginWithSubjectId,
  claimSubjectWithPin,
  recoverWithCode,
  isValidPinFormat,
  type AuthResult,
} from '@/lib/subject-auth';
import PinInput from '@/components/auth/PinInput';
import HunterLicenseCard from '@/components/auth/HunterLicenseCard';
import { verifyGeminiKey } from '@/lib/ai-key-verify';
import { syncManager } from '@/lib/sync-manager';
import { systemSound } from '@/lib/system-sound';
import {
  Key,
  UserPlus,
  ArrowLeft,
  Check,
  Sparkles,
  Dumbbell,
  BookOpen,
  SlidersHorizontal,
  ArrowRight,
  KeyRound,
  ExternalLink,
  Scale,
} from 'lucide-react';
import ProtocolCalibrationModal from '@/components/ProtocolCalibrationModal';
import BiometricsCalibrationModal from '@/components/BiometricsCalibrationModal';

type Screen =
  | 'choose-role'
  | 'returning-login'
  | 'returning-setup-pin'
  | 'returning-recover'
  | 'returning-license'
  | 'new-notification'
  | 'new-pin'
  | 'new-memorize'
  | 'new-name'
  | 'new-calibration';

function describeAuthError(r: AuthResult): string {
  if (r.code === 'INVALID_CREDENTIALS' && typeof r.attemptsLeft === 'number') {
    return `${r.error} ${r.attemptsLeft} ATTEMPT${r.attemptsLeft === 1 ? '' : 'S'} LEFT.`;
  }
  return r.error || 'ACCESS DENIED.';
}

const Login = () => {
  const navigate = useNavigate();
  const [screen, setScreen] = useState<Screen>('choose-role');
  const [keyInput, setKeyInput] = useState('');
  const [nameInput, setNameInput] = useState('');
  const [newSubjectId, setNewSubjectId] = useState('');
  const [pinInput, setPinInput] = useState('');
  const [pinConfirm, setPinConfirm] = useState('');
  const [recoveryInput, setRecoveryInput] = useState('');
  const [issuedRecoveryCode, setIssuedRecoveryCode] = useState('');
  const [licenseSubjectId, setLicenseSubjectId] = useState('');
  const [keyCheck, setKeyCheck] = useState<{ state: 'idle' | 'checking' | 'valid' | 'invalid' | 'unverified'; message?: string }>({ state: 'idle' });
  const [countdown, setCountdown] = useState(2);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [calibrationModalOpen, setCalibrationModalOpen] = useState(false);
  const [biometricsModalOpen, setBiometricsModalOpen] = useState(false);
  const [protocolConfig, setProtocolConfig] = useState(() => getHunterProtocolConfig());
  const [bodyMetrics, setBodyMetrics] = useState(() => getUserBodyMetrics());
  const [geminiKeyInput, setGeminiKeyInput] = useState('');

  // Countdown timer on notification modal like Solo Leveling: "Your heart will stop in 0:02 seconds"
  useEffect(() => {
    if (screen !== 'new-notification') return;
    setCountdown(2);
    const interval = setInterval(() => {
      setCountdown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(interval);
  }, [screen]);

  const resetPinFields = () => {
    setPinInput('');
    setPinConfirm('');
    setRecoveryInput('');
  };

  // Handle Returning Subject Login (Subject ID + PIN)
  const handleKeySubmit = async () => {
    if (!keyInput.trim() || !isValidPinFormat(pinInput) || loading) return;
    systemSound.playClick();
    setLoading(true);
    setError('');
    const result = await loginWithSubjectId(keyInput.trim(), pinInput);
    setLoading(false);
    if (result.code === 'PIN_SETUP_REQUIRED') {
      // An account from before PINs existed: its first PIN claims it.
      systemSound.playSystemChime();
      resetPinFields();
      setScreen('returning-setup-pin');
      return;
    }
    if (result.error) {
      systemSound.playPenaltyWarning();
      setError(describeAuthError(result));
      setPinInput('');
      return;
    }
    systemSound.playLevelUp();
    window.dispatchEvent(new Event('wrp:profile-updated'));
    navigate('/');
  };

  const handleClaimSubmit = async () => {
    if (loading) return;
    if (!isValidPinFormat(pinInput)) return setError('PIN MUST BE EXACTLY 6 DIGITS.');
    if (pinInput !== pinConfirm) return setError('THE TWO PINS DO NOT MATCH.');
    setLoading(true);
    setError('');
    const result = await claimSubjectWithPin(keyInput.trim(), pinInput);
    setLoading(false);
    if (result.code === 'ALREADY_CLAIMED') {
      systemSound.playPenaltyWarning();
      setError(describeAuthError(result));
      resetPinFields();
      setScreen('returning-login');
      return;
    }
    if (result.error || !result.subjectId) {
      systemSound.playPenaltyWarning();
      setError(describeAuthError(result));
      return;
    }
    systemSound.playLevelUp();
    setLicenseSubjectId(result.subjectId);
    setIssuedRecoveryCode(result.recoveryCode || '');
    setScreen('returning-license');
  };

  const handleRecoverySubmit = async () => {
    if (loading) return;
    if (!keyInput.trim()) return setError('ENTER YOUR SUBJECT ID.');
    if (!recoveryInput.trim()) return setError('ENTER YOUR RECOVERY CODE.');
    if (!isValidPinFormat(pinInput)) return setError('NEW PIN MUST BE EXACTLY 6 DIGITS.');
    if (pinInput !== pinConfirm) return setError('THE TWO PINS DO NOT MATCH.');
    setLoading(true);
    setError('');
    const result = await recoverWithCode(keyInput.trim(), recoveryInput, pinInput);
    setLoading(false);
    if (result.error || !result.subjectId) {
      systemSound.playPenaltyWarning();
      setError(describeAuthError(result));
      return;
    }
    systemSound.playLevelUp();
    setLicenseSubjectId(result.subjectId);
    setIssuedRecoveryCode(result.recoveryCode || '');
    setScreen('returning-license');
  };

  // Accepting the quest leads to choosing a PIN; the Subject ID is issued with it.
  const handleAcceptPlayer = () => {
    systemSound.playSystemChime();
    setError('');
    resetPinFields();
    setScreen('new-pin');
  };

  const handleCreateSubject = async () => {
    if (loading) return;
    if (!isValidPinFormat(pinInput)) return setError('PIN MUST BE EXACTLY 6 DIGITS.');
    if (pinInput !== pinConfirm) return setError('THE TWO PINS DO NOT MATCH.');
    systemSound.playClick();
    setLoading(true);
    setError('');
    const result = await initializeNewSubject(pinInput);
    setLoading(false);
    if (result.error || !result.subjectId) {
      systemSound.playPenaltyWarning();
      setError(result.error || 'Failed to initialize subject. Please retry.');
      return;
    }
    systemSound.playLevelUp();
    resetPinFields();
    setNewSubjectId(result.subjectId);
    setIssuedRecoveryCode(result.recoveryCode || '');
    setScreen('new-memorize');
  };

  // Handle Declining the New Player quest
  const handleDecline = () => {
    systemSound.playPenaltyWarning();
    setScreen('choose-role');
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

    setLoading(false);
    window.dispatchEvent(new Event('wrp:profile-updated'));
    // Proceed to awakening calibration protocol
    setScreen('new-calibration');
  };

  // The player's own Gemini key is required: the shared key is a small pool every Hunter draws
  // from. Verified with Google first so a typo is caught here, not on the first failed quest.
  const handleVerifyKey = async () => {
    const key = geminiKeyInput.trim();
    if (!key) return;
    setKeyCheck({ state: 'checking' });
    const result = await verifyGeminiKey(key);
    if (result.valid === true) {
      systemSound.playSuccess();
      setKeyCheck({ state: 'valid', message: 'KEY VERIFIED. THEIA IS BOUND TO YOUR QUOTA.' });
    } else if (result.valid === false) {
      systemSound.playPenaltyWarning();
      setKeyCheck({ state: 'invalid', message: result.reason || 'Google rejected this key.' });
    } else {
      setKeyCheck({
        state: 'unverified',
        message: `${result.reason || 'Could not reach Google.'} You can continue; the key will be checked on first use.`,
      });
    }
  };

  const keyAccepted = keyCheck.state === 'valid' || keyCheck.state === 'unverified';

  const handleFinishRegistrationAndEnter = async () => {
    if (!keyAccepted || loading) return;
    systemSound.playQuestComplete();
    setLoading(true);

    try {
      saveHunterProtocolConfig(protocolConfig);
      saveUserGeminiApiKey(geminiKeyInput.trim());
      await syncManager.forceSaveUserData();
    } catch (e) {
      console.warn('Protocol sync warning:', e);
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
            {/* Ahjin Guild Logo */}
            <div className="flex justify-center pt-1 pb-1">
              <img
                src="/ahjin-logo.png"
                alt="Ahjin Guild Emblem"
                className="w-16 h-16 sm:w-20 sm:h-20 object-contain drop-shadow-[0_0_16px_rgba(0,212,255,0.45)]"
                referrerPolicy="no-referrer"
              />
            </div>

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
          <div className="flex justify-center">
            <img
              src="/ahjin-logo.png"
              alt="Ahjin Guild Emblem"
              className="w-14 h-14 sm:w-16 sm:h-16 object-contain drop-shadow-[0_0_12px_rgba(0,212,255,0.45)]"
              referrerPolicy="no-referrer"
            />
          </div>

          <div className="inline-block px-6 py-1.5 border border-white/70 bg-[#061426]/70 shadow-[0_0_14px_rgba(0,212,255,0.35)]">
            <h2 className="font-mono font-bold text-base sm:text-lg text-white anime-glow-text tracking-wider">
              ENTER THE DUNGEON
            </h2>
          </div>

          <div className="text-xs text-gray-300 space-y-1">
            <p className="text-gray-400">Provide your Subject ID and PIN to synchronize your status dossier:</p>
          </div>

          <div className="space-y-4 pt-1">
            <div className="space-y-2 text-left">
              <label className="text-[10px] text-gray-400 tracking-widest">SUBJECT ID</label>
              <input
                type="text"
                value={keyInput}
                onChange={(e) => setKeyInput(e.target.value.toUpperCase())}
                placeholder="e.g. M4HNZZ"
                autoComplete="username"
                autoCapitalize="characters"
                className="w-full bg-[#061426] border border-white/40 px-4 py-2.5 text-center text-white font-mono text-sm tracking-widest placeholder:text-gray-500 placeholder:tracking-normal focus:border-[#00d4ff] outline-none rounded-[2px]"
                autoFocus
              />
              <label className="text-[10px] text-gray-400 tracking-widest">PIN</label>
              <PinInput value={pinInput} onChange={setPinInput} onSubmit={handleKeySubmit} disabled={loading} />
              <p className="text-[10px] text-gray-500 leading-relaxed">
                No PIN yet? Enter any 6 digits: if your account was created before PINs existed, the System will ask you to
                choose one.
              </p>
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
                disabled={loading || !keyInput.trim() || !isValidPinFormat(pinInput)}
                className="flex-1 py-2 bg-white text-black hover:bg-gray-200 font-mono text-xs font-bold transition-all disabled:opacity-40 rounded-[2px] shadow-[0_0_12px_rgba(0,212,255,0.3)]"
              >
                {loading ? 'Verifying...' : 'Unlock & Enter'}
              </button>
            </div>

            <button
              type="button"
              onClick={() => {
                systemSound.playClick();
                setError('');
                resetPinFields();
                setScreen('returning-recover');
              }}
              className="text-[11px] text-[#9fd3ff] hover:text-white transition-colors"
            >
              Forgot your PIN?
            </button>
          </div>
        </div>
      )}

      {/* 2b. OLDER ACCOUNT: FIRST PIN */}
      {screen === 'returning-setup-pin' && (
        <div className="relative bg-[#0a1b2e]/95 border-2 border-white/50 rounded-[4px] p-6 sm:p-8 max-w-sm w-full text-center text-white shadow-[0_0_35px_rgba(0,0,0,0.85),inset_0_0_24px_rgba(0,212,255,0.1)] backdrop-blur-md space-y-5 anime-dropdown">
          <div className="inline-block px-5 py-1.5 border border-white/70 bg-[#061426]/70 shadow-[0_0_14px_rgba(0,212,255,0.35)]">
            <h2 className="font-mono font-bold text-sm sm:text-base text-white anime-glow-text tracking-wider">
              [ SECURE YOUR ACCOUNT ]
            </h2>
          </div>
          <p className="text-xs text-gray-300 leading-relaxed text-left">
            Subject <span className="text-[#00d4ff] font-bold">{keyInput.trim()}</span> has no PIN yet. The System has
            upgraded its security: choose a 6-digit PIN. From now on your Subject ID alone no longer opens your account.
          </p>
          <div className="space-y-2 text-left">
            <label className="text-[10px] text-gray-400 tracking-widest">NEW PIN</label>
            <PinInput value={pinInput} onChange={setPinInput} autoFocus autoComplete="new-password" disabled={loading} />
            <label className="text-[10px] text-gray-400 tracking-widest">CONFIRM PIN</label>
            <PinInput
              value={pinConfirm}
              onChange={setPinConfirm}
              onSubmit={handleClaimSubmit}
              autoComplete="new-password"
              disabled={loading}
            />
          </div>
          {error && (
            <div className="text-rose-400 font-mono text-xs bg-rose-950/40 border border-rose-500/40 p-2 rounded-[2px]">
              {error}
            </div>
          )}
          <div className="flex gap-2">
            <button
              onClick={() => {
                systemSound.playClick();
                setError('');
                resetPinFields();
                setScreen('returning-login');
              }}
              className="px-4 py-2 border border-white/30 bg-[#061426] text-gray-300 font-mono text-xs hover:text-white hover:border-white transition-colors rounded-[2px] flex items-center gap-1.5"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Back
            </button>
            <button
              onClick={handleClaimSubmit}
              disabled={loading}
              className="flex-1 py-2 bg-white text-black hover:bg-gray-200 font-mono text-xs font-bold transition-all disabled:opacity-40 rounded-[2px] shadow-[0_0_12px_rgba(0,212,255,0.3)]"
            >
              {loading ? 'SECURING...' : 'SET PIN & ENTER'}
            </button>
          </div>
        </div>
      )}

      {/* 2c. FORGOTTEN PIN: RECOVERY CODE */}
      {screen === 'returning-recover' && (
        <div className="relative bg-[#0a1b2e]/95 border-2 border-white/50 rounded-[4px] p-6 sm:p-8 max-w-sm w-full text-center text-white shadow-[0_0_35px_rgba(0,0,0,0.85),inset_0_0_24px_rgba(0,212,255,0.1)] backdrop-blur-md space-y-5 anime-dropdown">
          <div className="inline-block px-5 py-1.5 border border-white/70 bg-[#061426]/70 shadow-[0_0_14px_rgba(0,212,255,0.35)]">
            <h2 className="font-mono font-bold text-sm sm:text-base text-white anime-glow-text tracking-wider">PIN RECOVERY</h2>
          </div>
          <p className="text-xs text-gray-300 leading-relaxed text-left">
            Use the recovery code from your Hunter License. Every other device will be signed out.
          </p>
          <div className="space-y-2 text-left">
            <label className="text-[10px] text-gray-400 tracking-widest">SUBJECT ID</label>
            <input
              type="text"
              value={keyInput}
              onChange={(e) => setKeyInput(e.target.value.toUpperCase())}
              placeholder="e.g. M4HNZZ"
              autoComplete="username"
              className="w-full bg-[#061426] border border-white/40 px-4 py-2.5 text-center text-white font-mono text-sm tracking-widest placeholder:text-gray-500 placeholder:tracking-normal focus:border-[#00d4ff] outline-none rounded-[2px]"
            />
            <label className="text-[10px] text-gray-400 tracking-widest">RECOVERY CODE</label>
            <input
              type="text"
              value={recoveryInput}
              onChange={(e) => setRecoveryInput(e.target.value.toUpperCase())}
              placeholder="XXXX-XXXX-XXXX"
              autoComplete="off"
              className="w-full bg-[#061426] border border-white/40 px-4 py-2.5 text-center text-white font-mono text-sm tracking-[0.2em] placeholder:text-gray-600 focus:border-[#00d4ff] outline-none rounded-[2px]"
            />
            <label className="text-[10px] text-gray-400 tracking-widest">NEW PIN</label>
            <PinInput value={pinInput} onChange={setPinInput} autoComplete="new-password" disabled={loading} />
            <label className="text-[10px] text-gray-400 tracking-widest">CONFIRM NEW PIN</label>
            <PinInput
              value={pinConfirm}
              onChange={setPinConfirm}
              onSubmit={handleRecoverySubmit}
              autoComplete="new-password"
              disabled={loading}
            />
          </div>
          {error && (
            <div className="text-rose-400 font-mono text-xs bg-rose-950/40 border border-rose-500/40 p-2 rounded-[2px]">
              {error}
            </div>
          )}
          <div className="flex gap-2">
            <button
              onClick={() => {
                systemSound.playClick();
                setError('');
                resetPinFields();
                setScreen('returning-login');
              }}
              className="px-4 py-2 border border-white/30 bg-[#061426] text-gray-300 font-mono text-xs hover:text-white hover:border-white transition-colors rounded-[2px] flex items-center gap-1.5"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Back
            </button>
            <button
              onClick={handleRecoverySubmit}
              disabled={loading}
              className="flex-1 py-2 bg-white text-black hover:bg-gray-200 font-mono text-xs font-bold transition-all disabled:opacity-40 rounded-[2px] shadow-[0_0_12px_rgba(0,212,255,0.3)]"
            >
              {loading ? 'VERIFYING...' : 'RESET PIN & ENTER'}
            </button>
          </div>
        </div>
      )}

      {/* 2d. LICENSE AFTER FIRST PIN / RECOVERY */}
      {screen === 'returning-license' && (
        <HunterLicenseCard
          subjectId={licenseSubjectId}
          recoveryCode={issuedRecoveryCode}
          hunterName={(() => {
            const p = getUserProfile();
            return p.displayName && p.displayName !== 'Subject' ? p.displayName : p.fullName || '';
          })()}
          continueLabel="ENTER THE SYSTEM >"
          onContinue={() => {
            setIssuedRecoveryCode('');
            window.dispatchEvent(new Event('wrp:profile-updated'));
            navigate('/');
          }}
        />
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
                Yes
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

      {/* 4a. NEW PLAYER: CHOOSE A PIN (the Subject ID is issued with it) */}
      {screen === 'new-pin' && (
        <div className="relative bg-[#0a1b2e]/95 border-2 border-white/50 rounded-[4px] p-6 sm:p-8 max-w-sm w-full text-center text-white shadow-[0_0_35px_rgba(0,0,0,0.85),inset_0_0_24px_rgba(0,212,255,0.1)] backdrop-blur-md space-y-5 anime-dropdown">
          <div className="inline-block px-5 py-1.5 border border-white/70 bg-[#061426]/70 shadow-[0_0_14px_rgba(0,212,255,0.35)]">
            <div className="font-mono font-bold text-sm sm:text-base text-white anime-glow-text tracking-wider flex items-center justify-center gap-2">
              <Sparkles className="w-4 h-4 text-[#00d4ff]" />
              <span>[ SEAL YOUR IDENTITY ]</span>
            </div>
          </div>
          <p className="text-xs text-gray-300 leading-relaxed text-left">
            Choose a 6-digit PIN. With your Subject ID it opens your account on any device. Do not reuse a PIN you use
            elsewhere.
          </p>
          <div className="space-y-2 text-left">
            <label className="text-[10px] text-gray-400 tracking-widest">PIN</label>
            <PinInput value={pinInput} onChange={setPinInput} autoFocus autoComplete="new-password" disabled={loading} />
            <label className="text-[10px] text-gray-400 tracking-widest">CONFIRM PIN</label>
            <PinInput
              value={pinConfirm}
              onChange={setPinConfirm}
              onSubmit={handleCreateSubject}
              autoComplete="new-password"
              disabled={loading}
            />
          </div>
          {error && (
            <div className="text-rose-400 font-mono text-xs bg-rose-950/40 border border-rose-500/40 p-2 rounded-[2px]">
              {error}
            </div>
          )}
          <button
            onClick={handleCreateSubject}
            disabled={loading}
            className="w-full py-2.5 bg-white text-black font-mono text-xs font-bold hover:bg-gray-200 transition-all disabled:opacity-40 rounded-[2px] shadow-[0_0_15px_rgba(0,212,255,0.3)]"
          >
            {loading ? 'GENERATING SUBJECT ID...' : 'ISSUE MY SUBJECT ID >'}
          </button>
        </div>
      )}

      {/* 4b. NEW PLAYER: HUNTER LICENSE (Subject ID + recovery code, shown once) */}
      {screen === 'new-memorize' && (
        <HunterLicenseCard
          subjectId={newSubjectId}
          recoveryCode={issuedRecoveryCode}
          continueLabel="LOG IN AS NEW SUBJECT >"
          onContinue={() => {
            setIssuedRecoveryCode('');
            setScreen('new-name');
          }}
        />
      )}

      {/* 5. FIRST TIME REGISTRATION: ENTER HUNTER NAME */}
      {screen === 'new-name' && (
        <div className="relative bg-[#0a1b2e]/95 border-2 border-white/50 rounded-[4px] p-6 sm:p-8 max-w-sm w-full text-center text-white shadow-[0_0_35px_rgba(0,0,0,0.85),inset_0_0_24px_rgba(0,212,255,0.1)] backdrop-blur-md space-y-5 anime-dropdown">
          <div className="inline-block px-4 sm:px-6 py-1.5 border border-white/70 bg-[#061426]/70 shadow-[0_0_14px_rgba(0,212,255,0.35)]">
            <div className="font-mono font-bold text-sm sm:text-base text-white anime-glow-text tracking-wider whitespace-nowrap flex items-center gap-2">
              <UserPlus className="w-4 h-4 text-[#9fd3ff]" />
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
              {loading ? 'REGISTERING...' : 'CONFIRM & CALIBRATE PROTOCOL >'}
            </button>
          </div>
        </div>
      )}

      {/* 6. AWAKENING CALIBRATION PROTOCOL */}
      {screen === 'new-calibration' && (
        <div className="relative bg-[#0a1b2e]/95 border-2 border-white/50 rounded-[4px] p-6 sm:p-8 max-w-lg w-full text-white shadow-[0_0_40px_rgba(0,0,0,0.9),inset_0_0_24px_rgba(0,212,255,0.12)] backdrop-blur-md space-y-5 anime-dropdown">
          {/* Header */}
          <div className="text-center space-y-2 pb-2 border-b border-white/20">
            <div className="inline-block px-6 py-1.5 border border-white/70 bg-[#061426]/70 shadow-[0_0_14px_rgba(0,212,255,0.35)]">
              <div className="font-mono font-bold text-sm sm:text-base text-white anime-glow-text tracking-wider flex items-center justify-center gap-2">
                <Sparkles className="w-4 h-4 text-[#00d4ff] animate-pulse" />
                SYSTEM AWAKENING: PROTOCOL CALIBRATION
              </div>
            </div>
            <p className="text-xs text-gray-300 leading-relaxed font-mono">
              Welcome, <span className="text-[#00d4ff] font-bold">{nameInput || 'Hunter'}</span>. The System needs to calibrate your daily physical directives and mental focus disciplines.
            </p>
          </div>

          {/* Physical Regimen Choice */}
          <div className="space-y-3 font-mono">
            <div className="text-xs font-bold text-[#9fd3ff] flex items-center gap-2">
              <Dumbbell className="w-4 h-4 text-[#00d4ff]" />
              PHYSICAL DIRECTIVE PREFERENCE:
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => {
                  systemSound.playClick();
                  const updated = { ...protocolConfig, physicalPath: 'system' as const };
                  setProtocolConfig(updated);
                  saveHunterProtocolConfig(updated);
                }}
                className={`p-3 rounded-[2px] border text-left transition-all ${
                  protocolConfig.physicalPath === 'system'
                    ? 'border-[#00d4ff] bg-[#061e38] shadow-[0_0_12px_rgba(0,212,255,0.2)]'
                    : 'border-white/30 bg-[#061426]/70 hover:bg-[#0c243d]'
                }`}
              >
                <div className="font-bold text-xs text-white flex items-center justify-between mb-1">
                  <span>PRESCRIBE FOR ME</span>
                  {protocolConfig.physicalPath === 'system' && (
                    <Check className="w-3.5 h-3.5 text-[#00d4ff]" />
                  )}
                </div>
                <div className="text-[11px] text-gray-400">
                  Automated balanced routine (Gym, Cardio, Active Recovery)
                </div>
              </button>

              <button
                type="button"
                onClick={() => {
                  systemSound.playClick();
                  const updated = { ...protocolConfig, physicalPath: 'custom' as const };
                  setProtocolConfig(updated);
                  saveHunterProtocolConfig(updated);
                  setCalibrationModalOpen(true);
                }}
                className={`p-3 rounded-[2px] border text-left transition-all ${
                  protocolConfig.physicalPath === 'custom'
                    ? 'border-[#00d4ff] bg-[#061e38] shadow-[0_0_12px_rgba(0,212,255,0.2)]'
                    : 'border-white/30 bg-[#061426]/70 hover:bg-[#0c243d]'
                }`}
              >
                <div className="font-bold text-xs text-white flex items-center justify-between mb-1">
                  <span>I HAVE A GYM ROUTINE</span>
                  {protocolConfig.physicalPath === 'custom' && (
                    <Check className="w-3.5 h-3.5 text-[#00d4ff]" />
                  )}
                </div>
                <div className="text-[11px] text-gray-400">
                  Customize split with 120+ exercise library & preset splits
                </div>
              </button>
            </div>

            {protocolConfig.physicalPath === 'custom' && (
              <div className="p-2.5 rounded bg-[#06182a] border border-[#00d4ff]/30 flex items-center justify-between">
                <div className="text-[11px] text-gray-300">
                  Custom Regimen configured. Need to adjust days or exercises?
                </div>
                <button
                  type="button"
                  onClick={() => setCalibrationModalOpen(true)}
                  className="px-2.5 py-1 text-[11px] bg-[#00d4ff]/20 text-[#00d4ff] hover:bg-[#00d4ff]/30 border border-[#00d4ff]/50 rounded shrink-0 flex items-center gap-1 font-bold"
                >
                  <SlidersHorizontal className="w-3 h-3" /> Edit Split
                </button>
              </div>
            )}
          </div>

          {/* Mental Focus Inputs */}
          <div className="space-y-3 font-mono pt-2 border-t border-white/20">
            <div className="text-xs font-bold text-[#9fd3ff] flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-[#00d4ff]" />
              INTELLECTUAL & READING TARGETS:
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div>
                <label className="text-[10px] text-gray-400 block mb-1">CURRENT READING BOOK</label>
                <input
                  type="text"
                  value={protocolConfig.mentalPreferences.currentBookTitle}
                  onChange={(e) =>
                    setProtocolConfig((prev) => ({
                      ...prev,
                      mentalPreferences: {
                        ...prev.mentalPreferences,
                        currentBookTitle: e.target.value,
                      },
                    }))
                  }
                  placeholder="e.g. Atomic Habits"
                  className="w-full bg-[#061426] border border-white/30 rounded px-2.5 py-1.5 text-xs text-white focus:border-[#00d4ff] outline-none"
                />
              </div>
              <div>
                <label className="text-[10px] text-gray-400 block mb-1">AUTHOR (OPTIONAL)</label>
                <input
                  type="text"
                  value={protocolConfig.mentalPreferences.currentBookAuthor || ''}
                  onChange={(e) =>
                    setProtocolConfig((prev) => ({
                      ...prev,
                      mentalPreferences: {
                        ...prev.mentalPreferences,
                        currentBookAuthor: e.target.value,
                      },
                    }))
                  }
                  placeholder="e.g. James Clear"
                  className="w-full bg-[#061426] border border-white/30 rounded px-2.5 py-1.5 text-xs text-white focus:border-[#00d4ff] outline-none"
                />
              </div>
            </div>

            <div>
              <label className="text-[10px] text-gray-400 block mb-1">DAILY READING TARGET (MINUTES)</label>
              <div className="flex items-center gap-1.5">
                {[15, 20, 30, 45].map((mins) => (
                  <button
                    key={mins}
                    type="button"
                    onClick={() => {
                      systemSound.playClick();
                      setProtocolConfig((prev) => ({
                        ...prev,
                        mentalPreferences: { ...prev.mentalPreferences, dailyReadingMinutes: mins },
                      }));
                    }}
                    className={`px-2.5 py-1 rounded border text-[11px] transition-all ${
                      protocolConfig.mentalPreferences.dailyReadingMinutes === mins
                        ? 'border-[#00d4ff] bg-[#00d4ff]/20 text-[#00d4ff] font-bold'
                        : 'border-white/20 text-gray-400 hover:text-white'
                    }`}
                  >
                    {mins} mins
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-[10px] text-gray-400 block mb-1">DISCIPLINE OF STUDY</label>
              <input
                type="text"
                value={protocolConfig.mentalPreferences.currentStudyTopic}
                onChange={(e) =>
                  setProtocolConfig((prev) => ({
                    ...prev,
                    mentalPreferences: {
                      ...prev.mentalPreferences,
                      currentStudyTopic: e.target.value,
                    },
                  }))
                }
                placeholder="e.g. Software Architecture"
                className="w-full bg-[#061426] border border-white/30 rounded px-2.5 py-1.5 text-xs text-white focus:border-[#00d4ff] outline-none"
              />
            </div>

            <div>
              <label className="text-[10px] text-gray-400 block mb-1">DAILY STUDY TARGET (MINUTES)</label>
              <div className="flex items-center gap-1.5">
                {[15, 30, 45, 60].map((mins) => (
                  <button
                    key={mins}
                    type="button"
                    onClick={() => {
                      systemSound.playClick();
                      setProtocolConfig((prev) => ({
                        ...prev,
                        mentalPreferences: { ...prev.mentalPreferences, dailyStudyMinutes: mins },
                      }));
                    }}
                    className={`px-2.5 py-1 rounded border text-[11px] transition-all ${
                      protocolConfig.mentalPreferences.dailyStudyMinutes === mins
                        ? 'border-[#00d4ff] bg-[#00d4ff]/20 text-[#00d4ff] font-bold'
                        : 'border-white/20 text-gray-400 hover:text-white'
                    }`}
                  >
                    {mins} mins
                  </button>
                ))}
              </div>
            </div>

            <p className="text-[10px] text-gray-400">
              *You can re-calibrate your physical routines, exercises, or books anytime in Hunter Records.
            </p>
          </div>

          {/* Nutritional Biometrics (Optional) */}
          <div className="space-y-2.5 font-mono pt-2 border-t border-white/20">
            <div className="text-xs font-bold text-[#9fd3ff] flex items-center gap-2">
              <Scale className="w-4 h-4 text-[#00d4ff]" />
              NUTRITIONAL BIOMETRICS (OPTIONAL):
            </div>
            <p className="text-[10px] text-gray-400 leading-relaxed">
              Set your weight, height, and dietary goal so THEIA can calculate a personalized daily
              intake protocol and IMC (BMI) reading. You can skip this and calibrate later in Hunter
              Records.
            </p>
            <div className="flex items-center justify-between gap-2 p-2.5 border border-white/20 bg-[#061426]/60 rounded">
              <div className="text-[11px] text-gray-300">
                {bodyMetrics.isCalibrated ? (
                  <span className="text-emerald-400 font-bold">
                    [ CALIBRATED: {bodyMetrics.weightKg}kg • {bodyMetrics.heightCm}cm
                    {bodyMetrics.country ? ` • ${bodyMetrics.country}` : ''} ]
                  </span>
                ) : (
                  <span className="text-gray-500">[ NOT YET CALIBRATED ]</span>
                )}
              </div>
              <button
                type="button"
                onClick={() => {
                  systemSound.playClick();
                  setBiometricsModalOpen(true);
                }}
                className="px-3 py-1.5 text-[11px] font-bold text-[#00d4ff] hover:text-white border border-[#00d4ff]/50 hover:border-[#00d4ff] bg-[#00d4ff]/10 hover:bg-[#00d4ff]/20 rounded transition-all shrink-0"
              >
                [ CALIBRATE ]
              </button>
            </div>
          </div>

          {/* AI System Access Key (required) */}
          <div className="space-y-2 font-mono pt-2 border-t border-white/20">
            <div className="text-xs font-bold text-[#9fd3ff] flex items-center gap-2">
              <KeyRound className="w-4 h-4 text-[#00d4ff]" />
              AI SYSTEM ACCESS KEY (REQUIRED):
            </div>
            <p className="text-[10px] text-gray-400 leading-relaxed">
              THEIA, the System's intelligence, runs on a free Google Gemini key bound to you. It takes about a minute
              and needs only a Google account:
            </p>
            <ol className="text-[10px] text-gray-300 space-y-0.5 pl-4 list-decimal">
              <li>Open Google AI Studio and sign in with your Google account</li>
              <li>Click "Create API key" (free tier, no card required)</li>
              <li>Copy the key, paste it below, and press VERIFY</li>
            </ol>
            <a
              href="https://aistudio.google.com/apikey"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-[10px] text-[#00d4ff] hover:text-white font-bold"
            >
              <ExternalLink className="w-3 h-3" /> OPEN GOOGLE AI STUDIO
            </a>
            <div className="flex gap-2">
              <input
                type="password"
                value={geminiKeyInput}
                onChange={(e) => {
                  setGeminiKeyInput(e.target.value);
                  setKeyCheck({ state: 'idle' });
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleVerifyKey();
                }}
                placeholder="AIza..."
                autoComplete="off"
                className="flex-1 min-w-0 bg-[#061426] border border-white/30 rounded px-2.5 py-1.5 text-xs text-white focus:border-[#00d4ff] outline-none font-mono"
              />
              <button
                type="button"
                onClick={handleVerifyKey}
                disabled={!geminiKeyInput.trim() || keyCheck.state === 'checking' || keyCheck.state === 'valid'}
                className="shrink-0 px-3 py-1.5 text-[11px] font-bold text-[#00d4ff] hover:text-white border border-[#00d4ff]/50 hover:border-[#00d4ff] bg-[#00d4ff]/10 hover:bg-[#00d4ff]/20 rounded transition-all disabled:opacity-40"
              >
                {keyCheck.state === 'checking' ? 'CHECKING…' : keyCheck.state === 'valid' ? 'VERIFIED' : 'VERIFY'}
              </button>
            </div>
            {keyCheck.message && (
              <p
                className={`text-[10px] leading-relaxed ${
                  keyCheck.state === 'valid'
                    ? 'text-emerald-400'
                    : keyCheck.state === 'invalid'
                      ? 'text-rose-400'
                      : 'text-amber-300'
                }`}
              >
                {keyCheck.message}
              </p>
            )}
            <p className="text-[10px] text-gray-500">
              *You can add more keys or change this one anytime in your Hunter Dossier.
            </p>
          </div>

          {/* Enter System Action */}
          <div className="pt-2">
            <button
              onClick={handleFinishRegistrationAndEnter}
              disabled={loading || !keyAccepted}
              className="w-full py-3 bg-white text-black font-mono text-xs sm:text-sm font-black hover:bg-gray-200 transition-all rounded-[2px] shadow-[0_0_20px_rgba(0,212,255,0.4)] flex items-center justify-center gap-2 disabled:opacity-40 disabled:hover:bg-white"
            >
              <span>{loading ? 'INITIALIZING...' : keyAccepted ? 'COMMENCE AWAKENING & ENTER THE WHITE ROOM' : 'VERIFY YOUR AI KEY TO CONTINUE'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
      {/* Calibration Modal for Custom Routine Builder */}
      <ProtocolCalibrationModal
        isOpen={calibrationModalOpen}
        onClose={() => {
          setCalibrationModalOpen(false);
          setProtocolConfig(getHunterProtocolConfig());
        }}
        onSaved={() => {
          setProtocolConfig(getHunterProtocolConfig());
        }}
        isOnboarding={true}
      />

      {/* Nutritional Biometrics Modal */}
      <BiometricsCalibrationModal
        isOpen={biometricsModalOpen}
        onClose={() => {
          setBiometricsModalOpen(false);
          setBodyMetrics(getUserBodyMetrics());
        }}
        profile={getUserProfile()}
        onCalibrated={() => {
          setBodyMetrics(getUserBodyMetrics());
        }}
      />
    </div>
  );
};

export default Login;
