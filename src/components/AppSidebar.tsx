import { useState } from "react";
import { 
  TrendingUp, 
  Users, 
  Building2, 
  UserCheck, 
  Package, 
  Settings, 
  Calculator, 
  Calendar,
  LogOut
} from "lucide-react";
import { useNavigate } from "react-router-dom";

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
  useSidebar,
} from "@/components/ui/sidebar";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";

const navigationItems = [
  { id: 'dashboard', name: 'Dashboard', icon: TrendingUp, color: 'text-blue-500' },
  { id: 'customers', name: 'Kunden & Aufträge', icon: Users, color: 'text-green-500' },
  { id: 'projects', name: 'Projekte & Baustellen', icon: Building2, color: 'text-orange-500' },
  { id: 'personal', name: 'Personal', icon: UserCheck, color: 'text-purple-500' },
  { id: 'materials', name: 'Material', icon: Package, color: 'text-red-500' },
  { id: 'machines', name: 'Maschinen & Geräte', icon: Settings, color: 'text-indigo-500' },
  { id: 'finance', name: 'Finanzen', icon: Calculator, color: 'text-cyan-500' },
  { id: 'planner', name: 'Planer', icon: Calendar, color: 'text-teal-500' }
];

interface AppSidebarProps {
  activeModule: string;
  onModuleChange: (moduleId: string) => void;
}

export function AppSidebar({ activeModule, onModuleChange }: AppSidebarProps) {
  const { state } = useSidebar();
  const { signOut } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    try {
      await signOut();
      navigate('/auth');
      toast({
        title: "Erfolgreich abgemeldet",
        description: "Sie wurden erfolgreich abgemeldet.",
      });
    } catch (error) {
      toast({
        title: "Fehler beim Abmelden",
        description: "Es ist ein Fehler aufgetreten.",
        variant: "destructive",
      });
    }
  };

  return (
    <Sidebar 
      className={`transition-all duration-300 ${state === "collapsed" ? "w-16" : "w-64"}`}
      collapsible="icon"
    >
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className={state === "collapsed" ? "sr-only" : ""}>
            Navigation
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navigationItems.map((item) => (
                <SidebarMenuItem key={item.id}>
                  <SidebarMenuButton
                    onClick={() => onModuleChange(item.id)}
                    className={`w-full justify-start transition-colors ${
                      activeModule === item.id
                        ? "bg-primary text-primary-foreground"
                        : "hover:bg-accent hover:text-accent-foreground"
                    }`}
                    tooltip={state === "collapsed" ? item.name : undefined}
                  >
                    <item.icon className={`h-5 w-5 ${item.color}`} />
                    {state !== "collapsed" && <span className="ml-3">{item.name}</span>}
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              onClick={handleSignOut}
              className="w-full justify-start text-destructive hover:bg-destructive/10"
              tooltip={state === "collapsed" ? "Abmelden" : undefined}
            >
              <LogOut className="h-5 w-5" />
              {state !== "collapsed" && <span className="ml-3">Abmelden</span>}
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}