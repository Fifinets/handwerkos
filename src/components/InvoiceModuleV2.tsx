import React, { useState, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Plus,
  Search,
  Filter,
  Receipt,
  AlertTriangle,
  Send,
  Euro,
  MoreHorizontal,
  Eye,
  Mail,
  CreditCard,
  Pencil
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useSupabaseAuth } from "@/hooks/useSupabaseAuth";
import { AddInvoiceDialog } from "./AddInvoiceDialog";
import InvoiceDetailDialog from "./InvoiceDetailDialog";
import { cn } from "@/lib/utils";
import { StatCard } from "@/components/ui/stat-card";
import { StatusChip } from "@/components/ui/status-chip";
import { UrgencyCard } from "@/components/ui/urgency-card";

interface Invoice {
  id: string;
  invoice_number: string | null;
  title: string;
  status: 'draft' | 'sent' | 'paid' | 'overdue' | 'void' | 'cancelled';
  invoice_type: 'final' | 'partial' | 'advance' | 'credit' | null;
  invoice_date: string | null;
  due_date: string | null;
  net_amount: number | null;
  tax_amount: number | null;
  gross_amount: number | null;
  paid_at: string | null;
  sent_at: string | null;
  customer_id: string | null;
  project_id: string | null;
  created_at: string;
  customers?: {
    company_name: string | null;
    contact_person: string | null;
  } | null;
  projects?: {
    name: string | null;
    project_number: string | null;
  } | null;
}

const TYPE_LABELS: Record<string, string> = {
  final: 'Schlussrechnung',
  partial: 'Teilrechnung',
  advance: 'Abschlagsrechnung',
  credit: 'Gutschrift'
};

