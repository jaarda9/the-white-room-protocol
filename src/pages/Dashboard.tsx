import { useState, useEffect } from 'react';
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
  ChevronRight, Zap, Terminal, Activity,
} from 'lucide-react';
import { getAchievementStats } from '@/lib/achievements';

const CATEGORIES = [
  { key: 'mental', label: 'MENTAL', types: ['mental'], icon: Brain, tag: 'MNT' },
  { key: 'physical', label: 'PHYSICAL', types: ['physical'], icon: Dumbbell, tag: 'PHY' },
  { key: 'spiritual', label: 'SPIRITUAL', types: ['social'], icon: BookOpen, tag: 'SPR' },
];

const LABS = [
  { label: 'Social Lab', icon: Users, path: '/social-lab', desc: 'Interpersonal simulation' },
  { label: 'Mental Lab', icon: Brain, path: '/mental-lab', desc: 'Cognitive protocols' },
  { label: 'Physical Lab', icon: Dumbbell, path: '/physical-lab', desc: 'Body conditioning' },
  { label: 'Knowledge Lab', icon: BookOpen, path: '/knowledge-lab', desc: 'Research & study' },
  { label: 'Chess Lab', icon: Crown, path: '/chess-lab', desc: 'Strategic training' },
  { label: 'Skill Forge', icon: Target, path: '/skill-forge', desc: 'Custom skill plans' },
  { label: 'Challenges', icon: Trophy, path: '/challenges', desc: 'Active objectives' },
];

