import { useEffect, useState } from 'react';
import { BellRing } from 'lucide-react';
import { toast } from 'sonner';
import { systemSound } from '@/lib/system-sound';
import {
  disableUplink,
  enableUplink,
  getUplinkStatus,
  sendTestTransmission,
  type UplinkStatus,
} from '@/lib/push-notifications';

const STATUS_LABEL: Record<UplinkStatus, string> = {
  on: '(linked on this device)',
  off: '(offline on this device)',
  denied: '(blocked by browser)',
  unsupported: '(not supported by this browser)',
  'ios-needs-install': '(install to home screen first)',
};

const STATUS_HINT: Partial<Record<UplinkStatus, string>> = {
  denied:
    'Notifications for this site were blocked. Open the site settings (lock icon in the address bar, or the app info screen) → Notifications → Allow, then return.',
  unsupported: 'This browser cannot receive System transmissions. Use Chrome, Edge, Firefox, or the installed app.',
  'ios-needs-install':
    'On iPhone/iPad the System can only reach you from the installed app: Share → Add to Home Screen, then open it from there (iOS 16.4+).',
};

/** Phase 1 of "the System speaks first": link this device and fire a test transmission. */
export default function SystemUplinkPanel({ subjectId }: { subjectId?: string }) {
  const [status, setStatus] = useState<UplinkStatus | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    getUplinkStatus().then(setStatus).catch(() => setStatus('unsupported'));
  }, []);

  const run = async (fn: () => Promise<void>) => {
    systemSound.playClick();
    setBusy(true);
    try {
      await fn();
    } catch (err: any) {
      toast.error('[SYSTEM] UPLINK ERROR', { description: err?.message || 'Unknown failure.' });
    } finally {
      setBusy(false);
      setStatus(await getUplinkStatus().catch(() => 'unsupported' as UplinkStatus));
    }
  };

  const onEnable = () =>
    run(async () => {
      const next = await enableUplink(subjectId || '');
      if (next === 'on') toast.success('[SYSTEM] UPLINK ESTABLISHED', { description: 'This device is now bound. Send a test transmission.' });
    });

  const onTest = () =>
    run(async () => {
      const { sent, devices } = await sendTestTransmission(subjectId || '');
      toast.success('[SYSTEM] TRANSMISSION SENT', {
        description: `Delivered to ${sent}/${devices} device(s). Nothing arrived? Check OS notification settings and Focus / Do Not Disturb.`,
      });
    });

  const onDisable = () =>
    run(async () => {
      await disableUplink();
      toast('[SYSTEM] UPLINK SEVERED', { description: 'This device will no longer receive transmissions.' });
    });

  const btn =
    'text-[10px] border px-2 py-0.5 rounded-[2px] transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed';

  return (
    <div className="mt-3.5 pt-3.5 border-t border-white/20">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="text-[10px] text-[#9fd3ff] tracking-wider uppercase font-bold flex items-center gap-1.5 flex-wrap">
          <BellRing className="w-3.5 h-3.5 text-cyan-400" />
          <span>SYSTEM UPLINK</span>
          {status && (
            <span className={`text-[10px] font-normal lowercase ${status === 'on' ? 'text-cyan-300/80' : 'text-white/40'}`}>
              {STATUS_LABEL[status]}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          {status === 'off' && (
            <button onClick={onEnable} disabled={busy} className={`${btn} text-cyan-300 hover:text-white border-cyan-400/50 hover:border-cyan-300 bg-cyan-950/40`}>
              [ GRANT SYSTEM ACCESS ]
            </button>
          )}
          {status === 'on' && (
            <>
              <button onClick={onTest} disabled={busy} className={`${btn} text-cyan-300 hover:text-white border-cyan-400/50 hover:border-cyan-300 bg-cyan-950/40`}>
                [ TEST TRANSMISSION ]
              </button>
              <button onClick={onDisable} disabled={busy} className={`${btn} text-gray-400 hover:text-white border-white/25 hover:border-white/50 bg-black/30`}>
                [ SEVER ]
              </button>
            </>
          )}
        </div>
      </div>
      {status && STATUS_HINT[status] && <p className="mt-1.5 text-[10px] text-white/50 leading-relaxed">{STATUS_HINT[status]}</p>}
    </div>
  );
}
