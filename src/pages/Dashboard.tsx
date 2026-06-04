import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ProtocolGauge } from '@/components/ProtocolGauge';
import { AttributeReadout } from '@/components/AttributeReadout';
import { QuestCard } from '@/components/QuestCard';
import AIChat from '@/components/AIChat';
import {
  acceptSuggestedToDo,
  completeToDo,
  getTodayKeyLocal,
  getToDos,
  ignoreSuggestedToDo,
  getUserProfile,
  getDailyQuests,
  QUESTS_UPDATED_EVENT,
  TODOS_UPDATED_EVENT,
} from '@/lib/storage';
import { UserProfile, Quest, ToDoItem } from '@/lib/types';
import { parseUserTodosFromInput } from '@/lib/todo-ai';
import {
  Brain, Dumbbell, BookOpen, Users, Crown, Target,
  Trophy, BarChart3, User, MessageSquare, TestTube,
  ChevronRight, Zap, Terminal, Lock, CalendarDays,
  ListChecks,
} from 'lucide-react';
import { getAchievementStats } from '@/lib/achievements';

const CATEGORIES = [
  { key: 'mental', label: 'MENTAL', types: ['mental'], icon: Brain, tag: 'MNT' },
  { key: 'physical', label: 'PHYSICAL', types: ['physical'], icon: Dumbbell, tag: 'PHY' },
  { key: 'spiritual', label: 'SPIRITUAL', types: ['social'], icon: BookOpen, tag: 'SPR' },
  { key: 'todos', label: "TO-DO'S", types: [] as string[], icon: ListChecks, tag: 'TODO' },
];

const LABS = [
  { label: 'Social Lab', icon: Users, path: '/social-lab', desc: 'Interpersonal simulation', unlockLevel: 10 },
  { label: 'Mental Lab', icon: Brain, path: '/mental-lab', desc: 'Cognitive protocols', unlockLevel: 10 },
  { label: 'Physical Lab', icon: Dumbbell, path: '/physical-lab', desc: 'Body conditioning', unlockLevel: 10 },
  { label: 'Knowledge Lab', icon: BookOpen, path: '/knowledge-lab', desc: 'Research & study', unlockLevel: 15 },
  { label: 'Chess Lab', icon: Crown, path: '/chess-lab', desc: 'Strategic training', unlockLevel: 15 },
  { label: 'Skill Forge', icon: Target, path: '/skill-forge', desc: 'Custom skill plans', unlockLevel: 20 },
  { label: 'Kinnu Lab', icon: TestTube, path: '/kinnu-lab', desc: 'Structured learning maps & quizzes', unlockLevel: 10 },
];

const isStudySessionQuest = (quest: Quest): boolean =>
  /^mental-study\d+-/.test(quest.id) || /^Study Session \d+/i.test(quest.title);

const getActiveQuest = (items: Quest[]): Quest | null => {
  if (items.length === 0) return null;
  const next = items.find((q) => !q.completed);
  return next ?? items[items.length - 1];
};

const countPhysicalSubtasks = (quest: Quest): number => {
  if (quest.type !== 'physical') return 1;
  const d = (quest.description || '').trim();
  if (!d) return 1;
  if (!d.includes('•')) return 1;
  return d.split('•').map((s) => s.trim()).filter(Boolean).length || 1;
};

const countCategoryUnits = (quests: Quest[], type: Quest['type']): { done: number; total: number } => {
  if (type !== 'physical') {
    const total = quests.length;
    const done = quests.filter((q) => q.completed).length;
    return { done, total };
  }
  const total = quests.reduce((sum, q) => sum + countPhysicalSubtasks(q), 0);
  const done = quests.reduce((sum, q) => sum + (q.completed ? countPhysicalSubtasks(q) : 0), 0);
  return { done, total };
};

