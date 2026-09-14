import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Calendar } from "@/components/ui/calendar";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import {
  loadCalendarEvents,
  saveCalendarEvents,
  type StoredCalendarEvent,
} from "@/lib/calendar-events-storage";
import { ArrowLeft, Plus, Calendar as CalendarIcon, Clock, Trash2, CheckSquare, Square } from "lucide-react";
import { format, isToday, isBefore } from "date-fns";
import { systemSound } from "@/lib/system-sound";

type CalendarEvent = StoredCalendarEvent;

export default function CalendarPage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();

  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);

  // Form state
  const [formTitle, setFormTitle] = useState("");
  const [formDesc, setFormDesc] = useState("");
  const [formTime, setFormTime] = useState("");

  const fetchEvents = useCallback(() => {
    if (!user) return;
    setEvents(loadCalendarEvents(user.id));
    setLoading(false);
  }, [user]);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  const handleCreate = () => {
    if (!user || !selectedDate || !formTitle.trim()) {
      return;
    }
    systemSound.playSystemChime();

    const now = new Date().toISOString();
    const newEvent: CalendarEvent = {
      id: crypto.randomUUID(),
      user_id: user.id,
      title: formTitle.trim(),
      description: formDesc.trim() || null,
      event_type: "task",
      event_date: format(selectedDate, "yyyy-MM-dd"),
      event_time: formTime || null,
      reminder_minutes: 30,
      priority: "medium",
      is_completed: false,
      created_at: now,
      updated_at: now,
    };

    const next = [...loadCalendarEvents(user.id), newEvent].sort((a, b) =>
      a.event_date.localeCompare(b.event_date)
    );
    saveCalendarEvents(user.id, next);
    setFormTitle("");
    setFormDesc("");
    setFormTime("");
    setDialogOpen(false);
    fetchEvents();
  };

  const toggleComplete = (event: CalendarEvent) => {
    if (!user) return;
    systemSound.playClick();
    const now = new Date().toISOString();
    const next = loadCalendarEvents(user.id).map((e) =>
      e.id === event.id ? { ...e, is_completed: !e.is_completed, updated_at: now } : e
    );
    saveCalendarEvents(user.id, next);
    fetchEvents();
  };

  const deleteEvent = (id: string) => {
    if (!user) return;
    systemSound.playClick();
    const next = loadCalendarEvents(user.id).filter((e) => e.id !== id);
    saveCalendarEvents(user.id, next);
    fetchEvents();
  };

  const eventsForDate = (date: Date) =>
    events.filter((e) => e.event_date === format(date, "yyyy-MM-dd"));

  const selectedEvents = selectedDate ? eventsForDate(selectedDate) : [];
  const eventDates = events.map((e) => new Date(e.event_date + "T00:00:00"));

  return (
    <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
      <div className="min-h-screen pt-8 sm:pt-14 md:pt-16 pb-36 sm:pb-40 bg-[#071322] text-[#e5ecf4] flex flex-col system-blueprint-bg font-mono">
        <main className="max-w-[620px] w-full mx-auto px-4 py-6 sm:py-10 flex-1 flex flex-col my-auto">
          {/* Single unified window, matching Status/Daily Quest/Codex — calendar and agenda
              stacked in one vertical flow instead of a side-by-side dashboard split. */}
          <div className="relative w-full bg-[#0a1b2e]/90 border-2 border-white/50 rounded-[4px] p-5 sm:p-8 text-white shadow-[0_0_30px_rgba(0,0,0,0.85),inset_0_0_24px_rgba(0,212,255,0.08)] backdrop-blur-md anime-dropdown font-mono">
            {/* Header row */}
            <div className="flex items-center justify-end pb-2 mb-3 border-b border-white/20 text-xs">
              <DialogTrigger asChild>
                <button
                  onClick={() => systemSound.playClick()}
                  className="flex items-center gap-1.5 text-cyan-300/80 hover:text-white transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>[ LOG PROTOCOL ]</span>
                </button>
              </DialogTrigger>
            </div>

            {/* Title plate */}
            <div className="relative flex flex-col items-center justify-center pb-2 mb-5">
              <div className="inline-block px-8 py-1 border border-white/70 bg-[#061426]/60 shadow-[0_0_14px_rgba(0,212,255,0.35)]">
                <h1 className="text-lg sm:text-xl font-mono font-extrabold text-white anime-glow-text tracking-[0.2em] flex items-center gap-2">
                  <CalendarIcon className="w-4 h-4 text-[#9fd3ff]" />
                  MISSION TIMELINE
                </h1>
              </div>
              <p className="text-[11px] font-mono text-white/60 mt-2.5 text-center max-w-[420px]">
                Synchronized operation logs, gate infiltration deadlines, and training schedule.
              </p>
            </div>

            {/* Calendar Widget */}
            <div className="flex justify-center mb-5">
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={setSelectedDate}
                className="font-mono text-sm text-gray-200"
                modifiers={{ hasEvent: eventDates }}
                modifiersClassNames={{ hasEvent: "text-[#9fd3ff] font-bold bg-cyan-950/40 rounded-[2px]" }}
              />
            </div>

            {/* Selected Date Agenda */}
            <div>
              <div className="flex items-center justify-between border-t border-white/15 pt-4 mb-3">
                <div className="font-mono font-bold text-xs sm:text-sm text-white anime-glow-text flex items-center gap-2">
                  <CalendarIcon className="w-3.5 h-3.5 text-[#9fd3ff]" />
                  <span>{selectedDate ? format(selectedDate, "EEEE, MMMM d, yyyy") : "Select a date"}</span>
                </div>
                {selectedDate && isToday(selectedDate) && (
                  <span className="text-[9px] font-mono px-1.5 py-0.5 border border-cyan-400/50 text-cyan-300 bg-cyan-950/40 rounded-[2px]">
                    TODAY
                  </span>
                )}
              </div>

              {selectedEvents.length === 0 ? (
                <div className="py-8 text-center text-xs font-mono text-gray-400">
                  [ NO MISSION OPERATIONS LOGGED FOR THIS DATE ]
                </div>
              ) : (
                <div className="space-y-2.5 font-mono">
                  {selectedEvents.map((ev) => (
                    <div
                      key={ev.id}
                      className={`p-3 border rounded-[2px] flex items-start justify-between gap-3 transition-all ${
                        ev.is_completed
                          ? 'border-white/10 bg-black/30 opacity-60'
                          : 'border-white/25 bg-[#061424]/75 hover:border-white/50'
                      }`}
                    >
                      <button
                        onClick={() => toggleComplete(ev)}
                        className="mt-0.5 text-[#9fd3ff] hover:text-white transition-colors"
                      >
                        {ev.is_completed ? (
                          <CheckSquare className="w-4 h-4 text-emerald-400" />
                        ) : (
                          <Square className="w-4 h-4 text-gray-400" />
                        )}
                      </button>

                      <div className="flex-1 min-w-0">
                        <div className={`text-xs font-bold ${ev.is_completed ? 'line-through text-gray-400' : 'text-white'}`}>
                          {ev.title}
                        </div>
                        {ev.description && (
                          <div className="text-[11px] text-gray-300 mt-0.5">{ev.description}</div>
                        )}
                        {ev.event_time && (
                          <div className="text-[10px] text-[#9fd3ff] mt-1 flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            <span>{ev.event_time}</span>
                          </div>
                        )}
                      </div>

                      <button
                        onClick={() => deleteEvent(ev.id)}
                        className="text-gray-400 hover:text-red-400 transition-colors p-1"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </main>

        <DialogContent className="bg-[#0a1b2e] border-2 border-white/50 text-white max-w-sm shadow-[0_0_30px_rgba(0,0,0,0.9)] font-mono">
          <DialogHeader>
            <DialogTitle className="font-mono font-bold text-white anime-glow-text text-center tracking-wider">
              [ LOG MISSION PROTOCOL ]
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 font-mono text-xs pt-2">
            <div>
              <label className="text-gray-300 block mb-1">Title</label>
              <input
                type="text"
                placeholder="e.g. 100 Push-ups Drill"
                value={formTitle}
                onChange={(e) => setFormTitle(e.target.value)}
                className="w-full bg-[#061426] border border-white/30 p-2 text-white outline-none focus:border-cyan-400 rounded-[2px]"
              />
            </div>
            <div>
              <label className="text-gray-300 block mb-1">Time</label>
              <input
                type="time"
                value={formTime}
                onChange={(e) => setFormTime(e.target.value)}
                className="w-full bg-[#061426] border border-white/30 p-2 text-white outline-none focus:border-cyan-400 rounded-[2px]"
              />
            </div>
            <div>
              <label className="text-gray-300 block mb-1">Details</label>
              <textarea
                placeholder="Optional description..."
                value={formDesc}
                onChange={(e) => setFormDesc(e.target.value)}
                rows={2}
                className="w-full bg-[#061426] border border-white/30 p-2 text-white outline-none focus:border-cyan-400 rounded-[2px]"
              />
            </div>
            <button
              onClick={handleCreate}
              disabled={!formTitle.trim()}
              className="w-full py-2.5 border-2 border-cyan-400 bg-cyan-950/80 hover:bg-cyan-900 text-cyan-300 hover:text-white font-bold tracking-wider transition-all disabled:opacity-40 disabled:cursor-not-allowed rounded-[2px] shadow-[0_0_14px_rgba(0,212,255,0.4)]"
            >
              [ SAVE EVENT ]
            </button>
          </div>
        </DialogContent>
      </div>
    </Dialog>
  );
}
