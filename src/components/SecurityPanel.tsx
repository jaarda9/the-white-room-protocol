import { useState } from 'react';
import { ShieldCheck, KeyRound, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import PinInput from '@/components/auth/PinInput';
import { changeSubjectPin, isValidPinFormat, regenerateRecoveryCode, type AuthResult } from '@/lib/subject-auth';
import { systemSound } from '@/lib/system-sound';

type Mode = 'idle' | 'change-pin' | 'new-code';

function describe(r: AuthResult): string {
  if (typeof r.attemptsLeft === 'number') return `${r.error} ${r.attemptsLeft} ATTEMPT${r.attemptsLeft === 1 ? '' : 'S'} LEFT.`;
  return r.error || 'FAILED.';
}

/** Profile → account security: change PIN, issue a new recovery code. */
export default function SecurityPanel({ subjectId }: { subjectId?: string }) {
  const [mode, setMode] = useState<Mode>('idle');
  const [currentPin, setCurrentPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [issuedCode, setIssuedCode] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const reset = (next: Mode) => {
    systemSound.playClick();
    setMode(next);
    setCurrentPin('');
    setNewPin('');
    setConfirmPin('');
    setError('');
    setIssuedCode('');
  };

  const submitChange = async () => {
    if (busy) return;
    if (!isValidPinFormat(currentPin)) return setError('ENTER YOUR CURRENT 6-DIGIT PIN.');
    if (!isValidPinFormat(newPin)) return setError('NEW PIN MUST BE EXACTLY 6 DIGITS.');
    if (newPin !== confirmPin) return setError('THE TWO NEW PINS DO NOT MATCH.');
    setBusy(true);
    setError('');
    const r = await changeSubjectPin(currentPin, newPin);
    setBusy(false);
    if (r.error) {
      systemSound.playPenaltyWarning();
      return setError(describe(r));
    }
    systemSound.playSuccess();
    toast.success('PIN UPDATED', { description: 'Use the new PIN the next time you sign in on a device.' });
    reset('idle');
  };

  const submitNewCode = async () => {
    if (busy) return;
    if (!isValidPinFormat(currentPin)) return setError('ENTER YOUR CURRENT 6-DIGIT PIN.');
    setBusy(true);
    setError('');
    const r = await regenerateRecoveryCode(currentPin);
    setBusy(false);
    if (r.error || !r.recoveryCode) {
      systemSound.playPenaltyWarning();
      return setError(describe(r));
    }
    systemSound.playSuccess();
    setCurrentPin('');
    setIssuedCode(r.recoveryCode);
  };

  return (
    <div className="border border-white/30 bg-[#061426]/60 rounded-[2px] p-3 sm:p-4 space-y-3 font-mono text-left">
      <div className="flex items-center gap-2 text-xs font-bold text-[#9fd3ff] tracking-wider">
        <ShieldCheck className="w-4 h-4 text-[#00d4ff]" />
        ACCOUNT SECURITY
      </div>
      <p className="text-[10px] text-gray-400 leading-relaxed">
        Your Subject ID{subjectId ? <span className="text-[#9fd3ff] font-bold"> {subjectId}</span> : null} and PIN open this
        account on any device. Never share them.
      </p>

      {mode === 'idle' && (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => reset('change-pin')}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-bold text-[#00d4ff] hover:text-white border border-[#00d4ff]/50 hover:border-[#00d4ff] bg-[#00d4ff]/10 rounded-[2px] transition-all"
          >
            <KeyRound className="w-3.5 h-3.5" /> CHANGE PIN
          </button>
          <button
            type="button"
            onClick={() => reset('new-code')}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-bold text-amber-300 hover:text-white border border-amber-400/50 hover:border-amber-300 bg-amber-400/10 rounded-[2px] transition-all"
          >
            <RefreshCw className="w-3.5 h-3.5" /> NEW RECOVERY CODE
          </button>
        </div>
      )}

      {mode === 'change-pin' && (
        <div className="space-y-2">
          <label className="text-[10px] text-gray-400 tracking-widest">CURRENT PIN</label>
          <PinInput value={currentPin} onChange={setCurrentPin} autoFocus disabled={busy} />
          <label className="text-[10px] text-gray-400 tracking-widest">NEW PIN</label>
          <PinInput value={newPin} onChange={setNewPin} autoComplete="new-password" disabled={busy} />
          <label className="text-[10px] text-gray-400 tracking-widest">CONFIRM NEW PIN</label>
          <PinInput value={confirmPin} onChange={setConfirmPin} onSubmit={submitChange} autoComplete="new-password" disabled={busy} />
          {error && <div className="text-rose-400 text-[11px] bg-rose-950/40 border border-rose-500/40 p-2 rounded-[2px]">{error}</div>}
          <div className="flex gap-2">
            <button type="button" onClick={() => reset('idle')} className="px-3 py-1.5 text-[11px] border border-white/30 text-gray-300 hover:text-white rounded-[2px]">
              Cancel
            </button>
            <button
              type="button"
              onClick={submitChange}
              disabled={busy}
              className="flex-1 py-1.5 bg-white text-black text-[11px] font-bold hover:bg-gray-200 disabled:opacity-40 rounded-[2px]"
            >
              {busy ? 'UPDATING...' : 'UPDATE PIN'}
            </button>
          </div>
        </div>
      )}

      {mode === 'new-code' && !issuedCode && (
        <div className="space-y-2">
          <p className="text-[10px] text-amber-300/90 leading-relaxed">
            Your old recovery code will stop working. Confirm with your current PIN.
          </p>
          <PinInput value={currentPin} onChange={setCurrentPin} onSubmit={submitNewCode} autoFocus disabled={busy} />
          {error && <div className="text-rose-400 text-[11px] bg-rose-950/40 border border-rose-500/40 p-2 rounded-[2px]">{error}</div>}
          <div className="flex gap-2">
            <button type="button" onClick={() => reset('idle')} className="px-3 py-1.5 text-[11px] border border-white/30 text-gray-300 hover:text-white rounded-[2px]">
              Cancel
            </button>
            <button
              type="button"
              onClick={submitNewCode}
              disabled={busy}
              className="flex-1 py-1.5 bg-white text-black text-[11px] font-bold hover:bg-gray-200 disabled:opacity-40 rounded-[2px]"
            >
              {busy ? 'ISSUING...' : 'ISSUE NEW CODE'}
            </button>
          </div>
        </div>
      )}

      {mode === 'new-code' && issuedCode && (
        <div className="space-y-2">
          <div className="border-2 border-amber-400/70 bg-[#04101e] p-3 rounded-[2px]">
            <div className="text-[9px] text-gray-500 tracking-widest">NEW RECOVERY CODE — SHOWN ONCE</div>
            <div className="text-base font-bold tracking-[0.2em] text-amber-300 select-all">{issuedCode}</div>
          </div>
          <p className="text-[10px] text-gray-400">Take a screenshot now. The System will not show it again.</p>
          <button type="button" onClick={() => reset('idle')} className="w-full py-1.5 bg-white text-black text-[11px] font-bold hover:bg-gray-200 rounded-[2px]">
            I SAVED IT
          </button>
        </div>
      )}
    </div>
  );
}
