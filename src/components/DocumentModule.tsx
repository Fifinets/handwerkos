import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Plus, FileText, Eye } from "lucide-react"
import { supabase } from "@/integrations/supabase/client"
import { toast } from "sonner"

interface Quote {
  id: string
  title: string
  status: string
  created_at: string
}

interface Invoice {
  id: string
  title: string
  status: string
  created_at: string
}

const DocumentModuleSimple: React.FC = () => {
  const [quotes, setQuotes] = useState<Quote[]>([])
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const loadDocuments = async () => {
      try {
        // Load quotes
        const { data: quotesData, error: quotesError } = await supabase
          .from('quotes')
          .select('id, title, status, created_at')
          .order('created_at', { ascending: false })
          .limit(25)
        
        if (quotesError) console.error('Quotes error:', quotesError)
        else setQuotes(quotesData || [])

        // Load invoices  
        const { data: invoicesData, error: invoicesError } = await supabase
          .from('invoices')
          .select('id, title, status, created_at')
          .order('created_at', { ascending: false })
          .limit(25)
        
        if (invoicesError) console.error('Invoices error:', invoicesError)
        else setInvoices(invoicesData || [])
        
      } catch (error) {
        console.error('Error loading documents:', error)
        toast.error('Fehler beim Laden der Dokumente')
      } finally {
        setIsLoading(false)
      }
    }
    
    loadDocuments()
  }, [])

  const getStatusBadgeVariant = (status: string) => {
    switch (status.toLowerCase()) {
      case 'draft': case 'entwurf': return 'secondary'
      case 'sent': case 'versendet': return 'default'
      case 'paid': case 'bezahlt': return 'default'
      case 'accepted': case 'angenommen': return 'default'
      default: return 'outline'
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <h2 className="text-2xl font-bold">Dokumente</h2>
        <div className="text-center py-8">Laden...</div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Dokumente</h2>
          <p className="text-muted-foreground">
            Angebote und Rechnungen verwalten
          </p>
        </div>
        
        <Button onClick={() => toast.info('Funktion noch nicht verfügbar')}>
          <Plus className="h-4 w-4 mr-2" />
          Neues Dokument
        </Button>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Quotes */}
        <Card>
          <CardHeader>
            <CardTitle>Angebote ({quotes.length})</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {quotes.length === 0 ? (
              <div className="text-center py-8">
                <FileText className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">Keine Angebote vorhanden</p>
              </div>
            ) : (
              quotes.slice(0, 5).map((quote) => (
                <div key={quote.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <p className="font-medium">{quote.title}</p>
                    <p className="text-sm text-muted-foreground">
                      {new Date(quote.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={getStatusBadgeVariant(quote.status)}>
                      {quote.status}
                    </Badge>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => toast.info('Details-Ansicht noch nicht verfügbar')}
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))
            )}
            {quotes.length > 5 && (
              <Button variant="outline" className="w-full">
                Alle Angebote anzeigen ({quotes.length})
              </Button>
            )}
          </CardContent>
        </Card>

        {/* Invoices */}
        <Card>
          <CardHeader>
            <CardTitle>Rechnungen ({invoices.length})</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {invoices.length === 0 ? (
              <div className="text-center py-8">
                <FileText className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">Keine Rechnungen vorhanden</p>
              </div>
            ) : (
              invoices.slice(0, 5).map((invoice) => (
                <div key={invoice.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <p className="font-medium">{invoice.title}</p>
                    <p className="text-sm text-muted-foreground">
                      {new Date(invoice.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={getStatusBadgeVariant(invoice.status)}>
                      {invoice.status}
                    </Badge>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => toast.info('Details-Ansicht noch nicht verfügbar')}
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))
            )}
            {invoices.length > 5 && (
              <Button variant="outline" className="w-full">
                Alle Rechnungen anzeigen ({invoices.length})
              </Button>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

export default DocumentModuleSimple