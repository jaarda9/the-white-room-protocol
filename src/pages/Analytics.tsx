import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
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

  const PIE_COLORS = ['#38bdf8', '#f43f5e'];

  if (!profile) return null;

  const recentAttempts = attempts.slice(-5).reverse();

  return (
    <div className="min-h-screen pt-6 pb-28 bg-[#071322] text-[#e5ecf4] flex flex-col system-blueprint-bg font-mono">
      <main className="max-w-6xl mx-auto w-full px-4 py-8 flex-1 space-y-6">
        <div>
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-2 px-3 py-1.5 border border-white/50 bg-[#061426]/80 text-[#9fd3ff] text-xs font-mono hover:bg-white/10 hover:border-white transition-all shadow-[0_0_10px_rgba(0,212,255,0.2)]"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>[ RETURN TO STATUS ]</span>
          </button>
        </div>

        {/* Top Header Card in anime window style */}
        <div className="relative bg-[#0a1b2e]/90 border-2 border-white/50 rounded-[4px] p-6 text-center text-white shadow-[0_0_30px_rgba(0,0,0,0.85),inset_0_0_24px_rgba(0,212,255,0.08)] backdrop-blur-md anime-dropdown">
          <div className="inline-block px-8 py-1 border border-white/70 bg-[#061426]/60 shadow-[0_0_14px_rgba(0,212,255,0.35)] mb-2">
            <h1 className="text-xl sm:text-2xl font-mono font-bold text-white anime-glow-text tracking-[0.2em] flex items-center justify-center gap-2">
              <BarChart3 className="w-5 h-5 text-[#9fd3ff]" />
              HUNTER PERFORMANCE ANALYTICS
            </h1>
          </div>
          <p className="text-xs font-mono text-white/80 mt-1">
            COMPREHENSIVE SYSTEM DIAGNOSTICS · {attempts.length} PROTOCOL DATA POINTS
          </p>
        </div>

        {/* Overview Stats */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 anime-dropdown">
          {[
            { icon: TrendingUp, label: 'TOTAL XP', value: stats.totalXP.toLocaleString() },
            { icon: Target, label: 'COMPLETED', value: stats.completedQuests },
            { icon: Clock, label: 'AVG TIME', value: `${Math.floor(stats.avgTime / 60)}:${(stats.avgTime % 60).toString().padStart(2, '0')}` },
            { icon: Zap, label: 'SUCCESS', value: `${stats.successRate}%` },
            { icon: Flame, label: 'STREAK', value: `${streak}d` },
          ].map(({ icon: Icon, label, value }) => (
            <div key={label} className="bg-[#0a1b2e]/90 border-2 border-white/40 rounded-[4px] p-4 text-white shadow-[0_0_20px_rgba(0,0,0,0.7)]">
              <div className="flex items-center gap-2 mb-2">
                <Icon className="h-4 w-4 text-[#9fd3ff]" />
                <span className="text-[10px] font-mono text-gray-300">{label}</span>
              </div>
              <div className="font-mono text-2xl font-bold text-white anime-glow-text">{value}</div>
            </div>
          ))}
        </div>

        {/* Two-column: Radar + Outcome Pie */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 anime-dropdown">
          {/* Attribute Radar */}
          <div className="bg-[#0a1b2e]/90 border-2 border-white/50 rounded-[4px] p-6 text-white shadow-[0_0_30px_rgba(0,0,0,0.85),inset_0_0_24px_rgba(0,212,255,0.08)] backdrop-blur-md">
            <h2 className="font-mono font-bold text-sm mb-4 flex items-center gap-2 text-white anime-glow-text">
              <Brain className="h-4 w-4 text-[#9fd3ff]" /> [ ATTRIBUTE PROFILE MATRIX ]
            </h2>
            <div className="w-full min-w-0">
              <AttributeRadarChart attributes={profile.visibleStats} />
            </div>
          </div>

          {/* Outcome Breakdown */}
          <div className="bg-[#0a1b2e]/90 border-2 border-white/50 rounded-[4px] p-6 text-white shadow-[0_0_30px_rgba(0,0,0,0.85),inset_0_0_24px_rgba(0,212,255,0.08)] backdrop-blur-md">
            <h2 className="font-mono font-bold text-sm mb-4 flex items-center gap-2 text-white anime-glow-text">
              <Target className="h-4 w-4 text-[#9fd3ff]" /> [ PROTOCOL OUTCOMES ]
            </h2>
            {attempts.length === 0 ? (
              <p className="text-xs font-mono text-gray-400 text-center py-16">[ NO DATA RECORDED ]</p>
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
                        <Cell key={i} fill={PIE_COLORS[i]} stroke="#0a1b2e" strokeWidth={2} />
                      ))}
                    </Pie>
                    <Legend
                      iconType="circle"
                      formatter={(value: string) => <span className="text-xs font-mono text-gray-200">{value}</span>}
                    />
                    <Tooltip
                      contentStyle={{ background: '#061426', border: '1px solid rgba(255,255,255,0.3)', fontFamily: 'monospace', fontSize: 12, color: '#fff' }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        </div>

        {/* XP Progress Over Time */}
        <div className="bg-[#0a1b2e]/90 border-2 border-white/50 rounded-[4px] p-6 text-white shadow-[0_0_30px_rgba(0,0,0,0.85),inset_0_0_24px_rgba(0,212,255,0.08)] backdrop-blur-md anime-dropdown">
          <h2 className="font-mono font-bold text-sm mb-4 flex items-center gap-2 text-white anime-glow-text">
            <TrendingUp className="h-4 w-4 text-[#9fd3ff]" /> [ CUMULATIVE EXP TRAJECTORY ]
          </h2>
          {xpOverTime.length === 0 ? (
            <p className="text-xs font-mono text-gray-400 text-center py-12">[ COMPLETE QUESTS TO TRACK EXP GROWTH ]</p>
          ) : (
            <div className="w-full h-[220px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={xpOverTime}>
                  <defs>
                    <linearGradient id="xpGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#38bdf8" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#38bdf8" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                  <XAxis dataKey="day" tick={{ fill: 'rgba(255,255,255,0.6)', fontSize: 10, fontFamily: 'monospace' }} />
                  <YAxis tick={{ fill: 'rgba(255,255,255,0.6)', fontSize: 10, fontFamily: 'monospace' }} />
                  <Tooltip contentStyle={{ background: '#061426', border: '1px solid rgba(255,255,255,0.3)', fontFamily: 'monospace', fontSize: 12, color: '#fff' }} />
                  <Area type="monotone" dataKey="xp" stroke="#38bdf8" fill="url(#xpGradient)" strokeWidth={2} animationDuration={1500} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* Activity by Day of Week */}
        <div className="bg-[#0a1b2e]/90 border-2 border-white/50 rounded-[4px] p-6 text-white shadow-[0_0_30px_rgba(0,0,0,0.85),inset_0_0_24px_rgba(0,212,255,0.08)] backdrop-blur-md anime-dropdown">
          <h2 className="font-mono font-bold text-sm mb-4 flex items-center gap-2 text-white anime-glow-text">
            <BarChart3 className="h-4 w-4 text-[#9fd3ff]" /> [ WEEKLY FREQUENCY DISTRIBUTION ]
          </h2>
          {attempts.length === 0 ? (
            <p className="text-xs font-mono text-gray-400 text-center py-12">[ NO ACTIVITY DATA DETECTED ]</p>
          ) : (
            <div className="w-full h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dayOfWeekData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                  <XAxis dataKey="name" tick={{ fill: 'rgba(255,255,255,0.6)', fontSize: 10, fontFamily: 'monospace' }} />
                  <YAxis tick={{ fill: 'rgba(255,255,255,0.6)', fontSize: 10, fontFamily: 'monospace' }} />
                  <Tooltip contentStyle={{ background: '#061426', border: '1px solid rgba(255,255,255,0.3)', fontFamily: 'monospace', fontSize: 12, color: '#fff' }} />
                  <Bar dataKey="quests" fill="#38bdf8" radius={[2, 2, 0, 0]} animationDuration={1200} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* Best Session + Recent Activity side by side */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 anime-dropdown">
          {/* Best Session */}
          <div className="bg-[#0a1b2e]/90 border-2 border-white/50 rounded-[4px] p-6 text-white shadow-[0_0_30px_rgba(0,0,0,0.85),inset_0_0_24px_rgba(0,212,255,0.08)] backdrop-blur-md">
            <h2 className="font-mono font-bold text-sm mb-4 flex items-center gap-2 text-white anime-glow-text">
              <Swords className="h-4 w-4 text-[#9fd3ff]" /> [ RECORD BREAKTHROUGH SESSION ]
            </h2>
            {bestSession ? (
              <div className="space-y-3 font-mono text-xs">
                <div className="flex justify-between border-b border-white/10 pb-2">
                  <span className="text-gray-400">EXP EARNED</span>
                  <span className="font-bold text-[#9fd3ff] anime-glow-text">+{bestSession.xpGained} EXP</span>
                </div>
                <div className="flex justify-between border-b border-white/10 pb-2">
                  <span className="text-gray-400">EXECUTION TIME</span>
                  <span className="font-bold text-white">{Math.floor(bestSession.timeTaken / 60)}m {bestSession.timeTaken % 60}s</span>
                </div>
                <div className="flex justify-between border-b border-white/10 pb-2">
                  <span className="text-gray-400">TIMESTAMP</span>
                  <span className="text-gray-300">{new Date(bestSession.timestamp).toLocaleDateString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">STATUS RESULT</span>
                  <span className={`font-bold ${bestSession.success ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {bestSession.success ? 'SUCCESS' : 'FAILED'}
                  </span>
                </div>
              </div>
            ) : (
              <p className="text-xs font-mono text-gray-400 text-center py-8">[ NO SESSIONS RECORDED ]</p>
            )}
          </div>

          {/* Recent Activity */}
          <div className="bg-[#0a1b2e]/90 border-2 border-white/50 rounded-[4px] p-6 text-white shadow-[0_0_30px_rgba(0,0,0,0.85),inset_0_0_24px_rgba(0,212,255,0.08)] backdrop-blur-md">
            <h2 className="font-mono font-bold text-sm mb-4 flex items-center gap-2 text-white anime-glow-text">
              <Users className="h-4 w-4 text-[#9fd3ff]" /> [ RECENT LOGGED ACTIVITY ]
            </h2>
            {recentAttempts.length === 0 ? (
              <p className="text-xs font-mono text-gray-400 text-center py-8">[ NO QUEST ATTEMPTS RECORDED ]</p>
            ) : (
              <div className="space-y-2 font-mono">
                {recentAttempts.map((attempt) => (
                  <div key={attempt.id} className="flex items-center justify-between p-2.5 bg-[#061426]/75 border border-white/25 rounded-[2px] text-xs">
                    <div>
                      <div className="text-white font-bold">#{attempt.questId.substring(0, 8)}</div>
                      <div className="text-[10px] text-gray-400">{new Date(attempt.timestamp).toLocaleDateString()}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-[#9fd3ff] font-bold">+{attempt.xpGained} EXP</div>
                      <div className="text-[10px] text-gray-400">{Math.floor(attempt.timeTaken / 60)}m</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* System Note */}
        <div className="bg-[#061426]/80 border border-white/30 rounded-[4px] p-4 font-mono anime-dropdown">
          <p className="text-xs text-gray-300 leading-relaxed">
            <span className="font-bold text-[#9fd3ff]">[ SYSTEM ANALYTICS NOTICE ]:</span> Performance data
            is evaluated automatically. Metrics dynamically calibrate dungeon difficulty and system rewards.
          </p>
        </div>
      </main>
    </div>
  );
};

export default Analytics;
