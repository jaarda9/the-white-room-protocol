import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, Plus, Calendar as CalendarIcon, Bell, Trash2, CheckCircle, Clock, AlertTriangle } from "lucide-react";
import { format, isToday, isBefore, addMinutes, differenceInMinutes } from "date-fns";

interface CalendarEvent {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  event_type: string;
  event_date: string;
  event_time: string | null;
  reminder_minutes: number | null;
  is_completed: boolean;
  priority: string;
  created_at: string;
  updated_at: string;
}

const EVENT_TYPES = [
  { value: "task", label: "Task", color: "bg-primary/20 text-primary border-primary/30" },
  { value: "deadline", label: "Deadline", color: "bg-critical/20 text-critical border-critical/30" },
  { value: "exam", label: "Exam", color: "bg-warning/20 text-warning border-warning/30" },
  { value: "reminder", label: "Reminder", color: "bg-info/20 text-info border-info/30" },
];

const PRIORITIES = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
  { value: "critical", label: "Critical" },
];

export default function CalendarPage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();

  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [notifiedIds, setNotifiedIds] = useState<Set<string>>(new Set());
  const reminderIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Form state
  const [formTitle, setFormTitle] = useState("");
  const [formDesc, setFormDesc] = useState("");
  const [formType, setFormType] = useState("task");
  const [formTime, setFormTime] = useState("");
  const [formReminder, setFormReminder] = useState("30");
  const [formPriority, setFormPriority] = useState("medium");

  const fetchEvents = useCallback(async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from("calendar_events")
      .select("*")
      .eq("user_id", user.id)
      .order("event_date", { ascending: true });

    if (error) {
      console.error("Error fetching events:", error);
    } else {
      setEvents((data as unknown as CalendarEvent[]) || []);
    }
    setLoading(false);
  }, [user]);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  // Reminder system
  useEffect(() => {
    if (!("Notification" in window)) return;
    if (Notification.permission === "default") {
      Notification.requestPermission();
    }

    const checkReminders = () => {
      const now = new Date();
      events.forEach((event) => {
        if (event.is_completed || !event.event_time || !event.reminder_minutes) return;
        if (notifiedIds.has(event.id)) return;

        const eventDateTime = new Date(`${event.event_date}T${event.event_time}`);
        const reminderTime = addMinutes(eventDateTime, -event.reminder_minutes);
        const diff = differenceInMinutes(reminderTime, now);

        if (diff <= 0 && diff > -5 && isBefore(now, eventDateTime)) {
          // Fire reminder
          const typeInfo = EVENT_TYPES.find((t) => t.value === event.event_type);
          const label = typeInfo?.label || "Event";

          toast({
            title: `⏰ ${label} Reminder`,
            description: `"${event.title}" starts in ${event.reminder_minutes} minutes!`,
          });

          if (Notification.permission === "granted") {
            new Notification(`${label}: ${event.title}`, {
              body: `Starting in ${event.reminder_minutes} minutes${event.description ? " — " + event.description : ""}`,
              icon: "/icons/icon-192x192.png",
            });
          }

          setNotifiedIds((prev) => new Set([...prev, event.id]));
        }
      });
    };

    reminderIntervalRef.current = setInterval(checkReminders, 30000);
    checkReminders();

    return () => {
      if (reminderIntervalRef.current) clearInterval(reminderIntervalRef.current);
    };
  }, [events, notifiedIds, toast]);

  const handleCreate = async () => {
    if (!user || !selectedDate || !formTitle.trim()) {
      toast({ title: "Error", description: "Title and date are required.", variant: "destructive" });
      return;
    }

    const { error } = await supabase.from("calendar_events").insert({
      user_id: user.id,
      title: formTitle.trim(),
      description: formDesc.trim() || null,
      event_type: formType,
      event_date: format(selectedDate, "yyyy-MM-dd"),
      event_time: formTime || null,
      reminder_minutes: parseInt(formReminder) || 30,
      priority: formPriority,
    } as any);

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Event Created", description: `"${formTitle}" added to calendar.` });
      setFormTitle("");
      setFormDesc("");
      setFormType("task");
      setFormTime("");
      setFormReminder("30");
      setFormPriority("medium");
      setDialogOpen(false);
      fetchEvents();
    }
  };

  const toggleComplete = async (event: CalendarEvent) => {
    const { error } = await supabase
      .from("calendar_events")
      .update({ is_completed: !event.is_completed } as any)
      .eq("id", event.id);

    if (!error) fetchEvents();
  };

  const deleteEvent = async (id: string) => {
    const { error } = await supabase.from("calendar_events").delete().eq("id", id);
    if (!error) fetchEvents();
  };

  const eventsForDate = (date: Date) =>
    events.filter((e) => e.event_date === format(date, "yyyy-MM-dd"));

  const selectedEvents = selectedDate ? eventsForDate(selectedDate) : [];

  const eventDates = events.map((e) => new Date(e.event_date + "T00:00:00"));

  const upcomingEvents = events
    .filter((e) => !e.is_completed && !isBefore(new Date(e.event_date + "T23:59:59"), new Date()))
    .slice(0, 5);

  const getPriorityIcon = (priority: string) => {
    if (priority === "critical") return <AlertTriangle className="h-3 w-3 text-critical" />;
    if (priority === "high") return <AlertTriangle className="h-3 w-3 text-warning" />;
    return null;
  };

  return (
    <div className="min-h-screen bg-background text-foreground font-mono p-4 sm:p-6">
      {/* Header */}
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <Button variant="ghost" size="icon" onClick={() => navigate("/")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex-1">
            <h1 className="text-lg sm:text-xl font-bold text-primary tracking-wider">
              MISSION CALENDAR
            </h1>
            <p className="text-xs text-muted-foreground">Track deadlines, exams & objectives</p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-1">
                <Plus className="h-4 w-4" /> New Event
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-card border-primary/30 font-mono max-w-md">
              <DialogHeader>
                <DialogTitle className="text-primary">CREATE EVENT</DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                <Input
                  placeholder="Event title..."
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  className="bg-background border-border"
                />
                <Textarea
                  placeholder="Description (optional)..."
                  value={formDesc}
                  onChange={(e) => setFormDesc(e.target.value)}
                  className="bg-background border-border text-sm"
                  rows={2}
                />
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">Type</label>
                    <Select value={formType} onValueChange={setFormType}>
                      <SelectTrigger className="bg-background border-border">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {EVENT_TYPES.map((t) => (
                          <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">Priority</label>
                    <Select value={formPriority} onValueChange={setFormPriority}>
                      <SelectTrigger className="bg-background border-border">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {PRIORITIES.map((p) => (
                          <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">Time</label>
                    <Input
                      type="time"
                      value={formTime}
                      onChange={(e) => setFormTime(e.target.value)}
                      className="bg-background border-border"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">Remind before</label>
                    <Select value={formReminder} onValueChange={setFormReminder}>
                      <SelectTrigger className="bg-background border-border">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="5">5 min</SelectItem>
                        <SelectItem value="15">15 min</SelectItem>
                        <SelectItem value="30">30 min</SelectItem>
                        <SelectItem value="60">1 hour</SelectItem>
                        <SelectItem value="120">2 hours</SelectItem>
                        <SelectItem value="1440">1 day</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="text-xs text-muted-foreground border border-border rounded p-2">
                  <CalendarIcon className="h-3 w-3 inline mr-1" />
                  Date: <span className="text-primary">{selectedDate ? format(selectedDate, "PPP") : "Select a date"}</span>
                </div>
                <Button onClick={handleCreate} className="w-full">CREATE EVENT</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Calendar */}
          <div className="lg:col-span-1 border border-primary/20 rounded-lg bg-card p-3">
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={setSelectedDate}
              className="pointer-events-auto"
              modifiers={{ hasEvent: eventDates }}
              modifiersClassNames={{ hasEvent: "bg-primary/20 font-bold text-primary" }}
            />
          </div>

          {/* Events for selected date */}
          <div className="lg:col-span-2 space-y-4">
            <div className="border border-primary/20 rounded-lg bg-card p-4">
              <h2 className="text-sm font-bold text-primary mb-3 flex items-center gap-2">
                <CalendarIcon className="h-4 w-4" />
                {selectedDate ? format(selectedDate, "EEEE, MMMM d, yyyy") : "Select a date"}
                {selectedDate && isToday(selectedDate) && (
                  <Badge variant="outline" className="text-[10px] border-primary/40 text-primary">TODAY</Badge>
                )}
              </h2>

              {loading ? (
                <p className="text-xs text-muted-foreground animate-pulse">Loading events...</p>
              ) : selectedEvents.length === 0 ? (
                <p className="text-xs text-muted-foreground py-6 text-center">No events for this date. Click "New Event" to add one.</p>
              ) : (
                <div className="space-y-2">
                  {selectedEvents.map((event) => {
                    const typeInfo = EVENT_TYPES.find((t) => t.value === event.event_type);
                    return (
                      <div
                        key={event.id}
                        className={`flex items-start gap-3 p-3 rounded border ${
                          event.is_completed ? "opacity-50 border-border" : "border-primary/15 bg-background"
                        }`}
                      >
                        <button onClick={() => toggleComplete(event)} className="mt-0.5">
                          <CheckCircle
                            className={`h-4 w-4 ${event.is_completed ? "text-primary" : "text-muted-foreground"}`}
                          />
                        </button>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={`text-sm font-medium ${event.is_completed ? "line-through" : ""}`}>
                              {event.title}
                            </span>
                            <Badge variant="outline" className={`text-[9px] ${typeInfo?.color || ""}`}>
                              {typeInfo?.label}
                            </Badge>
                            {getPriorityIcon(event.priority)}
                          </div>
                          {event.description && (
                            <p className="text-xs text-muted-foreground mt-1">{event.description}</p>
                          )}
                          <div className="flex items-center gap-3 mt-1.5 text-[10px] text-muted-foreground">
                            {event.event_time && (
                              <span className="flex items-center gap-1">
                                <Clock className="h-3 w-3" /> {event.event_time.slice(0, 5)}
                              </span>
                            )}
                            {event.reminder_minutes && (
                              <span className="flex items-center gap-1">
                                <Bell className="h-3 w-3" /> {event.reminder_minutes}m before
                              </span>
                            )}
                          </div>
                        </div>
                        <button onClick={() => deleteEvent(event.id)} className="text-muted-foreground hover:text-critical transition-colors">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Upcoming events */}
            <div className="border border-primary/20 rounded-lg bg-card p-4">
              <h2 className="text-sm font-bold text-primary mb-3 flex items-center gap-2">
                <Bell className="h-4 w-4" /> UPCOMING
              </h2>
              {upcomingEvents.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-3">No upcoming events.</p>
              ) : (
                <div className="space-y-2">
                  {upcomingEvents.map((event) => {
                    const typeInfo = EVENT_TYPES.find((t) => t.value === event.event_type);
                    return (
                      <div
                        key={event.id}
                        className="flex items-center gap-3 p-2 rounded border border-border text-xs cursor-pointer hover:border-primary/30 transition-colors"
                        onClick={() => setSelectedDate(new Date(event.event_date + "T00:00:00"))}
                      >
                        <span className="text-muted-foreground w-16 shrink-0">
                          {format(new Date(event.event_date + "T00:00:00"), "MMM d")}
                        </span>
                        <Badge variant="outline" className={`text-[9px] ${typeInfo?.color || ""}`}>
                          {typeInfo?.label}
                        </Badge>
                        <span className="truncate">{event.title}</span>
                        {getPriorityIcon(event.priority)}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
