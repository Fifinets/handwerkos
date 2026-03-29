import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { lazy, Suspense, useEffect } from "react";
import ErrorBoundary from "./components/ErrorBoundary";
import { GoogleAnalytics } from "./components/GoogleAnalytics";
import { ThemeProvider } from "./contexts/ThemeContext";
import { eventBus } from "./services/eventBus";
import CookieBanner from "./components/CookieBanner";
import NotFound from "./pages/NotFound";
import "./styles/animations.css";

// Lazy-loaded pages
const IndexV2 = lazy(() => import("./pages/IndexV2"));
const Auth = lazy(() => import("./pages/Auth"));
const Employee = lazy(() => import("./pages/Employee"));
const GmailCallback = lazy(() => import("./pages/GmailCallback"));
const Privacy = lazy(() => import("./pages/Privacy"));
const MitarbeiterSetupPage = lazy(() => import("./pages/MitarbeiterSetupPage"));
const HandwerkerSoftwarePremium = lazy(() => import("./pages/HandwerkerSoftwarePremium"));
const Impressum = lazy(() => import("./pages/Impressum"));
const Datenschutz = lazy(() => import("./pages/Datenschutz"));
const OfferCreationWizard = lazy(() => import("./pages/offers/OfferCreationWizard"));
const OfferEditorPage = lazy(() => import("./pages/offers/OfferEditorPage"));
const MarketplaceLanding = lazy(() => import("./pages/marketplace/MarketplaceLanding"));
const JobPostingWizard = lazy(() => import("./pages/marketplace/JobPostingWizard"));
const CustomerDashboard = lazy(() => import("./pages/marketplace/CustomerDashboard"));
const MarketplaceAuth = lazy(() => import("./pages/marketplace/MarketplaceAuth"));
const JobSearchFeed = lazy(() => import("./pages/marketplace/JobSearchFeed"));
const PublicOfferView = lazy(() => import("./pages/public/PublicOfferView"));

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
    const subscriptions = [
      eventBus.on('CUSTOMER_CREATED', () => {
        queryClient.invalidateQueries({ queryKey: ['customers'] });
      }),
      eventBus.on('CUSTOMER_UPDATED', () => {
        queryClient.invalidateQueries({ queryKey: ['customers'] });
      }),
      eventBus.on('CUSTOMER_DELETED', () => {
        queryClient.invalidateQueries({ queryKey: ['customers'] });
      }),
      eventBus.on('PROJECT_CREATED', () => {
        queryClient.invalidateQueries({ queryKey: ['projects'] });
        queryClient.invalidateQueries({ queryKey: ['financial-kpis'] });
      }),
      eventBus.on('PROJECT_UPDATED', () => {
        queryClient.invalidateQueries({ queryKey: ['projects'] });
        queryClient.invalidateQueries({ queryKey: ['financial-kpis'] });
      }),
      eventBus.on('PROJECT_STATUS_CHANGED', () => {
        queryClient.invalidateQueries({ queryKey: ['projects'] });
        queryClient.invalidateQueries({ queryKey: ['financial-kpis'] });
      }),
      eventBus.on('PROJECT_DELETED' as any, () => {
        queryClient.invalidateQueries({ queryKey: ['projects'] });
      }),
      eventBus.on('QUOTE_CREATED', () => {
        queryClient.invalidateQueries({ queryKey: ['quotes'] });
      }),
      eventBus.on('QUOTE_UPDATED', () => {
        queryClient.invalidateQueries({ queryKey: ['quotes'] });
      }),
      eventBus.on('QUOTE_ACCEPTED', () => {
        queryClient.invalidateQueries({ queryKey: ['quotes'] });
        queryClient.invalidateQueries({ queryKey: ['financial-kpis'] });
      }),
      eventBus.on('OFFER_CREATED', () => {
        queryClient.invalidateQueries({ queryKey: ['offers'] });
      }),
      eventBus.on('OFFER_UPDATED', () => {
        queryClient.invalidateQueries({ queryKey: ['offers'] });
      }),
      eventBus.on('OFFER_DELETED', () => {
        queryClient.invalidateQueries({ queryKey: ['offers'] });
      }),
      eventBus.on('OFFER_SENT', () => {
        queryClient.invalidateQueries({ queryKey: ['offers'] });
      }),
      eventBus.on('OFFER_ACCEPTED', () => {
        queryClient.invalidateQueries({ queryKey: ['offers'] });
        queryClient.invalidateQueries({ queryKey: ['projects'] });
        queryClient.invalidateQueries({ queryKey: ['financial-kpis'] });
      }),
      eventBus.on('OFFER_REJECTED', () => {
        queryClient.invalidateQueries({ queryKey: ['offers'] });
      }),
      eventBus.on('OFFER_ITEM_ADDED', () => {
        queryClient.invalidateQueries({ queryKey: ['offers'] });
      }),
      eventBus.on('OFFER_ITEM_UPDATED', () => {
        queryClient.invalidateQueries({ queryKey: ['offers'] });
      }),
      eventBus.on('OFFER_ITEM_DELETED', () => {
        queryClient.invalidateQueries({ queryKey: ['offers'] });
      }),
      eventBus.on('OFFER_TARGETS_UPDATED', () => {
        queryClient.invalidateQueries({ queryKey: ['offers'] });
      }),
      eventBus.on('INVOICE_CREATED', () => {
        queryClient.invalidateQueries({ queryKey: ['invoices'] });
        queryClient.invalidateQueries({ queryKey: ['financial-kpis'] });
      }),
      eventBus.on('INVOICE_UPDATED', () => {
        queryClient.invalidateQueries({ queryKey: ['invoices'] });
        queryClient.invalidateQueries({ queryKey: ['financial-kpis'] });
      }),
      eventBus.on('INVOICE_PAID', () => {
        queryClient.invalidateQueries({ queryKey: ['invoices'] });
        queryClient.invalidateQueries({ queryKey: ['financial-kpis'] });
      }),
      eventBus.on('TIMESHEET_CREATED', () => {
        queryClient.invalidateQueries({ queryKey: ['time-entries'] });
      }),
      eventBus.on('TIMESHEET_UPDATED', () => {
        queryClient.invalidateQueries({ queryKey: ['time-entries'] });
      }),
      eventBus.on('STOCK_ADJUSTED', () => {
        queryClient.invalidateQueries({ queryKey: ['materials'] });
        queryClient.invalidateQueries({ queryKey: ['stock-counts'] });
      }),
      eventBus.on('STOCK_TRANSFER_COMPLETED', () => {
        queryClient.invalidateQueries({ queryKey: ['materials'] });
        queryClient.invalidateQueries({ queryKey: ['stock-transfers'] });
        queryClient.invalidateQueries({ queryKey: ['stock-counts'] });
      })
    ];

    return () => {
      subscriptions.forEach(subscriptionId => eventBus.off(subscriptionId));
    };
  }, []);

  return null;
};

