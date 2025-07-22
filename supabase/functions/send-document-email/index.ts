import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "npm:resend@2.0.0";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface SendDocumentEmailRequest {
  documentType: 'quote' | 'invoice';
  documentId: string;
  recipientEmail: string;
  recipientName: string;
  subject?: string;
  message?: string;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const apiKey = Deno.env.get("RESEND_API_KEY");
    if (!apiKey) {
      const message = "Missing RESEND_API_KEY configuration";
      console.error(message);
      return new Response(
        JSON.stringify({ success: false, error: message }),
        {
          status: 500,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        },
      );
    }

    const resend = new Resend(apiKey);
    const {
      documentType,
      documentId,
      recipientEmail,
      recipientName,
      subject,
      message 
    }: SendDocumentEmailRequest = await req.json();

    console.log(`Sending ${documentType} email for document ${documentId} to ${recipientEmail}`);

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get document data based on type
    let documentData;
    let tableName = documentType === 'quote' ? 'quotes' : 'invoices';
    let numberField = documentType === 'quote' ? 'quote_number' : 'invoice_number';
    
    const { data, error } = await supabase
      .from(tableName)
      .select(`
        *,
        customer:customers(company_name, contact_person, email),
        document_items(*)
      `)
      .eq('id', documentId)
      .single();

    if (error) {
      console.error('Error fetching document:', error);
      throw new Error('Dokument nicht gefunden');
    }

    documentData = data;

    // Generate email content
    const documentTitle = documentType === 'quote' ? 'Angebot' : 'Rechnung';
    const defaultSubject = `${documentTitle} ${documentData[numberField]} - ${documentData.title}`;
    const emailSubject = subject || defaultSubject;

    const formatCurrency = (amount: number, currency: string = 'EUR') => {
      return new Intl.NumberFormat('de-DE', {
        style: 'currency',
        currency: currency
      }).format(amount);
    };

    const formatDate = (dateString: string) => {
      return new Date(dateString).toLocaleDateString('de-DE');
    };

    // Create items table for email
    const itemsTable = documentData.document_items
      .map((item: any) => `
        <tr>
          <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${item.description}</td>
          <td style="padding: 8px; border-bottom: 1px solid #e5e7eb; text-align: center;">${item.quantity}</td>
          <td style="padding: 8px; border-bottom: 1px solid #e5e7eb; text-align: center;">${item.unit}</td>
          <td style="padding: 8px; border-bottom: 1px solid #e5e7eb; text-align: right;">${formatCurrency(item.unit_price)}</td>
          <td style="padding: 8px; border-bottom: 1px solid #e5e7eb; text-align: right;">${formatCurrency(item.total_price)}</td>
        </tr>
      `).join('');

    const emailHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${emailSubject}</title>
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 800px; margin: 0 auto; padding: 20px;">
        <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
          <h1 style="color: #2563eb; margin: 0;">${documentTitle} ${documentData[numberField]}</h1>
          <p style="margin: 5px 0 0 0; color: #6b7280;">ElektroManage Pro</p>
        </div>

        <div style="margin-bottom: 20px;">
          <p>Sehr geehrte Damen und Herren,</p>
          ${message ? `<p>${message}</p>` : `
            <p>anbei erhalten Sie ${documentType === 'quote' ? 'unser Angebot' : 'unsere Rechnung'} wie besprochen.</p>
          `}
        </div>

        <div style="background-color: #ffffff; border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px; margin-bottom: 20px;">
          <h2 style="color: #1f2937; margin-top: 0;">${documentData.title}</h2>
          
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 20px;">
            <div>
              <h3 style="color: #374151; margin-bottom: 10px;">Kundeninformationen</h3>
              <p style="margin: 0;"><strong>${documentData.customer.company_name}</strong></p>
              <p style="margin: 5px 0;">${documentData.customer.contact_person}</p>
            </div>
            <div>
              <h3 style="color: #374151; margin-bottom: 10px;">${documentTitle}sdaten</h3>
              <p style="margin: 0;"><strong>Nummer:</strong> ${documentData[numberField]}</p>
              <p style="margin: 5px 0;"><strong>Datum:</strong> ${formatDate(documentData[documentType === 'quote' ? 'quote_date' : 'invoice_date'])}</p>
              ${documentType === 'quote' && documentData.valid_until ? 
                `<p style="margin: 5px 0;"><strong>Gültig bis:</strong> ${formatDate(documentData.valid_until)}</p>` : 
                ''
              }
              ${documentType === 'invoice' ? 
                `<p style="margin: 5px 0;"><strong>Fällig am:</strong> ${formatDate(documentData.due_date)}</p>` : 
                ''
              }
            </div>
          </div>

          ${documentData.description ? `<p style="margin-bottom: 20px;">${documentData.description}</p>` : ''}

          <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
            <thead>
              <tr style="background-color: #f3f4f6;">
                <th style="padding: 12px 8px; text-align: left; border-bottom: 2px solid #d1d5db;">Beschreibung</th>
                <th style="padding: 12px 8px; text-align: center; border-bottom: 2px solid #d1d5db;">Menge</th>
                <th style="padding: 12px 8px; text-align: center; border-bottom: 2px solid #d1d5db;">Einheit</th>
                <th style="padding: 12px 8px; text-align: right; border-bottom: 2px solid #d1d5db;">Einzelpreis</th>
                <th style="padding: 12px 8px; text-align: right; border-bottom: 2px solid #d1d5db;">Gesamtpreis</th>
              </tr>
            </thead>
            <tbody>
              ${itemsTable}
            </tbody>
          </table>

          <div style="text-align: right; border-top: 2px solid #d1d5db; padding-top: 10px;">
            <p style="margin: 5px 0;"><strong>Nettosumme: ${formatCurrency(documentData.net_amount)}</strong></p>
            <p style="margin: 5px 0;">MwSt. (${documentData.tax_rate}%): ${formatCurrency(documentData.tax_amount)}</p>
            <p style="margin: 5px 0; font-size: 18px;"><strong>Gesamtsumme: ${formatCurrency(documentData.total_amount)}</strong></p>
          </div>

          ${documentData.notes ? `
            <div style="margin-top: 20px; padding: 15px; background-color: #f9fafb; border-radius: 6px;">
              <h4 style="margin: 0 0 10px 0; color: #374151;">Anmerkungen</h4>
              <p style="margin: 0;">${documentData.notes}</p>
            </div>
          ` : ''}
        </div>

        <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb; font-size: 14px; color: #6b7280;">
          <p>Bei Fragen stehen wir Ihnen gerne zur Verfügung.</p>
          <p>Mit freundlichen Grüßen,<br>Ihr ElektroManage Pro Team</p>
        </div>
      </body>
      </html>
    `;

    const emailResponse = await resend.emails.send({
      from: "ElektroManage Pro <noreply@resend.dev>",
      to: [recipientEmail],
      subject: emailSubject,
      html: emailHtml,
    });

    console.log("Email sent successfully:", emailResponse);

    // Update document status to 'Versendet'
    const updateField = documentType === 'quote' ? 'status' : 'status';
    await supabase
      .from(tableName)
      .update({ [updateField]: 'Versendet' })
      .eq('id', documentId);

    return new Response(JSON.stringify({ 
      success: true, 
      emailResponse,
      message: `${documentTitle} wurde erfolgreich versendet.`
    }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders,
      },
    });
  } catch (error: any) {
    console.error("Error in send-document-email function:", error);
    return new Response(
      JSON.stringify({ 
        error: error.message || 'Ein Fehler ist aufgetreten beim Versenden der E-Mail.',
        success: false
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);