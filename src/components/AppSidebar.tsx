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
  Clock,
  LogOut,
  ChevronDown,
  ChevronRight,
  Database,
  Receipt
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
  { id: 'documents', name: 'Dokumente', icon: Receipt, color: 'text-emerald-500' },
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

  const toggleGroup = (groupId: string) => {
    setExpandedGroups(prev => 
      prev.includes(groupId) 
        ? prev.filter(id => id !== groupId)
        : [...prev, groupId]
    );
  };

  return (
    <div 
      className={`fixed left-0 top-0 h-full z-50 transition-all duration-300 ${isExpanded ? "w-64" : "w-16"} bg-sidebar border-r border-border`}
      onMouseEnter={() => {
        if (hoverTimeout) clearTimeout(hoverTimeout);
        const timeout = setTimeout(() => setIsHovered(true), 200);
        setHoverTimeout(timeout);
      }}
      onMouseLeave={() => {
        if (hoverTimeout) clearTimeout(hoverTimeout);
        setIsHovered(false);
      }}
    >
      <div className="flex flex-col h-full">
        <div className="flex-1 p-2">
          <div className="space-y-2">
            {navigationItems.map((item) => (
              <div key={item.id}>
                {item.children ? (
                  // Gruppiertes Menü mit Unterelementen
                  <div>
                    <button
                      onClick={() => toggleGroup(item.id)}
                      className={`w-full flex items-center p-3 rounded-lg transition-all duration-200 relative hover:bg-accent hover:text-accent-foreground`}
                      title={!isExpanded ? item.name : undefined}
                    >
                      <div className="w-5 h-5 flex items-center justify-center flex-shrink-0">
                        <item.icon className={`h-5 w-5 ${item.color}`} />
                      </div>
                      <span className={`ml-3 whitespace-nowrap transition-all duration-300 ${
                        isExpanded ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-2"
                      }`}>
                        {item.name}
                      </span>
                      {isExpanded && (
                        <div className="ml-auto">
                          {expandedGroups.includes(item.id) ? (
                            <ChevronDown className="h-4 w-4" />
                          ) : (
                            <ChevronRight className="h-4 w-4" />
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
                            className={`w-full flex items-center p-2 rounded-lg transition-all duration-200 text-sm ${
                              activeModule === child.id
                                ? "bg-primary text-primary-foreground"
                                : "hover:bg-accent hover:text-accent-foreground"
                            }`}
                          >
                            <div className="w-4 h-4 flex items-center justify-center flex-shrink-0">
                              <child.icon className={`h-4 w-4 ${child.color}`} />
                            </div>
                            <span className="ml-2 whitespace-nowrap">
                              {child.name}
                            </span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  // Einzelnes Menüelement
                  <button
                    onClick={() => onModuleChange(item.id)}
                    className={`w-full flex items-center p-3 rounded-lg transition-all duration-200 relative ${
                      activeModule === item.id
                        ? "bg-primary text-primary-foreground"
                        : "hover:bg-accent hover:text-accent-foreground"
                    }`}
                    title={!isExpanded ? item.name : undefined}
                  >
                    <div className="w-5 h-5 flex items-center justify-center flex-shrink-0">
                      <item.icon className={`h-5 w-5 ${item.color}`} />
                    </div>
                    <span className={`ml-3 whitespace-nowrap transition-all duration-300 ${
                      isExpanded ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-2"
                    }`}>
                      {item.name}
                    </span>
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="p-2 border-t border-border">
          <button
            onClick={handleSignOut}
            className="w-full flex items-center p-3 rounded-lg text-destructive hover:bg-destructive/10 transition-all duration-200 relative"
            title={!isExpanded ? "Abmelden" : undefined}
          >
            <div className="w-5 h-5 flex items-center justify-center flex-shrink-0">
              <LogOut className="h-5 w-5" />
            </div>
            <span className={`ml-3 whitespace-nowrap transition-all duration-300 ${
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