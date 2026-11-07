import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from "react";
import { useLocation } from "react-router-dom";
import {
  SESSION_SUBJECT_KEY,
  clearLocalProtocolData,
  endServerSession,
} from "@/lib/subject-auth";
import { AUTH_REQUIRED_EVENT, SESSION_TOKEN_KEY, getSessionToken } from "@/lib/session-token";
import { clearCalendarEventsForUser } from "@/lib/calendar-events-storage";
import { initializeDataSync } from "@/lib/storage-sync";
import SessionGate from "@/components/auth/SessionGate";

/** Minimal user shape for routing; identity is the 6-char subject id (Mongo `userId`). */
export type AppUser = { id: string };

interface AuthContextType {
  user: AppUser | null;
  subjectId: string | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  subjectId: null,
  loading: true,
  signOut: async () => {},
});

export const useAuth = () => useContext(AuthContext);

/** Older builds stored this for a 1-hour idle sign-out, which no longer exists. */
const LEGACY_LAST_ACTIVITY_KEY = "whiteroom_last_activity_at";

function readSessionFromStorage(): string | null {
  const rawId = localStorage.getItem(SESSION_SUBJECT_KEY);
  if (!rawId) return null;

  const id = rawId.replace(/^SUBJECT-/, "").trim().toUpperCase();

  const profStr = localStorage.getItem("whiteroom_user_profile");
  if (!profStr) {
    return id;
  }

  try {
    const p = JSON.parse(profStr) as { id?: string; pseudo?: string };
    const pId = (p?.id || "").replace(/^SUBJECT-/, "").trim().toUpperCase();
    if (pId && pId !== id) {
      // The device holds another Subject's data under this session. Running on it would let the
      // next save copy that data into this account, so wipe it; the initial load then restores
      // this Subject's own save from the server.
      console.warn("[Auth] Session/profile mismatch — clearing foreign local data:", { pId, id });
      clearLocalProtocolData();
      return id;
    }
    return id;
  } catch {
    return id;
  }
}

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const location = useLocation();
  // Read synchronously on first render: starting from "no subject" for one frame would mount
  // the app (and its sync calls) before the SessionGate could take over.
  const [subjectId, setSubjectId] = useState<string | null>(() => readSessionFromStorage());
  const [loading, setLoading] = useState(true);
  /** Signed in as a Subject, but this device holds no valid server session (see SessionGate). */
  const [sessionMissing, setSessionMissing] = useState(
    () => Boolean(localStorage.getItem(SESSION_SUBJECT_KEY)) && !getSessionToken()
  );

  const refreshSession = useCallback(() => {
    const id = readSessionFromStorage();
    setSubjectId(id);
    setSessionMissing(Boolean(id) && !getSessionToken());
    setLoading(false);
  }, []);

  useEffect(() => {
    refreshSession();
  }, [location.pathname, refreshSession]);

  useEffect(() => {
    try {
      localStorage.removeItem(LEGACY_LAST_ACTIVITY_KEY);
    } catch {
      // ignore
    }
  }, []);

  // The server rejected this device's session (expired, or revoked by a PIN recovery elsewhere).
  useEffect(() => {
    const onAuthRequired = () => {
      if (localStorage.getItem(SESSION_SUBJECT_KEY)) setSessionMissing(true);
    };
    window.addEventListener(AUTH_REQUIRED_EVENT, onAuthRequired);
    return () => window.removeEventListener(AUTH_REQUIRED_EVENT, onAuthRequired);
  }, []);

  // localStorage is shared by every tab/window of the app (e.g. the installed app + a browser tab).
  // If another one signs out or switches Subject, this one is now running on a different Subject's
  // data with a stale in-memory sync target — reload so it re-reads the session from scratch.
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key !== SESSION_SUBJECT_KEY && e.key !== SESSION_TOKEN_KEY && e.key !== null) return; // null = clear()
      if (e.key === SESSION_TOKEN_KEY) {
        // Another tab signed in again (or out): pick up its session state.
        if (e.newValue && sessionMissing) window.location.reload();
        return;
      }
      const current = (subjectId || "").toUpperCase();
      const next = (e.key === null ? "" : e.newValue || "").replace(/^SUBJECT-/, "").trim().toUpperCase();
      if (next !== current) window.location.reload();
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [subjectId, sessionMissing]);

  useEffect(() => {
    if (!subjectId || sessionMissing) return;
    initializeDataSync().catch((err) =>
      console.error("[Auth] Data sync init failed:", err)
    );
  }, [subjectId, sessionMissing]);

  const signOut = useCallback(async () => {
    // Detach this device on the server first (push subscription + session) while the token
    // still authenticates the request.
    await endServerSession().catch(() => {});
    const current = readSessionFromStorage();
    if (current) {
      clearCalendarEventsForUser(current);
    }
    localStorage.removeItem(SESSION_SUBJECT_KEY);
    clearLocalProtocolData();
    setSubjectId(null);
    setSessionMissing(false);
  }, []);

  const user: AppUser | null = subjectId ? { id: subjectId } : null;

  return (
    <AuthContext.Provider value={{ user, subjectId, loading, signOut }}>
      {subjectId && sessionMissing ? (
        <SessionGate
          subjectId={subjectId}
          onSignOut={() => {
            signOut().finally(() => window.location.assign("/login"));
          }}
        />
      ) : (
        children
      )}
    </AuthContext.Provider>
  );
};
