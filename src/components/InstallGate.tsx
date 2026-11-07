import { useEffect, useState } from 'react';
import { Download, Share, PlusSquare, MoreVertical, ExternalLink, Monitor, CheckCircle2, AlertTriangle, Copy } from 'lucide-react';
import {
  canPromptInstall,
  detectInstallPlatform,
  onInstallStateChange,
  promptInstall,
  wasJustInstalled,
  type InstallPlatform,
} from '@/lib/install-mode';

const panel =
  'relative bg-[#0a1b2e]/95 border-2 border-white/50 rounded-[4px] p-6 sm:p-8 max-w-md w-full text-white shadow-[0_0_35px_rgba(0,0,0,0.85),inset_0_0_24px_rgba(0,212,255,0.1)] backdrop-blur-md space-y-5 anime-dropdown font-mono';

function Step({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-3 text-left">
      <span className="shrink-0 w-6 h-6 border border-[#00d4ff]/60 bg-[#00d4ff]/10 text-[#00d4ff] text-xs font-bold flex items-center justify-center rounded-[2px]">
        {n}
      </span>
      <span className="text-xs text-gray-200 leading-relaxed pt-0.5">{children}</span>
    </li>
  );
}

/**
 * Shown instead of the app in a normal browser tab. The System only runs installed: on iPhone
 * that is the only way notifications work, and everywhere it gives a full-screen app with its
 * own icon. Instructions are specific to the device the page is opened on.
 */
