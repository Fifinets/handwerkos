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
  const { signOut } = useAuth();
  const navigate = useNavigate();
  const [isHovered, setIsHovered] = useState(false);

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

  return (
    <div 
      className={`fixed left-0 top-0 h-full z-50 transition-all duration-300 ${isExpanded ? "w-64" : "w-16"} bg-sidebar border-r border-border`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className="flex flex-col h-full">
        <div className="flex-1 p-2">
          <div className="space-y-2">
            {navigationItems.map((item) => (
              <div key={item.id}>
                <button
                  onClick={() => onModuleChange(item.id)}
                  className={`w-full flex items-center p-3 rounded-lg transition-all duration-200 ${
                    activeModule === item.id
                      ? "bg-primary text-primary-foreground"
                      : "hover:bg-accent hover:text-accent-foreground"
                  }`}
                  title={!isExpanded ? item.name : undefined}
                >
                  <item.icon className={`h-5 w-5 ${item.color} flex-shrink-0`} />
                  <span className={`ml-3 transition-all duration-300 ${
                    isExpanded ? "opacity-100 visible" : "opacity-0 invisible"
                  }`}>
                    {item.name}
                  </span>
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="p-2 border-t border-border">
          <button
            onClick={handleSignOut}
            className="w-full flex items-center p-3 rounded-lg text-destructive hover:bg-destructive/10 transition-all duration-200"
            title={!isExpanded ? "Abmelden" : undefined}
          >
            <LogOut className="h-5 w-5 flex-shrink-0" />
            <span className={`ml-3 transition-all duration-300 ${
              isExpanded ? "opacity-100 visible" : "opacity-0 invisible"
            }`}>
              Abmelden
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}