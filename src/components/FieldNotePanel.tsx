import { useEffect, useState } from 'react';
import { NotebookPen, Check, Pencil, Sparkles, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import type { Attributes, Quest, UserProfile } from '@/lib/types';
import { getHunterProtocolConfig, getTodayKeyLocal, getUserProfile, saveUserProfile } from '@/lib/storage';
import {
  FIELD_NOTE_SPECS,
  NOTE_LIMITS,
  fieldNoteKindFor,
  getFieldNote,
  saveFieldNote,
  saveNoteExtras,
  type FieldNote,
} from '@/lib/field-notes';
import { runReadingCompanion } from '@/lib/theia-companion';
import { systemSound } from '@/lib/system-sound';

interface Props {
  quest: Quest;
  onProfileUpdated?: (profile: UserProfile) => void;
}

/**
 * Shown on the session card once a reading / reflection / gratitude directive is complete.
 * Optional: the directive already counts. Writing the note pays a small hidden stat bonus once
 * per day (field-notes.ts).
 */
export default function FieldNotePanel({ quest, onProfileUpdated }: Props) {
  const kind = fieldNoteKindFor(quest);
  const today = getTodayKeyLocal();
  const [saved, setSaved] = useState<FieldNote | null>(() => (kind ? getFieldNote(today, kind) : null));
  const [editing, setEditing] = useState(false);
  const [lines, setLines] = useState<string[]>(() => saved?.lines || []);
  const [companionBusy, setCompanionBusy] = useState(false);
  const [reply, setReply] = useState('');

  useEffect(() => {
    if (!kind) return;
    const existing = getFieldNote(today, kind);
    setSaved(existing);
    setLines(existing?.lines || []);
  }, [kind, today]);

  if (!kind || !quest.completed) return null;
  const spec = FIELD_NOTE_SPECS[kind];

  const submit = () => {
    const context = kind === 'reading' ? getHunterProtocolConfig().mentalPreferences?.currentBookTitle : undefined;
    const result = saveFieldNote(today, kind, lines, context);
    if (!result) {
      toast.error(kind === 'reading' ? 'Write the one idea first.' : 'Write at least one line.');
      return;
    }
    setSaved(result.note);
    setLines(result.note.lines);
    setEditing(false);
    // Reading companion: one THEIA request, only the first time today's takeaway is written.
    if (kind === 'reading' && result.firstToday && !result.note.companion) askCompanion(result.note);
    if (result.firstToday) {
      // Hidden stat bonus, once per day: same accumulatedPoints path as session rewards.
      const profile = getUserProfile();
      const points = { STR: 0, AGI: 0, VIT: 0, INT: 0, PER: 0, WIS: 0, ...(profile.accumulatedPoints || {}) };
      for (const [attr, value] of Object.entries(spec.bonus)) {
        points[attr as keyof Attributes] += Number(value) || 0;
      }
      const updated: UserProfile = { ...profile, accumulatedPoints: points };
      saveUserProfile(updated);
      onProfileUpdated?.(updated);
      systemSound.playSuccess();
      const stat = Object.keys(spec.bonus)[0];
      toast.success(`[${spec.title} RECORDED]`, { description: `Hidden ${stat} progress +1.` });
    } else {
      systemSound.playClick();
      toast.success(`[${spec.title} UPDATED]`);
    }
  };

  async function askCompanion(note: FieldNote) {
    setCompanionBusy(true);
    const updated = await runReadingCompanion(note);
    setCompanionBusy(false);
    if (updated) setSaved(updated);
  }

  const sendReply = () => {
    if (!saved || !reply.trim()) return;
    const updated = saveNoteExtras(saved.date, saved.kind, { reply });
    if (updated) {
      setSaved(updated);
      setReply('');
      systemSound.playClick();
    }
  };

  const companionBlock =
    kind === 'reading' && saved ? (
      companionBusy ? (
        <div className="mt-2 flex items-center gap-1.5 text-[10px] text-cyan-300">
          <Loader2 className="w-3 h-3 animate-spin" /> THEIA is reading your extract…
        </div>
      ) : saved.companion ? (
        <div className="mt-2 border-t border-white/10 pt-2 space-y-1.5">
          <div className="flex items-start gap-1.5 text-[11px] text-[#9fd3ff] leading-relaxed">
            <Sparkles className="w-3 h-3 mt-0.5 shrink-0" />
            <span>
              <span className="text-white/40">THEIA{saved.companion.kind === 'connection' ? ' · CONNECTION' : ''}: </span>
              {saved.companion.text}
            </span>
          </div>
          {saved.reply ? (
            <div className="text-[11px] text-gray-300">
              <span className="text-white/40">YOU: </span>
              {saved.reply}
            </div>
          ) : (
            <div className="flex gap-1.5">
              <input
                value={reply}
                maxLength={NOTE_LIMITS.line}
                onChange={(e) => setReply(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && sendReply()}
                placeholder="Answer in one line (optional)"
                className="flex-1 min-w-0 px-2 py-1 bg-black/50 border border-white/20 focus:border-cyan-400 rounded-[2px] text-[11px] text-white placeholder:text-white/30 outline-none"
              />
              <button type="button" onClick={sendReply} className="px-2 py-1 text-[10px] font-bold border border-white/30 text-white hover:bg-white/10 rounded-[2px]">
                SAVE
              </button>
            </div>
          )}
        </div>
      ) : (
        <button
          type="button"
          onClick={() => askCompanion(saved)}
          className="mt-2 inline-flex items-center gap-1 text-[10px] text-cyan-300/80 hover:text-white"
        >
          <Sparkles className="w-3 h-3" /> Ask THEIA about this extract
        </button>
      )
    ) : null;

  if (saved && !editing) {
    return (
      <div className="mt-4 border border-emerald-500/40 bg-emerald-950/15 rounded-[2px] p-3 text-left font-mono">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 text-[10px] font-bold tracking-[0.2em] text-emerald-300">
            <Check className="w-3.5 h-3.5" /> {spec.title} RECORDED
          </div>
          <button
            type="button"
            onClick={() => {
              systemSound.playClick();
              setEditing(true);
            }}
            className="p-1 text-white/40 hover:text-white"
            aria-label="Edit note"
            title="Edit"
          >
            <Pencil className="w-3.5 h-3.5" />
          </button>
        </div>
        <ul className="mt-1.5 space-y-0.5 text-[11px] text-gray-200">
          {saved.lines.map((l, i) =>
            l ? (
              <li key={i}>
                {spec.fields.length > 1 && <span className="text-white/40">{spec.fields[i].label}: </span>}
                {l}
              </li>
            ) : null
          )}
        </ul>
        {companionBlock}
      </div>
    );
  }

  return (
    <div className="mt-4 border border-cyan-400/50 bg-[#04182b]/90 rounded-[2px] p-3 text-left font-mono anime-dropdown">
      <div className="flex items-center gap-1.5 text-[10px] font-bold tracking-[0.2em] text-[#00d4ff]">
        <NotebookPen className="w-3.5 h-3.5" /> {spec.title}
        <span className="ml-auto text-[9px] font-normal tracking-normal text-white/40">optional · +1 hidden {Object.keys(spec.bonus)[0]}</span>
      </div>
      <p className="mt-1 text-[11px] text-gray-300 leading-relaxed">{spec.prompt}</p>
      <div className="mt-2 space-y-1.5">
        {spec.fields.map((f, i) => (
          <div key={f.label} className="flex items-center gap-2">
            {spec.fields.length > 1 && <span className="w-20 shrink-0 text-[9px] text-white/45 tracking-widest">{f.label}</span>}
            <input
              value={lines[i] || ''}
              maxLength={NOTE_LIMITS.line}
              onChange={(e) =>
                setLines((prev) => {
                  const next = [...prev];
                  next[i] = e.target.value;
                  return next;
                })
              }
              onKeyDown={(e) => {
                if (e.key === 'Enter' && i === spec.fields.length - 1) submit();
              }}
              placeholder={f.placeholder}
              className="flex-1 min-w-0 px-2 py-1.5 bg-black/50 border border-white/25 focus:border-cyan-400 rounded-[2px] text-xs text-white placeholder:text-white/30 outline-none"
            />
          </div>
        ))}
      </div>
      <div className="mt-2 flex justify-end gap-2">
        {editing && (
          <button
            type="button"
            onClick={() => {
              setEditing(false);
              setLines(saved?.lines || []);
            }}
            className="px-2.5 py-1 text-[10px] border border-white/25 text-white/60 hover:text-white rounded-[2px]"
          >
            Cancel
          </button>
        )}
        <button
          type="button"
          onClick={submit}
          className="px-3 py-1 text-[10px] font-bold bg-white text-black hover:bg-gray-200 rounded-[2px]"
        >
          RECORD
        </button>
      </div>
    </div>
  );
}