const Dashboard = () => {
  const navigate = useNavigate();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [quests, setQuests] = useState<Quest[]>([]);
  const [openCategory, setOpenCategory] = useState<string | null>(null);
  const [questStatus, setQuestStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [showChat, setShowChat] = useState(false);
  const [mentalVisibleQuest, setMentalVisibleQuest] = useState<Quest | null>(null);
  const [mentalAnim, setMentalAnim] = useState<'idle' | 'exit' | 'enter'>('idle');
  const [todos, setTodos] = useState<ToDoItem[]>([]);
  const [todoAiInput, setTodoAiInput] = useState('');
  const [todoAiBusy, setTodoAiBusy] = useState(false);
  const [todoAiHint, setTodoAiHint] = useState<string | null>(null);

  useEffect(() => {
    setProfile(getUserProfile());
  }, []);

  const studySessionQuests = useMemo(
    () => quests.filter((q) => q.type === 'mental' && isStudySessionQuest(q)),
    [quests],
  );

  useEffect(() => {
    const nextQuest = getActiveQuest(studySessionQuests);

    if (!mentalVisibleQuest) {
      setMentalVisibleQuest(nextQuest);
      return;
    }

    if (!nextQuest || nextQuest.id === mentalVisibleQuest.id) return;

    setMentalAnim('exit');
    const exitTimer = window.setTimeout(() => {
      setMentalVisibleQuest(nextQuest);
      setMentalAnim('enter');
      window.setTimeout(() => setMentalAnim('idle'), 220);
    }, 220);

    return () => window.clearTimeout(exitTimer);
  }, [studySessionQuests, mentalVisibleQuest]);

  useEffect(() => {
    let active = true;
    const loadQuests = async () => {
      try {
        setQuestStatus(prev => (prev === 'ready' ? prev : 'loading'));
        const data = await getDailyQuests();
        if (!active) return;
        setQuests(data);
        setQuestStatus('ready');
      } catch (error) {
        console.error('Failed to load quests', error);
        if (active) setQuestStatus('error');
      }
    };
    loadQuests();
    window.addEventListener(QUESTS_UPDATED_EVENT, loadQuests);
    return () => {
      active = false;
      window.removeEventListener(QUESTS_UPDATED_EVENT, loadQuests);
    };
  }, []);

  useEffect(() => {
    const load = () => setTodos(getToDos());
    load();
    window.addEventListener(TODOS_UPDATED_EVENT, load);
    return () => window.removeEventListener(TODOS_UPDATED_EVENT, load);
  }, []);

  if (!profile) return null;

  const completedCount = quests.filter(q => q.completed).length;
  const achievementStats = getAchievementStats();
  const unlockedAchievements = Object.values(achievementStats.achievements).filter(a => a.unlocked).length;
  const xpPct = (profile.xp / profile.xpToNextLevel) * 100;
  const dateStr = new Date().toISOString().split('T')[0];
  const timeStr = new Date().toLocaleTimeString('en-US', { hour12: false });
  const today = new Date();
  const todayKey = getTodayKeyLocal(today);
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);
  const tomorrowKey = getTodayKeyLocal(tomorrow);

  const todaysToDos = todos.filter((t) => t.dueDate === todayKey && (t.status === 'active' || t.status === 'completed'));
  const suggestedToDos = todos.filter((t) => t.dueDate === todayKey && t.status === 'suggested');
  const tomorrowsToDos = todos.filter((t) => t.dueDate === tomorrowKey && (t.status === 'active' || t.status === 'completed'));
  const suggestedTomorrowsToDos = todos.filter((t) => t.dueDate === tomorrowKey && t.status === 'suggested');
  const todoDone = todaysToDos.filter((t) => t.status === 'completed').length;
  const todoTotal = todaysToDos.length + suggestedToDos.length;

  return (
    <div className="min-h-screen bg-background">
      {/* ═══ CLASSIFICATION STRIP ═══ */}
      <div className="bg-primary/10 border-b border-primary/30">
        <div className="mx-auto max-w-7xl px-3 sm:px-4 py-0.5 flex items-center justify-between data-readout text-[10px] tracking-[0.3em] text-primary/80">
          <span>◆ SIS · SECRET INTELLIGENCE SERVICE</span>
          <span className="hidden sm:inline">CLEARANCE: 00 · EYES ONLY</span>
          <span className="data-readout">{timeStr} ZULU</span>
        </div>
      </div>

      {/* ═══ COMMAND BAR ═══ */}
      <header className="border-b border-border bg-card sticky top-0 z-30 backdrop-blur supports-[backdrop-filter]:bg-card/85">
        <div className="mx-auto px-2 sm:px-4 py-2 flex flex-col gap-2 min-[480px]:flex-row min-[480px]:items-center min-[480px]:justify-between max-w-7xl">
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            <div className="h-8 w-8 sm:h-9 sm:w-9 shrink-0 grid place-items-center border border-primary/40 bg-primary/5">
              <Terminal className="h-4 w-4 sm:h-5 sm:w-5 text-primary text-glow" />
            </div>
            <div className="min-w-0 flex-1">
              <h1 className="text-[11px] min-[360px]:text-xs sm:text-sm md:text-base font-bold tracking-[0.12em] sm:tracking-[0.2em] text-primary text-glow leading-tight break-words">
                WHITE_ROOM://PROTOCOL
              </h1>
              <p className="text-[10px] sm:hidden text-muted-foreground tracking-wide mt-0.5 truncate">
                {dateStr} · {profile.pseudo}
              </p>
              <p className="hidden sm:block text-xs text-muted-foreground tracking-wider truncate data-readout">
                FIELD AGENT · {profile.pseudo} · STATUS: ACTIVE
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-0.5 sm:gap-1 shrink-0 w-full min-[480px]:w-auto">
            {[
              { icon: Trophy, label: `${unlockedAchievements}`, path: '/achievements' },
              { icon: Crown, label: 'RANK', path: '/leaderboard' },
              { icon: CalendarDays, label: 'CAL', path: '/calendar' },
              { icon: BarChart3, label: 'DATA', path: '/analytics' },
              { icon: User, label: 'SUBJ', path: '/profile' },
              { icon: MessageSquare, label: 'THEIA', action: () => setShowChat(!showChat) },
            ].map((btn, i) => (
              <button
                key={i}
                onClick={'action' in btn ? btn.action : () => navigate(btn.path!)}
                className="px-1.5 sm:px-2 py-1.5 text-[10px] sm:text-xs data-readout text-muted-foreground hover:text-primary hover:bg-accent transition-colors inline-flex items-center gap-0.5 sm:gap-1 border border-transparent hover:border-primary/40"
                title={btn.label}
                type="button"
              >
                <btn.icon className="h-3.5 w-3.5 shrink-0" />
                <span className="hidden min-[400px]:inline">{btn.label}</span>
              </button>
            ))}
          </div>
        </div>
      </header>


      <div className="mx-auto px-3 sm:px-4 py-3 max-w-7xl space-y-2">

        {/* ═══ COMMAND GRID: DOSSIER · MISSION BOARD · COMMS ═══ */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-2 items-start">

          {/* Subject Status */}
          <div className="lg:col-span-4 xl:col-span-3 terminal-panel lg:sticky lg:top-[92px]">
            <div className="panel-header">SUBJECT_DOSSIER</div>
            <div className="p-4 space-y-4">
              {/* Level */}
              <div className="text-center border-b border-border pb-4">
                <div className="text-xs text-muted-foreground tracking-widest mb-1">CLASSIFICATION</div>
                <div className="data-readout text-4xl font-bold text-primary text-glow">
                  LV.{profile.level}
                </div>
                <div className="mt-3">
                  <div className="flex justify-between mb-1">
                    <span className="text-xs text-muted-foreground">EXP</span>
                    <span className="data-readout text-xs text-primary">{profile.xp}/{profile.xpToNextLevel}</span>
                  </div>
                  <div className="h-2 bg-muted relative overflow-hidden border border-border">
                    <div
                      className="h-full bg-primary transition-all duration-1000"
                      style={{ width: `${xpPct}%`, boxShadow: '0 0 8px hsl(var(--terminal-glow) / 0.5)' }}
                    />
                  </div>
                  <div className="text-xs text-muted-foreground text-right mt-1">
                    {Math.round(xpPct)}%
                  </div>
                </div>
              </div>

              {/* Attributes */}
              <div>
                <div className="text-xs text-muted-foreground tracking-widest mb-2">ATTRIBUTES</div>
                <AttributeReadout
                  attributes={profile.visibleStats}
                />
              </div>
            </div>
          </div>

          {/* Daily Protocol */}
          <div className="lg:col-span-8 xl:col-span-6 terminal-panel">
            <div className="panel-header flex-wrap gap-y-1">
              <span>MISSION_BOARD</span>
              <span className="ml-auto text-muted-foreground text-xs tracking-normal normal-case">
                {dateStr}
              </span>
              <span className={`text-xs px-2 py-0.5 border ${
                questStatus === 'ready' 
                  ? 'text-primary border-primary/30' 
                  : questStatus === 'error' 
                    ? 'text-critical border-critical/30' 
                    : 'text-warning border-warning/30'
              }`}>
                {questStatus === 'ready' ? '■ ONLINE' : questStatus === 'error' ? '■ OFFLINE' : '■ SYNC'}
              </span>
            </div>
            <div className="p-4">
              {/* Gauges */}
              <div className="flex items-start justify-around mb-4 pb-4 border-b border-border flex-wrap gap-3">
                <ProtocolGauge completed={completedCount} total={quests.length} label="TOTAL" size={90} />
                {CATEGORIES.map(c => {
                  if (c.key === 'todos') {
                    return (
                      <ProtocolGauge
                        key={c.key}
                        completed={todoDone}
                        total={todoTotal}
                        label={c.tag}
                        size={70}
                      />
                    );
                  }
                  const cq = quests.filter(q => c.types.includes(q.type));
                  const units = countCategoryUnits(cq, c.key === 'physical' ? 'physical' : (c.types[0] as Quest['type']));
                  return (
                    <ProtocolGauge
                      key={c.key}
                      completed={units.done}
                      total={units.total}
                      label={c.tag}
                      size={70}
                    />
                  );
                })}
              </div>

              {/* ASCII Progress */}
              <div className="mb-4 data-readout text-sm text-primary overflow-x-auto">
                <span className="text-muted-foreground">PROGRESS [</span>
                {Array.from({ length: 20 }).map((_, i) => {
                  const filled = Math.round((completedCount / Math.max(quests.length, 1)) * 20);
                  return (
                    <span key={i} className={i < filled ? 'text-primary text-glow' : 'text-muted-foreground'}>
                      {i < filled ? '█' : '░'}
                    </span>
                  );
                })}
                <span className="text-muted-foreground">] {completedCount}/{quests.length}</span>
              </div>

              {/* Categories */}
              <div className="space-y-1">
                {CATEGORIES.map(c => {
                  const isToDos = c.key === 'todos';
                  const cq = quests.filter(q => c.types.includes(q.type));
                  const units = isToDos
                    ? { done: todoDone, total: todoTotal }
                    : countCategoryUnits(cq, c.key === 'physical' ? 'physical' : (c.types[0] as Quest['type']));
                  const done = units.done;
                  const isOpen = openCategory === c.key;
                  const Icon = c.icon;
                  const allDone = done >= units.total && units.total > 0;
                  return (
                    <div key={c.key} className="border border-border">
                      <button
                        onClick={() => setOpenCategory(isOpen ? null : c.key)}
                        className="w-full flex items-center gap-2 sm:gap-3 px-3 py-2.5 hover:bg-accent transition-colors text-left bg-card"
                      >
                        <span className="data-readout text-xs text-primary shrink-0">{isOpen ? '[-]' : '[+]'}</span>
                        <Icon className="h-4 w-4 text-primary shrink-0" />
                        <span className="text-sm font-medium text-foreground flex-1">{c.label}</span>
                        <span className="data-readout text-xs text-muted-foreground shrink-0">
                          [{done}/{units.total}]
                        </span>
                        {allDone && (
                          <span className="data-readout text-xs text-primary text-glow shrink-0 hidden sm:inline">COMPLETE</span>
                        )}
                      </button>
                      {isOpen && (
                        <div className="border-t border-border bg-background">
                          {isToDos ? (
                            <div className="px-3 py-3 space-y-3">
                              <div className="border border-border bg-card px-3 py-2 space-y-2">
                                <div className="text-xs text-muted-foreground data-readout">
                                  &gt; AI To-Do Parser (explicit)
                                </div>
                                <textarea
                                  value={todoAiInput}
                                  onChange={(e) => setTodoAiInput(e.target.value)}
                                  placeholder={`Example: "Tomorrow I have a meeting 7pm and I need to go for groceries"`}
                                  className="w-full min-h-[72px] bg-background border border-border px-2 py-2 text-sm text-foreground outline-none focus:border-primary/40"
                                />
                                <div className="flex items-center gap-2">
                                  <button
                                    className="px-2 py-1 text-xs data-readout text-primary border border-primary/30 hover:bg-accent transition-colors disabled:opacity-50"
                                    type="button"
                                    disabled={todoAiBusy || !todoAiInput.trim()}
                                    onClick={async () => {
                                      const text = todoAiInput.trim();
                                      if (!text) return;
                                      setTodoAiBusy(true);
                                      setTodoAiHint(null);
                                      try {
                                        const r = await parseUserTodosFromInput(text);
                                        if (r.created.length > 0) {
                                          setTodoAiInput('');
                                          setTodoAiHint(r.hint ?? `Added ${r.created.length} To-Do${r.created.length === 1 ? '' : 's'}.`);
                                        } else {
                                          setTodoAiHint(r.hint ?? 'No To-Do items detected.');
                                        }
                                      } catch (e) {
                                        setTodoAiHint(e instanceof Error ? e.message : 'Failed to parse To-Do input.');
                                      } finally {
                                        setTodoAiBusy(false);
                                      }
                                    }}
                                  >
                                    {todoAiBusy ? '[PARSING...]' : '[PARSE]'}
                                  </button>
                                  <button
                                    className="px-2 py-1 text-xs data-readout text-muted-foreground border border-border hover:bg-accent transition-colors disabled:opacity-50"
                                    type="button"
                                    disabled={todoAiBusy && !todoAiInput.trim()}
                                    onClick={() => {
                                      if (todoAiBusy) return;
                                      setTodoAiInput('');
                                      setTodoAiHint(null);
                                    }}
                                  >
                                    [CLEAR]
                                  </button>
                                  {todoAiHint && (
                                    <span className="text-xs text-muted-foreground data-readout">
                                      {todoAiHint}
                                    </span>
                                  )}
                                </div>
                              </div>

                              {suggestedToDos.length > 0 && (
                                <div className="space-y-2">
                                  <div className="text-xs text-muted-foreground data-readout">
                                    &gt; Suggested by THEIA
                                  </div>
                                  {suggestedToDos.map((t) => (
                                    <div key={t.id} className="border border-border bg-card px-3 py-2">
                                      <div className="flex items-center justify-between gap-2">
                                        <div className="min-w-0">
                                          <div className="text-sm text-foreground truncate">{t.title}</div>
                                          <div className="text-xs text-muted-foreground data-readout">+{t.xp} XP</div>
                                        </div>
                                        <div className="flex items-center gap-1 shrink-0">
                                          <button
                                            className="px-2 py-1 text-xs data-readout text-primary border border-primary/30 hover:bg-accent transition-colors"
                                            onClick={() => acceptSuggestedToDo(t.id)}
                                            type="button"
                                          >
                                            [ADD]
                                          </button>
                                          <button
                                            className="px-2 py-1 text-xs data-readout text-muted-foreground border border-border hover:bg-accent transition-colors"
                                            onClick={() => ignoreSuggestedToDo(t.id)}
                                            type="button"
                                          >
                                            [IGNORE]
                                          </button>
                                        </div>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}

                              {todaysToDos.length === 0 && suggestedToDos.length === 0 ? (
                                <div className="text-xs text-muted-foreground data-readout">
                                  &gt; No To-Do&apos;s for today.
                                </div>
                              ) : (
                                <div className="space-y-2">
                                  <div className="text-xs text-muted-foreground data-readout">&gt; Today</div>
                                  {todaysToDos.map((t) => (
                                    <div key={t.id} className="border border-border bg-card px-3 py-2">
                                      <div className="flex items-center justify-between gap-2">
                                        <div className="min-w-0">
                                          <div className={`text-sm truncate ${t.status === 'completed' ? 'text-muted-foreground line-through' : 'text-foreground'}`}>
                                            {t.title}
                                          </div>
                                          <div className="text-xs text-muted-foreground data-readout">+{t.xp} XP</div>
                                        </div>
                                        <div className="shrink-0">
                                          {t.status === 'completed' ? (
                                            <span className="data-readout text-xs text-primary text-glow">[✓]</span>
                                          ) : (
                                            <button
                                              className="px-2 py-1 text-xs data-readout text-primary border border-primary/30 hover:bg-accent transition-colors"
                                              onClick={() => completeToDo(t.id)}
                                              type="button"
                                            >
                                              [COMPLETE]
                                            </button>
                                          )}
                                        </div>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}

                              {(suggestedTomorrowsToDos.length > 0 || tomorrowsToDos.length > 0) && (
                                <div className="space-y-2 pt-1">
                                  <div className="text-xs text-muted-foreground data-readout">&gt; Tomorrow</div>
                                  {suggestedTomorrowsToDos.map((t) => (
                                    <div key={t.id} className="border border-border bg-card px-3 py-2">
                                      <div className="flex items-center justify-between gap-2">
                                        <div className="min-w-0">
                                          <div className="text-sm text-foreground truncate">{t.title}</div>
                                          <div className="text-xs text-muted-foreground data-readout">+{t.xp} XP</div>
                                        </div>
                                        <div className="flex items-center gap-1 shrink-0">
                                          <button
                                            className="px-2 py-1 text-xs data-readout text-primary border border-primary/30 hover:bg-accent transition-colors"
                                            onClick={() => acceptSuggestedToDo(t.id)}
                                            type="button"
                                          >
                                            [ADD]
                                          </button>
                                          <button
                                            className="px-2 py-1 text-xs data-readout text-muted-foreground border border-border hover:bg-accent transition-colors"
                                            onClick={() => ignoreSuggestedToDo(t.id)}
                                            type="button"
                                          >
                                            [IGNORE]
                                          </button>
                                        </div>
                                      </div>
                                    </div>
                                  ))}
                                  {tomorrowsToDos.map((t) => (
                                    <div key={t.id} className="border border-border bg-card px-3 py-2">
                                      <div className="flex items-center justify-between gap-2">
                                        <div className="min-w-0">
                                          <div className={`text-sm truncate ${t.status === 'completed' ? 'text-muted-foreground line-through' : 'text-foreground'}`}>
                                            {t.title}
                                          </div>
                                          <div className="text-xs text-muted-foreground data-readout">+{t.xp} XP</div>
                                        </div>
                                        <div className="shrink-0">
                                          {t.status === 'completed' ? (
                                            <span className="data-readout text-xs text-primary text-glow">[✓]</span>
                                          ) : (
                                            <button
                                              className="px-2 py-1 text-xs data-readout text-primary border border-primary/30 hover:bg-accent transition-colors"
                                              onClick={() => completeToDo(t.id)}
                                              type="button"
                                            >
                                              [COMPLETE]
                                            </button>
                                          )}
                                        </div>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          ) : cq.length === 0 ? (
                            <div className="px-3 py-3 text-xs text-muted-foreground data-readout">
                              &gt; No tasks assigned.
                            </div>
                          ) : c.key === 'mental' ? (
                            <>
                              {cq
                                .filter((quest) => !isStudySessionQuest(quest))
                                .map((quest) => (
                                  <QuestCard key={quest.id} quest={quest} onStart={(q) => navigate(`/quest/${q.id}`)} />
                                ))}
                              {mentalVisibleQuest && (
                                <div
                                  className={`transition-all duration-200 ${
                                    mentalAnim === 'exit'
                                      ? 'opacity-0 translate-x-4'
                                      : mentalAnim === 'enter'
                                        ? 'opacity-0 -translate-x-2 animate-in fade-in slide-in-from-left-2 duration-200'
                                        : 'opacity-100 translate-x-0'
                                  }`}
                                >
                                  <QuestCard
                                    key={mentalVisibleQuest.id}
                                    quest={mentalVisibleQuest}
                                    onStart={(q) => navigate(`/quest/${q.id}`)}
                                  />
                                </div>
                              )}
                              {cq.length === 0 && (
                                <div className="px-3 py-3 text-xs text-muted-foreground data-readout">
                                  &gt; No mental tasks assigned.
                                </div>
                              )}
                            </>
                          ) : (
                            cq.map((quest) => (
                              <QuestCard key={quest.id} quest={quest} onStart={(q) => navigate(`/quest/${q.id}`)} />
                            ))
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* THEIA Comms / System Log */}
          <div className="lg:col-span-12 xl:col-span-3 terminal-panel">
            <div className="panel-header">
              <span>{showChat ? 'THEIA_UPLINK' : 'COMMS_LOG'}</span>
              <button
                onClick={() => setShowChat(!showChat)}
                className="ml-auto text-xs text-muted-foreground hover:text-primary transition-colors px-2 py-0.5 border border-border hover:border-primary/30"
              >
                {showChat ? '[LOG]' : '[THEIA]'}
              </button>
            </div>
            <div className="p-4">
              {showChat ? (
                <AIChat
                  title="THEIA"
                  placeholder="> Enter command..."
                />
              ) : (
                <div className="space-y-2 data-readout text-xs sm:text-sm">
                  <div className="text-foreground">
                    <span className="text-primary">[{timeStr}]</span> System initialized. All modules operational.
                  </div>
                  <div className="text-foreground">
                    <span className="text-primary">[{timeStr}]</span> Agent <span className="text-primary text-glow">{profile.pseudo}</span> on station. Level {profile.level}.
                  </div>
                  <div className="text-foreground">
                    <span className="text-primary">[{timeStr}]</span> Daily protocol: <span className="text-primary">{quests.length}</span> objectives assigned.
                  </div>
                  {completedCount > 0 && (
                    <div className="text-foreground">
                      <span className="text-primary">[{timeStr}]</span> Progress: <span className="text-primary text-glow">{completedCount}/{quests.length}</span> completed.
                    </div>
                  )}
                  {completedCount === quests.length && quests.length > 0 && (
                    <div className="text-primary text-glow mt-3 text-sm">
                      [SYS] ████ ALL OBJECTIVES COMPLETE ████
                    </div>
                  )}
                  {completedCount < quests.length && quests.length > 0 && (
                    <div className="text-foreground mt-3">
                      <span className="text-primary">&gt;</span> {quests.length - completedCount} objectives remaining.
                      <span className="cursor-blink"></span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ═══ OPERATIONS · TRAINING MODULES ═══ */}
        <div className="terminal-panel">
          <div className="panel-header">OPERATIONS · TRAINING_MODULES</div>
          <div className="p-2 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
            {LABS.map((lab, idx) => {
              const Icon = lab.icon;
              const isLocked = !!lab.unlockLevel && profile.level < lab.unlockLevel;
              return (
                <button
                  key={lab.path}
                  onClick={() => {
                    if (!isLocked) navigate(lab.path);
                  }}
                  disabled={isLocked}
                  className={`relative flex flex-col gap-2 p-3 text-left group border transition-colors ${
                    isLocked
                      ? 'opacity-55 cursor-not-allowed bg-muted/20 border-border'
                      : 'bg-card hover:bg-accent border-border hover:border-primary/40'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="data-readout text-[10px] text-muted-foreground tracking-widest">UNIT-{String(idx).padStart(2, '0')}</span>
                    {isLocked ? (
                      <span className="data-readout text-[10px] text-warning border border-warning/30 px-1.5 py-0.5">
                        LV.{lab.unlockLevel}
                      </span>
                    ) : (
                      <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                    )}
                  </div>
                  <div className="h-9 w-9 grid place-items-center border border-border group-hover:border-primary/40 transition-colors">
                    {isLocked ? (
                      <Lock className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <Icon className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm text-foreground group-hover:text-primary transition-colors truncate">{lab.label}</div>
                    <div className="text-xs text-muted-foreground line-clamp-2">
                      {isLocked ? `Unlocks at Level ${lab.unlockLevel}` : lab.desc}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>


        {/* Dev Tools */}
        <div className="terminal-panel">
          <button
            onClick={() => navigate('/chatgpt-test')}
            className="w-full flex items-center gap-2 px-3 py-2 hover:bg-accent transition-colors text-left"
          >
            <TestTube className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-xs data-readout text-muted-foreground">DEV://chatgpt-integration-test</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
