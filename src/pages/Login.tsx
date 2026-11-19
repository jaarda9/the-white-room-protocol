import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  getUserProfile,
  saveUserProfile,
  getHunterProtocolConfig,
  saveHunterProtocolConfig,
  saveUserGeminiApiKey,
  normalizeGeminiKey,
} from '@/lib/storage';
import { initSetupPrompts } from '@/lib/setup-prompts';
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
import { startGuide } from '@/lib/system-guide';
import { syncManager } from '@/lib/sync-manager';
import { systemSound } from '@/lib/system-sound';
import { Key, UserPlus, ArrowLeft, Sparkles, ArrowRight, KeyRound, ExternalLink } from 'lucide-react';

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
  | 'new-key';

/** "SYSTEM AWAKENING ▰▰▱▱ 2/4" — the new-player steps: PIN, License, Name, AI key. */
function AwakeningSteps({ step }: { step: 1 | 2 | 3 | 4 }) {
  return (
    <div className="flex items-center justify-between gap-3 font-mono" aria-label={`Setup step ${step} of 4`}>
      <span className="text-[10px] tracking-[0.25em] text-[#9fd3ff]/80">SYSTEM AWAKENING</span>
      <div className="flex items-center gap-1.5">
        {[1, 2, 3, 4].map((i) => (
          <span key={i} className={`h-1.5 w-6 rounded-full ${i <= step ? 'bg-[#00d4ff] shadow-[0_0_6px_rgba(0,212,255,0.8)]' : 'bg-white/15'}`} />
        ))}
        <span className="text-[10px] text-white/60 ml-1">{step}/4</span>
      </div>
    </div>
  );
}

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
    setScreen('new-key');
  };

  // The player's own Gemini key is required: the shared key is a small pool every Hunter draws
  // from. Verified with Google first so a typo is caught here, not on the first failed quest.
  const handleVerifyKey = async () => {
    const key = normalizeGeminiKey(geminiKeyInput);
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

  // A pasted key is checked by itself (no separate VERIFY step).
  useEffect(() => {
    if (screen !== 'new-key' || keyCheck.state !== 'idle') return;
    if (normalizeGeminiKey(geminiKeyInput).length < 30) return;
    const t = setTimeout(() => handleVerifyKey(), 600);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [geminiKeyInput, screen, keyCheck.state]);

  const handlePasteKey = async () => {
    systemSound.playClick();
    try {
      const text = await navigator.clipboard.readText();
      if (text && text.trim()) {
        setGeminiKeyInput(text.trim());
        setKeyCheck({ state: 'idle' });
        return;
      }
    } catch {
      // clipboard blocked: the player pastes into the box instead
    }
    setKeyCheck({ state: 'unverified', message: 'Could not read the clipboard. Long-press the box above and choose Paste.' });
  };

  const keyAccepted = keyCheck.state === 'valid' || (keyCheck.state === 'unverified' && normalizeGeminiKey(geminiKeyInput).length >= 30);

  const handleFinishRegistrationAndEnter = async () => {
    if (!keyAccepted || loading) return;
    systemSound.playQuestComplete();
    setLoading(true);

    try {
      // Defaults for everything not asked at sign-up; asked when first needed (setup-prompts.ts).
      saveHunterProtocolConfig(getHunterProtocolConfig());
      initSetupPrompts();
      // Day one is just the Daily Quest: THEIA's first directive (a Gate) arrives tomorrow, so it
      // doesn't land in the middle of the tour on the first visit.
      const tomorrow = new Date();
      tomorrow.setHours(24, 0, 0, 0);
      saveUserProfile({ ...getUserProfile(), nextChainGateEarliestAt: tomorrow.toISOString() });
      saveUserGeminiApiKey(normalizeGeminiKey(geminiKeyInput));
      // New Hunter: the System's orientation tour opens on the dashboard (SystemGuide.tsx).
      startGuide();
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
          <AwakeningSteps step={1} />
          <div className="inline-block px-5 py-1.5 border border-white/70 bg-[#061426]/70 shadow-[0_0_14px_rgba(0,212,255,0.35)]">
            <div className="font-mono font-bold text-sm sm:text-base text-white anime-glow-text tracking-wider flex items-center justify-center gap-2">
              <Sparkles className="w-4 h-4 text-[#00d4ff]" />
              <span>[ SEAL YOUR IDENTITY ]</span>
            </div>
          </div>
          <p className="text-xs text-gray-300 leading-relaxed text-left">
            Choose a 6-digit PIN. You&apos;ll use it to sign in on any device. Don&apos;t reuse a PIN from elsewhere.
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
        <div className="w-full max-w-md space-y-3">
          <div className="px-1">
            <AwakeningSteps step={2} />
          </div>
          <HunterLicenseCard
            subjectId={newSubjectId}
            recoveryCode={issuedRecoveryCode}
            continueLabel="NEXT >"
            onContinue={() => {
              setIssuedRecoveryCode('');
              setScreen('new-name');
            }}
          />
        </div>
      )}

      {/* 5. FIRST TIME REGISTRATION: ENTER HUNTER NAME */}
      {screen === 'new-name' && (
        <div className="relative bg-[#0a1b2e]/95 border-2 border-white/50 rounded-[4px] p-6 sm:p-8 max-w-sm w-full text-center text-white shadow-[0_0_35px_rgba(0,0,0,0.85),inset_0_0_24px_rgba(0,212,255,0.1)] backdrop-blur-md space-y-5 anime-dropdown">
          <AwakeningSteps step={3} />
          <div className="inline-block px-4 sm:px-6 py-1.5 border border-white/70 bg-[#061426]/70 shadow-[0_0_14px_rgba(0,212,255,0.35)]">
            <div className="font-mono font-bold text-sm sm:text-base text-white anime-glow-text tracking-wider whitespace-nowrap flex items-center gap-2">
              <UserPlus className="w-4 h-4 text-[#9fd3ff]" />
              [ PLAYER REGISTRATION ]
            </div>
          </div>

          <p className="text-xs text-gray-300">What should the System call you? Other Hunters see this name.</p>

          <div className="space-y-4 pt-1">
            <input
              type="text"
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleNameSubmit();
              }}
              placeholder="Your name or Hunter alias"
              className="w-full bg-[#061426] border border-white/40 px-3 py-2.5 text-center text-white font-mono text-base focus:border-[#00d4ff] outline-none rounded-[2px]"
              autoFocus
            />

            <button
              onClick={handleNameSubmit}
              disabled={loading || !nameInput.trim()}
              className="w-full py-2.5 bg-white text-black font-mono text-xs font-bold hover:bg-gray-200 transition-all disabled:opacity-40 rounded-[2px] shadow-[0_0_15px_rgba(0,212,255,0.3)]"
            >
              {loading ? 'SAVING…' : 'NEXT >'}
            </button>
          </div>
        </div>
      )}

      {/* 6. AI KEY — the last setup step (everything else is asked when it first matters) */}
      {screen === 'new-key' && (
        <div className="relative bg-[#0a1b2e]/95 border-2 border-white/50 rounded-[4px] p-6 sm:p-8 max-w-md w-full text-white shadow-[0_0_40px_rgba(0,0,0,0.9),inset_0_0_24px_rgba(0,212,255,0.12)] backdrop-blur-md space-y-4 anime-dropdown font-mono">
          <AwakeningSteps step={4} />
          <div className="text-center space-y-2">
            <div className="inline-block px-5 py-1.5 border border-white/70 bg-[#061426]/70 shadow-[0_0_14px_rgba(0,212,255,0.35)]">
              <div className="font-bold text-sm sm:text-base text-white anime-glow-text tracking-wider flex items-center justify-center gap-2">
                <KeyRound className="w-4 h-4 text-[#00d4ff]" />
                [ BIND THEIA TO YOU ]
              </div>
            </div>
            <p className="text-xs text-gray-300 leading-relaxed">
              THEIA, the System&apos;s intelligence, runs on your own free Google key. About a minute, no card needed.
            </p>
          </div>

          <ol className="space-y-2.5">
            <li className="flex gap-2.5 items-start">
              <span className="w-5 h-5 shrink-0 rounded-full border border-[#00d4ff]/70 text-[#00d4ff] text-[10px] font-bold flex items-center justify-center">1</span>
              <div className="flex-1 space-y-1.5">
                <div className="text-xs text-white">Open Google AI Studio and sign in.</div>
                <a
                  href="https://aistudio.google.com/apikey"
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => systemSound.playClick()}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-[#00d4ff]/60 bg-[#00d4ff]/10 text-[11px] text-[#00d4ff] hover:text-white hover:bg-[#00d4ff]/20 font-bold rounded-[2px]"
                >
                  <ExternalLink className="w-3 h-3" /> OPEN GOOGLE AI STUDIO
                </a>
              </div>
            </li>
            <li className="flex gap-2.5 items-start">
              <span className="w-5 h-5 shrink-0 rounded-full border border-[#00d4ff]/70 text-[#00d4ff] text-[10px] font-bold flex items-center justify-center">2</span>
              <div className="text-xs text-white">
                Tap <b>Create API key</b>, then <b>Copy</b>.
              </div>
            </li>
            <li className="flex gap-2.5 items-start">
              <span className="w-5 h-5 shrink-0 rounded-full border border-[#00d4ff]/70 text-[#00d4ff] text-[10px] font-bold flex items-center justify-center">3</span>
              <div className="flex-1 space-y-1.5">
                <div className="text-xs text-white">Come back and paste it here. The System checks it by itself.</div>
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
                    placeholder="Paste your key"
                    aria-label="Gemini API key"
                    autoComplete="off"
                    className="flex-1 min-w-0 bg-[#061426] border border-white/30 rounded-[2px] px-2.5 py-2 text-xs text-white focus:border-[#00d4ff] outline-none"
                  />
                  <button
                    type="button"
                    onClick={handlePasteKey}
                    className="shrink-0 px-3 py-2 text-[11px] font-bold text-black bg-white hover:bg-gray-200 rounded-[2px]"
                  >
                    PASTE
                  </button>
                </div>
              </div>
            </li>
          </ol>

          {(keyCheck.message || keyCheck.state === 'checking') && (
            <p
              role="status"
              className={`text-[11px] leading-relaxed ${
                keyCheck.state === 'valid'
                  ? 'text-emerald-400'
                  : keyCheck.state === 'invalid'
                    ? 'text-rose-400'
                    : 'text-amber-300'
              }`}
            >
              {keyCheck.state === 'checking' ? 'CHECKING YOUR KEY WITH GOOGLE…' : keyCheck.message}
            </p>
          )}

          <button
            onClick={handleFinishRegistrationAndEnter}
            disabled={loading || !keyAccepted}
            className="w-full py-3 bg-white text-black text-xs sm:text-sm font-black hover:bg-gray-200 transition-all rounded-[2px] shadow-[0_0_20px_rgba(0,212,255,0.4)] flex items-center justify-center gap-2 disabled:opacity-40 disabled:hover:bg-white"
          >
            <span>{loading ? 'ENTERING…' : keyAccepted ? 'ENTER THE WHITE ROOM' : 'PASTE YOUR KEY TO CONTINUE'}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
          <p className="text-[10px] text-gray-500 text-center leading-relaxed">
            Your book, field of study, training plan and body data start with defaults. The System asks for them when you first need them.
          </p>
        </div>
      )}
    </div>
  );
};

export default Login;
