import { Shuffle, Check } from 'lucide-react';
import { toast } from 'sonner';
import type { Quest, UserProfile } from '@/lib/types';
import { addXP, getAllStoredQuests, getTodayKeyLocal, getUserProfile, saveQuests, saveUserProfile } from '@/lib/storage';
import { claimVariable } from '@/lib/daily-variable';
import { systemSound } from '@/lib/system-sound';

interface Props {
  quest: Quest;
  onProfileUpdated?: (profile: UserProfile) => void;
}

/**
 * Today's Daily Variable on its directive: the twist, its bonus, and — once the directive is
 * complete — a one-tap claim. Optional; ignoring it costs nothing.
 */
export default function VariablePanel({ quest, onProfileUpdated }: Props) {
  const v = quest.variable;
  if (!v) return null;

  const claim = () => {
    const bonus = claimVariable(getTodayKeyLocal());
    if (bonus <= 0) {
      toast.info('Variable already claimed today.');
      return;
    }
    const updated = addXP(getUserProfile(), bonus);
    saveUserProfile(updated);
    onProfileUpdated?.(updated);
    // Screens that read the stored list (the session page) see the claim at once.
    saveQuests(
      getAllStoredQuests().map((q) =>
        q.id === quest.id && q.variable ? { ...q, variable: { ...q.variable, claimed: true } } : q
      )
    );
    systemSound.playSuccess();
    toast.success('[VARIABLE CLEARED]', { description: `+${v.bonusXp} EXP. The System noticed.` });
  };

  return (
    <div
      className={`mb-4 border rounded-[2px] px-3 py-2.5 text-left font-mono ${
        v.claimed ? 'border-emerald-500/40 bg-emerald-950/15' : 'border-amber-400/50 bg-amber-950/15'
      }`}
    >
      <div className="flex items-center gap-1.5 text-[10px] font-bold tracking-[0.2em]">
        {v.claimed ? <Check className="w-3.5 h-3.5 text-emerald-300" /> : <Shuffle className="w-3.5 h-3.5 text-amber-300" />}
        <span className={v.claimed ? 'text-emerald-300' : 'text-amber-200'}>
          {v.claimed ? 'VARIABLE CLEARED' : 'DAILY VARIABLE'}
        </span>
        <span className="ml-auto text-[9px] font-normal tracking-normal text-white/45">
          optional · +{v.bonusXp} EXP
        </span>
      </div>
      <p className="mt-1 text-xs text-white leading-relaxed">{v.text}</p>
      {v.reason && !v.claimed && <p className="mt-0.5 text-[10px] text-white/45 italic leading-relaxed">THEIA: {v.reason}</p>}
      {!v.claimed && quest.completed && (
        <button
          type="button"
          onClick={claim}
          className="mt-2 w-full py-1.5 text-[11px] font-bold bg-white text-black hover:bg-gray-200 rounded-[2px]"
        >
          I APPLIED IT · CLAIM +{v.bonusXp} EXP
        </button>
      )}
    </div>
  );
}
