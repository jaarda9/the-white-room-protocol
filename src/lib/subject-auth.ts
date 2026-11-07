import type { UserProfile } from "@/lib/types";
import { createDefaultProfile, saveUserProfile } from "@/lib/storage";
import { clearSyncedGenerationKeys } from "@/lib/synced-localstorage-keys";
import { syncManager } from "@/lib/sync-manager";
import { clearSessionToken, getSessionToken, setSessionToken } from "@/lib/session-token";

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

// ---------------------------------------------------------------------------
// Server authentication (api/sync.ts auth actions). A Subject is Subject ID + 6-digit PIN;
// each signed-in device holds a session token (session-token.ts).
// ---------------------------------------------------------------------------

export type AuthResult = {
  error?: string;
  /** Server code: INVALID_CREDENTIALS, LOCKED, PIN_SETUP_REQUIRED, ALREADY_CLAIMED, … */
  code?: string;
  attemptsLeft?: number;
  /** Shown once (registration, first PIN, recovery). Never stored by the app. */
  recoveryCode?: string;
  subjectId?: string;
};

export const isValidPinFormat = (pin: string) => /^\d{6}$/.test(pin);

export function normalizeSubjectInput(raw: string): string {
  return raw.toUpperCase().trim().replace(/^SUBJECT-/, "").trim();
}

async function authRequest(body: Record<string, unknown>): Promise<{ ok: boolean; status: number; data: any }> {
  try {
    const res = await fetch("/api/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Cache-Control": "no-cache" },
      body: JSON.stringify(body),
    });
    let data: any = {};
    try {
      data = await res.json();
    } catch {
      data = {};
    }
    return { ok: res.ok, status: res.status, data };
  } catch {
    return { ok: false, status: 0, data: { error: "UPLINK FAILURE. CHECK YOUR CONNECTION AND RETRY." } };
  }
}

function failure(data: any, fallback: string): AuthResult {
  return {
    error: String(data?.error || fallback),
    code: data?.code,
    attemptsLeft: typeof data?.attemptsLeft === "number" ? data.attemptsLeft : undefined,
  };
}

/**
 * Restores the Subject's save onto this device after the session is in place. Wipes first:
 * the restore only writes keys the downloaded save contains and never removes the rest, so
 * anything a previous Subject left here (skill ledger, Gates, lab content…) would survive the
 * switch and be uploaded into this account on the next save.
 */
async function enterSubject(subjectId: string, token: string): Promise<AuthResult> {
  clearLocalProtocolData();
  setSessionToken(token);
  const { dataFound } = await syncManager.setUserId(subjectId);
  if (!dataFound) {
    syncManager.clearUser();
    clearSessionToken();
    return { error: "SAVE DATA COULD NOT BE LOADED. RETRY IN A MOMENT." };
  }
  localStorage.setItem(SESSION_SUBJECT_KEY, subjectId);
  return { subjectId };
}

/** New player: the server allocates the Subject ID and stores the PIN. */
export async function initializeNewSubject(pin: string): Promise<AuthResult> {
  if (!isValidPinFormat(pin)) return { error: "PIN MUST BE EXACTLY 6 DIGITS." };
  clearLocalProtocolData();
  localStorage.removeItem(SESSION_SUBJECT_KEY);
  clearSessionToken();

  const { ok, data } = await authRequest({ action: "register", pin });
  if (!ok || !data?.subjectId || !data?.token) return failure(data, "Could not register subject with the System.");

  const subjectId = String(data.subjectId);
  setSessionToken(String(data.token));
  saveUserProfile(createProfileForSubject(subjectId));
  // The session key is set from Login after the player names their Hunter.

  try {
    await syncManager.setUserId(subjectId);
    const saved = await syncManager.forceSaveUserData();
    if (!saved.success) throw new Error(saved.error || "save failed");
  } catch (e) {
    console.error("[SubjectAuth] Failed to seed MongoDB for new subject:", e);
    return { error: "Could not register subject with sync server." };
  }

  return { subjectId, recoveryCode: data.recoveryCode };
}

/** Returning player on a device: Subject ID + PIN. */
export async function loginWithSubjectId(rawId: string, pin: string): Promise<AuthResult> {
  const subjectId = normalizeSubjectInput(rawId);
  if (subjectId.length < 4) return { error: "SUBJECT ID TOO SHORT. ACCESS DENIED." };
  if (!isValidPinFormat(pin)) return { error: "PIN MUST BE EXACTLY 6 DIGITS." };
  const { ok, data } = await authRequest({ action: "login", subjectId, pin });
  if (!ok || !data?.token) return failure(data, "ACCESS DENIED.");
  return enterSubject(subjectId, String(data.token));
}

