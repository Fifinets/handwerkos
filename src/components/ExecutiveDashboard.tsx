/**
 * ExecutiveDashboard - Zentrale Steuerzentrale für den Handwerksbetrieb-Chef
 * 
 * Zeigt alle kritischen Informationen auf einen Blick:
 * - Überfällige Tasks und Warnungen
 * - Finanzielle KPIs mit Trends
 * - Aktuelle Projekte mit Status
 * - Schnellaktionen für häufige Workflows
 */

import React, { useState, useEffect } from 'react';
import { LucideIcon } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  AlertTriangle, 
  TrendingUp, 
  TrendingDown, 
  Euro, 
  Clock, 
  CheckCircle, 
  FileText,
  Users,
  Calendar,
  Building2,
  ArrowRight,
  Plus,
  Eye,
  Zap,
  Target,
  DollarSign,
  AlertCircle,
  Mail,
  Wrench
} from 'lucide-react';
import { workflowService } from '@/services/WorkflowService';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface DashboardData {
  // Kritische Aufmerksamkeits-Items
  criticalAlerts: {
    budgetWarnings: number;
    overdueProjects: number;
    overdueInvoices: number;
    pendingQuotes: number;
  };
  
  // Finanzielle KPIs
  financialKPIs: {
    monthlyRevenue: number;
    monthlyExpenses: number;
    profit: number;
    profitMargin: number;
    outstandingAmount: number;
    revenuetrend: number; // Prozent Änderung zum Vormonat
  };
  
  // Projekt-Status
  projectStatus: {
    active: number;
    planning: number;
    completed: number;
    delayed: number;
  };
  
  // Team-Übersicht
  teamOverview: {
    activeEmployees: number;
    todayHours: number;
    utilizationRate: number;
  };
}

interface QuickAction {
  id: string;
  title: string;
  description: string;
  icon: LucideIcon;
  color: string;
  onClick: () => void;
}

interface CriticalItem {
  id: string;
  type: string;
  title: string;
  description?: string;
  severity?: 'low' | 'medium' | 'high';
  created_at?: string;
}

interface ExecutiveDashboardProps {
  onNavigate?: (moduleId: string) => void;
}

