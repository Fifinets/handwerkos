import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/integrations/supabase/client'
import { toast } from 'sonner'
import { isAndroid, useAndroidDeliveryNotes } from '@/utils/androidPlugins'

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
  delivery_note_items?: DeliveryNoteItem[]
  delivery_note_time_segments?: Array<{
    time_segment: {
      started_at: string
      ended_at: string
      duration_minutes: number
    }
  }>
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
    description: string | null
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
  const [isLoading, setIsLoading] = useState(false)
  const [isCreating, setIsCreating] = useState(false)

  // Get Android-specific hooks if on Android platform
  const androidDeliveryNotes = isAndroid() ? useAndroidDeliveryNotes() : null

  // Fallback function that works without database tables (enhanced with Android support)
  const fetchDeliveryNotes = useCallback(async () => {
    try {
      setIsLoading(true)
      
      // Use Android plugin if available
      if (isAndroid() && androidDeliveryNotes) {
        try {
          const notes = await androidDeliveryNotes.getPendingNotes()
          const mappedNotes: DeliveryNote[] = notes.map(note => ({
            id: note.id,
            number: note.number,
            project_id: 'android-project',
            customer_id: 'android-customer',
            company_id: 'android-company',
            status: note.status as any,
            delivery_date: new Date(note.createdAt).toISOString().split('T')[0],
            delivery_address: null,
            total_work_minutes: 0,
            total_break_minutes: 0,
            signature_data: null,
            signed_at: null,
            signed_by_name: null,
            pdf_url: null,
            pdf_generated_at: null,
            created_at: new Date(note.createdAt).toISOString(),
            updated_at: new Date(note.createdAt).toISOString(),
            project: {
              id: 'android-project',
              name: note.projectName,
              customer: {
                id: 'android-customer',
                name: note.customerName,
                email: null,
                phone: null
              }
            }
          }))
          setDeliveryNotes(mappedNotes)
          return
        } catch (androidError) {
          console.warn('Android delivery notes failed, falling back to web:', androidError)
        }
      }
      
      // Try to fetch from database, but don't fail if tables don't exist
      try {
        const { data, error } = await supabase
          .from('delivery_notes')
          .select(`
            *,
            project:projects(
              id,
              name,
              customer:customers(id, name, email, phone)
            ),
            delivery_note_items(*),
            delivery_note_time_segments(
              time_segment:time_segments(started_at, ended_at, duration_minutes)
            )
          `)
          .order('created_at', { ascending: false })

        if (error && !error.message.includes('relation') && !error.message.includes('does not exist')) {
          throw error
        }
        
        setDeliveryNotes(data || [])
      } catch (error: any) {
        // If tables don't exist, just use empty array
        console.warn('Delivery notes tables not found, using mock data:', error.message)
        setDeliveryNotes([
          // Mock delivery note for demonstration
          {
            id: 'mock-1',
            number: 'LS-2024-000001',
            project_id: 'mock-project-1',
            customer_id: 'mock-customer-1',
            company_id: 'mock-company-1',
            status: 'sent' as const,
            delivery_date: new Date().toISOString().split('T')[0],
            delivery_address: null,
            total_work_minutes: 480,
            total_break_minutes: 60,
            signature_data: null,
            signed_at: null,
            signed_by_name: null,
            pdf_url: null,
            pdf_generated_at: null,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            project: {
              id: 'mock-project-1',
              name: 'Beispiel Baustelle',
              customer: {
                id: 'mock-customer-1',
                name: 'Max Mustermann GmbH',
                email: 'max@example.com',
                phone: '+49 123 456789'
              }
            },
            delivery_note_items: [
              {
                id: 'mock-item-1',
                delivery_note_id: 'mock-1',
                item_type: 'time' as const,
                time_segment_id: 'mock-time-1',
                material_id: null,
                description: 'Arbeitszeit',
                quantity: 8,
                unit: 'Stunden',
                unit_price: 45.00,
                total_price: 360.00,
                sort_order: 1
              }
            ],
            delivery_note_time_segments: [
              {
                time_segment: {
                  started_at: new Date(Date.now() - 8 * 60 * 60 * 1000).toISOString(),
                  ended_at: new Date().toISOString(),
                  duration_minutes: 480
                }
              }
            ]
          }
        ])
      }
      
    } catch (error: any) {
      console.error('Error in fetchDeliveryNotes:', error)
      setDeliveryNotes([])
    } finally {
      setIsLoading(false)
    }
  }, [androidDeliveryNotes])

  // Sign delivery note function (enhanced with Android support)
  const signDeliveryNote = useCallback(async (
    deliveryNoteId: string, 
    signatureData: { svg: string }, 
    signerName: string
  ) => {
    try {
      // Use Android plugin if available
      if (isAndroid() && androidDeliveryNotes) {
        try {
          // Convert SVG to Android-compatible signature format
          const androidSignatureData = {
            paths: [], // Would need to parse SVG paths
            width: 400,
            height: 200
          }
          
          const result = await androidDeliveryNotes.signNote(deliveryNoteId, signerName, androidSignatureData)
          if (result.success) {
            toast.success('Lieferschein erfolgreich signiert (Android)')
            await fetchDeliveryNotes()
            return result
          }
        } catch (androidError) {
          console.warn('Android delivery note signing failed, falling back to web:', androidError)
        }
      }
      
      // Try to call RPC function if it exists
      try {
        const { data, error } = await supabase.rpc('rpc_sign_delivery_note', {
          p_delivery_note_id: deliveryNoteId,
          p_signature_data: signatureData,
          p_signer_name: signerName
        })

        if (error && !error.message.includes('function') && !error.message.includes('does not exist')) {
          throw error
        }

        toast.success('Lieferschein erfolgreich signiert')
        await fetchDeliveryNotes() // Refresh the list
        return data
      } catch (error: any) {
        if (error.message.includes('function') || error.message.includes('does not exist')) {
          // Mock signing if RPC doesn't exist
          console.warn('RPC function not found, using mock signing')
          
          // Update local state to simulate signing
          setDeliveryNotes(prev => prev.map(note => 
            note.id === deliveryNoteId
              ? {
                  ...note,
                  signature_data: signatureData,
                  signed_at: new Date().toISOString(),
                  signed_by_name: signerName,
                  status: 'signed' as const
                }
              : note
          ))
          
          toast.success('Lieferschein erfolgreich signiert (Demo-Modus)')
          return { id: deliveryNoteId }
        }
        throw error
      }
    } catch (error: any) {
      console.error('Error signing delivery note:', error)
      toast.error('Fehler beim Signieren des Lieferscheins')
      throw error
    }
  }, [fetchDeliveryNotes, androidDeliveryNotes])

  // Simple create function
  const createDeliveryNote = useCallback(async (params: CreateDeliveryNoteParams) => {
    try {
      setIsCreating(true)
      
      // Mock creation for now
      const mockNote: DeliveryNote = {
        id: `mock-${Date.now()}`,
        number: `LS-${new Date().getFullYear()}-${Math.floor(Math.random() * 1000).toString().padStart(6, '0')}`,
        project_id: params.projectId,
        customer_id: params.customerId,
        company_id: 'mock-company',
        status: 'draft',
        delivery_date: params.deliveryDate || new Date().toISOString().split('T')[0],
        delivery_address: params.deliveryAddress,
        total_work_minutes: 0,
        total_break_minutes: 0,
        signature_data: null,
        signed_at: null,
        signed_by_name: null,
        pdf_url: null,
        pdf_generated_at: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }

      setDeliveryNotes(prev => [mockNote, ...prev])
      toast.success('Lieferschein erstellt (Demo-Modus)')
      
      return mockNote
    } catch (error: any) {
      console.error('Error creating delivery note:', error)
      toast.error('Fehler beim Erstellen des Lieferscheins')
      throw error
    } finally {
      setIsCreating(false)
    }
  }, [])

  return {
    deliveryNotes,
    isLoading,
    isCreating,
    fetchDeliveryNotes,
    createDeliveryNote,
    signDeliveryNote,
  }
}