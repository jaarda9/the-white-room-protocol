import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, Copy, ShoppingCart, X } from 'lucide-react';
import { toast } from 'sonner';
import { systemSound } from '@/lib/system-sound';
import { useLockBodyScroll } from '@/hooks/use-lock-body-scroll';
import {
  buildSupplyList,
  getNutritionWeek,
  SECTION_LABELS,
  supplyListText,
  SUPPLY_RUN_XP,
  toggleSupplyItem,
  type GrocerySection,
  type NutritionWeek,
} from '@/lib/nutrition-week';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  /** Called once per week, when every item is checked for the first time. */
  onSupplyRunComplete: () => void;
}

/** The week's groceries, grouped by store section, checkable in the store (synced). */
export default function SupplyListModal({ isOpen, onClose, onSupplyRunComplete }: Props) {
  useLockBodyScroll(isOpen);
  const [week, setWeek] = useState<NutritionWeek | null>(null);

  useEffect(() => {
    if (isOpen) setWeek(getNutritionWeek());
  }, [isOpen]);

  const items = useMemo(() => (week ? buildSupplyList(week) : []), [week]);
  if (!isOpen || !week) return null;

  const done = items.filter((i) => week.checked.includes(i.key)).length;
  const sections = (Object.keys(SECTION_LABELS) as GrocerySection[]).filter((s) => items.some((i) => i.section === s));

  const toggle = (key: string) => {
    const { week: next, completedNow } = toggleSupplyItem(key);
    if (next) setWeek(next);
    if (completedNow) {
      systemSound.playQuestComplete();
      onSupplyRunComplete();
    }
  };

  const share = async () => {
    systemSound.playClick();
    const text = supplyListText(week);
    try {
      if (navigator.share) {
        await navigator.share({ title: 'Supply Run', text });
        return;
      }
    } catch {
      // cancelled or unsupported: fall back to copying
    }
    try {
      await navigator.clipboard.writeText(text);
      toast.success('SUPPLY LIST COPIED');
    } catch {
      toast.error('Could not copy the list.');
    }
  };

  return createPortal(
    <div className="modal-safe-pad fixed inset-0 z-[75] bg-black/85 backdrop-blur-sm flex items-center justify-center animate-fade-in font-mono">
      <div className="relative w-full max-w-lg bg-[#0a1b2e]/95 border-2 border-white/50 rounded-[4px] text-white shadow-[0_0_35px_rgba(0,0,0,0.9),inset_0_0_24px_rgba(0,212,255,0.08)] anime-dropdown modal-card-max-h flex flex-col my-auto">
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/15">
          <div className="px-3 py-1 border border-white/70 bg-[#061426]/70 shadow-[0_0_12px_rgba(0,212,255,0.3)] flex items-center gap-2">
            <ShoppingCart className="w-3.5 h-3.5 text-[#9fd3ff]" />
            <span className="font-extrabold tracking-[0.2em] text-sm text-white anime-glow-text">SUPPLY RUN</span>
          </div>
          <button type="button" onClick={() => { systemSound.playClick(); onClose(); }} aria-label="Close supply list" className="w-7 h-7 rounded-[2px] border border-white/30 hover:border-white/70 bg-black/40 text-white/70 hover:text-white flex items-center justify-center">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-4 pt-3 flex items-center justify-between gap-2 text-[11px]">
          <span className={done === items.length ? 'text-emerald-300 font-bold' : 'text-white/70'}>
            [{done}/{items.length}] {done === items.length ? 'SUPPLY RUN COMPLETE' : `for 7 days · +${SUPPLY_RUN_XP} EXP when complete`}
          </span>
          <button type="button" onClick={share} className="px-2.5 py-1 border border-cyan-400/50 text-cyan-200 hover:bg-cyan-950/50 rounded-[2px] flex items-center gap-1 text-[10px] font-bold">
            <Copy className="w-3 h-3" /> SHARE / COPY
          </button>
        </div>
        <div className="px-4 pt-1 text-[10px] text-white/40">Tick what you buy, or what you already have at home.</div>

        <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-3 text-xs">
          {sections.map((section) => (
            <div key={section}>
              <div className="text-[10px] font-bold text-[#9fd3ff] uppercase tracking-wider mb-1">{SECTION_LABELS[section]}</div>
              <div className="space-y-1">
                {items
                  .filter((i) => i.section === section)
                  .map((item) => {
                    const checked = week.checked.includes(item.key);
                    return (
                      <button
                        key={item.key}
                        type="button"
                        onClick={() => toggle(item.key)}
                        aria-pressed={checked}
                        className={`w-full flex items-center gap-2.5 px-2.5 py-2 border rounded-[2px] text-left transition-all ${
                          checked ? 'border-emerald-500/30 bg-emerald-950/20 text-white/40 line-through' : 'border-white/15 bg-black/30 text-white/90 hover:border-white/35'
                        }`}
                      >
                        <span className={`w-4 h-4 shrink-0 border rounded-[2px] flex items-center justify-center ${checked ? 'border-emerald-400 text-emerald-300' : 'border-white/40'}`}>
                          {checked && <Check className="w-3 h-3 stroke-[3]" />}
                        </span>
                        <span className="text-[12px]">{item.label}</span>
                      </button>
                    );
                  })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>,
    document.body,
  );
}
