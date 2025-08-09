
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import Landing from "./pages/Landing";
import Employee from "./pages/Employee";
import GmailCallback from "./pages/GmailCallback";
import Privacy from "./pages/Privacy";
import NotFound from "./pages/NotFound";
import MitarbeiterSetupPage from "./pages/MitarbeiterSetupPage";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/login" element={<Auth />} />
          <Route path="/auth" element={<Auth />} />
          <Route path="/manager" element={<Index />} />
          <Route path="/employee" element={<Employee />} />
          <Route path="/auth/callback" element={<GmailCallback />} />
          <Route path="/privacy" element={<Privacy />} />
          <Route path="/mitarbeiter-setup" element={<MitarbeiterSetupPage />} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