export default function InstallGate() {
  const [platform] = useState<InstallPlatform>(() => detectInstallPlatform());
  const [canPrompt, setCanPrompt] = useState(canPromptInstall());
  const [installed, setInstalled] = useState(wasJustInstalled());
  const [copied, setCopied] = useState(false);

  useEffect(
    () =>
      onInstallStateChange(() => {
        setCanPrompt(canPromptInstall());
        setInstalled(wasJustInstalled());
      }),
    []
  );

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.origin);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // clipboard blocked; the address is shown on screen
    }
  };

  const installButton = canPrompt ? (
    <button
      type="button"
      onClick={async () => {
        const outcome = await promptInstall();
        if (outcome === 'accepted') setInstalled(true);
      }}
      className="w-full py-3 bg-white text-black text-sm font-black hover:bg-gray-200 transition-all rounded-[2px] shadow-[0_0_20px_rgba(0,212,255,0.4)] flex items-center justify-center gap-2"
    >
      <Download className="w-4 h-4" /> INSTALL THE SYSTEM
    </button>
  ) : null;

  return (
    <div className="min-h-screen bg-[#071322] flex items-center justify-center px-4 py-8 system-blueprint-bg font-mono">
      <div className={panel}>
        <div className="text-center space-y-3">
          <img
            src="/app-icon-v5-192.png"
            alt=""
            className="w-16 h-16 mx-auto rounded-[14px] drop-shadow-[0_0_16px_rgba(0,212,255,0.45)]"
          />
          <div className="inline-flex items-center gap-2 px-5 py-1.5 border border-white/60 bg-[#061426]/90 shadow-[0_0_12px_rgba(0,212,255,0.3)]">
            <span className="w-2.5 h-2.5 rounded-full bg-[#00d4ff] animate-pulse" />
            <h1 className="font-bold text-sm text-white anime-glow-text tracking-widest">INSTALLATION REQUIRED</h1>
          </div>
          <p className="text-xs text-gray-300 leading-relaxed">
            The System does not run inside a browser tab. Install it on this device: it opens full-screen from its own
            icon, and it can reach you with notifications.
          </p>
        </div>

        {installed && (
          <div className="flex items-start gap-2 p-3 border border-emerald-500/50 bg-emerald-950/30 rounded-[2px] text-xs text-emerald-200">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
            <span>Installed. Open "White Room" from your home screen or app list. You can close this tab.</span>
          </div>
        )}

        {!installed && platform === 'ios' && (
          <ol className="space-y-3">
            <Step n={1}>
              Tap the <Share className="inline w-3.5 h-3.5 -mt-0.5 text-[#00d4ff]" /> <b>Share</b> button (bottom bar in
              Safari; in Chrome or Edge it is in the address bar).
            </Step>
            <Step n={2}>
              Scroll down and tap <PlusSquare className="inline w-3.5 h-3.5 -mt-0.5 text-[#00d4ff]" />{' '}
              <b>Add to Home Screen</b>.
            </Step>
            <Step n={3}>
              Tap <b>Add</b>, then open the System from its new icon on your home screen.
            </Step>
          </ol>
        )}

        {!installed && platform === 'android' && (
          <div className="space-y-4">
            {installButton}
            <ol className="space-y-3">
              {canPrompt && <li className="text-[11px] text-gray-400">If the button does nothing:</li>}
              <Step n={1}>
                Open the browser menu <MoreVertical className="inline w-3.5 h-3.5 -mt-0.5 text-[#00d4ff]" /> (top right).
              </Step>
              <Step n={2}>
                Tap <b>Install app</b> or <b>Add to Home screen</b>.
              </Step>
              <Step n={3}>Open the System from its new icon.</Step>
            </ol>
          </div>
        )}

        {!installed && platform === 'desktop-chromium' && (
          <div className="space-y-4">
            {installButton}
            <ol className="space-y-3">
              {canPrompt && <li className="text-[11px] text-gray-400">Or by hand:</li>}
              <Step n={1}>
                Click the <Monitor className="inline w-3.5 h-3.5 -mt-0.5 text-[#00d4ff]" /> <b>install</b> icon at the
                right end of the address bar (or menu ⋯ → <b>Apps</b> → <b>Install</b>).
              </Step>
              <Step n={2}>Confirm. The System opens in its own window and appears in your apps.</Step>
            </ol>
          </div>
        )}

        {!installed && platform === 'desktop-safari' && (
          <ol className="space-y-3">
            <Step n={1}>
              In the menu bar, open <b>File</b> → <b>Add to Dock…</b> (macOS Sonoma or later).
            </Step>
            <Step n={2}>Click <b>Add</b>, then open the System from the Dock.</Step>
          </ol>
        )}

        {!installed && (platform === 'in-app' || platform === 'desktop-firefox' || platform === 'other') && (
          <div className="space-y-3">
            <div className="flex items-start gap-2 p-3 border border-amber-500/50 bg-amber-950/20 rounded-[2px] text-xs text-amber-100 leading-relaxed">
              <AlertTriangle className="w-4 h-4 shrink-0 text-amber-400" />
              <span>
                {platform === 'in-app'
                  ? 'This page is open inside another app, which cannot install the System. Open it in your real browser: Safari on iPhone, Chrome on Android.'
                  : platform === 'desktop-firefox'
                    ? 'Firefox cannot install web apps on a computer. Open this address in Chrome, Edge or Safari.'
                    : 'This browser cannot install the System. Open this address in Safari (iPhone, Mac) or Chrome / Edge (Android, PC).'}
              </span>
            </div>
            {platform === 'in-app' && (
              <p className="text-[11px] text-gray-400 flex items-center gap-1.5">
                <ExternalLink className="w-3.5 h-3.5" /> Look for "Open in browser" in this app's ⋯ menu.
              </p>
            )}
            <button
              type="button"
              onClick={copyLink}
              className="w-full py-2 border border-[#00d4ff]/50 bg-[#061c33] text-xs text-[#9fd3ff] hover:text-white hover:border-[#00d4ff] rounded-[2px] flex items-center justify-center gap-2 transition-colors"
            >
              <Copy className="w-3.5 h-3.5" /> {copied ? 'LINK COPIED' : `COPY ${window.location.host}`}
            </button>
          </div>
        )}

        <p className="text-[10px] text-gray-500 text-center leading-relaxed">
          Already a Hunter? After installing, sign in inside the app with your Subject ID and PIN.
        </p>
      </div>
    </div>
  );
}
