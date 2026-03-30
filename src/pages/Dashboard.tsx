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
  ChevronRight, Activity, Shield, Zap,
} from 'lucide-react';
import { getAchievementStats } from '@/lib/achievements';

const CATEGORIES = [
  { key: 'mental', label: 'Mental', types: ['mental'], icon: Brain, cssVar: '--info' },
  { key: 'physical', label: 'Physical', types: ['physical'], icon: Dumbbell, cssVar: '--critical' },
  { key: 'spiritual', label: 'Spiritual', types: ['social'], icon: BookOpen, cssVar: '--warning' },
];

const LABS = [
  { label: 'Social', icon: Users, path: '/social-lab' },
  { label: 'Mental', icon: Brain, path: '/mental-lab' },
  { label: 'Physical', icon: Dumbbell, path: '/physical-lab' },
  { label: 'Knowledge', icon: BookOpen, path: '/knowledge-lab' },
  { label: 'Chess', icon: Crown, path: '/chess-lab' },
  { label: 'Skill Forge', icon: Target, path: '/skill-forge' },
];

const Dashboard = () => {
  const navigate = useNavigate();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [quests, setQuests] = useState<Quest[]>([]);
  const [openCategory, setOpenCategory] = useState<string | null>(null);
  const [questStatus, setQuestStatus] = useState<'loading' | 'ready' | 'error'>('loading');

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

  return (
    <div className="min-h-screen bg-background">
      {/* Terminal Header */}
      <header className="border-b border-border bg-card">
        <div className="container mx-auto px-3 py-2 flex items-center justify-between max-w-7xl">
          <div className="flex items-center gap-3">
            <Shield className="h-4 w-4 text-primary text-glow" />
            <div>
              <h1 className="text-sm font-bold tracking-[0.2em] text-primary text-glow">
                WHITE ROOM PROTOCOL
              </h1>
              <p className="text-[0.6rem] text-muted-foreground tracking-widest">
                RESEARCH TERMINAL v2.0 — SUBJECT: {profile.pseudo}
              </p>
            </div>
          </div>
          <div className="flex gap-1">
            {[
              { icon: Trophy, label: `${unlockedAchievements}`, path: '/achievements' },
              { icon: BarChart3, label: 'DATA', path: '/analytics' },
              { icon: User, label: 'SUBJ', path: '/profile' },
            ].map(btn => (
              <button
                key={btn.path}
                onClick={() => navigate(btn.path)}
                className="px-2 py-1 text-[0.6rem] data-readout text-muted-foreground hover:text-primary hover:bg-accent/50 transition-colors flex items-center gap-1"
              >
                <btn.icon className="h-3 w-3" />
                {btn.label}
              </button>
            ))}
          </div>
        </div>
      </header>

      <div className="container mx-auto px-3 py-4 max-w-7xl">
        {/* Top Grid: Subject Status + Protocol Gauges */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-[1px] bg-border mb-[1px]">
          
          {/* Subject Status Panel */}
          <div className="md:col-span-4 terminal-panel">
            <div className="panel-header">Subject Status</div>
            <div className="p-3 space-y-3">
              <div className="flex items-baseline justify-between">
                <span className="text-[0.6rem] text-muted-foreground uppercase tracking-wider">Classification Level</span>
                <span className="data-readout text-2xl font-bold text-primary text-glow">{profile.level}</span>
              </div>
              <div>
                <div className="flex justify-between mb-1">
                  <span className="text-[0.55rem] text-muted-foreground">XP PROGRESS</span>
                  <span className="data-readout text-[0.6rem] text-muted-foreground">{profile.xp}/{profile.xpToNextLevel}</span>
                </div>
                <div className="h-1 bg-secondary relative overflow-hidden">
                  <div
                    className="h-full bg-primary transition-all duration-700"
                    style={{ width: `${xpPct}%`, boxShadow: '0 0 8px hsl(var(--terminal-glow) / 0.4)' }}
                  />
                </div>
              </div>
              <AttributeReadout
                attributes={profile.visibleStats}
                accumulated={profile.accumulatedPoints}
              />
            </div>
          </div>

          {/* Protocol Status Panel */}
          <div className="md:col-span-8 terminal-panel">
            <div className="panel-header">
              <span>Daily Protocol</span>
              <span className="ml-auto text-muted-foreground text-[0.55rem] tracking-normal normal-case">
                {new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
              </span>
              <span className={`text-[0.55rem] px-1 py-0.5 ${
                questStatus === 'ready' ? 'text-success' : questStatus === 'error' ? 'text-critical' : 'text-warning'
              }`}>
                {questStatus === 'ready' ? '● ONLINE' : questStatus === 'error' ? '● OFFLINE' : '● SYNC'}
              </span>
            </div>
            <div className="p-4">
              {/* Gauges Row */}
              <div className="flex items-center justify-around mb-4">
                <ProtocolGauge completed={completedCount} total={quests.length} label="Total" size={72} />
                {CATEGORIES.map(c => {
                  const cq = quests.filter(q => c.types.includes(q.type));
                  return (
                    <ProtocolGauge
                      key={c.key}
                      completed={cq.filter(q => q.completed).length}
                      total={cq.length}
                      label={c.label}
                      size={60}
                    />
                  );
                })}
              </div>

              {/* Expandable Categories */}
              <div className="space-y-[1px] bg-border">
                {CATEGORIES.map(c => {
                  const cq = quests.filter(q => c.types.includes(q.type));
                  const done = cq.filter(q => q.completed).length;
                  const isOpen = openCategory === c.key;
                  const Icon = c.icon;
                  return (
                    <div key={c.key} className="bg-card">
                      <button
                        onClick={() => setOpenCategory(isOpen ? null : c.key)}
                        className="w-full flex items-center gap-2 px-3 py-2 hover:bg-accent/30 transition-colors text-left"
                      >
                        <Icon className="h-3 w-3" style={{ color: `hsl(var(${c.cssVar}))` }} />
                        <span className="text-xs font-medium flex-1">{c.label}</span>
                        <span className="data-readout text-[0.6rem] text-muted-foreground">{done}/{cq.length}</span>
                        {done >= cq.length && cq.length > 0 ? (
                          <Zap className="h-3 w-3 text-success" />
                        ) : (
                          <ChevronRight className={`h-3 w-3 text-muted-foreground transition-transform ${isOpen ? 'rotate-90' : ''}`} />
                        )}
                      </button>
                      {isOpen && (
                        <div className="px-3 pb-2 space-y-1 border-t border-border">
                          {cq.map(quest => (
                            <QuestCard key={quest.id} quest={quest} onStart={(q) => navigate(`/quest/${q.id}`)} />
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Grid: Labs + System */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-[1px] bg-border">
          
          {/* Training Labs */}
          <div className="md:col-span-4 terminal-panel">
            <div className="panel-header">Specialized Training</div>
            <div className="p-2 space-y-[1px]">
              {LABS.map(lab => {
                const Icon = lab.icon;
                return (
                  <button
                    key={lab.path}
                    onClick={() => navigate(lab.path)}
                    className="w-full flex items-center gap-2 px-2 py-2 hover:bg-accent/30 transition-colors text-left group"
                  >
                    <Icon className="h-3 w-3 text-muted-foreground group-hover:text-primary transition-colors" />
                    <span className="text-xs flex-1">{lab.label}</span>
                    <ChevronRight className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                  </button>
                );
              })}
              <button
                onClick={() => navigate('/challenges')}
                className="w-full flex items-center gap-2 px-2 py-2 hover:bg-accent/30 transition-colors text-left group border-t border-border"
              >
                <Trophy className="h-3 w-3 text-warning group-hover:text-primary transition-colors" />
                <span className="text-xs flex-1">Challenges</span>
                <ChevronRight className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
              </button>
            </div>
          </div>

          {/* AI Mentor */}
          <div className="md:col-span-8 terminal-panel">
            <div className="panel-header">
              <MessageSquare className="h-2.5 w-2.5" />
              <span>The Architect — AI Mentor</span>
            </div>
            <div className="p-3">
              <AIChat
                title="The Architect"
                placeholder="Request guidance from The Architect..."
              />
            </div>
          </div>
        </div>

        {/* System Messages */}
        {completedCount === quests.length && quests.length > 0 && (
          <div className="mt-[1px] terminal-panel">
            <div className="p-3 text-center">
              <p className="text-[0.65rem] data-readout text-success text-glow">
                ▓▓▓▓▓▓▓▓▓▓ DAILY PROTOCOL COMPLETE — ALL OBJECTIVES SATISFIED ▓▓▓▓▓▓▓▓▓▓
              </p>
            </div>
          </div>
        )}

        {completedCount === 0 && quests.length > 0 && (
          <div className="mt-[1px] terminal-panel">
            <div className="p-3">
              <p className="text-[0.6rem] data-readout text-muted-foreground">
                <span className="text-primary">SYS&gt;</span> {quests.length} objectives assigned.
                Complete all training protocols to maximize attribute development.
                Accumulated points are classified until level advancement.
              </p>
            </div>
          </div>
        )}

        {/* Dev Tools */}
        <div className="mt-[1px] terminal-panel">
          <button
            onClick={() => navigate('/chatgpt-test')}
            className="w-full flex items-center gap-2 px-3 py-2 hover:bg-accent/30 transition-colors text-left"
          >
            <TestTube className="h-3 w-3 text-muted-foreground" />
            <span className="text-[0.6rem] data-readout text-muted-foreground">DEV: ChatGPT Integration Test</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
