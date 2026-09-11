import { useState, useEffect } from 'react';
import {
  UserProfile,
  ConsumableType,
  InventoryState,
} from '@/lib/types';
import {
  CONSUMABLE_CONFIGS,
  getHunterInventory,
  consumeInventoryItem,
  INVENTORY_UPDATED_EVENT,
} from '@/lib/storage';
import { systemSound } from '@/lib/system-sound';
import {
  Droplets,
  Coffee,
  Snowflake,
  Sparkles,
  Clock,
  Check,
  AlertCircle,
  Package,
  X,
} from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onProfileUpdated?: (profile: UserProfile) => void;
}

// Compact, crystal-clear summaries for each item: real-world action + stat benefits
const ITEM_SUMMARIES: Record<ConsumableType, { directive: string; effect: string; cdLabel: string }> = {
  hydrate: {
    directive: 'Drink 1 glass of fresh water (250–300ml)',
    effect: '+15 STM • -5% Fatigue',
    cdLabel: '15m CD',
  },
  focusBrew: {
    directive: '1 cup of coffee, matcha, or tea',
    effect: '+25 MP',
    cdLabel: '60m CD',
  },
  coldExposure: {
    directive: '1–3m cold shower or cold face splash',
    effect: '+20 MP • +10 STM • -10% Fatigue',
    cdLabel: '3h CD',
  },
  activeRest: {
    directive: '5m box breathing, posture reset, or stretch',
    effect: '+5 HP • -10% Fatigue',
    cdLabel: '45m CD',
  },
};

