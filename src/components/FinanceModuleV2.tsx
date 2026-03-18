import React, { useState, useMemo } from 'react';
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
    ArrowDownRight,
    ExternalLink
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
    useInvoices,
    useFinancialKpis,
    useExpenses,
    useCreateInvoice
} from "@/hooks/useApi";
import { FinancialKPIs } from "@/services/financeService";

const statusLabelMap: Record<string, string> = {
    draft: 'Entwurf',
    sent: 'Versendet',
    issued: 'Versendet',
    paid: 'Bezahlt',
    overdue: 'Überfällig',
    cancelled: 'Storniert',
    void: 'Storniert',
};

const FinanceModuleV2 = () => {
    const { toast } = useToast();

    // React Query hooks
    const { data: invoicesResponse, isLoading: invoicesLoading } = useInvoices();
    const { data: expensesResponse, isLoading: expensesLoading } = useExpenses();
    const { data: financialKPIs, isLoading: kpisLoading } = useFinancialKpis();

    // Local state
    const [activeTab, setActiveTab] = useState('dashboard');

    const loading = invoicesLoading || expensesLoading || kpisLoading;

    // Derive data from hooks
    const invoicesList = invoicesResponse?.items || [];
    const expensesList = expensesResponse?.items || [];
    const kpis = financialKPIs as FinancialKPIs | undefined;

    // Helper to get invoice amount (DB uses gross_amount, TS type uses amount)
    const getInvoiceAmount = (inv: any): number => {
        return inv.gross_amount || inv.amount || 0;
    };

    // Helper to get customer name from invoice
    const getCustomerName = (inv: any): string => {
        return inv.snapshot_customer_name || inv.customers?.company_name || '—';
    };

    // Map DB status to German label
    const getStatusLabel = (status: string): string => {
        return statusLabelMap[status] || status;
    };

    // Monthly chart data computed from invoices
    const monthlyChartData = useMemo(() => {
        const monthlyRevMap: Record<string, number> = {};
        invoicesList.forEach((inv: any) => {
            const month = (inv.invoice_date || inv.paid_at || '').substring(0, 7);
            if (month) {
                monthlyRevMap[month] = (monthlyRevMap[month] || 0) + getInvoiceAmount(inv);
            }
        });
        const sortedMonths = Object.keys(monthlyRevMap).sort();
        return sortedMonths.slice(-6).map(m => ({
            month: m,
            revenue: monthlyRevMap[m] || 0,
            expenses: 0,
            profit: monthlyRevMap[m] || 0,
        }));
    }, [invoicesList]);

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('de-DE', {
            style: 'currency',
            currency: 'EUR',
            minimumFractionDigits: 0,
            maximumFractionDigits: 0
        }).format(amount);
    };

    const getStatusColor = (status: string) => {
        // Handle both DB status values and German labels
        switch (status) {
            case 'paid':
            case 'Bezahlt':
                return 'bg-emerald-50 text-emerald-700 border-emerald-200';
            case 'sent':
            case 'issued':
            case 'Versendet':
            case 'Offen':
                return 'bg-amber-50 text-amber-700 border-amber-200';
            case 'overdue':
            case 'Überfällig':
                return 'bg-rose-50 text-rose-700 border-rose-200';
            case 'cancelled':
            case 'void':
            case 'Storniert':
                return 'bg-slate-100 text-slate-700 border-slate-200';
            case 'draft':
            case 'Entwurf':
                return 'bg-slate-50 text-blue-700 border-blue-200';
            default:
                return 'bg-slate-100 text-slate-700 border-slate-200';
        }
    };

    const isOverdue = (invoice: any) => {
        const today = new Date().toISOString().split('T')[0];
        const status = invoice.status;
        return invoice.due_date && invoice.due_date < today && (status === 'sent' || status === 'issued');
    };

    // KPI values
    const revenueThisMonth = kpis?.revenue?.this_month || 0;
    const expensesThisMonth = kpis?.expenses?.this_month || 0;
    const profitThisMonth = kpis?.profit?.this_month || 0;
    const outstandingTotal = kpis?.outstanding?.total || 0;
    const revenueGrowthRate = kpis?.revenue?.growth_rate || 0;
    const overdueCount = kpis?.outstanding?.count || 0;

    if (loading && invoicesList.length === 0) {
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
                                <h3 className="text-3xl font-bold text-slate-900 mt-2">{formatCurrency(revenueThisMonth)}</h3>
                            </div>
                            <div className="p-2 bg-emerald-50 rounded-lg">
                                <TrendingUp className="h-5 w-5 text-emerald-600" />
                            </div>
                        </div>
                        <div className="mt-4 flex items-center text-sm">
                            <span className={`flex items-center font-medium ${revenueGrowthRate >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                                {revenueGrowthRate >= 0 ? (
                                    <ArrowUpRight className="h-4 w-4 mr-1" />
                                ) : (
                                    <ArrowDownRight className="h-4 w-4 mr-1" />
                                )}
                                {Math.abs(revenueGrowthRate).toFixed(1)}%
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
                                <h3 className="text-3xl font-bold text-slate-900 mt-2">{formatCurrency(expensesThisMonth)}</h3>
                            </div>
                            <div className="p-2 bg-rose-50 rounded-lg">
                                <TrendingDown className="h-5 w-5 text-rose-600" />
                            </div>
                        </div>
                        <div className="mt-4 flex items-center text-sm">
                            <span className="text-slate-500">Laufender Monat</span>
                        </div>
                    </CardContent>
                </Card>

                <Card className="bg-white border-slate-200 shadow-sm">
                    <CardContent className="p-5">
                        <div className="flex justify-between items-start">
                            <div>
                                <p className="text-sm font-medium text-slate-500">Gewinn (Monat)</p>
                                <h3 className="text-3xl font-bold text-slate-600 mt-2">{formatCurrency(profitThisMonth)}</h3>
                            </div>
                            <div className="p-2 bg-slate-50 rounded-lg">
                                <Euro className="h-5 w-5 text-slate-600" />
                            </div>
                        </div>
                        <div className="mt-4 flex items-center text-sm">
                            {kpis?.profit?.margin != null ? (
                                <span className="text-slate-500">Marge: {kpis.profit.margin.toFixed(1)}%</span>
                            ) : (
                                <span className="text-slate-500">Laufender Monat</span>
                            )}
                        </div>
                    </CardContent>
                </Card>

                <Card className="bg-white border-slate-200 shadow-sm">
                    <CardContent className="p-5">
                        <div className="flex justify-between items-start">
                            <div>
                                <p className="text-sm font-medium text-slate-500">Offene Forderungen</p>
                                <h3 className="text-3xl font-bold text-amber-600 mt-2">{formatCurrency(outstandingTotal)}</h3>
                            </div>
                            <div className="p-2 bg-amber-50 rounded-lg">
                                <AlertTriangle className="h-5 w-5 text-amber-600" />
                            </div>
                        </div>
                        <div className="mt-4 flex items-center text-sm">
                            <span className="flex items-center text-rose-600 font-medium">
                                {overdueCount} überfällig
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
                                {monthlyChartData.length === 0 ? (
                                    <div className="text-center text-slate-400 py-12">Noch keine Rechnungsdaten vorhanden.</div>
                                ) : (
                                    <div className="space-y-6">
                                        {monthlyChartData.map((data, index) => {
                                            const month = new Date(data.month + '-01').toLocaleDateString('de-DE', {
                                                month: 'long',
                                                year: 'numeric'
                                            });
                                            const maxValue = Math.max(...monthlyChartData.map(d => Math.max(d.revenue, d.expenses)));
                                            const revenueWidth = maxValue > 0 ? (data.revenue / maxValue) * 100 : 0;
                                            const expenseWidth = maxValue > 0 ? (data.expenses / maxValue) * 100 : 0;

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
                                )}
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
                                    {invoicesList.length === 0 ? (
                                        <div className="p-4 text-sm text-slate-400 text-center">Keine Rechnungen vorhanden.</div>
                                    ) : (
                                        invoicesList.slice(0, 3).map((invoice: any) => {
                                            const overdue = isOverdue(invoice);
                                            const displayStatus = overdue ? 'Überfällig' : getStatusLabel(invoice.status);
                                            return (
                                                <div key={invoice.id} className="p-4 hover:bg-slate-50 transition-colors">
                                                    <div className="flex justify-between items-start mb-1">
                                                        <span className="font-medium text-slate-900 text-sm">{getCustomerName(invoice)}</span>
                                                        <span className="font-semibold text-slate-900 text-sm">{formatCurrency(getInvoiceAmount(invoice))}</span>
                                                    </div>
                                                    <div className="flex justify-between items-center text-xs">
                                                        <span className="text-slate-500">{invoice.invoice_number}</span>
                                                        <Badge variant="outline" className={`text-[10px] ${getStatusColor(overdue ? 'overdue' : invoice.status)}`}>
                                                            {displayStatus}
                                                        </Badge>
                                                    </div>
                                                </div>
                                            );
                                        })
                                    )}
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
                                        {invoicesList.length === 0 ? (
                                            <tr>
                                                <td colSpan={6} className="px-5 py-8 text-center text-slate-400">
                                                    Keine Rechnungen vorhanden.
                                                </td>
                                            </tr>
                                        ) : (
                                            invoicesList.map((invoice: any) => {
                                                const overdue = isOverdue(invoice);
                                                const displayStatus = overdue ? 'Überfällig' : getStatusLabel(invoice.status);
                                                return (
                                                    <tr key={invoice.id} className="hover:bg-slate-50/80 transition-colors">
                                                        <td className="px-5 py-4 font-medium text-slate-900">{invoice.invoice_number}</td>
                                                        <td className="px-5 py-4">
                                                            <div className="text-slate-900 font-medium">{getCustomerName(invoice)}</div>
                                                            <div className="text-xs text-slate-500 truncate max-w-[200px]">{invoice.title}</div>
                                                        </td>
                                                        <td className="px-5 py-4 text-slate-500">
                                                            {invoice.invoice_date ? new Date(invoice.invoice_date).toLocaleDateString('de-DE') : '—'}
                                                        </td>
                                                        <td className={`px-5 py-4 ${overdue ? 'text-rose-600 font-medium' : 'text-slate-500'}`}>
                                                            {invoice.due_date ? new Date(invoice.due_date).toLocaleDateString('de-DE') : '—'}
                                                        </td>
                                                        <td className="px-5 py-4">
                                                            <Badge variant="outline" className={`font-normal ${getStatusColor(overdue ? 'overdue' : invoice.status)}`}>
                                                                {displayStatus}
                                                            </Badge>
                                                        </td>
                                                        <td className="px-5 py-4 text-right font-semibold text-slate-900">
                                                            {formatCurrency(getInvoiceAmount(invoice))}
                                                        </td>
                                                    </tr>
                                                );
                                            })
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* Expenses Tab */}
                <TabsContent value="expenses" className="m-0">
                    <Card className="bg-white border-slate-200 shadow-sm">
                        <CardHeader className="border-b border-slate-100 pb-4 flex flex-row items-center justify-between">
                            <CardTitle className="text-lg font-semibold text-slate-800">Alle Ausgaben</CardTitle>
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
                                            <th className="px-5 py-3 font-medium">Datum</th>
                                            <th className="px-5 py-3 font-medium">Kategorie</th>
                                            <th className="px-5 py-3 font-medium">Beschreibung</th>
                                            <th className="px-5 py-3 font-medium text-right">Betrag</th>
                                            <th className="px-5 py-3 font-medium text-center">Beleg</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {expensesList.length === 0 ? (
                                            <tr>
                                                <td colSpan={5} className="px-5 py-8 text-center text-slate-400">
                                                    Keine Ausgaben vorhanden.
                                                </td>
                                            </tr>
                                        ) : (
                                            expensesList.map((expense: any) => (
                                                <tr key={expense.id} className="hover:bg-slate-50/80 transition-colors">
                                                    <td className="px-5 py-4 text-slate-500">
                                                        {expense.expense_date ? new Date(expense.expense_date).toLocaleDateString('de-DE') : '—'}
                                                    </td>
                                                    <td className="px-5 py-4">
                                                        <Badge variant="outline" className="font-normal bg-slate-50 text-slate-700 border-slate-200">
                                                            {expense.category || 'Sonstige'}
                                                        </Badge>
                                                    </td>
                                                    <td className="px-5 py-4 text-slate-900">
                                                        {expense.description || '—'}
                                                    </td>
                                                    <td className="px-5 py-4 text-right font-semibold text-slate-900">
                                                        {formatCurrency(expense.amount || 0)}
                                                    </td>
                                                    <td className="px-5 py-4 text-center">
                                                        {expense.receipt_url ? (
                                                            <a
                                                                href={expense.receipt_url}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                className="inline-flex items-center text-blue-600 hover:text-blue-800"
                                                            >
                                                                <ExternalLink className="h-4 w-4" />
                                                            </a>
                                                        ) : (
                                                            <span className="text-slate-300">—</span>
                                                        )}
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </CardContent>
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
