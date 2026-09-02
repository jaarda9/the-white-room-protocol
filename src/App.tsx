import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useEffect } from "react";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import Dashboard from "./pages/Dashboard";
import Profile from "./pages/Profile";
import QuestSession from "./pages/QuestSession";
import Analytics from "./pages/Analytics";
import SocialLab from "./pages/SocialLab";
import PhysicalLab from "./pages/PhysicalLab";
import MentalLab from "./pages/MentalLab";
import KnowledgeLab from "./pages/KnowledgeLab";
import KnowledgeDomain from "./pages/KnowledgeDomain";
import Achievements from "./pages/Achievements";
import Challenges from "./pages/Challenges";
import ChessLab from "./pages/ChessLab";
import ChatGPTTest from "./pages/ChatGPTTest";
import SkillForge from "./pages/SkillForge";
import KinnuLab from "./pages/KinnuLab";
import DailyProtocol from "./pages/DailyProtocol";
import Login from "./pages/Login";
import CalendarPage from "./pages/CalendarPage";
import Leaderboard from "./pages/Leaderboard";
import NotFound from "./pages/NotFound";
import { forceSyncToDatabase } from "./lib/storage-sync";
import { getUserProfile } from "./lib/storage";

const queryClient = new QueryClient();

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-primary font-mono text-sm animate-pulse">LOADING SYSTEM...</p>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
};

const LevelRoute = ({
  minLevel,
  children,
}: {
  minLevel: number;
  children: React.ReactNode;
}) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-primary font-mono text-sm animate-pulse">LOADING SYSTEM...</p>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  const profile = getUserProfile();
  if (profile.level < minLevel) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
};

const AppRoutes = () => {
  const { user, loading } = useAuth();

  return (
    <Routes>
      <Route path="/login" element={loading ? null : user ? <Navigate to="/" replace /> : <Login />} />
      <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
      <Route path="/quests" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
      <Route path="/gates" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
      <Route path="/theia" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
      <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
      <Route path="/quest/:id" element={<ProtectedRoute><QuestSession /></ProtectedRoute>} />
      <Route path="/analytics" element={<ProtectedRoute><Analytics /></ProtectedRoute>} />
      <Route path="/social-lab" element={<LevelRoute minLevel={10}><SocialLab /></LevelRoute>} />
      <Route path="/physical-lab" element={<LevelRoute minLevel={10}><PhysicalLab /></LevelRoute>} />
      <Route path="/mental-lab" element={<LevelRoute minLevel={10}><MentalLab /></LevelRoute>} />
      <Route path="/knowledge-lab" element={<LevelRoute minLevel={15}><KnowledgeLab /></LevelRoute>} />
      <Route path="/knowledge/:domain" element={<LevelRoute minLevel={15}><KnowledgeDomain /></LevelRoute>} />
      <Route path="/achievements" element={<ProtectedRoute><Achievements /></ProtectedRoute>} />
      <Route path="/challenges" element={<ProtectedRoute><Challenges /></ProtectedRoute>} />
      <Route path="/chess-lab" element={<LevelRoute minLevel={15}><ChessLab /></LevelRoute>} />
      <Route path="/chatgpt-test" element={<ProtectedRoute><ChatGPTTest /></ProtectedRoute>} />
      <Route path="/skill-forge" element={<LevelRoute minLevel={20}><SkillForge /></LevelRoute>} />
      <Route path="/daily-protocol" element={<ProtectedRoute><DailyProtocol /></ProtectedRoute>} />
      <Route path="/calendar" element={<ProtectedRoute><CalendarPage /></ProtectedRoute>} />
      <Route path="/leaderboard" element={<ProtectedRoute><Leaderboard /></ProtectedRoute>} />
      <Route path="/kinnu-lab" element={<LevelRoute minLevel={10}><KinnuLab /></LevelRoute>} />
      <Route path="/research-lab" element={<Navigate to="/kinnu-lab" replace />} />
      {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
};

const App = () => {
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker
          .register('/sw.js')
          .then((registration) => {
            console.log('[PWA] Service Worker registered:', registration.scope);
            setInterval(() => { registration.update(); }, 60 * 60 * 1000);
            registration.addEventListener('updatefound', () => {
              const newWorker = registration.installing;
              if (newWorker) {
                newWorker.addEventListener('statechange', () => {
                  if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                    if (confirm('A new version is available. Reload to update?')) {
                      window.location.reload();
                    }
                  }
                });
              }
            });
          })
          .catch((error) => {
            console.error('[PWA] Service Worker registration failed:', error);
          });
      });
    }

    const handleBeforeUnload = () => {
      forceSyncToDatabase().catch(error => {
        console.error('Failed to sync on unload:', error);
      });
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      forceSyncToDatabase().catch(error => {
        console.error('Failed to sync on unmount:', error);
      });
    };
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <TooltipProvider>
            <Toaster />
            <Sonner />
            <AppRoutes />
          </TooltipProvider>
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
};

export default App;