/** Accounts created before PINs existed: the first PIN set claims the account. */
export async function claimSubjectWithPin(rawId: string, pin: string): Promise<AuthResult> {
  const subjectId = normalizeSubjectInput(rawId);
  if (!isValidPinFormat(pin)) return { error: "PIN MUST BE EXACTLY 6 DIGITS." };
  const { ok, data } = await authRequest({ action: "claim", subjectId, pin });
  if (!ok || !data?.token) return failure(data, "ACCESS DENIED.");
  const entered = await enterSubject(subjectId, String(data.token));
  return entered.error ? entered : { ...entered, recoveryCode: data.recoveryCode };
}

/** Forgotten PIN: Subject ID + recovery code → new PIN. Signs every other device out. */
export async function recoverWithCode(rawId: string, recoveryCode: string, newPin: string): Promise<AuthResult> {
  const subjectId = normalizeSubjectInput(rawId);
  if (!isValidPinFormat(newPin)) return { error: "PIN MUST BE EXACTLY 6 DIGITS." };
  const { ok, data } = await authRequest({ action: "recover", subjectId, recoveryCode, newPin });
  if (!ok || !data?.token) return failure(data, "ACCESS DENIED.");
  const entered = await enterSubject(subjectId, String(data.token));
  return entered.error ? entered : { ...entered, recoveryCode: data.recoveryCode };
}

/**
 * Same Subject, new session (token missing, expired or revoked on this device). Does NOT wipe
 * local data: it already belongs to this Subject. The caller reloads so the initial load runs
 * again with the new session.
 */
export async function reauthenticate(rawId: string, pin: string): Promise<AuthResult> {
  const subjectId = normalizeSubjectInput(rawId);
  if (!isValidPinFormat(pin)) return { error: "PIN MUST BE EXACTLY 6 DIGITS." };
  const { ok, data } = await authRequest({ action: "login", subjectId, pin });
  if (!ok || !data?.token) return failure(data, "ACCESS DENIED.");
  setSessionToken(String(data.token));
  return { subjectId };
}

/** Same as reauthenticate, for a device signed in before PINs existed (sets the first PIN). */
export async function reclaimWithPin(rawId: string, pin: string): Promise<AuthResult> {
  const subjectId = normalizeSubjectInput(rawId);
  if (!isValidPinFormat(pin)) return { error: "PIN MUST BE EXACTLY 6 DIGITS." };
  const { ok, data } = await authRequest({ action: "claim", subjectId, pin });
  if (!ok || !data?.token) return failure(data, "ACCESS DENIED.");
  setSessionToken(String(data.token));
  return { subjectId, recoveryCode: data.recoveryCode };
}

/** Recovery from the re-authentication gate: keeps local data (same Subject). */
export async function recoverInPlace(rawId: string, recoveryCode: string, newPin: string): Promise<AuthResult> {
  const subjectId = normalizeSubjectInput(rawId);
  if (!isValidPinFormat(newPin)) return { error: "PIN MUST BE EXACTLY 6 DIGITS." };
  const { ok, data } = await authRequest({ action: "recover", subjectId, recoveryCode, newPin });
  if (!ok || !data?.token) return failure(data, "ACCESS DENIED.");
  setSessionToken(String(data.token));
  return { subjectId, recoveryCode: data.recoveryCode };
}

/** 'setup' when this Subject predates PINs and has none yet; otherwise 'pin'. */
export async function fetchPinStatus(rawId: string): Promise<"pin" | "setup"> {
  const { ok, data } = await authRequest({ action: "pin-status", subjectId: normalizeSubjectInput(rawId) });
  return ok && data?.state === "setup" ? "setup" : "pin";
}

export async function changeSubjectPin(currentPin: string, newPin: string): Promise<AuthResult> {
  if (!isValidPinFormat(newPin)) return { error: "NEW PIN MUST BE EXACTLY 6 DIGITS." };
  const { ok, data } = await authRequest({ action: "change-pin", currentPin, newPin });
  if (!ok) return failure(data, "PIN CHANGE FAILED.");
  return {};
}

/** Issues a new recovery code (the old one stops working). Needs the current PIN. */
export async function regenerateRecoveryCode(currentPin: string): Promise<AuthResult> {
  const { ok, data } = await authRequest({ action: "new-recovery-code", currentPin });
  if (!ok || !data?.recoveryCode) return failure(data, "COULD NOT ISSUE A NEW RECOVERY CODE.");
  return { recoveryCode: String(data.recoveryCode) };
}

/** Detaches this device: push subscription, server session, local token. */
export async function endServerSession(): Promise<void> {
  if (!getSessionToken()) return;
  try {
    if ("serviceWorker" in navigator) {
      const reg = await navigator.serviceWorker.getRegistration();
      const sub = await reg?.pushManager?.getSubscription();
      if (sub) {
        // This device must stop receiving the signed-out Subject's transmissions.
        await fetch("/api/push", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "unsubscribe", endpoint: sub.endpoint }),
        }).catch(() => {});
        await sub.unsubscribe().catch(() => {});
      }
    }
  } catch {
    // ignore
  }
  await authRequest({ action: "logout" });
  clearSessionToken();
}
