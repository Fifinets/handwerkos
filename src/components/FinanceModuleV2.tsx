import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
    Euro,
    FileText,
    TrendingUp,
    TrendingDown,
    Calendar,
    AlertTriangle,
    CheckCircle,
    Plus,
    Receipt,
    BarChart3,
    FileSpreadsheet,
    Settings,
    Download,
    Filter,
    Search,
    ArrowUpRight,
    ArrowDownRight
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { FinancialStats, MonthlyRevenue, Invoice, Expense } from "@/types/financial";
import {
    useInvoices,
    useFinancialKpis,
    useExpenses,
    useCreateInvoice
} from "@/hooks/useApi";
import { supabase } from "@/integrations/supabase/client";

interface InvoiceDisplay {
    id: string | number;
    invoice_number: string;
    title: string;
    total_amount: number;
    status: string;
    invoice_date: string;
    due_date: string;
    customers?: {
        company_name: string;
        contact_person: string;
    };
}

const FinanceModuleV2 = () => {
    const { toast } = useToast();

    // React Query hooks
    const { data: invoicesResponse, isLoading: invoicesLoading } = useInvoices();
    const { data: expensesResponse, isLoading: expensesLoading } = useExpenses();
    const { data: financialKPIs, isLoading: kpisLoading } = useFinancialKpis();

    // Local state
    const [activeTab, setActiveTab] = useState('dashboard');
    const [monthlyData, setMonthlyData] = useState<MonthlyRevenue[]>([]);
    const [invoices, setInvoices] = useState<InvoiceDisplay[]>([]);
    const [expenses, setExpenses] = useState<Expense[]>([]);
    const [stats, setStats] = useState<FinancialStats>({
        monthly_revenue: 0,
        monthly_expenses: 0,
        monthly_profit: 0,
        total_outstanding: 0,
        overdue_count: 0,
        active_projects_profit: 0,
        avg_profit_margin: 0,
        revenue_trend: 0,
        expense_trend: 0,
        profit_trend: 0
    });

    const loading = invoicesLoading || expensesLoading || kpisLoading;

    useEffect(() => {
        fetchMonthlyData();
        fetchInvoices();
    }, []);

    const fetchMonthlyData = async () => {
        const mockMonthlyData: MonthlyRevenue[] = [
            { month: '2024-08', revenue: 22000, expenses: 16000, profit: 6000 },
            { month: '2024-09', revenue: 28000, expenses: 19000, profit: 9000 },
            { month: '2024-10', revenue: 31000, expenses: 22000, profit: 9000 },
            { month: '2024-11', revenue: 26000, expenses: 18500, profit: 7500 },
            { month: '2024-12', revenue: 35000, expenses: 24000, profit: 11000 },
            { month: '2025-01', revenue: 25000, expenses: 18000, profit: 7000 },
        ];
        setMonthlyData(mockMonthlyData);
    };

    const fetchInvoices = async () => {
        const mockData = getMockInvoices();
        setInvoices(mockData);

        // Simulate API fetch delay
        setTimeout(() => {
            calculateStats(mockData, expensesResponse?.items || []);
        }, 500);
    };

    const getMockInvoices = () => {
        return [
            {
                id: '1',
                invoice_number: 'RE-2025-001',
                title: 'Badezimmer-Sanierung Familie Weber',
                total_amount: 8500.00,
                status: 'Versendet',
                invoice_date: '2025-01-15',
                due_date: '2025-02-14',
                customers: {
                    company_name: 'Familie Weber',
                    contact_person: 'Thomas Weber'
                }
            },
            {
                id: '2',
                invoice_number: 'RE-2025-002',
                title: 'Küchenumbau Müller GmbH',
                total_amount: 15200.00,
                status: 'Bezahlt',
                invoice_date: '2025-01-12',
                due_date: '2025-02-11',
                customers: {
                    company_name: 'Müller GmbH',
                    contact_person: 'Sandra Müller'
                }
            },
            {
                id: '3',
                invoice_number: 'RE-2025-003',
                title: 'Dacharbeiten Neubau Schmidt',
                total_amount: 12800.00,
                status: 'Offen',
                invoice_date: '2025-01-08',
                due_date: '2025-01-25',
                customers: {
                    company_name: 'Bauunternehmen Schmidt',
                    contact_person: 'Klaus Schmidt'
                }
            }
        ];
    };

    const calculateStats = (invoicesData: InvoiceDisplay[], expensesData: any[]) => {
        // Basic mock calculations since we're redesigning the UI
        setStats({
            monthly_revenue: 28450,
            monthly_expenses: 12300,
            monthly_profit: 16150,
            total_outstanding: 21300,
            overdue_count: 1,
            active_projects_profit: 34500,
            avg_profit_margin: 32.5,
            revenue_trend: 12.5,
            expense_trend: -3.2,
            profit_trend: 23.1
        });
    };

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('de-DE', {
            style: 'currency',
            currency: 'EUR',
            minimumFractionDigits: 0,
            maximumFractionDigits: 0
        }).format(amount);
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'Bezahlt': return 'bg-emerald-50 text-emerald-700 border-emerald-200';
            case 'Versendet':
            case 'Offen': return 'bg-amber-50 text-amber-700 border-amber-200';
            case 'Storniert': return 'bg-slate-100 text-slate-700 border-slate-200';
            case 'Entwurf': return 'bg-slate-50 text-blue-700 border-blue-200';
            default: return 'bg-slate-100 text-slate-700 border-slate-200';
        }
    };

    const isOverdue = (invoice: InvoiceDisplay) => {
        const today = new Date();
        const dueDate = new Date(invoice.due_date);
        return dueDate < today && (invoice.status === 'Versendet' || invoice.status === 'Offen');
    };

    if (loading && invoices.length === 0) {
        return (
            <div className="p-6 max-w-[1600px] mx-auto w-full h-full">
                <div className="flex items-center justify-between mb-8">
                    <Skeleton className="h-8 w-64" />
                    <Skeleton className="h-10 w-32" />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
                    {Array(4).fill(0).map((_, i) => (
                        <Skeleton key={i} className="h-28 w-full rounded-xl" />
                    ))}
                </div>
            </div>
        );
    }

    return (
        <div className="p-6 space-y-6 max-w-[1600px] mx-auto">
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-semibold text-slate-900">Finanzen</h1>
                    <p className="text-sm text-slate-500 mt-1">Umsätze, Ausgaben und offene Posten im Überblick.</p>
                </div>
                <div className="flex items-center gap-3 w-full sm:w-auto">
                    <Button variant="outline" className="bg-white border-slate-200 hidden sm:flex">
                        <FileSpreadsheet className="h-4 w-4 mr-2" />
                        Datev Export
                    </Button>
                    <Button className="bg-slate-900 hover:bg-slate-800 text-white w-full sm:w-auto">
                        <Plus className="h-4 w-4 mr-2" />
                        Neue Rechnung
                    </Button>
                </div>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card className="bg-white border-slate-200 shadow-sm">
                    <CardContent className="p-5">
                        <div className="flex justify-between items-start">
                            <div>
                                <p className="text-sm font-medium text-slate-500">Umsatz (Monat)</p>
                                <h3 className="text-3xl font-bold text-slate-900 mt-2">{formatCurrency(stats.monthly_revenue)}</h3>
                            </div>
                            <div className="p-2 bg-emerald-50 rounded-lg">
                                <TrendingUp className="h-5 w-5 text-emerald-600" />
                            </div>
                        </div>
                        <div className="mt-4 flex items-center text-sm">
                            <span className="flex items-center text-emerald-600 font-medium">
                                <ArrowUpRight className="h-4 w-4 mr-1" />
                                {stats.revenue_trend}%
                            </span>
                            <span className="text-slate-500 ml-2">vs. Vormonat</span>
                        </div>
                    </CardContent>
                </Card>

                <Card className="bg-white border-slate-200 shadow-sm">
                    <CardContent className="p-5">
                        <div className="flex justify-between items-start">
                            <div>
                                <p className="text-sm font-medium text-slate-500">Ausgaben (Monat)</p>
                                <h3 className="text-3xl font-bold text-slate-900 mt-2">{formatCurrency(stats.monthly_expenses)}</h3>
                            </div>
                            <div className="p-2 bg-rose-50 rounded-lg">
                                <TrendingDown className="h-5 w-5 text-rose-600" />
                            </div>
                        </div>
                        <div className="mt-4 flex items-center text-sm">
                            <span className="flex items-center text-emerald-600 font-medium">
                                <ArrowDownRight className="h-4 w-4 mr-1" />
                                {Math.abs(stats.expense_trend)}%
                            </span>
                            <span className="text-slate-500 ml-2">vs. Vormonat</span>
                        </div>
                    </CardContent>
                </Card>

                <Card className="bg-white border-slate-200 shadow-sm">
                    <CardContent className="p-5">
                        <div className="flex justify-between items-start">
                            <div>
                                <p className="text-sm font-medium text-slate-500">Gewinn (Monat)</p>
                                <h3 className="text-3xl font-bold text-slate-600 mt-2">{formatCurrency(stats.monthly_profit)}</h3>
                            </div>
                            <div className="p-2 bg-slate-50 rounded-lg">
                                <Euro className="h-5 w-5 text-slate-600" />
                            </div>
                        </div>
                        <div className="mt-4 flex items-center text-sm">
                            <span className="flex items-center text-emerald-600 font-medium">
                                <ArrowUpRight className="h-4 w-4 mr-1" />
                                {stats.profit_trend}%
                            </span>
                            <span className="text-slate-500 ml-2">vs. Vormonat</span>
                        </div>
                    </CardContent>
                </Card>

                <Card className="bg-white border-slate-200 shadow-sm">
                    <CardContent className="p-5">
                        <div className="flex justify-between items-start">
                            <div>
                                <p className="text-sm font-medium text-slate-500">Offene Forderungen</p>
                                <h3 className="text-3xl font-bold text-amber-600 mt-2">{formatCurrency(stats.total_outstanding)}</h3>
                            </div>
                            <div className="p-2 bg-amber-50 rounded-lg">
                                <AlertTriangle className="h-5 w-5 text-amber-600" />
                            </div>
                        </div>
                        <div className="mt-4 flex items-center text-sm">
                            <span className="flex items-center text-rose-600 font-medium">
                                {stats.overdue_count} überfällig
                            </span>
                            <span className="text-slate-500 ml-2">Rechnungen</span>
                        </div>
                    </CardContent>
                </Card>
            </div>

            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <TabsList className="bg-slate-100/50 p-1 mb-6 border border-slate-200">
                    <TabsTrigger value="dashboard" className="data-[state=active]:bg-white data-[state=active]:shadow-sm">Übersicht</TabsTrigger>
                    <TabsTrigger value="invoices" className="data-[state=active]:bg-white data-[state=active]:shadow-sm">Rechnungen</TabsTrigger>
                    <TabsTrigger value="expenses" className="data-[state=active]:bg-white data-[state=active]:shadow-sm">Ausgaben</TabsTrigger>
                    <TabsTrigger value="taxes" className="data-[state=active]:bg-white data-[state=active]:shadow-sm">Steuern</TabsTrigger>
                </TabsList>

                <TabsContent value="dashboard" className="m-0">
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        {/* Chart Area */}
                        <Card className="lg:col-span-2 bg-white border-slate-200 shadow-sm">
                            <CardHeader className="border-b border-slate-100 pb-4">
                                <CardTitle className="text-lg font-semibold text-slate-800">Einnahmen & Ausgaben</CardTitle>
                                <CardDescription>Die finanzielle Entwicklung der letzten 6 Monate</CardDescription>
                            </CardHeader>
                            <CardContent className="p-6">
                                <div className="space-y-6">
                                    {monthlyData.map((data, index) => {
                                        const month = new Date(data.month + '-01').toLocaleDateString('de-DE', {
                                            month: 'long',
                                            year: 'numeric'
                                        });
                                        const maxValue = Math.max(...monthlyData.map(d => Math.max(d.revenue, d.expenses)));
                                        const revenueWidth = (data.revenue / maxValue) * 100;
                                        const expenseWidth = (data.expenses / maxValue) * 100;

                                        return (
                                            <div key={index} className="space-y-2">
                                                <div className="flex justify-between text-sm">
                                                    <span className="font-medium text-slate-700">{month}</span>
                                                    <span className="font-medium text-slate-900">
                                                        Gewinn: {formatCurrency(data.profit)}
                                                    </span>
                                                </div>
                                                <div className="h-4 w-full flex rounded-full overflow-hidden bg-slate-100 relative">
                                                    <div
                                                        className="h-full bg-emerald-400 absolute left-0"
                                                        style={{ width: `${revenueWidth}%` }}
                                                    />
                                                    <div
                                                        className="h-full bg-rose-400 absolute left-0 opacity-80"
                                                        style={{ width: `${expenseWidth}%` }}
                                                    />
                                                </div>
                                                <div className="flex justify-between text-xs text-slate-500">
                                                    <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-emerald-400"></div> Umsatz: {formatCurrency(data.revenue)}</span>
                                                    <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-rose-400"></div> Ausgaben: {formatCurrency(data.expenses)}</span>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </CardContent>
                        </Card>

                        {/* Quick Actions & Pending Invoices */}
                        <div className="space-y-6">
                            <Card className="bg-white border-slate-200 shadow-sm">
                                <CardHeader className="border-b border-slate-100 pb-4">
                                    <CardTitle className="text-lg font-semibold text-slate-800">Aktionen</CardTitle>
                                </CardHeader>
                                <CardContent className="p-4 space-y-2">
                                    <Button variant="outline" className="w-full justify-start bg-slate-50 border-slate-200 hover:bg-slate-100 text-slate-700">
                                        <FileText className="h-4 w-4 mr-3 text-slate-500" />
                                        Rechnung schreiben
                                    </Button>
                                    <Button variant="outline" className="w-full justify-start bg-slate-50 border-slate-200 hover:bg-slate-100 text-slate-700">
                                        <Receipt className="h-4 w-4 mr-3 text-rose-500" />
                                        Beleg erfassen
                                    </Button>
                                    <Button variant="outline" className="w-full justify-start bg-slate-50 border-slate-200 hover:bg-slate-100 text-slate-700">
                                        <Plus className="h-4 w-4 mr-3 text-emerald-500" />
                                        Geldeingang verbuchen
                                    </Button>
                                </CardContent>
                            </Card>

                            <Card className="bg-white border-slate-200 shadow-sm">
                                <CardHeader className="border-b border-slate-100 pb-4">
                                    <CardTitle className="text-lg font-semibold text-slate-800">Aktuelle Rechnungen</CardTitle>
                                </CardHeader>
                                <CardContent className="p-0 divide-y divide-slate-100">
                                    {invoices.slice(0, 3).map((invoice) => (
                                        <div key={invoice.id} className="p-4 hover:bg-slate-50 transition-colors">
                                            <div className="flex justify-between items-start mb-1">
                                                <span className="font-medium text-slate-900 text-sm">{invoice.customers?.company_name}</span>
                                                <span className="font-semibold text-slate-900 text-sm">{formatCurrency(invoice.total_amount)}</span>
                                            </div>
                                            <div className="flex justify-between items-center text-xs">
                                                <span className="text-slate-500">{invoice.invoice_number}</span>
                                                <Badge variant="outline" className={`text-[10px] ${getStatusColor(isOverdue(invoice) ? 'Überfällig' : invoice.status)}`}>
                                                    {isOverdue(invoice) ? 'Überfällig' : invoice.status}
                                                </Badge>
                                            </div>
                                        </div>
                                    ))}
                                </CardContent>
                            </Card>
                        </div>
                    </div>
                </TabsContent>

                <TabsContent value="invoices" className="m-0">
                    <Card className="bg-white border-slate-200 shadow-sm">
                        <CardHeader className="border-b border-slate-100 pb-4 flex flex-row items-center justify-between">
                            <CardTitle className="text-lg font-semibold text-slate-800">Alle Rechnungen</CardTitle>
                            <div className="flex gap-2">
                                <div className="relative">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                                    <Input placeholder="Suchen..." className="pl-9 w-[200px] h-8 text-sm" />
                                </div>
                                <Button variant="outline" size="sm" className="h-8">Filter</Button>
                            </div>
                        </CardHeader>
                        <CardContent className="p-0">
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm text-left">
                                    <thead className="bg-slate-50 text-slate-500 font-medium border-b border-slate-100">
                                        <tr>
                                            <th className="px-5 py-3 font-medium">Rechnungs-Nr.</th>
                                            <th className="px-5 py-3 font-medium">Kunde / Projekt</th>
                                            <th className="px-5 py-3 font-medium">Datum</th>
                                            <th className="px-5 py-3 font-medium">Fällig</th>
                                            <th className="px-5 py-3 font-medium">Status</th>
                                            <th className="px-5 py-3 font-medium text-right">Betrag</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {invoices.map((invoice) => {
                                            const overdue = isOverdue(invoice);
                                            return (
                                                <tr key={invoice.id} className="hover:bg-slate-50/80 transition-colors">
                                                    <td className="px-5 py-4 font-medium text-slate-900">{invoice.invoice_number}</td>
                                                    <td className="px-5 py-4">
                                                        <div className="text-slate-900 font-medium">{invoice.customers?.company_name}</div>
                                                        <div className="text-xs text-slate-500 truncate max-w-[200px]">{invoice.title}</div>
                                                    </td>
                                                    <td className="px-5 py-4 text-slate-500">{new Date(invoice.invoice_date).toLocaleDateString('de-DE')}</td>
                                                    <td className={`px-5 py-4 ${overdue ? 'text-rose-600 font-medium' : 'text-slate-500'}`}>
                                                        {new Date(invoice.due_date).toLocaleDateString('de-DE')}
                                                    </td>
                                                    <td className="px-5 py-4">
                                                        <Badge variant="outline" className={`font-normal ${getStatusColor(overdue ? 'Überfällig' : invoice.status)}`}>
                                                            {overdue ? 'Überfällig' : invoice.status}
                                                        </Badge>
                                                    </td>
                                                    <td className="px-5 py-4 text-right font-semibold text-slate-900">
                                                        {formatCurrency(invoice.total_amount)}
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* Fillers for the rest of tabs to avoid empty states */}
                <TabsContent value="expenses" className="m-0">
                    <Card className="bg-white border-slate-200 shadow-sm p-12 text-center text-slate-500">
                        Beleg- und Ausgabenverwaltung wird geladen...
                    </Card>
                </TabsContent>

                <TabsContent value="taxes" className="m-0">
                    <Card className="bg-white border-slate-200 shadow-sm p-12 text-center text-slate-500">
                        Steuerübersicht und DATEV-Export wird geladen...
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    );
};

export default FinanceModuleV2;

