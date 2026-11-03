/**
 * System Uplink — browser side of Web Push (server: api/push.ts, display: public/sw.js).
 *
 * Permission is per-site: granting it here never enables notifications for other sites.
 * It can still be silenced above us (OS notification settings, browser-wide block, Focus mode),
 * which the page cannot detect — hence the test transmission.
 */

export type UplinkStatus =
  | 'unsupported' // browser has no Push API
  | 'ios-needs-install' // iPhone/iPad Safari tab: push only works from the home-screen app
  | 'denied' // player (or browser policy) blocked this site
  | 'off' // supported, not subscribed on this device
  | 'on'; // subscribed on this device

const isIOS = () =>
  /iPad|iPhone|iPod/.test(navigator.userAgent) ||
  (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

const isStandalone = () =>
  window.matchMedia?.('(display-mode: standalone)').matches || (navigator as any).standalone === true;

export const isPushSupported = (): boolean =>
  typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;

const getRegistration = async (): Promise<ServiceWorkerRegistration | null> => {
  if (!('serviceWorker' in navigator)) return null;
  return (await navigator.serviceWorker.getRegistration()) || null;
};

export const getUplinkStatus = async (): Promise<UplinkStatus> => {
  if (isIOS() && !isStandalone()) return 'ios-needs-install';
  if (!isPushSupported()) return 'unsupported';
  if (Notification.permission === 'denied') return 'denied';
  const reg = await getRegistration();
  const sub = await reg?.pushManager.getSubscription();
  return sub && Notification.permission === 'granted' ? 'on' : 'off';
};

const urlBase64ToUint8Array = (base64: string): Uint8Array<ArrayBuffer> => {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, '+').replace(/_/g, '/'));
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
};

const describeDevice = (): string => {
  const ua = navigator.userAgent;
  const os = /Android/i.test(ua) ? 'Android' : isIOS() ? 'iOS' : /Windows/i.test(ua) ? 'Windows' : /Mac/i.test(ua) ? 'macOS' : 'Other';
  const browser = /Edg\//.test(ua) ? 'Edge' : /Chrome\//.test(ua) ? 'Chrome' : /Firefox\//.test(ua) ? 'Firefox' : /Safari\//.test(ua) ? 'Safari' : 'Browser';
  return `${os} · ${browser}${isStandalone() ? ' (app)' : ''}`;
};

/** Must be called from a user gesture (button tap) — browsers block or auto-deny otherwise. */
export const enableUplink = async (subjectId: string): Promise<UplinkStatus> => {
  if (!subjectId) throw new Error('No Subject ID bound to this device.');
  const status = await getUplinkStatus();
  if (status === 'unsupported' || status === 'ios-needs-install' || status === 'denied') return status;

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return permission === 'denied' ? 'denied' : 'off';

  const reg = (await getRegistration()) || (await navigator.serviceWorker.ready);
  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    const keyRes = await fetch('/api/push?action=key');
    if (!keyRes.ok) throw new Error('Server uplink is not configured.');
    const { publicKey } = await keyRes.json();
    try {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      });
    } catch (err: any) {
      // Site permission is granted at this point, so a refusal here comes from the browser's own push
      // service: Brave (Google push service off by default), private windows, OS/extension/policy blocks.
      const isBrave = Boolean((navigator as any).brave);
      throw new Error(
        isBrave
          ? 'Brave blocks push by default. Enable brave://settings/privacy → "Use Google services for push messaging", restart Brave, then retry.'
          : `Your browser refused push registration (${err?.message || 'unknown'}). Leave private/incognito mode, allow notifications for this browser in your OS settings, or disable privacy extensions, then retry.`
      );
    }
  }

  const res = await fetch('/api/push', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'subscribe', subjectId, subscription: sub.toJSON(), deviceLabel: describeDevice() }),
  });
  if (!res.ok) throw new Error('Failed to register this device with the System.');
  return 'on';
};

export const disableUplink = async (): Promise<void> => {
  const reg = await getRegistration();
  const sub = await reg?.pushManager.getSubscription();
  if (!sub) return;
  await fetch('/api/push', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'unsubscribe', endpoint: sub.endpoint }),
  }).catch(() => {});
  await sub.unsubscribe();
};

export const sendTestTransmission = async (subjectId: string): Promise<{ sent: number; devices: number }> => {
  const res = await fetch('/api/push', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'test', subjectId }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || 'Transmission failed.');
  return { sent: data.sent || 0, devices: data.devices || 0 };
};
