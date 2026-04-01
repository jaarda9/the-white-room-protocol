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
  const [subjectId, setSubjectId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

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

  const user: AppUser | null = subjectId ? { id: subjectId } : null;

  return (
    <AuthContext.Provider value={{ user, subjectId, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};
