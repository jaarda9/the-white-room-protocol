import { useEffect, useState } from 'react';
import { Info, X } from 'lucide-react';
import { GUIDE_UPDATED_EVENT, markFirstContactSeen, shouldShowFirstContact } from '@/lib/system-guide';
import { systemSound } from '@/lib/system-sound';

interface FirstContactCardProps {
  /** Stable id for this page; the card shows once per Hunter. */
  id: string;
  title: string;
  /** One or two short sentences. */
  children: React.ReactNode;
  className?: string;
}

/**
 * The page explains itself the first time a new Hunter opens it (system-guide.ts), then never
 * again. Kept to a couple of lines: the phone screen is already full.
 */
export default function FirstContactCard({ id, title, children, className = '' }: FirstContactCardProps) {
  const [visible, setVisible] = useState(() => shouldShowFirstContact(id));

  useEffect(() => {
    const sync = () => setVisible(shouldShowFirstContact(id));
    window.addEventListener(GUIDE_UPDATED_EVENT, sync);
    return () => window.removeEventListener(GUIDE_UPDATED_EVENT, sync);
  }, [id]);

  if (!visible) return null;

  const dismiss = () => {
    systemSound.playClick();
    markFirstContactSeen(id);
    setVisible(false);
  };

  return (
    <div
      className={`relative border border-[#00d4ff]/50 bg-[#04182b]/90 rounded-[2px] px-3 py-2.5 pr-8 text-left font-mono shadow-[0_0_14px_rgba(0,212,255,0.15)] anime-dropdown ${className}`}
      role="note"
    >
      <div className="flex items-center gap-1.5 text-[10px] font-bold text-[#00d4ff] tracking-[0.2em]">
        <Info className="w-3.5 h-3.5" />
        [FIRST CONTACT] {title}
      </div>
      <div className="mt-1 text-[11px] text-gray-200 leading-relaxed">{children}</div>
      <button
        type="button"
        onClick={dismiss}
        className="absolute top-1.5 right-1.5 p-1 text-white/40 hover:text-white transition-colors"
        aria-label="Understood"
        title="Understood"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}
