import { useEffect, useState } from 'react';
import { LockKeyhole, ShieldCheck, KeyRound, LogOut } from 'lucide-react';
import PinInput from '@/components/auth/PinInput';
import HunterLicenseCard from '@/components/auth/HunterLicenseCard';
import {
  fetchPinStatus,
  isValidPinFormat,
  reauthenticate,
  reclaimWithPin,
  recoverInPlace,
  type AuthResult,
} from '@/lib/subject-auth';
import { getUserProfile } from '@/lib/storage';
import { systemSound } from '@/lib/system-sound';

type Mode = 'loading' | 'pin' | 'setup' | 'recover' | 'license';

interface SessionGateProps {
  subjectId: string;
  onSignOut: () => void;
}

const panel =
  'relative bg-[#0a1b2e]/95 border-2 border-white/50 rounded-[4px] p-6 sm:p-8 max-w-sm w-full text-center text-white shadow-[0_0_35px_rgba(0,0,0,0.85),inset_0_0_24px_rgba(0,212,255,0.1)] backdrop-blur-md space-y-5 anime-dropdown font-mono';
const primaryBtn =
  'w-full py-2.5 bg-white text-black text-xs font-bold hover:bg-gray-200 transition-all disabled:opacity-40 rounded-[2px] shadow-[0_0_12px_rgba(0,212,255,0.3)]';

function describeError(r: AuthResult): string {
  if (r.code === 'INVALID_CREDENTIALS' && typeof r.attemptsLeft === 'number') {
    return `${r.error} ${r.attemptsLeft} ATTEMPT${r.attemptsLeft === 1 ? '' : 'S'} LEFT.`;
  }
  return r.error || 'ACCESS DENIED.';
}

/**
 * Blocks the app on a device that is signed in as a Subject but holds no valid server session:
 * accounts from before PINs existed (first PIN = claim), or a session that expired / was
 * revoked by a PIN recovery elsewhere. Local data is kept: it already belongs to this Subject.
 * After success the page reloads so the initial sync runs with the new session.
 */
