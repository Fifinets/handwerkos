import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  FileText, 
  Receipt, 
  Plus, 
  Search, 
  Send, 
  Eye,
  Edit,
  Download,
  Mail
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { AddQuoteDialog } from './AddQuoteDialog';
import { AddInvoiceDialog } from './AddInvoiceDialog';

interface Quote {
  id: string;
  quote_number: string;
  title: string;
  customer: {
    company_name: string;
    contact_person: string;
    email: string;
  };
  quote_date: string;
  valid_until: string | null;
  status: string;
  total_amount: number;
  currency: string;
}

interface Invoice {
  id: string;
  invoice_number: string;
  title: string;
  customer: {
    company_name: string;
    contact_person: string;
    email: string;
  };
  invoice_date: string;
  due_date: string;
  status: string;
  total_amount: number;
  currency: string;
}

export function DocumentModule() {
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddQuote, setShowAddQuote] = useState(false);
  const [showAddInvoice, setShowAddInvoice] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: quotes = [], isLoading: quotesLoading } = useQuery({
    queryKey: ['quotes'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('quotes')
        .select(`
          *,
          customer:customers(company_name, contact_person, email)
        `)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as Quote[];
    }
  });

  const sendEmailMutation = useMutation({
    mutationFn: async ({ documentType, documentId, documentData }: { 
      documentType: 'quote' | 'invoice', 
      documentId: string, 
      documentData: any 
    }) => {
      const { data, error } = await supabase.functions.invoke('send-document-email', {
        body: {
          documentType,
          documentId,
          recipientEmail: documentData.customer.email,
          recipientName: documentData.customer.contact_person
        }
      });

      if (error) throw error;
      return data;
    },
    onSuccess: (data, variables) => {
      toast({
        title: "E-Mail versendet",
        description: `${variables.documentType === 'quote' ? 'Angebot' : 'Rechnung'} wurde erfolgreich per E-Mail versendet.`,
      });
      queryClient.invalidateQueries({ queryKey: [variables.documentType === 'quote' ? 'quotes' : 'invoices'] });
    },
    onError: (error: any) => {
      console.error('Email sending error:', error);
      toast({
        title: "Fehler beim Versenden",
        description: error.message || "Beim Versenden der E-Mail ist ein Fehler aufgetreten.",
        variant: "destructive",
      });
    }
  });

  const handleSendEmail = (documentType: 'quote' | 'invoice', documentData: any) => {
    if (!documentData.customer?.email) {
      toast({
        title: "Keine E-Mail-Adresse",
        description: "Für diesen Kunden ist keine E-Mail-Adresse hinterlegt.",
        variant: "destructive",
      });
      return;
    }

    sendEmailMutation.mutate({
      documentType,
      documentId: documentData.id,
      documentData
    });
  };

  const { data: invoices = [], isLoading: invoicesLoading } = useQuery({
    queryKey: ['invoices'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('invoices')
        .select(`
          *,
          customer:customers(company_name, contact_person, email)
        `)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as Invoice[];
    }
  });

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'Entwurf': return 'secondary';
      case 'Versendet': return 'default';
      case 'Angenommen':
      case 'Bezahlt': return 'default';
      case 'Abgelehnt':
      case 'Storniert': return 'destructive';
      case 'Überfällig': return 'destructive';
      case 'Abgelaufen': return 'secondary';
      default: return 'default';
    }
  };

  const formatCurrency = (amount: number, currency: string = 'EUR') => {
    return new Intl.NumberFormat('de-DE', {
      style: 'currency',
      currency: currency
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('de-DE');
  };

  const filteredQuotes = quotes.filter(quote =>
    quote.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    quote.quote_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
    quote.customer.company_name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredInvoices = invoices.filter(invoice =>
    invoice.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    invoice.invoice_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
    invoice.customer.company_name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Dokumente</h1>
        <div className="flex gap-2">
          <Button onClick={() => setShowAddQuote(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Angebot erstellen
          </Button>
          <Button onClick={() => setShowAddInvoice(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Rechnung erstellen
          </Button>
        </div>
      </div>

      <div className="flex items-center space-x-2">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Dokumente suchen..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-8"
          />
        </div>
      </div>

      <Tabs defaultValue="quotes" className="space-y-4">
        <TabsList>
          <TabsTrigger value="quotes" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Angebote ({quotes.length})
          </TabsTrigger>
          <TabsTrigger value="invoices" className="flex items-center gap-2">
            <Receipt className="h-4 w-4" />
            Rechnungen ({invoices.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="quotes" className="space-y-4">
          {quotesLoading ? (
            <div className="text-center py-8">Lade Angebote...</div>
          ) : filteredQuotes.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center">
                <FileText className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">Keine Angebote gefunden</h3>
                <p className="text-muted-foreground mb-4">
                  {searchTerm ? 'Keine Angebote entsprechen Ihren Suchkriterien.' : 'Erstellen Sie Ihr erstes Angebot.'}
                </p>
                <Button onClick={() => setShowAddQuote(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Angebot erstellen
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {filteredQuotes.map((quote) => (
                <Card key={quote.id} className="hover:shadow-lg transition-shadow">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="font-semibold">{quote.quote_number}</h3>
                          <Badge variant={getStatusBadgeVariant(quote.status)}>
                            {quote.status}
                          </Badge>
                        </div>
                        <h4 className="text-lg font-medium mb-1">{quote.title}</h4>
                        <p className="text-sm text-muted-foreground mb-2">
                          {quote.customer.company_name} • {quote.customer.contact_person}
                        </p>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          <span>Erstellt: {formatDate(quote.quote_date)}</span>
                          {quote.valid_until && (
                            <span>Gültig bis: {formatDate(quote.valid_until)}</span>
                          )}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-xl font-bold mb-2">
                          {formatCurrency(quote.total_amount, quote.currency)}
                        </div>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="sm" title="Ansehen">
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="sm" title="Bearbeiten">
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            title="Per E-Mail versenden"
                            onClick={() => handleSendEmail('quote', quote)}
                            disabled={sendEmailMutation.isPending}
                          >
                            <Mail className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="sm" title="Herunterladen">
                            <Download className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="invoices" className="space-y-4">
          {invoicesLoading ? (
            <div className="text-center py-8">Lade Rechnungen...</div>
          ) : filteredInvoices.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center">
                <Receipt className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">Keine Rechnungen gefunden</h3>
                <p className="text-muted-foreground mb-4">
                  {searchTerm ? 'Keine Rechnungen entsprechen Ihren Suchkriterien.' : 'Erstellen Sie Ihre erste Rechnung.'}
                </p>
                <Button onClick={() => setShowAddInvoice(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Rechnung erstellen
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {filteredInvoices.map((invoice) => (
                <Card key={invoice.id} className="hover:shadow-lg transition-shadow">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="font-semibold">{invoice.invoice_number}</h3>
                          <Badge variant={getStatusBadgeVariant(invoice.status)}>
                            {invoice.status}
                          </Badge>
                        </div>
                        <h4 className="text-lg font-medium mb-1">{invoice.title}</h4>
                        <p className="text-sm text-muted-foreground mb-2">
                          {invoice.customer.company_name} • {invoice.customer.contact_person}
                        </p>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          <span>Erstellt: {formatDate(invoice.invoice_date)}</span>
                          <span>Fällig: {formatDate(invoice.due_date)}</span>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-xl font-bold mb-2">
                          {formatCurrency(invoice.total_amount, invoice.currency)}
                        </div>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="sm" title="Ansehen">
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="sm" title="Bearbeiten">
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            title="Per E-Mail versenden"
                            onClick={() => handleSendEmail('invoice', invoice)}
                            disabled={sendEmailMutation.isPending}
                          >
                            <Mail className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="sm" title="Herunterladen">
                            <Download className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      <AddQuoteDialog 
        open={showAddQuote} 
        onOpenChange={setShowAddQuote} 
      />
      <AddInvoiceDialog 
        open={showAddInvoice} 
        onOpenChange={setShowAddInvoice} 
      />
    </div>
  );
}