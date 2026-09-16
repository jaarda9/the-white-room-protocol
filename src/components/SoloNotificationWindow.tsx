import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Info, CheckCheck, Trash2 } from 'lucide-react';
import { systemSound } from '@/lib/system-sound';
import { useAuth } from '@/contexts/AuthContext';
import { fetchHunters, fetchUnreadSummary } from '@/lib/messaging-service';
import {
  getNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  clearReadNotifications,
  NOTIFICATIONS_UPDATED_EVENT,
  type NotificationSeverity,
} from '@/lib/notifications';

interface Props {
  onClose?: () => void;
}

interface FeedItem {
  id: string;
  title: string;
  description?: string;
  severity: NotificationSeverity;
  createdAtMs: number;
  read: boolean;
  onClick: () => void;
}

const SEVERITY_STYLE: Record<NotificationSeverity, { border: string; dot: string }> = {
  critical: { border: 'border-l-rose-500', dot: 'bg-rose-400' },
  milestone: { border: 'border-l-amber-400', dot: 'bg-amber-300' },
  notice: { border: 'border-l-cyan-400', dot: 'bg-cyan-300' },
};

const formatRelativeTime = (ms: number): string => {
  const diffSec = Math.max(0, Math.floor((Date.now() - ms) / 1000));
  if (diffSec < 60) return 'just now';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  return `${diffDay}d ago`;
};

const renderNotificationItem = (item: FeedItem, onItemClick: (item: FeedItem) => void) => {
  const style = SEVERITY_STYLE[item.severity];
  return (
    <div
      key={item.id}
      onClick={() => onItemClick(item)}
      className={`flex items-start justify-between p-2.5 sm:p-3 border border-white/20 border-l-2 ${style.border} ${
        item.read ? 'bg-white/[0.02] opacity-70' : 'bg-white/5'
      } hover:border-white/60 hover:bg-white/10 cursor-pointer transition-all group rounded-[2px] min-w-0 gap-2`}
    >
      <div className="flex items-start gap-2 sm:gap-2.5 min-w-0 flex-1">
        <span className={`w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 ${item.read ? 'bg-white/20' : style.dot}`} />
        <div className="min-w-0 flex-1 space-y-0.5">
          <span className="text-white group-hover:text-[#9fd3ff] transition-colors text-xs sm:text-sm font-medium break-words block">
            {item.title}
          </span>
          {item.description && (
            <span className="text-white/50 text-[10px] sm:text-[11px] break-words block leading-relaxed">
              {item.description}
            </span>
          )}
          <span className="text-white/30 text-[9px] sm:text-[10px] block">
            {formatRelativeTime(item.createdAtMs)}
          </span>
        </div>
      </div>
    </div>
  );
};

