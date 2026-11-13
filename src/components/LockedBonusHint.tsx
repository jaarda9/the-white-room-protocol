import { useNavigate } from 'react-router-dom';
import { Lock } from 'lucide-react';
import type { Quest } from '@/lib/types';
import { getAllStoredQuests, getTodayKeyLocal } from '@/lib/storage';
import { isDailyClearClaimed } from '@/lib/rank-load';
import { systemSound } from '@/lib/system-sound';

/**
 * In a Lab, when rank-bonus directives of this kind are still hidden (they unlock when today's
 * Daily Quest clear reward is claimed — see filterVisibleQuests), one line says so. Without it
 * a finished Lab looks like the end of the day's content.
 */
export default function LockedBonusHint({ type, refreshKey }: { type: Quest['type']; refreshKey?: unknown }) {
  const navigate = useNavigate();
  void refreshKey; // re-render trigger from the parent's quest state
  if (isDailyClearClaimed(getTodayKeyLocal())) return null;
  const hidden = getAllStoredQuests().filter((q) => q.type === type && q.rankOptional && !q.completed);
  if (hidden.length === 0) return null;
  const names = hidden.map((q) => q.title.split(' — ')[0]).join(', ');
  return (
    <button
      type="button"
      onClick={() => {
        systemSound.playClick();
        navigate('/?view=quests');
      }}
      className="w-full mb-4 flex items-start gap-2 px-3 py-2 border border-violet-400/40 bg-violet-950/20 rounded-[2px] text-left font-mono hover:border-violet-300/70 transition-colors"
    >
      <Lock className="w-3.5 h-3.5 mt-0.5 text-violet-300 shrink-0" />
      <span className="text-[11px] text-violet-100/90 leading-relaxed">
        {hidden.length} bonus directive{hidden.length === 1 ? '' : 's'} locked ({names}). Clear the whole Daily Quest
        and claim its reward to reveal {hidden.length === 1 ? 'it' : 'them'}.
      </span>
    </button>
  );
}