export const SoloInventoryModal = ({ isOpen, onClose, onProfileUpdated }: Props) => {
  const [inventory, setInventory] = useState<InventoryState>(getHunterInventory());
  const [now, setNow] = useState<number>(Date.now());
  const [notice, setNotice] = useState<string | null>(null);

  // Sync inventory and live 1-second ticker for active cooldown timers
  useEffect(() => {
    if (!isOpen) return;

    const syncInv = () => setInventory(getHunterInventory());
    syncInv();

    const timer = setInterval(() => {
      setNow(Date.now());
    }, 1000);

    window.addEventListener(INVENTORY_UPDATED_EVENT, syncInv);
    window.addEventListener('storage', syncInv);

    return () => {
      clearInterval(timer);
      window.removeEventListener(INVENTORY_UPDATED_EVENT, syncInv);
      window.removeEventListener('storage', syncInv);
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const handleConsume = (id: ConsumableType) => {
    systemSound.playClick();
    const result = consumeInventoryItem(id);

    if (result.success) {
      systemSound.playSuccess?.();
      setNotice(result.message);
      if (result.profile) {
        onProfileUpdated?.(result.profile);
      }
      setInventory(result.inventory);
    } else {
      setNotice(result.message);
    }

    setTimeout(() => {
      setNotice(null);
    }, 3000);
  };

  const renderIcon = (type: ConsumableType) => {
    switch (type) {
      case 'hydrate':
        return <Droplets className="w-4 h-4 text-sky-400 shrink-0" />;
      case 'focusBrew':
        return <Coffee className="w-4 h-4 text-indigo-400 shrink-0" />;
      case 'coldExposure':
        return <Snowflake className="w-4 h-4 text-cyan-300 shrink-0" />;
      case 'activeRest':
        return <Sparkles className="w-4 h-4 text-emerald-400 shrink-0" />;
    }
  };

  const itemsList: ConsumableType[] = ['hydrate', 'focusBrew', 'coldExposure', 'activeRest'];

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 animate-fade-in font-mono">
      {/* Streamlined Solo Leveling System Window */}
      <div className="relative max-w-[560px] w-full bg-[#0a1b2e]/95 border-2 border-white/50 rounded-[4px] p-4 sm:p-5 text-white shadow-[0_0_35px_rgba(0,0,0,0.9),inset_0_0_24px_rgba(0,212,255,0.08)] font-mono">
        
        {/* Top Header Bar: Title Box + Close Icon */}
        <div className="flex items-center justify-between pb-2 mb-2 border-b border-white/15">
          <div className="flex items-center gap-2">
            <div className="px-3 py-1 border border-white/70 bg-[#061426]/70 shadow-[0_0_12px_rgba(0,212,255,0.3)] flex items-center gap-2">
              <Package className="w-3.5 h-3.5 text-[#9fd3ff]" />
              <span className="font-mono font-extrabold tracking-[0.24em] text-sm sm:text-base text-white anime-glow-text">
                INVENTORY
              </span>
            </div>
            <span className="text-[10px] text-cyan-300/70 font-mono hidden sm:inline">
              [BIOLOGICAL RECOVERY]
            </span>
          </div>

          <button
            type="button"
            onClick={() => {
              systemSound.playClick();
              onClose();
            }}
            className="w-7 h-7 rounded-[2px] border border-white/30 hover:border-white/70 bg-black/40 hover:bg-white/10 text-white/70 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
            title="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Live Feedback Notification Banner */}
        {notice && (
          <div className="mb-2.5 px-3 py-1 rounded-[2px] bg-[#061426] border border-cyan-400 text-xs text-cyan-200 text-center font-bold shadow-[0_0_12px_rgba(0,212,255,0.4)] anime-glow-text animate-fade-in">
            {notice}
          </div>
        )}

        {/* Consumable Items List: Clean horizontal rows */}
        <div className="space-y-2">
          {itemsList.map((id) => {
            const config = CONSUMABLE_CONFIGS[id];
            const summary = ITEM_SUMMARIES[id];
            const state = inventory.items[id] || { usedToday: 0, lastUsedAt: null };
            const isMaxed = state.usedToday >= config.dailyMax;

            // Cooldown calculation
            let onCooldown = false;
            let cooldownRemainingSec = 0;
            if (state.lastUsedAt) {
              const elapsedSec = (now - state.lastUsedAt) / 1000;
              const maxSec = config.cooldownMinutes * 60;
              if (elapsedSec < maxSec) {
                onCooldown = true;
                cooldownRemainingSec = Math.ceil(maxSec - elapsedSec);
              }
            }

            const remMin = Math.floor(cooldownRemainingSec / 60);
            const remSec = cooldownRemainingSec % 60;
            const timeFormatted = `${remMin}:${remSec < 10 ? `0${remSec}` : remSec}`;

            return (
              <div
                key={id}
                className="border border-white/30 hover:border-cyan-400/60 bg-[#061424]/85 rounded-[2px] p-2.5 sm:px-3 sm:py-2.5 shadow-[inset_0_0_12px_rgba(0,212,255,0.05)] transition-all flex items-center justify-between gap-3"
              >
                {/* Left: Icon + Name + Clear 1-Line Info */}
                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                  <div className="w-8 h-8 rounded-[2px] border border-white/25 bg-black/60 flex items-center justify-center shrink-0 shadow-[0_0_8px_rgba(0,212,255,0.15)]">
                    {renderIcon(id)}
                  </div>

                  <div className="min-w-0 flex-1">
                    {/* Item Name + Effect Badge */}
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono font-bold text-xs sm:text-sm text-white tracking-wide truncate">
                        {config.name}
                      </span>
                      <span className="text-[10px] sm:text-[11px] text-[#9fd3ff] font-semibold anime-glow-text whitespace-nowrap">
                        {summary.effect}
                      </span>
                    </div>

                    {/* Real-world directive requirement */}
                    <div className="text-[10px] text-white/60 font-mono truncate mt-0.5">
                      {summary.directive}
                    </div>
                  </div>
                </div>

                {/* Right: Daily Usage Counter + Action Button */}
                <div className="flex flex-col items-end gap-1 shrink-0">
                  <div className="flex items-center gap-1.5 text-[10px] font-mono">
                    <span className="text-white/40 text-[9px] uppercase hidden xs:inline">DAILY</span>
                    <span
                      className={`font-bold ${
                        isMaxed ? 'text-emerald-400' : 'text-[#9fd3ff]'
                      }`}
                    >
                      [{state.usedToday}/{config.dailyMax}]
                    </span>
                  </div>

                  <button
                    type="button"
                    disabled={isMaxed || onCooldown}
                    onClick={() => handleConsume(id)}
                    className={`min-w-[95px] sm:min-w-[105px] py-1 px-2.5 rounded-[2px] text-[11px] font-bold font-mono tracking-wider transition-all flex items-center justify-center gap-1 shrink-0 ${
                      isMaxed
                        ? 'border border-emerald-500/30 bg-emerald-950/20 text-emerald-400/60 cursor-not-allowed'
                        : onCooldown
                        ? 'border border-amber-500/30 bg-amber-950/20 text-amber-300/80 cursor-not-allowed'
                        : 'border border-white/70 bg-white/10 hover:bg-cyan-500/30 hover:border-cyan-300 text-white shadow-[0_0_10px_rgba(0,212,255,0.25)] hover:shadow-[0_0_14px_rgba(0,212,255,0.45)] active:scale-95 cursor-pointer'
                    }`}
                  >
                    {isMaxed ? (
                      <span className="flex items-center gap-1 text-[10px]">
                        <Check className="w-3 h-3 text-emerald-400" />
                        COMPLETED
                      </span>
                    ) : onCooldown ? (
                      <span className="flex items-center gap-1 text-amber-300 font-mono">
                        <Clock className="w-3 h-3 animate-spin text-amber-400" />
                        {timeFormatted}
                      </span>
                    ) : (
                      <span>[ USE ITEM ]</span>
                    )}
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Minimal Footer: Single-line system notice + midnight reset note */}
        <div className="mt-3 pt-2 border-t border-white/10 flex items-center justify-between text-[9px] sm:text-[10px] text-white/50 font-mono gap-2">
          <div className="flex items-center gap-1.5 min-w-0 truncate">
            <AlertCircle className="w-3 h-3 text-cyan-400/70 shrink-0" />
            <span className="truncate">Paced by biological limits.</span>
          </div>
          <span className="text-cyan-400/80 shrink-0 font-semibold">
            Resets at 00:00
          </span>
        </div>

      </div>
    </div>
  );
};
