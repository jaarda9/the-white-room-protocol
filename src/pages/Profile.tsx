import { useState, useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  getUserProfile,
  saveUserProfile,
  getHunterRank,
  getHunterJob,
  getHunterTitle,
  getQuestAttempts,
} from '@/lib/storage';
import { UserProfile, QuestAttempt } from '@/lib/types';
import { systemSound } from '@/lib/system-sound';
import { useAuth } from '@/contexts/AuthContext';
import { AttributeRadarChart } from '@/components/AttributeRadarChart';
import {
  Crown,
  Sparkles,
  TrendingUp,
  Target,
  Clock,
  Flame,
  Brain,
  Swords,
  Users,
  BarChart3,
  Zap,
  Shield,
  FileText,
  SlidersHorizontal,
  Dumbbell,
  BookOpen,
  RotateCcw,
  Scale,
} from 'lucide-react';
import {
  getHunterProtocolConfig,
  resetHunterProtocolToSystem,
  type HunterProtocolConfig,
} from '@/lib/storage';
import ProtocolCalibrationModal from '@/components/ProtocolCalibrationModal';
import BiometricsCalibrationModal from '@/components/BiometricsCalibrationModal';
import { calculateIMC } from '@/lib/nutrition-lab';
import { toast } from 'sonner';
import ErrorBoundary from '@/components/ErrorBoundary';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';

