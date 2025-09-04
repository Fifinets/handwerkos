import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Input } from "@/components/ui/input"
import { 
  PenTool, 
  CheckCircle2, 
  Clock, 
  FileText, 
  Download,
  Mail,
  User,
  Calendar,
  MapPin,
  Package,
  Timer,
  Smartphone
} from "lucide-react"
import { useDeliveryNotes } from "@/hooks/useDeliveryNotes"
import { useSupabaseAuth } from "@/hooks/useSupabaseAuth"
import SignatureCapture from './SignatureCapture'
import { offlineQueue } from '@/utils/offlineQueue'
import { useNetworkStatus } from '@/utils/networkStatus'
import { toast } from "sonner"

interface MobileDeliverySignatureProps {
  className?: string
}

const MobileDeliverySignature: React.FC<MobileDeliverySignatureProps> = ({ 
  className = "" 
}) => {
  const { user } = useSupabaseAuth()
  const networkStatus = useNetworkStatus()
  const { deliveryNotes, fetchDeliveryNotes, signDeliveryNote } = useDeliveryNotes()
  
  const [selectedNote, setSelectedNote] = useState<any>(null)
  const [showSignatureDialog, setShowSignatureDialog] = useState(false)
  const [signerName, setSignerName] = useState('')
  const [pendingActionsCount, setPendingActionsCount] = useState(0)

  // Filter unsigned delivery notes that are sent to current user
  const unsignedDeliveryNotes = deliveryNotes?.filter(note => 
    note.status === 'sent' && !note.signed_at
  ) || []

  useEffect(() => {
    fetchDeliveryNotes()
    updatePendingActionsCount()
  }, [fetchDeliveryNotes])

  useEffect(() => {
    if (networkStatus.connected && pendingActionsCount > 0) {
      processOfflineQueue()
    }
  }, [networkStatus.connected, pendingActionsCount])

  const updatePendingActionsCount = async () => {
    const queueLength = await offlineQueue.getQueueLength()
    setPendingActionsCount(queueLength)
  }

  const processOfflineQueue = async () => {
    try {
      await offlineQueue.processQueue()
      await updatePendingActionsCount()
      
      if (pendingActionsCount > 0) {
        toast.success('Offline-Signaturen erfolgreich synchronisiert')
      }
    } catch (error) {
      console.error('Error processing offline queue:', error)
    }
  }

  const handleSignatureStart = (note: any) => {
    setSelectedNote(note)
    setSignerName('')
    setShowSignatureDialog(true)
  }

  const handleSignatureSave = async (signature: { svg: string; name: string }) => {
    if (!selectedNote) return

    if (!networkStatus.connected) {
      // Store signature for offline processing
      await offlineQueue.addAction('SIGN_DELIVERY_NOTE', {
        delivery_note_id: selectedNote.id,
        signature_data: { svg: signature.svg },
        signer_name: signature.name,
        location: null
      })
      
      await updatePendingActionsCount()
      toast.info('Signatur für Offline-Verarbeitung gespeichert')
      setShowSignatureDialog(false)
      return
    }

    try {
      await signDeliveryNote(
        selectedNote.id,
        { svg: signature.svg },
        signature.name
      )
      
      setShowSignatureDialog(false)
      setSelectedNote(null)
      await fetchDeliveryNotes()
      
      toast.success('Lieferschein erfolgreich signiert')
    } catch (error) {
      console.error('Error signing delivery note:', error)
      toast.error('Fehler beim Signieren des Lieferscheins')
    }
  }

  const formatDuration = (minutes: number) => {
    const hours = Math.floor(minutes / 60)
    const mins = minutes % 60
    return `${hours}:${mins.toString().padStart(2, '0')}h`
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('de-DE', {
      weekday: 'short',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    })
  }

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString('de-DE', {
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  if (unsignedDeliveryNotes.length === 0 && pendingActionsCount === 0) {
    return (
      <div className={`space-y-4 ${className}`}>
        <Card className="border-0 shadow-lg">
          <CardContent className="p-8 text-center">
            <div className="text-gray-400 mb-4">
              <CheckCircle2 className="h-12 w-12 mx-auto" />
            </div>
            <h3 className="font-semibold text-gray-700 mb-2">Alle Lieferscheine signiert</h3>
            <p className="text-gray-500 text-sm">
              Keine Lieferscheine warten auf Ihre Unterschrift
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Header */}
      <Card className="border-0 shadow-lg bg-gradient-to-r from-orange-500 to-amber-500 text-white">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <PenTool className="h-6 w-6" />
              <span>Zu signierende Lieferscheine</span>
            </div>
            <div className="flex items-center gap-2">
              {pendingActionsCount > 0 && (
                <Badge variant="secondary" className="bg-yellow-500 text-white">
                  {pendingActionsCount}
                </Badge>
              )}
              <Badge variant="secondary" className="bg-white/20 text-white">
                {unsignedDeliveryNotes.length}
              </Badge>
            </div>
          </CardTitle>
        </CardHeader>
      </Card>

      {/* Offline Status */}
      {!networkStatus.connected && (
        <Card className="border-orange-200 bg-orange-50">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-orange-700">
              <Smartphone className="h-5 w-5" />
              <span className="font-medium">Offline-Modus</span>
            </div>
            <p className="text-orange-600 text-sm mt-1">
              Signaturen werden gespeichert und automatisch synchronisiert, sobald eine Internetverbindung verfügbar ist.
            </p>
            {pendingActionsCount > 0 && (
              <div className="text-sm font-medium text-orange-800 mt-2">
                {pendingActionsCount} Signatur(en) warten auf Synchronisation
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Unsigned Delivery Notes */}
      <div className="space-y-3">
        {unsignedDeliveryNotes.map((note) => (
          <Card key={note.id} className="border-0 shadow-md hover:shadow-lg transition-shadow">
            <CardContent className="p-4">
              {/* Header with number and status */}
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <FileText className="h-5 w-5 text-blue-600" />
                  <span className="font-semibold text-lg">{note.number}</span>
                </div>
                <Badge variant="secondary" className="bg-orange-100 text-orange-700">
                  Wartet auf Signatur
                </Badge>
              </div>

              {/* Project and Customer Info */}
              <div className="space-y-2 mb-4">
                <div className="flex items-center gap-2 text-sm">
                  <Package className="h-4 w-4 text-gray-500" />
                  <span className="font-medium">{note.project?.name || 'Kein Projekt'}</span>
                </div>
                {note.project?.customer && (
                  <div className="flex items-center gap-2 text-sm">
                    <User className="h-4 w-4 text-gray-500" />
                    <span>{note.project.customer.name}</span>
                  </div>
                )}
                <div className="flex items-center gap-2 text-sm">
                  <Calendar className="h-4 w-4 text-gray-500" />
                  <span>{formatDate(note.created_at)}</span>
                </div>
              </div>

              <Separator className="my-3" />

              {/* Time Segments Summary */}
              {note.delivery_note_time_segments?.length > 0 && (
                <div className="mb-4">
                  <h4 className="font-medium text-sm mb-2 flex items-center gap-2">
                    <Timer className="h-4 w-4" />
                    Zeiterfassung ({note.delivery_note_time_segments.length} Einträge)
                  </h4>
                  <div className="space-y-1">
                    {note.delivery_note_time_segments.slice(0, 3).map((segment: any, index: number) => (
                      <div key={index} className="flex items-center justify-between text-sm bg-gray-50 p-2 rounded">
                        <div className="flex items-center gap-2">
                          <Clock className="h-3 w-3 text-gray-400" />
                          <span>{formatDate(segment.time_segment.started_at)}</span>
                          <span className="text-gray-500">
                            {formatTime(segment.time_segment.started_at)} - {formatTime(segment.time_segment.ended_at)}
                          </span>
                        </div>
                        <span className="font-medium">
                          {formatDuration(segment.time_segment.duration_minutes)}
                        </span>
                      </div>
                    ))}
                    {note.delivery_note_time_segments.length > 3 && (
                      <div className="text-xs text-gray-500 text-center py-1">
                        +{note.delivery_note_time_segments.length - 3} weitere Einträge
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Items Summary */}
              {note.delivery_note_items?.length > 0 && (
                <div className="mb-4">
                  <h4 className="font-medium text-sm mb-2">
                    Materialien ({note.delivery_note_items.length} Positionen)
                  </h4>
                  <div className="space-y-1">
                    {note.delivery_note_items.slice(0, 2).map((item: any, index: number) => (
                      <div key={index} className="flex items-center justify-between text-sm bg-gray-50 p-2 rounded">
                        <span>{item.description}</span>
                        <span className="font-medium">
                          {item.quantity} {item.unit}
                        </span>
                      </div>
                    ))}
                    {note.delivery_note_items.length > 2 && (
                      <div className="text-xs text-gray-500 text-center py-1">
                        +{note.delivery_note_items.length - 2} weitere Positionen
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Location if available */}
              {note.location_lat && note.location_lng && (
                <div className="flex items-center gap-2 text-sm text-gray-600 mb-4">
                  <MapPin className="h-4 w-4" />
                  <span>Standort erfasst</span>
                </div>
              )}

              {/* Notes */}
              {note.notes && (
                <div className="mb-4 p-3 bg-blue-50 rounded-lg">
                  <p className="text-sm text-gray-700">
                    <strong>Hinweise:</strong> {note.notes}
                  </p>
                </div>
              )}

              {/* Action Button */}
              <Button
                onClick={() => handleSignatureStart(note)}
                className="w-full h-12 text-lg bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600"
              >
                <PenTool className="h-5 w-5 mr-2" />
                Lieferschein signieren
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Signature Dialog */}
      <SignatureCapture
        isOpen={showSignatureDialog}
        onClose={() => {
          setShowSignatureDialog(false)
          setSelectedNote(null)
        }}
        onSave={handleSignatureSave}
        title={`Lieferschein ${selectedNote?.number} signieren`}
        description="Bitte unterschreiben Sie zur Bestätigung des Erhalts der Leistungen"
        signerName={signerName}
        onSignerNameChange={setSignerName}
      />
    </div>
  )
}

export default MobileDeliverySignature