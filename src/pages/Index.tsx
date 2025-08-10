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
import ProjectModule from "@/components/ProjectModule";
import PersonalModule from "@/components/PersonalModule";
import MaterialModuleEnhanced from "@/components/MaterialModuleEnhanced";
import MachineModule from "@/components/MachineModule";
import FinanceModule from "@/components/FinanceModule";
import PlannerModule from "@/components/PlannerModule";
import TimeTrackingModule from "@/components/TimeTrackingModule";
import { DocumentModule } from "@/components/DocumentModule";
import { CompanySettingsModule } from "@/components/CompanySettingsModule";
import { EmailModule } from "@/components/EmailModule";
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
        return <ProjectModule />;
      case 'personal':
        return <PersonalModule />;
      case 'materials':
        return <MaterialModuleEnhanced />;
      case 'machines':
        return <MachineModule />;
      case 'emails':
        return <EmailModule />;
      case 'documents':
        return <DocumentModule />;
      case 'finance':
        return <FinanceModule />;
      case 'planner':
        return <PlannerModule />;
      case 'timetracking':
        return <TimeTrackingModule />;
      case 'company-settings':
        return <CompanySettingsModule />;
      default:
        return <ExecutiveDashboard onNavigate={setActiveModule} />;
    }
  };
  return <div className="min-h-screen w-full bg-background">
      <AppSidebar activeModule={activeModule} onModuleChange={setActiveModule} />
      
      <div className="ml-16 flex flex-col min-h-screen">
        {/* Header */}
        <header className="h-16 border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-30">
          <div className="flex items-center justify-between h-full px-6">
            <div className="flex items-center space-x-2">
              <h1 className="font-bold text-sky-950 text-2xl">HandwerkOS</h1>
              <Badge variant="secondary" className="hidden sm:inline-flex">
                Manager Dashboard
              </Badge>
            </div>
            
            <div className="flex items-center space-x-4">
              <ThemeToggle />
              <Button variant="outline" size="sm" onClick={() => navigate('/employee')} className="hidden sm:flex">
                <UserCheck className="w-4 h-4 mr-2" />
                Mitarbeiter-Ansicht
              </Button>
              <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                <User className="w-4 h-4" />
                <span className="hidden sm:inline">
                  {user?.email || 'Unbekannter Benutzer'}
                </span>
              </div>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="flex-1 overflow-auto">
          <div className="p-6">
            {renderModule()}
          </div>
        </main>
      </div>
    </div>;
};
export default Index;