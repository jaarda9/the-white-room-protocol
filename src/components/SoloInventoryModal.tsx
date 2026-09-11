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
  ArrowLeft,
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
        return <Droplets className="w-4 h-4 text-sky-400" />;
      case 'focusBrew':
        return <Coffee className="w-4 h-4 text-indigo-400" />;
      case 'coldExposure':
        return <Snowflake className="w-4 h-4 text-cyan-300" />;
      case 'activeRest':
        return <Sparkles className="w-4 h-4 text-emerald-400" />;
    }
  };

  const itemsList: ConsumableType[] = ['hydrate', 'focusBrew', 'coldExposure', 'activeRest'];

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 animate-fade-in font-mono">
      {/* Authentic Solo Leveling System Window */}
      <div className="relative max-w-[580px] w-full max-h-[92vh] flex flex-col bg-[#0a1b2e]/95 border-2 border-white/50 rounded-[4px] p-4 sm:p-7 text-white shadow-[0_0_35px_rgba(0,0,0,0.9),inset_0_0_24px_rgba(0,212,255,0.08)] backdrop-blur-md anime-dropdown font-mono">
        
        {/* Top Header Controls: Return button + Status indicator */}
        <div className="flex items-center justify-between pb-2 mb-3 border-b border-white/20 text-xs">
          <button
            type="button"
            onClick={() => {
              systemSound.playClick();
              onClose();
            }}
            className="flex items-center gap-1.5 text-cyan-300/80 hover:text-white transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>[ RETURN TO STATUS ]</span>
          </button>

          <div className="text-[11px] text-cyan-300/80 font-bold">
            RESET: [00:00 MIDNIGHT]
          </div>
        </div>

        {/* Top Header: Centered Box matching Status and Daily Quest Windows */}
        <div className="relative flex items-center justify-center pb-2 mb-1">
          <div className="inline-block px-7 sm:px-9 py-1 border border-white/70 bg-[#061426]/60 shadow-[0_0_14px_rgba(0,212,255,0.35)]">
            <div className="flex items-center gap-2">
              <Package className="w-4 h-4 text-[#9fd3ff]" />
              <span className="font-mono font-extrabold tracking-[0.28em] text-base sm:text-lg text-white anime-glow-text">
                INVENTORY
              </span>
            </div>
          </div>
        </div>

        {/* Subtitle Line */}
        <div className="text-center font-mono text-xs sm:text-sm text-white/90 mb-3">
          [Recovery items for biological restoration have arrived.]
        </div>

        {/* Canonical Double Underline Section Title */}
        <div className="text-center mb-3.5">
          <div className="inline-block border-b-2 border-t-0 border-white/70 pb-0.5">
            <div className="border-b border-white/40 pb-0.5">
              <span className="font-mono text-xs sm:text-sm font-bold text-white tracking-[0.25em] anime-glow-text px-4">
                CONSUMABLE ITEMS
              </span>
            </div>
          </div>
        </div>

        {/* Live Feedback Toast Banner */}
        {notice && (
          <div className="mb-3 px-3 py-1.5 rounded-[2px] bg-[#061426] border border-cyan-400 text-xs text-cyan-200 text-center font-bold shadow-[0_0_14px_rgba(0,212,255,0.4)] anime-glow-text animate-fade-in">
            {notice}
          </div>
        )}

        {/* Consumable Items List */}
        <div className="space-y-3 overflow-y-auto pr-1 flex-1 max-h-[58vh] scrollbar-thin">
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
                className="border border-white/40 bg-[#061424]/85 hover:border-cyan-400/60 rounded-[2px] p-3 sm:p-3.5 shadow-[inset_0_0_14px_rgba(0,212,255,0.06)] transition-all flex flex-col gap-2.5 relative"
              >
                {/* Top Row: Icon + Name + Category + Daily Counter */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-7 h-7 rounded-[2px] border border-white/30 bg-black/50 flex items-center justify-center shrink-0 shadow-[0_0_8px_rgba(0,212,255,0.2)]">
                      {renderIcon(id)}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono font-bold text-xs sm:text-sm text-white tracking-wide">
                          {config.name}
                        </span>
                        <span className="text-[9px] px-1.5 py-0.5 border border-white/20 rounded-[2px] text-cyan-300/80 bg-white/5 font-mono uppercase">
                          [{config.category}]
                        </span>
                      </div>
                      <div className="text-[11px] text-[#9fd3ff] font-semibold tracking-wide mt-0.5 anime-glow-text">
                        EFFECT: {config.effectDescription}
                      </div>
                    </div>
                  </div>

                  {/* Daily Quota Counter */}
                  <div className="text-right shrink-0">
                    <div className="text-[9px] text-white/50 uppercase tracking-wider font-mono">
                      DAILY USES
                    </div>
                    <div
                      className={`text-xs font-bold font-mono ${
                        isMaxed ? 'text-emerald-400' : 'text-[#9fd3ff]'
                      }`}
                    >
                      [{state.usedToday} / {config.dailyMax}]
                    </div>
                  </div>
                </div>

                {/* Real-World Action Requirement */}
                <div className="text-[10px] text-white/70 font-mono leading-relaxed pl-2.5 border-l-2 border-white/25 bg-black/20 py-1 pr-2 rounded-[1px]">
                  <span className="text-white/40 uppercase text-[9px] tracking-wider font-bold mr-1.5">
                    DIRECTIVE:
                  </span>
                  {config.realWorldAction}
                </div>

                {/* Bottom Action / Cooldown Control */}
                <div className="flex items-center justify-between pt-0.5 gap-2 flex-wrap">
                  {/* Cooldown / Limit Status Indicator */}
                  <div className="text-[10px] text-white/70 font-mono flex items-center gap-1.5">
                    {isMaxed ? (
                      <span className="text-emerald-400 flex items-center gap-1 font-bold">
                        <Check className="w-3.5 h-3.5" />
                        [ DAILY QUOTA COMPLETE ]
                      </span>
                    ) : onCooldown ? (
                      <span className="text-amber-400 flex items-center gap-1 font-mono font-bold animate-pulse">
                        <Clock className="w-3.5 h-3.5 animate-spin text-amber-400" />
                        [ COOLDOWN: {remMin}m {remSec < 10 ? `0${remSec}` : remSec}s ]
                      </span>
                    ) : (
                      <span className="text-cyan-300/80 flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5 text-cyan-400/70" />
                        [ COOLDOWN: {config.cooldownMinutes}M ]
                      </span>
                    )}
                  </div>

                  {/* Action Button */}
                  <button
                    type="button"
                    disabled={isMaxed || onCooldown}
                    onClick={() => handleConsume(id)}
                    className={`px-3.5 py-1 rounded-[2px] text-xs font-bold font-mono tracking-wider transition-all flex items-center gap-1 shrink-0 ${
                      isMaxed
                        ? 'border border-emerald-500/30 bg-emerald-950/20 text-emerald-400/50 cursor-not-allowed'
                        : onCooldown
                        ? 'border border-white/20 bg-black/40 text-white/40 cursor-not-allowed'
                        : 'border border-white/70 bg-white/10 hover:bg-cyan-500/30 hover:border-cyan-300 text-white shadow-[0_0_10px_rgba(0,212,255,0.25)] hover:shadow-[0_0_16px_rgba(0,212,255,0.5)] active:scale-95 cursor-pointer'
                    }`}
                  >
                    {isMaxed ? (
                      '[ COMPLETED ]'
                    ) : onCooldown ? (
                      <span>[ LOCKED ({remMin}:{remSec < 10 ? `0${remSec}` : remSec}) ]</span>
                    ) : (
                      <span>[ USE ITEM ]</span>
                    )}
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* System Warning Notice Bar */}
        <div className="border border-white/30 bg-[#061424]/85 p-2.5 sm:p-3 rounded-[2px] text-[10px] sm:text-[11px] text-white/80 space-y-1 mt-3">
          <div className="text-[#9fd3ff] font-bold tracking-wider flex items-center gap-1.5">
            <AlertCircle className="w-3.5 h-3.5 text-[#9fd3ff]" />
            [ SYSTEM NOTICE ]
          </div>
          <p className="text-white/70 leading-relaxed">
            Biological energy replenishment is strictly paced by human digestive and metabolic limits. All item quotas automatically reset daily at 00:00 midnight.
          </p>
        </div>

        {/* Bottom Return Button */}
        <div className="mt-3 flex justify-center">
          <button
            type="button"
            onClick={() => {
              systemSound.playClick();
              onClose();
            }}
            className="px-6 py-1.5 border border-white/50 hover:border-white bg-[#061426]/70 hover:bg-white/10 rounded-[2px] text-xs font-mono tracking-widest text-white/90 hover:text-white transition-all cursor-pointer shadow-[0_0_10px_rgba(0,0,0,0.5)]"
          >
            [ CLOSE INVENTORY ]
          </button>
        </div>

      </div>
    </div>
  );
};
