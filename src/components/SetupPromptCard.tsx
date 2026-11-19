import { useState } from 'react';
import { BookOpen, GraduationCap, Dumbbell } from 'lucide-react';
import { getHunterProtocolConfig, saveHunterProtocolConfig } from '@/lib/storage';
import { completeSetupPrompt, isSetupPending, type SetupPromptId } from '@/lib/setup-prompts';
import { systemSound } from '@/lib/system-sound';

const inputClass =
  'w-full bg-[#061426] border border-white/30 rounded-[2px] px-2.5 py-2 text-xs text-white focus:border-[#00d4ff] outline-none';

/**
 * One just-in-time setup question (see setup-prompts.ts), shown where the answer is first needed.
 * Renders nothing once answered or dismissed. `onOpenRoutine` opens the routine builder for the
 * 'routine' prompt (owned by the page that shows it).
 */
export default function SetupPromptCard({ id, onOpenRoutine }: { id: SetupPromptId; onOpenRoutine?: () => void }) {
  const [open, setOpen] = useState(() => isSetupPending(id));
  const config = getHunterProtocolConfig();
  const [title, setTitle] = useState('');
  const [author, setAuthor] = useState('');
  const [topic, setTopic] = useState('');
  if (!open) return null;

  const done = () => {
    completeSetupPrompt(id);
    setOpen(false);
  };

  const saveBook = () => {
    if (!title.trim()) return;
    systemSound.playSuccess();
    // Answered first: saving re-titles today's quest, which only uses a book once it's chosen.
    done();
    const c = getHunterProtocolConfig();
    saveHunterProtocolConfig({
      ...c,
      mentalPreferences: { ...c.mentalPreferences, currentBookTitle: title.trim().slice(0, 120), currentBookAuthor: author.trim().slice(0, 80) },
    });
  };
  const saveStudy = () => {
    if (!topic.trim()) return;
    systemSound.playSuccess();
    done();
    const c = getHunterProtocolConfig();
    saveHunterProtocolConfig({ ...c, mentalPreferences: { ...c.mentalPreferences, currentStudyTopic: topic.trim().slice(0, 120) } });
  };
  const keep = () => {
    systemSound.playClick();
    done();
  };
  /** Skipping the book/field question leaves it unset (neutral quest text), never the default. */
  const skipChoice = (field: 'currentBookTitle' | 'currentStudyTopic') => {
    systemSound.playClick();
    done();
    const c = getHunterProtocolConfig();
    saveHunterProtocolConfig({ ...c, mentalPreferences: { ...c.mentalPreferences, [field]: '' } });
  };

  const shell = 'mb-4 border border-[#00d4ff]/50 bg-[#061e38]/80 rounded-[3px] p-3 space-y-2.5 font-mono shadow-[0_0_14px_rgba(0,212,255,0.15)]';
  const primary =
    'flex-1 py-2 bg-white text-black text-[11px] font-bold rounded-[2px] hover:bg-gray-200 disabled:opacity-40 transition-colors';
  const secondary = 'flex-1 py-2 border border-white/30 text-[11px] text-white/70 hover:text-white rounded-[2px] transition-colors';

  if (id === 'book') {
    return (
      <div className={shell} role="region" aria-label="Your book">
        <div className="flex items-center gap-2 text-[11px] font-bold text-[#9fd3ff] tracking-wider">
          <BookOpen className="w-4 h-4 text-[#00d4ff]" /> WHAT ARE YOU READING?
        </div>
        <p className="text-[11px] text-white/70 leading-relaxed">
          Tell the System your current book. Until then, any book you&apos;re reading counts.
        </p>
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Book title" maxLength={120} className={inputClass} aria-label="Book title" />
        <input value={author} onChange={(e) => setAuthor(e.target.value)} placeholder="Author (optional)" maxLength={80} className={inputClass} aria-label="Author" />
        <div className="flex gap-2">
          <button type="button" onClick={saveBook} disabled={!title.trim()} className={primary}>
            SAVE BOOK
          </button>
          <button type="button" onClick={() => skipChoice('currentBookTitle')} className={secondary}>
            NOT NOW
          </button>
        </div>
      </div>
    );
  }

  if (id === 'study') {
    return (
      <div className={shell} role="region" aria-label="Your field of study">
        <div className="flex items-center gap-2 text-[11px] font-bold text-[#9fd3ff] tracking-wider">
          <GraduationCap className="w-4 h-4 text-[#00d4ff]" /> WHAT DO YOU STUDY OR WORK ON?
        </div>
        <p className="text-[11px] text-white/70 leading-relaxed">
          Field Mastery is your daily deep-work session on it (school, a job skill, a hobby). Until you set it, any field
          you&apos;re working on counts.
        </p>
        <input value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="e.g. Dentistry, Python, Guitar" maxLength={120} className={inputClass} aria-label="Field of study" />
        <div className="flex gap-2">
          <button type="button" onClick={saveStudy} disabled={!topic.trim()} className={primary}>
            SAVE
          </button>
          <button type="button" onClick={() => skipChoice('currentStudyTopic')} className={secondary}>
            NOT NOW
          </button>
        </div>
      </div>
    );
  }

  // routine
  return (
    <div className={shell} role="region" aria-label="Your training plan">
      <div className="flex items-center gap-2 text-[11px] font-bold text-[#9fd3ff] tracking-wider">
        <Dumbbell className="w-4 h-4 text-[#00d4ff]" /> YOUR TRAINING PLAN
      </div>
      <p className="text-[11px] text-white/70 leading-relaxed">
        The System prescribes a balanced plan (strength, cardio, recovery). Already follow your own gym routine? Set it up once and the
        System will use it.
      </p>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => {
            systemSound.playClick();
            done();
            onOpenRoutine?.();
          }}
          className={primary}
        >
          USE MY OWN ROUTINE
        </button>
        <button type="button" onClick={keep} className={secondary}>
          SYSTEM PLAN IS FINE
        </button>
      </div>
    </div>
  );
}
