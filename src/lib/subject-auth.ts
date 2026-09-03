import type { UserProfile } from "@/lib/types";
import { createDefaultProfile, saveUserProfile } from "@/lib/storage";
import { clearSyncedGenerationKeys } from "@/lib/synced-localstorage-keys";
import { syncManager } from "@/lib/sync-manager";

/** Set after successful login / new subject — used by AuthContext and Mongo sync. */
export const SESSION_SUBJECT_KEY = "whiteroom_session_subject_id";

const GAME_KEYS = [
  "whiteroom_user_profile",
  "whiteroom_quests",
  "whiteroom_quest_attempts",
  "whiteroom_daily_reset",
  "whiteroom_knowledge_data",
  "gameData",
] as const;

function generateSubjectId(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let id = "";
  for (let i = 0; i < 6; i++) {
    id += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return id;
}

function createProfileForSubject(subjectId: string): UserProfile {
  const base = createDefaultProfile();
  return {
    ...base,
    id: subjectId,
    pseudo: `SUBJECT-${subjectId}`,
    displayName: "Subject",
  };
}

/** Wipe local protocol data and sync manager state (new subject or sign-out). */
export function clearLocalProtocolData(): void {
  GAME_KEYS.forEach((k) => localStorage.removeItem(k));
  clearSyncedGenerationKeys();
  syncManager.clearUser();
}

async function subjectIdExistsInMongo(subjectId: string): Promise<boolean> {
  try {
    const url = `/api/sync?userId=${encodeURIComponent(subjectId)}&_t=${Date.now()}`;
    const response = await fetch(url, {
      method: "GET",
      headers: { "Cache-Control": "no-cache", Pragma: "no-cache" },
    });
    return response.ok;
  } catch {
    return false;
  }
}

export async function initializeNewSubject(): Promise<{ subjectId: string; error?: string }> {
  clearLocalProtocolData();
  localStorage.removeItem(SESSION_SUBJECT_KEY);

  let subjectId = generateSubjectId();
  for (let attempts = 0; attempts < 25; attempts++) {
    const taken = await subjectIdExistsInMongo(subjectId);
    if (!taken) break;
    subjectId = generateSubjectId();
  }

  const profile = createProfileForSubject(subjectId);
  saveUserProfile(profile);
  // Session is set from Login after the user confirms the briefing (see SESSION_SUBJECT_KEY there).

  try {
    await syncManager.setUserId(subjectId);
    await syncManager.forceSaveUserData();
  } catch (e) {
    console.error("[SubjectAuth] Failed to seed MongoDB for new subject:", e);
    return { subjectId: "", error: "Could not register subject with sync server." };
  }

  return { subjectId };
}

export async function loginWithSubjectId(subjectId: string): Promise<{ error?: string }> {
  let normalized = subjectId.toUpperCase().trim();
  if (normalized.startsWith("SUBJECT-")) {
    normalized = normalized.replace("SUBJECT-", "").trim();
  }
  if (normalized.length < 4) {
    return { error: "SUBJECT ID TOO SHORT. ACCESS DENIED." };
  }

  syncManager.clearUser();

  const { dataFound } = await syncManager.setUserId(normalized);

  if (!dataFound) {
    syncManager.clearUser();
    return { error: "SUBJECT ID NOT RECOGNIZED. ACCESS DENIED." };
  }

  localStorage.setItem(SESSION_SUBJECT_KEY, normalized);
  return {};
}
