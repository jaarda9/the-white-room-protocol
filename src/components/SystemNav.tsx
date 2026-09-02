import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

const PRIMARY = [
  { label: 'Status', path: '/' },
  { label: 'Quests', path: '/quests' },
  { label: 'Gates', path: '/gates' },
  { label: 'THEIA', path: '/theia' },
];

const ARCHIVE = [
  { label: 'Dossier', path: '/profile' },
  { label: 'Daily Protocol', path: '/daily-protocol' },
  { label: 'Titles', path: '/achievements' },
  { label: 'Challenges', path: '/challenges' },
  { label: 'Rankings', path: '/leaderboard' },
  { label: 'Calendar', path: '/calendar' },
  { label: 'Analytics', path: '/analytics' },
];

/**
 * Minimal System index shown beneath the open window — no chrome, no panels,
 * just glowing entries the Player can select.
 */
export const SystemNav = () => {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);

  return (
    <nav className="w-full max-w-3xl mx-auto mt-6 select-none">
      <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2">
        {PRIMARY.map((item) => {
          const active = pathname === item.path;
          return (
            <button
              key={item.path}
              type="button"
              onClick={() => navigate(item.path)}
              className={`font-display text-[11px] tracking-[0.28em] uppercase transition-colors ${
                active ? 'text-primary text-glow' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {active ? `◆ ${item.label}` : item.label}
            </button>
          );
        })}
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="font-display text-[11px] tracking-[0.28em] uppercase text-muted-foreground hover:text-foreground transition-colors"
        >
          {open ? 'Close' : 'Archive'}
        </button>
      </div>

      {open && (
        <div className="mt-3 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 system-appear">
          {ARCHIVE.map((item) => (
            <button
              key={item.path}
              type="button"
              onClick={() => navigate(item.path)}
              className={`data-readout text-[10px] tracking-[0.18em] uppercase transition-colors ${
                pathname === item.path ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      )}
    </nav>
  );
};

export default SystemNav;
