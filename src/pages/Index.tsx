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
import MaterialModule from "@/components/MaterialModule";
import MachineModule from "@/components/MachineModule";
import FinanceModule from "@/components/FinanceModule";
import PlannerModule from "@/components/PlannerModule";
import TimeTrackingModule from "@/components/TimeTrackingModule";
import { DocumentModule } from "@/components/DocumentModule";
import { CompanySettingsModule } from "@/components/CompanySettingsModule";
import { EmailModule } from "@/components/EmailModule";
import DashboardCalendar from "@/components/DashboardCalendar";
import DashboardStatsWithKpis from "@/components/DashboardStatsWithKpis";
import { toast } from "@/hooks/use-toast";
const Index = () => {
  const {
    user,
    userRole,
    loading,
    signOut
  } = useSupabaseAuth();
  const navigate = useNavigate();
  const [activeModule, setActiveModule] = useState('dashboard');

  // Handle navigation in useEffect to avoid setState during render
  useEffect(() => {
    if (!loading) {
      if (!user) {
        navigate('/auth');
      } else if (userRole === 'employee') {
        navigate('/employee');
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
        return <MaterialModule />;
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
        return <DashboardStatsWithKpis onNavigate={setActiveModule} />;
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
              <Button variant="outline" size="sm" onClick={async () => {
              await signOut();
              toast({
                title: "Erfolgreich abgemeldet",
                description: "Sie wurden erfolgreich abgemeldet."
              });
              navigate('/auth');
            }}>
                <LogOut className="w-4 h-4 mr-2" />
                Abmelden
              </Button>
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