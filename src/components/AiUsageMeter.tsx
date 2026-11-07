import { useEffect, useState } from 'react';
import { Activity, AlertTriangle } from 'lucide-react';
import { fetchAiUsageToday, type AiUsageToday } from '@/lib/ai-key-verify';
import { getUserGeminiKeys } from '@/lib/storage';
import type { UserProfile } from '@/lib/types';

/** Gemini free tier, per key and per model, as configured in api/ai.ts. */
const FREE_REQUESTS_PER_KEY = 20;

/**
 * Profile → today's THEIA requests on the player's own key(s), against the free daily limit.
 * Counted on the server per Pacific-time day, which is when Google resets free quotas.
 */
export default function AiUsageMeter({ profile }: { profile?: UserProfile | null }) {
  const [usage, setUsage] = useState<AiUsageToday | null>(null);
  const keyCount = getUserGeminiKeys(profile || undefined).filter((k) => k.isActive !== false).length;

  useEffect(() => {
    let cancelled = false;
    fetchAiUsageToday().then((u) => {
      if (!cancelled) setUsage(u);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (keyCount === 0) {
    return (
      <div className="mt-2 flex items-start gap-2 p-2 border border-amber-500/40 bg-amber-950/20 rounded-[2px] text-[10px] text-amber-200 leading-relaxed">
        <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-px text-amber-400" />
        <span>
          [SYSTEM] No personal key bound. You are drawing from the shared guild key that every Hunter uses, and it runs
          out fast. Bind your own free Gemini key with [ MANAGE ROTATION POOL ]; new Hunters must have one.
        </span>
      </div>
    );
  }

  const limit = FREE_REQUESTS_PER_KEY * keyCount;
  const used = usage?.user ?? 0;
  const pct = Math.min(100, Math.round((used / limit) * 100));
  const barColor = pct >= 90 ? 'bg-rose-400' : pct >= 60 ? 'bg-amber-300' : 'bg-cyan-400';

  return (
    <div className="mt-2 space-y-1">
      <div className="flex items-center justify-between text-[10px] text-white/60">
        <span className="flex items-center gap-1.5">
          <Activity className="w-3 h-3 text-cyan-400" />
          THEIA REQUESTS TODAY
        </span>
        <span className="text-cyan-200 font-bold">
          {usage ? `${used} / ~${limit}` : '— / —'}
        </span>
      </div>
      <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
        <div className={`h-full ${barColor} transition-all`} style={{ width: `${usage ? pct : 0}%` }} />
      </div>
      <div className="text-[9px] text-white/35 leading-relaxed">
        Free limit ≈ {FREE_REQUESTS_PER_KEY} per key per day; resets at midnight Pacific time.
        {usage && usage.shared > 0 ? ` ${usage.shared} more ran on the shared key after yours were busy.` : ''}
      </div>
    </div>
  );
}
