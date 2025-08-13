
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { useEffect } from "react";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import Employee from "./pages/Employee";
import GmailCallback from "./pages/GmailCallback";
import Privacy from "./pages/Privacy";
import NotFound from "./pages/NotFound";
import MitarbeiterSetupPage from "./pages/MitarbeiterSetupPage";
import HandwerkerSoftware from "./pages/HandwerkerSoftware";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { eventBus } from "./services/eventBus";
import "./styles/animations.css";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      staleTime: 5 * 60 * 1000, // 5 minutes
      refetchOnWindowFocus: false,
    },
  },
});

const EventBusQueryInvalidation = () => {
  useEffect(() => {
    // Set up EventBus to invalidate React Query cache on relevant events
    const subscriptions = [
      // Customer events
      eventBus.subscribe('customer.created', () => {
        queryClient.invalidateQueries({ queryKey: ['customers'] });
      }),
      eventBus.subscribe('customer.updated', () => {
        queryClient.invalidateQueries({ queryKey: ['customers'] });
      }),
      eventBus.subscribe('customer.deleted', () => {
        queryClient.invalidateQueries({ queryKey: ['customers'] });
      }),
      
      // Project events
      eventBus.subscribe('project.created', () => {
        queryClient.invalidateQueries({ queryKey: ['projects'] });
        queryClient.invalidateQueries({ queryKey: ['financial-kpis'] });
      }),
      eventBus.subscribe('project.updated', () => {
        queryClient.invalidateQueries({ queryKey: ['projects'] });
        queryClient.invalidateQueries({ queryKey: ['financial-kpis'] });
      }),
      eventBus.subscribe('project.status_changed', () => {
        queryClient.invalidateQueries({ queryKey: ['projects'] });
        queryClient.invalidateQueries({ queryKey: ['financial-kpis'] });
      }),
      
      // Quote events
      eventBus.subscribe('quote.created', () => {
        queryClient.invalidateQueries({ queryKey: ['quotes'] });
      }),
      eventBus.subscribe('quote.updated', () => {
        queryClient.invalidateQueries({ queryKey: ['quotes'] });
      }),
      eventBus.subscribe('quote.status_changed', () => {
        queryClient.invalidateQueries({ queryKey: ['quotes'] });
        queryClient.invalidateQueries({ queryKey: ['financial-kpis'] });
      }),
      
      // Invoice events
      eventBus.subscribe('invoice.created', () => {
        queryClient.invalidateQueries({ queryKey: ['invoices'] });
        queryClient.invalidateQueries({ queryKey: ['financial-kpis'] });
      }),
      eventBus.subscribe('invoice.updated', () => {
        queryClient.invalidateQueries({ queryKey: ['invoices'] });
        queryClient.invalidateQueries({ queryKey: ['financial-kpis'] });
      }),
      eventBus.subscribe('invoice.payment_received', () => {
        queryClient.invalidateQueries({ queryKey: ['invoices'] });
        queryClient.invalidateQueries({ queryKey: ['financial-kpis'] });
      }),
      
      // Time entry events
      eventBus.subscribe('time_entry.created', () => {
        queryClient.invalidateQueries({ queryKey: ['time-entries'] });
      }),
      eventBus.subscribe('time_entry.updated', () => {
        queryClient.invalidateQueries({ queryKey: ['time-entries'] });
      }),
      
      // Material/Stock events
      eventBus.subscribe('material.stock_updated', () => {
        queryClient.invalidateQueries({ queryKey: ['materials'] });
        queryClient.invalidateQueries({ queryKey: ['stock-counts'] });
      }),
      eventBus.subscribe('stock.transfer_completed', () => {
        queryClient.invalidateQueries({ queryKey: ['materials'] });
        queryClient.invalidateQueries({ queryKey: ['stock-transfers'] });
        queryClient.invalidateQueries({ queryKey: ['stock-counts'] });
      })
    ];
    
    // Cleanup subscriptions on unmount
    return () => {
      subscriptions.forEach(unsubscribe => unsubscribe());
    };
  }, []);
  
  return null;
};

const App = () => (
  <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <EventBusQueryInvalidation />
      <ThemeProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<HandwerkerSoftware />} />
              <Route path="/login" element={<Auth />} />
              <Route path="/auth" element={<Auth />} />
              <Route path="/manager" element={<Index />} />
              <Route path="/employee" element={<Employee />} />
              <Route path="/auth/callback" element={<GmailCallback />} />
              <Route path="/privacy" element={<Privacy />} />
              <Route path="/mitarbeiter-setup" element={<MitarbeiterSetupPage />} />
              <Route path="/handwerkersoftware" element={<HandwerkerSoftware />} />
              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  </ErrorBoundary>
);

export default App;
