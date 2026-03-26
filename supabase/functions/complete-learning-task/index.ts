import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    let userId: string | null = null;
    if (authHeader) {
      const token = authHeader.replace("Bearer ", "");
      const { data: { user } } = await supabase.auth.getUser(token);
      userId = user?.id ?? null;
    }

    if (!userId) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { taskId } = await req.json();
    if (!taskId) {
      return new Response(JSON.stringify({ error: "Missing taskId" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get the task
    const { data: task, error: taskError } = await supabase
      .from("learning_tasks")
      .select("*, learning_plans(*)")
      .eq("id", taskId)
      .eq("user_id", userId)
      .single();

    if (taskError || !task) {
      return new Response(JSON.stringify({ error: "Task not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (task.is_completed) {
      return new Response(JSON.stringify({ error: "Task already completed" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Mark task complete
    await supabase
      .from("learning_tasks")
      .update({ is_completed: true, completed_at: new Date().toISOString() })
      .eq("id", taskId);

    // Update plan XP
    const planId = task.plan_id;
    await supabase
      .from("learning_plans")
      .update({
        total_xp_earned: (task.learning_plans?.total_xp_earned || 0) + task.xp_reward,
      })
      .eq("id", planId);

    // Check if all tasks for this day are complete → unlock next day
    const { data: dayTasks } = await supabase
      .from("learning_tasks")
      .select("*")
      .eq("plan_id", planId)
      .eq("day_number", task.day_number);

    const allDayComplete = dayTasks?.every((t: any) => t.is_completed || t.id === taskId);

    if (allDayComplete) {
      const nextDay = task.day_number + 1;
      // Unlock next day's tasks
      await supabase
        .from("learning_tasks")
        .update({ is_unlocked: true })
        .eq("plan_id", planId)
        .eq("day_number", nextDay);

      // Update current day on plan
      await supabase
        .from("learning_plans")
        .update({ current_day: nextDay })
        .eq("id", planId);

      // Check if plan is complete
      const plan = task.learning_plans;
      if (plan && nextDay > plan.total_days) {
        // Award bonus XP
        const bonusXp = plan.duration_weeks * 50;
        await supabase
          .from("learning_plans")
          .update({
            status: "completed",
            bonus_xp_awarded: true,
            total_xp_earned: (plan.total_xp_earned || 0) + task.xp_reward + bonusXp,
          })
          .eq("id", planId);

        return new Response(JSON.stringify({
          success: true,
          dayComplete: true,
          planComplete: true,
          bonusXp,
          xpEarned: task.xp_reward,
          attributeRewards: task.attribute_rewards,
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    return new Response(JSON.stringify({
      success: true,
      dayComplete: allDayComplete,
      planComplete: false,
      xpEarned: task.xp_reward,
      attributeRewards: task.attribute_rewards,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("complete-learning-task error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
