import { useCallback, useEffect, useState } from 'react';
import { GraduationCap, Loader2, ExternalLink, Check, X, Flag, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';
import type { Quest, UserProfile } from '@/lib/types';
import { addXP, getTodayKeyLocal, getUserProfile, saveUserProfile } from '@/lib/storage';
import {
  ARCHIVIST_TITLE,
  BONUS_LESSON_XP,
  INTEL_UPDATED_EVENT,
  MAX_BONUS_LESSONS_PER_DAY,
  abandonCourse,
  bonusLessonsToday,
  directiveDoneToday,
  fetchLesson,
  getIntelState,
  masteryOf,
  nextLessonNumber,
  recordLesson,
  reportLesson,
  reviewLessonNumber,
  todaysDirectiveLesson,
  type IntelState,
  type Lesson,
  type LessonQuestion,
} from '@/lib/intel-course';
import { pushNotification } from '@/lib/notifications';
import { systemSound } from '@/lib/system-sound';
import IntelCoursePicker from '@/components/IntelCoursePicker';

interface Props {
  quest: Quest;
  /** Completes the Intel Briefing directive (pays its EXP) — called once the check is submitted. */
  onDirectiveComplete: () => void;
  onProfileUpdated?: (p: UserProfile) => void;
}

interface CheckItem extends LessonQuestion {
  review: boolean;
}

/** Lesson body: paragraphs, with "## " lines as subheadings. */
function LessonBody({ text }: { text: string }) {
  return (
    <div className="space-y-2 text-[12px] leading-relaxed text-gray-200">
      {text.split(/\n\n+/).map((block, i) =>
        block.startsWith('## ') ? (
          <div key={i} className="pt-1 text-[11px] font-bold tracking-wider text-[#9fd3ff]">
            {block.slice(3)}
          </div>
        ) : (
          <p key={i}>{block}</p>
        )
      )}
    </div>
  );
}

/**
 * The Intel Briefing session: today's lesson, then a multiple-choice check graded here (no AI).
 * Finishing the check completes the directive; afterwards up to 3 bonus lessons a day.
 */
export default function IntelBriefingPanel({ quest, onDirectiveComplete, onProfileUpdated }: Props) {
  const today = getTodayKeyLocal();
  const [state, setState] = useState<IntelState>(() => getIntelState());
  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [lessonN, setLessonN] = useState<number | null>(null);
  const [isBonus, setIsBonus] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [check, setCheck] = useState<CheckItem[] | null>(null);
  const [picks, setPicks] = useState<number[]>([]);
  const [graded, setGraded] = useState(false);

  useEffect(() => {
    const sync = () => setState(getIntelState());
    window.addEventListener(INTEL_UPDATED_EVENT, sync);
    return () => window.removeEventListener(INTEL_UPDATED_EVENT, sync);
  }, []);

  const doneToday = directiveDoneToday(today, state);

  const load = useCallback(
    async (n: number, bonus: boolean) => {
      const active = getIntelState().active;
      if (!active) return;
      setLoading(true);
      setError('');
      setLesson(null);
      setCheck(null);
      setGraded(false);
      setLessonN(n);
      setIsBonus(bonus);
      try {
        const l = await fetchLesson(active.key, n);
        setLesson(l);
        const items: CheckItem[] = l.questions.map((q) => ({ ...q, review: false }));
        // One review question from an earlier lesson (already in the library: no AI request).
        const reviewN = reviewLessonNumber(n, today);
        if (reviewN) {
          const older = await fetchLesson(active.key, reviewN).catch(() => null);
          const q = older?.questions[(n + reviewN) % (older?.questions.length || 1)];
          if (q) items.push({ ...q, review: true });
        }
        setCheck(items);
        setPicks(items.map(() => -1));
      } catch (err: any) {
        setError(String(err?.message || err).slice(0, 200));
      } finally {
        setLoading(false);
      }
    },
    [today]
  );

  // Today's directive lesson loads automatically until it is done.
  useEffect(() => {
    if (!state.active || doneToday || lessonN !== null) return;
    const n = todaysDirectiveLesson(today, state);
    if (n) load(n, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.active?.key, doneToday]);

  const submit = () => {
    if (!check || lessonN === null || graded) return;
    if (picks.some((p) => p < 0)) {
      toast.error('Answer every question.');
      return;
    }
    const correct = check.reduce((s, q, i) => s + (picks[i] === q.answer ? 1 : 0), 0);
    setGraded(true);
    const result = recordLesson(lessonN, correct, check.length, today, !isBonus);
    systemSound.playSuccess();
    toast.success(`[BRIEFING ${correct}/${check.length}]`, {
      description: isBonus ? `+${BONUS_LESSON_XP} EXP · bonus lesson.` : 'Intel Briefing complete.',
    });
    if (result) {
      if (isBonus) {
        const updated = addXP(getUserProfile(), BONUS_LESSON_XP);
        saveUserProfile(updated);
        onProfileUpdated?.(updated);
      } else {
        onDirectiveComplete();
      }
      if (result.finished) announceFinish(result.mastered);
    } else if (!isBonus && !quest.completed) {
      // Lesson was already recorded (e.g. on another device) — still close today's directive.
      onDirectiveComplete();
    }
    setState(getIntelState());
  };

  const announceFinish = (mastered: boolean) => {
    const active = getIntelState().active;
    const m = masteryOf();
    if (!active || !m) return;
    if (mastered) {
      const profile = getUserProfile();
      if (!(profile.unlockedTitles || []).includes(ARCHIVIST_TITLE)) {
        const updated = { ...profile, unlockedTitles: [...(profile.unlockedTitles || []), ARCHIVIST_TITLE] };
        saveUserProfile(updated);
        onProfileUpdated?.(updated);
      }
    }
    systemSound.playLevelUp();
    pushNotification({
      key: `intel-finished-${active.key}`,
      severity: 'milestone',
      title: mastered ? `[COURSE MASTERED] ${active.niche}` : `[COURSE COMPLETE] ${active.niche}`,
      description: mastered
        ? `All ${m.total} lessons, ${m.accuracy}% accuracy. Title acquired: ${ARCHIVIST_TITLE}.`
        : `All ${m.total} lessons done, ${m.accuracy}% accuracy. Mastery needs 70% — choose your next field, or begin this one again.`,
      route: '/knowledge-lab',
    });
  };

  const report = async () => {
    if (!lesson || !state.active) return;
    const reason = window.prompt('What is wrong with this lesson? (a fact, a question, the answer key…)');
    if (!reason || !reason.trim()) return;
    try {
      await reportLesson(state.active.key, lesson.n, reason.trim());
      toast.success('Report received. Three reports and THEIA rewrites the lesson.');
    } catch {
      toast.error('Report not sent. Try again later.');
    }
  };

  const box = 'mb-4 border border-cyan-400/40 bg-[#04182b]/80 rounded-[2px] px-3 py-3 text-left font-mono';

  if (!state.active) {
    return (
      <div className={box}>
        <div className="flex items-center gap-1.5 text-[10px] font-bold tracking-[0.2em] text-[#00d4ff] mb-2">
          <GraduationCap className="w-3.5 h-3.5" /> CHOOSE YOUR INTEL COURSE
        </div>
        <IntelCoursePicker onStarted={() => setState(getIntelState())} />
      </div>
    );
  }

  const m = masteryOf(state)!;
  const nextN = nextLessonNumber(state);
  const bonusLeft = MAX_BONUS_LESSONS_PER_DAY - bonusLessonsToday(today, state);
  const showingLesson = lessonN !== null && (!doneToday || isBonus || graded);

  return (
    <div className={box}>
      <div className="flex items-center gap-1.5 text-[10px] font-bold tracking-[0.2em] text-[#00d4ff]">
        <GraduationCap className="w-3.5 h-3.5" /> INTEL · {state.active.niche.toUpperCase()}
      </div>
      <div className="mt-1 text-[10px] text-white/55">
        {m.level.toUpperCase()} · {m.done}/{m.total} lessons{m.done ? ` · ${m.accuracy}% accuracy` : ''}
      </div>

      {loading && (
        <div className="mt-3 flex items-center gap-2 text-[11px] text-cyan-300">
          <Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading the lesson… (a new one takes up to a minute)
        </div>
      )}
      {error && (
        <div className="mt-3 text-[11px] text-rose-300">
          {error}{' '}
          <button type="button" onClick={() => lessonN && load(lessonN, isBonus)} className="underline text-white/70">
            Retry
          </button>
        </div>
      )}

      {/* Today's briefing already done, nothing open */}
      {doneToday && !showingLesson && !loading && (
        <div className="mt-3 space-y-2">
          <div className="flex items-center gap-1.5 text-[11px] text-emerald-300">
            <Check className="w-3.5 h-3.5" /> Today&apos;s briefing is complete.
          </div>
          {nextN && bonusLeft > 0 ? (
            <button
              type="button"
              onClick={() => load(nextN, true)}
              className="w-full flex items-center justify-between px-3 py-2 border border-white/30 text-[11px] text-white hover:bg-white/10 rounded-[2px]"
            >
              <span>NEXT LESSON (BONUS +{BONUS_LESSON_XP} EXP) · {bonusLeft} left today</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          ) : null}
          {!nextN && (
            <div className="text-[11px] text-white/60">
              Course complete.{' '}
              <button
                type="button"
                onClick={() => {
                  if (window.confirm('Close this course and choose a new field?')) {
                    abandonCourse();
                    setState(getIntelState());
                  }
                }}
                className="underline text-cyan-300"
              >
                Choose the next field
              </button>
            </div>
          )}
        </div>
      )}

      {/* Course finished before today's directive: nothing left to teach */}
      {!doneToday && !nextN && !loading && lessonN === null && (
        <div className="mt-3 text-[11px] text-white/70">
          Every lesson of this course is done.{' '}
          <button
            type="button"
            onClick={() => {
              abandonCourse();
              setState(getIntelState());
            }}
            className="underline text-cyan-300"
          >
            Choose the next field
          </button>{' '}
          to continue your briefings.
        </div>
      )}

      {showingLesson && lesson && (
        <div className="mt-3 space-y-3">
          <div>
            <div className="text-[10px] text-white/45 tracking-widest">
              LESSON {lesson.n} OF {m.total}
              {isBonus ? ' · BONUS' : ''}
            </div>
            <div className="text-sm font-bold text-white">{lesson.title}</div>
          </div>
          <LessonBody text={lesson.body} />
          <div className="flex items-center justify-between gap-2 text-[10px] text-white/45">
            <a href={lesson.source.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 hover:text-white">
              <ExternalLink className="w-3 h-3" /> Source: {lesson.source.title} (Wikipedia)
            </a>
            <button type="button" onClick={report} className="inline-flex items-center gap-1 hover:text-rose-300">
              <Flag className="w-3 h-3" /> Report an error
            </button>
          </div>

          {check && (
            <div className="border-t border-white/15 pt-3 space-y-3">
              <div className="text-[10px] font-bold tracking-[0.2em] text-[#00d4ff]">CHECK</div>
              {check.map((q, i) => (
                <div key={i} className="space-y-1">
                  <div className="text-[11px] text-white leading-relaxed">
                    {q.review && <span className="text-white/40">REVIEW · </span>}
                    {q.question}
                  </div>
                  <div className="grid gap-1">
                    {q.options.map((opt, oi) => {
                      const chosen = picks[i] === oi;
                      const right = graded && oi === q.answer;
                      const wrong = graded && chosen && oi !== q.answer;
                      return (
                        <button
                          key={oi}
                          type="button"
                          disabled={graded}
                          onClick={() => setPicks((prev) => prev.map((p, pi) => (pi === i ? oi : p)))}
                          className={`text-left px-2 py-1.5 border rounded-[2px] text-[11px] transition-colors ${
                            right
                              ? 'border-emerald-400 bg-emerald-950/40 text-emerald-200'
                              : wrong
                                ? 'border-rose-400 bg-rose-950/30 text-rose-200'
                                : chosen
                                  ? 'border-cyan-300 bg-cyan-950/40 text-white'
                                  : 'border-white/20 text-white/75 hover:border-white/50'
                          }`}
                        >
                          {right ? <Check className="inline w-3 h-3 mr-1" /> : wrong ? <X className="inline w-3 h-3 mr-1" /> : null}
                          {opt}
                        </button>
                      );
                    })}
                  </div>
                  {graded && q.explanation && <div className="text-[10px] text-white/50">{q.explanation}</div>}
                </div>
              ))}
              {!graded ? (
                <button type="button" onClick={submit} className="w-full py-2 text-[11px] font-bold bg-white text-black hover:bg-gray-200 rounded-[2px]">
                  SUBMIT
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setLessonN(null);
                    setLesson(null);
                    setCheck(null);
                    setGraded(false);
                    setState(getIntelState());
                  }}
                  className="w-full py-2 text-[11px] font-bold border border-white/30 text-white hover:bg-white/10 rounded-[2px]"
                >
                  DONE
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
