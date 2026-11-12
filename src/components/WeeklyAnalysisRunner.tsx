import { useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { syncManager } from '@/lib/sync-manager';
import { runWeeklyAnalysisIfDue } from '@/lib/theia-companion';

/**
 * Renders nothing. Once per app start (and when the app comes back to the foreground), checks
 * whether THEIA's weekly analysis is due — only after the save has been restored from the
 * server, so a fresh device never judges an empty week.
 */
export default function WeeklyAnalysisRunner() {
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    const check = async () => {
      try {
        await syncManager.ensureInitialLoad();
        // Offline start: the server copy never arrived, so this device may hold an incomplete week.
        if (!cancelled && syncManager.initialLoadReachedServer()) await runWeeklyAnalysisIfDue();
      } catch {
        // an extra, never a blocker
      }
    };
    const start = setTimeout(check, 8000); // after the app's own startup work
    const onVisible = () => {
      if (document.visibilityState === 'visible') check();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      cancelled = true;
      clearTimeout(start);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [user]);

  return null;
}
