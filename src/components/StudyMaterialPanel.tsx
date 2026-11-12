import { useCallback, useEffect, useRef, useState } from 'react';
import { BookMarked, FileText, Plus, X, Upload, ClipboardPaste, Loader2, Bookmark, Brain, Check } from 'lucide-react';
import { toast } from 'sonner';
import type { Quest, UserProfile } from '@/lib/types';
import { addXP, getTodayKeyLocal, getUserProfile, saveUserProfile } from '@/lib/storage';
import {
  MAX_MATERIALS,
  deleteMaterialText,
  extractPdfPages,
  fingerprint,
  getMaterialText,
  saveMaterialText,
  splitPastedText,
  type MaterialText,
} from '@/lib/study-material';
import {
  STUDY_UPDATED_EVENT,
  addMaterial,
  applyResults,
  coveragePct,
  getStudyProgress,
  masteryPct,
  pickReviewRange,
  recordStop,
  removeMaterial,
  saveStudyProgress,
  sessionFor,
  todayPortion,
  updateSession,
  type StudyProgress,
} from '@/lib/study-progress';
import { buildSections, generateQuiz, gradeAnswers } from '@/lib/study-ai';
import { systemSound } from '@/lib/system-sound';

interface Props {
  quest: Quest;
  onProfileUpdated?: (p: UserProfile) => void;
}

const box = 'mb-4 border rounded-[2px] px-3 py-2.5 text-left font-mono';
const btn = 'px-2.5 py-1.5 text-[11px] font-bold rounded-[2px] disabled:opacity-40';
/** Passing the check: at least 2/3 of the possible score. Pays once a day. */
const PASS_RATIO = 2 / 3;
const PASS_XP = 10;

/**
 * Field Mastery material + recall check (Phase C). Material is optional: without it the
 * session works exactly as before and there is no check.
 */
