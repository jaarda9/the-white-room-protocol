import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Info } from 'lucide-react';
import { systemSound } from '@/lib/system-sound';

export interface SystemNotification {
  id: string;
  text: string;
  action?: () => void;
  read?: boolean;
}

interface Props {
  onSelectDailyQuest?: () => void;
  onClose?: () => void;
}

export const SoloNotificationWindow = ({ onSelectDailyQuest, onClose }: Props) => {
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<SystemNotification[]>([
    {
      id: 'player',
      text: "[You've become a Player.]",
      read: true,
      action: () => navigate('/profile'),
    },
    {
      id: 'quest',
      text: '[Daily Quest: Strength Training has arrived.]',
      read: false,
      action: () => onSelectDailyQuest?.(),
    },
    {
      id: 'penalty',
      text: '[Warning: Incomplete quest triggers Penalty Zone.]',
      read: false,
      action: () => onSelectDailyQuest?.(),
    },
  ]);

  const handleItemClick = (item: SystemNotification) => {
    systemSound.playClick();
    setNotifications((prev) =>
      prev.map((n) => (n.id === item.id ? { ...n, read: true } : n))
    );
    if (item.action) {
      item.action();
    }
  };

  return (
    <div className="relative max-w-[560px] w-full mx-auto bg-[#0a1b2e]/90 border-2 border-white/50 rounded-[4px] p-4 sm:p-7 md:p-9 text-white shadow-[0_0_30px_rgba(0,0,0,0.85),inset_0_0_24px_rgba(0,212,255,0.08)] backdrop-blur-md anime-dropdown font-mono">
      {/* Centered Notification Header matching Status Box */}
      <div className="relative flex items-center justify-center pb-2 mb-4 sm:mb-5">
        <div className="inline-block px-5 sm:px-8 py-0.5 sm:py-1 border border-white/70 bg-[#061426]/60 shadow-[0_0_14px_rgba(0,212,255,0.35)]">
          <div className="flex items-center gap-1.5 sm:gap-2">
            <Info className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#9fd3ff] shrink-0" />
            <span className="font-mono font-extrabold tracking-[0.2em] sm:tracking-[0.28em] text-sm sm:text-base md:text-lg text-white anime-glow-text">
              NOTIFICATION
            </span>
          </div>
        </div>
      </div>

      {/* Notifications List */}
      <div className="border border-white/45 bg-[#061424]/75 p-3 sm:p-5 shadow-[inset_0_0_14px_rgba(0,212,255,0.1)] rounded-[2px] space-y-2.5 sm:space-y-3">
        {notifications.map((item) => (
          <div
            key={item.id}
            onClick={() => handleItemClick(item)}
            className="flex items-center justify-between p-2.5 sm:p-3 border border-white/20 bg-white/5 hover:border-white/60 hover:bg-white/10 cursor-pointer transition-all group rounded-[2px] min-w-0 gap-2"
          >
            <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
              <span className="text-[#9fd3ff] font-bold text-base shrink-0">•</span>
              <span className="text-white group-hover:text-[#9fd3ff] transition-colors text-xs sm:text-sm font-medium break-words">
                {item.text}
              </span>
            </div>
            {/* Hollow square symbol from screenshot */}
            <div className="w-3.5 h-3.5 border border-white/60 group-hover:border-[#9fd3ff] group-hover:bg-white/20 shrink-0 transition-colors ml-2" />
          </div>
        ))}
      </div>

      {onClose && (
        <div className="text-center mt-5 sm:mt-6 pt-3 sm:pt-4 border-t border-white/20">
          <button
            onClick={onClose}
            className="px-5 sm:px-6 py-1.5 text-xs font-mono border border-white/60 text-white hover:bg-white/15 transition-all shadow-[0_0_10px_rgba(0,0,0,0.6)]"
          >
            DISMISS
          </button>
        </div>
      )}
    </div>
  );
};
