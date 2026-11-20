import { useEffect, useState } from 'react';
import { Scale } from 'lucide-react';
import { toast } from 'sonner';
import { systemSound } from '@/lib/system-sound';
import { getTodayKey } from '@/lib/nutrition-lab';
import { daysBetweenKeys, getWeighInState, isWeighInDue, logWeighIn, weeklyTrend } from '@/lib/weigh-in';

/**
 * Nutrition page: the weekly weigh-in. Due -> one input; otherwise one quiet line with the last
 * weight, the trend and any calorie correction the System made from it.
 */
export default function WeighInCard({ currentKg, onLogged }: { currentKg: number; onLogged: () => void }) {
  const [state, setState] = useState(() => getWeighInState());
  const [value, setValue] = useState('');
  // Weigh-ins logged on another device arrive with a sync restore.
  useEffect(() => {
    const reread = () => setState(getWeighInState());
    window.addEventListener('wrp:quests-updated', reread);
    return () => window.removeEventListener('wrp:quests-updated', reread);
  }, []);
  const today = getTodayKey();
  const due = isWeighInDue(state, today);
  const last = state.entries[state.entries.length - 1];
  const trend = weeklyTrend(state.entries, today);

  const submit = () => {
    const kg = parseFloat((value || String(currentKg)).replace(',', '.'));
    const res = logWeighIn(kg, today);
    if (!res) {
      toast.error('Enter a weight between 30 and 250 kg.');
      return;
    }
    systemSound.playClick();
    setState(res.state);
    setValue('');
    toast(res.change !== 0 ? '[SYSTEM] CALORIES CORRECTED' : '[SYSTEM] WEIGH-IN RECORDED', { description: res.message });
    onLogged();
  };

  const adjust = state.adjustKcal;
  return (
    <div className="mb-4 p-2.5 border border-white/25 bg-[#061426]/80 rounded-[2px] text-xs">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-1.5 font-bold text-white text-[11px] tracking-wider">
          <Scale className="w-3.5 h-3.5 text-cyan-400" />
          WEEKLY WEIGH-IN
          {!due && last && (
            <span className="font-normal text-white/55 tracking-normal">
              · {last.kg} kg · next in {7 - daysBetweenKeys(last.date, today)} d
            </span>
          )}
        </div>
        {adjust !== 0 && (
          <span className="text-[10px] px-1.5 py-0.5 border border-amber-400/50 text-amber-200 rounded-[2px]" title="Correction from your weight trend, applied to your daily target">
            {adjust > 0 ? '+' : ''}
            {adjust} kcal/day from trend
          </span>
        )}
      </div>
      {trend && !due && (
        <div className="text-[10px] text-white/50 mt-1">
          Trend: {trend.kgPerWeek > 0 ? '+' : ''}
          {trend.kgPerWeek} kg/week over {Math.round(trend.spanDays / 7)} weeks
        </div>
      )}
      {due && (
        <div className="mt-2 space-y-1.5">
          <p className="text-[10px] text-white/55 leading-snug">
            {state.entries.length === 0
              ? 'Once a week, same conditions (morning, before eating). After two weeks the System reads your trend and corrects your calories.'
              : 'A week has passed. Same conditions as last time.'}
          </p>
          <div className="flex items-center gap-2">
            <input
              inputMode="decimal"
              aria-label="Weight in kg"
              value={value}
              onChange={(e) => setValue(e.target.value.slice(0, 6))}
              placeholder={String(currentKg)}
              className="w-24 px-2 py-1 bg-black/60 border border-white/30 rounded-[2px] text-white text-xs placeholder:text-white/40 focus:border-cyan-400 focus:outline-none"
            />
            <span className="text-white/50 text-[11px]">kg</span>
            <button type="button" onClick={submit} className="px-3 py-1 border border-cyan-400/60 bg-cyan-950/50 text-white text-[11px] font-bold rounded-[2px] hover:bg-cyan-900/60">
              LOG WEIGHT
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
