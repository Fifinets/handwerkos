import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/integrations/supabase/client'
import { toast } from 'sonner'

interface DeliveryNote {
  id: string
  number: string
  project_id: string | null
  customer_id: string
  company_id: string
  status: 'draft' | 'sent' | 'signed' | 'cancelled'
  delivery_date: string
  delivery_address: any
  total_work_minutes: number
  total_break_minutes: number
  signature_data: any
  signed_at: string | null
  signed_by_name: string | null
  pdf_url: string | null
  pdf_generated_at: string | null
  created_at: string
  updated_at: string
  project?: {
    id: string
    name: string
    customer: {
      id: string
      name: string
      email: string | null
      phone: string | null
    }
  }
  items?: DeliveryNoteItem[]
}

interface DeliveryNoteItem {
  id: string
  delivery_note_id: string
  item_type: 'time' | 'material' | 'service'
  time_segment_id: string | null
  material_id: string | null
  description: string
  quantity: number
  unit: string
  unit_price: number | null
  total_price: number | null
  sort_order: number
  time_segment?: {
    started_at: string
    ended_at: string | null
    duration_minutes_computed: number
    segment_type: string
  }
  material?: {
    name: string
    unit: string
    unit_price: number
  }
}

interface CreateDeliveryNoteParams {
  projectId: string
  customerId: string
  deliveryDate?: string
  timeSegmentIds?: string[]
  materialItems?: Array<{
    materialId?: string
    description: string
    quantity: number
    unit?: string
    unitPrice?: number
  }>
  deliveryAddress?: any
}

