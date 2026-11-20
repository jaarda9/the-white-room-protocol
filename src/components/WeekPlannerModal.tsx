import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Bed, CalendarDays, Check, Dumbbell, Loader2, X } from 'lucide-react';
import { toast } from 'sonner';
import { systemSound } from '@/lib/system-sound';
import { useLockBodyScroll } from '@/hooks/use-lock-body-scroll';
import { DEFAULT_FOOD_PROFILE, getFoodProfile, saveFoodProfile, type DietStyle, type FoodProfile } from '@/lib/nutrition-lab';
import {
  acceptNutritionWeek,
  buildSupplyList,
  dayIngredients,
  designNutritionWeek,
  formatIngredient,
  SLOT_ORDER,
  type NutritionWeek,
} from '@/lib/nutrition-week';
import type { UserProfile } from '@/lib/types';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  profile: UserProfile;
  /** 'plan' designs a new week; 'view' shows the active one. */
  mode: 'plan' | 'view';
  week?: NutritionWeek | null;
  onAccepted: (week: NutritionWeek) => void;
}

const SLOT_LABEL = { breakfast: 'Breakfast', lunch: 'Lunch', snack: 'Pre-training snack', dinner: 'Dinner' } as const;
const DAY_SHORT = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
const dayName = (key: string) => {
  const [y, m, d] = key.split('-').map(Number);
  return DAY_SHORT[new Date(y, m - 1, d).getDay()];
};
const chip = (active: boolean) =>
  `px-2.5 py-1.5 rounded-[2px] border text-[11px] font-mono transition-all ${
    active ? 'border-cyan-400 bg-cyan-950/70 text-white shadow-[0_0_8px_rgba(0,212,255,0.3)]' : 'border-white/20 bg-black/30 text-white/60 hover:border-white/40 hover:text-white'
  }`;
const label = 'text-[10px] font-bold text-[#9fd3ff] uppercase tracking-wider mb-1.5';

