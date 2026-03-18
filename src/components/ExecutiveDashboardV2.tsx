import React, { useState, useEffect } from 'react';
import { LucideIcon } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
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
    Eye,
    Zap,
    DollarSign,
    AlertCircle,
    Mail,
    Wrench,
    ShieldCheck,
    Crown
} from 'lucide-react';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    PieChart, Pie, Cell, LineChart, Line
} from 'recharts';
import { workflowService } from '@/services/WorkflowService';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useSupabaseAuth } from '@/hooks/useSupabaseAuth';
import { format, subMonths } from 'date-fns';
import { de } from 'date-fns/locale';

// --- Types ---
interface DashboardData {
    criticalAlerts: {
        budgetWarnings: number;
        overdueProjects: number;
        overdueInvoices: number;
        pendingQuotes: number;
    };
    financialKPIs: {
        monthlyRevenue: number;
        monthlyExpenses: number;
        profit: number;
        profitMargin: number;
        outstandingAmount: number;
        revenuetrend: number;
    };
    projectStatus: {
        active: number;
        planning: number;
        completed: number;
        delayed: number;
    };
    teamOverview: {
        activeEmployees: number;
        todayHours: number;
        utilizationRate: number;
    };
}

interface ExecutiveDashboardV2Props {
    onNavigate?: (moduleId: string) => void;
}

const COLORS = ['#0ea5e9', '#10b981', '#f59e0b', '#f43f5e'];