export default function StudyMaterialPanel({ quest, onProfileUpdated }: Props) {
  const today = getTodayKeyLocal();
  const [progress, setProgress] = useState<StudyProgress>(() => getStudyProgress());
  const [text, setText] = useState<MaterialText | null | undefined>(undefined); // undefined = loading
  const [adding, setAdding] = useState<null | 'menu' | 'paste'>(null);
  const [pasteName, setPasteName] = useState('');
  const [pasteBody, setPasteBody] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [stopPage, setStopPage] = useState<number | null>(null);
  const [answers, setAnswers] = useState<string[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  const active = progress.activeId ? progress.materials[progress.activeId] : null;
  const session = sessionFor(progress, today);
  const sessionMaterial = session ? progress.materials[session.materialId] : null;

  const commit = (next: StudyProgress) => {
    saveStudyProgress(next);
    setProgress(next);
  };

  useEffect(() => {
    const sync = () => setProgress(getStudyProgress());
    window.addEventListener(STUDY_UPDATED_EVENT, sync);
    return () => window.removeEventListener(STUDY_UPDATED_EVENT, sync);
  }, []);

  // The active file's text, from this device.
  const activeId = session?.materialId || progress.activeId;
  useEffect(() => {
    let cancelled = false;
    setText(undefined);
    if (!activeId) {
      setText(null);
      return;
    }
    getMaterialText(activeId)
      .then((t) => !cancelled && setText(t || null))
      .catch(() => !cancelled && setText(null));
    return () => {
      cancelled = true;
    };
  }, [activeId]);

  const ingest = useCallback(
    async (name: string, kind: 'pdf' | 'text', pages: string[]) => {
      const id = fingerprint(name, pages);
      await saveMaterialText({ id, name, kind, pages, createdAt: new Date().toISOString() });
      const current = getStudyProgress();
      const known = current.materials[id];
      let sections = known?.sections;
      let sectionSource = known?.sectionSource || 'auto';
      if (!sections?.length) {
        setBusy('THEIA is mapping the material…');
        const plan = await buildSections(name, pages);
        sections = plan.sections;
        sectionSource = plan.source;
      }
      commit(
        addMaterial(current, {
          id,
          name,
          kind,
          pageCount: pages.length,
          sections,
          sectionSource,
          bookmark: known?.bookmark || 0,
          pacePpm: known?.pacePpm || 1 / 3,
          mastery: known?.mastery || {},
          addedAt: known?.addedAt || new Date().toISOString(),
        })
      );
      setText({ id, name, kind, pages, createdAt: new Date().toISOString() });
      setAdding(null);
      systemSound.playSuccess();
      toast.success(known ? '[MATERIAL RE-ATTACHED]' : '[MATERIAL BOUND]', {
        description: known ? 'Your progress continues where you stopped.' : `${pages.length} pages · ${sections.length} sections.`,
      });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  const onPdf = async (file: File) => {
    if (busy) return;
    const count = Object.keys(progress.materials).length;
    if (count >= MAX_MATERIALS && !Object.values(progress.materials).some((m) => m.name === file.name)) {
      toast.error(`Up to ${MAX_MATERIALS} files. Remove one first.`);
      return;
    }
    try {
      setBusy('Reading the PDF on this device…');
      const pages = await extractPdfPages(file, (done, total) => setBusy(`Reading page ${done} of ${total}…`));
      await ingest(file.name.replace(/\.pdf$/i, '').slice(0, 80), 'pdf', pages);
    } catch (err: any) {
      systemSound.playPenaltyWarning();
      toast.error('Could not read this PDF', { description: String(err?.message || err).slice(0, 180) });
    } finally {
      setBusy(null);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const onPaste = async () => {
    const pages = splitPastedText(pasteBody);
    if (pages.length === 0 || pasteBody.trim().length < 200) {
      toast.error('Paste at least a few paragraphs.');
      return;
    }
    if (Object.keys(progress.materials).length >= MAX_MATERIALS) {
      toast.error(`Up to ${MAX_MATERIALS} files. Remove one first.`);
      return;
    }
    try {
      await ingest((pasteName.trim() || 'Pasted notes').slice(0, 80), 'text', pages);
      setPasteBody('');
      setPasteName('');
    } finally {
      setBusy(null);
    }
  };

  const remove = async (id: string) => {
    const m = progress.materials[id];
    if (!m || !window.confirm(`Remove "${m.name}"? Its bookmark and mastery are deleted too.`)) return;
    await deleteMaterialText(id).catch(() => {});
    commit(removeMaterial(getStudyProgress(), id));
  };

  const confirmStop = (page: number) => {
    if (!active) return;
    const result = recordStop(getStudyProgress(), active.id, page, quest.duration || 30, today);
    if (!result) return;
    commit(result.progress);
    systemSound.playClick();
    const covered = result.session.to - result.session.from + 1;
    if (covered <= 0) toast.info('Bookmark unchanged. No recall check today.');
    else toast.success('[BOOKMARK MOVED]', { description: `Page ${result.session.to}. Tomorrow resumes at page ${result.session.to + 1}.` });
  };

  const startCheck = async () => {
    if (!session || !sessionMaterial || !text || busy) return;
    setBusy('THEIA is preparing your recall check…');
    try {
      const review = pickReviewRange(sessionMaterial, session.from, today.split('-').reduce((a, b) => a + Number(b), 0));
      const questions = await generateQuiz(sessionMaterial.name, text.pages, { from: session.from, to: session.to }, review);
      commit(updateSession(getStudyProgress(), today, { quiz: { questions } }));
      setAnswers(questions.map(() => ''));
    } catch (err: any) {
      toast.error('THEIA is unavailable right now', { description: 'Your bookmark is saved. Try the check again later.' });
    } finally {
      setBusy(null);
    }
  };

  const submitAnswers = async () => {
    const quiz = session?.quiz;
    if (!quiz || !sessionMaterial || !text || busy) return;
    if (answers.every((a) => !a.trim())) {
      toast.error('Answer at least one question.');
      return;
    }
    setBusy('THEIA is grading…');
    try {
      const results = await gradeAnswers(sessionMaterial.name, text.pages, quiz.questions, answers);
      let next = updateSession(getStudyProgress(), today, { quiz: { ...quiz, answers, results } });
      next = applyResults(next, sessionMaterial.id, quiz.questions, results);
      const score = results.reduce((s, r) => s + r.score, 0);
      const passed = score >= quiz.questions.length * PASS_RATIO;
      if (passed && !quiz.rewarded) {
        next = updateSession(next, today, { quiz: { ...quiz, answers, results, rewarded: true } });
        const profile = getUserProfile();
        const points = { STR: 0, AGI: 0, VIT: 0, INT: 0, PER: 0, WIS: 0, ...(profile.accumulatedPoints || {}) };
        points.INT += 1;
        const withHidden: UserProfile = { ...profile, accumulatedPoints: points };
        const updated = addXP(withHidden, PASS_XP);
        saveUserProfile(updated);
        onProfileUpdated?.(updated);
      }
      commit(next);
      systemSound.playSuccess();
      toast.success(`[RECALL ${score}/${quiz.questions.length}]`, {
        description: passed ? `+${PASS_XP} EXP · hidden INT +1.` : 'Below the mark. The weak sections will come back.',
      });
    } catch {
      toast.error('THEIA could not grade right now', { description: 'Your answers are kept. Submit again in a moment.' });
    } finally {
      setBusy(null);
    }
  };

  // ---------- render ----------

  const materials = Object.values(progress.materials);
  const busyLine = busy ? (
    <div className="mt-2 flex items-center gap-2 text-[11px] text-cyan-300">
      <Loader2 className="w-3.5 h-3.5 animate-spin" /> {busy}
    </div>
  ) : null;

  const addMenu = (
    <div className="mt-2 space-y-2">
      <input
        ref={fileRef}
        type="file"
        accept="application/pdf,.pdf"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onPdf(f);
        }}
      />
      {adding !== 'paste' ? (
        <div className="flex gap-2">
          <button type="button" disabled={!!busy} onClick={() => fileRef.current?.click()} className={`${btn} flex-1 bg-white text-black hover:bg-gray-200 flex items-center justify-center gap-1.5`}>
            <Upload className="w-3.5 h-3.5" /> PDF
          </button>
          <button type="button" disabled={!!busy} onClick={() => setAdding('paste')} className={`${btn} flex-1 border border-white/40 text-white hover:bg-white/10 flex items-center justify-center gap-1.5`}>
            <ClipboardPaste className="w-3.5 h-3.5" /> PASTE TEXT
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          <input value={pasteName} onChange={(e) => setPasteName(e.target.value)} maxLength={80} placeholder="Name (e.g. Periodontology ch. 3)" className="w-full px-2 py-1.5 bg-black/50 border border-white/25 rounded-[2px] text-xs text-white placeholder:text-white/30 outline-none focus:border-cyan-400" />
          <textarea value={pasteBody} onChange={(e) => setPasteBody(e.target.value)} rows={5} placeholder="Paste your notes or article…" className="w-full px-2 py-1.5 bg-black/50 border border-white/25 rounded-[2px] text-xs text-white placeholder:text-white/30 outline-none focus:border-cyan-400" />
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setAdding('menu')} className={`${btn} border border-white/25 text-white/60`}>Back</button>
            <button type="button" disabled={!!busy} onClick={onPaste} className={`${btn} bg-white text-black hover:bg-gray-200`}>SAVE</button>
          </div>
        </div>
      )}
      <p className="text-[10px] text-white/40 leading-relaxed">Stored on this device only. THEIA sees only the pages it quizzes you on.</p>
    </div>
  );

  // No material: one quiet line.
  if (materials.length === 0) {
    return (
      <div className={`${box} border-white/20 bg-[#061424]/50`}>
        <button type="button" onClick={() => setAdding(adding ? null : 'menu')} className="w-full flex items-center gap-2 text-[11px] text-[#9fd3ff] hover:text-white">
          <Plus className="w-3.5 h-3.5" /> ATTACH YOUR STUDY MATERIAL
          <span className="ml-auto text-[9px] text-white/35">optional</span>
        </button>
        {adding && addMenu}
        {busyLine}
      </div>
    );
  }

  const portion = active ? todayPortion(active, quest.duration || 30) : null;
  const quiz = session?.quiz;
  const coveredToday = session ? session.to - session.from + 1 : 0;

  return (
    <div className={`${box} border-cyan-400/40 bg-[#04182b]/80`}>
      <div className="flex items-center gap-1.5 text-[10px] font-bold tracking-[0.2em] text-[#00d4ff]">
        <BookMarked className="w-3.5 h-3.5" /> STUDY MATERIAL
      </div>

      {/* Files */}
      <div className="mt-2 flex flex-wrap gap-1.5">
        {materials.map((m) => (
          <span key={m.id} className={`inline-flex items-center gap-1 px-2 py-1 border rounded-[2px] text-[10px] ${m.id === progress.activeId ? 'border-cyan-300 text-white bg-cyan-950/40' : 'border-white/25 text-white/60'}`}>
            <button type="button" disabled={!!session} onClick={() => commit({ ...getStudyProgress(), activeId: m.id })} className="flex items-center gap-1 max-w-[150px] truncate disabled:cursor-default" title={m.name}>
              <FileText className="w-3 h-3 shrink-0" /> <span className="truncate">{m.name}</span>
            </button>
            <button type="button" onClick={() => remove(m.id)} className="text-white/35 hover:text-rose-300" aria-label={`Remove ${m.name}`}>
              <X className="w-3 h-3" />
            </button>
          </span>
        ))}
        {materials.length < MAX_MATERIALS && !session && (
          <button type="button" onClick={() => setAdding(adding ? null : 'menu')} className="inline-flex items-center gap-1 px-2 py-1 border border-dashed border-white/25 text-[10px] text-white/50 hover:text-white rounded-[2px]">
            <Plus className="w-3 h-3" /> ADD
          </button>
        )}
      </div>
      {adding && addMenu}

      {active && (
        <div className="mt-2 text-[10px] text-white/55">
          Page {active.bookmark} of {active.pageCount} · {coveragePct(active)}% covered
          {masteryPct(active) !== null ? ` · mastery ${masteryPct(active)}%` : ''}
        </div>
      )}

      {/* File missing on this device */}
      {active && text === null && (
        <div className="mt-2 text-[11px] text-amber-200/90">
          "{active.name}" is not on this device. Attach the same file again to continue — your bookmark is kept.
        </div>
      )}

      {/* Before / during the session: today's portion */}
      {active && text && !quest.completed && portion && (
        <div className="mt-2 flex items-start gap-2 text-xs text-white">
          <Bookmark className="w-3.5 h-3.5 mt-0.5 text-amber-300 shrink-0" />
          {portion.finished ? (
            <span>Material complete. Attach the next file, or keep reviewing.</span>
          ) : (
            <span>
              TODAY: pages {portion.from}–{portion.to}
              {portion.title ? <span className="text-white/60"> · {portion.title}</span> : null}
            </span>
          )}
        </div>
      )}

      {/* After the session: where did you stop? */}
      {active && text && quest.completed && !session && active.bookmark < active.pageCount && portion && (
        <div className="mt-3 space-y-2">
          <div className="text-[11px] font-bold text-white">WHERE DID YOU STOP?</div>
          <input
            type="range"
            min={active.bookmark}
            max={Math.min(active.pageCount, active.bookmark + Math.max(10, (portion.to - portion.from + 1) * 2))}
            value={stopPage ?? portion.to}
            onChange={(e) => setStopPage(Number(e.target.value))}
            className="w-full accent-cyan-400"
          />
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-white/60">
              {(stopPage ?? portion.to) <= active.bookmark ? 'No new pages' : `Page ${stopPage ?? portion.to}`}
            </span>
            <button type="button" onClick={() => confirmStop(stopPage ?? portion.to)} className={`${btn} bg-white text-black hover:bg-gray-200`}>
              CONFIRM
            </button>
          </div>
        </div>
      )}

      {/* Recall check */}
      {session && coveredToday > 0 && sessionMaterial && (
        <div className="mt-3 border-t border-white/15 pt-2.5">
          <div className="flex items-center gap-1.5 text-[10px] font-bold tracking-[0.2em] text-[#00d4ff]">
            <Brain className="w-3.5 h-3.5" /> RECALL CHECK · pages {session.from}–{session.to}
          </div>
          {!quiz && (
            text ? (
              <button type="button" disabled={!!busy} onClick={startCheck} className={`${btn} mt-2 w-full bg-white text-black hover:bg-gray-200`}>
                START CHECK
              </button>
            ) : (
              <p className="mt-1 text-[11px] text-amber-200/90">Attach "{sessionMaterial.name}" on this device to take the check.</p>
            )
          )}
          {quiz && !quiz.results && (
            <div className="mt-2 space-y-2.5">
              {quiz.questions.map((q, i) => (
                <div key={i}>
                  <div className="text-[11px] text-white leading-relaxed">
                    <span className="text-white/40">{q.source === 'review' ? 'REVIEW · ' : ''}p.{q.page} · </span>
                    {q.question}
                  </div>
                  <textarea
                    value={answers[i] || ''}
                    onChange={(e) => setAnswers((prev) => { const n = [...prev]; n[i] = e.target.value; return n; })}
                    rows={2}
                    maxLength={1500}
                    placeholder="In your own words…"
                    className="mt-1 w-full px-2 py-1.5 bg-black/50 border border-white/25 rounded-[2px] text-xs text-white placeholder:text-white/30 outline-none focus:border-cyan-400"
                  />
                </div>
              ))}
              <button type="button" disabled={!!busy || !text} onClick={submitAnswers} className={`${btn} w-full bg-white text-black hover:bg-gray-200`}>
                SUBMIT ANSWERS
              </button>
            </div>
          )}
          {quiz?.results && (
            <div className="mt-2 space-y-2">
              {quiz.questions.map((q, i) => {
                const r = quiz.results![i];
                const color = r.score === 1 ? 'text-emerald-300' : r.score === 0.5 ? 'text-amber-200' : 'text-rose-300';
                return (
                  <div key={i} className="text-[11px] leading-relaxed">
                    <div className="text-white/80">{q.question}</div>
                    <div className={color}>
                      {r.score === 1 ? <Check className="inline w-3 h-3 mr-1" /> : null}
                      {r.feedback}
                    </div>
                    {r.score < 1 && <div className="text-white/40">Key points: {q.keyPoints.join(' · ')}</div>}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
      {session && coveredToday <= 0 && <div className="mt-2 text-[10px] text-white/45">No new pages today, so no recall check.</div>}
      {busyLine}
    </div>
  );
}