const LoadingFallback = () => (
  <div className="flex items-center justify-center min-h-screen">
    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
  </div>
);

const App = () => (
  <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <EventBusQueryInvalidation />
      <ThemeProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <CookieBanner />
          <BrowserRouter>
            <GoogleAnalytics />
            <Suspense fallback={<LoadingFallback />}>
              <Routes>
                <Route path="/" element={<HandwerkerSoftwarePremium />} />
                <Route path="/login" element={<Auth />} />
                <Route path="/auth" element={<Auth />} />
                <Route path="/manager" element={<Navigate to="/manager2" replace />} />
                <Route path="/manager2" element={<IndexV2 />} />
                <Route path="/employee" element={<Employee />} />
                <Route path="/auth/callback" element={<GmailCallback />} />
                <Route path="/privacy" element={<Privacy />} />
                <Route path="/impressum" element={<Impressum />} />
                <Route path="/datenschutz" element={<Datenschutz />} />
                <Route path="/mitarbeiter-setup" element={<MitarbeiterSetupPage />} />
                <Route path="/handwerkersoftware" element={<HandwerkerSoftwarePremium />} />

                {/* Offer Module Routes */}
                <Route path="/offers/wizard" element={<OfferCreationWizard />} />
                <Route path="/offers/:id/edit" element={<OfferEditorPage />} />
                <Route path="/offers/new/edit" element={<OfferEditorPage />} />

                {/* Public Routes (no auth) */}
                <Route path="/public/offer/:token" element={<PublicOfferView />} />

                {/* Marketplace Module Routes */}
                <Route path="/marktplatz" element={<MarketplaceLanding />} />
                <Route path="/marktplatz/post" element={<JobPostingWizard />} />
                <Route path="/marktplatz/customer/dashboard" element={<CustomerDashboard />} />
                <Route path="/marktplatz/auth" element={<MarketplaceAuth />} />
                <Route path="/marktplatz/search" element={<JobSearchFeed />} />

                {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
                <Route path="*" element={<NotFound />} />
              </Routes>
            </Suspense>
          </BrowserRouter>
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  </ErrorBoundary>
);

export default App;
