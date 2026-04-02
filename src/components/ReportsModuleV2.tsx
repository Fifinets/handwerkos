import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import {
  BarChart3,
  TrendingUp,
  TrendingDown,
  Euro,
  Clock,
  Users,
  FileText,
  Download,
  Calendar,
  Building2,
  Package,
  Receipt,
  Filter,
  RefreshCw,
  ChevronRight,
  ArrowUpRight,
  ArrowDownRight,
  PieChart as PieChartIcon,
  Target,
  Briefcase,
  CheckCircle2,
  AlertTriangle,
  Wallet
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, Legend, Area, AreaChart
} from 'recharts';
import { UtilizationTrendsTab } from './reports/UtilizationTrendsTab';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useSupabaseAuth } from '@/hooks/useSupabaseAuth';
import { format, subMonths, startOfMonth, endOfMonth, startOfYear, endOfYear, subYears } from 'date-fns';
import { de } from 'date-fns/locale';

// Types
interface RevenueData {
  month: string;
  revenue: number;
  expenses: number;
  profit: number;
}

interface ProjectStats {
  status: string;
  count: number;
  budget: number;
}

interface EmployeeStats {
  id: string;
  name: string;
  totalHours: number;
  projectCount: number;
  avgHoursPerProject: number;
}

interface CustomerStats {
  id: string;
  name: string;
  projectCount: number;
  totalRevenue: number;
  avgProjectValue: number;
}

interface InvoiceStats {
  status: string;
  count: number;
  amount: number;
}

const COLORS = ['#0ea5e9', '#10b981', '#f59e0b', '#f43f5e', '#8b5cf6', '#ec4899'];
const STATUS_COLORS: Record<string, string> = {
  'draft': '#94a3b8',
  'sent': '#3b82f6',
  'paid': '#10b981',
  'overdue': '#f43f5e',
  'anfrage': '#94a3b8',
  'in_bearbeitung': '#f59e0b',
  'abgeschlossen': '#10b981',
  'storniert': '#f43f5e'
};

