import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Plus, FileText, Eye } from "lucide-react"
import { supabase } from "@/integrations/supabase/client"
import { toast } from "sonner"

interface DeliveryNote {
  id: string
  number: string
  status: string
  delivery_date: string
  created_at: string
}

const DeliveryNotesSimple: React.FC = () => {
  const [deliveryNotes, setDeliveryNotes] = useState<DeliveryNote[]>([])
  const [isLoading, setIsLoading] = useState(true)

  // Load delivery notes
  useEffect(() => {
    const loadDeliveryNotes = async () => {
      try {
        const { data, error } = await supabase
          .from('projects')
          .select(`
            id,
            name,
            customers!inner(
              id,
              company_name,
              email
            )
          `)
          .eq('status', 'active')
          .order('name')
        
        if (error) throw error
        setDeliveryNotes([])
        console.log('Using mock data - delivery notes not available')
      } catch (error) {
        console.error('Error loading delivery notes:', error)
        toast.error('Fehler beim Laden der Lieferscheine')
      } finally {
        setIsLoading(false)
      }
    }
    
    loadDeliveryNotes()
  }, [])

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'draft': return 'secondary'
      case 'sent': return 'default'
      case 'signed': return 'default'
      default: return 'outline'
    }
  }

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'draft': return 'Entwurf'
      case 'sent': return 'Versendet'
      case 'signed': return 'Signiert'
      default: return status
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold">Lieferscheine</h2>
          <Button disabled>
            <Plus className="h-4 w-4 mr-2" />
            Neuer Lieferschein
          </Button>
        </div>
        <div className="text-center py-8">Laden...</div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Lieferscheine</h2>
          <p className="text-muted-foreground">
            Übersicht Ihrer Lieferscheine
          </p>
        </div>
        
        <Button onClick={() => toast.info('Funktion noch nicht verfügbar')}>
          <Plus className="h-4 w-4 mr-2" />
          Neuer Lieferschein
        </Button>
      </div>

      <div className="grid gap-4">
        {deliveryNotes.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-16">
              <FileText className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">Keine Lieferscheine</h3>
              <p className="text-muted-foreground text-center mb-4">
                Sie haben noch keine Lieferscheine erstellt.
              </p>
              <Button onClick={() => toast.info('Funktion noch nicht verfügbar')}>
                <Plus className="h-4 w-4 mr-2" />
                Ersten Lieferschein erstellen
              </Button>
            </CardContent>
          </Card>
        ) : (
          deliveryNotes.map((note) => (
            <Card key={note.id}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-lg">{note.number}</CardTitle>
                    <p className="text-sm text-muted-foreground">
                      Lieferdatum: {new Date(note.delivery_date).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={getStatusBadgeVariant(note.status)}>
                      {getStatusLabel(note.status)}
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
              </CardHeader>
            </Card>
          ))
        )}
      </div>
    </div>
  )
}

export default DeliveryNotesSimple