import React from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { 
  FileText,
  Clock,
  User,
  Calendar,
  CheckCircle,
  AlertCircle,
  PenTool,
  Mail,
  Eye
} from 'lucide-react'
import { format } from 'date-fns'
import { de } from 'date-fns/locale'
import { PDFEmailActions } from './PDFEmailActions'

interface DeliveryNote {
  id: string
  number: string
  status: 'draft' | 'sent' | 'signed' | 'cancelled'
  delivery_date: string
  created_at: string
  total_work_minutes: number
  signed_at?: string
  signed_by_name?: string
  project?: {
    id: string
    name: string
    customer?: {
      id: string
      name: string
      email?: string
    }
  }
  delivery_note_items?: Array<{
    id: string
    description: string
    quantity: number
    unit: string
    item_type: 'time' | 'material' | 'service'
  }>
}

interface DeliveryNoteCardProps {
  deliveryNote: DeliveryNote
  onSelect?: (note: DeliveryNote) => void
  onSign?: (note: DeliveryNote) => void
  showActions?: boolean
}

export const DeliveryNoteCard: React.FC<DeliveryNoteCardProps> = ({
  deliveryNote,
  onSelect,
  onSign,
  showActions = true
}) => {
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'draft':
        return <Badge variant="secondary">Entwurf</Badge>
      case 'sent':
        return <Badge variant="default">Versendet</Badge>
      case 'signed':
        return <Badge variant="default" className="bg-green-100 text-green-800">Signiert</Badge>
      case 'cancelled':
        return <Badge variant="destructive">Storniert</Badge>
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'draft':
        return <AlertCircle className="h-4 w-4 text-yellow-500" />
      case 'sent':
        return <Mail className="h-4 w-4 text-blue-500" />
      case 'signed':
        return <CheckCircle className="h-4 w-4 text-green-500" />
      case 'cancelled':
        return <AlertCircle className="h-4 w-4 text-red-500" />
      default:
        return <FileText className="h-4 w-4 text-gray-500" />
    }
  }

  const formatMinutesToHours = (minutes: number) => {
    const hours = Math.floor(minutes / 60)
    const mins = minutes % 60
    return `${hours}:${mins.toString().padStart(2, '0')}h`
  }

  return (
    <Card className="hover:shadow-md transition-shadow cursor-pointer">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <CardTitle className="text-lg flex items-center gap-2">
              {getStatusIcon(deliveryNote.status)}
              {deliveryNote.number}
            </CardTitle>
            <CardDescription>
              {deliveryNote.project?.name || 'Projekt nicht zugeordnet'}
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            {getStatusBadge(deliveryNote.status)}
            {showActions && (
              <PDFEmailActions 
                deliveryNote={deliveryNote} 
                showDropdown={true}
                size="sm"
                variant="ghost"
              />
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-0" onClick={() => onSelect?.(deliveryNote)}>
        <div className="grid grid-cols-2 gap-4 text-sm">
          {/* Kunde */}
          <div className="flex items-center gap-2">
            <User className="h-4 w-4 text-muted-foreground" />
            <span>{deliveryNote.project?.customer?.name || 'Kunde nicht zugeordnet'}</span>
          </div>

          {/* Lieferdatum */}
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <span>{format(new Date(deliveryNote.delivery_date), 'dd.MM.yyyy', { locale: de })}</span>
          </div>

          {/* Arbeitszeit */}
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <span>{formatMinutesToHours(deliveryNote.total_work_minutes)}</span>
          </div>

          {/* Anzahl Items */}
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-muted-foreground" />
            <span>{deliveryNote.delivery_note_items?.length || 0} Positionen</span>
          </div>
        </div>

        {/* Signatur Info */}
        {deliveryNote.signed_at && (
          <div className="mt-3 pt-3 border-t">
            <div className="flex items-center gap-2 text-sm text-green-700">
              <PenTool className="h-4 w-4" />
              <span>
                Signiert von {deliveryNote.signed_by_name} am{' '}
                {format(new Date(deliveryNote.signed_at), 'dd.MM.yyyy HH:mm', { locale: de })}
              </span>
            </div>
          </div>
        )}

        {/* Actions */}
        {showActions && (
          <div className="flex justify-between items-center mt-4 pt-3 border-t">
            <Button
              variant="outline"
              size="sm"
              onClick={(e) => {
                e.stopPropagation()
                onSelect?.(deliveryNote)
              }}
            >
              <Eye className="h-4 w-4 mr-2" />
              Details
            </Button>

            {deliveryNote.status !== 'signed' && deliveryNote.status !== 'cancelled' && onSign && (
              <Button
                variant="default"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation()
                  onSign(deliveryNote)
                }}
              >
                <PenTool className="h-4 w-4 mr-2" />
                Signieren
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}