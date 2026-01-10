
import React, { useState, useEffect } from "react";
import { 
  TrendingUp, 
  Users, 
  Building2, 
  UserCheck, 
  Package, 
  Settings, 
  Calculator, 
  Calendar,
  Clock,
  LogOut,
  ChevronDown,
  ChevronRight,
  Database,
  Receipt,
  Mail,
  FileText,
  Target,
  Plane,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";

const navigationItems = [
  { id: 'dashboard', name: 'Dashboard', icon: TrendingUp, color: 'text-blue-500' },
  { 
    id: 'stammdaten', 
    name: 'Stammdaten', 
    icon: Database, 
    color: 'text-gray-500',
    children: [
      { id: 'customers', name: 'Kunden & Aufträge', icon: Users, color: 'text-green-500' },
      { id: 'personal', name: 'Personal', icon: UserCheck, color: 'text-purple-500' }
    ]
  },
  { id: 'projects', name: 'Projekte & Baustellen', icon: Building2, color: 'text-orange-500' },
  { id: 'timetracking', name: 'Zeiterfassung', icon: Clock, color: 'text-yellow-500' },
  { id: 'vacation', name: 'Urlaubsverwaltung', icon: Plane, color: 'text-sky-500' },
  { id: 'emails', name: 'E-Mails', icon: Mail, color: 'text-pink-500' },
  { id: 'documents', name: 'Dokumente', icon: Receipt, color: 'text-emerald-500' },
  { id: 'invoice-validation', name: 'Rechnungs-Validierung', icon: FileText, color: 'text-amber-500' },
  { id: 'materials', name: 'Material', icon: Package, color: 'text-red-500' },
  { id: 'machines', name: 'Maschinen & Geräte', icon: Settings, color: 'text-indigo-500' },
  { id: 'finance', name: 'Finanzen', icon: Calculator, color: 'text-cyan-500' },
  { id: 'planner', name: 'Planer', icon: Calendar, color: 'text-teal-500' },
  { id: 'company-settings', name: 'Firmeneinstellungen', icon: Settings, color: 'text-gray-600' }
];

interface AppSidebarProps {
  activeModule: string;
  onModuleChange: (moduleId: string) => void;
}

export function AppSidebar({ activeModule, onModuleChange }: AppSidebarProps) {
  const { signOut } = useAuth();
  const navigate = useNavigate();
  const [isHovered, setIsHovered] = useState(false);
  const [hoverTimeout, setHoverTimeout] = useState<NodeJS.Timeout | null>(null);
  const [expandedGroups, setExpandedGroups] = useState<string[]>(['stammdaten']);

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

  const isExpanded = isHovered;

  // Collapse any open groups when the sidebar collapses
  useEffect(() => {
    if (!isExpanded) {
      setExpandedGroups([]);
    }
  }, [isExpanded]);

  const toggleGroup = (groupId: string) => {
    setExpandedGroups(prev => 
      prev.includes(groupId) 
        ? prev.filter(id => id !== groupId)
        : [...prev, groupId]
    );
  };

  return (
    <div 
      className={`fixed left-0 top-0 h-full z-50 transition-all duration-500 ease-in-out ${isExpanded ? "w-64" : "w-16"}
      bg-sidebar border-r border-sidebar-border shadow-2xl`}
      onMouseEnter={() => {
        if (hoverTimeout) clearTimeout(hoverTimeout);
        const timeout = setTimeout(() => setIsHovered(true), 150);
        setHoverTimeout(timeout);
      }}
      onMouseLeave={() => {
        if (hoverTimeout) clearTimeout(hoverTimeout);
        setIsHovered(false);
        // Collapse all expanded groups when the sidebar closes
        setExpandedGroups([]);
      }}
    >
      {/* Logo at top */}
      <div className="p-4 border-b border-sidebar-border">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-lg bg-sidebar-primary/20 backdrop-blur-sm flex items-center justify-center border border-sidebar-border">
            <span className="text-sidebar-foreground font-bold text-sm">H</span>
          </div>
          <span className={`font-bold text-sidebar-foreground transition-all duration-300 ${
            isExpanded ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-2"
          }`}>
            HandwerkOS
          </span>
        </div>
      </div>

      <div className="flex flex-col h-full">
        <div className="flex-1 p-3">
          <div className="space-y-2">
            {navigationItems.map((item) => (
              <div key={item.id}>
                {item.children ? (
                  // Gruppiertes Menü mit Unterelementen
                  <div>
                    <button
                      onClick={() => toggleGroup(item.id)}
                      className={`group w-full flex items-center p-3 rounded-lg transition-all duration-300 relative
                      text-sidebar-foreground/80 hover:text-sidebar-foreground hover:bg-sidebar-accent backdrop-blur-sm`}
                      title={!isExpanded ? item.name : undefined}
                    >
                      <div className="w-5 h-5 flex items-center justify-center flex-shrink-0">
                        <item.icon className={`h-5 w-5 ${item.color} group-hover:scale-110 transition-transform duration-200`} />
                      </div>
                      <span className={`ml-3 whitespace-nowrap transition-all duration-300 font-medium ${
                        isExpanded ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-2"
                      }`}>
                        {item.name}
                      </span>
                      {isExpanded && (
                        <div className="ml-auto">
                          {expandedGroups.includes(item.id) ? (
                            <ChevronDown className="h-4 w-4 text-sidebar-foreground/60 group-hover:text-sidebar-foreground transition-colors duration-200" />
                          ) : (
                            <ChevronRight className="h-4 w-4 text-sidebar-foreground/60 group-hover:text-sidebar-foreground transition-colors duration-200" />
                          )}
                        </div>
                      )}
                    </button>
                    
                    {/* Unterelemente */}
                    {expandedGroups.includes(item.id) && isExpanded && (
                      <div className="ml-6 mt-1 space-y-1">
                        {item.children.map((child) => (
                          <button
                            key={child.id}
                            onClick={() => onModuleChange(child.id)}
                            className={`group w-full flex items-center p-2.5 rounded-lg transition-all duration-200 text-sm ${
                              activeModule === child.id
                                ? "bg-sidebar-primary/20 text-sidebar-foreground shadow-lg backdrop-blur-sm border border-sidebar-border"
                                : "text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent"
                            }`}
                          >
                            <div className="w-4 h-4 flex items-center justify-center flex-shrink-0">
                              <child.icon className={`h-4 w-4 ${child.color} group-hover:scale-110 transition-transform duration-200`} />
                            </div>
                            <span className="ml-2 whitespace-nowrap font-medium">
                              {child.name}
                            </span>
                            {activeModule === child.id && (
                              <div className="ml-auto w-1.5 h-1.5 rounded-full bg-sidebar-primary animate-pulse" />
                            )}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  // Einzelnes Menüelement
                  <button
                    onClick={() => onModuleChange(item.id)}
                    className={`group w-full flex items-center p-3 rounded-lg transition-all duration-300 relative ${
                      activeModule === item.id
                        ? "bg-sidebar-primary/20 text-sidebar-foreground shadow-lg backdrop-blur-sm border border-sidebar-border"
                        : "text-sidebar-foreground/80 hover:text-sidebar-foreground hover:bg-sidebar-accent"
                    }`}
                    title={!isExpanded ? item.name : undefined}
                  >
                    <div className="w-5 h-5 flex items-center justify-center flex-shrink-0">
                      <item.icon className={`h-5 w-5 ${item.color} group-hover:scale-110 transition-transform duration-200`} />
                    </div>
                    <span className={`ml-3 whitespace-nowrap transition-all duration-300 font-medium ${
                      isExpanded ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-2"
                    }`}>
                      {item.name}
                    </span>
                    {activeModule === item.id && (
                      <div className="absolute right-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-sidebar-primary/50 rounded-l-full" />
                    )}
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="p-3 border-t border-sidebar-border">
          <button
            onClick={handleSignOut}
            className="group w-full flex items-center p-3 rounded-lg text-sidebar-foreground/80 hover:text-sidebar-foreground hover:bg-destructive/20 transition-all duration-300 relative"
            title={!isExpanded ? "Abmelden" : undefined}
          >
            <div className="w-5 h-5 flex items-center justify-center flex-shrink-0">
              <LogOut className="h-5 w-5 group-hover:scale-110 transition-transform duration-200" />
            </div>
            <span className={`ml-3 whitespace-nowrap transition-all duration-300 font-medium ${
              isExpanded ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-2"
            }`}>
              Abmelden
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
