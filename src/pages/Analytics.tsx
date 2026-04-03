import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { getUserProfile, getQuestAttempts } from '@/lib/storage';
import { AttributeRadarChart } from '@/components/AttributeRadarChart';
import { UserProfile, QuestAttempt } from '@/lib/types';
import { ArrowLeft, TrendingUp, Target, Clock, Flame, Brain, Swords, Users, BarChart3, Zap } from 'lucide-react';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid,
  AreaChart, Area, PieChart, Pie, Cell, Legend
} from 'recharts';

const Analytics = () => {
  const navigate = useNavigate();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [attempts, setAttempts] = useState<QuestAttempt[]>([]);

  useEffect(() => {
    setProfile(getUserProfile());
    setAttempts(getQuestAttempts());
  }, []);

  const stats = useMemo(() => {
    const totalXP = attempts.reduce((sum, a) => sum + a.xpGained, 0);
    const completedQuests = attempts.filter(a => a.success).length;
    const avgTime = attempts.length > 0
      ? Math.round(attempts.reduce((sum, a) => sum + a.timeTaken, 0) / attempts.length)
      : 0;
    const successRate = attempts.length > 0 ? Math.round((completedQuests / attempts.length) * 100) : 0;
    return { totalXP, completedQuests, avgTime, successRate };
  }, [attempts]);

  // XP over time (group by day)
  const xpOverTime = useMemo(() => {
    if (attempts.length === 0) return [];
    const sorted = [...attempts].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    const dayMap = new Map<string, number>();
    let cumulative = 0;
    sorted.forEach(a => {
      const day = new Date(a.timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      cumulative += a.xpGained;
      dayMap.set(day, cumulative);
    });
    return Array.from(dayMap.entries()).map(([day, xp]) => ({ day, xp }));
  }, [attempts]);

  // Quest performance by day of week
  const dayOfWeekData = useMemo(() => {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const counts = new Array(7).fill(0);
    const xpSums = new Array(7).fill(0);
    attempts.forEach(a => {
      const d = new Date(a.timestamp).getDay();
      counts[d]++;
      xpSums[d] += a.xpGained;
    });
    return days.map((name, i) => ({ name, quests: counts[i], xp: xpSums[i] }));
  }, [attempts]);

  // Streak calculation
  const streak = useMemo(() => {
    if (attempts.length === 0) return 0;
    const uniqueDays = new Set(
      attempts.map(a => new Date(a.timestamp).toDateString())
    );
    const sortedDays = Array.from(uniqueDays)
      .map(d => new Date(d))
      .sort((a, b) => b.getTime() - a.getTime());

    let count = 0;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (let i = 0; i < sortedDays.length; i++) {
      const expected = new Date(today);
      expected.setDate(expected.getDate() - i);
      expected.setHours(0, 0, 0, 0);
      const actual = new Date(sortedDays[i]);
      actual.setHours(0, 0, 0, 0);
      if (actual.getTime() === expected.getTime()) {
        count++;
      } else {
        break;
      }
    }
    return count;
  }, [attempts]);

  // Best session
  const bestSession = useMemo(() => {
    if (attempts.length === 0) return null;
    return attempts.reduce((best, a) => a.xpGained > best.xpGained ? a : best, attempts[0]);
  }, [attempts]);

  // Success vs failure pie
  const outcomeData = useMemo(() => {
    const success = attempts.filter(a => a.success).length;
    const failed = attempts.length - success;
    return [
      { name: 'Success', value: success },
      { name: 'Failed', value: failed },
    ];
  }, [attempts]);

  const PIE_COLORS = ['hsl(var(--primary))', 'hsl(var(--destructive))'];

  if (!profile) return null;

  const recentAttempts = attempts.slice(-5).reverse();

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="container mx-auto px-4 py-4">
          <Button variant="ghost" size="sm" onClick={() => navigate('/')} className="mb-2 font-mono-data">
            <ArrowLeft className="h-4 w-4 mr-1" /> Return
          </Button>
          <h1 className="text-xl font-bold">Performance Analytics</h1>
          <p className="text-xs text-muted-foreground font-mono-data mt-1">
            COMPREHENSIVE SYSTEM ANALYSIS · {attempts.length} DATA POINTS
          </p>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8 max-w-6xl space-y-6">
        {/* Overview Stats */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {[
            { icon: TrendingUp, label: 'TOTAL XP', value: stats.totalXP },
            { icon: Target, label: 'COMPLETED', value: stats.completedQuests },
            { icon: Clock, label: 'AVG TIME', value: `${Math.floor(stats.avgTime / 60)}:${(stats.avgTime % 60).toString().padStart(2, '0')}` },
            { icon: Zap, label: 'SUCCESS', value: `${stats.successRate}%` },
            { icon: Flame, label: 'STREAK', value: `${streak}d` },
          ].map(({ icon: Icon, label, value }) => (
            <div key={label} className="bg-card border border-border p-4">
              <div className="flex items-center gap-2 mb-2">
                <Icon className="h-4 w-4 text-muted-foreground" />
                <span className="text-xs font-mono-data text-muted-foreground">{label}</span>
              </div>
              <div className="font-mono-data text-2xl font-bold">{value}</div>
            </div>
          ))}
        </div>

        {/* Two-column: Radar + Outcome Pie */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Attribute Radar — same as Profile (dynamic scale, no radius ticks) */}
          <div className="bg-card border border-border p-6">
            <h2 className="font-bold mb-4 flex items-center gap-2">
              <Brain className="h-4 w-4 text-muted-foreground" /> Attribute Overview
            </h2>
            <div className="w-full min-w-0">
              <AttributeRadarChart attributes={profile.visibleStats} />
            </div>
          </div>

          {/* Outcome Breakdown */}
          <div className="bg-card border border-border p-6">
            <h2 className="font-bold mb-4 flex items-center gap-2">
              <Target className="h-4 w-4 text-muted-foreground" /> Quest Outcomes
            </h2>
            {attempts.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-16">No data yet.</p>
            ) : (
              <div className="w-full h-[260px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={outcomeData}
                      cx="50%" cy="50%"
                      innerRadius={60} outerRadius={90}
                      paddingAngle={4}
                      dataKey="value"
                      animationBegin={200}
                      animationDuration={1000}
                    >
                      {outcomeData.map((_, i) => (
                        <Cell key={i} fill={PIE_COLORS[i]} />
                      ))}
                    </Pie>
                    <Legend
                      iconType="circle"
                      formatter={(value: string) => <span className="text-xs font-mono-data text-foreground">{value}</span>}
                    />
                    <Tooltip
                      contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', fontFamily: 'monospace', fontSize: 12 }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        </div>

        {/* XP Progress Over Time */}
        <div className="bg-card border border-border p-6">
          <h2 className="font-bold mb-4 flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-muted-foreground" /> Cumulative XP Growth
          </h2>
          {xpOverTime.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-12">Complete quests to track XP growth.</p>
          ) : (
            <div className="w-full h-[220px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={xpOverTime}>
                  <defs>
                    <linearGradient id="xpGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="day" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10, fontFamily: 'monospace' }} />
                  <YAxis tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10, fontFamily: 'monospace' }} />
                  <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', fontFamily: 'monospace', fontSize: 12 }} />
                  <Area type="monotone" dataKey="xp" stroke="hsl(var(--primary))" fill="url(#xpGradient)" strokeWidth={2} animationDuration={1500} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* Activity by Day of Week */}
        <div className="bg-card border border-border p-6">
          <h2 className="font-bold mb-4 flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-muted-foreground" /> Activity by Day of Week
          </h2>
          {attempts.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-12">No activity data yet.</p>
          ) : (
            <div className="w-full h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dayOfWeekData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="name" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10, fontFamily: 'monospace' }} />
                  <YAxis tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10, fontFamily: 'monospace' }} />
                  <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', fontFamily: 'monospace', fontSize: 12 }} />
                  <Bar dataKey="quests" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} animationDuration={1200} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* Best Session + Recent Activity side by side */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Best Session */}
          <div className="bg-card border border-border p-6">
            <h2 className="font-bold mb-4 flex items-center gap-2">
              <Swords className="h-4 w-4 text-muted-foreground" /> Best Session
            </h2>
            {bestSession ? (
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-xs text-muted-foreground font-mono-data">XP EARNED</span>
                  <span className="font-mono-data font-bold text-primary">+{bestSession.xpGained}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-xs text-muted-foreground font-mono-data">TIME</span>
                  <span className="font-mono-data">{Math.floor(bestSession.timeTaken / 60)}m {bestSession.timeTaken % 60}s</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-xs text-muted-foreground font-mono-data">DATE</span>
                  <span className="font-mono-data text-sm">{new Date(bestSession.timestamp).toLocaleDateString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-xs text-muted-foreground font-mono-data">RESULT</span>
                  <span className={`font-mono-data text-sm font-bold ${bestSession.success ? 'text-primary' : 'text-destructive'}`}>
                    {bestSession.success ? 'SUCCESS' : 'FAILED'}
                  </span>
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-8">No sessions recorded.</p>
            )}
          </div>

          {/* Recent Activity */}
          <div className="bg-card border border-border p-6">
            <h2 className="font-bold mb-4 flex items-center gap-2">
              <Users className="h-4 w-4 text-muted-foreground" /> Recent Activity
            </h2>
            {recentAttempts.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">No quest attempts recorded.</p>
            ) : (
              <div className="space-y-2">
                {recentAttempts.map((attempt) => (
                  <div key={attempt.id} className="flex items-center justify-between p-2 bg-surface border border-border text-sm">
                    <div>
                      <div className="font-mono-data text-xs">#{attempt.questId.substring(0, 8)}</div>
                      <div className="text-xs text-muted-foreground">{new Date(attempt.timestamp).toLocaleDateString()}</div>
                    </div>
                    <div className="text-right">
                      <div className="font-mono-data text-xs font-bold text-primary">+{attempt.xpGained} XP</div>
                      <div className="text-xs text-muted-foreground">{Math.floor(attempt.timeTaken / 60)}m</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* System Note */}
        <div className="bg-surface border border-border p-4">
          <p className="text-xs text-muted-foreground leading-relaxed">
            <span className="font-mono-data font-bold">ANALYTICS NOTE:</span> Performance data
            tracked locally. Metrics used for adaptive difficulty calibration. Charts animate on
            page load. Extended comparative analysis available after 30-day participation minimum.
          </p>
        </div>
      </div>
    </div>
  );
};

export default Analytics;