const Profile = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialTab = searchParams.get('tab') === 'analytics'
    ? 'analytics'
    : searchParams.get('tab') === 'dossier'
    ? 'dossier'
    : searchParams.get('tab') === 'calibration'
    ? 'calibration'
    : 'all';

  const [activeTab, setActiveTab] = useState<'all' | 'dossier' | 'analytics' | 'calibration'>(initialTab);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [attempts, setAttempts] = useState<QuestAttempt[]>([]);
  const [protocolConfig, setProtocolConfig] = useState<HunterProtocolConfig>(() => getHunterProtocolConfig());
  const [calibrationModalOpen, setCalibrationModalOpen] = useState(false);
  const [biometricsModalOpen, setBiometricsModalOpen] = useState(false);
  const { signOut } = useAuth();
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    const update = () => {
      setProfile(getUserProfile());
      setAttempts(getQuestAttempts());
      setProtocolConfig(getHunterProtocolConfig());
    };
    update();

    window.addEventListener('wrp:profile-updated', update);
    window.addEventListener('storage', update);
    window.addEventListener('wrp:protocol-calibrated', update);
    return () => {
      window.removeEventListener('wrp:profile-updated', update);
      window.removeEventListener('storage', update);
      window.removeEventListener('wrp:protocol-calibrated', update);
    };
  }, []);

  const stats = useMemo(() => {
    const totalXP = attempts.reduce((sum, a) => sum + a.xpGained, 0);
    const completedQuests = attempts.filter((a) => a.success).length;
    const avgTime =
      attempts.length > 0
        ? Math.round(attempts.reduce((sum, a) => sum + a.timeTaken, 0) / attempts.length)
        : 0;
    const successRate =
      attempts.length > 0 ? Math.round((completedQuests / attempts.length) * 100) : 0;
    return { totalXP, completedQuests, avgTime, successRate };
  }, [attempts]);

  const imcData = useMemo(() => {
    const w = profile?.bodyMetrics?.weightKg ?? 72;
    const h = profile?.bodyMetrics?.heightCm ?? 175;
    return calculateIMC(w, h);
  }, [profile?.bodyMetrics]);

  // XP over time (group by day)
  const xpOverTime = useMemo(() => {
    if (attempts.length === 0) return [];
    const sorted = [...attempts].sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );
    const dayMap = new Map<string, number>();
    let cumulative = 0;
    sorted.forEach((a) => {
      const day = new Date(a.timestamp).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
      });
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
    attempts.forEach((a) => {
      const d = new Date(a.timestamp).getDay();
      counts[d]++;
      xpSums[d] += a.xpGained;
    });
    return days.map((name, i) => ({ name, quests: counts[i], xp: xpSums[i] }));
  }, [attempts]);

  // Streak calculation
  const streak = useMemo(() => {
    if (attempts.length === 0) return 0;
    const uniqueDays = new Set(attempts.map((a) => new Date(a.timestamp).toDateString()));
    const sortedDays = Array.from(uniqueDays)
      .map((d) => new Date(d))
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
    return attempts.reduce((best, a) => (a.xpGained > best.xpGained ? a : best), attempts[0]);
  }, [attempts]);

  // Success vs failure pie
  const outcomeData = useMemo(() => {
    const success = attempts.filter((a) => a.success).length;
    const failed = attempts.length - success;
    return [
      { name: 'Success', value: success },
      { name: 'Failed', value: failed },
    ];
  }, [attempts]);

  const PIE_COLORS = ['#38bdf8', '#f43f5e'];

  if (!profile) return null;

  const rank = getHunterRank(profile.level);
  const job = getHunterJob(profile.level, profile.job);
  const title = getHunterTitle(profile.level, profile.title);

  const daysActive = Math.max(
    1,
    Math.floor(
      (new Date().getTime() - new Date(profile.createdAt).getTime()) / (1000 * 60 * 60 * 24)
    )
  );

  const titlesAvailable = [
    { name: 'The Awakened', rank: 'E', desc: 'One who stepped into the hunter world.' },
    { name: 'Wolf Slayer', rank: 'D', desc: 'Conqueror of the Lycan dungeon packs.' },
    { name: 'Peak Vitality', rank: 'C', desc: 'Maintains 90%+ health (+10% EXP Gain).' },
    { name: 'Dungeon Conqueror', rank: 'C', desc: 'Master of instant dungeon trials.' },
    { name: 'The Indomitable Will', rank: 'B', desc: 'Pushed through zero stamina/mana in Overdrive Protocol.' },
    { name: 'Demon Slayer', rank: 'B', desc: 'Breaker of demonic gates.' },
    { name: 'Ruler of the Dead', rank: 'A', desc: 'Commander of lingering shadow souls.' },
    { name: 'Supreme Sovereign', rank: 'S', desc: 'The absolute monarch of the shadow realm.' },
  ];

  const handleSelectTitle = (tName: string) => {
    systemSound.playClick();
    const updated: UserProfile = {
      ...profile,
      title: tName,
    };
    saveUserProfile(updated);
    setProfile(updated);
  };

  const handleTabChange = (tab: 'all' | 'dossier' | 'analytics') => {
    systemSound.playClick();
    setActiveTab(tab);
    setSearchParams(tab === 'all' ? {} : { tab });
  };

  const recentAttempts = attempts.slice(-5).reverse();

  return (
    <div className="min-h-screen pt-6 pb-28 sm:pb-36 bg-[#071322] text-[#e5ecf4] flex flex-col system-blueprint-bg font-mono">
      <main className="max-w-5xl mx-auto w-full px-3 sm:px-6 py-4 sm:py-8 flex-1 space-y-6 overflow-x-hidden">
        {/* Top Header Card in anime window style */}
        <div className="relative bg-[#0a1b2e]/90 border-2 border-white/50 rounded-[4px] p-4 sm:p-6 text-center text-white shadow-[0_0_30px_rgba(0,0,0,0.85),inset_0_0_24px_rgba(0,212,255,0.08)] backdrop-blur-md anime-dropdown">
          <div className="inline-block px-6 sm:px-8 py-1 border border-white/70 bg-[#061426]/60 shadow-[0_0_14px_rgba(0,212,255,0.35)] mb-2">
            <h1 className="text-base sm:text-2xl font-mono font-bold text-white anime-glow-text tracking-[0.2em] flex items-center justify-center gap-2">
              <Crown className="w-5 h-5 text-[#9fd3ff]" />
              HUNTER DOSSIER & COMBAT ANALYTICS
              <Sparkles className="w-5 h-5 text-[#9fd3ff]" />
            </h1>
          </div>
          <p className="text-[11px] sm:text-xs font-mono text-white/80 mt-1">
            [Awakened Credentials, Job Titles, Attribute Matrix & Performance Diagnostics]
          </p>

          {/* Sub-view Navigation Filter Tabs */}
          <div className="flex items-center justify-center gap-2 mt-4 pt-4 border-t border-white/15 flex-wrap">
            <button
              onClick={() => handleTabChange('all')}
              className={`px-3 py-1.5 border rounded-[2px] text-xs transition-all ${
                activeTab === 'all'
                  ? 'border-white bg-white/20 text-white font-bold shadow-[0_0_10px_rgba(0,212,255,0.3)]'
                  : 'border-white/30 bg-[#061424]/80 text-gray-400 hover:text-white hover:border-white/60'
              }`}
            >
              ALL OVERVIEW
            </button>
            <button
              onClick={() => handleTabChange('dossier')}
              className={`px-3 py-1.5 border rounded-[2px] text-xs transition-all flex items-center gap-1.5 ${
                activeTab === 'dossier'
                  ? 'border-white bg-white/20 text-white font-bold shadow-[0_0_10px_rgba(0,212,255,0.3)]'
                  : 'border-white/30 bg-[#061424]/80 text-gray-400 hover:text-white hover:border-white/60'
              }`}
            >
              <FileText className="w-3.5 h-3.5 text-[#9fd3ff]" />
              HUNTER DOSSIER & TITLES
            </button>
            <button
              onClick={() => handleTabChange('analytics')}
              className={`px-3 py-1.5 border rounded-[2px] text-xs transition-all flex items-center gap-1.5 ${
                activeTab === 'analytics'
                  ? 'border-white bg-white/20 text-white font-bold shadow-[0_0_10px_rgba(0,212,255,0.3)]'
                  : 'border-white/30 bg-[#061424]/80 text-gray-400 hover:text-white hover:border-white/60'
              }`}
            >
              <BarChart3 className="w-3.5 h-3.5 text-[#9fd3ff]" />
              COMBAT ANALYTICS
            </button>
            <button
              onClick={() => handleTabChange('calibration')}
              className={`px-3 py-1.5 border rounded-[2px] text-xs transition-all flex items-center gap-1.5 ${
                activeTab === 'calibration'
                  ? 'border-white bg-white/20 text-white font-bold shadow-[0_0_10px_rgba(0,212,255,0.3)]'
                  : 'border-white/30 bg-[#061424]/80 text-gray-400 hover:text-white hover:border-white/60'
              }`}
            >
              <SlidersHorizontal className="w-3.5 h-3.5 text-[#9fd3ff]" />
              PROTOCOL CALIBRATION
            </button>
          </div>
        </div>

        {/* ============================================================ */}
        {/* DOSSIER SECTION: Registration License */}
        {/* ============================================================ */}
        {(activeTab === 'all' || activeTab === 'dossier') && (
          <div className="relative bg-[#0a1b2e]/90 border-2 border-white/50 rounded-[4px] p-4 sm:p-6 text-white shadow-[0_0_30px_rgba(0,0,0,0.85),inset_0_0_24px_rgba(0,212,255,0.08)] backdrop-blur-md anime-dropdown">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 border-b border-white/20 pb-4 mb-4 sm:mb-6">
              <div className="flex items-center gap-3 sm:gap-4 min-w-0">
                <div className="w-12 h-12 sm:w-14 sm:h-14 shrink-0 border-2 border-white/70 bg-[#061426]/80 flex items-center justify-center font-mono font-black text-xl sm:text-2xl text-white anime-glow-text shadow-[0_0_15px_rgba(0,212,255,0.3)]">
                  {rank}
                </div>
                <div className="min-w-0">
                  <div className="text-[10px] font-mono text-[#9fd3ff] tracking-wider uppercase truncate flex items-center gap-1.5">
                    <Shield className="w-3 h-3 text-[#9fd3ff]" />
                    HUNTER REGISTRATION DOSSIER
                  </div>
                  <h2 className="text-base sm:text-2xl font-mono font-bold text-white tracking-wider flex flex-wrap items-center gap-1.5 sm:gap-2">
                    <span className="truncate">{profile.displayName || profile.pseudo}</span>
                    <span className="text-[11px] sm:text-xs px-1.5 sm:px-2 py-0.5 border border-white/50 bg-[#061426]/60 text-[#9fd3ff] shrink-0">
                      {rank}-RANK
                    </span>
                  </h2>
                </div>
              </div>

              <div className="text-xs font-mono text-gray-400 shrink-0">
                HUNTER ID: <span className="text-[#9fd3ff] font-bold">{profile.pseudo}</span>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3 font-mono text-xs">
              <div className="p-2.5 sm:p-3 border border-white/30 bg-[#061424]/75 rounded-[2px] min-w-0">
                <div className="text-gray-400 text-[10px] truncate">JOB CLASS</div>
                <div className="text-xs sm:text-sm font-bold text-white mt-1 truncate">{job}</div>
              </div>
              <div className="p-2.5 sm:p-3 border border-white/30 bg-[#061424]/75 rounded-[2px] min-w-0">
                <div className="text-gray-400 text-[10px] truncate">EQUIPPED TITLE</div>
                <div className="text-xs sm:text-sm font-bold text-[#9fd3ff] mt-1 truncate">{title}</div>
              </div>
              <div className="p-2.5 sm:p-3 border border-white/30 bg-[#061424]/75 rounded-[2px] min-w-0">
                <div className="text-gray-400 text-[10px] truncate">HUNTER LEVEL</div>
                <div className="text-xs sm:text-sm font-bold text-white mt-1 truncate">LV.{profile.level}</div>
              </div>
              <div className="p-2.5 sm:p-3 border border-white/30 bg-[#061424]/75 rounded-[2px] min-w-0">
                <div className="text-gray-400 text-[10px] truncate">ACTIVE DAYS</div>
                <div className="text-xs sm:text-sm font-bold text-[#9fd3ff] mt-1 truncate">{daysActive} DAYS</div>
              </div>
            </div>

            {/* Anthropometric Biometrics & IMC Row */}
            <div className="mt-3.5 pt-3.5 border-t border-white/20">
              <div className="flex items-center justify-between mb-2">
                <div className="text-[10px] text-[#9fd3ff] tracking-wider uppercase font-bold flex items-center gap-1.5">
                  <Scale className="w-3.5 h-3.5 text-cyan-400" />
                  <span>ANTHROPOMETRIC BIOMETRICS & IMC</span>
                </div>
                <button
                  onClick={() => {
                    systemSound.playClick();
                    setBiometricsModalOpen(true);
                  }}
                  className="text-[10px] text-cyan-300 hover:text-white border border-cyan-400/50 hover:border-cyan-300 bg-cyan-950/40 px-2 py-0.5 rounded-[2px] transition-all"
                >
                  [ CALIBRATE ]
                </button>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3 font-mono text-xs">
                <div className="p-2.5 sm:p-3 border border-white/30 bg-[#061424]/75 rounded-[2px] min-w-0">
                  <div className="text-gray-400 text-[10px] truncate">BODY WEIGHT</div>
                  <div className="text-xs sm:text-sm font-bold text-white mt-1 truncate">
                    {profile?.bodyMetrics?.weightKg ?? 72} KG
                  </div>
                </div>
                <div className="p-2.5 sm:p-3 border border-white/30 bg-[#061424]/75 rounded-[2px] min-w-0">
                  <div className="text-gray-400 text-[10px] truncate">BODY HEIGHT</div>
                  <div className="text-xs sm:text-sm font-bold text-white mt-1 truncate">
                    {profile?.bodyMetrics?.heightCm ?? 175} CM
                  </div>
                </div>
                <div className="p-2.5 sm:p-3 border border-white/30 bg-[#061424]/75 rounded-[2px] min-w-0">
                  <div className="text-gray-400 text-[10px] truncate">IMC / BMI STATUS</div>
                  <div
                    className="text-xs sm:text-sm font-bold mt-1 truncate"
                    style={{ color: imcData.color }}
                  >
                    {imcData.imc} • {imcData.label}
                  </div>
                </div>
                <div className="p-2.5 sm:p-3 border border-white/30 bg-[#061424]/75 rounded-[2px] min-w-0">
                  <div className="text-gray-400 text-[10px] truncate">NUTRITIONAL GOAL</div>
                  <div className="text-xs sm:text-sm font-bold text-[#9fd3ff] mt-1 truncate uppercase">
                    {profile?.bodyMetrics?.dietaryGoal || 'LEAN BULK'}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ============================================================ */}
        {/* COMBAT VITALS: Summary Metrics Bar */}
        {/* ============================================================ */}
        {(activeTab === 'all' || activeTab === 'analytics') && (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2.5 sm:gap-3 anime-dropdown">
            {[
              { icon: TrendingUp, label: 'TOTAL EXP', value: stats.totalXP.toLocaleString() },
              { icon: Target, label: 'COMPLETED', value: stats.completedQuests },
              {
                icon: Clock,
                label: 'AVG TIME',
                value: `${Math.floor(stats.avgTime / 60)}:${(stats.avgTime % 60)
                  .toString()
                  .padStart(2, '0')}`,
              },
              { icon: Zap, label: 'SUCCESS RATE', value: `${stats.successRate}%` },
              { icon: Flame, label: 'ACTIVE STREAK', value: `${streak}d` },
            ].map(({ icon: Icon, label, value }) => (
              <div
                key={label}
                className="bg-[#0a1b2e]/90 border-2 border-white/40 rounded-[4px] p-3 sm:p-4 text-white shadow-[0_0_20px_rgba(0,0,0,0.7)]"
              >
                <div className="flex items-center gap-1.5 sm:gap-2 mb-1 sm:mb-2">
                  <Icon className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-[#9fd3ff]" />
                  <span className="text-[9px] sm:text-[10px] font-mono text-gray-300 truncate">
                    {label}
                  </span>
                </div>
                <div className="font-mono text-lg sm:text-2xl font-bold text-white anime-glow-text truncate">
                  {value}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ============================================================ */}
        {/* COMBAT DIAGNOSTICS: Radar Chart & Outcomes Pie */}
        {/* ============================================================ */}
        {(activeTab === 'all' || activeTab === 'analytics') && (
          <ErrorBoundary fallbackMessage="Unable to render attribute matrix diagnostics. System state is intact.">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6 anime-dropdown">
              {/* Attribute Radar */}
              <div className="bg-[#0a1b2e]/90 border-2 border-white/50 rounded-[4px] p-4 sm:p-6 text-white shadow-[0_0_30px_rgba(0,0,0,0.85),inset_0_0_24px_rgba(0,212,255,0.08)] backdrop-blur-md">
                <h3 className="font-mono font-bold text-sm mb-4 flex items-center gap-2 text-white anime-glow-text">
                  <Brain className="h-4 w-4 text-[#9fd3ff]" /> [ ATTRIBUTE PROFILE MATRIX ]
                </h3>
                <div className="w-full min-w-0">
                  <AttributeRadarChart attributes={profile.visibleStats} />
                </div>
              </div>

              {/* Outcome Breakdown */}
              <div className="bg-[#0a1b2e]/90 border-2 border-white/50 rounded-[4px] p-4 sm:p-6 text-white shadow-[0_0_30px_rgba(0,0,0,0.85),inset_0_0_24px_rgba(0,212,255,0.08)] backdrop-blur-md">
                <h3 className="font-mono font-bold text-sm mb-4 flex items-center gap-2 text-white anime-glow-text">
                  <Target className="h-4 w-4 text-[#9fd3ff]" /> [ PROTOCOL OUTCOMES ]
                </h3>
                {attempts.length === 0 ? (
                  <p className="text-xs font-mono text-gray-400 text-center py-16">
                    [ NO PROTOCOL DATA RECORDED ]
                  </p>
                ) : (
                  <div className="w-full h-[240px] sm:h-[260px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={outcomeData}
                          cx="50%"
                          cy="50%"
                          innerRadius={55}
                          outerRadius={85}
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
                          formatter={(value: string) => (
                            <span className="text-xs font-mono text-gray-200">{value}</span>
                          )}
                        />
                        <Tooltip
                          contentStyle={{
                            background: '#061426',
                            border: '1px solid rgba(255,255,255,0.3)',
                            fontFamily: 'monospace',
                            fontSize: 12,
                            color: '#fff',
                          }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>
            </div>
          </ErrorBoundary>
        )}

        {/* ============================================================ */}
        {/* DOSSIER SECTION: Titles & Awakened Perks */}
        {/* ============================================================ */}
        {(activeTab === 'all' || activeTab === 'dossier') && (
          <div className="relative bg-[#0a1b2e]/90 border-2 border-white/50 rounded-[4px] p-4 sm:p-6 space-y-4 text-white shadow-[0_0_30px_rgba(0,0,0,0.85),inset_0_0_24px_rgba(0,212,255,0.08)] backdrop-blur-md anime-dropdown">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-white/20 pb-3">
              <div className="flex items-center gap-2">
                <Crown className="w-4 h-4 text-[#9fd3ff] shrink-0" />
                <h3 className="font-mono font-bold text-sm sm:text-base text-white anime-glow-text">
                  [ HUNTER TITLES & DESIGNATIONS ]
                </h3>
              </div>
              <span className="text-[10px] font-mono text-gray-400">CLICK TO EQUIP</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 sm:gap-3 font-mono">
              {titlesAvailable.map((t) => {
                const isEquipped = title === t.name;
                return (
                  <div
                    key={t.name}
                    onClick={() => handleSelectTitle(t.name)}
                    className={`p-3 sm:p-3.5 border rounded-[2px] cursor-pointer transition-all ${
                      isEquipped
                        ? 'border-white bg-white/15 text-white shadow-[0_0_12px_rgba(0,212,255,0.25)]'
                        : 'border-white/25 bg-[#061424]/75 text-gray-300 hover:border-white/70 hover:bg-white/5'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1 gap-2">
                      <span className="font-bold text-xs text-white truncate">{t.name}</span>
                      <span className="text-[10px] border border-white/40 px-1 text-[#9fd3ff] bg-black/40 shrink-0">
                        {t.rank}-RANK
                      </span>
                    </div>
                    <p className="text-[11px] text-gray-400 line-clamp-2">{t.desc}</p>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ============================================================ */}
        {/* ANALYTICS SECTION: EXP Trajectory & Weekly Frequency */}
        {/* ============================================================ */}
        {(activeTab === 'all' || activeTab === 'analytics') && (
          <ErrorBoundary fallbackMessage="Unable to render combat activity charts. System log records remain safe.">
            {/* XP Progress Over Time */}
            <div className="bg-[#0a1b2e]/90 border-2 border-white/50 rounded-[4px] p-4 sm:p-6 text-white shadow-[0_0_30px_rgba(0,0,0,0.85),inset_0_0_24px_rgba(0,212,255,0.08)] backdrop-blur-md anime-dropdown">
              <h3 className="font-mono font-bold text-sm mb-4 flex items-center gap-2 text-white anime-glow-text">
                <TrendingUp className="h-4 w-4 text-[#9fd3ff]" /> [ CUMULATIVE EXP TRAJECTORY ]
              </h3>
              {xpOverTime.length === 0 ? (
                <p className="text-xs font-mono text-gray-400 text-center py-12">
                  [ COMPLETE QUESTS TO TRACK EXP GROWTH ]
                </p>
              ) : (
                <div className="w-full h-[200px] sm:h-[220px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={xpOverTime}>
                      <defs>
                        <linearGradient id="xpGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#38bdf8" stopOpacity={0.4} />
                          <stop offset="95%" stopColor="#38bdf8" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                      <XAxis
                        dataKey="day"
                        tick={{ fill: 'rgba(255,255,255,0.6)', fontSize: 10, fontFamily: 'monospace' }}
                      />
                      <YAxis
                        tick={{ fill: 'rgba(255,255,255,0.6)', fontSize: 10, fontFamily: 'monospace' }}
                      />
                      <Tooltip
                        contentStyle={{
                          background: '#061426',
                          border: '1px solid rgba(255,255,255,0.3)',
                          fontFamily: 'monospace',
                          fontSize: 12,
                          color: '#fff',
                        }}
                      />
                      <Area
                        type="monotone"
                        dataKey="xp"
                        stroke="#38bdf8"
                        fill="url(#xpGradient)"
                        strokeWidth={2}
                        animationDuration={1500}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>

            {/* Activity by Day of Week */}
            <div className="bg-[#0a1b2e]/90 border-2 border-white/50 rounded-[4px] p-4 sm:p-6 text-white shadow-[0_0_30px_rgba(0,0,0,0.85),inset_0_0_24px_rgba(0,212,255,0.08)] backdrop-blur-md anime-dropdown">
              <h3 className="font-mono font-bold text-sm mb-4 flex items-center gap-2 text-white anime-glow-text">
                <BarChart3 className="h-4 w-4 text-[#9fd3ff]" /> [ WEEKLY FREQUENCY DISTRIBUTION ]
              </h3>
              {attempts.length === 0 ? (
                <p className="text-xs font-mono text-gray-400 text-center py-12">
                  [ NO ACTIVITY DATA DETECTED ]
                </p>
              ) : (
                <div className="w-full h-[180px] sm:h-[200px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={dayOfWeekData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                      <XAxis
                        dataKey="name"
                        tick={{ fill: 'rgba(255,255,255,0.6)', fontSize: 10, fontFamily: 'monospace' }}
                      />
                      <YAxis
                        tick={{ fill: 'rgba(255,255,255,0.6)', fontSize: 10, fontFamily: 'monospace' }}
                      />
                      <Tooltip
                        contentStyle={{
                          background: '#061426',
                          border: '1px solid rgba(255,255,255,0.3)',
                          fontFamily: 'monospace',
                          fontSize: 12,
                          color: '#fff',
                        }}
                      />
                      <Bar dataKey="quests" fill="#38bdf8" radius={[2, 2, 0, 0]} animationDuration={1200} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>

            {/* Breakthrough Session + Recent Activity */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6 anime-dropdown">
              <div className="bg-[#0a1b2e]/90 border-2 border-white/50 rounded-[4px] p-4 sm:p-6 text-white shadow-[0_0_30px_rgba(0,0,0,0.85),inset_0_0_24px_rgba(0,212,255,0.08)] backdrop-blur-md">
                <h3 className="font-mono font-bold text-sm mb-4 flex items-center gap-2 text-white anime-glow-text">
                  <Swords className="h-4 w-4 text-[#9fd3ff]" /> [ RECORD BREAKTHROUGH SESSION ]
                </h3>
                {bestSession ? (
                  <div className="space-y-3 font-mono text-xs">
                    <div className="flex justify-between border-b border-white/10 pb-2">
                      <span className="text-gray-400">EXP EARNED</span>
                      <span className="font-bold text-[#9fd3ff] anime-glow-text">
                        +{bestSession.xpGained} EXP
                      </span>
                    </div>
                    <div className="flex justify-between border-b border-white/10 pb-2">
                      <span className="text-gray-400">EXECUTION TIME</span>
                      <span className="font-bold text-white">
                        {Math.floor(bestSession.timeTaken / 60)}m {bestSession.timeTaken % 60}s
                      </span>
                    </div>
                    <div className="flex justify-between border-b border-white/10 pb-2">
                      <span className="text-gray-400">TIMESTAMP</span>
                      <span className="text-gray-300">
                        {new Date(bestSession.timestamp).toLocaleDateString()}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">STATUS RESULT</span>
                      <span
                        className={`font-bold ${
                          bestSession.success ? 'text-emerald-400' : 'text-rose-400'
                        }`}
                      >
                        {bestSession.success ? 'SUCCESS' : 'FAILED'}
                      </span>
                    </div>
                  </div>
                ) : (
                  <p className="text-xs font-mono text-gray-400 text-center py-8">
                    [ NO SESSIONS RECORDED ]
                  </p>
                )}
              </div>

              <div className="bg-[#0a1b2e]/90 border-2 border-white/50 rounded-[4px] p-4 sm:p-6 text-white shadow-[0_0_30px_rgba(0,0,0,0.85),inset_0_0_24px_rgba(0,212,255,0.08)] backdrop-blur-md">
                <h3 className="font-mono font-bold text-sm mb-4 flex items-center gap-2 text-white anime-glow-text">
                  <Users className="h-4 w-4 text-[#9fd3ff]" /> [ RECENT LOGGED ACTIVITY ]
                </h3>
                {recentAttempts.length === 0 ? (
                  <p className="text-xs font-mono text-gray-400 text-center py-8">
                    [ NO QUEST ATTEMPTS RECORDED ]
                  </p>
                ) : (
                  <div className="space-y-2 font-mono">
                    {recentAttempts.map((attempt) => (
                      <div
                        key={attempt.id}
                        className="flex items-center justify-between p-2.5 bg-[#061426]/75 border border-white/25 rounded-[2px] text-xs"
                      >
                        <div>
                          <div className="text-white font-bold">#{attempt.questId.substring(0, 8)}</div>
                          <div className="text-[10px] text-gray-400">
                            {new Date(attempt.timestamp).toLocaleDateString()}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-[#9fd3ff] font-bold">+{attempt.xpGained} EXP</div>
                          <div className="text-[10px] text-gray-400">
                            {Math.floor(attempt.timeTaken / 60)}m
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* System Analytics Notice */}
            <div className="bg-[#061426]/80 border border-white/30 rounded-[4px] p-4 font-mono anime-dropdown">
              <p className="text-xs text-gray-300 leading-relaxed">
                <span className="font-bold text-[#9fd3ff]">[ SYSTEM ANALYTICS NOTICE ]:</span> Performance
                data is evaluated automatically across completed protocols. Metrics dynamically calibrate
                system rewards and difficulty multipliers.
              </p>
            </div>
          </ErrorBoundary>
        )}

        {/* ============================================================ */}
        {/* PROTOCOL CALIBRATION SECTION */}
        {/* ============================================================ */}
        {(activeTab === 'all' || activeTab === 'calibration') && (() => {
          const activeProtocolConfig = protocolConfig || getHunterProtocolConfig();
          const isCustom = activeProtocolConfig.physicalPath === 'custom';

          return (
            <div className="relative bg-[#0a1b2e]/90 border-2 border-white/50 rounded-[4px] p-4 sm:p-6 text-white shadow-[0_0_30px_rgba(0,0,0,0.85),inset_0_0_24px_rgba(0,212,255,0.08)] backdrop-blur-md anime-dropdown font-mono">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/20 pb-4 mb-4">
                <div>
                  <div className="text-[10px] text-[#9fd3ff] tracking-wider uppercase flex items-center gap-1.5 font-bold mb-1">
                    <SlidersHorizontal className="w-3.5 h-3.5 text-[#00d4ff]" />
                    HUNTER DIRECTIVE CALIBRATION
                  </div>
                  <h2 className="text-sm sm:text-base font-bold text-white tracking-wide flex items-center gap-2">
                    <span>DAILY CONDITIONING & INTELLECTUAL DISCIPLINES</span>
                  </h2>
                </div>

                <div className="flex items-center gap-2">
                  <span
                    className={`px-2.5 py-1 text-[10px] font-bold border rounded-[2px] tracking-wider ${
                      isCustom
                        ? 'border-[#00d4ff] bg-[#00d4ff]/20 text-[#00d4ff]'
                        : 'border-white/40 bg-white/10 text-white'
                    }`}
                  >
                    {isCustom
                      ? `CUSTOM SPLIT: ${activeProtocolConfig.customWeeklySplit?.name?.toUpperCase() || 'PERSONAL'}`
                      : 'SYSTEM PRESCRIBED PLAN'}
                  </span>
                </div>
              </div>

              {/* Content Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Physical Conditioning Regimen */}
                <div className="p-4 rounded-[2px] border border-white/30 bg-[#061426]/80 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="text-xs font-bold text-[#9fd3ff] flex items-center gap-2">
                      <Dumbbell className="w-4 h-4 text-[#00d4ff]" />
                      <span>PHYSICAL CONDITIONING</span>
                    </div>
                    <span className="text-[10px] text-gray-400">
                      {isCustom ? 'Custom Gym Split' : 'Standard conditioning'}
                    </span>
                  </div>

                  {isCustom && activeProtocolConfig.customWeeklySplit ? (
                    <div className="space-y-2">
                      <div className="text-[11px] text-gray-300">
                        Active Split: <span className="text-white font-bold">{activeProtocolConfig.customWeeklySplit.name}</span>
                      </div>
                      {/* Weekly Schedule Mini Pill Grid */}
                      <div className="grid grid-cols-7 gap-1 pt-1">
                        {[
                          { key: 'monday', label: 'M' },
                          { key: 'tuesday', label: 'T' },
                          { key: 'wednesday', label: 'W' },
                          { key: 'thursday', label: 'T' },
                          { key: 'friday', label: 'F' },
                          { key: 'saturday', label: 'S' },
                          { key: 'sunday', label: 'S' },
                        ].map(({ key, label }) => {
                          const dayData = activeProtocolConfig.customWeeklySplit?.days?.[key as keyof typeof activeProtocolConfig.customWeeklySplit.days];
                          const isRest = dayData?.isRestDay;
                          return (
                            <div
                              key={key}
                              title={`${key.toUpperCase()}: ${isRest ? 'Rest Day' : dayData?.title || 'Conditioning'}`}
                              className={`p-1.5 rounded-[2px] text-center border text-[9px] ${
                                isRest
                                  ? 'border-white/20 bg-black/40 text-gray-400'
                                  : 'border-[#00d4ff]/50 bg-[#061e38] text-white font-bold'
                              }`}
                            >
                              <div className="text-[8px] text-gray-400 mb-0.5">{label}</div>
                              <div className="truncate text-[8px]">{isRest ? 'REST' : dayData?.exercises?.length || 0}</div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-1.5 text-xs text-gray-300">
                      <div className="text-[11px] text-gray-400">
                        Standard System Conditioning Protocol is active:
                      </div>
                      <ul className="text-[11px] space-y-1 text-gray-300 list-disc list-inside">
                        <li>Push Strength & Core Conditioning</li>
                        <li>Pull Strength & Back Hypertrophy</li>
                        <li>Leg Power & Explosive Sprint Conditioning</li>
                        <li>Cardio Endurance & Active Muscular Recovery</li>
                      </ul>
                    </div>
                  )}
                </div>

                {/* Intellectual & Reading Disciplines */}
                <div className="p-4 rounded-[2px] border border-white/30 bg-[#061426]/80 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="text-xs font-bold text-[#9fd3ff] flex items-center gap-2">
                      <BookOpen className="w-4 h-4 text-[#00d4ff]" />
                      <span>INTELLECTUAL DISCIPLINES</span>
                    </div>
                    <span className="text-[10px] text-gray-400">Mental Protocol</span>
                  </div>

                  <div className="space-y-2.5 text-xs">
                    <div className="p-2 rounded bg-black/30 border border-white/15">
                      <div className="text-[10px] text-gray-400 uppercase">Active Book Reading</div>
                      <div className="text-white font-bold text-xs truncate">
                        {activeProtocolConfig.mentalPreferences?.currentBookTitle || 'Not Configured (Standard Literary Protocol)'}
                      </div>
                      <div className="text-[10px] text-[#9fd3ff] mt-0.5">
                        Target: {activeProtocolConfig.mentalPreferences?.dailyReadingMinutes || 20} min / day
                      </div>
                    </div>

                    <div className="p-2 rounded bg-black/30 border border-white/15">
                      <div className="text-[10px] text-gray-400 uppercase">Primary Study Discipline</div>
                      <div className="text-white font-bold text-xs truncate">
                        {activeProtocolConfig.mentalPreferences?.currentStudyTopic || 'Not Configured (Standard Cognitive Protocol)'}
                      </div>
                      <div className="text-[10px] text-[#9fd3ff] mt-0.5">
                        Target: {activeProtocolConfig.mentalPreferences?.dailyStudyMinutes || 30} min / day
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Actions Bar */}
              <div className="flex items-center justify-between gap-3 pt-4 mt-4 border-t border-white/15 flex-wrap">
                <button
                  type="button"
                  onClick={() => {
                    systemSound.playClick();
                    if (confirm('Reset your protocol to standard System Prescribed conditioning?')) {
                      const reset = resetHunterProtocolToSystem();
                      setProtocolConfig(reset || getHunterProtocolConfig());
                      toast.success('PROTOCOL RESET', {
                        description: 'Your directives have been reset to the default System conditioning protocol.',
                      });
                    }
                  }}
                  className="px-3 py-1.5 border border-white/30 bg-black/40 hover:bg-black/60 text-gray-300 hover:text-white rounded-[2px] text-xs transition-colors flex items-center gap-1.5"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>RESET TO SYSTEM DEFAULT</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    systemSound.playClick();
                    setCalibrationModalOpen(true);
                  }}
                  className="px-4 py-2 bg-white text-black font-bold hover:bg-gray-200 transition-all rounded-[2px] text-xs shadow-[0_0_15px_rgba(0,212,255,0.3)] flex items-center gap-2"
                >
                  <SlidersHorizontal className="w-4 h-4 text-black" />
                  <span>CALIBRATE PROTOCOL & GYM ROUTINE</span>
                </button>
              </div>
            </div>
          );
        })()}

        {/* Hunter Protocol Calibration Modal */}
        <ProtocolCalibrationModal
          isOpen={calibrationModalOpen}
          onClose={() => {
            setCalibrationModalOpen(false);
            setProtocolConfig(getHunterProtocolConfig());
          }}
          onSaved={() => {
            setProtocolConfig(getHunterProtocolConfig());
            toast.success('CALIBRATION SYNCHRONIZED', {
              description: 'Your physical and mental directives have been updated across the System.',
            });
          }}
        />

        {/* Biometrics Calibration Modal */}
        {profile && (
          <BiometricsCalibrationModal
            isOpen={biometricsModalOpen}
            onClose={() => setBiometricsModalOpen(false)}
            profile={profile}
            onCalibrated={(updated) => {
              setProfile(updated);
            }}
          />
        )}

        {/* ============================================================ */}
        {/* DISCONNECT HUNTER SESSION */}
        {/* ============================================================ */}
        <div className="p-4 border-2 border-red-500/50 bg-[#0a1b2e]/85 rounded-[4px] flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 font-mono text-xs shadow-[0_0_20px_rgba(0,0,0,0.7)] anime-dropdown">
          <div>
            <span className="text-red-400 font-bold block tracking-wider text-xs sm:text-sm">
              [ TERMINATE HUNTER SESSION ]
            </span>
            <span className="text-gray-400 text-[11px]">
              Disconnect from system network and exit terminal.
            </span>
          </div>

          <button
            onClick={async () => {
              systemSound.playClick();
              setSigningOut(true);
              try {
                await signOut();
                navigate('/login');
              } finally {
                setSigningOut(false);
              }
            }}
            disabled={signingOut}
            className="w-full sm:w-auto px-4 py-2 border border-red-500/80 bg-red-950/40 text-red-300 hover:bg-red-900/60 hover:text-white font-bold transition-all shadow-[0_0_10px_rgba(239,68,68,0.2)] text-center"
          >
            {signingOut ? 'DISCONNECTING...' : 'DISCONNECT SESSION'}
          </button>
        </div>
      </main>
    </div>
  );
};

export default Profile;
