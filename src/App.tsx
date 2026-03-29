import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { useEffect } from "react";
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
import DailyProtocol from "./pages/DailyProtocol";
import NotFound from "./pages/NotFound";
import { initializeDataSync, forceSyncToDatabase } from "./lib/storage-sync";

const queryClient = new QueryClient();

// Separate component for app content to ensure router context is always available
const AppRoutes = () => {
  return (
    <Routes>
      <Route path="/" element={<Dashboard />} />
      <Route path="/profile" element={<Profile />} />
      <Route path="/quest/:id" element={<QuestSession />} />
      <Route path="/analytics" element={<Analytics />} />
      <Route path="/social-lab" element={<SocialLab />} />
      <Route path="/physical-lab" element={<PhysicalLab />} />
      <Route path="/mental-lab" element={<MentalLab />} />
      <Route path="/knowledge-lab" element={<KnowledgeLab />} />
      <Route path="/knowledge/:domain" element={<KnowledgeDomain />} />
      <Route path="/achievements" element={<Achievements />} />
      <Route path="/challenges" element={<Challenges />} />
      <Route path="/chess-lab" element={<ChessLab />} />
      <Route path="/chatgpt-test" element={<ChatGPTTest />} />
      <Route path="/skill-forge" element={<SkillForge />} />
      <Route path="/daily-protocol" element={<DailyProtocol />} />
      {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
};

const App = () => {
  useEffect(() => {
    // Register Service Worker for PWA
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker
          .register('/sw.js')
          .then((registration) => {
            console.log('[PWA] Service Worker registered:', registration.scope);
            
            // Check for updates periodically
            setInterval(() => {
              registration.update();
            }, 60 * 60 * 1000); // Check every hour

            // Handle updates
            registration.addEventListener('updatefound', () => {
              const newWorker = registration.installing;
              if (newWorker) {
                newWorker.addEventListener('statechange', () => {
                  if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                    // New service worker available, prompt user to reload
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

    // Initialize data sync on app startup
    initializeDataSync().catch(error => {
      console.error('Failed to initialize data sync:', error);
    });

    // Save data on page unload
    const handleBeforeUnload = () => {
      forceSyncToDatabase().catch(error => {
        console.error('Failed to sync on unload:', error);
      });
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      // Final sync on component unmount
      forceSyncToDatabase().catch(error => {
        console.error('Failed to sync on unmount:', error);
      });
    };
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <AppRoutes />
        </TooltipProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
};

export default App;
