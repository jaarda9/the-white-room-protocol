import { supabase } from "@/integrations/supabase/client";

const DOMAIN = "subject.syslvlup.sys";

function generateSubjectId(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no I/O/0/1 to avoid confusion
  let id = "";
  for (let i = 0; i < 6; i++) {
    id += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return id;
}

function getEmail(subjectId: string): string {
  return `${subjectId.toLowerCase()}@${DOMAIN}`;
}

function getPassword(subjectId: string): string {
  return `SYSLVLUP-SUBJECT-${subjectId}-ACCESS`;
}

export async function initializeNewSubject(): Promise<{ subjectId: string; error?: string }> {
  // Generate unique subject ID
  let subjectId = generateSubjectId();
  let attempts = 0;

  // Check uniqueness
  while (attempts < 10) {
    const { data } = await supabase
      .from("profiles")
      .select("subject_id")
      .eq("subject_id", subjectId)
      .maybeSingle();

    if (!data) break;
    subjectId = generateSubjectId();
    attempts++;
  }

  const email = getEmail(subjectId);
  const password = getPassword(subjectId);

  // Create auth account
  const { data: authData, error: signUpError } = await supabase.auth.signUp({
    email,
    password,
  });

  if (signUpError) {
    return { subjectId: "", error: signUpError.message };
  }

  if (!authData.user) {
    return { subjectId: "", error: "Failed to create subject account" };
  }

  // Create profile
  const { error: profileError } = await supabase.from("profiles").insert({
    id: authData.user.id,
    subject_id: subjectId,
    display_name: `SUBJECT-${subjectId}`,
  });

  if (profileError) {
    return { subjectId: "", error: profileError.message };
  }

  return { subjectId };
}

export async function loginWithSubjectId(subjectId: string): Promise<{ error?: string }> {
  const normalized = subjectId.toUpperCase().trim();
  const email = getEmail(normalized);
  const password = getPassword(normalized);

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    return { error: "SUBJECT ID NOT RECOGNIZED. ACCESS DENIED." };
  }

  return {};
}