const Dashboard = () => {
  const navigate = useNavigate();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [quests, setQuests] = useState<Quest[]>([]);
  const [openCategory, setOpenCategory] = useState<string | null>(null);
  const [questStatus, setQuestStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [showChat, setShowChat] = useState(false);

  useEffect(() => {
    setProfile(getUserProfile());
  }, []);

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
  const date = new Date();
  const dateStr = date.toISOString().split('T')[0];
  const timeStr = date.toLocaleTimeString('en-US', { hour12: false });

  return (
    <div className="min-h-screen bg-background">
      {/* ═══ TERMINAL HEADER ═══ */}
      <header className="border-b border-border bg-card">
        <div className="container mx-auto px-3 py-1.5 flex items-center justify-between max-w-7xl">
          <div className="flex items-center gap-2">
            <Terminal className="h-4 w-4 text-primary text-glow" />
            <div>
              <h1 className="text-xs font-bold tracking-[0.25em] text-primary text-glow">
                WHITE_ROOM://PROTOCOL
              </h1>
              <p className="text-[0.55rem] text-muted-foreground tracking-wider">
                SYS.{dateStr} | SUBJ:{profile.pseudo} | SESSION.ACTIVE
              </p>
            </div>
          </div>
          <div className="flex gap-0.5">
            {[
              { icon: Trophy, label: `ACH:${unlockedAchievements}`, path: '/achievements' },
              { icon: BarChart3, label: 'DATA', path: '/analytics' },
              { icon: User, label: 'SUBJ', path: '/profile' },
              { icon: MessageSquare, label: 'AI', action: () => setShowChat(!showChat) },
            ].map((btn, i) => (
              <button
                key={i}
                onClick={'action' in btn ? btn.action : () => navigate(btn.path!)}
                className="px-2 py-1 text-[0.6rem] data-readout text-muted-foreground hover:text-primary hover:bg-accent transition-colors flex items-center gap-1 border border-transparent hover:border-border"
              >
                <btn.icon className="h-3 w-3" />
                {btn.label}
              </button>
            ))}
          </div>
        </div>
      </header>

      <div className="container mx-auto px-3 py-3 max-w-7xl space-y-[1px]">

        {/* ═══ ROW 1: STATUS + PROTOCOL MONITOR ═══ */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-[1px]">

          {/* ── Subject Status ── */}
          <div className="lg:col-span-3 terminal-panel">
            <div className="panel-header">SUBJECT_STATUS</div>
            <div className="p-3 space-y-3">
              {/* Level & XP */}
              <div className="text-center border-b border-border pb-3">
                <div className="text-[0.55rem] text-muted-foreground tracking-widest mb-1">CLASSIFICATION</div>
                <div className="data-readout text-3xl font-bold text-primary text-glow">
                  LV.{profile.level}
                </div>
                <div className="mt-2">
                  <div className="flex justify-between mb-0.5">
                    <span className="text-[0.5rem] text-muted-foreground">EXP</span>
                    <span className="data-readout text-[0.55rem] text-primary">{profile.xp}/{profile.xpToNextLevel}</span>
                  </div>
                  <div className="h-1 bg-muted relative overflow-hidden border border-border">
                    <div
                      className="h-full bg-primary transition-all duration-1000"
                      style={{ width: `${xpPct}%`, boxShadow: '0 0 6px hsl(var(--terminal-glow) / 0.5)' }}
                    />
                  </div>
                  <div className="text-[0.5rem] text-muted-foreground text-right mt-0.5">
                    {Math.round(xpPct)}%
                  </div>
                </div>
              </div>

              {/* Attributes */}
              <div>
                <div className="text-[0.55rem] text-muted-foreground tracking-widest mb-2">ATTRIBUTES</div>
                <AttributeReadout
                  attributes={profile.visibleStats}
                  accumulated={profile.accumulatedPoints}
                />
              </div>
            </div>
          </div>

          {/* ── Daily Protocol Monitor ── */}
          <div className="lg:col-span-9 terminal-panel">
            <div className="panel-header">
              <span>DAILY_PROTOCOL</span>
              <span className="ml-auto text-muted-foreground text-[0.55rem] tracking-normal normal-case">
                {dateStr}
              </span>
              <span className={`text-[0.55rem] px-1.5 py-0.5 border ${
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
              {/* ── Gauges Row ── */}
              <div className="flex items-start justify-around mb-4 pb-4 border-b border-border">
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

              {/* ── ASCII Progress Bar ── */}
              <div className="mb-4 data-readout text-[0.6rem] text-primary">
                <span className="text-muted-foreground">PROGRESS: [</span>
                {Array.from({ length: 20 }).map((_, i) => (
                  <span key={i} className={i < Math.round((completedCount / Math.max(quests.length, 1)) * 20) ? 'text-primary text-glow' : 'text-muted-foreground'}>
                    {i < Math.round((completedCount / Math.max(quests.length, 1)) * 20) ? '█' : '░'}
                  </span>
                ))}
                <span className="text-muted-foreground">] {completedCount}/{quests.length}</span>
              </div>

              {/* ── Category Sections ── */}
              <div className="space-y-[1px]">
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
                        className="w-full flex items-center gap-2 px-3 py-2 hover:bg-accent transition-colors text-left bg-card"
                      >
                        <span className="data-readout text-[0.55rem] text-primary">{isOpen ? '[-]' : '[+]'}</span>
                        <Icon className="h-3 w-3 text-primary" />
                        <span className="text-xs font-medium text-foreground flex-1">{c.label}</span>
                        <span className="data-readout text-[0.6rem] text-muted-foreground">
                          [{done}/{cq.length}]
                        </span>
                        {allDone && (
                          <span className="data-readout text-[0.55rem] text-primary text-glow">COMPLETE</span>
                        )}
                      </button>
                      {isOpen && (
                        <div className="border-t border-border bg-background">
                          {cq.length === 0 ? (
                            <div className="px-3 py-2 text-[0.6rem] text-muted-foreground data-readout">
                              &gt; No tasks assigned for this category.
                            </div>
                          ) : (
                            cq.map(quest => (
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
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-[1px]">
          
          {/* ── Training Modules ── */}
          <div className="lg:col-span-5 terminal-panel">
            <div className="panel-header">TRAINING_MODULES</div>
            <div className="p-1">
              {LABS.map((lab, idx) => {
                const Icon = lab.icon;
                return (
                  <button
                    key={lab.path}
                    onClick={() => navigate(lab.path)}
                    className="w-full flex items-center gap-3 px-3 py-2 hover:bg-accent transition-colors text-left group border-b border-border last:border-b-0"
                  >
                    <span className="data-readout text-[0.55rem] text-muted-foreground w-4">{String(idx).padStart(2, '0')}</span>
                    <Icon className="h-3.5 w-3.5 text-muted-foreground group-hover:text-primary transition-colors" />
                    <div className="flex-1">
                      <div className="text-xs text-foreground group-hover:text-primary transition-colors">{lab.label}</div>
                      <div className="text-[0.55rem] text-muted-foreground">{lab.desc}</div>
                    </div>
                    <ChevronRight className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                  </button>
                );
              })}
            </div>
          </div>

          {/* ── System Log / AI Chat ── */}
          <div className="lg:col-span-7 terminal-panel">
            <div className="panel-header">
              <span>{showChat ? 'ARCHITECT_AI' : 'SYSTEM_LOG'}</span>
              <button
                onClick={() => setShowChat(!showChat)}
                className="ml-auto text-[0.55rem] text-muted-foreground hover:text-primary transition-colors px-1 border border-border hover:border-primary/30"
              >
                {showChat ? '[LOG]' : '[AI]'}
              </button>
            </div>
            <div className="p-3">
              {showChat ? (
                <AIChat
                  title="The Architect"
                  placeholder="> Enter command..."
                />
              ) : (
                <div className="space-y-1 data-readout text-[0.6rem]">
                  <div className="text-muted-foreground">
                    <span className="text-primary">[{timeStr}]</span> System initialized. All modules operational.
                  </div>
                  <div className="text-muted-foreground">
                    <span className="text-primary">[{timeStr}]</span> Subject <span className="text-foreground">{profile.pseudo}</span> logged in. Level {profile.level}.
                  </div>
                  <div className="text-muted-foreground">
                    <span className="text-primary">[{timeStr}]</span> Daily protocol loaded: {quests.length} objectives assigned.
                  </div>
                  {completedCount > 0 && (
                    <div className="text-muted-foreground">
                      <span className="text-primary">[{timeStr}]</span> Progress: <span className="text-foreground">{completedCount}/{quests.length}</span> objectives completed.
                    </div>
                  )}
                  {completedCount === quests.length && quests.length > 0 && (
                    <div className="text-primary text-glow mt-2">
                      [SYS] ██████████████████ ALL OBJECTIVES COMPLETE ██████████████████
                    </div>
                  )}
                  {completedCount < quests.length && quests.length > 0 && (
                    <div className="text-muted-foreground mt-2">
                      <span className="text-primary">&gt;</span> {quests.length - completedCount} objectives remaining. Continue protocol execution.
                      <span className="cursor-blink"></span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── Dev Tools ── */}
        <div className="terminal-panel">
          <button
            onClick={() => navigate('/chatgpt-test')}
            className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-accent transition-colors text-left"
          >
            <TestTube className="h-3 w-3 text-muted-foreground" />
            <span className="text-[0.55rem] data-readout text-muted-foreground">DEV://chatgpt-integration-test</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
