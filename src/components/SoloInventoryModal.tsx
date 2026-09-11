import { useState, useEffect } from 'react';
import {
  UserProfile,
  ConsumableType,
  ConsumableConfig,
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
  X,
  Clock,
  Check,
  AlertCircle,
  Package,
} from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onProfileUpdated?: (profile: UserProfile) => void;
}

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
    }, 3200);
  };

  const renderIcon = (type: ConsumableType) => {
    switch (type) {
      case 'hydrate':
        return <Droplets className="w-5 h-5 text-sky-400" />;
      case 'focusBrew':
        return <Coffee className="w-5 h-5 text-indigo-400" />;
      case 'coldExposure':
        return <Snowflake className="w-5 h-5 text-cyan-300" />;
      case 'activeRest':
        return <Sparkles className="w-5 h-5 text-emerald-400" />;
    }
  };

  const getBorderTheme = (type: ConsumableType) => {
    switch (type) {
      case 'hydrate':
        return 'border-sky-500/40 bg-sky-950/20';
      case 'focusBrew':
        return 'border-indigo-500/40 bg-indigo-950/20';
      case 'coldExposure':
        return 'border-cyan-500/40 bg-cyan-950/20';
      case 'activeRest':
        return 'border-emerald-500/40 bg-emerald-950/20';
    }
  };

  const itemsList: ConsumableType[] = ['hydrate', 'focusBrew', 'coldExposure', 'activeRest'];

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 animate-fade-in font-mono">
      {/* Holographic Inventory Window */}
      <div className="relative max-w-xl w-full max-h-[92vh] flex flex-col bg-[#0a1b2e]/95 border-2 border-cyan-500/70 rounded-[4px] p-4 sm:p-6 text-white shadow-[0_0_40px_rgba(0,0,0,0.95),inset_0_0_30px_rgba(0,212,255,0.12)]">
        
        {/* Header Bar */}
        <div className="flex items-center justify-between pb-3 border-b border-cyan-500/30">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-[2px] bg-cyan-950/60 border border-cyan-400/50 flex items-center justify-center shadow-[0_0_10px_rgba(0,212,255,0.4)]">
              <Package className="w-4 h-4 text-cyan-300" />
            </div>
            <div>
              <div className="text-xs sm:text-sm font-bold tracking-widest text-cyan-300 drop-shadow-[0_0_8px_rgba(0,212,255,0.6)]">
                [ SYSTEM INVENTORY : RECOVERY ]
              </div>
              <div className="text-[9px] sm:text-[10px] text-white/50 tracking-wider">
                BIOLOGICAL ENERGY REPLENISHMENT & PACED PROTOCOLS
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              systemSound.playClick();
              onClose();
            }}
            className="w-7 h-7 rounded-[2px] border border-white/30 bg-black/40 hover:bg-white/10 hover:border-white/60 text-white/70 hover:text-white flex items-center justify-center transition-colors"
            title="Close Inventory"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Live Feedback Toast Banner */}
        {notice && (
          <div className="mt-3 px-3 py-1.5 rounded bg-cyan-950/80 border border-cyan-400 text-[11px] text-cyan-200 text-center font-bold shadow-[0_0_12px_rgba(0,212,255,0.4)] anime-glow-text animate-fade-in">
            {notice}
          </div>
        )}

        {/* Consumable Items List */}
        <div className="mt-3.5 space-y-3 overflow-y-auto pr-1 flex-1 max-h-[65vh] scrollbar-thin">
          {itemsList.map((id) => {
            const config = CONSUMABLE_CONFIGS[id];
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

            return (
              <div
                key={id}
                className={`p-3 sm:p-3.5 rounded-[3px] border transition-all ${getBorderTheme(
                  id
                )} flex flex-col gap-2 relative overflow-hidden`}
              >
                {/* Top Row: Icon + Name + Category + Daily Counter */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="p-1.5 rounded bg-black/50 border border-white/20 shrink-0">
                      {renderIcon(id)}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-xs sm:text-[13px] text-white tracking-wide">
                          {config.name}
                        </span>
                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-white/10 text-white/70">
                          {config.category}
                        </span>
                      </div>
                      <div className="text-[10px] text-cyan-300/90 font-semibold tracking-wide mt-0.5">
                        {config.effectDescription}
                      </div>
                    </div>
                  </div>

                  {/* Daily Quota Counter */}
                  <div className="text-right shrink-0">
                    <div className="text-[9px] text-white/50 uppercase tracking-wider">
                      Daily Uses
                    </div>
                    <div
                      className={`text-xs font-bold font-mono ${
                        isMaxed ? 'text-emerald-400' : 'text-cyan-300'
                      }`}
                    >
                      {state.usedToday} / {config.dailyMax}
                    </div>
                  </div>
                </div>

                {/* Real-World Action Requirement */}
                <div className="px-2.5 py-1.5 rounded bg-black/40 border border-white/10 text-[10px] text-white/80 leading-relaxed">
                  <span className="text-white/40 uppercase text-[9px] tracking-wider block mb-0.5 font-bold">
                    Physical Action Directives:
                  </span>
                  {config.realWorldAction}
                </div>

                {/* Bottom Action / Cooldown Control */}
                <div className="flex items-center justify-between pt-1 gap-2 flex-wrap">
                  {/* Cooldown / Limit Status Indicator */}
                  <div className="text-[10px] text-white/60 flex items-center gap-1.5">
                    {isMaxed ? (
                      <span className="text-emerald-400 flex items-center gap-1 font-bold">
                        <Check className="w-3.5 h-3.5" />
                        Daily Quota Complete (Resets 00:00)
                      </span>
                    ) : onCooldown ? (
                      <span className="text-amber-400 flex items-center gap-1 font-mono">
                        <Clock className="w-3.5 h-3.5 animate-spin text-amber-400" />
                        Digestive Cooldown: {remMin}m {remSec < 10 ? `0${remSec}` : remSec}s
                      </span>
                    ) : (
                      <span className="text-cyan-400/80 flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5 text-cyan-400/60" />
                        Cooldown: {config.cooldownMinutes}m
                      </span>
                    )}
                  </div>

                  {/* Action Button */}
                  <button
                    type="button"
                    disabled={isMaxed || onCooldown}
                    onClick={() => handleConsume(id)}
                    className={`px-3 sm:px-4 py-1.5 rounded-[2px] text-xs font-bold tracking-wider transition-all flex items-center gap-1.5 shrink-0 ${
                      isMaxed
                        ? 'bg-emerald-950/40 border border-emerald-500/40 text-emerald-300/60 cursor-not-allowed'
                        : onCooldown
                        ? 'bg-black/50 border border-amber-500/30 text-amber-300/50 cursor-not-allowed'
                        : 'bg-cyan-500/20 hover:bg-cyan-500/35 border border-cyan-400/70 text-cyan-200 hover:text-white shadow-[0_0_10px_rgba(0,212,255,0.25)] hover:shadow-[0_0_16px_rgba(0,212,255,0.5)] active:scale-95 cursor-pointer'
                    }`}
                  >
                    {isMaxed ? (
                      'LIMIT REACHED'
                    ) : onCooldown ? (
                      <span>LOCKED ({remMin}:{remSec < 10 ? `0${remSec}` : remSec})</span>
                    ) : (
                      <span>[ CONSUME ITEM ]</span>
                    )}
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer Note */}
        <div className="mt-3 pt-2.5 border-t border-white/10 flex items-center justify-between text-[9px] text-white/50">
          <div className="flex items-center gap-1.5">
            <AlertCircle className="w-3 h-3 text-cyan-400/70 shrink-0" />
            <span>Paced by biological digestion, absorption, and neurochemical reset times.</span>
          </div>
          <span className="text-cyan-400/80 font-mono">Quotas reset at 00:00</span>
        </div>

      </div>
    </div>
  );
};
