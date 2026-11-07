/**
 * Install-only access: the System runs as an installed app (home screen / desktop app), not in
 * a browser tab. Notifications on iPhone only work installed, and an installed app keeps its
 * own storage, so the whole experience is designed for it.
 *
 * Escape hatches (never shown to players): local development hosts, and `?access=browser`,
 * which this device then remembers (`?access=app` turns it off again).
 */

export type InstallPlatform =
  | 'ios' // iPhone / iPad: Share → Add to Home Screen (Safari; Chrome/Edge on iOS 16.4+ too)
  | 'in-app' // a browser inside another app (Instagram, Messenger, TikTok…): cannot install
  | 'android' // Chrome / Edge / Samsung Internet / Firefox on Android
  | 'desktop-chromium' // Chrome / Edge / Brave / Opera on a computer
  | 'desktop-safari' // Safari on a Mac: File → Add to Dock
  | 'desktop-firefox' // cannot install web apps
  | 'other';

const BROWSER_ACCESS_KEY = 'wrp_browser_access';

/** Running as an installed app right now. */
export function isStandaloneDisplay(): boolean {
  if (typeof window === 'undefined') return true;
  try {
    if ((navigator as any).standalone === true) return true; // iOS
    return ['standalone', 'fullscreen', 'minimal-ui', 'window-controls-overlay'].some(
      (mode) => window.matchMedia?.(`(display-mode: ${mode})`).matches
    );
  } catch {
    return false;
  }
}

function isDevHost(hostname: string): boolean {
  return (
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname === '[::1]' ||
    hostname.endsWith('.local') ||
    /^10\./.test(hostname) ||
    /^192\.168\./.test(hostname) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(hostname)
  );
}

/** Browser-tab access allowed on this device (development or the testing override). */
export function isBrowserAccessAllowed(): boolean {
  if (typeof window === 'undefined') return true;
  try {
    const params = new URLSearchParams(window.location.search);
    const access = params.get('access');
    if (access === 'browser') localStorage.setItem(BROWSER_ACCESS_KEY, '1');
    if (access === 'app') localStorage.removeItem(BROWSER_ACCESS_KEY);
    if (isDevHost(window.location.hostname)) return true;
    return localStorage.getItem(BROWSER_ACCESS_KEY) === '1';
  } catch {
    return false;
  }
}

export function detectInstallPlatform(): InstallPlatform {
  const ua = navigator.userAgent || '';
  if (/FBAN|FBAV|FB_IAB|Instagram|Messenger|Line\/|TikTok|musical_ly|Snapchat|Twitter|LinkedInApp|Pinterest|GSA\//i.test(ua)) {
    return 'in-app';
  }
  const ios = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  if (ios) return 'ios';
  if (/Android/i.test(ua)) {
    // Android WebViews inside apps carry "; wv)" and cannot install.
    if (/; wv\)/.test(ua)) return 'in-app';
    return 'android';
  }
  if (/Firefox\//.test(ua)) return 'desktop-firefox';
  if (/Edg\/|Chrome\/|OPR\/|Brave/.test(ua)) return 'desktop-chromium';
  if (/Safari\//.test(ua) && /Macintosh/.test(ua)) return 'desktop-safari';
  return 'other';
}

// ---------------------------------------------------------------------------
// Chromium's install prompt (Android + desktop). The event can fire before React mounts, so it
// is captured from main.tsx at startup and handed to whoever subscribes.
// ---------------------------------------------------------------------------

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

let deferredPrompt: BeforeInstallPromptEvent | null = null;
let installed = false;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((fn) => fn());

export function captureInstallPrompt(): void {
  if (typeof window === 'undefined') return;
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault(); // keep it for our own button instead of the browser's mini-infobar
    deferredPrompt = e as BeforeInstallPromptEvent;
    notify();
  });
  window.addEventListener('appinstalled', () => {
    installed = true;
    deferredPrompt = null;
    notify();
  });
}

export function onInstallStateChange(fn: () => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

export const canPromptInstall = () => Boolean(deferredPrompt);
export const wasJustInstalled = () => installed;

/** Shows the browser's install dialog. Must run from a tap/click. */
export async function promptInstall(): Promise<'accepted' | 'dismissed' | 'unavailable'> {
  const prompt = deferredPrompt;
  if (!prompt) return 'unavailable';
  deferredPrompt = null; // a prompt event can only be used once
  notify();
  try {
    await prompt.prompt();
    const choice = await prompt.userChoice;
    return choice.outcome;
  } catch {
    return 'unavailable';
  }
}
