import { Link, useLocation } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';

/**
 * Minimal fixed "return to status window" control shown on every route
 * except the dashboard — replaces the old full header on feature pages.
 */
export function SystemBack() {
  const { pathname } = useLocation();
  if (pathname === '/' || pathname === '/auth' || pathname === '/landing') return null;
  return (
    <Link
      to="/"
      className="sys-frame-in fixed left-3 top-3 z-50 flex items-center gap-1.5 border border-primary/50 bg-background/85 px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.25em] text-primary backdrop-blur-sm transition-colors hover:bg-primary/10"
    >
      <ChevronLeft className="h-3.5 w-3.5" />
      Status
    </Link>
  );
}
