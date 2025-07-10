import React, { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { 
  TrendingUp, 
  Users, 
  Building2, 
  UserCheck, 
  Package, 
  Settings, 
  Calculator, 
  Calendar,
  LogOut,
  User
} from 'lucide-react';

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
import DashboardCalendar from "@/components/DashboardCalendar";
import DashboardStats from "@/components/DashboardStats";
import { toast } from "@/hooks/use-toast";

const Index = () => {
  const { user, userRole, loading } = useAuth();
  const navigate = useNavigate();
  const [activeModule, setActiveModule] = useState('dashboard');

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!user) {
    navigate('/auth');
    return null;
  }

  if (userRole === 'employee') {
    navigate('/employee');
    return null;
  }

  if (userRole !== 'manager') {
    return null;
  }

  const renderModule = () => {
    switch(activeModule) {
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
      case 'finance':
        return <FinanceModule />;
      case 'planner':
        return <PlannerModule />;
      case 'timetracking':
        return <TimeTrackingModule />;
      default:
        return (
          <div className="space-y-6">
            <DashboardStats />
            <DashboardCalendar />
          </div>
        );
    }
  };

  return (
    <div className="min-h-screen w-full bg-background">
      <AppSidebar activeModule={activeModule} onModuleChange={setActiveModule} />
      
      <div className="ml-16 flex flex-col min-h-screen">
        {/* Header */}
        <header className="h-16 border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-30">
          <div className="flex items-center justify-between h-full px-6">
            <div className="flex items-center space-x-2">
              <h1 className="text-xl font-semibold">ElektroManage Pro</h1>
              <Badge variant="secondary" className="hidden sm:inline-flex">
                Manager Dashboard
              </Badge>
            </div>
            
            <div className="flex items-center space-x-4">
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
    </div>
  );
};

export default Index;