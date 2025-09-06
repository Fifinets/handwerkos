import { useState, useCallback } from 'react'
import { supabase } from '@/integrations/supabase/client'
import { toast } from 'sonner'

interface PDFGenerationResult {
  success: boolean
  pdf_url?: string
  pdf_generated_at?: string
  cached?: boolean
  message?: string
  delivery_note_number?: string
  status?: string
}

interface PDFStatus {
  pdf_status: 'ready' | 'generating' | 'not_generated'
  pdf_url?: string
  pdf_generated_at?: string
  overall_status?: string
}

interface EmailSendResult {
  success: boolean
  email_log_id?: string
  message?: string
  recipient_email?: string
}

export const useDeliveryNotePDF = () => {
  const [isGenerating, setIsGenerating] = useState(false)
  const [isSending, setIsSending] = useState(false)
  const [isChecking, setIsChecking] = useState(false)

  // PDF generieren
  const generatePDF = useCallback(async (deliveryNoteId: string): Promise<PDFGenerationResult> => {
    setIsGenerating(true)
    try {
      // Erst über RPC prüfen und initialisieren
      const { data, error } = await supabase.rpc('rpc_generate_delivery_note_pdf', {
        p_delivery_note_id: deliveryNoteId
      })

      if (error) {
        // Fallback wenn Funktion nicht existiert
        if (error.message.includes('function') || error.message.includes('does not exist')) {
          console.warn('PDF RPC function not found, calling edge function directly')
          return await generatePDFDirect(deliveryNoteId)
        }
        throw error
      }

      // Wenn bereits cached, direkt zurückgeben
      if (data.cached) {
        toast.success('PDF bereits verfügbar')
        return data
      }

      // Edge Function aufrufen für eigentliche Generierung
      return await generatePDFDirect(deliveryNoteId)

    } catch (error: any) {
      console.error('Error generating PDF:', error)
      toast.error('Fehler bei PDF-Generierung')
      throw error
    } finally {
      setIsGenerating(false)
    }
  }, [])

  // Direkter Edge Function Aufruf
  const generatePDFDirect = useCallback(async (deliveryNoteId: string): Promise<PDFGenerationResult> => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('Nicht authentifiziert')

      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-delivery-note-pdf`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          deliveryNoteId,
          language: 'de' 
        })
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`HTTP ${response.status}: ${errorText}`)
      }

      // Response ist PDF-Binary, also erfolgreich
      const blob = await response.blob()
      const pdfUrl = URL.createObjectURL(blob)
      
      toast.success('PDF erfolgreich generiert')
      return {
        success: true,
        pdf_url: pdfUrl,
        pdf_generated_at: new Date().toISOString(),
        message: 'PDF erfolgreich generiert'
      }

    } catch (error: any) {
      console.error('Direct PDF generation error:', error)
      throw error
    }
  }, [])

  // PDF Status prüfen
  const checkPDFStatus = useCallback(async (deliveryNoteId: string): Promise<PDFStatus> => {
    setIsChecking(true)
    try {
      const { data, error } = await supabase.rpc('rpc_check_pdf_status', {
        p_delivery_note_id: deliveryNoteId
      })

      if (error) {
        // Fallback: Status aus delivery_notes Tabelle holen
        if (error.message.includes('function') || error.message.includes('does not exist')) {
          console.warn('PDF status RPC not found, using fallback')
          const { data: dnData, error: dnError } = await supabase
            .from('delivery_notes')
            .select('pdf_url, pdf_generated_at, status')
            .eq('id', deliveryNoteId)
            .single()

          if (dnError) throw dnError

          return {
            pdf_status: dnData.pdf_url ? 'ready' : 'not_generated',
            pdf_url: dnData.pdf_url,
            pdf_generated_at: dnData.pdf_generated_at,
            overall_status: dnData.status
          }
        }
        throw error
      }

      return data
    } catch (error: any) {
      console.error('Error checking PDF status:', error)
      return {
        pdf_status: 'not_generated'
      }
    } finally {
      setIsChecking(false)
    }
  }, [])

  // Email versenden
  const sendEmail = useCallback(async (params: {
    deliveryNoteId: string
    recipientEmail: string
    ccEmails?: string[]
    subject?: string
    message?: string
    attachPDF?: boolean
  }): Promise<EmailSendResult> => {
    setIsSending(true)
    try {
      // RPC Funktion aufrufen
      const { data, error } = await supabase.rpc('rpc_send_delivery_note_email', {
        p_delivery_note_id: params.deliveryNoteId,
        p_recipient_email: params.recipientEmail,
        p_cc_emails: params.ccEmails || null,
        p_subject: params.subject || null,
        p_message: params.message || null,
        p_attach_pdf: params.attachPDF !== false
      })

      if (error) {
        // Fallback wenn Funktion nicht existiert
        if (error.message.includes('function') || error.message.includes('does not exist')) {
          console.warn('Email RPC function not found, calling edge function directly')
          return await sendEmailDirect(params)
        }
        throw error
      }

      // Edge Function für eigentlichen Versand aufrufen
      return await sendEmailDirect(params)

    } catch (error: any) {
      console.error('Error sending email:', error)
      toast.error('Fehler beim Email-Versand')
      throw error
    } finally {
      setIsSending(false)
    }
  }, [])

  // Direkter Email-Versand über Edge Function
  const sendEmailDirect = useCallback(async (params: {
    deliveryNoteId: string
    recipientEmail: string
    ccEmails?: string[]
    subject?: string
    message?: string
    attachPDF?: boolean
  }): Promise<EmailSendResult> => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('Nicht authentifiziert')

      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-delivery-note-email`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          deliveryNoteId: params.deliveryNoteId,
          recipientEmail: params.recipientEmail,
          ccEmails: params.ccEmails,
          subject: params.subject,
          message: params.message,
          attachPdf: params.attachPDF !== false
        })
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`HTTP ${response.status}: ${errorText}`)
      }

      const result = await response.json()
      
      toast.success(`Email an ${params.recipientEmail} versendet`)
      return {
        success: true,
        recipient_email: params.recipientEmail,
        message: 'Email erfolgreich versendet',
        ...result
      }

    } catch (error: any) {
      console.error('Direct email sending error:', error)
      throw error
    }
  }, [])

  // PDF herunterladen
  const downloadPDF = useCallback(async (deliveryNoteId: string, deliveryNoteNumber: string) => {
    try {
      setIsGenerating(true)
      
      const result = await generatePDF(deliveryNoteId)
      
      if (result.pdf_url) {
        // PDF Download triggern
        const link = document.createElement('a')
        link.href = result.pdf_url
        link.download = `${deliveryNoteNumber}.pdf`
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
        
        // Clean up blob URL wenn es eine lokale URL ist
        if (result.pdf_url.startsWith('blob:')) {
          setTimeout(() => URL.revokeObjectURL(result.pdf_url!), 1000)
        }
        
        toast.success('PDF-Download gestartet')
      }
    } catch (error: any) {
      console.error('Download error:', error)
      toast.error('Fehler beim PDF-Download')
    } finally {
      setIsGenerating(false)
    }
  }, [generatePDF])

  // PDF in neuem Tab öffnen
  const openPDFInNewTab = useCallback(async (deliveryNoteId: string) => {
    try {
      setIsGenerating(true)
      
      const result = await generatePDF(deliveryNoteId)
      
      if (result.pdf_url) {
        window.open(result.pdf_url, '_blank')
        toast.success('PDF in neuem Tab geöffnet')
      }
    } catch (error: any) {
      console.error('Open PDF error:', error)
      toast.error('Fehler beim Öffnen des PDF')
    } finally {
      setIsGenerating(false)
    }
  }, [generatePDF])

  return {
    // States
    isGenerating,
    isSending,
    isChecking,
    
    // Functions  
    generatePDF,
    checkPDFStatus,
    sendEmail,
    downloadPDF,
    openPDFInNewTab
  }
}