export default function SessionGate({ subjectId, onSignOut }: SessionGateProps) {
  const [mode, setMode] = useState<Mode>('loading');
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [recoveryInput, setRecoveryInput] = useState('');
  const [newRecoveryCode, setNewRecoveryCode] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const hunterName = (() => {
    try {
      const p = getUserProfile();
      return p.displayName && p.displayName !== 'Subject' ? p.displayName : p.fullName || '';
    } catch {
      return '';
    }
  })();

  useEffect(() => {
    let cancelled = false;
    fetchPinStatus(subjectId).then((state) => {
      if (!cancelled) setMode(state);
    });
    return () => {
      cancelled = true;
    };
  }, [subjectId]);

  const finish = (r: AuthResult) => {
    if (r.error) {
      systemSound.playPenaltyWarning();
      setError(describeError(r));
      if (r.code === 'ALREADY_CLAIMED') {
        setMode('pin');
        setPin('');
        setConfirmPin('');
      }
      return;
    }
    systemSound.playLevelUp();
    if (r.recoveryCode) {
      setNewRecoveryCode(r.recoveryCode);
      setMode('license');
    } else {
      window.location.reload();
    }
  };

  const submitPin = async () => {
    if (!isValidPinFormat(pin) || busy) return;
    setBusy(true);
    setError('');
    const r = await reauthenticate(subjectId, pin);
    setBusy(false);
    finish(r);
  };

  const submitSetup = async () => {
    if (busy) return;
    if (!isValidPinFormat(pin)) return setError('PIN MUST BE EXACTLY 6 DIGITS.');
    if (pin !== confirmPin) return setError('THE TWO PINS DO NOT MATCH.');
    setBusy(true);
    setError('');
    const r = await reclaimWithPin(subjectId, pin);
    setBusy(false);
    finish(r);
  };

  const submitRecovery = async () => {
    if (busy) return;
    if (!recoveryInput.trim()) return setError('ENTER YOUR RECOVERY CODE.');
    if (!isValidPinFormat(pin)) return setError('NEW PIN MUST BE EXACTLY 6 DIGITS.');
    if (pin !== confirmPin) return setError('THE TWO PINS DO NOT MATCH.');
    setBusy(true);
    setError('');
    const r = await recoverInPlace(subjectId, recoveryInput, pin);
    setBusy(false);
    finish(r);
  };

  const switchMode = (next: Mode) => {
    systemSound.playClick();
    setError('');
    setPin('');
    setConfirmPin('');
    setRecoveryInput('');
    setMode(next);
  };

  const errorBox = error ? (
    <div className="text-rose-400 text-xs bg-rose-950/40 border border-rose-500/40 p-2 rounded-[2px]">{error}</div>
  ) : null;

  const signOutLink = (
    <button
      type="button"
      onClick={() => {
        systemSound.playClick();
        onSignOut();
      }}
      className="inline-flex items-center gap-1.5 text-[11px] text-gray-400 hover:text-white transition-colors"
    >
      <LogOut className="w-3.5 h-3.5" /> Sign out of this device
    </button>
  );

  return (
    <div className="min-h-screen bg-[#071322] flex items-center justify-center px-4 py-8 system-blueprint-bg font-mono">
      {mode === 'loading' && <div className="text-xs text-[#9fd3ff] animate-pulse">[ VERIFYING SUBJECT… ]</div>}

      {mode === 'license' && (
        <HunterLicenseCard
          subjectId={subjectId}
          recoveryCode={newRecoveryCode}
          hunterName={hunterName}
          onContinue={() => window.location.reload()}
          continueLabel="RE-ENTER THE SYSTEM >"
        />
      )}

      {mode === 'pin' && (
        <div className={panel}>
          <div className="inline-flex items-center gap-2 px-5 py-1.5 border border-white/70 bg-[#061426]/70 shadow-[0_0_14px_rgba(0,212,255,0.35)]">
            <LockKeyhole className="w-4 h-4 text-[#00d4ff]" />
            <span className="font-bold text-sm text-white anime-glow-text tracking-wider">IDENTITY CHECK</span>
          </div>
          <p className="text-xs text-gray-300 leading-relaxed">
            The System requires your PIN to continue as <span className="text-[#00d4ff] font-bold">{subjectId}</span>.
          </p>
          <PinInput value={pin} onChange={setPin} onSubmit={submitPin} autoFocus disabled={busy} />
          {errorBox}
          <button type="button" onClick={submitPin} disabled={busy || !isValidPinFormat(pin)} className={primaryBtn}>
            {busy ? 'VERIFYING...' : 'UNLOCK'}
          </button>
          <div className="flex items-center justify-between pt-1">
            <button
              type="button"
              onClick={() => switchMode('recover')}
              className="text-[11px] text-[#9fd3ff] hover:text-white transition-colors"
            >
              Forgot PIN?
            </button>
            {signOutLink}
          </div>
        </div>
      )}

      {mode === 'setup' && (
        <div className={panel}>
          <div className="inline-flex items-center gap-2 px-5 py-1.5 border border-white/70 bg-[#061426]/70 shadow-[0_0_14px_rgba(0,212,255,0.35)]">
            <ShieldCheck className="w-4 h-4 text-[#00d4ff]" />
            <span className="font-bold text-sm text-white anime-glow-text tracking-wider">[ SECURE YOUR ACCOUNT ]</span>
          </div>
          <p className="text-xs text-gray-300 leading-relaxed text-left">
            The System has upgraded its security. From now on your Subject ID alone no longer opens your account: choose a
            6-digit PIN. You will need it when you sign in on a new device.
          </p>
          <div className="space-y-2 text-left">
            <label className="text-[10px] text-gray-400 tracking-widest">NEW PIN</label>
            <PinInput value={pin} onChange={setPin} autoFocus autoComplete="new-password" disabled={busy} />
            <label className="text-[10px] text-gray-400 tracking-widest">CONFIRM PIN</label>
            <PinInput
              value={confirmPin}
              onChange={setConfirmPin}
              onSubmit={submitSetup}
              autoComplete="new-password"
              disabled={busy}
            />
          </div>
          {errorBox}
          <button type="button" onClick={submitSetup} disabled={busy} className={primaryBtn}>
            {busy ? 'SECURING...' : 'SET PIN'}
          </button>
          <div className="pt-1">{signOutLink}</div>
        </div>
      )}

      {mode === 'recover' && (
        <div className={panel}>
          <div className="inline-flex items-center gap-2 px-5 py-1.5 border border-white/70 bg-[#061426]/70 shadow-[0_0_14px_rgba(0,212,255,0.35)]">
            <KeyRound className="w-4 h-4 text-amber-300" />
            <span className="font-bold text-sm text-white anime-glow-text tracking-wider">PIN RECOVERY</span>
          </div>
          <p className="text-xs text-gray-300 leading-relaxed text-left">
            Enter the recovery code from your Hunter License and choose a new PIN. Every other device will be signed out.
          </p>
          <div className="space-y-2 text-left">
            <label className="text-[10px] text-gray-400 tracking-widest">RECOVERY CODE</label>
            <input
              type="text"
              value={recoveryInput}
              onChange={(e) => setRecoveryInput(e.target.value.toUpperCase())}
              placeholder="XXXX-XXXX-XXXX"
              autoComplete="off"
              className="w-full bg-[#061426] border border-white/40 px-4 py-2.5 text-center text-white text-sm tracking-[0.2em] placeholder:text-gray-600 focus:border-[#00d4ff] outline-none rounded-[2px]"
            />
            <label className="text-[10px] text-gray-400 tracking-widest">NEW PIN</label>
            <PinInput value={pin} onChange={setPin} autoComplete="new-password" disabled={busy} />
            <label className="text-[10px] text-gray-400 tracking-widest">CONFIRM NEW PIN</label>
            <PinInput
              value={confirmPin}
              onChange={setConfirmPin}
              onSubmit={submitRecovery}
              autoComplete="new-password"
              disabled={busy}
            />
          </div>
          {errorBox}
          <button type="button" onClick={submitRecovery} disabled={busy} className={primaryBtn}>
            {busy ? 'VERIFYING...' : 'RESET PIN'}
          </button>
          <button
            type="button"
            onClick={() => switchMode('pin')}
            className="text-[11px] text-[#9fd3ff] hover:text-white transition-colors"
          >
            Back to PIN entry
          </button>
        </div>
      )}
    </div>
  );
}
