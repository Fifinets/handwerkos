
import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calculator, Euro, FileText, TrendingUp, TrendingDown, Calendar, AlertTriangle, CheckCircle, Plus } from "lucide-react";

const FinanceModule = () => {
  const recentInvoices = [
    {
      id: 'R2024-001',
      customer: 'Müller GmbH',
      project: 'Büroerweiterung',
      amount: '€12.500,00',
      date: '15.01.2024',
      dueDate: '14.02.2024',
      status: 'Bezahlt'
    },
    {
      id: 'R2024-002',
      customer: 'Schmidt AG',
      project: 'Werkshalle Elektrik',
      amount: '€8.750,00',
      date: '20.01.2024',
      dueDate: '19.02.2024',
      status: 'Offen'
    },
    {
      id: 'R2024-003',
      customer: 'Weber Bau',
      project: 'Wohnanlage Phase 1',
      amount: '€18.900,00',
      date: '22.01.2024',
      dueDate: '21.02.2024',
      status: 'Überfällig'
    },
    {
      id: 'R2024-004',
      customer: 'Klein GmbH',
      project: 'Beleuchtung Parkplatz',
      amount: '€4.200,00',
      date: '24.01.2024',
      dueDate: '23.02.2024',
      status: 'Offen'
    }
  ];

  const monthlyRevenue = [
    { month: 'Jan 2024', revenue: 45200, expenses: 32800, profit: 12400 },
    { month: 'Dez 2023', revenue: 38900, expenses: 28500, profit: 10400 },
    { month: 'Nov 2023', revenue: 42100, expenses: 30200, profit: 11900 },
    { month: 'Okt 2023', revenue: 47800, expenses: 34100, profit: 13700 }
  ];

  const upcomingPayments = [
    { supplier: 'ElektroGroßhandel GmbH', amount: '€2.450', date: '28.01.2024', type: 'Material' },
    { supplier: 'Hager Vertrieb', amount: '€875', date: '30.01.2024', type: 'Material' },
    { supplier: 'Leasing AG', amount: '€1.200', date: '01.02.2024', type: 'Fahrzeug' },
    { supplier: 'Büro Miete', amount: '€2.800', date: '01.02.2024', type: 'Miete' }
  ];

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Bezahlt': return 'bg-green-100 text-green-800';
      case 'Offen': return 'bg-yellow-100 text-yellow-800';
      case 'Überfällig': return 'bg-red-100 text-red-800';
      case 'Storniert': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'Bezahlt': return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'Offen': return <Calendar className="h-4 w-4 text-yellow-600" />;
      case 'Überfällig': return <AlertTriangle className="h-4 w-4 text-red-600" />;
      default: return <FileText className="h-4 w-4 text-gray-600" />;
    }
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
                <p className="text-2xl font-bold">€45.200</p>
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
                <p className="text-2xl font-bold">€12.400</p>
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
                <p className="text-2xl font-bold">€31.850</p>
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
                <p className="text-2xl font-bold">€18.900</p>
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
          {recentInvoices.map((invoice) => (
            <Card key={invoice.id} className="hover:shadow-lg transition-shadow">
              <CardContent className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      {getStatusIcon(invoice.status)}
                      <h4 className="text-lg font-semibold">{invoice.id}</h4>
                      <Badge className={getStatusColor(invoice.status)}>
                        {invoice.status}
                      </Badge>
                    </div>
                    <p className="text-gray-600 mb-2">{invoice.customer}</p>
                    <p className="text-sm text-gray-500">{invoice.project}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xl font-bold text-green-600">{invoice.amount}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 text-sm mb-4">
                  <div>
                    <p className="text-gray-500">Rechnungsdatum:</p>
                    <p className="flex items-center gap-1">
                      <Calendar className="h-4 w-4" />
                      {invoice.date}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-500">Fälligkeitsdatum:</p>
                    <p className="flex items-center gap-1">
                      <Calendar className="h-4 w-4" />
                      {invoice.dueDate}
                    </p>
                  </div>
                </div>

                {invoice.status === 'Überfällig' && (
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
                  {invoice.status === 'Offen' && (
                    <Button size="sm" className="bg-green-600 hover:bg-green-700">
                      <CheckCircle className="h-4 w-4 mr-1" />
                      Als bezahlt markieren
                    </Button>
                  )}
                  {invoice.status === 'Überfällig' && (
                    <Button size="sm" className="bg-red-600 hover:bg-red-700">
                      <AlertTriangle className="h-4 w-4 mr-1" />
                      Mahnung
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Revenue & Upcoming Payments */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Monatliche Entwicklung
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {monthlyRevenue.map((month, index) => (
                  <div key={index} className="p-3 bg-gray-50 rounded-lg">
                    <div className="flex justify-between items-center mb-2">
                      <h4 className="font-medium text-sm">{month.month}</h4>
                      <Badge variant="outline" className="text-xs">
                        +{((month.profit / month.expenses) * 100).toFixed(1)}%
                      </Badge>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-xs">
                      <div>
                        <p className="text-gray-500">Umsatz</p>
                        <p className="font-bold text-green-600">{formatCurrency(month.revenue)}</p>
                      </div>
                      <div>
                        <p className="text-gray-500">Ausgaben</p>
                        <p className="font-bold text-red-600">{formatCurrency(month.expenses)}</p>
                      </div>
                      <div>
                        <p className="text-gray-500">Gewinn</p>
                        <p className="font-bold text-blue-600">{formatCurrency(month.profit)}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Anstehende Zahlungen
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {upcomingPayments.map((payment, index) => (
                  <div key={index} className="p-3 bg-gray-50 rounded-lg">
                    <div className="flex justify-between items-center mb-2">
                      <p className="font-medium text-sm">{payment.supplier}</p>
                      <Badge variant="outline" className="text-xs">
                        {payment.type}
                      </Badge>
                    </div>
                    <div className="flex justify-between items-center">
                      <p className="text-sm font-bold text-red-600">{payment.amount}</p>
                      <p className="text-xs text-gray-500 flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {payment.date}
                      </p>
                    </div>
                  </div>
                ))}
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
    </div>
  );
};

export default FinanceModule;
