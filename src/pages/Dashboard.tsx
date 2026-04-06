import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ProtocolGauge } from '@/components/ProtocolGauge';
import { AttributeReadout } from '@/components/AttributeReadout';
import { QuestCard } from '@/components/QuestCard';
import AIChat from '@/components/AIChat';
import { getUserProfile, getDailyQuests, QUESTS_UPDATED_EVENT } from '@/lib/storage';
import { UserProfile, Quest } from '@/lib/types';
import {
  Brain, Dumbbell, BookOpen, Users, Crown, Target,
  Trophy, BarChart3, User, MessageSquare, TestTube,
  ChevronRight, Zap, Terminal, Lock, CalendarDays,
} from 'lucide-react';
import { getAchievementStats } from '@/lib/achievements';

const CATEGORIES = [
  { key: 'mental', label: 'MENTAL', types: ['mental'], icon: Brain, tag: 'MNT' },
  { key: 'physical', label: 'PHYSICAL', types: ['physical'], icon: Dumbbell, tag: 'PHY' },
  { key: 'spiritual', label: 'SPIRITUAL', types: ['social'], icon: BookOpen, tag: 'SPR' },
];

const LABS = [
  { label: 'Social Lab', icon: Users, path: '/social-lab', desc: 'Interpersonal simulation', unlockLevel: 10 },
  { label: 'Mental Lab', icon: Brain, path: '/mental-lab', desc: 'Cognitive protocols', unlockLevel: 10 },
  { label: 'Physical Lab', icon: Dumbbell, path: '/physical-lab', desc: 'Body conditioning', unlockLevel: 10 },
  { label: 'Knowledge Lab', icon: BookOpen, path: '/knowledge-lab', desc: 'Research & study', unlockLevel: 15 },
  { label: 'Chess Lab', icon: Crown, path: '/chess-lab', desc: 'Strategic training', unlockLevel: 15 },
  { label: 'Skill Forge', icon: Target, path: '/skill-forge', desc: 'Custom skill plans', unlockLevel: 20 },
  { label: 'Research Lab', icon: TestTube, path: '/research-lab', desc: 'Bite-sized dungeons', unlockLevel: 10 },
];

const isStudySessionQuest = (quest: Quest): boolean =>
  /^mental-study\d+-/.test(quest.id) || /^Study Session \d+/i.test(quest.title);