const ExecutiveDashboard: React.FC<ExecutiveDashboardProps> = ({ onNavigate }) => {
  const [dashboardData, setDashboardData] = useState<DashboardData>({
    criticalAlerts: {
      budgetWarnings: 0,
      overdueProjects: 0,
      overdueInvoices: 0,
      pendingQuotes: 0,
    },
    financialKPIs: {
      monthlyRevenue: 0,
      monthlyExpenses: 0,
      profit: 0,
      profitMargin: 0,
      outstandingAmount: 0,
      revenuetrend: 0,
    },
    projectStatus: {
      active: 0,
      planning: 0,
      completed: 0,
      delayed: 0,
    },
    teamOverview: {
      activeEmployees: 0,
      todayHours: 0,
      utilizationRate: 0,
    },
  });
  
  const [loading, setLoading] = useState(true);
  const [criticalItems, setCriticalItems] = useState<CriticalItem[]>([]);
  const { toast } = useToast();

  useEffect(() => {
    loadDashboardData();
    const interval = setInterval(loadDashboardData, 5 * 60 * 1000); // Refresh alle 5 Minuten
    return () => clearInterval(interval);
  }, []);

  const loadDashboardData = async () => {
    try {
      setLoading(true);

      // Parallele Datenabfrage für Performance
      const [
        criticalData,
        projectData,
        financialData,
        teamData
      ] = await Promise.all([
        workflowService.getDashboardCriticalData(),
        loadProjectData(),
        loadFinancialData(),
        loadTeamData(),
      ]);

      setCriticalItems(criticalData.overdueTasks);

      setDashboardData({
        criticalAlerts: {
          budgetWarnings: criticalData.budgetWarnings.length,
          overdueProjects: criticalData.delayedProjects.length,
          overdueInvoices: criticalData.overdueInvoices.length,
          pendingQuotes: criticalData.pendingQuotes.length,
        },
        financialKPIs: financialData,
        projectStatus: projectData,
        teamOverview: teamData,
      });

    } catch (error) {
      console.error('❌ Error loading dashboard data:', error);
      toast({
        title: 'Fehler beim Laden',
        description: 'Dashboard-Daten konnten nicht geladen werden.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const loadProjectData = async () => {
    const { data: projects } = await supabase
      .from('projects')
      .select('status, end_date');

    const today = new Date().toISOString().split('T')[0];
    const counts = {
      active: 0,
      planning: 0,
      completed: 0,
      delayed: 0,
    };

    projects?.forEach(project => {
      switch (project.status) {
        case 'in_bearbeitung':
          counts.active++;
          break;
        case 'geplant':
        case 'anfrage':
        case 'besichtigung':
          counts.planning++;
          break;
        case 'abgeschlossen':
          counts.completed++;
          break;
      }

      // Verspätete Projekte
      if (project.end_date && project.end_date < today && project.status !== 'abgeschlossen') {
        counts.delayed++;
      }
    });

    return counts;
  };

  const loadFinancialData = async () => {
    // Mock-Daten für Demo - in Produktion aus FinanceModule laden
    return {
      monthlyRevenue: 45000,
      monthlyExpenses: 32000,
      profit: 13000,
      profitMargin: 28.9,
      outstandingAmount: 8500,
      revenuetrend: 12.5, // +12.5% zum Vormonat
    };
  };

  const loadTeamData = async () => {
    const { data: employees } = await supabase
      .from('employees')
      .select('status')
      .neq('status', 'eingeladen');

    return {
      activeEmployees: employees?.length || 0,
      todayHours: 67.5, // Mock - aus TimeTracking laden
      utilizationRate: 85, // Mock - berechnet aus geplanten vs. tatsächlichen Stunden
    };
  };

  const quickActions: QuickAction[] = [
    {
      id: 'new-quote',
      title: 'Neues Angebot',
      description: 'Angebot für Kunden erstellen',
      icon: FileText,
      color: 'bg-blue-500',
      onClick: () => onNavigate?.('finance'),
    },
    {
      id: 'new-project',
      title: 'Projekt anlegen',
      description: 'Direktes Projekt erstellen',
      icon: Building2,
      color: 'bg-green-500',
      onClick: () => onNavigate?.('projects'),
    },
    {
      id: 'check-finances',
      title: 'Finanzen prüfen',
      description: 'Rechnungen und Ausgaben',
      icon: Euro,
      color: 'bg-purple-500',
      onClick: () => onNavigate?.('finance'),
    },
    {
      id: 'team-overview',
      title: 'Team Status',
      description: 'Mitarbeiter und Zeiten',
      icon: Users,
      color: 'bg-orange-500',
      onClick: () => onNavigate?.('personal'),
    },
  ];

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('de-DE', {
      style: 'currency',
      currency: 'EUR',
    }).format(amount);
  };

  const getCriticalAlertCount = () => {
    return Object.values(dashboardData.criticalAlerts).reduce((sum, count) => sum + count, 0);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fadeIn p-6 bg-gray-50 min-h-screen">
      {/* Dashboard Header */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
            <p className="text-gray-600">Zentrale Übersicht Ihres Handwerksbetriebs</p>
          </div>
          
          {getCriticalAlertCount() > 0 && (
            <div className="flex items-center gap-2 px-4 py-3 bg-red-50 border border-red-100 rounded-xl">
              <AlertTriangle className="h-5 w-5 text-red-500" />
              <span className="text-red-700 font-medium">
                {getCriticalAlertCount()} Punkte benötigen Aufmerksamkeit
              </span>
            </div>
          )}
        </div>
      </div>

      {/* KPI-Header für Dashboard */}
      <div className="grid grid-cols-4 gap-6">
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <div className="text-center">
            <div className="text-3xl font-bold text-blue-600">{dashboardData.projectStatus.active + dashboardData.projectStatus.planning}</div>
            <div className="text-gray-600 mt-1">Offene Aufträge</div>
          </div>
        </div>
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <div className="text-center">
            <div className="text-3xl font-bold text-green-600">{formatCurrency(dashboardData.financialKPIs.monthlyRevenue)}</div>
            <div className="text-gray-600 mt-1">Monatsumsatz</div>
          </div>
        </div>
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <div className="text-center">
            <div className="text-3xl font-bold text-orange-600">{dashboardData.criticalAlerts.pendingQuotes}</div>
            <div className="text-gray-600 mt-1">Offene Angebote</div>
          </div>
        </div>
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <div className="text-center">
            <div className="text-3xl font-bold text-purple-600">{dashboardData.teamOverview.activeEmployees}</div>
            <div className="text-gray-600 mt-1">Mitarbeiter</div>
          </div>
        </div>
      </div>

      {/* Dashboard Hauptbereich */}
      <div className="grid grid-cols-12 gap-6">
        {/* Linke Spalte - Dashboard Content */}
        <div className="col-span-8 space-y-6">
          {/* Finanzübersicht */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100">
            <div className="p-6 border-b border-gray-100">
              <h2 className="text-xl font-semibold text-gray-900">Finanzübersicht</h2>
            </div>
            <div className="p-6">
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <div className="text-sm text-gray-600 mb-1">Umsatz</div>
                  <div className="text-2xl font-bold text-green-600">{formatCurrency(dashboardData.financialKPIs.monthlyRevenue)}</div>
                </div>
                <div>
                  <div className="text-sm text-gray-600 mb-1">Gewinn</div>
                  <div className="text-2xl font-bold text-blue-600">{formatCurrency(dashboardData.financialKPIs.profit)}</div>
                </div>
              </div>
              <div className="mt-6 p-4 bg-gray-50 rounded-xl">
                <div className="flex items-center justify-between">
                  <span className="text-gray-700">Gewinnmarge</span>
                  <span className="font-semibold text-gray-900">{dashboardData.financialKPIs.profitMargin}%</span>
                </div>
              </div>
            </div>
          </div>

          {/* Schnellaktionen */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100">
            <div className="p-6 border-b border-gray-100">
              <h2 className="text-xl font-semibold text-gray-900">Schnellaktionen</h2>
            </div>
            <div className="p-6">
              <div className="grid grid-cols-2 gap-4">
                {quickActions.map((action) => (
                  <button
                    key={action.id}
                    onClick={action.onClick}
                    className="flex items-center gap-4 p-4 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors text-left"
                  >
                    <div className={`p-3 rounded-lg ${action.color}`}>
                      <action.icon className="h-6 w-6 text-white" />
                    </div>
                    <div>
                      <div className="font-medium text-gray-900">{action.title}</div>
                      <div className="text-sm text-gray-500">{action.description}</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Rechte Spalte - Dashboard Sidebar */}
        <div className="col-span-4 space-y-6">
          {/* Projektstatus */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <h3 className="font-semibold text-gray-900 mb-4">Projektstatus</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                  <span className="text-sm text-gray-700">Anfrage</span>
                </div>
                <span className="text-sm font-medium">{dashboardData.projectStatus.planning}</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-green-500"></div>
                  <span className="text-sm text-gray-700">In Bearbeitung</span>
                </div>
                <span className="text-sm font-medium">{dashboardData.projectStatus.active}</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-gray-400"></div>
                  <span className="text-sm text-gray-700">Abgeschlossen</span>
                </div>
                <span className="text-sm font-medium">{dashboardData.projectStatus.completed}</span>
              </div>
            </div>
          </div>

          {/* Team Übersicht */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <h3 className="font-semibold text-gray-900 mb-4">Team Übersicht</h3>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-gray-700">Aktive Mitarbeiter</span>
                <span className="font-medium">{dashboardData.teamOverview.activeEmployees}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-700">Stunden heute</span>
                <span className="font-medium">{dashboardData.teamOverview.todayHours}h</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-700">Auslastung</span>
                <span className="font-medium">{dashboardData.teamOverview.utilizationRate}%</span>
              </div>
            </div>
          </div>

          {/* Heute / Termine */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <h3 className="font-semibold text-gray-900 mb-4">Heute</h3>
            <div className="text-center py-4">
              <p className="text-gray-500">Keine Termine für heute</p>
            </div>
          </div>
        </div>
      </div>

      <Tabs defaultValue="kpis" className="w-full hidden">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="kpis">Kennzahlen</TabsTrigger>
          <TabsTrigger value="overview">Übersicht</TabsTrigger>
          <TabsTrigger value="financial">Finanzen</TabsTrigger>
          <TabsTrigger value="projects">Projekte</TabsTrigger>
          <TabsTrigger value="actions">Schnellaktionen</TabsTrigger>
        </TabsList>

        <TabsContent value="kpis" className="space-y-6">
          {/* 1. Aktuelle Kennzahlen (KPIs) - Original Dashboard Style */}
          <div>
            <h2 className="text-xl font-semibold mb-4">📊 Aktuelle Kennzahlen</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
              <Card className="cursor-pointer hover:bg-muted/50" onClick={() => onNavigate?.('projects')}>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Wrench className="w-5 h-5 text-blue-600" />
                    <span className="font-medium">Offene Aufträge</span>
                  </div>
                  <p className="text-2xl font-bold text-blue-600">{dashboardData.projectStatus.active + dashboardData.projectStatus.planning}</p>
                  <p className="text-sm text-muted-foreground">in Bearbeitung</p>
                </CardContent>
              </Card>

              <Card className="cursor-pointer hover:bg-muted/50" onClick={() => onNavigate?.('emails')}>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Mail className="w-5 h-5 text-green-600" />
                    <span className="font-medium">Ungelesene E-Mails</span>
                  </div>
                  <p className="text-2xl font-bold text-green-600">0</p>
                  <p className="text-sm text-muted-foreground">neue Anfragen</p>
                </CardContent>
              </Card>

              <Card className="cursor-pointer hover:bg-muted/50" onClick={() => onNavigate?.('finance')}>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <FileText className="w-5 h-5 text-orange-600" />
                    <span className="font-medium">Offene Angebote</span>
                  </div>
                  <p className="text-2xl font-bold text-orange-600">{dashboardData.criticalAlerts.pendingQuotes}</p>
                  <p className="text-sm text-muted-foreground">versendet</p>
                </CardContent>
              </Card>

              <Card className="cursor-pointer hover:bg-muted/50" onClick={() => onNavigate?.('finance')}>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Euro className="w-5 h-5 text-red-600" />
                    <span className="font-medium">Offene Rechnungen</span>
                  </div>
                  <p className="text-2xl font-bold text-red-600">{dashboardData.criticalAlerts.overdueInvoices}</p>
                  <p className="text-sm text-muted-foreground">{formatCurrency(dashboardData.financialKPIs.outstandingAmount)}</p>
                </CardContent>
              </Card>

              <Card className="cursor-pointer hover:bg-muted/50" onClick={() => onNavigate?.('timetracking')}>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Clock className="w-5 h-5 text-purple-600" />
                    <span className="font-medium">Stunden heute</span>
                  </div>
                  <p className="text-2xl font-bold text-purple-600">{dashboardData.teamOverview.todayHours}</p>
                  <p className="text-sm text-muted-foreground">gearbeitet</p>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* 2. Heute / Nächste Termine */}
          <div>
            <h2 className="text-xl font-semibold mb-4">📅 Heute / Nächste Termine</h2>
            <Card>
              <CardContent className="p-4">
                <p className="text-muted-foreground">Keine Termine für heute</p>
              </CardContent>
            </Card>
          </div>

          {/* 3. Mitarbeiterübersicht & 4. Letzte E-Mails nebeneinander */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div>
              <h2 className="text-lg font-semibold mb-3">👥 Mitarbeiterübersicht</h2>
              <Card>
                <CardContent className="p-3">
                  <div className="space-y-2">
                    {dashboardData.teamOverview.activeEmployees > 0 ? (
                      <div className="flex items-center justify-between p-2 bg-muted/30 rounded-lg">
                        <div className="flex items-center gap-3">
                          <div className="w-2.5 h-2.5 rounded-full bg-green-500" />
                          <span className="font-medium text-sm">{dashboardData.teamOverview.activeEmployees} Mitarbeiter</span>
                        </div>
                        <Button variant="outline" size="sm" onClick={() => onNavigate?.('timetracking')}>
                          Zeitbericht
                        </Button>
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">Keine aktiven Mitarbeiter</p>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>

            <div>
              <h2 className="text-lg font-semibold mb-3">📨 Letzte E-Mails / Kundenanfragen</h2>
              <Card>
                <CardContent className="p-3">
                  <p className="text-sm text-muted-foreground">Keine neuen E-Mails</p>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="overview" className="space-y-6">
          {/* Haupt-KPIs */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">Monatsumsatz</p>
                    <p className="text-2xl font-bold text-green-600">
                      {formatCurrency(dashboardData.financialKPIs.monthlyRevenue)}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 text-green-600">
                    <TrendingUp className="h-4 w-4" />
                    <span className="text-sm font-medium">+{dashboardData.financialKPIs.revenuetrend}%</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">Gewinn</p>
                    <p className="text-2xl font-bold">
                      {formatCurrency(dashboardData.financialKPIs.profit)}
                    </p>
                  </div>
                  <Badge className="bg-blue-100 text-blue-800">
                    {dashboardData.financialKPIs.profitMargin}%
                  </Badge>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">Aktive Projekte</p>
                    <p className="text-2xl font-bold text-blue-600">
                      {dashboardData.projectStatus.active}
                    </p>
                  </div>
                  <Building2 className="h-8 w-8 text-blue-600" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">Team Auslastung</p>
                    <p className="text-2xl font-bold">
                      {dashboardData.teamOverview.utilizationRate}%
                    </p>
                  </div>
                  <Users className="h-8 w-8 text-purple-600" />
                </div>
                <Progress value={dashboardData.teamOverview.utilizationRate} className="mt-2" />
              </CardContent>
            </Card>
          </div>

          {/* Projekt-Status Übersicht */}
          <Card>
            <CardHeader>
              <CardTitle>Projekt-Pipeline</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center p-4 bg-yellow-50 rounded-lg">
                  <div className="text-2xl font-bold text-yellow-600">{dashboardData.projectStatus.planning}</div>
                  <div className="text-sm text-yellow-700">In Planung</div>
                </div>
                <div className="text-center p-4 bg-blue-50 rounded-lg">
                  <div className="text-2xl font-bold text-blue-600">{dashboardData.projectStatus.active}</div>
                  <div className="text-sm text-blue-700">In Bearbeitung</div>
                </div>
                <div className="text-center p-4 bg-green-50 rounded-lg">
                  <div className="text-2xl font-bold text-green-600">{dashboardData.projectStatus.completed}</div>
                  <div className="text-sm text-green-700">Abgeschlossen</div>
                </div>
                <div className="text-center p-4 bg-red-50 rounded-lg">
                  <div className="text-2xl font-bold text-red-600">{dashboardData.projectStatus.delayed}</div>
                  <div className="text-sm text-red-700">Verspätet</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="financial" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Finanzielle Kennzahlen</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between items-center">
                  <span>Umsatz</span>
                  <span className="font-bold text-green-600">
                    {formatCurrency(dashboardData.financialKPIs.monthlyRevenue)}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span>Ausgaben</span>
                  <span className="font-bold text-red-600">
                    {formatCurrency(dashboardData.financialKPIs.monthlyExpenses)}
                  </span>
                </div>
                <div className="flex justify-between items-center pt-2 border-t">
                  <span className="font-semibold">Gewinn</span>
                  <span className="font-bold text-lg">
                    {formatCurrency(dashboardData.financialKPIs.profit)}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span>Gewinnmarge</span>
                  <span className="font-bold">{dashboardData.financialKPIs.profitMargin}%</span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Ausstehende Beträge</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-orange-600 mb-2">
                  {formatCurrency(dashboardData.financialKPIs.outstandingAmount)}
                </div>
                <p className="text-sm text-gray-600">
                  Noch nicht bezahlte Rechnungen
                </p>
                <Button variant="outline" className="mt-4 w-full" onClick={() => onNavigate?.('finance')}>
                  <Euro className="h-4 w-4 mr-2" />
                  Rechnungen verwalten
                </Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="projects" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Projekt-Status Details</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
                    <span>Projekte in Planung</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold">{dashboardData.projectStatus.planning}</span>
                    <Button variant="ghost" size="sm" onClick={() => onNavigate?.('projects')}>
                      <Eye className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                
                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                    <span>Aktive Projekte</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold">{dashboardData.projectStatus.active}</span>
                    <Button variant="ghost" size="sm" onClick={() => onNavigate?.('projects')}>
                      <Eye className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                {dashboardData.projectStatus.delayed > 0 && (
                  <div className="flex items-center justify-between p-4 border rounded-lg bg-red-50">
                    <div className="flex items-center gap-3">
                      <AlertTriangle className="h-5 w-5 text-red-600" />
                      <span className="text-red-700">Verspätete Projekte</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-red-600">{dashboardData.projectStatus.delayed}</span>
                      <Button variant="ghost" size="sm" onClick={() => onNavigate?.('projects')}>
                        <Eye className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="actions" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className="h-5 w-5 text-yellow-500" />
                Schnellaktionen
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {quickActions.map((action) => (
                  <Button
                    key={action.id}
                    variant="outline"
                    className="h-auto p-4 justify-start"
                    onClick={action.onClick}
                  >
                    <div className={`p-2 rounded-lg ${action.color} mr-4`}>
                      <action.icon className="h-6 w-6 text-white" />
                    </div>
                    <div className="text-left">
                      <div className="font-semibold">{action.title}</div>
                      <div className="text-sm text-gray-500">{action.description}</div>
                    </div>
                    <ArrowRight className="h-4 w-4 ml-auto" />
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default ExecutiveDashboard;