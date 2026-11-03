import { useEffect, useState } from 'react';
import { CalendarOff } from 'lucide-react';
import { toast } from 'sonner';
import { systemSound } from '@/lib/system-sound';
import {
  ABSENCES_UPDATED_EVENT,
  ABSENCE_REASON_LABEL,
  MAX_ABSENCE_DAYS,
  declareAbsence,
  getAbsenceEndKey,
  getActiveAbsences,
  getTomorrowKey,
  withdrawAbsence,
  type AbsenceReason,
  type DeclaredAbsence,
} from '@/lib/absences';

const todayKey = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

/** Declare an absence in advance — declared days never count as failures (see absences.ts). */
export default function AbsenceDeclarationPanel() {
  const [list, setList] = useState<DeclaredAbsence[]>(() => getActiveAbsences());
  const [open, setOpen] = useState(false);
  const [from, setFrom] = useState(getTomorrowKey());
  const [days, setDays] = useState(1);
  const [reason, setReason] = useState<AbsenceReason>('travel');

  useEffect(() => {
    const sync = () => setList(getActiveAbsences());
    window.addEventListener(ABSENCES_UPDATED_EVENT, sync);
    return () => window.removeEventListener(ABSENCES_UPDATED_EVENT, sync);
  }, []);

  const onDeclare = () => {
    systemSound.playClick();
    try {
      const a = declareAbsence(from, days, reason);
      toast.success('[SYSTEM] ABSENCE ACKNOWLEDGED', {
        description: `${a.from} → ${a.to}. The System will not judge these days.`,
      });
      setOpen(false);
    } catch (err: any) {
      toast.error('[SYSTEM] DECLARATION REJECTED', { description: err?.message || 'Invalid declaration.' });
    }
  };

  const onWithdraw = (id: string) => {
    systemSound.playClick();
    try {
      withdrawAbsence(id);
      toast('[SYSTEM] DECLARATION WITHDRAWN');
    } catch (err: any) {
      toast.error('[SYSTEM] CANNOT WITHDRAW', { description: err?.message });
    }
  };

  const today = todayKey();
  const field = 'bg-[#061426] border border-white/25 rounded-[2px] px-1 py-0.5 text-white font-mono text-[10px]';

  return (
    <div className="mt-3.5 pt-3.5 border-t border-white/20">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="text-[10px] text-[#9fd3ff] tracking-wider uppercase font-bold flex items-center gap-1.5">
          <CalendarOff className="w-3.5 h-3.5 text-cyan-400" />
          <span>DECLARED ABSENCE</span>
          <span className="text-[10px] font-normal text-white/40 lowercase">
            {list.length ? `(${list.length} on record)` : '(none)'}
          </span>
        </div>
        <button
          onClick={() => {
            systemSound.playClick();
            setOpen((v) => !v);
          }}
          className="text-[10px] text-cyan-300 hover:text-white border border-cyan-400/50 hover:border-cyan-300 bg-cyan-950/40 px-2 py-0.5 rounded-[2px] transition-all cursor-pointer"
        >
          {open ? '[ CANCEL ]' : '[ DECLARE ABSENCE ]'}
        </button>
      </div>

      {list.length > 0 && (
        <div className="mt-2 space-y-1">
          {list.map((a) => (
            <div key={a.id} className="flex items-center justify-between gap-2 text-[10px] p-1.5 bg-black/30 border border-white/15 rounded-[2px]">
              <span className="text-gray-300 font-mono">
                {a.from === a.to ? a.from : `${a.from} → ${a.to}`} · {ABSENCE_REASON_LABEL[a.reason]}
              </span>
              {a.from > today ? (
                <button onClick={() => onWithdraw(a.id)} className="text-gray-400 hover:text-white">
                  [ WITHDRAW ]
                </button>
              ) : (
                <span className="text-cyan-300/80 uppercase">In effect</span>
              )}
            </div>
          ))}
        </div>
      )}

      {open && (
        <div className="mt-2 p-2 rounded bg-black/30 border border-white/15 space-y-2 text-[10px]">
          <div className="flex items-center gap-3 flex-wrap">
            <label className="flex items-center gap-1.5 text-gray-400 uppercase">
              From
              <input type="date" value={from} min={getTomorrowKey()} onChange={(e) => setFrom(e.target.value)} className={field} />
            </label>
            <label className="flex items-center gap-1.5 text-gray-400 uppercase">
              Days
              <select value={days} onChange={(e) => setDays(Number(e.target.value))} className={field}>
                {Array.from({ length: MAX_ABSENCE_DAYS }, (_, i) => i + 1).map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex items-center gap-1.5 text-gray-400 uppercase">
              Reason
              <select value={reason} onChange={(e) => setReason(e.target.value as AbsenceReason)} className={field}>
                {(Object.keys(ABSENCE_REASON_LABEL) as AbsenceReason[]).map((r) => (
                  <option key={r} value={r}>
                    {ABSENCE_REASON_LABEL[r]}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <span className="text-white/50">
              Until {from ? getAbsenceEndKey(from, days) : '—'} · must be declared in advance, max {MAX_ABSENCE_DAYS} days
            </span>
            <button
              onClick={onDeclare}
              className="px-2 py-0.5 border border-cyan-400 bg-cyan-950/70 text-cyan-200 hover:text-white rounded-[2px] font-bold"
            >
              [ SUBMIT TO THE SYSTEM ]
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
