import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Bell } from 'lucide-react';
import { systemSound } from '@/lib/system-sound';
import { getUnreadNotificationCount, NOTIFICATIONS_UPDATED_EVENT } from '@/lib/notifications';

const items = [
  { label: 'STATUS', view: 'status' },
  { label: 'DAILY QUEST', view: 'quests' },
  { label: 'DUNGEONS', view: 'dungeons' },
  { label: 'SEALS', view: 'seals' },
  { label: 'RECORDS', view: 'records' },
  { label: 'NOTICES', view: 'notifications' },
];

/**
 * Global bottom navigation dock — the only navigation chrome in the app.
 * Every entry returns to the main system window with the matching view active.
 */
export function SystemDock() {
  const navigate = useNavigate();
  const location = useLocation();
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    const sync = () => setUnreadCount(getUnreadNotificationCount());
    sync();
    window.addEventListener(NOTIFICATIONS_UPDATED_EVENT, sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener(NOTIFICATIONS_UPDATED_EVENT, sync);
      window.removeEventListener('storage', sync);
    };
  }, []);

  if (location.pathname === '/login') return null;

  const onDashboard = location.pathname === '/';
  const currentView = new URLSearchParams(location.search).get('view') || 'status';

  return (
    <nav
      aria-label="System View Selector"
      className="fixed bottom-0 left-0 right-0 z-50 flex justify-center px-2 pt-3 pointer-events-none"
      style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 1.25rem)' }}
    >
      <div className="no-scrollbar pointer-events-auto flex items-center gap-0.5 sm:gap-2 px-2 sm:px-3 py-1.5 rounded-full border border-white/20 bg-[#061222]/90 backdrop-blur-md shadow-[0_0_20px_rgba(0,0,0,0.8)] text-[10px] sm:text-xs font-mono max-w-full overflow-x-auto">
        {items.map((item) => {
          const active = onDashboard && currentView === item.view;
          return (
            <button
              key={item.view}
              onClick={() => {
                systemSound.playClick();
                navigate(item.view === 'status' ? '/' : `/?view=${item.view}`);
              }}
              className={`relative px-2.5 sm:px-3 py-1 rounded-full whitespace-nowrap transition-all flex items-center gap-1.5 ${
                active
                  ? 'bg-white/20 text-white font-bold shadow-[0_0_10px_rgba(255,255,255,0.4)]'
                  : 'text-white/60 hover:text-white'
              }`}
            >
              {item.view === 'notifications' && <Bell className="w-3 h-3 text-cyan-400" />}
              <span>{item.label}</span>
              {item.view === 'notifications' && unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full bg-rose-500 text-white text-[9px] font-bold flex items-center justify-center shadow-[0_0_6px_rgba(244,63,94,0.7)]">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
