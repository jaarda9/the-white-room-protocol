import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Slider } from '@/components/ui/slider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { getUserProfile, saveUserProfile, addXP } from '@/lib/storage';
import chatGPTService from '@/lib/chatgpt-service';
import { toast } from 'sonner';
import { ArrowLeft, BookOpen, Target, Clock, Trophy, Lock, CheckCircle2, Sparkles, Loader2, Plus, ChevronRight } from 'lucide-react';

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

type LovablePlanData = {
  planSummary: string;
  phases: Array<{
    name: string;
    days: string;
    focus: string;
  }>;
  tasks: Array<{
    dayNumber: number;
    title: string;
    description: string;
    taskType: string;
    durationMinutes: number;
    xpReward: number;
    attributeRewards: Record<string, number>;
  }>;
};

const TASK_TYPE_COLORS: Record<string, string> = {
  study: 'bg-info/10 text-info border-info/20',
  practice: 'bg-success/10 text-success border-success/20',
  review: 'bg-warning/10 text-warning border-warning/20',
  project: 'bg-primary/10 text-primary border-primary/20',
  assessment: 'bg-critical/10 text-critical border-critical/20',
};

const TASK_TYPE_LABELS: Record<string, string> = {
  study: '📖 Study',
  practice: '🔧 Practice',
  review: '🔄 Review',
  project: '🏗️ Project',
  assessment: '📝 Assessment',
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
  const [dailyTime, setDailyTime] = useState([30]);
  const [durationWeeks, setDurationWeeks] = useState([4]);
  const [motivation, setMotivation] = useState('');

  useEffect(() => {
    // SkillForge is keyed by your local `whiteroom_user_profile.id` (no extra auth DB).
    const profile = getUserProfile();
    setUserId(profile.id);
    loadPlans(profile.id).catch(() => setLoading(false));
  }, []);

  const loadPlans = async (uid: string): Promise<LearningPlan[]> => {
    setLoading(true);
    try {
      const res = await fetch(`/api/skillforge-plans?userId=${encodeURIComponent(uid)}`, {
        method: 'GET',
        headers: { 'Cache-Control': 'no-cache' },
      });

      if (!res.ok) {
        const json = await res.json().catch(() => null);
        if (json?.details || json?.error) {
          throw new Error(
            `Failed to load plans: ${res.status} ${res.statusText} - ${json.error || ''}${json.details ? ` (${json.details})` : ''}`
          );
        }
        const text = await res.text().catch(() => '');
        throw new Error(`Failed to load plans: ${res.status} ${res.statusText}${text ? ` - ${text}` : ''}`);
      }

      const data = await res.json();
      const list = (data?.plans as LearningPlan[] | undefined) ?? [];
      setPlans(list);
      return list;
    } catch (err: any) {
      console.error('Error loading plans:', err);
      toast.error(err?.message || 'Failed to load learning plans');
      setPlans([]);
      return [];
    } finally {
      setLoading(false);
    }
  };

  const loadPlanTasks = async (planId: string) => {
    if (!userId) return;
    try {
      const res = await fetch(
        `/api/skillforge-tasks?userId=${encodeURIComponent(userId)}&planId=${encodeURIComponent(planId)}`,
        { method: 'GET', headers: { 'Cache-Control': 'no-cache' } }
      );

      if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(`Failed to load tasks: ${res.status} ${res.statusText}${text ? ` - ${text}` : ''}`);
      }

      const data = await res.json();
      setTasks((data?.tasks as LearningTask[] | undefined) ?? []);
    } catch (err) {
      console.error('Error loading tasks:', err);
      setTasks([]);
    }
  };

  const openPlan = async (plan: LearningPlan) => {
    setActivePlan(plan);
    await loadPlanTasks(plan.id);
    setView('plan');
  };

  const generatePlan = async () => {
    if (!subject.trim()) {
      toast.error('Please enter a subject');
      return;
    }

    setGenerating(true);
    try {
      if (!userId) {
        toast.error('User profile not ready. Please refresh.');
        return;
      }

      // Lovable prompt shape (same structure as the original Supabase edge function),
      // but executed via your existing AI proxy (`/api/chatgpt`).
      const systemPrompt = `You are THE ARCHITECT, a master curriculum designer. You create precise, progressive learning plans adapted to the student's goals. Your plans are structured, measurable, and build skills progressively.
RULES:
- Generate tasks for the FIRST 7 DAYS only (the student will request more as they progress)
- Each day should have EXACTLY 2 tasks (total tasks = 14)
- Tasks must be concrete, actionable, and measurable
- Keep every string short:
  - task.title <= 45 characters
  - task.description <= 120 characters
- Progressive difficulty: each day builds on the previous
- Mix task types: study (theory), practice (hands-on), review (consolidation), project (application), assessment (self-test)
- XP rewards: 10-30 per task based on difficulty
- Attribute rewards: INT for intellectual subjects, STR/AGI for physical skills, PER for observation-based skills, WIS for wisdom/strategic skills
- Day 1 tasks should always be unlocked. Later days are locked until previous day is complete.
Return JSON only (no markdown, no trailing text).`;

      const totalDays = durationWeeks[0] * 7;
      const userPrompt = `Create a learning plan for:
- Subject: ${subject.trim()}
- Target Level: ${targetLevel}
- Daily Time: ${dailyTime[0]} minutes
- Total Duration: ${durationWeeks[0]} weeks (${totalDays} days)
- Motivation: ${motivation.trim() || 'Self-improvement'}

Return this exact JSON structure:
{
  "planSummary": "Brief description of the learning path",
  "phases": [
    { "name": "Phase name", "days": "1-7", "focus": "What this phase covers" }
  ],
  "tasks": [
    {
      "dayNumber": 1,
      "title": "Task title",
      "description": "Clear instructions on what to do",
      "taskType": "study|practice|review|project|assessment",
      "durationMinutes": 15,
      "xpReward": 15,
      "attributeRewards": { "INT": 1 }
    }
  ]
}`;

      const planData = await chatGPTService.callChatGPTJSON<LovablePlanData>(
        `${systemPrompt}\n\n${userPrompt}`,
        // 14 compact tasks need a higher ceiling; capped server-side by OPENAI_COMPAT_MAX_TOKENS.
        { temperature: 0.6, maxTokens: 1800 }
      );

      const res = await fetch('/api/skillforge-plans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          subject: subject.trim(),
          targetLevel,
          dailyTimeMinutes: dailyTime[0],
          durationWeeks: durationWeeks[0],
          motivation: motivation.trim() || null,
          planData,
        }),
      });

      if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(`Failed to create plan: ${res.status} ${res.statusText}${text ? ` - ${text}` : ''}`);
      }

      const data = await res.json();
      if (data?.error) throw new Error(data.error);

      toast.success('Learning plan created! Your journey begins.');
      setSubject('');
      setMotivation('');
      setTargetLevel('intermediate');
      setDailyTime([30]);
      setDurationWeeks([4]);

      await loadPlans(userId);
      if (data?.plan) {
        await openPlan(data.plan as LearningPlan);
      } else {
        setView('list');
      }
    } catch (err: any) {
      console.error('Plan generation error:', err);
      toast.error(err.message || 'Failed to generate learning plan');
    } finally {
      setGenerating(false);
    }
  };

  const completeTask = async (taskId: string) => {
    setCompleting(taskId);
    try {
      if (!userId) {
        toast.error('User profile not ready. Please refresh.');
        return;
      }

      const res = await fetch('/api/skillforge-complete-learning-task', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, taskId }),
      });

      if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(`Failed to complete task: ${res.status} ${res.statusText}${text ? ` - ${text}` : ''}`);
      }

      const data = await res.json();
      if (data?.error) throw new Error(data.error);

      // Apply XP and attributes locally
      const profile = getUserProfile();
      let updated = addXP(profile, data.xpEarned || 0);
      if (data.attributeRewards) {
        Object.entries(data.attributeRewards).forEach(([attr, val]) => {
          if (updated.accumulatedPoints[attr as keyof typeof updated.accumulatedPoints] !== undefined) {
            updated.accumulatedPoints[attr as keyof typeof updated.accumulatedPoints] += val as number;
          }
        });
      }
      saveUserProfile(updated);

      toast.success(`+${data.xpEarned} XP earned!`);

      if (data.planComplete) {
        toast.success(`🎉 Plan complete! Bonus +${data.bonusXp} XP awarded!`);
        const bonusProfile = addXP(getUserProfile(), data.bonusXp || 0);
        saveUserProfile(bonusProfile);
      }

      if (data.dayComplete) {
        toast.success('Day complete! Next day unlocked.');
      }

      // Reload tasks
      if (activePlan) {
        await loadPlanTasks(activePlan.id);
        // Reload plan data and update active plan from refreshed list
        const refreshedPlans = await loadPlans(userId);
        const refreshedPlan = refreshedPlans.find(p => p.id === activePlan.id);
        if (refreshedPlan) setActivePlan(refreshedPlan);
      }
    } catch (err: any) {
      console.error('Complete task error:', err);
      toast.error(err.message || 'Failed to complete task');
    } finally {
      setCompleting(null);
    }
  };

  // Group tasks by day
  const tasksByDay = tasks.reduce((acc, task) => {
    if (!acc[task.day_number]) acc[task.day_number] = [];
    acc[task.day_number].push(task);
    return acc;
  }, {} as Record<number, LearningTask[]>);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => {
            if (view === 'plan' || view === 'create') {
              setView('list');
              setActivePlan(null);
            } else {
              navigate('/');
            }
          }}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-foreground">SKILL FORGE</h1>
            <p className="text-xs text-muted-foreground tracking-widest uppercase">Adaptive Learning System</p>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        {/* ===== LIST VIEW ===== */}
        {view === 'list' && (
          <>
            <Button
              onClick={() => setView('create')}
              className="w-full h-14 text-base gap-2"
            >
              <Plus className="w-5 h-5" />
              Create New Learning Plan
            </Button>

            {plans.length === 0 ? (
              <Card className="border-dashed">
                <CardContent className="py-12 text-center">
                  <BookOpen className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-lg font-medium text-foreground mb-2">No Learning Plans Yet</h3>
                  <p className="text-sm text-muted-foreground">
                    Create your first plan and let the AI design a personalized learning path for you.
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {plans.map((plan) => {
                  const progress = plan.total_days > 0
                    ? Math.min(100, ((plan.current_day - 1) / plan.total_days) * 100)
                    : 0;
                  return (
                    <Card
                      key={plan.id}
                      className="cursor-pointer hover:border-primary/40 transition-colors"
                      onClick={() => openPlan(plan)}
                    >
                      <CardContent className="py-4">
                        <div className="flex items-start justify-between mb-2">
                          <div>
                            <h3 className="font-semibold text-foreground">{plan.subject}</h3>
                            <p className="text-xs text-muted-foreground">
                              Target: {plan.target_level} · {plan.daily_time_minutes}min/day · {plan.duration_weeks}w
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant={plan.status === 'active' ? 'default' : plan.status === 'completed' ? 'secondary' : 'outline'}>
                              {plan.status}
                            </Badge>
                            <ChevronRight className="w-4 h-4 text-muted-foreground" />
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <Progress value={progress} className="flex-1 h-2" />
                          <span className="text-xs text-muted-foreground font-mono">
                            Day {plan.current_day}/{plan.total_days}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 mt-2">
                          <Trophy className="w-3 h-3 text-warning" />
                          <span className="text-xs text-muted-foreground">{plan.total_xp_earned} XP earned</span>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </>
        )}

        {/* ===== CREATE VIEW ===== */}
        {view === 'create' && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="w-5 h-5" />
                Design Your Learning Path
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="subject" className="text-sm font-medium">
                  What do you want to learn?
                </Label>
                <Input
                  id="subject"
                  placeholder="e.g., Python programming, Boxing fundamentals, Geography of Europe..."
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  className="text-base"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-medium">Target Level</Label>
                <Select value={targetLevel} onValueChange={setTargetLevel}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="beginner">Beginner — Foundation knowledge</SelectItem>
                    <SelectItem value="intermediate">Intermediate — Working competency</SelectItem>
                    <SelectItem value="advanced">Advanced — Deep expertise</SelectItem>
                    <SelectItem value="expert">Expert — Mastery level</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-3">
                <Label className="text-sm font-medium">
                  Daily Time Commitment: <span className="text-primary font-bold">{dailyTime[0]} min</span>
                </Label>
                <Slider
                  value={dailyTime}
                  onValueChange={setDailyTime}
                  min={10}
                  max={180}
                  step={5}
                  className="w-full"
                />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>10 min</span>
                  <span>3 hours</span>
                </div>
              </div>

              <div className="space-y-3">
                <Label className="text-sm font-medium">
                  Plan Duration: <span className="text-primary font-bold">{durationWeeks[0]} week{durationWeeks[0] > 1 ? 's' : ''}</span>
                </Label>
                <Slider
                  value={durationWeeks}
                  onValueChange={setDurationWeeks}
                  min={1}
                  max={52}
                  step={1}
                  className="w-full"
                />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>1 week</span>
                  <span>1 year</span>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="motivation" className="text-sm font-medium">
                  Why do you want to learn this? <span className="text-muted-foreground">(optional)</span>
                </Label>
                <Textarea
                  id="motivation"
                  placeholder="What drives you to master this skill?"
                  value={motivation}
                  onChange={(e) => setMotivation(e.target.value)}
                  rows={2}
                />
              </div>

              <Button
                onClick={generatePlan}
                disabled={generating || !subject.trim()}
                className="w-full h-12 text-base gap-2"
              >
                {generating ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    The Architect is designing your plan...
                  </>
                ) : (
                  <>
                    <Target className="w-5 h-5" />
                    Generate Learning Plan
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        )}

        {/* ===== PLAN VIEW ===== */}
        {view === 'plan' && activePlan && (
          <>
            {/* Plan Overview */}
            <Card>
              <CardContent className="py-4">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h2 className="text-lg font-bold text-foreground">{activePlan.subject}</h2>
                    <p className="text-xs text-muted-foreground">
                      {activePlan.target_level} · {activePlan.daily_time_minutes}min/day · {activePlan.duration_weeks}w
                    </p>
                  </div>
                  <Badge variant={activePlan.status === 'completed' ? 'secondary' : 'default'}>
                    {activePlan.status === 'completed' ? '✅ Complete' : `Day ${activePlan.current_day}`}
                  </Badge>
                </div>
                <Progress
                  value={Math.min(100, ((activePlan.current_day - 1) / activePlan.total_days) * 100)}
                  className="h-2 mb-2"
                />
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>Day {activePlan.current_day} of {activePlan.total_days}</span>
                  <span className="flex items-center gap-1">
                    <Trophy className="w-3 h-3 text-warning" /> {activePlan.total_xp_earned} XP
                  </span>
                </div>

                {activePlan.ai_plan?.planSummary && (
                  <p className="text-sm text-muted-foreground mt-3 border-t border-border pt-3">
                    {activePlan.ai_plan.planSummary}
                  </p>
                )}

                {activePlan.ai_plan?.phases && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {activePlan.ai_plan.phases.map((phase: any, i: number) => (
                      <Badge key={i} variant="outline" className="text-xs">
                        {phase.name}: {phase.days}
                      </Badge>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Daily Tasks */}
            <div className="space-y-4">
              {Object.entries(tasksByDay)
                .sort(([a], [b]) => Number(a) - Number(b))
                .map(([dayNum, dayTasks]) => {
                  const day = Number(dayNum);
                  const allComplete = dayTasks.every((t) => t.is_completed);
                  const anyUnlocked = dayTasks.some((t) => t.is_unlocked);
                  const isCurrentDay = day === activePlan.current_day;

                  return (
                    <Card key={day} className={`${isCurrentDay ? 'border-primary/40 shadow-sm' : ''} ${!anyUnlocked ? 'opacity-50' : ''}`}>
                      <CardHeader className="py-3 px-4">
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-sm flex items-center gap-2">
                            {allComplete ? (
                              <CheckCircle2 className="w-4 h-4 text-success" />
                            ) : !anyUnlocked ? (
                              <Lock className="w-4 h-4 text-muted-foreground" />
                            ) : (
                              <Clock className="w-4 h-4 text-info" />
                            )}
                            Day {day}
                            {isCurrentDay && <Badge variant="default" className="text-[10px] px-1.5 py-0">CURRENT</Badge>}
                          </CardTitle>
                          <span className="text-xs text-muted-foreground">
                            {dayTasks.filter((t) => t.is_completed).length}/{dayTasks.length} done
                          </span>
                        </div>
                      </CardHeader>
                      {anyUnlocked && (
                        <CardContent className="pt-0 px-4 pb-3 space-y-2">
                          {dayTasks.map((task) => (
                            <div
                              key={task.id}
                              className={`rounded-md border p-3 ${
                                task.is_completed
                                  ? 'bg-muted/50 border-border'
                                  : 'bg-card border-border hover:border-primary/30'
                              } transition-colors`}
                            >
                              <div className="flex items-start justify-between gap-2">
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 mb-1">
                                    <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${TASK_TYPE_COLORS[task.task_type] || ''}`}>
                                      {TASK_TYPE_LABELS[task.task_type] || task.task_type}
                                    </Badge>
                                    <span className="text-[10px] text-muted-foreground">{task.duration_minutes}min</span>
                                  </div>
                                  <h4 className={`text-sm font-medium ${task.is_completed ? 'line-through text-muted-foreground' : 'text-foreground'}`}>
                                    {task.title}
                                  </h4>
                                  <p className="text-xs text-muted-foreground mt-0.5">{task.description}</p>
                                </div>
                                <div className="flex flex-col items-end gap-1">
                                  <span className="text-xs font-mono text-warning">+{task.xp_reward}xp</span>
                                  {!task.is_completed && task.is_unlocked ? (
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="text-xs h-7"
                                      disabled={completing === task.id}
                                      onClick={() => completeTask(task.id)}
                                    >
                                      {completing === task.id ? (
                                        <Loader2 className="w-3 h-3 animate-spin" />
                                      ) : (
                                        'Complete'
                                      )}
                                    </Button>
                                  ) : task.is_completed ? (
                                    <CheckCircle2 className="w-4 h-4 text-success" />
                                  ) : null}
                                </div>
                              </div>
                              {task.attribute_rewards && Object.keys(task.attribute_rewards).length > 0 && (
                                <div className="flex gap-1 mt-1.5">
                                  {Object.entries(task.attribute_rewards).map(([attr, val]) => (
                                    <Badge key={attr} variant="outline" className="text-[9px] px-1 py-0">
                                      +{val as number} {attr}
                                    </Badge>
                                  ))}
                                </div>
                              )}
                            </div>
                          ))}
                        </CardContent>
                      )}
                    </Card>
                  );
                })}
            </div>
          </>
        )}
      </main>
    </div>
  );
}
