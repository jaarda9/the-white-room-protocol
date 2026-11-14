import { useNavigate } from 'react-router-dom';
import { MessageSquare, Users } from 'lucide-react';
import { systemSound } from '@/lib/system-sound';

/** The two halves of COMMS in the bottom bar: Hunter messages and your Party. */
export default function CommsTabs({ current }: { current: 'messages' | 'party' }) {
  const navigate = useNavigate();
  const tabs = [
    { id: 'messages' as const, label: 'MESSAGES', to: '/messages', icon: MessageSquare },
    { id: 'party' as const, label: 'PARTY', to: '/party', icon: Users },
  ];
  return (
    <div role="tablist" aria-label="Comms" className="grid grid-cols-2 gap-1 p-1 mb-4 border border-white/20 rounded-[3px] bg-black/30">
      {tabs.map((t) => {
        const Icon = t.icon;
        const on = current === t.id;
        return (
          <button
            key={t.id}
            role="tab"
            aria-selected={on}
            type="button"
            onClick={() => {
              if (on) return;
              systemSound.playClick();
              navigate(t.to);
            }}
            className={`flex items-center justify-center gap-1.5 py-1.5 rounded-[2px] text-[10px] font-bold tracking-wider transition-colors ${
              on ? 'bg-cyan-950/80 border border-cyan-400/60 text-cyan-200' : 'border border-transparent text-white/55 hover:text-white'
            }`}
          >
            <Icon className="w-3.5 h-3.5" />
            {t.label}
          </button>
        );
      })}
    </div>
  );
}