export const SoloNotificationWindow = ({ onClose }: Props) => {
  const navigate = useNavigate();
  const { subjectId } = useAuth();
  const [messageFeed, setMessageFeed] = useState<FeedItem[]>([]);
  const [logFeed, setLogFeed] = useState<FeedItem[]>([]);

  useEffect(() => {
    const syncLog = () => {
      setLogFeed(
        getNotifications().map((n) => ({
          id: n.id,
          title: n.title,
          description: n.description,
          severity: n.severity,
          createdAtMs: new Date(n.createdAt).getTime(),
          read: n.read,
          onClick: () => {
            markNotificationRead(n.id);
            if (n.route) navigate(n.route);
          },
        }))
      );
    };
    syncLog();
    window.addEventListener(NOTIFICATIONS_UPDATED_EVENT, syncLog);
    window.addEventListener('storage', syncLog);
    return () => {
      window.removeEventListener(NOTIFICATIONS_UPDATED_EVENT, syncLog);
      window.removeEventListener('storage', syncLog);
    };
  }, [navigate]);

  useEffect(() => {
    const userId = (subjectId || '').toUpperCase();
    if (!userId) return;
    let cancelled = false;

    const load = async () => {
      const [summary, hunters] = await Promise.all([fetchUnreadSummary(userId), fetchHunters()]);
      if (cancelled) return;
      const nameFor = (id: string) =>
        hunters.find((h) => h.userId === id)?.fullName || `Subject ${id}`;
      setMessageFeed(
        summary.senders.map((s) => ({
          id: `msg-${s.from}`,
          title: `[New transmission from ${nameFor(s.from)} — ${s.count} unread.]`,
          severity: 'notice' as const,
          createdAtMs: Date.now(),
          read: false,
          onClick: () => navigate(`/messages?with=${encodeURIComponent(s.from)}`),
        }))
      );
    };

    load();
    const t = setInterval(load, 20000);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, [subjectId, navigate]);

  const allItems = [...messageFeed, ...logFeed].sort((a, b) => b.createdAtMs - a.createdAtMs);
  const unreadItems = allItems.filter((i) => !i.read);
  const readItems = allItems.filter((i) => i.read);
  // Message notices aren't part of this persisted log (they clear when the messages themselves
  // are read), so "Clear Read" only ever needs to know about logFeed specifically.
  const hasReadLogEntries = logFeed.some((i) => i.read);

  const handleItemClick = (item: FeedItem) => {
    systemSound.playClick();
    item.onClick();
  };

  const handleMarkAllRead = () => {
    systemSound.playClick();
    markAllNotificationsRead();
  };

  const handleClearRead = () => {
    systemSound.playClick();
    clearReadNotifications();
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

      {allItems.length === 0 && (
        <div className="border border-white/45 bg-[#061424]/75 p-3 sm:p-5 shadow-[inset_0_0_14px_rgba(0,212,255,0.1)] rounded-[2px]">
          <div className="text-center py-6 text-xs text-white/40 italic">
            No notifications yet. The System will speak when there's something to report.
          </div>
        </div>
      )}

      {/* Unread */}
      {unreadItems.length > 0 && (
        <div className="mb-3 sm:mb-4">
          <div className="flex items-center justify-between mb-1.5 px-0.5">
            <span className="text-[10px] sm:text-[11px] font-bold tracking-wider text-cyan-300/90">
              UNREAD ({unreadItems.length})
            </span>
            <button
              type="button"
              onClick={handleMarkAllRead}
              className="flex items-center gap-1.5 text-[10px] sm:text-[11px] text-white/50 hover:text-white transition-colors"
            >
              <CheckCheck className="w-3.5 h-3.5" />
              MARK ALL READ
            </button>
          </div>
          <div className="border border-white/45 bg-[#061424]/75 p-3 sm:p-5 shadow-[inset_0_0_14px_rgba(0,212,255,0.1)] rounded-[2px] space-y-2.5 sm:space-y-3">
            {unreadItems.map((item) => renderNotificationItem(item, handleItemClick))}
          </div>
        </div>
      )}

      {/* Read */}
      {readItems.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-1.5 px-0.5">
            <span className="text-[10px] sm:text-[11px] font-bold tracking-wider text-white/40">
              READ ({readItems.length})
            </span>
            {hasReadLogEntries && (
              <button
                type="button"
                onClick={handleClearRead}
                className="flex items-center gap-1.5 text-[10px] sm:text-[11px] text-white/50 hover:text-white transition-colors"
                title="Read notifications clear themselves after 7 days — this does it now"
              >
                <Trash2 className="w-3.5 h-3.5" />
                CLEAR READ
              </button>
            )}
          </div>
          <div className="border border-white/25 bg-[#061424]/50 p-3 sm:p-5 shadow-[inset_0_0_14px_rgba(0,212,255,0.06)] rounded-[2px] space-y-2.5 sm:space-y-3">
            {readItems.map((item) => renderNotificationItem(item, handleItemClick))}
          </div>
        </div>
      )}

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
