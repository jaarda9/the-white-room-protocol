import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getUserProfile, saveUserProfile, addXP } from '@/lib/storage';
import aiGatewayClient from '@/lib/ai-gateway-client';
import { toast } from 'sonner';
import { ArrowLeft, Plus, CheckCircle2, Lock, Sparkles, Loader2, Target } from 'lucide-react';
import { systemSound } from '@/lib/system-sound';

type LearningPlan = {
  id: string;
  subject: string;
  target_level: string;
  daily_time_minutes: number;
  duration_weeks: number;
  motivation: string | null;
  status: string;
  ai_plan: any;
  total_xp_earned: number;
  current_day: number;
  total_days: number;
  created_at: string;
};

type LearningTask = {
  id: string;
  plan_id: string;
  day_number: number;
  title: string;
  description: string;
  task_type: string;
  duration_minutes: number;
  xp_reward: number;
  attribute_rewards: Record<string, number>;
  is_completed: boolean;
  is_unlocked: boolean;
  completed_at: string | null;
};

export default function SkillForge() {
  const navigate = useNavigate();
  const [view, setView] = useState<'list' | 'create' | 'plan'>('list');
  const [plans, setPlans] = useState<LearningPlan[]>([]);
  const [activePlan, setActivePlan] = useState<LearningPlan | null>(null);
  const [tasks, setTasks] = useState<LearningTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [completing, setCompleting] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

  // Form state
  const [subject, setSubject] = useState('');
  const [targetLevel, setTargetLevel] = useState('intermediate');
  const [dailyTime, setDailyTime] = useState(30);
  const [durationWeeks, setDurationWeeks] = useState(4);
  const [motivation, setMotivation] = useState('');

  useEffect(() => {
    const profile = getUserProfile();
    setUserId(profile.id);
    loadPlans(profile.id).catch(() => setLoading(false));
  }, []);

  const loadPlans = async (uid: string): Promise<LearningPlan[]> => {
    setLoading(true);
    try {
      const res = await fetch(`/api/skillforge-plans?userId=${encodeURIComponent(uid)}`);
      if (res.ok) {
        const data = await res.json();
        setPlans(data.plans || []);
        return data.plans || [];
      }
    } catch (e) {
      setPlans([]);
    } finally {
      setLoading(false);
    }
    return [];
  };

  const loadPlanTasks = async (planId: string) => {
    if (!userId) return;
    try {
      const res = await fetch(`/api/skillforge-tasks?userId=${encodeURIComponent(userId)}&planId=${encodeURIComponent(planId)}`);
      if (res.ok) {
        const data = await res.json();
        setTasks(data.tasks || []);
      }
    } catch (e) {
      setTasks([]);
    }
  };

  const openPlan = async (plan: LearningPlan) => {
    systemSound.playClick();
    setActivePlan(plan);
    await loadPlanTasks(plan.id);
    setView('plan');
  };

  const generatePlan = async () => {
    if (!subject.trim()) {
      toast.error('Specify a target skill domain');
      return;
    }

    setGenerating(true);
    try {
      if (!userId) return;
      systemSound.playClick();

      const systemPrompt = `You are the System, creating a tactical progression tree for a Hunter.
      Generate 14 tasks (7 days, exactly 2 tasks per day). Keep string outputs concise.
      Return JSON only: { "planSummary": string, "phases": [{"name": string, "days": string, "focus": string}], "tasks": [{"dayNumber": number, "title": string, "description": string, "taskType": "study"|"practice"|"review"|"project"|"assessment", "durationMinutes": number, "xpReward": number, "attributeRewards": {"INT": 1}}] }`;

      const planData = await aiGatewayClient.completeJson<any>(
        `${systemPrompt}\nSubject: ${subject.trim()}\nLevel: ${targetLevel}\nDaily: ${dailyTime}min\nWeeks: ${durationWeeks}\nMotivation: ${motivation}`,
        { temperature: 0.6, maxTokens: 2600 }
      );

      const res = await fetch('/api/skillforge-plans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          subject: subject.trim(),
          targetLevel,
          dailyTimeMinutes: dailyTime,
          durationWeeks,
          motivation: motivation.trim() || null,
          planData,
        }),
      });

      if (res.ok) {
        systemSound.playLevelUp();
        toast.success('Skill Forge Matrix forged successfully!');
        setSubject('');
        await loadPlans(userId);
        setView('list');
      }
    } catch (err: any) {
      toast.error('Matrix generation failed');
    } finally {
      setGenerating(false);
    }
  };

  const completeTask = async (taskId: string) => {
    setCompleting(taskId);
    try {
      if (!userId) return;
      systemSound.playClick();

      const res = await fetch('/api/skillforge-complete-learning-task', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, taskId }),
      });

      if (res.ok) {
        const data = await res.json();
        systemSound.playLevelUp();
        const profile = getUserProfile();
        const updated = addXP(profile, data.xpEarned || 20);
        saveUserProfile(updated);

        toast.success(`+${data.xpEarned || 20} XP Awarded!`);
        if (activePlan) {
          await loadPlanTasks(activePlan.id);
        }
      }
    } catch (e) {
      toast.error('Failed to log task');
    } finally {
      setCompleting(null);
    }
  };

  return (
    <div className="min-h-screen pb-24 bg-[#071322] text-[#e5ecf4] flex flex-col system-blueprint-bg font-mono">


      <main className="max-w-4xl mx-auto w-full px-4 py-8 flex-1 space-y-6">
        <div className="flex items-center justify-between">
          {view !== 'list' && (
            <button
              onClick={() => { systemSound.playClick(); setView('list'); setActivePlan(null); }}
              className="flex items-center gap-2 px-3 py-1.5 border border-white/50 bg-[#061426]/80 text-[#9fd3ff] text-xs font-mono hover:bg-white/10 hover:border-white transition-all shadow-[0_0_10px_rgba(0,212,255,0.2)]"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>[ RETURN TO MATRIX LIST ]</span>
            </button>
          )}
        </div>

        {/* LIST VIEW */}
        {view === 'list' && (
          <div className="space-y-6">
            <div className="relative bg-[#0a1b2e]/90 border-2 border-white/50 rounded-[4px] p-6 text-center text-white shadow-[0_0_30px_rgba(0,0,0,0.85),inset_0_0_24px_rgba(0,212,255,0.08)] backdrop-blur-md anime-dropdown">
              <div className="inline-block px-8 py-1 border border-white/70 bg-[#061426]/60 shadow-[0_0_14px_rgba(0,212,255,0.35)] mb-2">
                <h1 className="text-xl sm:text-2xl font-mono font-bold text-white anime-glow-text tracking-[0.2em]">
                  SKILL FORGE & EVOLUTION MATRIX
                </h1>
              </div>
              <p className="text-xs font-mono text-white/80 mt-1">
                Synthesize custom discipline tracks and progressive tactical development protocols.
              </p>
            </div>

            <button
              onClick={() => {
                systemSound.playClick();
                setView('create');
              }}
              className="w-full py-3.5 border border-white/60 bg-white/10 hover:bg-white/25 text-white font-mono text-xs font-bold transition-all flex items-center justify-center gap-2 shadow-[0_0_15px_rgba(0,212,255,0.2)] hover:border-white"
            >
              <Plus className="w-4 h-4 text-[#9fd3ff]" />
              <span>FORGE NEW SKILL TREE</span>
            </button>

            {plans.length === 0 ? (
              <div className="bg-[#0a1b2e]/85 border-2 border-white/40 rounded-[4px] p-8 text-center text-xs font-mono text-gray-400 shadow-[0_0_20px_rgba(0,0,0,0.7),inset_0_0_15px_rgba(0,212,255,0.05)] anime-dropdown">
                No active skill matrices logged. Create one above to initialize.
              </div>
            ) : (
              <div className="space-y-3 font-mono">
                {plans.map((p) => (
                  <div
                    key={p.id}
                    onClick={() => openPlan(p)}
                    className="bg-[#0a1b2e]/85 border-2 border-white/40 rounded-[4px] p-4 cursor-pointer hover:border-white/90 hover:bg-[#0a1b2e] transition-all flex items-center justify-between shadow-[0_0_20px_rgba(0,0,0,0.7),inset_0_0_15px_rgba(0,212,255,0.05)] anime-dropdown"
                  >
                    <div>
                      <h3 className="font-bold text-sm text-white">{p.subject}</h3>
                      <div className="text-[11px] text-gray-300 mt-0.5">
                        Target: {p.target_level} • {p.daily_time_minutes}m/day • <span className="text-emerald-400">+{p.total_xp_earned} EXP</span>
                      </div>
                    </div>
                    <span className="text-[10px] border border-white/40 px-2 py-0.5 text-[#9fd3ff] bg-black/40">
                      DAY {p.current_day}/{p.total_days}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* CREATE VIEW */}
        {view === 'create' && (
          <div className="relative bg-[#0a1b2e]/90 border-2 border-white/50 rounded-[4px] p-6 sm:p-8 space-y-5 font-mono text-xs text-white shadow-[0_0_30px_rgba(0,0,0,0.85),inset_0_0_24px_rgba(0,212,255,0.08)] backdrop-blur-md anime-dropdown">
            <h2 className="text-base font-mono font-bold text-white anime-glow-text border-b border-white/20 pb-3">
              [ INITIALIZE SKILL FORGE PROTOCOL ]
            </h2>

            <div>
              <label className="text-gray-300 block mb-1">Target Skill or Discipline</label>
              <input
                type="text"
                placeholder="e.g. Python Backend Mastery, Advanced Chess Openings..."
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="w-full bg-[#061424] border border-white/40 p-2.5 text-white outline-none focus:border-white text-xs rounded-[2px]"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-gray-300 block mb-1">Daily Time (Minutes)</label>
                <input
                  type="number"
                  value={dailyTime}
                  onChange={(e) => setDailyTime(Number(e.target.value))}
                  className="w-full bg-[#061424] border border-white/40 p-2.5 text-white outline-none focus:border-white text-xs rounded-[2px]"
                />
              </div>
              <div>
                <label className="text-gray-300 block mb-1">Duration (Weeks)</label>
                <input
                  type="number"
                  value={durationWeeks}
                  onChange={(e) => setDurationWeeks(Number(e.target.value))}
                  className="w-full bg-[#061424] border border-white/40 p-2.5 text-white outline-none focus:border-white text-xs rounded-[2px]"
                />
              </div>
            </div>

            <button
              onClick={generatePlan}
              disabled={generating || !subject.trim()}
              className="w-full py-3 border border-white/60 bg-white/10 hover:bg-white/25 text-white font-bold text-xs tracking-wider transition-all disabled:opacity-40 flex items-center justify-center gap-2 shadow-[0_0_15px_rgba(0,212,255,0.2)] hover:border-white"
            >
              {generating ? <Loader2 className="w-4 h-4 animate-spin text-[#9fd3ff]" /> : <Sparkles className="w-4 h-4 text-[#9fd3ff]" />}
              <span>SYNTHESIZE SKILL MATRIX</span>
            </button>
          </div>
        )}

        {/* PLAN VIEW */}
        {view === 'plan' && activePlan && (
          <div className="space-y-6 font-mono text-xs">
            <div className="relative bg-[#0a1b2e]/90 border-2 border-white/50 rounded-[4px] p-6 space-y-2 text-white shadow-[0_0_30px_rgba(0,0,0,0.85),inset_0_0_24px_rgba(0,212,255,0.08)] backdrop-blur-md anime-dropdown">
              <div className="flex items-center justify-between border-b border-white/20 pb-3">
                <h2 className="text-lg font-mono font-bold text-white anime-glow-text">
                  {activePlan.subject}
                </h2>
                <span className="text-[10px] border border-white/40 px-2 py-0.5 text-[#9fd3ff] bg-black/40">
                  DAY {activePlan.current_day} OF {activePlan.total_days}
                </span>
              </div>
              <p className="text-gray-300 text-[11px] pt-1">
                {activePlan.ai_plan?.planSummary || 'Follow the daily tactical operations below to complete skill synthesis.'}
              </p>
            </div>

            <div className="space-y-3">
              {tasks.map((task) => (
                <div
                  key={task.id}
                  className={`bg-[#0a1b2e]/85 border-2 rounded-[4px] p-4 flex items-center justify-between gap-4 transition-all shadow-[0_0_20px_rgba(0,0,0,0.7),inset_0_0_15px_rgba(0,212,255,0.05)] anime-dropdown ${
                    task.is_completed
                      ? 'border-gray-700/50 bg-[#061424]/40 opacity-60'
                      : 'border-white/40 bg-[#0a1b2e]/80 hover:border-white hover:bg-[#0a1b2e]'
                  }`}
                >
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[10px] border border-white/40 px-1.5 py-0.5 text-[#9fd3ff] bg-black/40">
                        DAY {task.day_number}
                      </span>
                      <span className="text-gray-300 text-[10px]">{task.duration_minutes}m</span>
                    </div>
                    <div className={`font-bold ${task.is_completed ? 'line-through text-gray-400' : 'text-white'}`}>
                      {task.title}
                    </div>
                    <div className="text-[11px] text-gray-300 mt-0.5">{task.description}</div>
                  </div>

                  <div>
                    {!task.is_completed ? (
                      <button
                        onClick={() => completeTask(task.id)}
                        disabled={completing === task.id}
                        className="px-3 py-1.5 border border-white/60 bg-white/10 text-white hover:bg-white/25 hover:border-white font-bold whitespace-nowrap text-xs shadow-[0_0_10px_rgba(0,212,255,0.2)]"
                      >
                        LOG COMPLETE
                      </button>
                    ) : (
                      <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