const ReportsModuleV2: React.FC = () => {
  const { toast } = useToast();
  const { companyId } = useSupabaseAuth();
  const [activeTab, setActiveTab] = useState('overview');
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState('this-year');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');

  // Data states
  const [revenueData, setRevenueData] = useState<RevenueData[]>([]);
  const [projectStats, setProjectStats] = useState<ProjectStats[]>([]);
  const [employeeStats, setEmployeeStats] = useState<EmployeeStats[]>([]);
  const [customerStats, setCustomerStats] = useState<CustomerStats[]>([]);
  const [invoiceStats, setInvoiceStats] = useState<InvoiceStats[]>([]);

  // Summary KPIs
  const [kpis, setKpis] = useState({
    totalRevenue: 0,
    totalExpenses: 0,
    totalProfit: 0,
    profitMargin: 0,
    totalProjects: 0,
    completedProjects: 0,
    totalHours: 0,
    avgHourlyRate: 0,
    openInvoices: 0,
    paidInvoices: 0,
    overdueAmount: 0,
    avgProjectValue: 0
  });

  const getDateRange = useCallback(() => {
    const now = new Date();
    switch (timeRange) {
      case 'this-month':
        return { start: startOfMonth(now), end: endOfMonth(now) };
      case 'last-month':
        return { start: startOfMonth(subMonths(now, 1)), end: endOfMonth(subMonths(now, 1)) };
      case 'this-year':
        return { start: startOfYear(now), end: endOfYear(now) };
      case 'last-year':
        return { start: startOfYear(subYears(now, 1)), end: endOfYear(subYears(now, 1)) };
      case 'custom':
        return {
          start: customStartDate ? new Date(customStartDate) : startOfYear(now),
          end: customEndDate ? new Date(customEndDate) : now
        };
      default:
        return { start: startOfYear(now), end: now };
    }
  }, [timeRange, customStartDate, customEndDate]);

  const loadAllData = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);

    try {
      const { start, end } = getDateRange();
      const startStr = start.toISOString();
      const endStr = end.toISOString();

      // Load revenue data (monthly)
      const { data: invoicesData } = await supabase
        .from('invoices')
        .select('invoice_date, gross_amount, net_amount, status')
        .eq('company_id', companyId)
        .gte('invoice_date', startStr.split('T')[0])
        .lte('invoice_date', endStr.split('T')[0]);

      const { data: expensesData } = await supabase
        .from('expenses')
        .select('expense_date, amount')
        .eq('company_id', companyId)
        .gte('expense_date', startStr.split('T')[0])
        .lte('expense_date', endStr.split('T')[0]);

      // Process monthly revenue data
      const monthlyData: Record<string, { revenue: number; expenses: number }> = {};

      // Initialize months
      const months = [];
      let current = new Date(start);
      while (current <= end) {
        const monthKey = format(current, 'yyyy-MM');
        monthlyData[monthKey] = { revenue: 0, expenses: 0 };
        months.push(monthKey);
        current = new Date(current.setMonth(current.getMonth() + 1));
      }

      // Aggregate invoices
      (invoicesData || []).forEach(inv => {
        if (inv.invoice_date && inv.status === 'paid') {
          const monthKey = inv.invoice_date.substring(0, 7);
          if (monthlyData[monthKey]) {
            monthlyData[monthKey].revenue += inv.gross_amount || 0;
          }
        }
      });

      // Aggregate expenses
      (expensesData || []).forEach(exp => {
        if (exp.expense_date) {
          const monthKey = exp.expense_date.substring(0, 7);
          if (monthlyData[monthKey]) {
            monthlyData[monthKey].expenses += exp.amount || 0;
          }
        }
      });

      const revenueChartData: RevenueData[] = months.map(month => ({
        month: format(new Date(month + '-01'), 'MMM yy', { locale: de }),
        revenue: monthlyData[month].revenue,
        expenses: monthlyData[month].expenses,
        profit: monthlyData[month].revenue - monthlyData[month].expenses
      }));
      setRevenueData(revenueChartData);

      // Calculate total KPIs
      const totalRevenue = Object.values(monthlyData).reduce((sum, m) => sum + m.revenue, 0);
      const totalExpenses = Object.values(monthlyData).reduce((sum, m) => sum + m.expenses, 0);

      // Load project stats
      const { data: projectsData } = await supabase
        .from('projects')
        .select('id, status, budget_planned')
        .eq('company_id', companyId);

      const projectStatusMap: Record<string, { count: number; budget: number }> = {};
      (projectsData || []).forEach(p => {
        const status = p.status || 'unbekannt';
        if (!projectStatusMap[status]) {
          projectStatusMap[status] = { count: 0, budget: 0 };
        }
        projectStatusMap[status].count++;
        projectStatusMap[status].budget += p.budget_planned || 0;
      });

      const projectStatsData: ProjectStats[] = Object.entries(projectStatusMap).map(([status, data]) => ({
        status,
        count: data.count,
        budget: data.budget
      }));
      setProjectStats(projectStatsData);

      // Load employee hours
      const { data: timeEntriesData } = await supabase
        .from('time_entries')
        .select('employee_id, project_id, start_time, end_time, break_duration')
        .eq('company_id', companyId)
        .gte('start_time', startStr)
        .lte('start_time', endStr);

      const { data: employeesData } = await supabase
        .from('employees')
        .select('id, first_name, last_name')
        .eq('company_id', companyId);

      const employeeMap: Record<string, { name: string; hours: number; projects: Set<string> }> = {};
      (employeesData || []).forEach(emp => {
        employeeMap[emp.id] = {
          name: `${emp.first_name || ''} ${emp.last_name || ''}`.trim(),
          hours: 0,
          projects: new Set()
        };
      });

      let totalHours = 0;
      (timeEntriesData || []).forEach(te => {
        if (te.employee_id && employeeMap[te.employee_id]) {
          let hours = 0;
          if (te.start_time && te.end_time) {
            const startTime = new Date(te.start_time).getTime();
            const endTime = new Date(te.end_time).getTime();
            hours = Math.max(0, (endTime - startTime - (te.break_duration || 0) * 60 * 1000) / (1000 * 60 * 60));
          }
          employeeMap[te.employee_id].hours += hours;
          if (te.project_id) {
            employeeMap[te.employee_id].projects.add(te.project_id);
          }
          totalHours += hours;
        }
      });

      const employeeStatsData: EmployeeStats[] = Object.entries(employeeMap)
        .map(([id, data]) => ({
          id,
          name: data.name || 'Unbekannt',
          totalHours: Math.round(data.hours * 10) / 10,
          projectCount: data.projects.size,
          avgHoursPerProject: data.projects.size > 0 ? Math.round(data.hours / data.projects.size * 10) / 10 : 0
        }))
        .filter(e => e.totalHours > 0)
        .sort((a, b) => b.totalHours - a.totalHours);
      setEmployeeStats(employeeStatsData);

      // Load customer stats
      const { data: customersData } = await supabase
        .from('customers')
        .select('id, company_name')
        .eq('company_id', companyId);

      const { data: customerProjectsData } = await supabase
        .from('projects')
        .select('customer_id, budget_planned')
        .eq('company_id', companyId);

      const { data: customerInvoicesData } = await supabase
        .from('invoices')
        .select('customer_id, gross_amount, status')
        .eq('company_id', companyId)
        .eq('status', 'paid');

      const customerMap: Record<string, { name: string; projects: number; revenue: number }> = {};
      (customersData || []).forEach(c => {
        customerMap[c.id] = { name: c.company_name || 'Unbekannt', projects: 0, revenue: 0 };
      });

      (customerProjectsData || []).forEach(p => {
        if (p.customer_id && customerMap[p.customer_id]) {
          customerMap[p.customer_id].projects++;
        }
      });

      (customerInvoicesData || []).forEach(inv => {
        if (inv.customer_id && customerMap[inv.customer_id]) {
          customerMap[inv.customer_id].revenue += inv.gross_amount || 0;
        }
      });

      const customerStatsData: CustomerStats[] = Object.entries(customerMap)
        .map(([id, data]) => ({
          id,
          name: data.name,
          projectCount: data.projects,
          totalRevenue: data.revenue,
          avgProjectValue: data.projects > 0 ? data.revenue / data.projects : 0
        }))
        .filter(c => c.totalRevenue > 0 || c.projectCount > 0)
        .sort((a, b) => b.totalRevenue - a.totalRevenue);
      setCustomerStats(customerStatsData);

      // Invoice stats by status
      const invoiceStatusMap: Record<string, { count: number; amount: number }> = {};
      (invoicesData || []).forEach(inv => {
        const status = inv.status || 'unbekannt';
        if (!invoiceStatusMap[status]) {
          invoiceStatusMap[status] = { count: 0, amount: 0 };
        }
        invoiceStatusMap[status].count++;
        invoiceStatusMap[status].amount += inv.gross_amount || 0;
      });

      const invoiceStatsData: InvoiceStats[] = Object.entries(invoiceStatusMap).map(([status, data]) => ({
        status,
        count: data.count,
        amount: data.amount
      }));
      setInvoiceStats(invoiceStatsData);

      // Update KPIs
      const completedProjects = projectStatsData.find(p => p.status === 'abgeschlossen')?.count || 0;
      const openInvoicesCount = invoiceStatsData.filter(i => ['draft', 'sent'].includes(i.status)).reduce((sum, i) => sum + i.count, 0);
      const paidInvoicesCount = invoiceStatsData.find(i => i.status === 'paid')?.count || 0;
      const overdueAmount = invoiceStatsData.find(i => i.status === 'overdue')?.amount || 0;

      setKpis({
        totalRevenue,
        totalExpenses,
        totalProfit: totalRevenue - totalExpenses,
        profitMargin: totalRevenue > 0 ? ((totalRevenue - totalExpenses) / totalRevenue) * 100 : 0,
        totalProjects: projectsData?.length || 0,
        completedProjects,
        totalHours: Math.round(totalHours),
        avgHourlyRate: totalHours > 0 ? totalRevenue / totalHours : 0,
        openInvoices: openInvoicesCount,
        paidInvoices: paidInvoicesCount,
        overdueAmount,
        avgProjectValue: (projectsData?.length || 0) > 0 ? totalRevenue / (projectsData?.length || 1) : 0
      });

    } catch (error) {
      console.error('Error loading report data:', error);
      toast({
        title: "Fehler",
        description: "Berichtsdaten konnten nicht geladen werden.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  }, [companyId, getDateRange, toast]);

  useEffect(() => {
    loadAllData();
  }, [loadAllData]);

  const formatCurrency = (amount: number) => {
    return amount.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' });
  };

  const formatPercent = (value: number) => {
    return `${value.toFixed(1)}%`;
  };

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      'draft': 'Entwurf',
      'sent': 'Versendet',
      'paid': 'Bezahlt',
      'overdue': 'Überfällig',
      'anfrage': 'Anfrage',
      'besichtigung': 'Besichtigung',
      'angebot': 'Angebot',
      'beauftragt': 'Beauftragt',
      'in_bearbeitung': 'In Bearbeitung',
      'abgeschlossen': 'Abgeschlossen',
      'storniert': 'Storniert'
    };
    return labels[status] || status;
  };

  const handleExport = () => {
    toast({
      title: "Export",
      description: "Export-Funktion wird vorbereitet..."
    });
    // TODO: Implement CSV/PDF export
  };

  // Custom tooltip for charts
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-3 border border-slate-200 rounded-lg shadow-lg">
          <p className="text-sm font-medium text-slate-700 mb-1">{label}</p>
          {payload.map((entry: any, index: number) => (
            <p key={index} className="text-sm" style={{ color: entry.color }}>
              {entry.name}: {formatCurrency(entry.value)}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="p-6 space-y-6 bg-slate-50/50 min-h-screen">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Berichte & Statistiken</h1>
          <p className="text-sm text-slate-500 mt-1">Detaillierte Auswertungen und Analysen</p>
        </div>

        <div className="flex items-center gap-3">
          <Select value={timeRange} onValueChange={setTimeRange}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Zeitraum" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="this-month">Dieser Monat</SelectItem>
              <SelectItem value="last-month">Letzter Monat</SelectItem>
              <SelectItem value="this-year">Dieses Jahr</SelectItem>
              <SelectItem value="last-year">Letztes Jahr</SelectItem>
              <SelectItem value="custom">Benutzerdefiniert</SelectItem>
            </SelectContent>
          </Select>

          {timeRange === 'custom' && (
            <>
              <Input
                type="date"
                value={customStartDate}
                onChange={(e) => setCustomStartDate(e.target.value)}
                className="w-[140px]"
              />
              <span className="text-slate-400">bis</span>
              <Input
                type="date"
                value={customEndDate}
                onChange={(e) => setCustomEndDate(e.target.value)}
                className="w-[140px]"
              />
            </>
          )}

          <Button variant="outline" size="icon" onClick={loadAllData} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>

          <Button variant="outline" onClick={handleExport}>
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="bg-white border border-slate-200 p-1">
          <TabsTrigger value="overview" className="data-[state=active]:bg-slate-100">
            <BarChart3 className="h-4 w-4 mr-2" />
            Übersicht
          </TabsTrigger>
          <TabsTrigger value="revenue" className="data-[state=active]:bg-slate-100">
            <Euro className="h-4 w-4 mr-2" />
            Umsatz
          </TabsTrigger>
          <TabsTrigger value="projects" className="data-[state=active]:bg-slate-100">
            <Briefcase className="h-4 w-4 mr-2" />
            Projekte
          </TabsTrigger>
          <TabsTrigger value="employees" className="data-[state=active]:bg-slate-100">
            <Users className="h-4 w-4 mr-2" />
            Mitarbeiter
          </TabsTrigger>
          <TabsTrigger value="customers" className="data-[state=active]:bg-slate-100">
            <Building2 className="h-4 w-4 mr-2" />
            Kunden
          </TabsTrigger>
          <TabsTrigger value="auslastung" className="data-[state=active]:bg-slate-100">
            <TrendingUp className="h-4 w-4 mr-2" />
            Auslastung
          </TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="mt-6 space-y-6">
          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-32" />)}
            </div>
          ) : (
            <>
              {/* KPI Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card className="bg-gradient-to-br from-emerald-50 to-white border-emerald-100">
                  <CardContent className="p-5">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs font-medium text-emerald-600 uppercase tracking-wider">Gesamtumsatz</p>
                        <p className="text-2xl font-bold text-emerald-700 mt-1">{formatCurrency(kpis.totalRevenue)}</p>
                        <div className="flex items-center gap-1 mt-2">
                          <span className="text-xs text-slate-500">{kpis.paidInvoices} bezahlte Rechnungen</span>
                        </div>
                      </div>
                      <div className="h-12 w-12 rounded-xl bg-emerald-100 flex items-center justify-center">
                        <TrendingUp className="h-6 w-6 text-emerald-600" />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-gradient-to-br from-blue-50 to-white border-blue-100">
                  <CardContent className="p-5">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs font-medium text-blue-600 uppercase tracking-wider">Gewinn</p>
                        <p className="text-2xl font-bold text-blue-700 mt-1">{formatCurrency(kpis.totalProfit)}</p>
                        <div className="flex items-center gap-1 mt-2">
                          <Badge variant="secondary" className="bg-blue-100 text-blue-700 text-xs">
                            {formatPercent(kpis.profitMargin)} Marge
                          </Badge>
                        </div>
                      </div>
                      <div className="h-12 w-12 rounded-xl bg-blue-100 flex items-center justify-center">
                        <Wallet className="h-6 w-6 text-blue-600" />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-gradient-to-br from-amber-50 to-white border-amber-100">
                  <CardContent className="p-5">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs font-medium text-amber-600 uppercase tracking-wider">Projekte</p>
                        <p className="text-2xl font-bold text-amber-700 mt-1">{kpis.totalProjects}</p>
                        <div className="flex items-center gap-1 mt-2">
                          <span className="text-xs text-slate-500">{kpis.completedProjects} abgeschlossen</span>
                        </div>
                      </div>
                      <div className="h-12 w-12 rounded-xl bg-amber-100 flex items-center justify-center">
                        <Briefcase className="h-6 w-6 text-amber-600" />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-gradient-to-br from-purple-50 to-white border-purple-100">
                  <CardContent className="p-5">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs font-medium text-purple-600 uppercase tracking-wider">Arbeitsstunden</p>
                        <p className="text-2xl font-bold text-purple-700 mt-1">{kpis.totalHours.toLocaleString('de-DE')}h</p>
                        <div className="flex items-center gap-1 mt-2">
                          <span className="text-xs text-slate-500">{formatCurrency(kpis.avgHourlyRate)}/Std.</span>
                        </div>
                      </div>
                      <div className="h-12 w-12 rounded-xl bg-purple-100 flex items-center justify-center">
                        <Clock className="h-6 w-6 text-purple-600" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Charts Row */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Revenue Chart */}
                <Card className="bg-white border-slate-200">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base font-semibold text-slate-800">Umsatz & Ausgaben</CardTitle>
                    <CardDescription>Monatliche Entwicklung</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="h-[300px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={revenueData}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                          <XAxis dataKey="month" tick={{ fontSize: 12 }} stroke="#94a3b8" />
                          <YAxis tick={{ fontSize: 12 }} stroke="#94a3b8" tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                          <Tooltip content={<CustomTooltip />} />
                          <Legend />
                          <Bar dataKey="revenue" name="Umsatz" fill="#10b981" radius={[4, 4, 0, 0]} />
                          <Bar dataKey="expenses" name="Ausgaben" fill="#f43f5e" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>

                {/* Project Status Pie */}
                <Card className="bg-white border-slate-200">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base font-semibold text-slate-800">Projektstatus</CardTitle>
                    <CardDescription>Verteilung nach Status</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="h-[300px] flex items-center">
                      <ResponsiveContainer width="60%" height="100%">
                        <PieChart>
                          <Pie
                            data={projectStats}
                            dataKey="count"
                            nameKey="status"
                            cx="50%"
                            cy="50%"
                            outerRadius={100}
                            label={({ name, percent }) => `${(percent * 100).toFixed(0)}%`}
                            labelLine={false}
                          >
                            {projectStats.map((entry, index) => (
                              <Cell key={entry.status} fill={STATUS_COLORS[entry.status] || COLORS[index % COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip formatter={(value, name) => [value, getStatusLabel(name as string)]} />
                        </PieChart>
                      </ResponsiveContainer>
                      <div className="w-[40%] space-y-2">
                        {projectStats.slice(0, 6).map((stat, index) => (
                          <div key={stat.status} className="flex items-center justify-between text-sm">
                            <div className="flex items-center gap-2">
                              <div
                                className="w-3 h-3 rounded-full"
                                style={{ backgroundColor: STATUS_COLORS[stat.status] || COLORS[index % COLORS.length] }}
                              />
                              <span className="text-slate-600">{getStatusLabel(stat.status)}</span>
                            </div>
                            <span className="font-medium text-slate-800">{stat.count}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Invoice Overview */}
              <Card className="bg-white border-slate-200">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base font-semibold text-slate-800">Rechnungsübersicht</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {invoiceStats.map(stat => (
                      <div key={stat.status} className="p-4 rounded-xl bg-slate-50 border border-slate-100">
                        <div className="flex items-center gap-2 mb-2">
                          <div
                            className="w-2 h-2 rounded-full"
                            style={{ backgroundColor: STATUS_COLORS[stat.status] || '#94a3b8' }}
                          />
                          <span className="text-sm text-slate-600">{getStatusLabel(stat.status)}</span>
                        </div>
                        <p className="text-xl font-bold text-slate-800">{stat.count}</p>
                        <p className="text-sm text-slate-500">{formatCurrency(stat.amount)}</p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>

        {/* Revenue Tab */}
        <TabsContent value="revenue" className="mt-6 space-y-6">
          {loading ? (
            <Skeleton className="h-[400px]" />
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card className="bg-white border-slate-200">
                  <CardContent className="p-5">
                    <p className="text-sm text-slate-500">Einnahmen</p>
                    <p className="text-2xl font-bold text-emerald-600">{formatCurrency(kpis.totalRevenue)}</p>
                  </CardContent>
                </Card>
                <Card className="bg-white border-slate-200">
                  <CardContent className="p-5">
                    <p className="text-sm text-slate-500">Ausgaben</p>
                    <p className="text-2xl font-bold text-red-500">{formatCurrency(kpis.totalExpenses)}</p>
                  </CardContent>
                </Card>
                <Card className="bg-white border-slate-200">
                  <CardContent className="p-5">
                    <p className="text-sm text-slate-500">Gewinn</p>
                    <p className={`text-2xl font-bold ${kpis.totalProfit >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                      {formatCurrency(kpis.totalProfit)}
                    </p>
                  </CardContent>
                </Card>
              </div>

              <Card className="bg-white border-slate-200">
                <CardHeader>
                  <CardTitle className="text-base">Gewinnentwicklung</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-[350px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={revenueData}>
                        <defs>
                          <linearGradient id="profitGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                            <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                        <XAxis dataKey="month" tick={{ fontSize: 12 }} stroke="#94a3b8" />
                        <YAxis tick={{ fontSize: 12 }} stroke="#94a3b8" tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                        <Tooltip content={<CustomTooltip />} />
                        <Area type="monotone" dataKey="profit" name="Gewinn" stroke="#10b981" fill="url(#profitGradient)" strokeWidth={2} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>

        {/* Projects Tab */}
        <TabsContent value="projects" className="mt-6 space-y-6">
          {loading ? (
            <Skeleton className="h-[400px]" />
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card className="bg-white border-slate-200">
                  <CardContent className="p-5">
                    <p className="text-sm text-slate-500">Gesamt</p>
                    <p className="text-2xl font-bold text-slate-800">{kpis.totalProjects}</p>
                  </CardContent>
                </Card>
                <Card className="bg-white border-slate-200">
                  <CardContent className="p-5">
                    <p className="text-sm text-slate-500">Abgeschlossen</p>
                    <p className="text-2xl font-bold text-emerald-600">{kpis.completedProjects}</p>
                  </CardContent>
                </Card>
                <Card className="bg-white border-slate-200">
                  <CardContent className="p-5">
                    <p className="text-sm text-slate-500">Durchschn. Projektwert</p>
                    <p className="text-2xl font-bold text-blue-600">{formatCurrency(kpis.avgProjectValue)}</p>
                  </CardContent>
                </Card>
                <Card className="bg-white border-slate-200">
                  <CardContent className="p-5">
                    <p className="text-sm text-slate-500">Gesamtbudget</p>
                    <p className="text-2xl font-bold text-amber-600">
                      {formatCurrency(projectStats.reduce((sum, p) => sum + p.budget, 0))}
                    </p>
                  </CardContent>
                </Card>
              </div>

              <Card className="bg-white border-slate-200">
                <CardHeader>
                  <CardTitle className="text-base">Projekte nach Status</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={projectStats} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                        <XAxis type="number" tick={{ fontSize: 12 }} stroke="#94a3b8" />
                        <YAxis
                          dataKey="status"
                          type="category"
                          tick={{ fontSize: 12 }}
                          stroke="#94a3b8"
                          tickFormatter={getStatusLabel}
                          width={120}
                        />
                        <Tooltip formatter={(value, name) => [value, name === 'count' ? 'Anzahl' : 'Budget']} />
                        <Bar dataKey="count" fill="#3b82f6" radius={[0, 4, 4, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>

        {/* Employees Tab */}
        <TabsContent value="employees" className="mt-6 space-y-6">
          {loading ? (
            <Skeleton className="h-[400px]" />
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card className="bg-white border-slate-200">
                  <CardContent className="p-5">
                    <p className="text-sm text-slate-500">Gesamtstunden</p>
                    <p className="text-2xl font-bold text-slate-800">{kpis.totalHours.toLocaleString('de-DE')}h</p>
                  </CardContent>
                </Card>
                <Card className="bg-white border-slate-200">
                  <CardContent className="p-5">
                    <p className="text-sm text-slate-500">Aktive Mitarbeiter</p>
                    <p className="text-2xl font-bold text-blue-600">{employeeStats.length}</p>
                  </CardContent>
                </Card>
                <Card className="bg-white border-slate-200">
                  <CardContent className="p-5">
                    <p className="text-sm text-slate-500">Durchschn. Stunden/Mitarbeiter</p>
                    <p className="text-2xl font-bold text-purple-600">
                      {employeeStats.length > 0 ? Math.round(kpis.totalHours / employeeStats.length) : 0}h
                    </p>
                  </CardContent>
                </Card>
              </div>

              <Card className="bg-white border-slate-200">
                <CardHeader>
                  <CardTitle className="text-base">Mitarbeiter-Auslastung</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {employeeStats.slice(0, 10).map((emp, index) => (
                      <div key={emp.id} className="flex items-center gap-4">
                        <div className="w-8 text-sm text-slate-400 text-right">{index + 1}.</div>
                        <div className="flex-1">
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-medium text-slate-700">{emp.name}</span>
                            <span className="text-sm text-slate-500">{emp.totalHours}h / {emp.projectCount} Projekte</span>
                          </div>
                          <Progress
                            value={Math.min((emp.totalHours / (employeeStats[0]?.totalHours || 1)) * 100, 100)}
                            className="h-2"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>

        {/* Customers Tab */}
        <TabsContent value="customers" className="mt-6 space-y-6">
          {loading ? (
            <Skeleton className="h-[400px]" />
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card className="bg-white border-slate-200">
                  <CardContent className="p-5">
                    <p className="text-sm text-slate-500">Kunden mit Umsatz</p>
                    <p className="text-2xl font-bold text-slate-800">{customerStats.length}</p>
                  </CardContent>
                </Card>
                <Card className="bg-white border-slate-200">
                  <CardContent className="p-5">
                    <p className="text-sm text-slate-500">Gesamtumsatz</p>
                    <p className="text-2xl font-bold text-emerald-600">{formatCurrency(kpis.totalRevenue)}</p>
                  </CardContent>
                </Card>
                <Card className="bg-white border-slate-200">
                  <CardContent className="p-5">
                    <p className="text-sm text-slate-500">Durchschn. Umsatz/Kunde</p>
                    <p className="text-2xl font-bold text-blue-600">
                      {formatCurrency(customerStats.length > 0 ? kpis.totalRevenue / customerStats.length : 0)}
                    </p>
                  </CardContent>
                </Card>
              </div>

              <Card className="bg-white border-slate-200">
                <CardHeader>
                  <CardTitle className="text-base">Top Kunden nach Umsatz</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {customerStats.slice(0, 10).map((cust, index) => (
                      <div key={cust.id} className="flex items-center gap-4 p-3 rounded-lg bg-slate-50 hover:bg-slate-100 transition-colors">
                        <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-sm font-bold text-blue-600">
                          {index + 1}
                        </div>
                        <div className="flex-1">
                          <p className="font-medium text-slate-700">{cust.name}</p>
                          <p className="text-xs text-slate-500">{cust.projectCount} Projekte</p>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-slate-800">{formatCurrency(cust.totalRevenue)}</p>
                          <p className="text-xs text-slate-500">
                            {formatCurrency(cust.avgProjectValue)} / Projekt
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>

        {/* Auslastung Tab */}
        <TabsContent value="auslastung" className="mt-6 space-y-6">
          <UtilizationTrendsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default ReportsModuleV2;
