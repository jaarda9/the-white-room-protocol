import { useEffect, useState } from 'react';
import { BellRing } from 'lucide-react';
import { toast } from 'sonner';
import { systemSound } from '@/lib/system-sound';
import {
  disableUplink,
  enableUplink,
  fetchUplinkPrefs,
  getDeviceTimezone,
  getUplinkStatus,
  saveUplinkPrefs,
  sendTestTransmission,
  type UplinkPrefs,
  type UplinkStatus,
} from '@/lib/push-notifications';

const SCHEDULE_TOGGLES: Array<{
  key: 'arrival' | 'warning' | 'penalty' | 'emergency' | 'gates' | 'comms';
  label: string;
}> = [
  { key: 'arrival', label: 'Quest Arrival' },
  { key: 'warning', label: 'Evening Warning' },
  { key: 'penalty', label: 'Penalty Alerts' },
  { key: 'emergency', label: 'Emergency Quests' },
  { key: 'gates', label: 'Gate Deadlines' },
  { key: 'comms', label: 'Hunter Comms' },
];

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

  const [prefs, setPrefs] = useState<UplinkPrefs | null>(null);

  useEffect(() => {
    getUplinkStatus().then(setStatus).catch(() => setStatus('unsupported'));
  }, []);

  // Once linked, load the schedule and keep the server's timezone matching this device —
  // every scheduled transmission is computed server-side in this timezone.
  useEffect(() => {
    if (status !== 'on' || !subjectId) return;
    let cancelled = false;
    (async () => {
      try {
        const { prefs: stored, saved } = await fetchUplinkPrefs(subjectId);
        const tz = getDeviceTimezone();
        const next = !saved || stored.timezone !== tz ? await saveUplinkPrefs(subjectId, { timezone: tz }) : stored;
        if (!cancelled) setPrefs(next);
      } catch {
        // schedule controls just stay hidden; test/sever still work
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [status, subjectId]);

  const updatePrefs = async (patch: Partial<UplinkPrefs>) => {
    if (!prefs || !subjectId) return;
    const previous = prefs;
    setPrefs({ ...prefs, ...patch });
    try {
      setPrefs(await saveUplinkPrefs(subjectId, patch));
    } catch (err: any) {
      setPrefs(previous);
      toast.error('[SYSTEM] SCHEDULE NOT SAVED', { description: err?.message || 'Unknown failure.' });
    }
  };

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
      {status === 'on' && prefs && (
        <div className="mt-2 p-2 rounded bg-black/30 border border-white/15 space-y-2 text-[10px]">
          <div className="flex items-center gap-3 flex-wrap">
            <label className="flex items-center gap-1.5 text-gray-400 uppercase">
              Wake
              <input
                type="time"
                value={prefs.wakeTime}
                onChange={(e) => e.target.value && updatePrefs({ wakeTime: e.target.value })}
                className="bg-[#061426] border border-white/25 rounded-[2px] px-1 py-0.5 text-white font-mono"
              />
            </label>
            <label className="flex items-center gap-1.5 text-gray-400 uppercase">
              Warning
              <input
                type="time"
                value={prefs.warningTime}
                onChange={(e) => e.target.value && updatePrefs({ warningTime: e.target.value })}
                className="bg-[#061426] border border-white/25 rounded-[2px] px-1 py-0.5 text-white font-mono"
              />
            </label>
            <span className="text-white/40 font-mono">{prefs.timezone}</span>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            {SCHEDULE_TOGGLES.map(({ key, label }) => (
              <label key={key} className="flex items-center gap-1.5 text-gray-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={prefs[key]}
                  onChange={(e) => updatePrefs({ [key]: e.target.checked })}
                  className="accent-cyan-400"
                />
                {label}
              </label>
            ))}
          </div>
          <p className="text-white/40 leading-relaxed">
            A single failure is reported at wake time. Repeated failures break through at midnight.
          </p>
        </div>
      )}
    </div>
  );
}
