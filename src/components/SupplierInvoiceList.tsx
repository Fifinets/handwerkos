import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { 
  Receipt, 
  Search, 
  Calendar, 
  Euro, 
  Building2, 
  FileCheck,
  Clock,
  CheckCircle,
  XCircle
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface SupplierInvoice {
  id: string;
  invoice_number: string;
  supplier_name: string;
  invoice_date: string;
  due_date?: string;
  total_amount: number;
  vat_amount?: number;
  description?: string;
  iban?: string;
  status: 'pending' | 'approved' | 'paid' | 'cancelled';
  created_at: string;
  ocr_result_id?: string;
}

export function SupplierInvoiceList() {
  const [invoices, setInvoices] = useState<SupplierInvoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedInvoice, setSelectedInvoice] = useState<SupplierInvoice | null>(null);

  useEffect(() => {
    loadInvoices();
  }, []);

  const loadInvoices = async () => {
    try {
      setLoading(true);
      
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('supplier_invoices')
        .select('*')
        .eq('created_by', user.id)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error loading supplier invoices:', error);
        return;
      }

      setInvoices(data || []);
    } catch (error) {
      console.error('Failed to load supplier invoices:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('de-DE', {
      style: 'currency',
      currency: 'EUR'
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('de-DE');
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return (
          <Badge variant="outline" className="bg-yellow-50 text-yellow-800 border-yellow-200">
            <Clock className="h-3 w-3 mr-1" />
            Ausstehend
          </Badge>
        );
      case 'approved':
        return (
          <Badge variant="outline" className="bg-blue-50 text-blue-800 border-blue-200">
            <CheckCircle className="h-3 w-3 mr-1" />
            Genehmigt
          </Badge>
        );
      case 'paid':
        return (
          <Badge variant="outline" className="bg-green-50 text-green-800 border-green-200">
            <CheckCircle className="h-3 w-3 mr-1" />
            Bezahlt
          </Badge>
        );
      case 'cancelled':
        return (
          <Badge variant="outline" className="bg-red-50 text-red-800 border-red-200">
            <XCircle className="h-3 w-3 mr-1" />
            Storniert
          </Badge>
        );
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const updateInvoiceStatus = async (invoiceId: string, newStatus: string) => {
    try {
      const { error } = await supabase
        .from('supplier_invoices')
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq('id', invoiceId);

      if (error) {
        console.error('Error updating invoice status:', error);
        return;
      }

      // Update local state
      setInvoices(prev => 
        prev.map(invoice => 
          invoice.id === invoiceId 
            ? { ...invoice, status: newStatus as any }
            : invoice
        )
      );
    } catch (error) {
      console.error('Failed to update invoice status:', error);
    }
  };

  const filteredInvoices = invoices.filter(invoice => {
    const matchesSearch = 
      invoice.invoice_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
      invoice.supplier_name.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || invoice.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p>Lade Lieferantenrechnungen...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Receipt className="h-6 w-6" />
            Lieferantenrechnungen
          </h1>
          <p className="text-muted-foreground mt-1">
            Verwalten Sie Ihre eingescannten und erstellten Lieferantenrechnungen
          </p>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Nach Rechnungsnummer oder Lieferant suchen..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 border rounded-md bg-background"
            >
              <option value="all">Alle Status</option>
              <option value="pending">Ausstehend</option>
              <option value="approved">Genehmigt</option>
              <option value="paid">Bezahlt</option>
              <option value="cancelled">Storniert</option>
            </select>
          </div>
        </CardContent>
      </Card>

      {/* Invoice List */}
      {filteredInvoices.length === 0 ? (
        <Card>
          <CardContent className="py-12">
            <div className="text-center">
              <Receipt className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">Keine Rechnungen gefunden</h3>
              <p className="text-muted-foreground">
                {searchTerm || statusFilter !== 'all' 
                  ? 'Keine Rechnungen entsprechen den aktuellen Filterkriterien.'
                  : 'Sie haben noch keine Lieferantenrechnungen erstellt.'
                }
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {filteredInvoices.map((invoice) => (
            <Card key={invoice.id} className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => setSelectedInvoice(invoice)}>
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div className="space-y-3 flex-1">
                    {/* Header Row */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <h3 className="font-semibold text-lg">
                          {invoice.invoice_number}
                        </h3>
                        {invoice.ocr_result_id && (
                          <Badge variant="outline" className="text-xs">
                            <FileCheck className="h-3 w-3 mr-1" />
                            OCR
                          </Badge>
                        )}
                      </div>
                      {getStatusBadge(invoice.status)}
                    </div>

                    {/* Details */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                      <div className="flex items-center gap-2">
                        <Building2 className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">{invoice.supplier_name}</span>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        <span>Datum: {formatDate(invoice.invoice_date)}</span>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <Euro className="h-4 w-4 text-muted-foreground" />
                        <span className="font-semibold text-primary">
                          {formatCurrency(invoice.total_amount)}
                        </span>
                      </div>
                    </div>

                    {/* Description & IBAN */}
                    {(invoice.description || invoice.iban) && (
                      <div className="text-sm text-muted-foreground space-y-1">
                        {invoice.description && (
                          <div>Beschreibung: {invoice.description}</div>
                        )}
                        {invoice.iban && (
                          <div>IBAN: {invoice.iban}</div>
                        )}
                      </div>
                    )}

                    {/* VAT Amount */}
                    {invoice.vat_amount && invoice.vat_amount > 0 && (
                      <div className="text-sm text-muted-foreground">
                        inkl. MwSt: {formatCurrency(invoice.vat_amount)}
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2 ml-4">
                    {invoice.status === 'pending' && (
                      <>
                        <Button
                          size="sm"
                          onClick={() => updateInvoiceStatus(invoice.id, 'approved')}
                          className="bg-blue-600 hover:bg-blue-700"
                        >
                          Genehmigen
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => updateInvoiceStatus(invoice.id, 'cancelled')}
                          className="border-red-600 text-red-600 hover:bg-red-50"
                        >
                          Stornieren
                        </Button>
                      </>
                    )}
                    {invoice.status === 'approved' && (
                      <Button
                        size="sm"
                        onClick={() => updateInvoiceStatus(invoice.id, 'paid')}
                        className="bg-green-600 hover:bg-green-700"
                      >
                        Als bezahlt markieren
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Summary */}
      {filteredInvoices.length > 0 && (
        <Card className="bg-muted/50">
          <CardContent className="pt-6">
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">
                {filteredInvoices.length} Rechnung{filteredInvoices.length !== 1 ? 'en' : ''} gefunden
              </span>
              <span className="font-semibold">
                Gesamtsumme: {formatCurrency(
                  filteredInvoices
                    .filter(inv => inv.status !== 'cancelled')
                    .reduce((sum, inv) => sum + inv.total_amount, 0)
                )}
              </span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Invoice Detail Modal */}
      {selectedInvoice && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={() => setSelectedInvoice(null)}>
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold flex items-center gap-2">
                <Receipt className="h-6 w-6" />
                Rechnungsdetails
              </h2>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => setSelectedInvoice(null)}
                className="hover:bg-gray-100"
              >
                <XCircle className="h-4 w-4" />
              </Button>
            </div>

            <div className="space-y-6">
              {/* Header Info */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h3 className="font-semibold text-lg mb-3">Rechnungsinformationen</h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Rechnungsnummer:</span>
                      <span className="font-medium">{selectedInvoice.invoice_number}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Lieferant:</span>
                      <span className="font-medium">{selectedInvoice.supplier_name}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Rechnungsdatum:</span>
                      <span>{formatDate(selectedInvoice.invoice_date)}</span>
                    </div>
                    {selectedInvoice.due_date && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Fälligkeitsdatum:</span>
                        <span>{formatDate(selectedInvoice.due_date)}</span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Status:</span>
                      {getStatusBadge(selectedInvoice.status)}
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="font-semibold text-lg mb-3">Beträge</h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Gesamtbetrag:</span>
                      <span className="font-bold text-lg text-primary">{formatCurrency(selectedInvoice.total_amount)}</span>
                    </div>
                    {selectedInvoice.vat_amount && selectedInvoice.vat_amount > 0 && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">MwSt-Betrag:</span>
                        <span>{formatCurrency(selectedInvoice.vat_amount)}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Description */}
              {selectedInvoice.description && (
                <div>
                  <h3 className="font-semibold text-lg mb-3">Beschreibung</h3>
                  <p className="text-sm text-muted-foreground bg-gray-50 p-3 rounded-lg">
                    {selectedInvoice.description}
                  </p>
                </div>
              )}

              {/* IBAN */}
              {selectedInvoice.iban && (
                <div>
                  <h3 className="font-semibold text-lg mb-3">Zahlungsinformationen</h3>
                  <div className="text-sm">
                    <span className="text-muted-foreground">IBAN: </span>
                    <span className="font-mono bg-gray-50 px-2 py-1 rounded">{selectedInvoice.iban}</span>
                  </div>
                </div>
              )}

              {/* OCR Info */}
              {selectedInvoice.ocr_result_id && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <div className="flex items-center gap-2 text-blue-800">
                    <FileCheck className="h-4 w-4" />
                    <span className="text-sm font-medium">Diese Rechnung wurde über OCR erfasst</span>
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex gap-3 pt-4 border-t">
                {selectedInvoice.status === 'pending' && (
                  <>
                    <Button
                      onClick={() => {
                        updateInvoiceStatus(selectedInvoice.id, 'approved');
                        setSelectedInvoice(null);
                      }}
                      className="bg-blue-600 hover:bg-blue-700"
                    >
                      <CheckCircle className="h-4 w-4 mr-2" />
                      Genehmigen
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => {
                        updateInvoiceStatus(selectedInvoice.id, 'cancelled');
                        setSelectedInvoice(null);
                      }}
                      className="border-red-600 text-red-600 hover:bg-red-50"
                    >
                      <XCircle className="h-4 w-4 mr-2" />
                      Stornieren
                    </Button>
                  </>
                )}
                {selectedInvoice.status === 'approved' && (
                  <Button
                    onClick={() => {
                      updateInvoiceStatus(selectedInvoice.id, 'paid');
                      setSelectedInvoice(null);
                    }}
                    className="bg-green-600 hover:bg-green-700"
                  >
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Als bezahlt markieren
                  </Button>
                )}
                <Button
                  variant="outline"
                  onClick={() => setSelectedInvoice(null)}
                >
                  Schließen
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}