/** The week, day by day: day type, the four meals, tap a day to see ingredients. */
export function WeekView({ week }: { week: NutritionWeek }) {
  const [open, setOpen] = useState<string | null>(null);
  return (
    <div className="space-y-1.5">
      {week.days.map((day) => {
        const isOpen = open === day.date;
        return (
          <div key={day.date} className="border border-white/20 bg-[#061424]/85 rounded-[2px]">
            <button type="button" onClick={() => setOpen(isOpen ? null : day.date)} className="w-full text-left p-2.5 hover:bg-white/5">
              <div className="flex items-center gap-2 text-[11px] font-bold text-white">
                {dayName(day.date)}
                <span className={`flex items-center gap-1 font-normal ${day.dayType === 'rest' ? 'text-white/45' : 'text-cyan-300/85'}`}>
                  {day.dayType === 'rest' ? <Bed className="w-3 h-3" /> : <Dumbbell className="w-3 h-3" />}
                  {day.dayType === 'rest' ? 'Rest day · lighter carbs' : 'Training day'}
                </span>
              </div>
              <div className="text-[10px] text-white/60 mt-0.5 leading-snug">
                {SLOT_ORDER.map((slot) => week.recipes.find((r) => r.id === day.recipeIds[slot])?.name).filter(Boolean).join(' · ')}
              </div>
            </button>
            {isOpen && (
              <div className="px-2.5 pb-2.5 space-y-2 border-t border-white/10 pt-2">
                {SLOT_ORDER.map((slot) => {
                  const r = week.recipes.find((x) => x.id === day.recipeIds[slot]);
                  if (!r) return null;
                  return (
                    <div key={slot} className="text-[11px]">
                      <div className="text-white font-bold">
                        {slot === 'snack' && day.dayType === 'rest' ? 'Snack' : SLOT_LABEL[slot]}: <span className="font-normal text-cyan-200">{r.name}</span> <span className="text-white/40">· {r.prepMinutes} min</span>
                      </div>
                      <div className="text-white/65">{dayIngredients(r, day).map(formatIngredient).join(', ')}</div>
                      {r.howTo && !(slot === 'snack' && day.dayType === 'rest') && <div className="text-white/40 italic">{r.howTo}</div>}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default function WeekPlannerModal({ isOpen, onClose, profile, mode, week, onAccepted }: Props) {
  useLockBodyScroll(isOpen);
  const [step, setStep] = useState<'profile' | 'loading' | 'preview'>('profile');
  const [food, setFood] = useState<FoodProfile>(DEFAULT_FOOD_PROFILE);
  const [hadProfile, setHadProfile] = useState(false);
  const [draft, setDraft] = useState<NutritionWeek | null>(null);
  const runId = useRef(0);

  useEffect(() => {
    if (!isOpen) return;
    const saved = getFoodProfile();
    setFood(saved || DEFAULT_FOOD_PROFILE);
    setHadProfile(!!saved);
    setDraft(null);
    setStep('profile');
  }, [isOpen]);

  if (!isOpen) return null;
  const set = <K extends keyof FoodProfile>(k: K, v: FoodProfile[K]) => setFood((f) => ({ ...f, [k]: v }));

  const close = () => {
    runId.current++;
    systemSound.playClick();
    onClose();
  };

  const design = async () => {
    systemSound.playClick();
    const saved = saveFoodProfile(food);
    const id = ++runId.current;
    setStep('loading');
    const next = await designNutritionWeek(profile, saved);
    if (id !== runId.current) return;
    setDraft(next);
    setStep('preview');
    if (next.origin === 'system') toast.warning('THEIA UNREACHABLE', { description: 'The System built your week from its own recipe library.' });
  };

  const accept = () => {
    if (!draft) return;
    acceptNutritionWeek(draft, profile);
    systemSound.playClick();
    toast.success('WEEKLY RATIONS SET', { description: 'Today’s meals now follow your week. Your Supply List is ready.' });
    onAccepted(draft);
    onClose();
  };

  const viewing = mode === 'view' && week;
  const shown = viewing ? week : draft;

  return createPortal(
    <div className="modal-safe-pad fixed inset-0 z-[75] bg-black/85 backdrop-blur-sm flex items-center justify-center animate-fade-in font-mono">
      <div className="relative w-full max-w-2xl bg-[#0a1b2e]/95 border-2 border-white/50 rounded-[4px] text-white shadow-[0_0_35px_rgba(0,0,0,0.9),inset_0_0_24px_rgba(0,212,255,0.08)] anime-dropdown modal-card-max-h flex flex-col my-auto">
        <div className="flex items-center justify-between px-4 sm:px-5 py-3 border-b border-white/15">
          <div className="px-3 py-1 border border-white/70 bg-[#061426]/70 shadow-[0_0_12px_rgba(0,212,255,0.3)] flex items-center gap-2">
            <CalendarDays className="w-3.5 h-3.5 text-[#9fd3ff]" />
            <span className="font-extrabold tracking-[0.2em] text-sm text-white anime-glow-text">WEEKLY RATIONS</span>
          </div>
          <button type="button" onClick={close} aria-label="Close weekly rations" className="w-7 h-7 rounded-[2px] border border-white/30 hover:border-white/70 bg-black/40 text-white/70 hover:text-white flex items-center justify-center">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-5 space-y-4 text-xs">
          {!viewing && step === 'profile' && (
            <>
              <p className="text-[11px] text-white/70 leading-relaxed">
                {hadProfile
                  ? 'THEIA plans 7 days of meals around your training days and writes your Supply List. Check your food rules, then go.'
                  : 'First time: tell THEIA how you eat. Asked once, you can change it any time.'}
              </p>
              <div>
                <div className={label}>FOOD RULES</div>
                <div className="flex flex-wrap gap-1.5">
                  <button type="button" className={chip(food.halal)} onClick={() => set('halal', !food.halal)}>
                    {food.halal ? '✓ ' : '+ '}Halal
                  </button>
                  {(['any', 'vegetarian', 'pescatarian', 'vegan'] as DietStyle[]).map((d) => (
                    <button key={d} type="button" className={chip(food.diet === d)} onClick={() => set('diet', d)}>
                      {d === 'any' ? 'I eat everything' : d[0].toUpperCase() + d.slice(1)}
                    </button>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <div className={label}>ALLERGIES (NEVER INCLUDED)</div>
                  <input value={food.allergies} onChange={(e) => set('allergies', e.target.value.slice(0, 120))} placeholder="e.g. peanuts, lactose" className="w-full px-2.5 py-1.5 bg-black/60 border border-white/30 rounded-[2px] text-white text-xs placeholder:text-white/30 focus:border-cyan-400 focus:outline-none" />
                </div>
                <div>
                  <div className={label}>FOODS YOU DISLIKE</div>
                  <input value={food.dislikes} onChange={(e) => set('dislikes', e.target.value.slice(0, 120))} placeholder="e.g. mushrooms, salmon" className="w-full px-2.5 py-1.5 bg-black/60 border border-white/30 rounded-[2px] text-white text-xs placeholder:text-white/30 focus:border-cyan-400 focus:outline-none" />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <div className={label}>BUDGET</div>
                  <div className="flex gap-1.5">
                    {(['tight', 'normal', 'flexible'] as const).map((b) => (
                      <button key={b} type="button" className={chip(food.budget === b)} onClick={() => set('budget', b)}>
                        {b.toUpperCase()}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <div className={label}>TIME TO COOK</div>
                  <div className="flex gap-1.5">
                    {([['quick', '≤15 MIN'], ['normal', '~30 MIN'], ['enjoy', 'I LIKE COOKING']] as const).map(([v, l]) => (
                      <button key={v} type="button" className={chip(food.cookTime === v)} onClick={() => set('cookTime', v)}>
                        {l}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </>
          )}

          {!viewing && step === 'loading' && (
            <div className="py-14 flex flex-col items-center gap-3 text-center">
              <Loader2 className="w-7 h-7 text-cyan-300 animate-spin" />
              <div className="text-sm font-bold tracking-[0.2em] text-white anime-glow-text">THEIA IS PLANNING YOUR WEEK</div>
              <div className="text-[11px] text-white/50">Recipes that share ingredients, sized to your targets. Up to a minute.</div>
            </div>
          )}

          {shown && (viewing || step === 'preview') && (
            <>
              <div className="flex items-center justify-between gap-2 text-[11px]">
                <span className="text-white/70">
                  {shown.recipes.length} recipes · {buildSupplyList(shown).length} items on the Supply List
                </span>
                {shown.origin === 'system' && <span className="text-amber-300/80 text-[10px]">System recipes</span>}
              </div>
              <WeekView week={shown} />
              {!viewing && <p className="text-[10px] text-white/40">Training days get bigger carb portions, rest days smaller. Your weekly total stays on target.</p>}
            </>
          )}
        </div>

        {!viewing && step !== 'loading' && (
          <div className="px-4 sm:px-5 py-3 border-t border-white/15 flex justify-end gap-2">
            {step === 'profile' && (
              <button type="button" onClick={design} className="px-4 py-2 border border-cyan-400 bg-cyan-950/70 text-white font-bold text-xs tracking-wider rounded-[2px] hover:bg-cyan-900/70 flex items-center gap-1.5">
                <CalendarDays className="w-3.5 h-3.5" /> PLAN MY WEEK
              </button>
            )}
            {step === 'preview' && (
              <>
                <button type="button" onClick={() => setStep('profile')} className="px-3 py-2 border border-white/30 text-white/70 hover:text-white text-xs rounded-[2px]">
                  CHANGE / RETRY
                </button>
                <button type="button" onClick={accept} className="px-4 py-2 border border-emerald-400 bg-emerald-950/60 text-emerald-200 font-bold text-xs tracking-wider rounded-[2px] hover:bg-emerald-900/60 flex items-center gap-1.5">
                  <Check className="w-3.5 h-3.5" /> USE THIS WEEK
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
