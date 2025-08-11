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
import { CompanySettingsSimple as CompanySettingsModule } from "@/components/CompanySettingsSimple";
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
  return <div className="min-h-screen w-full bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
      <AppSidebar activeModule={activeModule} onModuleChange={setActiveModule} />
      
      <div className="ml-16 lg:ml-16 flex flex-col min-h-screen">
        {/* Modern Header with Glassmorphism */}
        <header className="h-20 border-b border-white/20 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl sticky top-0 z-30 shadow-lg shadow-blue-500/10">
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
                className="hidden sm:inline-flex bg-gradient-to-r from-blue-100 to-indigo-100 text-blue-700 border-0 shadow-sm"
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
                className="hidden sm:flex bg-white/50 hover:bg-white/80 border-white/30 backdrop-blur-sm shadow-lg transition-all duration-200 hover:scale-105"
              >
                <UserCheck className="w-4 h-4 mr-2" />
                Mitarbeiter-Ansicht
              </Button>
              <div className="flex items-center space-x-2 text-sm text-slate-600 dark:text-slate-300 bg-white/30 dark:bg-slate-800/30 px-3 py-2 rounded-full backdrop-blur-sm">
                <User className="w-4 h-4" />
                <span className="hidden sm:inline font-medium">
                  {user?.email?.split('@')[0] || 'Admin'}
                </span>
              </div>
            </div>
          </div>
        </header>

        {/* Enhanced Main Content */}
        <main className="flex-1 overflow-auto">
          <div className="p-8 space-y-8">
            <div className="animate-fadeIn">
              {renderModule()}
            </div>
          </div>
        </main>
      </div>
    </div>;
};
export default Index;