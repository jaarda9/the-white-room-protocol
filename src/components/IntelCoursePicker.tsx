import { useState } from 'react';
import { Loader2, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { NICHE_SUGGESTIONS, startCourse, type CourseInfo } from '@/lib/intel-course';
import { systemSound } from '@/lib/system-sound';

/** Choose the one niche to master. Building a new course takes up to a minute (one AI call). */
export default function IntelCoursePicker({ onStarted }: { onStarted?: (c: CourseInfo) => void }) {
  const [niche, setNiche] = useState('');
  const [busy, setBusy] = useState(false);

  const begin = async (value = niche) => {
    const v = value.trim();
    if (v.length < 3 || busy) return;
    setBusy(true);
    systemSound.playClick();
    try {
      const course = await startCourse(v);
      systemSound.playLevelUp();
      toast.success('[INTEL COURSE ASSIGNED]', { description: `${course.niche} · ${course.syllabus.length} lessons.` });
      onStarted?.(course);
    } catch (err: any) {
      systemSound.playPenaltyWarning();
      toast.error('Course not created', { description: String(err?.message || err).slice(0, 180) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-2 font-mono">
      <p className="text-[11px] text-gray-300 leading-relaxed">
        Choose one field to master. THEIA builds a structured course from Wikipedia: one lesson a day, from the
        foundations up.
      </p>
      <div className="flex gap-2">
        <input
          value={niche}
          onChange={(e) => setNiche(e.target.value.slice(0, 60))}
          onKeyDown={(e) => e.key === 'Enter' && begin()}
          placeholder="Any field, e.g. Ancient Rome"
          disabled={busy}
          className="flex-1 min-w-0 px-2 py-1.5 bg-black/50 border border-white/25 rounded-[2px] text-xs text-white placeholder:text-white/30 outline-none focus:border-cyan-400"
        />
        <button
          type="button"
          onClick={() => begin()}
          disabled={busy || niche.trim().length < 3}
          className="shrink-0 px-3 py-1.5 text-[11px] font-bold bg-white text-black hover:bg-gray-200 rounded-[2px] disabled:opacity-40"
        >
          BEGIN
        </button>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {NICHE_SUGGESTIONS.map((s) => (
          <button
            key={s}
            type="button"
            disabled={busy}
            onClick={() => {
              setNiche(s);
              begin(s);
            }}
            className="px-2 py-0.5 border border-white/20 text-[10px] text-white/60 hover:text-white hover:border-cyan-400/60 rounded-[2px] disabled:opacity-40"
          >
            {s}
          </button>
        ))}
      </div>
      {busy && (
        <div className="flex items-center gap-2 text-[11px] text-cyan-300">
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
          <Sparkles className="w-3 h-3" /> THEIA is building your course… (up to a minute)
        </div>
      )}
    </div>
  );
}
