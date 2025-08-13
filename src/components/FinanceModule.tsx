
import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Calculator, 
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
  Download
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { FinancialStats, MonthlyRevenue, Invoice, Expense } from "@/types/financial";

// Simplified interface for mock/display data that may not have all required Invoice fields
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

const FinanceModule = () => {
  const { toast } = useToast();
  const [invoices, setInvoices] = useState<InvoiceDisplay[]>([]);
  const [expenses, setExpenses] = useState<any[]>([]); // Keep as any for now since we're using mock data
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [monthlyData, setMonthlyData] = useState<MonthlyRevenue[]>([]);
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

  useEffect(() => {
    fetchAllFinancialData();
  }, []);

  const fetchAllFinancialData = async () => {
    try {
      setLoading(true);
      await Promise.all([
        fetchInvoices(),
        fetchExpenses(),
        fetchMonthlyData()
      ]);
    } catch (error) {
      console.error('Error fetching financial data:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchExpenses = async () => {
    try {
      // For now, always use mock data since expenses table might not exist
      const mockExpenses = [
        {
          id: 1,
          description: 'Baumaterial Projekt Weber',
          amount: 2500.00,
          category: 'materials',
          date: new Date().toISOString().split('T')[0],
          project: 'Weber Hausbau'
        },
        {
          id: 2,
          description: 'Subunternehmer Elektrik',
          amount: 4200.00,
          category: 'subcontractor',
          date: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          project: 'Müller Renovation'
        },
        {
          id: 3,
          description: 'Fahrzeugkosten Januar',
          amount: 850.00,
          category: 'operating',
          date: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          project: null
        },
        {
          id: 4,
          description: 'Werkzeugkauf - neue Bohrmaschine',
          amount: 320.00,
          category: 'materials',
          date: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          project: null
        },
        {
          id: 5,
          description: 'Miete Büro Januar',
          amount: 1200.00,
          category: 'operating',
          date: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          project: null
        }
      ];

      setExpenses(mockExpenses);
    } catch (error) {
      console.error('Error setting up expenses:', error);
      setExpenses([]); // Fallback to empty array
    }
  };

  const fetchMonthlyData = async () => {
    // Mock-Daten für monatlichen Verlauf
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
    try {
      // Get current user's company
      const { data: currentUser } = await supabase.auth.getUser();
      if (!currentUser?.user) {
        console.log('No authenticated user found, using mock data');
        setInvoices(getMockInvoices());
        calculateStats(getMockInvoices());
        return;
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('company_id')
        .eq('id', currentUser.user.id)
        .single();

      if (!profile?.company_id) {
        console.log('No company_id found, using mock data');
        setInvoices(getMockInvoices());
        calculateStats(getMockInvoices());
        return;
      }

      // Try to fetch invoices from database
      const { data: invoicesData, error } = await supabase
        .from('invoices')
        .select(`
          *,
          customers (
            company_name,
            contact_person
          )
        `)
        .eq('company_id', profile.company_id)
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) {
        // If invoices table doesn't exist or other DB error, use mock data
        console.log('Database error, using mock data:', error.message);
        setInvoices(getMockInvoices());
        calculateStats(getMockInvoices());
        return;
      }

      // Use real data if available, otherwise mock data
      const finalInvoicesData = invoicesData && invoicesData.length > 0 ? invoicesData : getMockInvoices();
      setInvoices(finalInvoicesData);
      calculateStats(finalInvoicesData);

    } catch (error: unknown) {
      console.log('Error fetching invoices, using mock data:', error);
      // Fallback to mock data instead of showing error
      setInvoices(getMockInvoices());
      calculateStats(getMockInvoices());
    }
  };

  const getMockInvoices = () => {
    return [
      {
        id: 1,
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
        id: 2,
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
        id: 3,
        invoice_number: 'RE-2025-003',
        title: 'Dacharbeiten Neubau Schmidt',
        total_amount: 12800.00,
        status: 'Offen',
        invoice_date: '2025-01-08',
        due_date: '2025-01-25', // Überfällig
        customers: {
          company_name: 'Bauunternehmen Schmidt',
          contact_person: 'Klaus Schmidt'
        }
      },
      {
        id: 4,
        invoice_number: 'RE-2024-156',
        title: 'Wartung Heizungsanlage',
        total_amount: 450.00,
        status: 'Bezahlt',
        invoice_date: '2024-12-20',
        due_date: '2025-01-19',
        customers: {
          company_name: 'Verwaltung Musterstraße',
          contact_person: 'Anna Beispiel'
        }
      }
    ];
  };

  const calculateStats = (invoicesData: InvoiceDisplay[]) => {
    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();

    // Calculate monthly revenue (current month)
    const monthlyInvoices = invoicesData.filter(invoice => {
      const invoiceDate = new Date(invoice.invoice_date);
      return invoiceDate.getMonth() === currentMonth && 
             invoiceDate.getFullYear() === currentYear;
    });

    const monthlyRevenue = monthlyInvoices.reduce((sum, invoice) => sum + Number(invoice.total_amount), 0);
    const monthlyExpenses = expenses.reduce((sum, expense) => sum + Number(expense.amount), 0);

    // Calculate open invoices amount
    const openInvoices = invoicesData
      .filter(invoice => invoice.status === 'Versendet' || invoice.status === 'Offen')
      .reduce((sum, invoice) => sum + Number(invoice.total_amount), 0);

    // Calculate overdue invoices
    const today = new Date();
    const overdueInvoices = invoicesData.filter(invoice => {
      const dueDate = new Date(invoice.due_date);
      return dueDate < today && (invoice.status === 'Versendet' || invoice.status === 'Offen');
    });
    
    const overdueAmount = overdueInvoices.reduce((sum, invoice) => sum + Number(invoice.total_amount), 0);

    setStats({
      monthly_revenue: monthlyRevenue,
      monthly_expenses: monthlyExpenses,
      monthly_profit: monthlyRevenue - monthlyExpenses,
      total_outstanding: openInvoices,
      overdue_count: overdueInvoices.length,
      active_projects_profit: monthlyRevenue * 1.2, // Mock calculation
      avg_profit_margin: monthlyRevenue > 0 ? ((monthlyRevenue - monthlyExpenses) / monthlyRevenue * 100) : 0,
      revenue_trend: 12.5, // Mock data
      expense_trend: -3.2,
      profit_trend: 23.1
    });
  };

  const formatPercentage = (value: number) => {
    return `${value > 0 ? '+' : ''}${value.toFixed(1)}%`;
  };

  const getTrendIcon = (trend: number) => {
    if (trend > 0) return <TrendingUp className="h-4 w-4 text-green-600" />;
    if (trend < 0) return <TrendingDown className="h-4 w-4 text-red-600" />;
    return null;
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'materials': return '🧱';
      case 'subcontractor': return '👷';
      case 'labor': return '⏰';
      case 'operating': return '🏢';
      default: return '📋';
    }
  };

  const getCategoryName = (category: string) => {
    switch (category) {
      case 'materials': return 'Material';
      case 'subcontractor': return 'Nachunternehmer';
      case 'labor': return 'Lohn';
      case 'operating': return 'Betriebskosten';
      default: return 'Sonstiges';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Bezahlt': return 'bg-green-100 text-green-800';
      case 'Versendet':
      case 'Offen': return 'bg-yellow-100 text-yellow-800';
      case 'Storniert': return 'bg-gray-100 text-gray-800';
      case 'Entwurf': return 'bg-blue-100 text-blue-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'Bezahlt': return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'Versendet':
      case 'Offen': return <Calendar className="h-4 w-4 text-yellow-600" />;
      case 'Entwurf': return <FileText className="h-4 w-4 text-blue-600" />;
      default: return <FileText className="h-4 w-4 text-gray-600" />;
    }
  };

  const isOverdue = (invoice: InvoiceDisplay) => {
    const today = new Date();
    const dueDate = new Date(invoice.due_date);
    return dueDate < today && (invoice.status === 'Versendet' || invoice.status === 'Offen');
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('de-DE', {
      style: 'currency',
      currency: 'EUR'
    }).format(amount);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-2 text-gray-600">Finanzdaten werden geladen...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-4xl font-bold text-gray-900">Finanzen & Buchhaltung</h1>
        <div className="flex items-center gap-6">
          <Button 
            variant="outline"
            className="rounded-lg px-6 py-3 text-lg font-medium"
          >
            <FileSpreadsheet className="h-5 w-5 mr-3" />
            Export
          </Button>
          <Button className="bg-blue-600 hover:bg-blue-700 text-white rounded-lg px-6 py-3 text-lg font-medium">
            <Plus className="h-5 w-5 mr-3" />
            Neue Rechnung
          </Button>
        </div>
      </div>

      {/* Enhanced Financial Dashboard */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Monatsumsatz */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">💰 Monatsumsatz</p>
                <p className="text-2xl font-bold text-green-700">
                  {formatCurrency(stats.monthly_revenue)}
                </p>
              </div>
              <div className="flex items-center gap-1">
                {getTrendIcon(stats.revenue_trend)}
                <span className={`text-xs ${stats.revenue_trend > 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {formatPercentage(stats.revenue_trend)}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Monatsausgaben */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">💸 Monatsausgaben</p>
                <p className="text-2xl font-bold text-red-700">
                  {formatCurrency(stats.monthly_expenses)}
                </p>
              </div>
              <div className="flex items-center gap-1">
                {getTrendIcon(stats.expense_trend)}
                <span className={`text-xs ${stats.expense_trend < 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {formatPercentage(stats.expense_trend)}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Monatsgewinn */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">📈 Monatsgewinn</p>
                <p className="text-2xl font-bold text-blue-700">
                  {formatCurrency(stats.monthly_profit)}
                </p>
              </div>
              <div className="flex items-center gap-1">
                {getTrendIcon(stats.profit_trend)}
                <span className={`text-xs ${stats.profit_trend > 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {formatPercentage(stats.profit_trend)}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Offene Posten */}
        <Card>
          <CardContent className="p-4">
            <div>
              <p className="text-sm text-gray-600">⚠️ Offene Posten</p>
              <p className="text-2xl font-bold text-orange-700">
                {formatCurrency(stats.total_outstanding)}
              </p>
              <div className="flex items-center gap-1 mt-1">
                <AlertTriangle className="h-4 w-4 text-red-500" />
                <span className="text-xs text-red-600">
                  {stats.overdue_count} überfällig
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-5 mb-6">
          <TabsTrigger value="dashboard" className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            Dashboard
          </TabsTrigger>
          <TabsTrigger value="invoices" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Rechnungen
          </TabsTrigger>
          <TabsTrigger value="expenses" className="flex items-center gap-2">
            <Receipt className="h-4 w-4" />
            Ausgaben
          </TabsTrigger>
          <TabsTrigger value="reports" className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            Berichte
          </TabsTrigger>
          <TabsTrigger value="tax" className="flex items-center gap-2">
            <Euro className="h-4 w-4" />
            Steuer
          </TabsTrigger>
        </TabsList>

        {/* Dashboard Tab */}
        <TabsContent value="dashboard" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Umsatz-Chart */}
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>📊 Umsatz-Verlauf (letzte 6 Monate)</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {monthlyData.map((data, index) => {
                    const month = new Date(data.month + '-01').toLocaleDateString('de-DE', { 
                      month: 'short', 
                      year: 'numeric' 
                    });
                    const maxValue = Math.max(...monthlyData.map(d => d.revenue));
                    const revenueWidth = (data.revenue / maxValue) * 100;
                    const expenseWidth = (data.expenses / maxValue) * 100;
                    
                    return (
                      <div key={index} className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span>{month}</span>
                          <span className="font-medium">
                            {formatCurrency(data.profit)} Gewinn
                          </span>
                        </div>
                        <div className="relative h-6 bg-gray-100 rounded">
                          <div 
                            className="absolute h-full bg-green-500 rounded"
                            style={{ width: `${revenueWidth}%` }}
                          />
                          <div 
                            className="absolute h-full bg-red-400 rounded"
                            style={{ width: `${expenseWidth}%` }}
                          />
                        </div>
                        <div className="flex justify-between text-xs text-gray-600">
                          <span>Umsatz: {formatCurrency(data.revenue)}</span>
                          <span>Ausgaben: {formatCurrency(data.expenses)}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            {/* Quick Actions & Stats */}
            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>⚡ Schnellzugriff</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Button className="w-full justify-start" variant="outline">
                    <FileText className="h-4 w-4 mr-2" />
                    Neue Rechnung
                  </Button>
                  <Button className="w-full justify-start" variant="outline">
                    <Receipt className="h-4 w-4 mr-2" />
                    Ausgabe erfassen
                  </Button>
                  <Button className="w-full justify-start" variant="outline">
                    <Euro className="h-4 w-4 mr-2" />
                    Zahlung erfassen
                  </Button>
                  <Button className="w-full justify-start" variant="outline">
                    <FileSpreadsheet className="h-4 w-4 mr-2" />
                    DATEV Export
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>💎 Projekt-Rentabilität</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-sm">Aktive Projekte</span>
                      <span className="font-medium">
                        {formatCurrency(stats.active_projects_profit)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm">Ø Gewinnmarge</span>
                      <Badge variant="outline">
                        {stats.avg_profit_margin.toFixed(1)}%
                      </Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        {/* Invoices Tab */}
        <TabsContent value="invoices" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Invoice List */}
            <div className="lg:col-span-2 space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-semibold">📄 Aktuelle Rechnungen</h3>
                <Button size="sm">
                  <Plus className="h-4 w-4 mr-2" />
                  Neue Rechnung
                </Button>
              </div>

              {invoices.length === 0 ? (
                <Card>
                  <CardContent className="p-8 text-center">
                    <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-500 mb-4">Keine Rechnungen vorhanden</p>
                    <Button>
                      <Plus className="h-4 w-4 mr-2" />
                      Erste Rechnung erstellen
                    </Button>
                  </CardContent>
                </Card>
              ) : (
                invoices.map((invoice) => (
                  <Card key={invoice.id} className="hover:shadow-lg transition-shadow">
                    <CardContent className="p-6">
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            {getStatusIcon(invoice.status)}
                            <h4 className="text-lg font-semibold">{invoice.invoice_number}</h4>
                            <Badge className={getStatusColor(isOverdue(invoice) ? 'Überfällig' : invoice.status)}>
                              {isOverdue(invoice) ? 'Überfällig' : invoice.status}
                            </Badge>
                          </div>
                          <p className="text-gray-600 mb-2">{invoice.customers?.company_name}</p>
                          <p className="text-sm text-gray-500">{invoice.title}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-xl font-bold text-green-600">{formatCurrency(invoice.total_amount)}</p>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4 text-sm mb-4">
                        <div>
                          <p className="text-gray-500">Rechnungsdatum:</p>
                          <p className="flex items-center gap-1">
                            <Calendar className="h-4 w-4" />
                            {new Date(invoice.invoice_date).toLocaleDateString('de-DE')}
                          </p>
                        </div>
                        <div>
                          <p className="text-gray-500">Fälligkeitsdatum:</p>
                          <p className="flex items-center gap-1">
                            <Calendar className="h-4 w-4" />
                            {new Date(invoice.due_date).toLocaleDateString('de-DE')}
                          </p>
                        </div>
                      </div>

                      {isOverdue(invoice) && (
                        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                          <div className="flex items-center gap-2 text-red-800">
                            <AlertTriangle className="h-4 w-4" />
                            <span className="text-sm font-medium">
                              Zahlung überfällig! Mahnung erforderlich.
                            </span>
                          </div>
                        </div>
                      )}

                      <div className="flex gap-2">
                        <Button size="sm" variant="outline">
                          <Download className="h-4 w-4 mr-1" />
                          PDF
                        </Button>
                        {(invoice.status === 'Versendet' || invoice.status === 'Offen') && (
                          <Button size="sm" className="bg-green-600 hover:bg-green-700">
                            <CheckCircle className="h-4 w-4 mr-1" />
                            Als bezahlt markieren
                          </Button>
                        )}
                        {isOverdue(invoice) && (
                          <Button size="sm" className="bg-red-600 hover:bg-red-700">
                            <AlertTriangle className="h-4 w-4 mr-1" />
                            Mahnung
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>

            {/* Invoice Statistics */}
            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>📊 Rechnungsstatistiken</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div className="text-center p-3 bg-blue-50 rounded">
                        <p className="text-2xl font-bold text-blue-600">{invoices.length}</p>
                        <p className="text-blue-600">Gesamt</p>
                      </div>
                      <div className="text-center p-3 bg-green-50 rounded">
                        <p className="text-2xl font-bold text-green-600">
                          {invoices.filter(inv => inv.status === 'Bezahlt').length}
                        </p>
                        <p className="text-green-600">Bezahlt</p>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div className="text-center p-3 bg-yellow-50 rounded">
                        <p className="text-2xl font-bold text-yellow-600">
                          {invoices.filter(inv => inv.status === 'Offen' || inv.status === 'Versendet').length}
                        </p>
                        <p className="text-yellow-600">Offen</p>
                      </div>
                      <div className="text-center p-3 bg-red-50 rounded">
                        <p className="text-2xl font-bold text-red-600">
                          {stats.overdue_count}
                        </p>
                        <p className="text-red-600">Überfällig</p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>⚡ Rechnungs-Aktionen</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <Button variant="outline" className="w-full justify-start">
                    <Plus className="h-4 w-4 mr-2" />
                    Neue Rechnung
                  </Button>
                  <Button variant="outline" className="w-full justify-start">
                    <FileText className="h-4 w-4 mr-2" />
                    Aus Angebot erstellen
                  </Button>
                  <Button variant="outline" className="w-full justify-start">
                    <Download className="h-4 w-4 mr-2" />
                    Sammel-Export
                  </Button>
                  <Button variant="outline" className="w-full justify-start">
                    <Settings className="h-4 w-4 mr-2" />
                    Rechnungsvorlage
                  </Button>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        {/* Expenses Tab */}
        <TabsContent value="expenses" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>💸 Ausgabenmanagement</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Recent Expenses */}
                <div>
                  <h4 className="font-semibold mb-4">📋 Aktuelle Ausgaben</h4>
                  <div className="space-y-3">
                    {expenses.map((expense) => (
                      <div key={expense.id} className="flex items-center justify-between p-3 border rounded-lg">
                        <div className="flex items-center gap-3">
                          <span className="text-2xl">{getCategoryIcon(expense.category)}</span>
                          <div>
                            <p className="font-medium">{expense.description}</p>
                            <p className="text-sm text-gray-500">
                              {getCategoryName(expense.category)} • {new Date(expense.date).toLocaleDateString('de-DE')}
                            </p>
                            {expense.project && (
                              <p className="text-xs text-blue-600">→ {expense.project}</p>
                            )}
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-red-600">{formatCurrency(expense.amount)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Expense Categories */}
                <div>
                  <h4 className="font-semibold mb-4">📊 Ausgaben-Kategorien</h4>
                  <div className="space-y-3">
                    {['materials', 'subcontractor', 'labor', 'operating'].map(category => {
                      const categoryExpenses = expenses.filter(e => e.category === category);
                      const total = categoryExpenses.reduce((sum, e) => sum + e.amount, 0);
                      
                      return (
                        <div key={category} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                          <div className="flex items-center gap-2">
                            <span className="text-xl">{getCategoryIcon(category)}</span>
                            <span className="font-medium">{getCategoryName(category)}</span>
                          </div>
                          <div className="text-right">
                            <p className="font-bold">{formatCurrency(total)}</p>
                            <p className="text-sm text-gray-500">{categoryExpenses.length} Ausgaben</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Reports Tab */}
        <TabsContent value="reports" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>📊 Finanzberichte & Auswertungen</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <Button variant="outline" className="h-20 flex-col gap-2">
                  <FileText className="h-6 w-6" />
                  <span>Offene Posten Liste</span>
                </Button>
                <Button variant="outline" className="h-20 flex-col gap-2">
                  <TrendingUp className="h-6 w-6" />
                  <span>Umsatzauswertung</span>
                </Button>
                <Button variant="outline" className="h-20 flex-col gap-2">
                  <BarChart3 className="h-6 w-6" />
                  <span>Projekt-Rentabilität</span>
                </Button>
                <Button variant="outline" className="h-20 flex-col gap-2">
                  <Calculator className="h-6 w-6" />
                  <span>Kostenanalyse</span>
                </Button>
                <Button variant="outline" className="h-20 flex-col gap-2">
                  <Euro className="h-6 w-6" />
                  <span>Liquiditätsplanung</span>
                </Button>
                <Button variant="outline" className="h-20 flex-col gap-2">
                  <FileSpreadsheet className="h-6 w-6" />
                  <span>Jahresauswertung</span>
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tax Compliance Tab */}
        <TabsContent value="tax" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>🏛️ Steuerliche Compliance</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h4 className="font-semibold mb-4">📊 Umsatzsteuer</h4>
                  <div className="space-y-3">
                    <div className="p-3 border rounded-lg">
                      <div className="flex justify-between">
                        <span>Umsatz 19% USt</span>
                        <span className="font-medium">{formatCurrency(18000)}</span>
                      </div>
                      <div className="flex justify-between text-sm text-gray-600">
                        <span>Umsatzsteuer 19%</span>
                        <span>{formatCurrency(3420)}</span>
                      </div>
                    </div>
                    <div className="p-3 border rounded-lg">
                      <div className="flex justify-between">
                        <span>Umsatz 7% USt</span>
                        <span className="font-medium">{formatCurrency(2000)}</span>
                      </div>
                      <div className="flex justify-between text-sm text-gray-600">
                        <span>Umsatzsteuer 7%</span>
                        <span>{formatCurrency(140)}</span>
                      </div>
                    </div>
                    <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                      <div className="flex justify-between font-semibold">
                        <span>Gesamte USt-Schuld</span>
                        <span className="text-blue-600">{formatCurrency(3560)}</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div>
                  <h4 className="font-semibold mb-4">📁 Export & Berichte</h4>
                  <div className="space-y-3">
                    <Button variant="outline" className="w-full justify-start">
                      <FileSpreadsheet className="h-4 w-4 mr-2" />
                      DATEV-Export
                    </Button>
                    <Button variant="outline" className="w-full justify-start">
                      <Download className="h-4 w-4 mr-2" />
                      CSV-Export
                    </Button>
                    <Button variant="outline" className="w-full justify-start">
                      <FileText className="h-4 w-4 mr-2" />
                      EÜR-Vorbereitung
                    </Button>
                    <Button variant="outline" className="w-full justify-start">
                      <Settings className="h-4 w-4 mr-2" />
                      Steuer-Einstellungen
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default FinanceModule;
