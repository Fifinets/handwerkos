import React, { useState, useEffect } from 'react';
import { useSupabaseAuth } from '@/hooks/useSupabaseAuth';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { UserCheck, User, Bell } from 'lucide-react';
import { AppSidebarV2 } from "@/components/AppSidebarV2";
import ExecutiveDashboardV2 from "@/components/ExecutiveDashboardV2";
import CustomerModuleV2 from "@/components/CustomerModuleV2";
import ProjectModuleV2 from "@/components/ProjectModuleV2";
import PersonalModuleV2 from "@/components/PersonalModuleV2";
import MaterialModuleV2 from "@/components/MaterialModuleV2";
import MachineModule from "@/components/MachineModule";
import FinanceModuleV2 from "@/components/FinanceModuleV2";
import PlannerModuleV2 from "@/components/PlannerModuleV2";
import TimeTrackingModuleV2 from "@/components/TimeTrackingModuleV2";
import { DocumentModule } from "@/components/DocumentModule";
import { CompanySettingsSimple as CompanySettingsModule } from "@/components/CompanySettingsSimple";
import EmailModuleV2 from "@/components/EmailModuleV2";
import OfferModuleV2 from "@/components/OfferModuleV2";
import { VacationManagement } from "@/components/VacationManagement";
import { toast } from "@/hooks/use-toast";
import { ThemeToggle } from "@/components/ui/theme-toggle";

const IndexV2 = () => {
    const {
        user,
        userRole,
        loading,
        signOut
    } = useSupabaseAuth();
    const navigate = useNavigate();
    const [activeModule, setActiveModule] = useState('dashboard');

    const isMobile = () => {
        return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
            window.innerWidth <= 768;
    };

    useEffect(() => {
        if (!loading) {
            if (!user) {
                navigate('/login');
            } else if (userRole === 'employee') {
                navigate('/employee');
            } else if (userRole === 'manager' && isMobile()) {
                toast({
                    title: "Mobile Gerät erkannt",
                    description: "Für die beste Erfahrung verwenden Sie die Employee-App"
                });
            }
        }
    }, [user, userRole, loading]);

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-900"></div>
            </div>
        );
    }

    if (!user || userRole !== 'manager') {
        return null;
    }

    const renderModule = () => {
        switch (activeModule) {
            case 'customers':
                return <CustomerModuleV2 />;
            case 'projects':
                return <ProjectModuleV2 />;
            case 'personal':
                return <PersonalModuleV2 />;
            case 'materials':
                return <MaterialModuleV2 />;
            case 'machines':
                return <MachineModule />;
            case 'emails':
                return <EmailModuleV2 />;
            case 'documents':
                return <DocumentModule />;
            case 'finance':
                return <FinanceModuleV2 />;
            case 'planner':
                return <PlannerModuleV2 />;
            case 'timetracking':
                return <TimeTrackingModuleV2 />;
            case 'vacation':
                return <VacationManagement />;
            case 'company-settings':
                return <CompanySettingsModule />;
            case 'offers':
                return <OfferModuleV2 />;
            default:
                return <ExecutiveDashboardV2 onNavigate={setActiveModule} />;
        }
    };

    return (
        <div className="min-h-screen w-full bg-slate-50 flex">
            {/* V2 Sidebar with strict Lucide Icons and grouped dark theme */}
            <AppSidebarV2 activeModule={activeModule} onModuleChange={setActiveModule} />

            <div className="flex-1 flex flex-col min-h-screen ml-16 lg:ml-16 transition-all duration-300">

                {/* Cleaner Top Header */}
                <header className="h-16 border-b border-slate-200 bg-white sticky top-0 z-30 shadow-sm flex items-center justify-between px-6">
                    <div className="flex items-center space-x-4">
                        <h2 className="text-lg font-semibold text-slate-800 hidden sm:block">Manager Arbeitsbereich</h2>
                        <Badge variant="secondary" className="bg-teal-50 text-teal-700 border-teal-200 shadow-sm">
                            V2 Redesign
                        </Badge>
                    </div>

                    <div className="flex items-center space-x-3">
                        <Button variant="ghost" size="icon" className="text-slate-500 hover:text-slate-700 relative">
                            <Bell className="h-5 w-5" />
                            <span className="absolute top-2 right-2.5 w-2 h-2 bg-rose-500 rounded-full border border-white"></span>
                        </Button>

                        <ThemeToggle />

                        <div className="h-4 w-px bg-slate-200 mx-2"></div>

                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => navigate('/employee')}
                            className="hidden sm:flex bg-white hover:bg-slate-50 border-slate-200 text-slate-700 shadow-sm transition-all duration-200"
                        >
                            <UserCheck className="w-4 h-4 mr-2 text-slate-500" />
                            Zur Mitarbeiter-App
                        </Button>
                    </div>
                </header>

                {/* Main Content Area */}
                <main className="flex-1 overflow-auto bg-slate-50/50">
                    {renderModule()}
                </main>
            </div>
        </div>
    );
};

export default IndexV2;
