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
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    // Get user from auth header
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

    const { subject, targetLevel, dailyTimeMinutes, durationWeeks, motivation } = await req.json();

    if (!subject || !targetLevel || !dailyTimeMinutes || !durationWeeks) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const totalDays = durationWeeks * 7;

    // Generate the learning plan with AI
    const systemPrompt = `You are THE ARCHITECT, a master curriculum designer. You create precise, progressive learning plans adapted to the student's goals. Your plans are structured, measurable, and build skills progressively.

RULES:
- Generate tasks for the FIRST 7 DAYS only (the student will request more as they progress)
- Each day should have 2-4 tasks
- Tasks must be concrete, actionable, and measurable
- Progressive difficulty: each day builds on the previous
- Mix task types: study (theory), practice (hands-on), review (consolidation), project (application), assessment (self-test)
- XP rewards: 10-30 per task based on difficulty
- Attribute rewards: INT for intellectual subjects, STR/AGI for physical skills, PER for observation-based skills, WIS for wisdom/strategic skills
- Day 1 tasks should always be unlocked. Later days are locked until previous day is complete.

Return JSON only.`;

    const userPrompt = `Create a learning plan for:
- Subject: ${subject}
- Target Level: ${targetLevel}
- Daily Time: ${dailyTimeMinutes} minutes
- Total Duration: ${durationWeeks} weeks (${totalDays} days)
- Motivation: ${motivation || "Self-improvement"}

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

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.7,
      }),
    });

    if (!aiResponse.ok) {
      const status = aiResponse.status;
      if (status === 429) {
        return new Response(JSON.stringify({ error: "Rate limited. Please try again in a moment." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Please add funds." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errText = await aiResponse.text();
      console.error("AI gateway error:", status, errText);
      throw new Error("AI generation failed");
    }

    const aiData = await aiResponse.json();
    const content = aiData.choices?.[0]?.message?.content;
    if (!content) throw new Error("No AI response content");

    // Parse AI response - handle markdown code blocks
    let planData;
    try {
      const cleaned = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      planData = JSON.parse(cleaned);
    } catch {
      console.error("Failed to parse AI response:", content);
      throw new Error("Invalid AI response format");
    }

    // Create the learning plan in DB
    const { data: plan, error: planError } = await supabase
      .from("learning_plans")
      .insert({
        user_id: userId,
        subject,
        target_level: targetLevel,
        daily_time_minutes: dailyTimeMinutes,
        duration_weeks: durationWeeks,
        motivation: motivation || null,
        ai_plan: planData,
        total_days: totalDays,
        current_day: 1,
      })
      .select()
      .single();

    if (planError) {
      console.error("Plan insert error:", planError);
      throw new Error("Failed to save learning plan");
    }

    // Insert tasks
    const tasks = (planData.tasks || []).map((task: any) => ({
      plan_id: plan.id,
      user_id: userId,
      day_number: task.dayNumber,
      title: task.title,
      description: task.description,
      task_type: task.taskType || "study",
      duration_minutes: task.durationMinutes || 15,
      xp_reward: task.xpReward || 15,
      attribute_rewards: task.attributeRewards || {},
      is_completed: false,
      is_unlocked: task.dayNumber === 1,
    }));

    if (tasks.length > 0) {
      const { error: tasksError } = await supabase
        .from("learning_tasks")
        .insert(tasks);

      if (tasksError) {
        console.error("Tasks insert error:", tasksError);
      }
    }

    return new Response(JSON.stringify({ plan, planData }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-learning-plan error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
