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
      <div className="min-h-screen pt-6 pb-28 bg-[#071322] text-[#e5ecf4] flex flex-col system-blueprint-bg font-mono">
        <main className="max-w-4xl mx-auto w-full px-4 py-8 flex-1 space-y-6">
          <div className="flex items-center justify-between">
            <button
              onClick={() => {
                systemSound.playClick();
                navigate('/');
              }}
              className="flex items-center gap-2 px-3 py-1.5 border border-white/50 bg-[#061426]/80 text-[#9fd3ff] text-xs font-mono hover:bg-white/10 hover:border-white transition-all shadow-[0_0_10px_rgba(0,212,255,0.2)]"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>[ RETURN TO STATUS ]</span>
            </button>

            <DialogTrigger asChild>
              <button
                onClick={() => systemSound.playClick()}
                className="px-3 py-1.5 border border-white/60 bg-white/10 text-white font-mono text-xs font-bold hover:bg-white/20 transition-all flex items-center gap-1.5 shadow-[0_0_10px_rgba(0,212,255,0.2)] rounded-[2px]"
              >
                <Plus className="w-3.5 h-3.5 text-[#9fd3ff]" />
                <span>LOG PROTOCOL</span>
              </button>
            </DialogTrigger>
          </div>

          <div className="relative bg-[#0a1b2e]/90 border-2 border-white/50 rounded-[4px] p-6 text-center text-white shadow-[0_0_30px_rgba(0,0,0,0.85),inset_0_0_24px_rgba(0,212,255,0.08)] backdrop-blur-md anime-dropdown">
            <div className="inline-block px-8 py-1 border border-white/70 bg-[#061426]/60 shadow-[0_0_14px_rgba(0,212,255,0.35)] mb-2">
              <h1 className="text-xl sm:text-2xl font-mono font-bold text-white anime-glow-text tracking-[0.2em] flex items-center justify-center gap-2">
                <CalendarIcon className="w-5 h-5 text-[#9fd3ff]" />
                MISSION TIMELINE & SCHEDULE
              </h1>
            </div>
            <p className="text-xs font-mono text-white/80 mt-1">
              Synchronized operation logs, gate infiltration deadlines, and training schedule.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 anime-dropdown">
            {/* Calendar Widget */}
            <div className="bg-[#0a1b2e]/90 border-2 border-white/50 rounded-[4px] p-4 flex justify-center items-center text-white shadow-[0_0_30px_rgba(0,0,0,0.85),inset_0_0_24px_rgba(0,212,255,0.08)] backdrop-blur-md">
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={setSelectedDate}
                className="font-mono text-sm text-gray-200"
                modifiers={{ hasEvent: eventDates }}
                modifiersClassNames={{ hasEvent: "text-[#9fd3ff] font-bold bg-white/20 rounded-[2px]" }}
              />
            </div>

            {/* Selected Date Events */}
            <div className="md:col-span-2 bg-[#0a1b2e]/90 border-2 border-white/50 rounded-[4px] p-6 space-y-4 text-white shadow-[0_0_30px_rgba(0,0,0,0.85),inset_0_0_24px_rgba(0,212,255,0.08)] backdrop-blur-md">
              <div className="flex items-center justify-between border-b border-white/20 pb-3">
                <div className="font-mono font-bold text-sm sm:text-base text-white anime-glow-text flex items-center gap-2">
                  <CalendarIcon className="w-4 h-4 text-[#9fd3ff]" />
                  <span>{selectedDate ? format(selectedDate, "EEEE, MMMM d, yyyy") : "Select a date"}</span>
                </div>
                {selectedDate && isToday(selectedDate) && (
                  <span className="text-[10px] font-mono px-2 py-0.5 border border-white/50 text-[#9fd3ff] bg-[#061426]/80 rounded-[2px]">
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
                          : 'border-white/30 bg-[#061424]/75 hover:border-white/60'
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

        <DialogContent className="bg-[#0a1b2e] border-2 border-white/50 text-white max-w-sm shadow-[0_0_30px_rgba(0,0,0,0.9)]">
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
                className="w-full bg-[#061426] border border-white/30 p-2 text-white outline-none focus:border-white rounded-[2px]"
              />
            </div>
            <div>
              <label className="text-gray-300 block mb-1">Time</label>
              <input
                type="time"
                value={formTime}
                onChange={(e) => setFormTime(e.target.value)}
                className="w-full bg-[#061426] border border-white/30 p-2 text-white outline-none focus:border-white rounded-[2px]"
              />
            </div>
            <div>
              <label className="text-gray-300 block mb-1">Details</label>
              <textarea
                placeholder="Optional description..."
                value={formDesc}
                onChange={(e) => setFormDesc(e.target.value)}
                rows={2}
                className="w-full bg-[#061426] border border-white/30 p-2 text-white outline-none focus:border-white rounded-[2px]"
              />
            </div>
            <button
              onClick={handleCreate}
              disabled={!formTitle.trim()}
              className="w-full py-2.5 bg-white text-black font-bold hover:bg-gray-200 transition-colors disabled:opacity-40 rounded-[2px]"
            >
              SAVE EVENT
            </button>
          </div>
        </DialogContent>
      </div>
    </Dialog>
  );
}
