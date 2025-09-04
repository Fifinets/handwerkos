// Edge Function: Generate Delivery Note PDF
// Deno Deploy Function für Lieferschein-PDF Generierung

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0'
import { PDFDocument, rgb, StandardFonts } from 'https://cdn.skypack.dev/pdf-lib@1.17.1'
import { format } from 'https://deno.land/std@0.168.0/datetime/mod.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface DeliveryNoteRequest {
  deliveryNoteId: string
  language?: 'de' | 'en'
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Parse request
    const { deliveryNoteId, language = 'de' } = await req.json() as DeliveryNoteRequest

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    // Fetch delivery note with all relations
    const { data: deliveryNote, error: dnError } = await supabase
      .from('delivery_notes')
      .select(`
        *,
        project:projects(
          name,
          description,
          customer:customers(
            name,
            email,
            phone,
            address
          )
        ),
        items:delivery_note_items(
          *,
          time_segment:time_segments(
            started_at,
            ended_at,
            duration_minutes_computed,
            description,
            segment_type
          ),
          material:materials(
            name,
            unit,
            unit_price
          )
        )
      `)
      .eq('id', deliveryNoteId)
      .single()

    if (dnError || !deliveryNote) {
      throw new Error(`Lieferschein nicht gefunden: ${dnError?.message}`)
    }

    // Create PDF document
    const pdfDoc = await PDFDocument.create()
    const page = pdfDoc.addPage([595.28, 841.89]) // A4
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica)
    const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold)
    
    const { width, height } = page.getSize()
    const fontSize = 11
    const lineHeight = 15
    let yPosition = height - 50

    // Helper functions
    const drawText = (text: string, x: number, y: number, options?: any) => {
      page.drawText(text, {
        x,
        y,
        size: fontSize,
        font: font,
        color: rgb(0, 0, 0),
        ...options
      })
    }

    const drawLine = (y: number) => {
      page.drawLine({
        start: { x: 50, y },
        end: { x: width - 50, y },
        thickness: 0.5,
        color: rgb(0.8, 0.8, 0.8),
      })
    }

    // Company Header
    const companyName = "HandwerkOS GmbH" // TODO: Aus Company-Tabelle laden
    drawText(companyName, 50, yPosition, { font: boldFont, size: 16 })
    yPosition -= 25

    // Document Title
    drawText("LIEFERSCHEIN", width / 2 - 60, yPosition, { 
      font: boldFont, 
      size: 18,
      color: rgb(0.2, 0.3, 0.8) 
    })
    yPosition -= 30

    // Delivery Note Number and Date
    drawText(`Lieferschein-Nr: ${deliveryNote.number}`, 50, yPosition, { font: boldFont })
    drawText(`Datum: ${format(new Date(deliveryNote.delivery_date), 'dd.MM.yyyy')}`, width - 200, yPosition)
    yPosition -= 25
    drawLine(yPosition)
    yPosition -= 20

    // Customer Info
    if (deliveryNote.project?.customer) {
      const customer = deliveryNote.project.customer
      drawText("Kunde:", 50, yPosition, { font: boldFont })
      yPosition -= lineHeight
      drawText(customer.name, 50, yPosition)
      yPosition -= lineHeight
      
      if (customer.address) {
        const addr = customer.address as any
        if (addr.street) {
          drawText(addr.street, 50, yPosition)
          yPosition -= lineHeight
        }
        if (addr.zip || addr.city) {
          drawText(`${addr.zip || ''} ${addr.city || ''}`.trim(), 50, yPosition)
          yPosition -= lineHeight
        }
      }
      
      if (customer.phone) {
        drawText(`Tel: ${customer.phone}`, 50, yPosition)
        yPosition -= lineHeight
      }
    }

    yPosition -= 10
    drawLine(yPosition)
    yPosition -= 20

    // Project Info
    if (deliveryNote.project) {
      drawText("Projekt:", 50, yPosition, { font: boldFont })
      drawText(deliveryNote.project.name, 120, yPosition)
      yPosition -= lineHeight
      
      if (deliveryNote.project.description) {
        drawText(deliveryNote.project.description, 50, yPosition, { size: 10 })
        yPosition -= lineHeight
      }
    }

    yPosition -= 10
    drawLine(yPosition)
    yPosition -= 25

    // Items Header
    drawText("Pos", 50, yPosition, { font: boldFont })
    drawText("Beschreibung", 90, yPosition, { font: boldFont })
    drawText("Menge", 380, yPosition, { font: boldFont })
    drawText("Einheit", 440, yPosition, { font: boldFont })
    drawText("Preis", 500, yPosition, { font: boldFont })
    yPosition -= 5
    drawLine(yPosition)
    yPosition -= 20

    // Items
    let position = 1
    let totalAmount = 0

    // Time items
    const timeItems = deliveryNote.items?.filter((item: any) => item.item_type === 'time') || []
    for (const item of timeItems) {
      drawText(position.toString(), 50, yPosition)
      
      const desc = item.description || 'Arbeitszeit'
      const hours = (item.quantity || 0).toFixed(2)
      
      // Beschreibung mit Zeitdetails
      drawText(desc, 90, yPosition)
      if (item.time_segment) {
        yPosition -= lineHeight
        const start = format(new Date(item.time_segment.started_at), 'HH:mm')
        const end = item.time_segment.ended_at 
          ? format(new Date(item.time_segment.ended_at), 'HH:mm')
          : 'laufend'
        drawText(`   ${start} - ${end}`, 90, yPosition, { size: 9, color: rgb(0.5, 0.5, 0.5) })
      }
      
      drawText(hours, 380, yPosition)
      drawText("Std", 440, yPosition)
      
      if (item.unit_price) {
        const price = (item.quantity * item.unit_price).toFixed(2)
        drawText(`€ ${price}`, 500, yPosition)
        totalAmount += item.quantity * item.unit_price
      }
      
      yPosition -= 20
      position++
    }

    // Material items
    const materialItems = deliveryNote.items?.filter((item: any) => item.item_type === 'material') || []
    for (const item of materialItems) {
      drawText(position.toString(), 50, yPosition)
      drawText(item.description || item.material?.name || 'Material', 90, yPosition)
      drawText(item.quantity.toString(), 380, yPosition)
      drawText(item.unit || item.material?.unit || 'Stk', 440, yPosition)
      
      if (item.unit_price) {
        const price = (item.quantity * item.unit_price).toFixed(2)
        drawText(`€ ${price}`, 500, yPosition)
        totalAmount += item.quantity * item.unit_price
      }
      
      yPosition -= 20
      position++
    }

    // Summary
    yPosition -= 10
    drawLine(yPosition)
    yPosition -= 20

    // Work time summary
    if (deliveryNote.total_work_minutes > 0) {
      const hours = Math.floor(deliveryNote.total_work_minutes / 60)
      const minutes = deliveryNote.total_work_minutes % 60
      drawText("Arbeitszeit gesamt:", 50, yPosition, { font: boldFont })
      drawText(`${hours}h ${minutes}min`, 200, yPosition)
      yPosition -= lineHeight
    }

    if (deliveryNote.total_break_minutes > 0) {
      const hours = Math.floor(deliveryNote.total_break_minutes / 60)
      const minutes = deliveryNote.total_break_minutes % 60
      drawText("Pausenzeit:", 50, yPosition, { font: boldFont })
      drawText(`${hours}h ${minutes}min`, 200, yPosition)
      yPosition -= lineHeight
    }

    // Signature area
    if (deliveryNote.signed_at) {
      yPosition -= 30
      drawLine(yPosition)
      yPosition -= 20
      
      drawText("Unterschrift:", 50, yPosition, { font: boldFont })
      yPosition -= lineHeight
      
      if (deliveryNote.signed_by_name) {
        drawText(`Name: ${deliveryNote.signed_by_name}`, 50, yPosition)
        yPosition -= lineHeight
      }
      
      drawText(`Datum: ${format(new Date(deliveryNote.signed_at), 'dd.MM.yyyy HH:mm')}`, 50, yPosition)
      
      // Signature placeholder
      if (deliveryNote.signature_data) {
        // TODO: Render actual signature from SVG/Base64
        drawText("[Digitale Signatur]", 350, yPosition, { 
          font: boldFont,
          color: rgb(0.2, 0.6, 0.2) 
        })
      }
    } else {
      // Signature lines
      yPosition = 100
      drawText("Datum / Unterschrift Auftragnehmer", 50, yPosition)
      page.drawLine({
        start: { x: 50, y: yPosition - 5 },
        end: { x: 250, y: yPosition - 5 },
        thickness: 0.5,
      })
      
      drawText("Datum / Unterschrift Auftraggeber", 320, yPosition)
      page.drawLine({
        start: { x: 320, y: yPosition - 5 },
        end: { x: 520, y: yPosition - 5 },
        thickness: 0.5,
      })
    }

    // Footer
    drawText(
      `Erstellt am ${format(new Date(), 'dd.MM.yyyy HH:mm')} Uhr`, 
      width / 2 - 80, 
      30,
      { size: 8, color: rgb(0.6, 0.6, 0.6) }
    )

    // Generate PDF bytes
    const pdfBytes = await pdfDoc.save()

    // Store PDF in storage
    const fileName = `delivery-notes/${deliveryNote.number.replace(/\//g, '-')}.pdf`
    const { error: uploadError } = await supabase.storage
      .from('documents')
      .upload(fileName, pdfBytes, {
        contentType: 'application/pdf',
        upsert: true
      })

    if (uploadError) {
      console.error('Upload error:', uploadError)
      // Continue even if storage fails
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from('documents')
      .getPublicUrl(fileName)

    // Update delivery note with PDF URL
    if (urlData?.publicUrl) {
      await supabase
        .from('delivery_notes')
        .update({
          pdf_url: urlData.publicUrl,
          pdf_generated_at: new Date().toISOString()
        })
        .eq('id', deliveryNoteId)
    }

    // Return PDF as response
    return new Response(pdfBytes, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${deliveryNote.number}.pdf"`,
        'Cache-Control': 'no-cache',
      },
    })

  } catch (error) {
    console.error('Error generating PDF:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }
})