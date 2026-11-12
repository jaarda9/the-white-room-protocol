import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { GraduationCap, ChevronRight, Award } from 'lucide-react';
import { getAllStoredQuests, getDailyQuests, getTodayKeyLocal } from '@/lib/storage';
import { getDirectiveKey } from '@/lib/quest-content';
import {
  INTEL_UPDATED_EVENT,
  abandonCourse,
  directiveDoneToday,
  getIntelState,
  masteryOf,
  nextLessonNumber,
  type IntelState,
} from '@/lib/intel-course';
import { systemSound } from '@/lib/system-sound';
import IntelCoursePicker from '@/components/IntelCoursePicker';

/** Knowledge Lab: the player's Intel course — choose, follow, change. */
export default function IntelCourseCard() {
  const navigate = useNavigate();
  const [state, setState] = useState<IntelState>(() => getIntelState());

  useEffect(() => {
    const sync = () => setState(getIntelState());
    window.addEventListener(INTEL_UPDATED_EVENT, sync);
    return () => window.removeEventListener(INTEL_UPDATED_EVENT, sync);
  }, []);

  const openBriefing = async () => {
    systemSound.playClick();
    // This page does not load the day's quests by itself — make sure today's list exists
    // (it is generated on first read) before looking for the Intel Briefing in it.
    const quests = await getDailyQuests().catch(() => getAllStoredQuests());
    const quest = [...quests, ...getAllStoredQuests()].find((q) => getDirectiveKey(q) === 'intel');
    navigate(quest ? `/quest/${encodeURIComponent(quest.id)}` : '/dailymental');
  };

  const shell =
    'relative bg-[#0a1b2e]/90 border-2 border-cyan-400/50 rounded-[4px] p-5 text-white shadow-[0_0_24px_rgba(0,212,255,0.15)] font-mono text-left';
  const a = state.active;
  const m = masteryOf(state);
  const nextN = nextLessonNumber(state);
  const next = a && nextN ? a.syllabus.find((s) => s.n === nextN) : null;
  const done = directiveDoneToday(getTodayKeyLocal(), state);

  return (
    <div className={shell}>
      <div className="flex items-center gap-2 text-xs font-bold tracking-[0.2em] text-[#00d4ff] mb-3">
        <GraduationCap className="w-4 h-4" /> INTEL COURSE
      </div>

      {!a && <IntelCoursePicker onStarted={() => setState(getIntelState())} />}

      {a && m && (
        <div className="space-y-3">
          <div>
            <div className="text-base font-bold text-white">{a.niche}</div>
            <div className="text-[11px] text-white/55">
              {m.level.toUpperCase()} · {m.done}/{m.total} lessons{m.done ? ` · ${m.accuracy}% accuracy` : ''}
            </div>
            <div className="mt-2 h-1.5 bg-white/10 rounded-full overflow-hidden">
              <div className="h-full bg-cyan-400" style={{ width: `${Math.round((m.done / Math.max(1, m.total)) * 100)}%` }} />
            </div>
          </div>
          {next && (
            <div className="text-[11px] text-gray-300">
              {done ? 'Next' : 'Today'}: <span className="text-white">Lesson {next.n} · {next.title}</span>
            </div>
          )}
          <button
            type="button"
            onClick={openBriefing}
            className="w-full flex items-center justify-between px-3 py-2 bg-white text-black text-[11px] font-bold hover:bg-gray-200 rounded-[2px]"
          >
            <span>{done ? 'TODAY’S BRIEFING DONE · OPEN' : nextN ? 'OPEN TODAY’S BRIEFING' : 'COURSE COMPLETE · OPEN'}</span>
            <ChevronRight className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => {
              if (window.confirm(`Leave "${a.niche}"? Your progress in it is lost; a new course starts from lesson 1.`)) {
                abandonCourse();
                setState(getIntelState());
              }
            }}
            className="text-[10px] text-white/40 hover:text-rose-300"
          >
            Change field
          </button>
        </div>
      )}

      {state.mastered.length > 0 && (
        <div className="mt-3 pt-3 border-t border-white/15">
          <div className="text-[10px] tracking-[0.2em] text-white/45 mb-1">MASTERED</div>
          <div className="flex flex-wrap gap-1.5">
            {state.mastered.map((c) => (
              <span key={c.key + c.date} className="inline-flex items-center gap-1 px-2 py-0.5 border border-amber-300/50 text-[10px] text-amber-200 rounded-[2px]">
                <Award className="w-3 h-3" /> {c.niche} · {c.accuracy}%
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
