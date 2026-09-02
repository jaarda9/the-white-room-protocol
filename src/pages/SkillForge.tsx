import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getUserProfile, saveUserProfile, addXP } from '@/lib/storage';
import aiGatewayClient from '@/lib/ai-gateway-client';
import { toast } from 'sonner';
import { ArrowLeft, Plus, CheckCircle2, Lock, Sparkles, Loader2, Target } from 'lucide-react';
import { SoloLevelingHeader } from '@/components/SoloLevelingHeader';
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
    <div className="min-h-screen bg-[#070d18] text-[#e5ecf4] flex flex-col">
      <SoloLevelingHeader />

      <main className="max-w-4xl mx-auto w-full px-4 py-8 flex-1 space-y-6">
        <div className="flex items-center justify-between">
          <button
            onClick={() => {
              systemSound.playClick();
              if (view !== 'list') {
                setView('list');
                setActivePlan(null);
              } else {
                navigate('/');
              }
            }}
            className="flex items-center gap-2 text-xs font-mono text-gray-400 hover:text-cyan-300 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>[ {view !== 'list' ? 'RETURN TO MATRIX LIST' : 'RETURN TO COMMAND'} ]</span>
          </button>
        </div>

        {/* LIST VIEW */}
        {view === 'list' && (
          <div className="space-y-6">
            <div className="anime-window p-6 text-center">
              <h1 className="text-xl sm:text-2xl font-display font-bold text-white anime-glow-text">
                SKILL FORGE & EVOLUTION MATRIX
              </h1>
              <p className="text-xs font-mono text-gray-400 mt-1">
                Synthesize custom discipline tracks and progressive tactical development protocols.
              </p>
            </div>

            <button
              onClick={() => {
                systemSound.playClick();
                setView('create');
              }}
              className="w-full py-3.5 border border-cyan-400 bg-cyan-400/20 text-cyan-300 font-mono text-xs font-bold hover:bg-cyan-400 hover:text-black transition-all flex items-center justify-center gap-2 shadow-[0_0_15px_rgba(82,210,246,0.2)]"
            >
              <Plus className="w-4 h-4" />
              <span>FORGE NEW SKILL TREE</span>
            </button>

            {plans.length === 0 ? (
              <div className="anime-window p-8 text-center text-xs font-mono text-gray-500">
                No active skill matrices logged. Create one above to initialize.
              </div>
            ) : (
              <div className="space-y-3 font-mono">
                {plans.map((p) => (
                  <div
                    key={p.id}
                    onClick={() => openPlan(p)}
                    className="anime-window p-4 cursor-pointer hover:border-cyan-400 transition-all flex items-center justify-between"
                  >
                    <div>
                      <h3 className="font-bold text-sm text-white">{p.subject}</h3>
                      <div className="text-[11px] text-gray-400 mt-0.5">
                        Target: {p.target_level} • {p.daily_time_minutes}m/day • {p.total_xp_earned} EXP Earned
                      </div>
                    </div>
                    <span className="text-[10px] border border-cyan-500/40 px-2 py-0.5 text-cyan-300">
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
          <div className="anime-window p-6 sm:p-8 space-y-5 font-mono text-xs">
            <h2 className="text-base font-display font-bold text-white anime-glow-text border-b border-cyan-500/20 pb-3">
              [ INITIALIZE SKILL FORGE PROTOCOL ]
            </h2>

            <div>
              <label className="text-gray-400 block mb-1">Target Skill or Discipline</label>
              <input
                type="text"
                placeholder="e.g. Python Backend Mastery, Advanced Chess Openings..."
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="w-full bg-black/50 border border-cyan-500/40 p-2.5 text-white outline-none focus:border-cyan-400 text-xs"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-gray-400 block mb-1">Daily Time (Minutes)</label>
                <input
                  type="number"
                  value={dailyTime}
                  onChange={(e) => setDailyTime(Number(e.target.value))}
                  className="w-full bg-black/50 border border-cyan-500/40 p-2.5 text-white outline-none focus:border-cyan-400 text-xs"
                />
              </div>
              <div>
                <label className="text-gray-400 block mb-1">Duration (Weeks)</label>
                <input
                  type="number"
                  value={durationWeeks}
                  onChange={(e) => setDurationWeeks(Number(e.target.value))}
                  className="w-full bg-black/50 border border-cyan-500/40 p-2.5 text-white outline-none focus:border-cyan-400 text-xs"
                />
              </div>
            </div>

            <button
              onClick={generatePlan}
              disabled={generating || !subject.trim()}
              className="w-full py-3 bg-cyan-400 text-black font-bold hover:bg-cyan-300 transition-colors disabled:opacity-40 flex items-center justify-center gap-2"
            >
              {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              <span>SYNTHESIZE SKILL MATRIX</span>
            </button>
          </div>
        )}

        {/* PLAN VIEW */}
        {view === 'plan' && activePlan && (
          <div className="space-y-6 font-mono text-xs">
            <div className="anime-window p-6 space-y-2">
              <div className="flex items-center justify-between border-b border-cyan-500/20 pb-3">
                <h2 className="text-lg font-display font-bold text-white anime-glow-text">
                  {activePlan.subject}
                </h2>
                <span className="text-[10px] border border-cyan-400 px-2 py-0.5 text-cyan-300">
                  DAY {activePlan.current_day} OF {activePlan.total_days}
                </span>
              </div>
              <p className="text-gray-400 text-[11px] pt-1">
                {activePlan.ai_plan?.planSummary || 'Follow the daily tactical operations below to complete skill synthesis.'}
              </p>
            </div>

            <div className="space-y-3">
              {tasks.map((task) => (
                <div
                  key={task.id}
                  className={`anime-window p-4 flex items-center justify-between gap-4 transition-all ${
                    task.is_completed
                      ? 'border-gray-800 bg-black/20 opacity-60'
                      : 'border-cyan-500/30 bg-black/40 hover:border-cyan-400'
                  }`}
                >
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[10px] border border-cyan-500/40 px-1.5 py-0.2 text-cyan-300">
                        DAY {task.day_number}
                      </span>
                      <span className="text-gray-400 text-[10px]">{task.duration_minutes}m</span>
                    </div>
                    <div className={`font-bold ${task.is_completed ? 'line-through text-gray-500' : 'text-white'}`}>
                      {task.title}
                    </div>
                    <div className="text-[11px] text-gray-400 mt-0.5">{task.description}</div>
                  </div>

                  <div>
                    {!task.is_completed ? (
                      <button
                        onClick={() => completeTask(task.id)}
                        disabled={completing === task.id}
                        className="px-3 py-1.5 border border-cyan-400 bg-cyan-400/20 text-cyan-300 hover:bg-cyan-400 hover:text-black font-bold whitespace-nowrap"
                      >
                        LOG COMPLETE
                      </button>
                    ) : (
                      <CheckCircle2 className="w-5 h-5 text-cyan-400" />
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
