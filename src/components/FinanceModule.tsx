
import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calculator, Euro, FileText, TrendingUp, TrendingDown, Calendar, AlertTriangle, CheckCircle, Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
// TODO: Re-enable when RevenueExpenseSection is implemented
// import RevenueExpenseSection from "@/components/RevenueExpenseSection";

const FinanceModule = () => {
  const { toast } = useToast();
  const [invoices, setInvoices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    monthlyRevenue: 0,
    monthlyProfit: 0,
    openInvoices: 0,
    overdueAmount: 0
  });

  useEffect(() => {
    fetchInvoices();
  }, []);

  const fetchInvoices = async () => {
    try {
      setLoading(true);
      
      // Get current user's company
      const { data: profile } = await supabase
        .from('profiles')
        .select('company_id')
        .single();

      if (!profile?.company_id) {
        throw new Error('Firma nicht gefunden');
      }

      // Fetch invoices with customer data
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

      if (error) throw error;

      setInvoices(invoicesData || []);
      calculateStats(invoicesData || []);

    } catch (error: any) {
      console.error('Error fetching invoices:', error);
      toast({
        title: "Fehler",
        description: "Rechnungen konnten nicht geladen werden.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const calculateStats = (invoicesData: any[]) => {
    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();

    // Calculate monthly revenue (current month)
    const monthlyInvoices = invoicesData.filter(invoice => {
      const invoiceDate = new Date(invoice.invoice_date);
      return invoiceDate.getMonth() === currentMonth && 
             invoiceDate.getFullYear() === currentYear;
    });

    const monthlyRevenue = monthlyInvoices.reduce((sum, invoice) => sum + Number(invoice.total_amount), 0);

    // Calculate open invoices amount
    const openInvoices = invoicesData
      .filter(invoice => invoice.status === 'Versendet' || invoice.status === 'Offen')
      .reduce((sum, invoice) => sum + Number(invoice.total_amount), 0);

    // Calculate overdue invoices (past due date and not paid)
    const today = new Date();
    const overdueAmount = invoicesData
      .filter(invoice => {
        const dueDate = new Date(invoice.due_date);
        return dueDate < today && (invoice.status === 'Versendet' || invoice.status === 'Offen');
      })
      .reduce((sum, invoice) => sum + Number(invoice.total_amount), 0);

    setStats({
      monthlyRevenue,
      monthlyProfit: monthlyRevenue * 0.25, // Assume 25% profit margin
      openInvoices,
      overdueAmount
    });
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

  const isOverdue = (invoice: any) => {
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

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Calculator className="h-6 w-6 text-blue-600" />
            Finanzen & Controlling
          </h2>
          <p className="text-gray-600">Rechnungen, Zahlungen und Liquiditätsplanung</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline">
            <FileText className="h-4 w-4 mr-2" />
            Export
          </Button>
          <Button className="bg-blue-600 hover:bg-blue-700">
            <Plus className="h-4 w-4 mr-2" />
            Neue Rechnung
          </Button>
        </div>
      </div>

      {/* Financial Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Umsatz (Monat)</p>
                <p className="text-2xl font-bold">{formatCurrency(stats.monthlyRevenue)}</p>
              </div>
              <TrendingUp className="h-8 w-8 text-green-600" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Gewinn (Monat)</p>
                <p className="text-2xl font-bold">{formatCurrency(stats.monthlyProfit)}</p>
              </div>
              <Euro className="h-8 w-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Offene Rechnungen</p>
                <p className="text-2xl font-bold">{formatCurrency(stats.openInvoices)}</p>
              </div>
              <FileText className="h-8 w-8 text-yellow-600" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Überfällige Beträge</p>
                <p className="text-2xl font-bold">{formatCurrency(stats.overdueAmount)}</p>
              </div>
              <AlertTriangle className="h-8 w-8 text-red-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Invoices */}
        <div className="lg:col-span-2 space-y-4">
          <h3 className="text-lg font-semibold">Aktuelle Rechnungen</h3>
          {loading ? (
            <Card>
              <CardContent className="p-6">
                <p className="text-center text-gray-500">Lade Rechnungen...</p>
              </CardContent>
            </Card>
          ) : invoices.length === 0 ? (
            <Card>
              <CardContent className="p-6">
                <p className="text-center text-gray-500">Keine Rechnungen vorhanden</p>
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
                      <FileText className="h-4 w-4 mr-1" />
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

        {/* Revenue & Statistics */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Finanzstatistiken
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="p-3 bg-gray-50 rounded-lg">
                  <div className="flex justify-between items-center mb-2">
                    <h4 className="font-medium text-sm">Rechnungsübersicht</h4>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <p className="text-gray-500">Gesamt Rechnungen</p>
                      <p className="font-bold text-blue-600">{invoices.length}</p>
                    </div>
                    <div>
                      <p className="text-gray-500">Bezahlte Rechnungen</p>
                      <p className="font-bold text-green-600">
                        {invoices.filter(inv => inv.status === 'Bezahlt').length}
                      </p>
                    </div>
                  </div>
                </div>
                
                <div className="p-3 bg-gray-50 rounded-lg">
                  <div className="flex justify-between items-center mb-2">
                    <h4 className="font-medium text-sm">Offene Beträge</h4>
                  </div>
                  <div className="grid grid-cols-1 gap-2 text-xs">
                    <div>
                      <p className="text-gray-500">Noch nicht überfällig</p>
                      <p className="font-bold text-yellow-600">
                        {formatCurrency(stats.openInvoices - stats.overdueAmount)}
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-500">Überfällige Beträge</p>
                      <p className="font-bold text-red-600">{formatCurrency(stats.overdueAmount)}</p>
                    </div>
                  </div>
                </div>

                {invoices.length === 0 && (
                  <div className="text-center text-gray-500 text-sm">
                    Keine Rechnungsdaten verfügbar
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Finanzaktionen</CardTitle>
            </CardHeader>
            <CardContent className="p-4">
              <div className="space-y-2">
                <Button variant="outline" className="w-full justify-start">
                  <Plus className="h-4 w-4 mr-2" />
                  Rechnung erstellen
                </Button>
                <Button variant="outline" className="w-full justify-start">
                  <FileText className="h-4 w-4 mr-2" />
                  Angebot schreiben
                </Button>
                <Button variant="outline" className="w-full justify-start">
                  <Calculator className="h-4 w-4 mr-2" />
                  Kalkulation
                </Button>
                <Button variant="outline" className="w-full justify-start">
                  <TrendingUp className="h-4 w-4 mr-2" />
                  Auswertungen
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* TODO: Re-enable when RevenueExpenseSection is implemented */}
      {/* <RevenueExpenseSection /> */}
    </div>
  );
};

export default FinanceModule;
