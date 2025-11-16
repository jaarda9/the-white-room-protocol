import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Dashboard from "./pages/Dashboard";
import Profile from "./pages/Profile";
import QuestSession from "./pages/QuestSession";
import Analytics from "./pages/Analytics";
import SocialLab from "./pages/SocialLab";
import MentalLab from "./pages/MentalLab";
import PhysicalLab from "./pages/PhysicalLab";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
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
          <Route path="/social" element={<SocialLab />} />
          <Route path="/social/:id" element={<SocialLab />} />
          <Route path="/mental" element={<MentalLab />} />
          <Route path="/mental/:id" element={<MentalLab />} />
          <Route path="/physical" element={<PhysicalLab />} />
          <Route path="/physical/:id" element={<PhysicalLab />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
