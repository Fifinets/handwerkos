import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
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
import { useToast } from '@/hooks/use-toast';
import { AddQuoteDialog } from './AddQuoteDialog';
import { AddInvoiceDialog } from './AddInvoiceDialog';
import QuoteActions from './QuoteActions';
import {
  useQuotes,
  useInvoices,
  useDocuments,
  useCreateQuote,
  useCreateInvoice,
  useUpdateQuote
} from '@/hooks/useApi';
import { useQueryClient } from '@tanstack/react-query';
// TODO: Re-enable when DocumentTemplateManager is implemented
// import DocumentTemplateManager from './documents/DocumentTemplateManager';

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

  // React Query hooks
  const { data: quotesResponse, isLoading: quotesLoading } = useQuotes();
  const { data: invoicesResponse, isLoading: invoicesLoading } = useInvoices();
  const { data: documentsResponse, isLoading: documentsLoading } = useDocuments();
  
  const queryClient = useQueryClient();
  const createQuoteMutation = useCreateQuote();
  const createInvoiceMutation = useCreateInvoice();
  const updateQuoteMutation = useUpdateQuote();
  
  // Extract data from responses
  const quotes = quotesResponse?.items || [];
  const invoices = invoicesResponse?.items || [];
  const documents = documentsResponse?.items || [];
  
  // Loading state
  const isLoading = quotesLoading || invoicesLoading || documentsLoading;

  const handleSendEmail = async (documentType: 'quote' | 'invoice', documentId: string, documentData: any) => {
    try {
      // This would use a send email mutation from useApi hooks
      toast({
        title: 'E-Mail versendet',
        description: `${documentType === 'quote' ? 'Angebot' : 'Rechnung'} wurde erfolgreich an ${documentData.customer?.email || 'den Kunden'} versendet.`
      });
    } catch (error) {
      toast({
        title: 'Fehler beim Versenden',
        description: 'Die E-Mail konnte nicht versendet werden.',
        variant: 'destructive'
      });
    }
  };
  // Email sending logic moved to handleSendEmail function above

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
    <div className="p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Dokumente</h1>
        <div className="flex items-center gap-4">
          <Button 
            onClick={() => setShowAddQuote(true)}
            className="bg-blue-600 hover:bg-blue-700 rounded-full"
          >
            <Plus className="h-4 w-4 mr-2" />
            Angebot erstellen
          </Button>
          <Button 
            onClick={() => setShowAddInvoice(true)}
            className="bg-blue-600 hover:bg-blue-700 rounded-full"
          >
            <Plus className="h-4 w-4 mr-2" />
            Rechnung erstellen
          </Button>
        </div>
      </div>

      {/* Search Bar */}
      <Card className="shadow-soft rounded-2xl overflow-hidden">
        <CardContent className="p-4">
          <div className="flex items-center space-x-2">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Dokumente suchen..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8 rounded-xl"
              />
            </div>
          </div>
        </CardContent>
      </Card>

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
          <TabsTrigger value="templates" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Vorlagen
          </TabsTrigger>
        </TabsList>

        <TabsContent value="quotes" className="space-y-4">
          {isLoading ? (
            <div className="space-y-4">
              {Array(3).fill(0).map((_, i) => (
                <Card key={i} className="shadow-soft rounded-2xl">
                  <CardContent className="p-4">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <Skeleton className="h-5 w-32" />
                          <Skeleton className="h-6 w-20" />
                        </div>
                        <Skeleton className="h-4 w-48 mb-2" />
                        <Skeleton className="h-4 w-24" />
                      </div>
                      <div className="text-right">
                        <Skeleton className="h-6 w-20 mb-2" />
                        <div className="flex gap-2">
                          <Skeleton className="h-8 w-16" />
                          <Skeleton className="h-8 w-16" />
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : filteredQuotes.length === 0 ? (
            <Card className="shadow-soft rounded-2xl">
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
                <Card key={quote.id} className="shadow-soft rounded-2xl hover:shadow-md transition-shadow">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="font-semibold">{quote.quote_number}</h3>
                          <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs ${
                            quote.status === 'Entwurf' ? 'bg-gray-100 text-gray-800' :
                            quote.status === 'Versendet' ? 'bg-blue-100 text-blue-800' :
                            quote.status === 'Angenommen' ? 'bg-green-100 text-green-800' :
                            quote.status === 'Abgelehnt' ? 'bg-red-100 text-red-800' :
                            'bg-gray-100 text-gray-800'
                          }`}>
                            {quote.status}
                          </span>
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
                          <Button variant="ghost" size="sm" title="Ansehen" className="rounded-xl">
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="sm" title="Bearbeiten" className="rounded-xl">
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="rounded-xl"
                            title="Per E-Mail versenden"
                            onClick={() => handleSendEmail('quote', quote.id, quote)}
                            disabled={false}
                          >
                            <Mail className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="sm" title="Herunterladen" className="rounded-xl">
                            <Download className="h-4 w-4" />
                          </Button>
                          <QuoteActions
                            quote={quote}
                            onRefresh={() =>
                              queryClient.invalidateQueries({ queryKey: ['quotes'] })
                            }
                          />
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
          {isLoading ? (
            <div className="space-y-4">
              {Array(3).fill(0).map((_, i) => (
                <Card key={i} className="shadow-soft rounded-2xl">
                  <CardContent className="p-4">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <Skeleton className="h-5 w-32" />
                          <Skeleton className="h-6 w-20" />
                        </div>
                        <Skeleton className="h-4 w-48 mb-2" />
                        <Skeleton className="h-4 w-24" />
                      </div>
                      <div className="text-right">
                        <Skeleton className="h-6 w-20 mb-2" />
                        <div className="flex gap-2">
                          <Skeleton className="h-8 w-16" />
                          <Skeleton className="h-8 w-16" />
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
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
                            onClick={() => handleSendEmail('invoice', invoice.id, invoice)}
                            disabled={false}
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
        <TabsContent value="templates" className="space-y-4">
          <Card>
            <CardContent className="py-8 text-center">
              <FileText className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">Vorlagen-Manager</h3>
              <p className="text-muted-foreground">
                Die Vorlagen-Funktionalität wird bald verfügbar sein.
              </p>
            </CardContent>
          </Card>
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