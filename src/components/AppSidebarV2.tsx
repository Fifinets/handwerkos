import React, { useState, useEffect } from "react";
import {
    TrendingUp,
    Users,
    Building2,
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
    Plane,
    Menu,
    MoreVertical,
    UserCircle
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const mainNavigation = [
    { id: 'dashboard', name: 'Dashboard', icon: TrendingUp },
    { id: 'projects', name: 'Projekte', icon: Building2 },
    { id: 'offers', name: 'Angebote', icon: FileText },
    { id: 'finance', name: 'Finanzen', icon: Calculator },
    { id: 'planner', name: 'Planer', icon: Calendar },
    { id: 'emails', name: 'Posteingang', icon: Mail },
];

const secondaryNavigation = [
    {
        id: 'stammdaten',
        name: 'Stammdaten',
        icon: Database,
        children: [
            { id: 'customers', name: 'Kunden', icon: Users },
            { id: 'personal', name: 'Personal', icon: UserCircle }
        ]
    },
    { id: 'timetracking', name: 'Zeiterfassung', icon: Clock },
    { id: 'materials', name: 'Material', icon: Package },
];

interface AppSidebarV2Props {
    activeModule: string;
    onModuleChange: (moduleId: string) => void;
}

export function AppSidebarV2({ activeModule, onModuleChange }: AppSidebarV2Props) {
    const { signOut } = useAuth();
    const navigate = useNavigate();
    const [isHovered, setIsHovered] = useState(false);
    const [hoverTimeout, setHoverTimeout] = useState<NodeJS.Timeout | null>(null);
    const [expandedGroups, setExpandedGroups] = useState<string[]>([]);

    const handleSignOut = async () => {
        try {
            await signOut();
            navigate('/auth');
            toast({
                title: "Abgemeldet",
                description: "Sie wurden erfolgreich abgemeldet.",
            });
        } catch (error) {
            toast({
                title: "Fehler",
                description: "Fehler beim Abmelden aufgetreten.",
                variant: "destructive",
            });
        }
    };

    const isExpanded = isHovered;

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

    const renderNavItem = (item: any, isSecondary = false) => {
        const isActive = activeModule === item.id || (item.children && item.children.some((c: any) => c.id === activeModule));

        if (item.children) {
            return (
                <div key={item.id} className="mb-1">
                    <button
                        onClick={() => toggleGroup(item.id)}
                        className={`w-full flex items-center px-3 py-2.5 rounded-md transition-colors ${isActive
                                ? 'bg-slate-800 text-slate-100'
                                : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200'
                            }`}
                    >
                        <item.icon className={`h-5 w-5 flex-shrink-0 ${isActive ? 'text-teal-400' : 'text-slate-400'}`} />
                        {isExpanded && (
                            <>
                                <span className="ml-3 font-medium text-sm transition-opacity duration-300">
                                    {item.name}
                                </span>
                                <div className="ml-auto">
                                    {expandedGroups.includes(item.id) ? (
                                        <ChevronDown className="h-4 w-4" />
                                    ) : (
                                        <ChevronRight className="h-4 w-4" />
                                    )}
                                </div>
                            </>
                        )}
                    </button>

                    {expandedGroups.includes(item.id) && isExpanded && (
                        <div className="ml-9 mt-1 space-y-1">
                            {item.children.map((child: any) => (
                                <button
                                    key={child.id}
                                    onClick={() => onModuleChange(child.id)}
                                    className={`w-full flex items-center px-3 py-2 rounded-md transition-colors text-sm ${activeModule === child.id
                                            ? 'bg-slate-800 text-teal-400 font-medium'
                                            : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                                        }`}
                                >
                                    <child.icon className="h-4 w-4 mr-2" />
                                    <span>{child.name}</span>
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            );
        }

        return (
            <button
                key={item.id}
                onClick={() => onModuleChange(item.id)}
                className={`w-full flex items-center px-3 py-2.5 rounded-md transition-colors mb-1 ${activeModule === item.id
                        ? 'bg-slate-800 text-teal-400 font-medium'
                        : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200'
                    }`}
                title={!isExpanded ? item.name : undefined}
            >
                <item.icon className={`h-5 w-5 flex-shrink-0 ${activeModule === item.id ? 'text-teal-400' : 'text-slate-400'}`} />
                {isExpanded && (
                    <span className="ml-3 text-sm transition-opacity duration-300">
                        {item.name}
                    </span>
                )}
            </button>
        );
    };

    return (
        <div
            className={`fixed left-0 top-0 h-full z-50 flex flex-col transition-all duration-300 ease-in-out border-r border-slate-800 ${isExpanded ? "w-64" : "w-16"
                } bg-slate-950`}
            onMouseEnter={() => {
                if (hoverTimeout) clearTimeout(hoverTimeout);
                const timeout = setTimeout(() => setIsHovered(true), 200);
                setHoverTimeout(timeout);
            }}
            onMouseLeave={() => {
                if (hoverTimeout) clearTimeout(hoverTimeout);
                setIsHovered(false);
                setExpandedGroups([]);
            }}
        >
            {/* Brand / Logo */}
            <div className="h-16 flex items-center justify-center border-b border-slate-800/60 px-4">
                <div className={`flex items-center gap-3 w-full ${!isExpanded && 'justify-center'}`}>
                    <div className="h-8 w-8 rounded bg-teal-600 flex items-center justify-center flex-shrink-0">
                        <span className="text-white font-bold text-sm">H</span>
                    </div>
                    {isExpanded && (
                        <span className="font-semibold text-slate-100 truncate">
                            HandwerkOS
                        </span>
                    )}
                </div>
            </div>

            {/* Navigation Areas */}
            <div className="flex-1 overflow-y-auto py-4 px-2 custom-scrollbar">

                {/* Main Nav */}
                <div className="mb-6">
                    {isExpanded && <div className="px-3 mb-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">Übersicht</div>}
                    <div className="space-y-0.5">
                        {mainNavigation.map(item => renderNavItem(item))}
                    </div>
                </div>

                {/* Secondary Nav */}
                <div className="mb-6">
                    {isExpanded && <div className="px-3 mb-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">Betrieb</div>}
                    <div className="space-y-0.5">
                        {secondaryNavigation.map(item => renderNavItem(item, true))}
                    </div>
                </div>

            </div>

            {/* Bottom Area: User / Profile / Settings via Popover */}
            <div className="p-2 border-t border-slate-800/60 bg-slate-900/30">
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <button className={`w-full flex items-center ${isExpanded ? 'justify-between px-3' : 'justify-center'} py-2.5 rounded-md hover:bg-slate-800 transition-colors`}>
                            <div className="flex items-center gap-3">
                                <div className="h-8 w-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center flex-shrink-0">
                                    <UserCircle className="h-5 w-5 text-slate-300" />
                                </div>
                                {isExpanded && (
                                    <div className="text-left">
                                        <p className="text-sm font-medium text-slate-200 leading-tight">Admin</p>
                                        <p className="text-xs text-slate-500">Manager</p>
                                    </div>
                                )}
                            </div>
                            {isExpanded && <MoreVertical className="h-4 w-4 text-slate-500" />}
                        </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" side="right" className="w-56 bg-slate-900 border-slate-800 text-slate-200" sideOffset={16}>
                        <DropdownMenuLabel className="text-slate-400 font-normal">Account</DropdownMenuLabel>
                        <DropdownMenuItem className="focus:bg-slate-800 focus:text-slate-100 cursor-pointer" onClick={() => onModuleChange('company-settings')}>
                            <Settings className="mr-2 h-4 w-4 text-slate-400" />
                            <span>Einstellungen</span>
                        </DropdownMenuItem>
                        <DropdownMenuItem className="focus:bg-slate-800 focus:text-slate-100 cursor-pointer" onClick={() => onModuleChange('documents')}>
                            <Receipt className="mr-2 h-4 w-4 text-slate-400" />
                            <span>Abrechnung & Pläne</span>
                        </DropdownMenuItem>
                        <DropdownMenuSeparator className="bg-slate-800" />
                        <DropdownMenuItem className="focus:bg-red-950/30 focus:text-red-400 text-red-400 cursor-pointer" onClick={handleSignOut}>
                            <LogOut className="mr-2 h-4 w-4" />
                            <span>Abmelden</span>
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>

        </div>
    );
}
