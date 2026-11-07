import { useState } from 'react';
import { Check, Copy, ShieldAlert, IdCard } from 'lucide-react';
import { systemSound } from '@/lib/system-sound';

interface HunterLicenseCardProps {
  subjectId: string;
  recoveryCode?: string;
  hunterName?: string;
  onContinue: () => void;
  continueLabel?: string;
}

/**
 * Shown once after registration, after the first PIN on an older account, and after a PIN
 * recovery. The recovery code is never stored by the app: this card is the player's only copy,
 * so they must save it (screenshot) before moving on.
 */
export default function HunterLicenseCard({
  subjectId,
  recoveryCode,
  hunterName,
  onContinue,
  continueLabel = 'CONTINUE >',
}: HunterLicenseCardProps) {
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    const text = `White Room Protocol — Hunter License\nSubject ID: ${subjectId}${
      recoveryCode ? `\nRecovery code: ${recoveryCode}` : ''
    }`;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      systemSound.playClick();
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // clipboard blocked: the screenshot path still works
    }
  };

  return (
    <div className="relative bg-[#0a1b2e]/95 border-2 border-white/50 rounded-[4px] p-6 sm:p-8 max-w-md w-full text-center text-white shadow-[0_0_35px_rgba(0,0,0,0.85),inset_0_0_24px_rgba(0,212,255,0.1)] backdrop-blur-md space-y-5 anime-dropdown font-mono">
      <div className="inline-block px-5 py-1.5 border border-white/70 bg-[#061426]/70 shadow-[0_0_14px_rgba(0,212,255,0.35)]">
        <div className="font-bold text-sm sm:text-base text-white anime-glow-text tracking-wider flex items-center justify-center gap-2">
          <IdCard className="w-4 h-4 text-[#00d4ff]" />
          <span>[ HUNTER LICENSE ISSUED ]</span>
        </div>
      </div>

      {/* The license itself — designed to be screenshotted. */}
      <div className="border-2 border-[#00d4ff] bg-[#04101e] p-4 rounded-[3px] shadow-[0_0_25px_rgba(0,212,255,0.25)] text-left space-y-3">
        <div className="flex items-center justify-between border-b border-[#00d4ff]/30 pb-2">
          <span className="text-[10px] text-[#9fd3ff] tracking-[0.25em]">HUNTERS ASSOCIATION</span>
          <span className="text-[10px] text-gray-500">WHITE ROOM PROTOCOL</span>
        </div>
        {hunterName && (
          <div>
            <div className="text-[9px] text-gray-500 tracking-widest">HUNTER</div>
            <div className="text-sm font-bold text-white truncate">{hunterName}</div>
          </div>
        )}
        <div>
          <div className="text-[9px] text-gray-500 tracking-widest">SUBJECT ID (LOGIN)</div>
          <div className="text-2xl font-bold tracking-[0.3em] text-[#00d4ff] select-all">{subjectId}</div>
        </div>
        {recoveryCode && (
          <div>
            <div className="text-[9px] text-gray-500 tracking-widest">RECOVERY CODE (IF YOU FORGET YOUR PIN)</div>
            <div className="text-base sm:text-lg font-bold tracking-[0.2em] text-amber-300 select-all">{recoveryCode}</div>
          </div>
        )}
        <button
          type="button"
          onClick={copy}
          className="inline-flex items-center gap-2 px-3 py-1.5 border border-[#00d4ff]/40 hover:border-[#00d4ff] bg-[#061c33] text-xs text-[#9fd3ff] hover:text-white transition-colors rounded-[2px]"
        >
          {copied ? (
            <>
              <Check className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-emerald-400 font-bold">COPIED</span>
            </>
          ) : (
            <>
              <Copy className="w-3.5 h-3.5" />
              <span>COPY LICENSE</span>
            </>
          )}
        </button>
      </div>

      <div className="border border-amber-500/50 bg-amber-950/20 p-3.5 rounded-[2px] text-left text-xs space-y-1.5">
        <div className="text-amber-400 font-bold flex items-center gap-1.5">
          <ShieldAlert className="w-4 h-4 flex-shrink-0" />
          <span>TAKE A SCREENSHOT NOW</span>
        </div>
        <p className="text-gray-300 text-[11px] leading-relaxed">
          Your Subject ID and PIN open your account on any device.
          {recoveryCode
            ? ' The recovery code is the only way back in if you forget your PIN, and the System will never show it again.'
            : ''}{' '}
          Never share them: the System will never ask for them.
        </p>
      </div>

      <label className="flex items-center justify-center gap-2 text-xs text-gray-200 cursor-pointer select-none">
        <input
          type="checkbox"
          checked={saved}
          onChange={(e) => setSaved(e.target.checked)}
          className="accent-[#00d4ff] w-4 h-4 rounded"
        />
        <span>I have saved my Hunter License</span>
      </label>

      <button
        type="button"
        onClick={() => {
          systemSound.playClick();
          onContinue();
        }}
        disabled={!saved}
        className="w-full py-2.5 bg-white text-black text-xs font-bold hover:bg-gray-200 transition-all disabled:opacity-40 disabled:hover:bg-white rounded-[2px] shadow-[0_0_15px_rgba(0,212,255,0.3)]"
      >
        {continueLabel}
      </button>
    </div>
  );
}
