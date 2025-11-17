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
import NotFound from "./pages/NotFound";
import { initializeDataSync, forceSyncToDatabase } from "./lib/storage-sync";

const queryClient = new QueryClient();

const App = () => {
  useEffect(() => {
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
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/quest/:id" element={<QuestSession />} />
            <Route path="/analytics" element={<Analytics />} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;