const InvoiceModuleV2 = () => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const { companyId } = useSupabaseAuth();

  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("offen");
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [isDetailDialogOpen, setIsDetailDialogOpen] = useState(false);

  // Fetch invoices
  const fetchInvoices = useCallback(async () => {
    if (!companyId) return;

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('invoices')
        .select(`
          *,
          customers(company_name, contact_person),
          projects(name)
        `)
        .eq('company_id', companyId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Check for overdue invoices and update status
      const today = new Date().toISOString().split('T')[0];
      const processedInvoices = (data || []).map(inv => {
        if (inv.status === 'sent' && inv.due_date && inv.due_date < today) {
          return { ...inv, status: 'overdue' as const };
        }
        return inv;
      });

      setInvoices(processedInvoices);
    } catch (error) {
      console.error('Error fetching invoices:', error);
      toast({
        title: "Fehler",
        description: "Rechnungen konnten nicht geladen werden.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  }, [companyId, toast]);

  useEffect(() => {
    fetchInvoices();
  }, [fetchInvoices]);

  // Filter options
  const filterOptions = [
    { value: 'offen', label: 'Offen' },
    { value: 'alle', label: 'Alle' },
    { value: 'draft', label: 'Entwürfe' },
    { value: 'sent', label: 'Versendet' },
    { value: 'overdue', label: 'Überfällig' },
    { value: 'paid', label: 'Bezahlt' },
    { value: 'cancelled', label: 'Storniert' },
  ];

  // Filter invoices
  const filteredInvoices = invoices.filter(inv => {
    // Search filter
    const matchesSearch =
      (inv.invoice_number?.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (inv.title?.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (inv.customers?.company_name?.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (inv.projects?.name?.toLowerCase().includes(searchTerm.toLowerCase()));

    if (!matchesSearch) return false;

    // Status filter
    if (statusFilter === 'offen') {
      return inv.status === 'draft' || inv.status === 'sent' || inv.status === 'overdue';
    } else if (statusFilter === 'alle') {
      return true;
    } else if (statusFilter === 'cancelled') {
      return inv.status === 'cancelled' || inv.status === 'void';
    } else {
      return inv.status === statusFilter;
    }
  });

  // Calculate KPIs
  const statusCounts = {
    draft: invoices.filter(i => i.status === 'draft').length,
    sent: invoices.filter(i => i.status === 'sent').length,
    overdue: invoices.filter(i => i.status === 'overdue').length,
    paid: invoices.filter(i => i.status === 'paid').length,
  };

  const openAmount = invoices
    .filter(i => i.status === 'sent' || i.status === 'overdue')
    .reduce((sum, i) => sum + (i.gross_amount || 0), 0);

  const overdueAmount = invoices
    .filter(i => i.status === 'overdue')
    .reduce((sum, i) => sum + (i.gross_amount || 0), 0);

  const formatCurrency = (amount: number) => {
    return amount.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' });
  };

  // Dringlichkeit pro Rechnung: überfällig = kritisch, Fälligkeit in <= 3 Tagen = warnend.
  const invoiceUrgency = (inv: Invoice): 'critical' | 'warning' | 'none' => {
    if (inv.status === 'overdue') return 'critical';
    if (inv.status === 'sent' && inv.due_date) {
      const daysUntilDue = Math.ceil(
        (new Date(inv.due_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
      );
      if (daysUntilDue <= 3) return 'warning';
    }
    return 'none';
  };

  const handleOpenInvoice = (invoice: Invoice) => {
    setSelectedInvoice(invoice);
    setIsDetailDialogOpen(true);
  };

  const handleEditInvoice = (invoice: Invoice) => {
    setSelectedInvoice(invoice);
    setIsDetailDialogOpen(true);
  };

  const handleMarkAsPaid = async (invoice: Invoice) => {
    try {
      const { error } = await supabase
        .from('invoices')
        .update({
          status: 'paid',
          paid_at: new Date().toISOString()
        })
        .eq('id', invoice.id);

      if (error) throw error;

      toast({
        title: "Rechnung bezahlt",
        description: `${invoice.invoice_number || 'Rechnung'} wurde als bezahlt markiert.`
      });

      fetchInvoices();
    } catch (error) {
      toast({
        title: "Fehler",
        description: "Status konnte nicht geändert werden.",
        variant: "destructive"
      });
    }
  };

  const handleSendInvoice = async (invoice: Invoice) => {
    try {
      const { error } = await supabase
        .from('invoices')
        .update({
          status: 'sent',
          sent_at: new Date().toISOString()
        })
        .eq('id', invoice.id);

      if (error) throw error;

      toast({
        title: "Rechnung versendet",
        description: `${invoice.invoice_number || 'Rechnung'} wurde als versendet markiert.`
      });

      fetchInvoices();
    } catch (error) {
      toast({
        title: "Fehler",
        description: "Status konnte nicht geändert werden.",
        variant: "destructive"
      });
    }
  };

  return (
    <div className="p-6 space-y-6 max-w-[1600px] mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Rechnungen</h1>
          <p className="text-sm text-slate-500 mt-1">Verwalten Sie Ihre Ausgangsrechnungen und Zahlungseingänge.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              placeholder="Rechnung suchen..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 w-[250px] bg-white border-slate-200"
            />
          </div>
          <Button onClick={() => setIsAddDialogOpen(true)} className="bg-slate-900 hover:bg-slate-800 text-white">
            <Plus className="h-4 w-4 mr-2" />
            Neue Rechnung
          </Button>
        </div>
      </div>

      {/* Filter Chips */}
      <div className="flex items-center gap-2 flex-wrap">
        <Filter className="h-4 w-4 text-slate-400 mr-1" />
        {filterOptions.map(option => {
          let count = 0;
          if (option.value === 'offen') {
            count = statusCounts.draft + statusCounts.sent + statusCounts.overdue;
          } else if (option.value === 'alle') {
            count = invoices.length;
          } else if (option.value === 'cancelled') {
            count = invoices.filter(i => i.status === 'cancelled' || i.status === 'void').length;
          } else {
            count = statusCounts[option.value as keyof typeof statusCounts] || 0;
          }

          return (
            <button
              key={option.value}
              onClick={() => setStatusFilter(option.value)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                statusFilter === option.value
                  ? 'bg-slate-900 text-white border-slate-900'
                  : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50 hover:border-slate-300'
              }`}
            >
              {option.label}
              <span className="ml-1.5 opacity-70">{count}</span>
            </button>
          );
        })}
      </div>

      {/* Summen-Kopf */}
      <div className="flex flex-col sm:flex-row gap-3">
        <StatCard label="Offen gesamt" emphasis="hero" value={formatCurrency(openAmount)} hint={`${statusCounts.sent + statusCounts.overdue} Rechnungen`} />
        <StatCard
          label="Davon überfällig"
          value={formatCurrency(overdueAmount)}
          tone={overdueAmount > 0 ? 'critical' : 'default'}
          hint={overdueAmount > 0 ? `${statusCounts.overdue} Rechnungen` : 'Nichts überfällig'}
        />
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Invoice List (2/3 width) */}
        <div className="lg:col-span-2">
          <Card className="bg-white border-slate-200 shadow-sm">
            <CardHeader className="border-b border-slate-100 pb-4 flex flex-row items-center justify-between">
              <CardTitle className="text-lg font-semibold text-slate-800">Rechnungsliste</CardTitle>
              <span className="text-sm text-slate-500">{filteredInvoices.length} Rechnungen</span>
            </CardHeader>
            <CardContent className="p-0">
              {loading ? (
                <div className="p-6 space-y-4">
                  {Array(5).fill(0).map((_, i) => (
                    <Skeleton key={i} className="h-[80px] w-full rounded-lg" />
                  ))}
                </div>
              ) : filteredInvoices.length === 0 ? (
                <div className="p-12 text-center flex flex-col items-center">
                  <div className="h-16 w-16 bg-slate-50 rounded-full flex items-center justify-center mb-4">
                    <Receipt className="h-8 w-8 text-slate-400" />
                  </div>
                  <h3 className="text-lg font-medium text-slate-900 mb-1">Keine Rechnungen gefunden</h3>
                  <p className="text-sm text-slate-500 max-w-sm">
                    {searchTerm ? `Keine Ergebnisse für "${searchTerm}".` : 'Erstellen Sie Ihre erste Rechnung.'}
                  </p>
                  {!searchTerm && (
                    <Button onClick={() => setIsAddDialogOpen(true)} className="mt-6 bg-slate-900 text-white">
                      <Plus className="h-4 w-4 mr-2" />
                      Erste Rechnung erstellen
                    </Button>
                  )}
                </div>
              ) : (
                <div className="p-4 space-y-2">
                  {filteredInvoices.map((invoice) => {
                    const urgency = invoiceUrgency(invoice);
                    const done = invoice.status === 'paid' || invoice.status === 'cancelled' || invoice.status === 'void';
                    const daysOverdue = invoice.due_date
                      ? Math.floor((Date.now() - new Date(invoice.due_date).getTime()) / (1000 * 60 * 60 * 24))
                      : 0;
                    const daysUntilDue = invoice.due_date
                      ? Math.ceil((new Date(invoice.due_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
                      : null;

                    let dueLine: string | null = null;
                    if (invoice.status === 'overdue') {
                      dueLine = `${daysOverdue} Tage überfällig`;
                    } else if (urgency === 'warning' && daysUntilDue !== null) {
                      dueLine = daysUntilDue <= 0 ? 'Heute fällig' : `Fällig in ${daysUntilDue} ${daysUntilDue === 1 ? 'Tag' : 'Tagen'}`;
                    } else if (invoice.due_date && invoice.status !== 'paid') {
                      dueLine = `Fällig: ${new Date(invoice.due_date).toLocaleDateString('de-DE')}`;
                    } else if (invoice.invoice_date) {
                      dueLine = new Date(invoice.invoice_date).toLocaleDateString('de-DE');
                    }

                    return (
                      <UrgencyCard
                        key={invoice.id}
                        urgency={urgency}
                        done={done}
                        className="cursor-pointer"
                        onClick={() => handleOpenInvoice(invoice)}
                        action={
                          <>
                            <div className="text-right">
                              <div className={cn(
                                'text-base font-bold tabular-nums',
                                invoice.status === 'overdue' ? 'text-rose-600 dark:text-rose-400' :
                                invoice.status === 'paid' ? 'text-slate-500' :
                                'text-slate-900 dark:text-slate-100'
                              )}>
                                {formatCurrency(invoice.gross_amount || 0)}
                              </div>
                              <div className="mt-1 flex justify-end">
                                <StatusChip status={invoice.status} />
                              </div>
                            </div>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                                <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleOpenInvoice(invoice); }}>
                                  <Eye className="h-4 w-4 mr-2" />
                                  Anzeigen
                                </DropdownMenuItem>
                                {invoice.status === 'draft' && (
                                  <>
                                    <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleEditInvoice(invoice); }}>
                                      <Pencil className="h-4 w-4 mr-2" />
                                      Bearbeiten
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleSendInvoice(invoice); }}>
                                      <Send className="h-4 w-4 mr-2" />
                                      Als versendet markieren
                                    </DropdownMenuItem>
                                  </>
                                )}
                                {(invoice.status === 'sent' || invoice.status === 'overdue') && (
                                  <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleMarkAsPaid(invoice); }}>
                                    <CreditCard className="h-4 w-4 mr-2" />
                                    Als bezahlt markieren
                                  </DropdownMenuItem>
                                )}
                                <DropdownMenuSeparator />
                                <DropdownMenuItem>
                                  <Mail className="h-4 w-4 mr-2" />
                                  Per E-Mail senden
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </>
                        }
                      >
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <span className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">
                            {invoice.invoice_number || 'Entwurf'} · {invoice.customers?.company_name || '—'}
                          </span>
                          {invoice.invoice_type && invoice.invoice_type !== 'final' && (
                            <Badge variant="outline" className="text-[10px] bg-slate-50 text-slate-600 shrink-0">
                              {TYPE_LABELS[invoice.invoice_type]}
                            </Badge>
                          )}
                        </div>
                        {dueLine && (
                          <p className={cn(
                            'text-xs',
                            invoice.status === 'overdue' ? 'text-rose-700 dark:text-rose-300 font-medium' : 'text-slate-400'
                          )}>
                            {invoice.projects?.name ? `${invoice.projects.name} · ${dueLine}` : dueLine}
                          </p>
                        )}
                      </UrgencyCard>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Sidebar (1/3 width) */}
        <div className="space-y-6">
          {/* Overdue Invoices */}
          {statusCounts.overdue > 0 && (
            <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
              <div className="bg-rose-50 dark:bg-rose-950/40 px-5 py-3 flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-rose-600 dark:text-rose-400" />
                <h3 className="font-semibold text-rose-900 dark:text-rose-300">Überfällige Rechnungen ({statusCounts.overdue})</h3>
              </div>
              <CardContent className="p-0 divide-y divide-slate-100">
                {invoices
                  .filter(i => i.status === 'overdue')
                  .slice(0, 5)
                  .map((invoice) => {
                    const daysOverdue = invoice.due_date
                      ? Math.floor((new Date().getTime() - new Date(invoice.due_date).getTime()) / (1000 * 60 * 60 * 24))
                      : 0;

                    return (
                      <div
                        key={invoice.id}
                        className="p-4 hover:bg-rose-50/50 dark:hover:bg-rose-950/30 cursor-pointer transition-colors"
                        onClick={() => handleOpenInvoice(invoice)}
                      >
                        <div className="flex justify-between items-start mb-1">
                          <span className="font-medium text-slate-800 dark:text-slate-100 text-sm truncate pr-2">
                            {invoice.invoice_number || 'Entwurf'}
                          </span>
                          <span className="text-[10px] font-bold uppercase tracking-wide text-rose-700 dark:text-rose-300 shrink-0">
                            {daysOverdue} Tage
                          </span>
                        </div>
                        <div className="flex justify-between items-center text-xs">
                          <span className="text-slate-500">{invoice.customers?.company_name || '—'}</span>
                          <span className="text-rose-600 dark:text-rose-400 font-medium tabular-nums">{formatCurrency(invoice.gross_amount || 0)}</span>
                        </div>
                      </div>
                    );
                  })}
              </CardContent>
            </Card>
          )}

          {/* Quick Stats */}
          <Card className="bg-white border-slate-200 shadow-sm">
            <CardHeader className="border-b border-slate-100 pb-4">
              <CardTitle className="text-base font-semibold text-slate-800 flex items-center gap-2">
                <Euro className="h-4 w-4 text-slate-500" />
                Übersicht
              </CardTitle>
            </CardHeader>
            <CardContent className="p-5 space-y-4">
              {/* Status Distribution */}
              <div className="space-y-3">
                {[
                  { key: 'draft', label: 'Entwürfe', color: 'bg-slate-300', count: statusCounts.draft },
                  { key: 'sent', label: 'Versendet', color: 'bg-amber-400', count: statusCounts.sent },
                  { key: 'overdue', label: 'Überfällig', color: 'bg-rose-400', count: statusCounts.overdue },
                  { key: 'paid', label: 'Bezahlt', color: 'bg-teal-400', count: statusCounts.paid },
                ].map(stat => (
                  <div key={stat.key}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-slate-600">{stat.label}</span>
                      <span className="font-medium text-slate-900">{stat.count}</span>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-2">
                      <div
                        className={`h-2 rounded-full ${stat.color}`}
                        style={{ width: `${invoices.length > 0 ? (stat.count / invoices.length) * 100 : 0}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>

              {/* Quick Summary */}
              <div className="pt-4 border-t border-slate-100 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Gesamt (alle)</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-100 tabular-nums">
                    {formatCurrency(invoices.reduce((sum, i) => sum + (i.gross_amount || 0), 0))}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Davon bezahlt</span>
                  <span className="font-semibold text-teal-600 dark:text-teal-400 tabular-nums">
                    {formatCurrency(invoices.filter(i => i.status === 'paid').reduce((sum, i) => sum + (i.gross_amount || 0), 0))}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Dialogs */}
      <AddInvoiceDialog
        open={isAddDialogOpen}
        onOpenChange={(open) => {
          setIsAddDialogOpen(open);
          if (!open) fetchInvoices();
        }}
        onInvoiceCreated={async (invoiceId) => {
          // Load the created invoice and open detail view with A4 preview
          await fetchInvoices();
          const { data } = await supabase
            .from('invoices')
            .select('*, customers(company_name, contact_person), projects(name)')
            .eq('id', invoiceId)
            .single();
          if (data) {
            setSelectedInvoice(data);
            setIsDetailDialogOpen(true);
          }
        }}
      />

      {selectedInvoice && (
        <InvoiceDetailDialog
          isOpen={isDetailDialogOpen}
          onClose={() => {
            setIsDetailDialogOpen(false);
            setSelectedInvoice(null);
          }}
          invoice={selectedInvoice}
          onUpdate={fetchInvoices}
        />
      )}

    </div>
  );
};

export default InvoiceModuleV2;
