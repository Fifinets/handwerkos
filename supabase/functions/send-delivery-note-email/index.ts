// Edge Function: Send Delivery Note Email
// Email-Versand für Lieferscheine mit Resend API

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface EmailRequest {
  deliveryNoteId: string
  recipientEmail?: string
  ccEmails?: string[]
  subject?: string
  message?: string
  attachPdf?: boolean
}

interface ResendEmailPayload {
  from: string
  to: string[]
  cc?: string[]
  subject: string
  html: string
  attachments?: Array<{
    filename: string
    content: string
  }>
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const {
      deliveryNoteId,
      recipientEmail,
      ccEmails = [],
      subject,
      message,
      attachPdf = true
    } = await req.json() as EmailRequest

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const resendApiKey = Deno.env.get('RESEND_API_KEY')!
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
            phone
          )
        ),
        company:companies(
          name,
          email,
          phone,
          address
        )
      `)
      .eq('id', deliveryNoteId)
      .single()

    if (dnError || !deliveryNote) {
      throw new Error(`Lieferschein nicht gefunden: ${dnError?.message}`)
    }

    // Determine recipient email
    const toEmail = recipientEmail || deliveryNote.project?.customer?.email
    if (!toEmail) {
      throw new Error('Keine Empfänger-Email gefunden')
    }

    // Generate PDF if needed and not already generated
    let pdfBase64 = ''
    if (attachPdf) {
      // Call PDF generation function
      const pdfResponse = await fetch(`${supabaseUrl}/functions/v1/generate-delivery-note-pdf`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${supabaseKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ deliveryNoteId })
      })

      if (pdfResponse.ok) {
        const pdfBytes = await pdfResponse.arrayBuffer()
        pdfBase64 = btoa(String.fromCharCode(...new Uint8Array(pdfBytes)))
      }
    }

    // Build email subject
    const emailSubject = subject || `Lieferschein ${deliveryNote.number} - ${deliveryNote.project?.name || 'Projekt'}`

    // Build email HTML body
    const emailHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
          }
          .header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 30px;
            border-radius: 10px 10px 0 0;
            text-align: center;
          }
          .content {
            background: white;
            padding: 30px;
            border: 1px solid #e5e7eb;
            border-radius: 0 0 10px 10px;
          }
          .info-table {
            width: 100%;
            margin: 20px 0;
            border-collapse: collapse;
          }
          .info-table td {
            padding: 10px;
            border-bottom: 1px solid #e5e7eb;
          }
          .info-table td:first-child {
            font-weight: 600;
            width: 40%;
            color: #6b7280;
          }
          .button {
            display: inline-block;
            padding: 12px 24px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            text-decoration: none;
            border-radius: 6px;
            margin-top: 20px;
          }
          .footer {
            text-align: center;
            margin-top: 30px;
            padding-top: 20px;
            border-top: 1px solid #e5e7eb;
            color: #6b7280;
            font-size: 14px;
          }
          .custom-message {
            background: #f3f4f6;
            padding: 15px;
            border-radius: 6px;
            margin: 20px 0;
            border-left: 4px solid #667eea;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1 style="margin: 0;">Lieferschein ${deliveryNote.number}</h1>
          <p style="margin: 10px 0 0 0; opacity: 0.9;">
            ${deliveryNote.company?.name || 'HandwerkOS'}
          </p>
        </div>
        
        <div class="content">
          <p>Sehr geehrte Damen und Herren,</p>
          
          ${message ? `
            <div class="custom-message">
              ${message}
            </div>
          ` : `
            <p>anbei erhalten Sie den Lieferschein für das Projekt <strong>${deliveryNote.project?.name}</strong>.</p>
          `}
          
          <table class="info-table">
            <tr>
              <td>Lieferschein-Nr:</td>
              <td>${deliveryNote.number}</td>
            </tr>
            <tr>
              <td>Datum:</td>
              <td>${new Date(deliveryNote.delivery_date).toLocaleDateString('de-DE')}</td>
            </tr>
            <tr>
              <td>Projekt:</td>
              <td>${deliveryNote.project?.name || '-'}</td>
            </tr>
            <tr>
              <td>Kunde:</td>
              <td>${deliveryNote.project?.customer?.name || '-'}</td>
            </tr>
            ${deliveryNote.total_work_minutes ? `
            <tr>
              <td>Arbeitszeit:</td>
              <td>${Math.floor(deliveryNote.total_work_minutes / 60)}h ${deliveryNote.total_work_minutes % 60}min</td>
            </tr>
            ` : ''}
            <tr>
              <td>Status:</td>
              <td>${deliveryNote.status === 'signed' ? '✅ Signiert' : '📝 ' + deliveryNote.status}</td>
            </tr>
          </table>
          
          ${deliveryNote.signed_at ? `
            <p><strong>Signiert am:</strong> ${new Date(deliveryNote.signed_at).toLocaleString('de-DE')}<br>
            <strong>Signiert von:</strong> ${deliveryNote.signed_by_name || 'Kunde'}</p>
          ` : `
            <p>Der Lieferschein wurde noch nicht signiert.</p>
          `}
          
          <p>Bei Rückfragen stehen wir Ihnen gerne zur Verfügung.</p>
          
          <p>Mit freundlichen Grüßen<br>
          ${deliveryNote.company?.name || 'Ihr HandwerkOS Team'}</p>
        </div>
        
        <div class="footer">
          ${deliveryNote.company?.name || 'HandwerkOS'}<br>
          ${deliveryNote.company?.email ? `Email: ${deliveryNote.company.email}<br>` : ''}
          ${deliveryNote.company?.phone ? `Tel: ${deliveryNote.company.phone}<br>` : ''}
          <p style="margin-top: 10px; font-size: 12px;">
            Diese E-Mail wurde automatisch generiert.
          </p>
        </div>
      </body>
      </html>
    `

    // Prepare Resend API payload
    const emailPayload: ResendEmailPayload = {
      from: deliveryNote.company?.email || 'noreply@handwerkos.de',
      to: [toEmail],
      subject: emailSubject,
      html: emailHtml
    }

    // Add CC if provided
    if (ccEmails.length > 0) {
      emailPayload.cc = ccEmails
    }

    // Add PDF attachment if available
    if (pdfBase64) {
      emailPayload.attachments = [{
        filename: `${deliveryNote.number.replace(/\//g, '-')}.pdf`,
        content: pdfBase64
      }]
    }

    // Send email via Resend API
    const resendResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(emailPayload)
    })

    if (!resendResponse.ok) {
      const error = await resendResponse.text()
      throw new Error(`Email-Versand fehlgeschlagen: ${error}`)
    }

    const resendData = await resendResponse.json()

    // Update delivery note status if draft
    if (deliveryNote.status === 'draft') {
      await supabase
        .from('delivery_notes')
        .update({
          status: 'sent',
          sent_at: new Date().toISOString()
        })
        .eq('id', deliveryNoteId)
    }

    // Log email send event
    await supabase
      .from('email_logs')
      .insert({
        delivery_note_id: deliveryNoteId,
        recipient: toEmail,
        cc: ccEmails,
        subject: emailSubject,
        status: 'sent',
        resend_id: resendData.id,
        sent_at: new Date().toISOString()
      })

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Email erfolgreich versendet',
        emailId: resendData.id,
        recipient: toEmail
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )

  } catch (error) {
    console.error('Error sending email:', error)
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error.message 
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }
})