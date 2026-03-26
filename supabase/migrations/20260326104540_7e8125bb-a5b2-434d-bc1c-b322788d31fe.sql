
-- Create learning_plans table
CREATE TABLE public.learning_plans (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subject TEXT NOT NULL,
  target_level TEXT NOT NULL CHECK (target_level IN ('beginner', 'intermediate', 'advanced', 'expert')),
  daily_time_minutes INTEGER NOT NULL CHECK (daily_time_minutes BETWEEN 10 AND 180),
  duration_weeks INTEGER NOT NULL CHECK (duration_weeks BETWEEN 1 AND 52),
  motivation TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'paused', 'abandoned')),
  ai_plan JSONB,
  total_xp_earned INTEGER NOT NULL DEFAULT 0,
  bonus_xp_awarded BOOLEAN NOT NULL DEFAULT false,
  current_day INTEGER NOT NULL DEFAULT 1,
  total_days INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create learning_tasks table
CREATE TABLE public.learning_tasks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  plan_id UUID NOT NULL REFERENCES public.learning_plans(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  day_number INTEGER NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  task_type TEXT NOT NULL CHECK (task_type IN ('study', 'practice', 'review', 'project', 'assessment')),
  duration_minutes INTEGER NOT NULL,
  xp_reward INTEGER NOT NULL DEFAULT 15,
  attribute_rewards JSONB DEFAULT '{}',
  is_completed BOOLEAN NOT NULL DEFAULT false,
  is_unlocked BOOLEAN NOT NULL DEFAULT false,
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.learning_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.learning_tasks ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view their own plans" ON public.learning_plans FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own plans" ON public.learning_plans FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own plans" ON public.learning_plans FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own plans" ON public.learning_plans FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Users can view their own tasks" ON public.learning_tasks FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own tasks" ON public.learning_tasks FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own tasks" ON public.learning_tasks FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own tasks" ON public.learning_tasks FOR DELETE USING (auth.uid() = user_id);

-- Indexes
CREATE INDEX idx_learning_plans_user ON public.learning_plans(user_id);
CREATE INDEX idx_learning_tasks_plan ON public.learning_tasks(plan_id);
CREATE INDEX idx_learning_tasks_user ON public.learning_tasks(user_id);
CREATE INDEX idx_learning_tasks_day ON public.learning_tasks(day_number);

-- Update timestamp trigger
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_learning_plans_updated_at
  BEFORE UPDATE ON public.learning_plans
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