export const useDeliveryNotes = () => {
  const [deliveryNotes, setDeliveryNotes] = useState<DeliveryNote[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isCreating, setIsCreating] = useState(false)

  // Alle Lieferscheine laden
  const fetchDeliveryNotes = useCallback(async (filters?: {
    status?: string[]
    projectId?: string
    startDate?: string
    endDate?: string
  }) => {
    try {
      setIsLoading(true)
      
      let query = supabase
        .from('delivery_notes')
        .select(`
          *,
          project:projects(
            id,
            name,
            customer:customers(
              id,
              name,
              email,
              phone
            )
          ),
          items:delivery_note_items(
            *,
            time_segment:time_segments(
              started_at,
              ended_at,
              duration_minutes_computed,
              segment_type
            ),
            material:materials(
              name,
              unit,
              unit_price
            )
          )
        `)
        .order('created_at', { ascending: false })

      // Filter anwenden
      if (filters?.status?.length) {
        query = query.in('status', filters.status)
      }
      if (filters?.projectId) {
        query = query.eq('project_id', filters.projectId)
      }
      if (filters?.startDate) {
        query = query.gte('created_at', filters.startDate)
      }
      if (filters?.endDate) {
        query = query.lte('created_at', filters.endDate)
      }

      const { data, error } = await query

      if (error) throw error
      
      setDeliveryNotes(data || [])
      return data
      
    } catch (error: any) {
      console.error('Error fetching delivery notes:', error)
      toast.error('Fehler beim Laden der Lieferscheine')
      throw error
    } finally {
      setIsLoading(false)
    }
  }, [])

  // Einzelnen Lieferschein laden
  const fetchDeliveryNote = useCallback(async (id: string) => {
    try {
      const { data, error } = await supabase
        .from('delivery_notes')
        .select(`
          *,
          project:projects(
            id,
            name,
            customer:customers(
              id,
              name,
              email,
              phone
            )
          ),
          items:delivery_note_items(
            *,
            time_segment:time_segments(
              started_at,
              ended_at,
              duration_minutes_computed,
              segment_type,
              description
            ),
            material:materials(
              name,
              unit,
              unit_price
            )
          )
        `)
        .eq('id', id)
        .single()

      if (error) throw error
      return data
      
    } catch (error: any) {
      console.error('Error fetching delivery note:', error)
      toast.error('Fehler beim Laden des Lieferscheins')
      throw error
    }
  }, [])

  // Lieferschein erstellen
  const createDeliveryNote = useCallback(async (params: CreateDeliveryNoteParams) => {
    try {
      setIsCreating(true)
      
      const { data, error } = await supabase.rpc('rpc_create_delivery_note', {
        p_project_id: params.projectId,
        p_customer_id: params.customerId,
        p_delivery_date: params.deliveryDate || new Date().toISOString().split('T')[0],
        p_time_segment_ids: params.timeSegmentIds || null,
        p_material_items: params.materialItems ? JSON.stringify(params.materialItems) : null,
        p_delivery_address: params.deliveryAddress || null
      })
      
      if (error) throw error
      
      toast.success(`Lieferschein ${data.delivery_note.number} erstellt`)
      await fetchDeliveryNotes() // Refresh list
      return data.delivery_note
      
    } catch (error: any) {
      console.error('Error creating delivery note:', error)
      toast.error(error.message || 'Fehler beim Erstellen des Lieferscheins')
      throw error
    } finally {
      setIsCreating(false)
    }
  }, [fetchDeliveryNotes])

  // Lieferschein signieren
  const signDeliveryNote = useCallback(async (
    id: string,
    signatureData: any,
    signedByName: string
  ) => {
    try {
      const { data, error } = await supabase.rpc('rpc_sign_delivery_note', {
        p_delivery_note_id: id,
        p_signature_data: signatureData,
        p_signed_by_name: signedByName
      })
      
      if (error) throw error
      
      if (data.action === 'already_signed') {
        toast.info('Lieferschein ist bereits signiert')
      } else {
        toast.success('Lieferschein erfolgreich signiert')
      }
      
      await fetchDeliveryNotes() // Refresh list
      return data.delivery_note
      
    } catch (error: any) {
      console.error('Error signing delivery note:', error)
      toast.error(error.message || 'Fehler beim Signieren des Lieferscheins')
      throw error
    }
  }, [fetchDeliveryNotes])

  // PDF generieren
  const generatePDF = useCallback(async (id: string) => {
    try {
      toast.loading('PDF wird generiert...', { id: 'pdf-gen' })
      
      const { data, error } = await supabase.functions.invoke('generate-delivery-note-pdf', {
        body: { deliveryNoteId: id }
      })
      
      if (error) throw error
      
      // PDF als Blob erstellen und Download triggern
      const blob = new Blob([data], { type: 'application/pdf' })
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `lieferschein-${id}.pdf`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
      
      toast.success('PDF erfolgreich generiert', { id: 'pdf-gen' })
      return data
      
    } catch (error: any) {
      console.error('Error generating PDF:', error)
      toast.error('Fehler bei der PDF-Generierung', { id: 'pdf-gen' })
      throw error
    }
  }, [])

  // Email versenden
  const sendEmail = useCallback(async (
    id: string,
    recipientEmail?: string,
    subject?: string,
    message?: string,
    attachPdf: boolean = true
  ) => {
    try {
      toast.loading('Email wird versendet...', { id: 'email-send' })
      
      const deliveryNote = await fetchDeliveryNote(id)
      
      const { data, error } = await supabase.functions.invoke('send-document-email', {
        body: {
          documentType: 'delivery_note',
          documentId: id,
          recipientEmail: recipientEmail || deliveryNote.project?.customer.email,
          recipientName: deliveryNote.project?.customer.name,
          subject,
          message,
          attachPdf
        }
      })
      
      if (error) throw error
      
      toast.success('Email erfolgreich versendet', { id: 'email-send' })
      await fetchDeliveryNotes() // Refresh to show updated status
      return data
      
    } catch (error: any) {
      console.error('Error sending email:', error)
      toast.error('Fehler beim Email-Versand', { id: 'email-send' })
      throw error
    }
  }, [fetchDeliveryNote, fetchDeliveryNotes])

  // Status ändern
  const updateStatus = useCallback(async (
    id: string,
    status: 'draft' | 'sent' | 'signed' | 'cancelled'
  ) => {
    try {
      const { error } = await supabase
        .from('delivery_notes')
        .update({ 
          status,
          updated_at: new Date().toISOString()
        })
        .eq('id', id)
      
      if (error) throw error
      
      toast.success('Status aktualisiert')
      await fetchDeliveryNotes()
      
    } catch (error: any) {
      console.error('Error updating status:', error)
      toast.error('Fehler beim Aktualisieren des Status')
      throw error
    }
  }, [fetchDeliveryNotes])

  // Zeitregeln anwenden (Rundung)
  const applyTimeRules = useCallback(async (id: string, applyRounding: boolean = true) => {
    try {
      const { data, error } = await supabase.rpc('rpc_apply_time_rules', {
        p_delivery_note_id: id,
        p_apply_rounding: applyRounding
      })
      
      if (error) throw error
      
      if (data.action === 'no_rules_applied') {
        toast.info('Keine aktiven Zeitregeln vorhanden')
      } else {
        const adjustments = data.adjustments || []
        const totalAdjustment = adjustments.reduce((sum: number, adj: any) => sum + adj.difference, 0)
        toast.success(`Zeitregeln angewendet (${totalAdjustment > 0 ? '+' : ''}${totalAdjustment} Minuten)`)
      }
      
      await fetchDeliveryNotes()
      return data
      
    } catch (error: any) {
      console.error('Error applying time rules:', error)
      toast.error('Fehler beim Anwenden der Zeitregeln')
      throw error
    }
  }, [fetchDeliveryNotes])

  // Real-time Updates
  useEffect(() => {
    const channel = supabase
      .channel('delivery_notes_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'delivery_notes'
        },
        () => {
          fetchDeliveryNotes()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [fetchDeliveryNotes])

  // Initial load
  useEffect(() => {
    fetchDeliveryNotes()
  }, [fetchDeliveryNotes])

  return {
    // State
    deliveryNotes,
    isLoading,
    isCreating,
    
    // Actions
    createDeliveryNote,
    signDeliveryNote,
    generatePDF,
    sendEmail,
    updateStatus,
    applyTimeRules,
    
    // Data fetching
    fetchDeliveryNotes,
    fetchDeliveryNote,
    
    // Utils
    getByStatus: (status: string) => deliveryNotes.filter(note => note.status === status),
    getByProject: (projectId: string) => deliveryNotes.filter(note => note.project_id === projectId),
    getTotalCount: () => deliveryNotes.length
  }
}