const ExecutiveDashboardV2: React.FC<ExecutiveDashboardV2Props> = ({ onNavigate }) => {
    const [timeframe, setTimeframe] = useState('this-month');
    const [loading, setLoading] = useState(true);
    const { toast } = useToast();
    const { companyId } = useSupabaseAuth();
    const [revenueChartData, setRevenueChartData] = useState<Array<{ name: string; revenue: number; expenses: number }>>([]);

    const [dashboardData, setDashboardData] = useState<DashboardData>({
        criticalAlerts: { budgetWarnings: 0, overdueProjects: 0, overdueInvoices: 0, pendingQuotes: 0 },
        financialKPIs: { monthlyRevenue: 0, monthlyExpenses: 0, profit: 0, profitMargin: 0, outstandingAmount: 0, revenuetrend: 0 },
        projectStatus: { active: 0, planning: 0, completed: 0, delayed: 0 },
        teamOverview: { activeEmployees: 0, todayHours: 0, utilizationRate: 0 },
    });

    useEffect(() => {
        loadDashboardData();
        const interval = setInterval(loadDashboardData, 5 * 60 * 1000);
        return () => clearInterval(interval);
    }, [companyId, timeframe]);

    const loadDashboardData = async () => {
        if (!companyId) return;
        try {
            setLoading(true);

            // Parallel queries
            const [invoicesRes, expensesRes, projectsRes, employeesRes, offersRes] = await Promise.all([
                supabase.from('invoices').select('id, invoice_date, gross_amount, net_amount, status, due_date').eq('company_id', companyId),
                supabase.from('expenses').select('id, expense_date, amount').eq('company_id', companyId),
                supabase.from('projects').select('id, status').eq('company_id', companyId),
                supabase.from('employees').select('id, status').eq('company_id', companyId).eq('status', 'Aktiv'),
                supabase.from('offers').select('id, status').eq('company_id', companyId).in('status', ['sent', 'pending', 'versendet']),
            ]);

            const invoices = invoicesRes.data || [];
            const expenses = expensesRes.data || [];
            const projects = projectsRes.data || [];
            const employees = employeesRes.data || [];
            const offers = offersRes.data || [];

            // Financial KPIs
            const now = new Date();
            const thisMonthStr = format(now, 'yyyy-MM');

            const thisMonthInvoices = invoices.filter(i => (i.invoice_date || '').startsWith(thisMonthStr));
            const monthlyRevenue = thisMonthInvoices.reduce((s, i) => s + (i.gross_amount || i.net_amount || 0), 0);

            const thisMonthExpenses = expenses.filter(e => (e.expense_date || '').startsWith(thisMonthStr));
            const monthlyExpenses = thisMonthExpenses.reduce((s, e) => s + (e.amount || 0), 0);

            const profit = monthlyRevenue - monthlyExpenses;
            const profitMargin = monthlyRevenue > 0 ? (profit / monthlyRevenue) * 100 : 0;

            const overdueInvoices = invoices.filter(i =>
                i.due_date && i.due_date < format(now, 'yyyy-MM-dd') && (i.status === 'sent' || i.status === 'issued')
            );
            const outstandingAmount = overdueInvoices.reduce((s, i) => s + (i.gross_amount || i.net_amount || 0), 0);

            // Project status
            const activeProjects = projects.filter(p => ['active', 'in_bearbeitung'].includes(p.status));
            const planningProjects = projects.filter(p => ['planning', 'geplant', 'planned'].includes(p.status));
            const completedProjects = projects.filter(p => ['completed', 'abgeschlossen'].includes(p.status));

            // Revenue chart: last 6 months
            const monthlyRevMap: Record<string, { revenue: number; expenses: number }> = {};
            for (let i = 5; i >= 0; i--) {
                const d = subMonths(now, i);
                const key = format(d, 'yyyy-MM');
                monthlyRevMap[key] = { revenue: 0, expenses: 0 };
            }
            invoices.forEach(inv => {
                const m = (inv.invoice_date || '').substring(0, 7);
                if (monthlyRevMap[m] !== undefined) {
                    monthlyRevMap[m].revenue += (inv.gross_amount || inv.net_amount || 0);
                }
            });
            expenses.forEach(exp => {
                const m = (exp.expense_date || '').substring(0, 7);
                if (monthlyRevMap[m] !== undefined) {
                    monthlyRevMap[m].expenses += (exp.amount || 0);
                }
            });

            const chartData = Object.entries(monthlyRevMap).sort(([a], [b]) => a.localeCompare(b)).map(([month, data]) => ({
                name: format(new Date(month + '-01'), 'MMM', { locale: de }),
                revenue: data.revenue,
                expenses: data.expenses,
            }));
            setRevenueChartData(chartData);

            setDashboardData({
                criticalAlerts: {
                    budgetWarnings: 0,
                    overdueProjects: 0,
                    overdueInvoices: overdueInvoices.length,
                    pendingQuotes: offers.length,
                },
                financialKPIs: {
                    monthlyRevenue,
                    monthlyExpenses,
                    profit,
                    profitMargin,
                    outstandingAmount,
                    revenuetrend: 0,
                },
                projectStatus: {
                    active: activeProjects.length,
                    planning: planningProjects.length,
                    completed: completedProjects.length,
                    delayed: 0,
                },
                teamOverview: {
                    activeEmployees: employees.length,
                    todayHours: 0,
                    utilizationRate: 0,
                },
            });
        } catch (error) {
            toast({ title: 'Fehler', description: 'Daten konnten nicht geladen werden.', variant: 'destructive' });
        } finally {
            setLoading(false);
        }
    };

    const projectPieData = [
        { name: 'In Planung', value: dashboardData.projectStatus.planning },
        { name: 'Aktiv', value: dashboardData.projectStatus.active },
        { name: 'Verspätet', value: dashboardData.projectStatus.delayed },
    ];

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(amount);
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[500px]">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-900"></div>
            </div>
        );
    }

    return (
        <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500">

            {/* Header Section with Timeframe Toggle */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Übersicht</h1>
                    <p className="text-slate-500 mt-1">Willkommen zurück. Hier ist der aktuelle Stand Ihres Betriebs.</p>
                </div>
                <div className="flex items-center gap-3 bg-white p-1 rounded-lg border shadow-sm">
                    <Button
                        variant={timeframe === 'this-month' ? 'default' : 'ghost'}
                        size="sm"
                        onClick={() => setTimeframe('this-month')}
                        className={timeframe === 'this-month' ? "bg-slate-900 text-white" : "text-slate-600"}
                    >
                        Dieser Monat
                    </Button>
                    <Button
                        variant={timeframe === 'last-month' ? 'default' : 'ghost'}
                        size="sm"
                        onClick={() => setTimeframe('last-month')}
                        className={timeframe === 'last-month' ? "bg-slate-900 text-white" : "text-slate-600"}
                    >
                        Letzter Monat
                    </Button>
                    <Button
                        variant={timeframe === 'this-year' ? 'default' : 'ghost'}
                        size="sm"
                        onClick={() => setTimeframe('this-year')}
                        className={timeframe === 'this-year' ? "bg-slate-900 text-white" : "text-slate-600"}
                    >
                        Dieses Jahr
                    </Button>
                </div>
            </div>

            {/* Top Level KPIs - Clean, high information density */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card className="border-slate-200 shadow-sm">
                    <CardContent className="p-5 flex flex-col justify-between h-full">
                        <div className="flex justify-between items-start mb-4">
                            <div className="text-sm font-medium text-slate-500">Umsatz</div>
                            <div className="p-2 bg-blue-50 text-blue-600 rounded-md"><Euro className="w-4 h-4" /></div>
                        </div>
                        <div>
                            <div className="text-2xl font-bold text-slate-900">{formatCurrency(dashboardData.financialKPIs.monthlyRevenue)}</div>
                            <div className="flex items-center text-sm font-medium text-teal-600 mt-1">
                                <TrendingUp className="w-3 h-3 mr-1" />
                                <span>+12.5% ggü. Vorzeitraum</span>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card className="border-slate-200 shadow-sm">
                    <CardContent className="p-5 flex flex-col justify-between h-full">
                        <div className="flex justify-between items-start mb-4">
                            <div className="text-sm font-medium text-slate-500">Aktive Projekte</div>
                            <div className="p-2 bg-indigo-50 text-indigo-600 rounded-md"><Building2 className="w-4 h-4" /></div>
                        </div>
                        <div>
                            <div className="text-2xl font-bold text-slate-900">{dashboardData.projectStatus.active}</div>
                            <div className="text-sm text-slate-500 mt-1">von {dashboardData.projectStatus.active + dashboardData.projectStatus.planning} total</div>
                        </div>
                    </CardContent>
                </Card>

                <Card className="border-slate-200 shadow-sm">
                    <CardContent className="p-5 flex flex-col justify-between h-full">
                        <div className="flex justify-between items-start mb-4">
                            <div className="text-sm font-medium text-slate-500">Offene Angebote</div>
                            <div className="p-2 bg-amber-50 text-amber-600 rounded-md"><FileText className="w-4 h-4" /></div>
                        </div>
                        <div>
                            <div className="text-2xl font-bold text-slate-900">{dashboardData.criticalAlerts.pendingQuotes}</div>
                            <div className="text-sm text-amber-600 font-medium mt-1">Warten auf Rückmeldung</div>
                        </div>
                    </CardContent>
                </Card>

                <Card className="border-slate-200 shadow-sm">
                    <CardContent className="p-5 flex flex-col justify-between h-full">
                        <div className="flex justify-between items-start mb-4">
                            <div className="text-sm font-medium text-slate-500">Team Auslastung</div>
                            <div className="p-2 bg-emerald-50 text-emerald-600 rounded-md"><Users className="w-4 h-4" /></div>
                        </div>
                        <div>
                            <div className="text-2xl font-bold text-slate-900">{dashboardData.teamOverview.utilizationRate}%</div>
                            <Progress value={dashboardData.teamOverview.utilizationRate} className="h-1.5 mt-2" indicatorClassName="bg-emerald-500" />
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Main Content Area - Charts & Complex Data */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                {/* Revenue Chart */}
                <Card className="lg:col-span-2 border-slate-200 shadow-sm">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-lg font-semibold text-slate-800">Umsatzentwicklung</CardTitle>
                        <CardDescription>Die Einnahmen und Ausgaben der letzten 6 Monate</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="h-[300px] w-full mt-4">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={revenueChartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748b' }} dy={10} />
                                    <YAxis
                                        axisLine={false}
                                        tickLine={false}
                                        tick={{ fill: '#64748b' }}
                                        tickFormatter={(value) => `€${value / 1000}k`}
                                    />
                                    <Tooltip
                                        cursor={{ fill: '#f1f5f9' }}
                                        contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                        formatter={(value: number) => [formatCurrency(value), '']}
                                    />
                                    <Bar dataKey="revenue" name="Einnahmen" fill="#0f172a" radius={[4, 4, 0, 0]} barSize={32} />
                                    <Bar dataKey="expenses" name="Ausgaben" fill="#94a3b8" radius={[4, 4, 0, 0]} barSize={32} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </CardContent>
                </Card>

                {/* Project Distribution Pie */}
                <Card className="border-slate-200 shadow-sm flex flex-col">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-lg font-semibold text-slate-800">Projektstatus</CardTitle>
                        <CardDescription>Aktuelle Verteilung</CardDescription>
                    </CardHeader>
                    <CardContent className="flex-1 flex flex-col justify-center">
                        <div className="h-[220px] w-full mt-2 relative">
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={projectPieData}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={60}
                                        outerRadius={80}
                                        paddingAngle={2}
                                        dataKey="value"
                                    >
                                        {projectPieData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                        ))}
                                    </Pie>
                                    <Tooltip
                                        contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                    />
                                </PieChart>
                            </ResponsiveContainer>
                            <div className="absolute inset-0 flex items-center justify-center flex-col pointer-events-none">
                                <span className="text-3xl font-bold text-slate-900">{dashboardData.projectStatus.active + dashboardData.projectStatus.planning}</span>
                                <span className="text-xs text-slate-500 uppercase tracking-widest mt-1">Total</span>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2 mt-6">
                            {projectPieData.map((item, i) => (
                                <div key={item.name} className="flex items-center text-sm">
                                    <div className="w-3 h-3 rounded-full mr-2" style={{ backgroundColor: COLORS[i % COLORS.length] }}></div>
                                    <span className="text-slate-600 truncate flex-1">{item.name}</span>
                                    <span className="font-semibold text-slate-900">{item.value}</span>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>

            </div>

            {/* Bottom Section - Actionable Items & Transparent Pricing */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                {/* Needs Attention */}
                <Card className="lg:col-span-2 border-slate-200 shadow-sm">
                    <CardHeader>
                        <CardTitle className="text-lg font-semibold flex items-center gap-2">
                            <AlertCircle className="w-5 h-5 text-rose-500" />
                            Aufgaben & Warnungen
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-4">
                            {dashboardData.criticalAlerts.overdueInvoices > 0 && (
                                <div className="flex items-center justify-between p-3 bg-rose-50 rounded-lg border border-rose-100">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 bg-rose-100 text-rose-600 rounded-md"><Euro className="w-4 h-4" /></div>
                                        <div>
                                            <p className="text-sm font-semibold text-rose-900">{dashboardData.criticalAlerts.overdueInvoices} Überfällige Rechnungen</p>
                                            <p className="text-xs text-rose-700">{formatCurrency(dashboardData.financialKPIs.outstandingAmount)} ausstehend</p>
                                        </div>
                                    </div>
                                    <Button size="sm" variant="outline" className="text-rose-700 border-rose-200 hover:bg-rose-100 bg-white shadow-sm" onClick={() => onNavigate?.('finance')}>
                                        Prüfen
                                    </Button>
                                </div>
                            )}

                            {dashboardData.criticalAlerts.overdueProjects > 0 && (
                                <div className="flex items-center justify-between p-3 bg-amber-50 rounded-lg border border-amber-100">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 bg-amber-100 text-amber-600 rounded-md"><Clock className="w-4 h-4" /></div>
                                        <div>
                                            <p className="text-sm font-semibold text-amber-900">{dashboardData.criticalAlerts.overdueProjects} Projekte in Verzug</p>
                                            <p className="text-xs text-amber-700">Zeitplan überprüfen</p>
                                        </div>
                                    </div>
                                    <Button size="sm" variant="outline" className="bg-white border-amber-200 text-amber-700 hover:bg-amber-100 shadow-sm" onClick={() => onNavigate?.('projects')}>
                                        Details
                                    </Button>
                                </div>
                            )}

                            {/* Just a filler to show how it looks without warnings */}
                            {dashboardData.criticalAlerts.overdueInvoices === 0 && dashboardData.criticalAlerts.overdueProjects === 0 && (
                                <div className="flex flex-col items-center justify-center p-6 text-center text-slate-500 bg-slate-50 rounded-lg border border-slate-100 border-dashed">
                                    <ShieldCheck className="w-8 h-8 text-teal-500 mb-2" />
                                    <p className="font-medium text-slate-700">Alles im grünen Bereich</p>
                                    <p className="text-sm mt-1">Derzeit keine kritischen Warnungen oder überfällige Aufgaben.</p>
                                </div>
                            )}
                        </div>
                    </CardContent>
                </Card>

                {/* Pricing / Upsell Block - Professional & Transparent */}
                <Card className="bg-gradient-to-br from-slate-900 to-slate-800 text-white border-none shadow-md overflow-hidden relative">
                    <div className="absolute top-0 right-0 p-4 opacity-10">
                        <Crown className="w-32 h-32" />
                    </div>
                    <CardHeader className="relative z-10 pb-0">
                        <div className="flex justify-between items-start">
                            <Badge className="bg-teal-500/20 text-teal-300 hover:bg-teal-500/30 border-none font-medium mb-2">Pro Plan</Badge>
                            <span className="text-xs font-medium text-slate-400">Verlängert sich in 14 Tagen</span>
                        </div>
                        <CardTitle className="text-xl">Plan & Kontingent</CardTitle>
                    </CardHeader>
                    <CardContent className="relative z-10 mt-4 space-y-6">

                        <div className="space-y-3">
                            <div>
                                <div className="flex justify-between text-sm mb-1">
                                    <span className="text-slate-300">Speicherplatz</span>
                                    <span className="font-medium">12 GB / 15 GB</span>
                                </div>
                                <Progress value={80} className="h-1.5 bg-slate-700" indicatorClassName="bg-teal-400" />
                            </div>
                            <div>
                                <div className="flex justify-between text-sm mb-1">
                                    <span className="text-slate-300">Monatliche Angebote</span>
                                    <span className="font-medium">42 / 50</span>
                                </div>
                                <Progress value={84} className="h-1.5 bg-slate-700" indicatorClassName="bg-amber-400" />
                            </div>
                        </div>

                        <div className="pt-4 border-t border-slate-700/50">
                            <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
                                <Zap className="w-4 h-4 text-teal-400" />
                                Upgrade auf Premium
                            </h4>
                            <ul className="text-xs text-slate-300 space-y-2 mb-4">
                                <li className="flex items-start gap-2">
                                    <CheckCircle className="w-3.5 h-3.5 text-teal-400 shrink-0 mt-0.5" />
                                    <span>Unbegrenzte Dokumente & Angebote</span>
                                </li>
                                <li className="flex items-start gap-2">
                                    <CheckCircle className="w-3.5 h-3.5 text-teal-400 shrink-0 mt-0.5" />
                                    <span>DATEV-Export & Erweiterte Finanzen</span>
                                </li>
                            </ul>
                            <Button className="w-full bg-white text-slate-900 hover:bg-slate-100 shadow-sm group">
                                Plan vergleichen
                                <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
                            </Button>
                        </div>
                    </CardContent>
                </Card>

            </div>
        </div>
    );
};

export default ExecutiveDashboardV2;
