import { useState, useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  getUserProfile,
  saveUserProfile,
  getHunterRank,
  getHunterJob,
  getHunterTitle,
  getQuestAttempts,
  getHunterVitals,
} from '@/lib/storage';
import { UserProfile, QuestAttempt } from '@/lib/types';
import { systemSound } from '@/lib/system-sound';
import { useAuth } from '@/contexts/AuthContext';
import { AttributeRadarChart } from '@/components/AttributeRadarChart';
import { getAchievementStats } from '@/lib/achievements';
import { getGates, RANK_ORDER } from '@/lib/gates';
import { createChainGate } from '@/lib/chain-gates';
import { addSkillLedgerEntry, getSkillLedger, saveSkillLedger } from '@/lib/skill-ledger';
import { aiGatewayClient } from '@/lib/ai-gateway-client';
import { TITLE_DEFINITIONS, type TitleUnlockContext } from '@/lib/titles';
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
  SlidersHorizontal,
  Dumbbell,
  BookOpen,
  RotateCcw,
  Scale,
  KeyRound,
  TestTube,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Lock,
} from 'lucide-react';
import {
  getHunterProtocolConfig,
  resetHunterProtocolToSystem,
  type HunterProtocolConfig,
} from '@/lib/storage';
import ProtocolCalibrationModal from '@/components/ProtocolCalibrationModal';
import BiometricsCalibrationModal from '@/components/BiometricsCalibrationModal';
import GeminiApiKeyModal from '@/components/GeminiApiKeyModal';
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
  const [searchParams] = useSearchParams();
  // Preserves old deep links like /profile?tab=analytics (Analytics.tsx redirects here) —
  // instead of switching to a whole different "tab", it just opens that section pre-expanded.
  const deepLinkedSection = searchParams.get('tab');

  const [expandedSections, setExpandedSections] = useState({
    titles: deepLinkedSection === 'dossier',
    analytics: deepLinkedSection === 'analytics',
    calibration: deepLinkedSection === 'calibration',
    testLabs: false,
  });
  const toggleSection = (section: keyof typeof expandedSections) => {
    systemSound.playClick();
    setExpandedSections((prev) => ({ ...prev, [section]: !prev[section] }));
  };
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [attempts, setAttempts] = useState<QuestAttempt[]>([]);
  const [protocolConfig, setProtocolConfig] = useState<HunterProtocolConfig>(() => getHunterProtocolConfig());
  const [calibrationModalOpen, setCalibrationModalOpen] = useState(false);
  const [biometricsModalOpen, setBiometricsModalOpen] = useState(false);
  const [apiKeyModalOpen, setApiKeyModalOpen] = useState(false);
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

  // Every title used to be freely equippable regardless of the stated requirement — a Level 1
  // Hunter could click into "Supreme Sovereign" (S-Rank). Each title now carries a real,
  // checkable unlock condition: at minimum the declared Rank threshold, and for the titles
  // whose description names an actual tracked mechanic, that specific condition too. The
  // definitions themselves (and their equipped effects) live in titles.ts so storage.ts and
  // gates.ts can also read the effects without importing this page.
  const hunterRankIndex = RANK_ORDER.indexOf(rank);
  const currentVitals = getHunterVitals(profile);
  const hpPct = currentVitals.hp.max > 0 ? (currentVitals.hp.current / currentVitals.hp.max) * 100 : 0;
  const overdriveCompletions = getAchievementStats().overdriveCompletions || 0;
  const clearedGatesCount = getGates().filter((g) => g.status === 'cleared').length;
  const titleUnlockContext: TitleUnlockContext = { hunterRankIndex, hpPct, overdriveCompletions, clearedGatesCount };

  const titlesAvailable = TITLE_DEFINITIONS.map((t) => ({ ...t, isUnlocked: t.isUnlocked(titleUnlockContext) }));

  // Internal testing/prototyping pages — not part of the real product, kept around for
  // building out new mechanics. Gated behind level 100 so only a dev/test account sees
  // this; ordinary players never encounter it. (Relocated here from the "DUNGEONS" tab,
  // which now shows real player-created Gates.)
  const testLabs = [
    {
      title: 'Physical Conditioning Gate',
      desc: 'High-gravity kinetic resistance zone for push-ups, squats, and running.',
      path: '/physical-lab',
      rank: 'E-Rank',
      icon: Dumbbell,
    },
    {
      title: 'Cognitive Trial Chamber',
      desc: 'Stroop color clashes, working memory, and mental calculation drills.',
      path: '/mental-lab',
      rank: 'D-Rank',
      icon: Brain,
    },
    {
      title: 'Social Simulation Vault',
      desc: 'Interpersonal diplomacy, negotiation drills, and communication scenarios.',
      path: '/social-lab',
      rank: 'D-Rank',
      icon: Users,
    },
    {
      title: 'Knowledge & Concept Vault',
      desc: 'Domain mastery challenges across sciences, philosophy, and history.',
      path: '/knowledge-lab',
      rank: 'C-Rank',
      icon: TestTube,
    },
    {
      title: 'Strategic Chess Dungeon',
      desc: 'Grandmaster tactical endgames and spatial positional analysis.',
      path: '/chess-lab',
      rank: 'C-Rank',
      icon: Crown,
    },
    {
      title: 'Skill Tree Matrix (Kinnu Forge)',
      desc: 'Structured learning trees with spaced repetition mastery paths.',
      path: '/kinnu-lab',
      rank: 'D-Rank',
      icon: TestTube,
    },
    {
      title: 'Skill Forge Arena',
      desc: 'Custom skill crafting, technique mastery, and ability synthesis.',
      path: '/skill-forge',
      rank: 'B-Rank',
      icon: Target,
    },
  ];

  const handleSelectTitle = (tName: string, isUnlocked: boolean, requirement?: string) => {
    if (!isUnlocked) {
      systemSound.playPenaltyWarning();
      toast.error('TITLE NOT YET EARNED', {
        description: requirement || 'This designation has not been unlocked.',
      });
      return;
    }
    systemSound.playClick();
    const updated: UserProfile = {
      ...profile,
      title: tName,
    };
    saveUserProfile(updated);
    setProfile(updated);
  };

  const recentAttempts = attempts.slice(-5).reverse();

  return (
    <div className="min-h-screen pt-6 pb-28 sm:pb-36 bg-[#071322] text-[#e5ecf4] flex flex-col system-blueprint-bg font-mono">
      <main className="max-w-[720px] mx-auto w-full px-3 sm:px-6 py-6 sm:py-10 flex-1 space-y-5 overflow-x-hidden">
        {/* Top Header Card in anime window style */}
        <div className="relative bg-[#0a1b2e]/90 border-2 border-white/50 rounded-[4px] p-5 sm:p-8 text-center text-white shadow-[0_0_30px_rgba(0,0,0,0.85),inset_0_0_24px_rgba(0,212,255,0.08)] backdrop-blur-md anime-dropdown">
          <div className="inline-block px-6 sm:px-8 py-1 border border-white/70 bg-[#061426]/60 shadow-[0_0_14px_rgba(0,212,255,0.35)] mb-2">
            <h1 className="text-sm sm:text-base font-mono font-extrabold text-white anime-glow-text tracking-[0.15em] flex items-center justify-center gap-2">
              <Crown className="w-4 h-4 text-[#9fd3ff]" />
              HUNTER DOSSIER & COMBAT ANALYTICS
              <Sparkles className="w-4 h-4 text-[#9fd3ff]" />
            </h1>
          </div>
          <p className="text-[10px] font-mono text-white/50 mt-2.5">
            [ Awakened Credentials, Job Titles, Attribute Matrix & Performance Diagnostics ]
          </p>
        </div>

        {/* ============================================================ */}
        {/* DOSSIER SECTION: Registration License — always visible, the "glanceable" identity
            card. Titles/Analytics/Calibration are collapsed accordions below instead of tabs
            that used to render everything at once. */}
        {/* ============================================================ */}
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

            {/* AI System Access Key */}
            <div className="mt-3.5 pt-3.5 border-t border-white/20">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="text-[10px] text-[#9fd3ff] tracking-wider uppercase font-bold flex items-center gap-1.5">
                  <KeyRound className="w-3.5 h-3.5 text-cyan-400" />
                  <span>AI SYSTEM ACCESS KEY</span>
                  <span className="text-[10px] font-normal text-white/40 lowercase">
                    ({profile?.geminiApiKey ? 'personal key bound' : 'using shared system key'})
                  </span>
                </div>
                <button
                  onClick={() => {
                    systemSound.playClick();
                    setApiKeyModalOpen(true);
                  }}
                  className="text-[10px] text-cyan-300 hover:text-white border border-cyan-400/50 hover:border-cyan-300 bg-cyan-950/40 px-2 py-0.5 rounded-[2px] transition-all"
                >
                  [ CONFIGURE KEY ]
                </button>
              </div>
            </div>
          </div>

        {/* ============================================================ */}
        {/* HUNTER TITLES & DESIGNATIONS — collapsed accordion, not always-rendered tab content */}
        {/* ============================================================ */}
        <div className="border border-white/40 bg-[#061424]/80 rounded-[2px] overflow-hidden shadow-[inset_0_0_14px_rgba(0,212,255,0.06)]">
          <button
            onClick={() => toggleSection('titles')}
            className="w-full flex items-center justify-between p-3 sm:p-3.5 bg-white/5 hover:bg-white/10 transition-colors text-left"
          >
            <div className="flex items-center gap-2.5">
              <Crown className="w-4 h-4 text-[#9fd3ff]" />
              <span className="font-bold text-white text-xs sm:text-sm tracking-wider">
                Hunter Titles & Designations
              </span>
            </div>
            {expandedSections.titles ? (
              <ChevronUp className="w-3.5 h-3.5 text-white/50" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5 text-white/50" />
            )}
          </button>

          {expandedSections.titles && (
            <div className="p-3 sm:p-4 border-t border-white/20 bg-[#05101d]/90 space-y-4">
              <div className="flex justify-end -mt-1">
                <span className="text-[10px] font-mono text-gray-400">CLICK TO EQUIP</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 font-mono">
                {titlesAvailable.map((t) => {
                  const isEquipped = title === t.name;
                  return (
                    <div
                      key={t.name}
                      onClick={() => handleSelectTitle(t.name, t.isUnlocked, t.requirement)}
                      className={`p-3 border rounded-[2px] transition-all ${
                        !t.isUnlocked
                          ? 'border-white/10 bg-black/30 text-gray-500 opacity-60 cursor-not-allowed'
                          : isEquipped
                            ? 'border-white bg-white/15 text-white shadow-[0_0_12px_rgba(0,212,255,0.25)] cursor-pointer'
                            : 'border-white/25 bg-[#061424]/75 text-gray-300 hover:border-white/70 hover:bg-white/5 cursor-pointer'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1 gap-2">
                        <span className={`font-bold text-xs truncate flex items-center gap-1.5 ${t.isUnlocked ? 'text-white' : 'text-gray-400'}`}>
                          {!t.isUnlocked && <Lock className="w-3 h-3 shrink-0" />}
                          {t.name}
                        </span>
                        <span className={`text-[10px] border px-1 bg-black/40 shrink-0 ${t.isUnlocked ? 'border-white/40 text-[#9fd3ff]' : 'border-white/20 text-gray-500'}`}>
                          {t.rank}-RANK
                        </span>
                      </div>
                      <p className="text-[11px] text-gray-400 line-clamp-2">{t.desc}</p>
                      <p className={`text-[10px] mt-1 flex items-center gap-1 ${t.isUnlocked ? 'text-cyan-300/80' : 'text-gray-500'}`}>
                        <Zap className="w-2.5 h-2.5 shrink-0" />
                        <span className="line-clamp-1">{t.effectDescription}</span>
                      </p>
                      {!t.isUnlocked && (
                        <p className="text-[10px] text-rose-400/70 mt-1">[ {t.requirement} ]</p>
                      )}
                    </div>
                  );
                })}
              </div>

              {(profile.unlockedTitles || []).length > 0 && (
                <div className="pt-3 border-t border-white/10 space-y-2.5">
                  <div className="text-[10px] font-mono text-[#9fd3ff]/80 tracking-wider">
                    [ EARNED DESIGNATIONS ]
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 font-mono">
                    {(profile.unlockedTitles || []).map((tName) => {
                      const isEquipped = title === tName;
                      // Gate-earned titles are always "<Gate title> <rank suffix>" where the
                      // suffix is one of these six fixed words (see TITLE_SUFFIX_BY_RANK in
                      // gates.ts) — anything else earned into this array (e.g. "The Unshackled"
                      // from Seals) won't end with one of them.
                      const isGateTitle = ['Initiate', 'Breaker', 'Conqueror', 'Vanquisher', 'Sovereign', 'Transcendent'].some(
                        (suffix) => tName.endsWith(` ${suffix}`)
                      );
                      return (
                        <div
                          key={tName}
                          onClick={() => handleSelectTitle(tName, true)}
                          className={`p-3 border rounded-[2px] cursor-pointer transition-all ${
                            isEquipped
                              ? 'border-emerald-400 bg-emerald-950/30 text-white shadow-[0_0_12px_rgba(52,211,153,0.25)]'
                              : 'border-emerald-500/25 bg-[#061424]/75 text-gray-300 hover:border-emerald-400/60 hover:bg-white/5'
                          }`}
                        >
                          <div className="flex items-center justify-between mb-1 gap-2">
                            <span className="font-bold text-xs text-white truncate">{tName}</span>
                            <span className="text-[10px] border border-emerald-500/40 px-1 text-emerald-300 bg-black/40 shrink-0">
                              {isGateTitle ? 'GATE' : 'SEAL'}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>


        {/* ============================================================ */}
        {/* COMBAT ANALYTICS — collapsed accordion containing stat bar, radar/pie, and both
            trend charts. Previously three separate always-tab-rendered blocks; merged into
            one expandable section so the default view stays short. */}
        {/* ============================================================ */}
        <div className="border border-white/40 bg-[#061424]/80 rounded-[2px] overflow-hidden shadow-[inset_0_0_14px_rgba(0,212,255,0.06)]">
          <button
            onClick={() => toggleSection('analytics')}
            className="w-full flex items-center justify-between p-3 sm:p-3.5 bg-white/5 hover:bg-white/10 transition-colors text-left"
          >
            <div className="flex items-center gap-2.5">
              <BarChart3 className="w-4 h-4 text-[#9fd3ff]" />
              <span className="font-bold text-white text-xs sm:text-sm tracking-wider">
                Combat Analytics
              </span>
            </div>
            {expandedSections.analytics ? (
              <ChevronUp className="w-3.5 h-3.5 text-white/50" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5 text-white/50" />
            )}
          </button>

          {expandedSections.analytics && (
          <div className="p-3 sm:p-4 border-t border-white/20 bg-[#05101d]/90 space-y-4">
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
                className="border border-white/20 bg-[#061424]/70 rounded-[2px] p-3 sm:p-4 text-white"
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

          {/* Radar Chart & Outcomes Pie */}
          <ErrorBoundary fallbackMessage="Unable to render attribute matrix diagnostics. System state is intact.">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6 anime-dropdown">
              {/* Attribute Radar */}
              <div className="bg-[#061424]/50 border border-white/20 rounded-[4px] p-4 sm:p-6 text-white">
                <h3 className="font-mono font-bold text-sm mb-4 flex items-center gap-2 text-white anime-glow-text">
                  <Brain className="h-4 w-4 text-[#9fd3ff]" /> [ ATTRIBUTE PROFILE MATRIX ]
                </h3>
                <div className="w-full min-w-0">
                  <AttributeRadarChart attributes={profile.visibleStats} />
                </div>
              </div>

              {/* Outcome Breakdown */}
              <div className="bg-[#061424]/50 border border-white/20 rounded-[4px] p-4 sm:p-6 text-white">
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

          {/* EXP Trajectory & Weekly Frequency */}
          <ErrorBoundary fallbackMessage="Unable to render combat activity charts. System log records remain safe.">
            {/* XP Progress Over Time */}
            <div className="bg-[#061424]/50 border border-white/20 rounded-[4px] p-4 sm:p-6 text-white anime-dropdown">
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
            <div className="bg-[#061424]/50 border border-white/20 rounded-[4px] p-4 sm:p-6 text-white anime-dropdown">
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
              <div className="bg-[#061424]/50 border border-white/20 rounded-[4px] p-4 sm:p-6 text-white">
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

              <div className="bg-[#061424]/50 border border-white/20 rounded-[4px] p-4 sm:p-6 text-white">
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
          </div>
          )}
        </div>

        {/* ============================================================ */}
        {/* PROTOCOL CALIBRATION — collapsed accordion */}
        {/* ============================================================ */}
        {(() => {
          const activeProtocolConfig = protocolConfig || getHunterProtocolConfig();
          const isCustom = activeProtocolConfig.physicalPath === 'custom';

          return (
            <div className="border border-white/40 bg-[#061424]/80 rounded-[2px] overflow-hidden shadow-[inset_0_0_14px_rgba(0,212,255,0.06)] font-mono">
              <button
                onClick={() => toggleSection('calibration')}
                className="w-full flex items-center justify-between p-3 sm:p-3.5 bg-white/5 hover:bg-white/10 transition-colors text-left"
              >
                <div className="flex items-center gap-2.5">
                  <SlidersHorizontal className="w-4 h-4 text-[#9fd3ff]" />
                  <span className="font-bold text-white text-xs sm:text-sm tracking-wider">
                    Protocol Calibration
                  </span>
                </div>
                {expandedSections.calibration ? (
                  <ChevronUp className="w-3.5 h-3.5 text-white/50" />
                ) : (
                  <ChevronDown className="w-3.5 h-3.5 text-white/50" />
                )}
              </button>

              {expandedSections.calibration && (
            <div className="p-3 sm:p-4 border-t border-white/20 bg-[#05101d]/90 font-mono">
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
                  className="px-3 py-1.5 border border-white/30 bg-[#061424]/80 hover:bg-white/10 hover:border-white/60 text-gray-300 hover:text-white rounded-[2px] text-xs transition-colors flex items-center gap-1.5"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>[ RESET TO SYSTEM DEFAULT ]</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    systemSound.playClick();
                    setCalibrationModalOpen(true);
                  }}
                  className="px-4 py-2 border-2 border-cyan-400 bg-cyan-950/80 hover:bg-cyan-900 text-cyan-300 hover:text-white font-bold transition-all rounded-[2px] text-xs shadow-[0_0_14px_rgba(0,212,255,0.4)] flex items-center gap-2"
                >
                  <SlidersHorizontal className="w-4 h-4" />
                  <span>[ CALIBRATE PROTOCOL & GYM ROUTINE ]</span>
                </button>
              </div>
            </div>
              )}
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

        {/* AI System Access Key Modal */}
        {profile && (
          <GeminiApiKeyModal
            isOpen={apiKeyModalOpen}
            onClose={() => setApiKeyModalOpen(false)}
            profile={profile}
            onSaved={(updated) => {
              setProfile(updated);
            }}
          />
        )}

        {/* ============================================================ */}
        {/* DEV: TEST LABS (level 100+ only — not part of the real product) */}
        {/* ============================================================ */}
        {(profile?.level ?? 1) >= 100 && (
          <div className="border border-amber-500/40 bg-[#061426]/60 rounded-[2px] overflow-hidden shadow-[inset_0_0_14px_rgba(245,158,11,0.06)]">
            <button
              onClick={() => toggleSection('testLabs')}
              className="w-full flex items-center justify-between p-3 sm:p-3.5 bg-amber-500/5 hover:bg-amber-500/10 transition-colors text-left"
            >
              <div className="flex items-center gap-2.5">
                <TestTube className="w-4 h-4 text-amber-300" />
                <span className="font-bold text-amber-300 text-xs sm:text-sm tracking-wider">
                  [ DEV: TEST LABS ]
                </span>
              </div>
              {expandedSections.testLabs ? (
                <ChevronUp className="w-3.5 h-3.5 text-amber-300/60" />
              ) : (
                <ChevronDown className="w-3.5 h-3.5 text-amber-300/60" />
              )}
            </button>

            {expandedSections.testLabs && (
              <div className="p-3 sm:p-4 border-t border-amber-500/20 bg-[#050d18]/90">
                <p className="text-[10px] font-mono text-white/50 mb-3">
                  Internal prototyping pages — not visible to players below Level 100.
                </p>
                <div className="flex flex-col divide-y divide-white/10 border border-white/20 rounded-[2px]">
                  {testLabs.map((lab, idx) => {
                    const Icon = lab.icon;
                    return (
                      <button
                        key={idx}
                        onClick={() => {
                          systemSound.playClick();
                          navigate(lab.path);
                        }}
                        className="flex items-center gap-3 px-3 py-2.5 text-left bg-[#061424]/60 hover:bg-white/10 transition-all group"
                      >
                        <Icon className="w-4 h-4 text-amber-300/80 shrink-0" />
                        <span className="flex-1 min-w-0 truncate text-xs font-semibold text-white group-hover:text-amber-200">
                          {lab.title}
                        </span>
                        <span className="text-[9px] px-1.5 py-0.5 border border-white/30 text-white/70 bg-black/50 shrink-0">
                          {lab.rank}
                        </span>
                        <ChevronRight className="w-3.5 h-3.5 text-amber-300/70 shrink-0 group-hover:translate-x-1 transition-transform" />
                      </button>
                    );
                  })}
                </div>

                {/* Phase 1 manual trigger for THEIA chain-Gates — no autonomy/generation yet
                    (that's Phase 2). Hardcoded 5-day test content purely to hand-verify the
                    sprint-mode date math (isSprintMode in chain-gates.ts) before anything else
                    builds on top of it. Remove once Phase 2 ships real autonomous spawning. */}
                <button
                  onClick={() => {
                    systemSound.playClick();
                    const gate = createChainGate({
                      title: 'THEIA Directive: Cold Exposure Basics',
                      description: 'A short THEIA-assigned directive — test data for chain-Gate sprint-mode verification.',
                      bossCondition: 'Complete all 5 days of cold exposure practice.',
                      rank: 'E',
                      primaryAttribute: 'VIT',
                      chainCategory: 'habit',
                      chainId: crypto.randomUUID(),
                      chainIndex: 1,
                      dayLabels: ['Day 1: Cold shower basics', 'Day 2: Extend duration', 'Day 3: Breathing technique', 'Day 4: Full routine', 'Day 5: Reflection'],
                    });
                    toast.success('Test chain-Gate created.', { description: `Deadline: ${new Date(gate.targetDate).toLocaleDateString()}` });
                    navigate(`/gates/${gate.id}`);
                  }}
                  className="mt-2 w-full flex items-center justify-center gap-2 px-3 py-2.5 border border-amber-500/40 bg-amber-950/20 hover:bg-amber-900/30 text-amber-300 text-xs font-semibold transition-all"
                >
                  <TestTube className="w-4 h-4" />
                  [ CREATE TEST CHAIN-GATE ]
                </button>

                {/* Temporary, for visually testing the Skill Tree (SkillTreePanel.tsx) without
                    waiting real days for chain-Gates to actually populate it. Calls the exact
                    same addSkillLedgerEntry used by real clears (chain-gates.ts's
                    clearChainGate, gates.ts's clearGate) — purely additive to the Ledger, never
                    touches Gates/profile/chain state, so it can't desync anything real. Remove
                    this button (and its import above) once done testing. */}
                <button
                  onClick={() => {
                    systemSound.playClick();
                    // Purge any earlier test-seed run first — this button is otherwise purely
                    // additive, so clicking it more than once (easy to do by accident) doubled
                    // up every entry it had already added.
                    saveSkillLedger(getSkillLedger().filter((s) => s.taughtByChainGateId !== 'test-seed'));
                    const seed = (name: string, category: 'skill' | 'subject' | 'habit' | 'technique', parentIds: string[], proficiency: number, description: string) =>
                      addSkillLedgerEntry({
                        name,
                        category,
                        parentIds,
                        taughtByChainGateId: 'test-seed',
                        taughtByChainId: 'test-seed-chain',
                        proficiency,
                        description,
                      });

                    // SKILL — two independent grinds: strength conditioning, bushcraft.
                    const grip = seed('Grip Strength Fundamentals', 'skill', [], 65, 'Trained sustained hand and forearm tension under load — the base every heavier carry or pull draws from.');
                    const carries = seed('Weighted Carries', 'skill', [grip.id], 40, 'Loaded transport under time and distance — grip, core, and gait tested simultaneously.');
                    seed("Farmer's Walk Endurance", 'skill', [carries.id], 20, "Extended loaded carries pushed past the point grip normally fails.");
                    const knife = seed('Basic Knife Skills', 'skill', [], 60, 'Safe handling, grip, and control fundamentals for a fixed blade.');
                    seed('Knife Sharpening Technique', 'skill', [knife.id], 35, 'Restoring and maintaining a working edge by hand, without power tools.');
                    const fire = seed('Fire-Starting Basics', 'skill', [], 70, 'Reliable ignition without a lighter — friction, ferro rod, and tinder discipline.');
                    const shelter = seed('Bushcraft Shelter Building', 'skill', [fire.id], 45, "Reading terrain and materials to build weatherproof cover from what's on hand.");
                    seed('Advanced Bushcraft Navigation', 'skill', [shelter.id], 15, 'Route-finding without GPS, using terrain association and dead reckoning.');

                    // SUBJECT — finance, programming, language.
                    const finance = seed('Personal Finance Basics', 'subject', [], 90, 'Budgeting, saving, and debt fundamentals — the floor every later financial decision stands on.');
                    const investing = seed('Investing Fundamentals', 'subject', [finance.id], 30, 'Core principles of index investing, compounding, and risk tolerance.');
                    seed('Tax Optimization Strategies', 'subject', [investing.id], 10, 'Legal structuring of income and accounts to reduce unnecessary tax drag.');
                    const programming = seed('Basic Programming Logic', 'subject', [], 55, 'Variables, conditionals, and loops — the reasoning underneath any language.');
                    const python = seed('Python Scripting Fundamentals', 'subject', [programming.id], 30, 'Writing small working scripts in Python to automate real tasks.');
                    seed('Data Structures Foundations', 'subject', [python.id], 15, 'Lists, dictionaries, and the tradeoffs behind choosing one over another.');
                    const spanish = seed('Conversational Spanish Basics', 'subject', [], 50, 'Enough vocabulary and grammar to hold a slow, real conversation.');
                    seed('Spanish Intermediate Grammar', 'subject', [spanish.id], 20, 'Verb conjugation and sentence structure beyond the present tense.');

                    // HABIT — cold exposure, sleep, journaling, digital hygiene.
                    const cold = seed('Cold Exposure Tolerance', 'habit', [], 80, 'Deliberate short cold exposure to build tolerance and stress regulation.');
                    const extendedCold = seed('Extended Cold Exposure', 'habit', [cold.id], 55, 'Longer, colder sessions building on baseline tolerance.');
                    seed('Daily Cold Plunge Routine', 'habit', [extendedCold.id], 30, 'A fixed daily cold exposure ritual, no longer occasional.');
                    const sleep = seed('Consistent Sleep Schedule', 'habit', [], 75, 'A fixed sleep and wake window held regardless of the day.');
                    seed('Early Wake Discipline', 'habit', [sleep.id], 40, 'Waking at a set early hour without relying on willpower alone.');
                    const journaling = seed('Daily Journaling Habit', 'habit', [], 65, 'A short daily written record — the raw material for real reflection.');
                    seed('Weekly Reflection Practice', 'habit', [journaling.id], 35, "Reviewing a week's journal entries for patterns worth acting on.");
                    seed('Digital Minimalism Routine', 'habit', [], 20, 'Deliberate limits on phone and app use to protect attention.');

                    // TECHNIQUE — social/mental control, deliberately branching into other
                    // categories twice (Public Speaking, Cold-Water Breath) to demo the
                    // cross-discipline "also from" tag on a chip that isn't a drawn line.
                    const listening = seed('Active Listening', 'technique', [], 70, 'Fully attending to another person before formulating a response.');
                    const conflict = seed('Conflict De-escalation', 'technique', [listening.id], 45, 'Lowering tension in a disagreement before it becomes a fight.');
                    const publicSpeaking = seed('Public Speaking Under Pressure', 'technique', [conflict.id, investing.id], 25, 'Holding structure and composure while addressing a group live.');
                    const negotiation = seed('Negotiation Tactics', 'technique', [publicSpeaking.id], 10, 'Structuring a conversation so both sides can agree without either losing face.');
                    seed('Emotional Regulation Under Fatigue', 'technique', [negotiation.id], 5, 'Keeping composure and judgment intact when running on empty.');
                    const breath = seed('Breath Control Under Stress', 'technique', [], 60, "Using breath to regulate the nervous system's stress response.");
                    const boxBreathing = seed('Tactical Box Breathing', 'technique', [breath.id], 35, 'A structured 4-4-4-4 breath pattern used to reset under acute pressure.');
                    seed('Cold-Water Breath Discipline', 'technique', [boxBreathing.id, cold.id], 15, "Controlling the breath's panic reflex on cold water immersion.");

                    toast.success('32 test skills seeded.', { description: 'Check Skill Tree — remove this button when done testing.' });
                  }}
                  className="mt-2 w-full flex items-center justify-center gap-2 px-3 py-2.5 border border-amber-500/40 bg-amber-950/20 hover:bg-amber-900/30 text-amber-300 text-xs font-semibold transition-all"
                >
                  <TestTube className="w-4 h-4" />
                  [ SEED 32 TEST SKILLS (GRIND SIM) ]
                </button>

                {/* Isolated OpenRouter-only round trip (see api/ai.ts's providerOverride:
                    "openrouter" branch) — bypasses Gemini entirely, so this exercises the
                    fallback provider on demand instead of waiting for Gemini to actually run
                    out of quota. Purely additive/read-only: doesn't touch Gates, profile, or
                    the Skill Ledger. Remove this button (and the isolated server branch it
                    calls) once OpenRouter's wired-in behavior is confirmed working. */}
                <button
                  onClick={async () => {
                    systemSound.playClick();
                    try {
                      // openrouter/free is OpenRouter's own RANDOM free-model router (a
                      // different, unpredictable model per request) — 50 tokens was too tight
                      // for some of what it can pick and got truncated mid-response. Real lab
                      // fallback calls already use a much bigger default (8192, via
                      // OPENAI_COMPAT_MAX_TOKENS) and don't hit this; 300 here is just enough
                      // headroom for this trivial test prompt regardless of which model answers.
                      const res = await aiGatewayClient.completeJson<{ message?: string }>(
                        'Return ONLY this JSON, nothing else: {"message": "OpenRouter round trip OK"}',
                        { providerOverride: 'openrouter', temperature: 0, maxTokens: 300, skipCache: true }
                      );
                      toast.success('OPENROUTER TEST OK', {
                        description: res?.message || 'Response received but had no message field — check console.',
                      });
                    } catch (error) {
                      toast.error('OPENROUTER TEST FAILED', { description: String(error) });
                    }
                  }}
                  className="mt-2 w-full flex items-center justify-center gap-2 px-3 py-2.5 border border-amber-500/40 bg-amber-950/20 hover:bg-amber-900/30 text-amber-300 text-xs font-semibold transition-all"
                >
                  <TestTube className="w-4 h-4" />
                  [ TEST OPENROUTER (BYPASSES GEMINI) ]
                </button>
              </div>
            )}
          </div>
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
