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
    <div className="anime-window system-blueprint-bg system-window-corners p-6 sm:p-8 max-w-lg mx-auto w-full relative">
      <div className="corner-ticks" />

      {/* Header Box matching Notification Screenshot */}
      <div className="border border-cyan-400/80 bg-black/60 p-2 sm:p-3 mb-6 flex items-center gap-3 shadow-[0_0_12px_rgba(82,210,246,0.3)]">
        <div className="w-8 h-8 rounded-full border border-cyan-300 flex items-center justify-center text-cyan-300 shrink-0">
          <Info className="w-5 h-5 stroke-[2.5]" />
        </div>
        <h2 className="text-lg sm:text-xl font-mono font-bold tracking-[0.2em] text-white anime-glow-text">
          NOTIFICATION
        </h2>
      </div>

      {/* Notifications List */}
      <div className="space-y-4 font-mono text-sm sm:text-base py-2">
        {notifications.map((item) => (
          <div
            key={item.id}
            onClick={() => handleItemClick(item)}
            className="flex items-center justify-between p-3 border border-cyan-500/20 bg-black/40 hover:border-cyan-400 hover:bg-cyan-500/10 cursor-pointer transition-all group"
          >
            <div className="flex items-center gap-2">
              <span className="text-cyan-400 font-bold text-base">•</span>
              <span className="text-white group-hover:text-cyan-200 transition-colors font-medium">
                {item.text}
              </span>
            </div>
            {/* Hollow square symbol from screenshot */}
            <div className="w-3.5 h-3.5 border border-cyan-400/70 group-hover:border-cyan-300 group-hover:bg-cyan-400/20 shrink-0 transition-colors" />
          </div>
        ))}
      </div>

      {onClose && (
        <div className="text-center mt-6 pt-4 border-t border-cyan-500/20">
          <button
            onClick={onClose}
            className="px-6 py-1.5 text-xs font-mono border border-cyan-400/50 text-cyan-300 hover:bg-cyan-500/20"
          >
            DISMISS
          </button>
        </div>
      )}
    </div>
  );
};