const getActiveQuest = (items: Quest[]): Quest | null => {
  if (items.length === 0) return null;
  const next = items.find((q) => !q.completed);
  return next ?? items[items.length - 1];
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

  if (!profile) return null;

  const completedCount = quests.filter(q => q.completed).length;
  const achievementStats = getAchievementStats();
  const unlockedAchievements = Object.values(achievementStats.achievements).filter(a => a.unlocked).length;
  const xpPct = (profile.xp / profile.xpToNextLevel) * 100;
  const dateStr = new Date().toISOString().split('T')[0];
  const timeStr = new Date().toLocaleTimeString('en-US', { hour12: false });

  return (
    <div className="min-h-screen bg-background">
      {/* ═══ HEADER ═══ */}
      <header className="border-b border-border bg-card">
        <div className="mx-auto px-2 sm:px-4 py-2 flex flex-col gap-2 min-[480px]:flex-row min-[480px]:items-center min-[480px]:justify-between max-w-7xl">
          <div className="flex items-start sm:items-center gap-2 min-w-0 flex-1">
            <Terminal className="h-5 w-5 text-primary text-glow shrink-0 mt-0.5 sm:mt-0" />
            <div className="min-w-0 flex-1">
              <h1 className="text-[11px] min-[360px]:text-xs sm:text-sm md:text-base font-bold tracking-[0.12em] sm:tracking-[0.2em] text-primary text-glow leading-tight break-words">
                WHITE_ROOM://PROTOCOL
              </h1>
              {/* Compact line on very narrow screens */}
              <p className="text-[10px] sm:hidden text-muted-foreground tracking-wide mt-0.5 truncate">
                {dateStr} · {profile.pseudo}
              </p>
              <p className="hidden sm:block text-xs text-muted-foreground tracking-wider truncate">
                {dateStr} | SUBJ:{profile.pseudo} | ACTIVE
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-0.5 sm:gap-1 shrink-0 w-full min-[480px]:w-auto">
            {[
              { icon: Trophy, label: `${unlockedAchievements}`, path: '/achievements' },
              { icon: CalendarDays, label: 'CAL', path: '/calendar' },
              { icon: BarChart3, label: 'DATA', path: '/analytics' },
              { icon: User, label: 'SUBJ', path: '/profile' },
              { icon: MessageSquare, label: 'AI', action: () => setShowChat(!showChat) },
            ].map((btn, i) => (
              <button
                key={i}
                onClick={'action' in btn ? btn.action : () => navigate(btn.path!)}
                className="px-1.5 sm:px-2 py-1.5 text-[10px] sm:text-xs data-readout text-muted-foreground hover:text-primary hover:bg-accent transition-colors inline-flex items-center gap-0.5 sm:gap-1 border border-transparent hover:border-border"
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

        {/* ═══ ROW 1: STATUS + PROTOCOL ═══ */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-2">

          {/* Subject Status */}
          <div className="lg:col-span-4 xl:col-span-3 terminal-panel">
            <div className="panel-header">SUBJECT_STATUS</div>
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
          <div className="lg:col-span-8 xl:col-span-9 terminal-panel">
            <div className="panel-header flex-wrap gap-y-1">
              <span>DAILY_PROTOCOL</span>
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
                  const cq = quests.filter(q => c.types.includes(q.type));
                  return (
                    <ProtocolGauge
                      key={c.key}
                      completed={cq.filter(q => q.completed).length}
                      total={cq.length}
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
                  const cq = quests.filter(q => c.types.includes(q.type));
                  const done = cq.filter(q => q.completed).length;
                  const isOpen = openCategory === c.key;
                  const Icon = c.icon;
                  const allDone = done >= cq.length && cq.length > 0;
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
                          [{done}/{cq.length}]
                        </span>
                        {allDone && (
                          <span className="data-readout text-xs text-primary text-glow shrink-0 hidden sm:inline">COMPLETE</span>
                        )}
                      </button>
                      {isOpen && (
                        <div className="border-t border-border bg-background">
                          {cq.length === 0 ? (
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
        </div>

        {/* ═══ ROW 2: LABS + SYSTEM LOG ═══ */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-2">
          
          {/* Training Modules */}
          <div className="lg:col-span-5 terminal-panel">
            <div className="panel-header">TRAINING_MODULES</div>
            <div className="p-1">
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
                    className={`w-full flex items-center gap-3 px-3 py-2.5 transition-colors text-left group border-b border-border last:border-b-0 ${
                      isLocked
                        ? 'opacity-55 cursor-not-allowed bg-muted/20'
                        : 'hover:bg-accent'
                    }`}
                  >
                    <span className="data-readout text-xs text-muted-foreground w-5 shrink-0">{String(idx).padStart(2, '0')}</span>
                    {isLocked ? (
                      <Lock className="h-4 w-4 text-muted-foreground shrink-0" />
                    ) : (
                      <Icon className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="text-sm text-foreground group-hover:text-primary transition-colors">{lab.label}</div>
                      <div className="text-xs text-muted-foreground hidden sm:block">
                        {isLocked ? `Unlocks at Level ${lab.unlockLevel}` : lab.desc}
                      </div>
                    </div>
                    {isLocked ? (
                      <span className="data-readout text-[10px] text-warning border border-warning/30 px-1.5 py-0.5 shrink-0">
                        LV.{lab.unlockLevel}
                      </span>
                    ) : (
                      <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* System Log / AI */}
          <div className="lg:col-span-7 terminal-panel">
            <div className="panel-header">
              <span>{showChat ? 'INSTRUCTOR_AI' : 'SYSTEM_LOG'}</span>
              <button
                onClick={() => setShowChat(!showChat)}
                className="ml-auto text-xs text-muted-foreground hover:text-primary transition-colors px-2 py-0.5 border border-border hover:border-primary/30"
              >
                {showChat ? '[LOG]' : '[AI]'}
              </button>
            </div>
            <div className="p-4">
              {showChat ? (
                <AIChat
                  title="The Instructor"
                  placeholder="> Enter command..."
                />
              ) : (
                <div className="space-y-2 data-readout text-xs sm:text-sm">
                  <div className="text-foreground">
                    <span className="text-primary">[{timeStr}]</span> System initialized. All modules operational.
                  </div>
                  <div className="text-foreground">
                    <span className="text-primary">[{timeStr}]</span> Subject <span className="text-primary text-glow">{profile.pseudo}</span> logged in. Level {profile.level}.
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
                      [SYS] ████████████████ ALL OBJECTIVES COMPLETE ████████████████
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
