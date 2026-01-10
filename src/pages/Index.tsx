import React, { useState, useEffect } from 'react';
import { useSupabaseAuth } from '@/hooks/useSupabaseAuth';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { TrendingUp, Users, Building2, UserCheck, Package, Settings, Calculator, Calendar, LogOut, User } from 'lucide-react';
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import CustomerModule from "@/components/CustomerModule";
// import ProjectModule from "@/components/ProjectModule";
// import PersonalModule from "@/components/PersonalModule";
// import MaterialModuleEnhanced from "@/components/MaterialModuleEnhanced";
// import MachineModule from "@/components/MachineModule";
// import FinanceModule from "@/components/FinanceModule";
import PlannerModule from "@/components/PlannerModule";
// import TimeTrackingModule from "@/components/TimeTrackingModule";
// import TimeApprovalModule from "@/components/TimeApprovalModule";
// import { DocumentModule } from "@/components/DocumentModule";
// import { InvoiceValidationModule } from "@/components/InvoiceValidationModule";
import { CompanySettingsSimple as CompanySettingsModule } from "@/components/CompanySettingsSimple";
import EmailModule from "@/components/EmailModule";
import { VacationManagement } from "@/components/VacationManagement";
import DashboardCalendar from "@/components/DashboardCalendar";
import DashboardStatsWithKpis from "@/components/DashboardStatsWithKpis";
import ExecutiveDashboard from "@/components/ExecutiveDashboard";
import { toast } from "@/hooks/use-toast";
import { ThemeToggle } from "@/components/ui/theme-toggle";

const Index = () => {
  const {
    user,
    userRole,
    loading,
    signOut
  } = useSupabaseAuth();
  const navigate = useNavigate();
  const [activeModule, setActiveModule] = useState('dashboard');

  // Check if device is mobile
  const isMobile = () => {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || 
           window.innerWidth <= 768;
  };

  // Handle navigation in useEffect to avoid setState during render
  useEffect(() => {
    if (!loading) {
      if (!user) {
        navigate('/login');
      } else if (userRole === 'employee') {
        navigate('/employee');
      } else if (userRole === 'manager' && isMobile()) {
        // Manager auf Mobile → zeige mobile-freundliche Version oder Employee-Link
        toast({
          title: "Mobile Gerät erkannt",
          description: "Für die beste Erfahrung verwenden Sie die Employee-App"
        });
      }
    }
  }, [user, userRole, loading]); // Removed navigate from dependency array
  if (loading) {
    return <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>;
  }
  if (!user || userRole === 'employee') {
    return null;
  }
  if (userRole !== 'manager') {
    return null;
  }
  const renderModule = () => {
    switch (activeModule) {
      case 'customers':
        return <CustomerModule />;
      case 'projects':
        return <PlannerModule />; // Temporär PlannerModule verwenden
      case 'personal':
        return <div>Personal Module</div>; // Temporär
      case 'materials':
        return <div>Materials Module</div>; // Temporär
      case 'machines':
        return <div>Machines Module</div>; // Temporär
      case 'emails':
        return <EmailModule />;
      case 'documents':
        return <div>Documents Module</div>; // Temporär
      case 'invoice-validation':
        return <div>Invoice Validation Module</div>; // Temporär
      case 'finance':
        return <div>Finance Module</div>; // Temporär
      case 'planner':
        return <PlannerModule />;
      case 'timetracking':
        return <div>Time Tracking Module</div>; // Temporär
      case 'time-approval':
        return <div>Time Approval Module</div>; // Temporär
      case 'vacation':
        return <VacationManagement />;
      case 'company-settings':
        return <CompanySettingsModule />;
      default:
        return <ExecutiveDashboard onNavigate={setActiveModule} />;
    }
  };
  return <div className="min-h-screen w-full bg-background">
      <AppSidebar activeModule={activeModule} onModuleChange={setActiveModule} />

      <div className="ml-16 lg:ml-16 flex flex-col min-h-screen">
        {/* Header wie ursprünglich mit Logo */}
        <header className="h-20 border-b border-border bg-card/80 backdrop-blur-xl sticky top-0 z-30 shadow-lg">
          <div className="flex items-center justify-between h-full px-8">
            <div className="flex items-center space-x-4">
              <div className="flex items-center gap-3">
                <img 
                  src="/handwerkos-logo.svg" 
                  alt="HandwerkOS Logo" 
                  className="h-10 w-10 object-contain"
                />
                <h1 className="font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent text-3xl">
                  HandwerkOS
                </h1>
              </div>
              <Badge
                variant="secondary"
                className="hidden sm:inline-flex bg-primary/10 text-primary border-0 shadow-sm"
              >
                Manager Dashboard
              </Badge>
            </div>

            <div className="flex items-center space-x-4">
              <ThemeToggle />
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate('/employee')}
                className="hidden sm:flex bg-card/50 hover:bg-accent border-border backdrop-blur-sm shadow-lg transition-all duration-200 hover:scale-105"
              >
                <UserCheck className="w-4 h-4 mr-2" />
                Mitarbeiter-Ansicht
              </Button>
              <div className="flex items-center space-x-2 text-sm text-muted-foreground bg-muted/30 px-3 py-2 rounded-full backdrop-blur-sm">
                <User className="w-4 h-4" />
                <span className="hidden sm:inline font-medium">
                  {user?.email?.split('@')[0] || 'Admin'}
                </span>
              </div>
            </div>
          </div>
        </header>

        {/* Main Content - Module haben jetzt ihr eigenes Styling */}
        <main className="flex-1 overflow-auto">
          {renderModule()}
        </main>
      </div>
    </div>;
};
export default Index;