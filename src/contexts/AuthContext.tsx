import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  ReactNode,
  useRef,
} from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  SESSION_SUBJECT_KEY,
  clearLocalProtocolData,
} from "@/lib/subject-auth";
import { initializeDataSync } from "@/lib/storage-sync";

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

function readSessionFromStorage(): string | null {
  const id = localStorage.getItem(SESSION_SUBJECT_KEY);
  if (!id) return null;

  const profStr = localStorage.getItem("whiteroom_user_profile");
  if (!profStr) {
    localStorage.removeItem(SESSION_SUBJECT_KEY);
    return null;
  }

  try {
    const p = JSON.parse(profStr) as { id?: string };
    if (p?.id !== id) {
      localStorage.removeItem(SESSION_SUBJECT_KEY);
      return null;
    }
    return id;
  } catch {
    localStorage.removeItem(SESSION_SUBJECT_KEY);
    return null;
  }
}

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const [subjectId, setSubjectId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const lastActivityRef = useRef<number | null>(null);
  const idleTimerRef = useRef<number | null>(null);

  const IDLE_TIMEOUT_MS = 60 * 60 * 1000; // 1 hour

  const refreshSession = useCallback(() => {
    const id = readSessionFromStorage();
    setSubjectId(id);
    setLoading(false);
  }, []);

  useEffect(() => {
    refreshSession();
  }, [location.pathname, refreshSession]);

  useEffect(() => {
    if (!subjectId) return;
    initializeDataSync().catch((err) =>
      console.error("[Auth] Data sync init failed:", err)
    );
  }, [subjectId]);

  const signOut = async () => {
    localStorage.removeItem(SESSION_SUBJECT_KEY);
    clearLocalProtocolData();
    setSubjectId(null);
  };

  // Track user activity + auto-logout after 1 hour of inactivity
  useEffect(() => {
    if (!subjectId) {
      lastActivityRef.current = null;
      if (idleTimerRef.current !== null) {
        window.clearInterval(idleTimerRef.current);
        idleTimerRef.current = null;
      }
      return;
    }

    const markActivity = () => {
      lastActivityRef.current = Date.now();
    };

    // Initialize on mount / subject change
    markActivity();

    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        markActivity();
      }
    };

    window.addEventListener("mousemove", markActivity);
    window.addEventListener("keydown", markActivity);
    window.addEventListener("click", markActivity);
    window.addEventListener("touchstart", markActivity);
    document.addEventListener("visibilitychange", handleVisibility);

    idleTimerRef.current = window.setInterval(() => {
      if (!lastActivityRef.current) return;
      const idleFor = Date.now() - lastActivityRef.current;
      if (idleFor >= IDLE_TIMEOUT_MS) {
        // Clear to avoid repeated sign-outs
        if (idleTimerRef.current !== null) {
          window.clearInterval(idleTimerRef.current);
          idleTimerRef.current = null;
        }
        lastActivityRef.current = null;
        // Fire and forget; ignore race with manual logout
        signOut().finally(() => {
          navigate("/login", { replace: true });
        });
      }
    }, 60 * 1000); // check every minute

    return () => {
      window.removeEventListener("mousemove", markActivity);
      window.removeEventListener("keydown", markActivity);
      window.removeEventListener("click", markActivity);
      window.removeEventListener("touchstart", markActivity);
      document.removeEventListener("visibilitychange", handleVisibility);
      if (idleTimerRef.current !== null) {
        window.clearInterval(idleTimerRef.current);
        idleTimerRef.current = null;
      }
    };
  }, [subjectId, navigate, signOut]);

  const user: AppUser | null = subjectId ? { id: subjectId } : null;

  return (
    <AuthContext.Provider value={{ user, subjectId, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};
