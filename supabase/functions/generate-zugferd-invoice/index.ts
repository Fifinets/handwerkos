// supabase/functions/generate-zugferd-invoice/index.ts
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';
import { PDFDocument, StandardFonts, rgb, PDFName, PDFString, PDFArray, PDFDict, PDFStream, PDFHexString } from 'https://cdn.skypack.dev/pdf-lib@1.17.1';
import { generateZugferdXml, ZugferdInvoice, ZugferdLineItem } from './zugferd-xml.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { invoice_id } = await req.json();
    if (!invoice_id) {
      return new Response(JSON.stringify({ error: 'invoice_id required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // 1. Load invoice
    const { data: invoice, error: invErr } = await supabase
      .from('invoices')
      .select('*')
      .eq('id', invoice_id)
      .single();
    if (invErr || !invoice) {
      return new Response(JSON.stringify({ error: 'Invoice not found' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 2. Load line items (skip §DATE§ marker rows)
    const { data: items } = await supabase
      .from('document_items')
      .select('position, description, quantity, unit, unit_price, total_price')
      .eq('invoice_id', invoice_id)
      .order('position');

    const lineItems: ZugferdLineItem[] = (items || [])
      .filter(item => !item.description?.startsWith('§DATE§'))
      .map((item, i) => ({
        position: i + 1,
        description: item.description || '',
        quantity: item.quantity || 1,
        unit: item.unit || 'Stk',
        unitPrice: item.unit_price || 0,
        totalPrice: item.total_price || 0,
        vatRate: invoice.tax_rate || 19,
      }));

    // 3. Load customer
    const { data: customer } = await supabase
      .from('customers')
      .select('company_name, address, postal_code, city, country, email, tax_number')
      .eq('id', invoice.customer_id)
      .single();

    // 4. Load company settings
    const { data: company } = await supabase
      .from('company_settings')
      .select('company_name, company_address, company_postal_code, company_city, company_country, company_email, company_phone, tax_number, vat_number, bank_iban, bank_bic, bank_name, bank_account_holder')
      .eq('company_id', invoice.company_id)
      .single();

    if (!customer || !company) {
      return new Response(JSON.stringify({ error: 'Customer or company data missing' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 5. Build ZUGFeRD data
    const zugferdData: ZugferdInvoice = {
      invoiceNumber: invoice.invoice_number,
      invoiceDate: invoice.invoice_date,
      dueDate: invoice.due_date || invoice.invoice_date,
      currency: invoice.currency || 'EUR',
      netAmount: invoice.net_amount || 0,
      taxAmount: invoice.tax_amount || (invoice.gross_amount - invoice.net_amount) || 0,
      grossAmount: invoice.gross_amount || 0,
      vatRate: invoice.tax_rate || 19,
      paymentTerms: invoice.payment_terms || 'Zahlbar innerhalb von 14 Tagen',
      seller: {
        name: company.company_name || '',
        street: company.company_address || '',
        city: company.company_city || '',
        postalCode: company.company_postal_code || '',
        country: company.company_country || 'DE',
        vatId: company.vat_number || '',
        taxNumber: company.tax_number || '',
        email: company.company_email || '',
        phone: company.company_phone || '',
        iban: company.bank_iban || '',
        bic: company.bank_bic || '',
        bankName: company.bank_name || '',
      },
      buyer: {
        name: customer.company_name || '',
        street: customer.address || '',
        city: customer.city || '',
        postalCode: customer.postal_code || '',
        country: customer.country || 'DE',
        vatId: customer.tax_number || undefined,
        email: customer.email || undefined,
      },
      items: lineItems,
    };

    // 6. Generate ZUGFeRD XML
    const xmlContent = generateZugferdXml(zugferdData);
    const xmlBytes = new TextEncoder().encode(xmlContent);

    // 7. Generate PDF with invoice layout
    const pdfDoc = await PDFDocument.create();
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const page = pdfDoc.addPage([595.28, 841.89]); // A4
    const { width, height } = page.getSize();
    const margin = 50;
    let y = height - margin;

    // Company header
    page.drawText(zugferdData.seller.name, { x: margin, y, size: 16, font: fontBold, color: rgb(0.1, 0.1, 0.1) });
    y -= 16;
    page.drawText(`${zugferdData.seller.street}, ${zugferdData.seller.postalCode} ${zugferdData.seller.city}`, { x: margin, y, size: 9, font, color: rgb(0.4, 0.4, 0.4) });
    y -= 12;
    page.drawText(`Tel: ${zugferdData.seller.phone} | ${zugferdData.seller.email}`, { x: margin, y, size: 9, font, color: rgb(0.4, 0.4, 0.4) });
    y -= 30;

    // Customer address
    page.drawText(zugferdData.buyer.name, { x: margin, y, size: 11, font: fontBold });
    y -= 14;
    page.drawText(zugferdData.buyer.street, { x: margin, y, size: 10, font });
    y -= 14;
    page.drawText(`${zugferdData.buyer.postalCode} ${zugferdData.buyer.city}`, { x: margin, y, size: 10, font });
    y -= 30;

    // Invoice metadata (right side)
    const metaX = width - margin - 200;
    page.drawText('RECHNUNG', { x: margin, y, size: 20, font: fontBold, color: rgb(0.1, 0.1, 0.1) });
    page.drawText(`Nr: ${zugferdData.invoiceNumber}`, { x: metaX, y, size: 10, font });
    y -= 14;
    page.drawText(`Datum: ${zugferdData.invoiceDate}`, { x: metaX, y, size: 10, font });
    y -= 14;
    page.drawText(`Fällig: ${zugferdData.dueDate}`, { x: metaX, y, size: 10, font });
    y -= 30;

    // Items table header
    const colX = [margin, margin + 30, margin + 300, margin + 350, margin + 410, margin + 470];
    page.drawLine({ start: { x: margin, y }, end: { x: width - margin, y }, thickness: 1, color: rgb(0.8, 0.8, 0.8) });
    y -= 14;
    ['Pos', 'Beschreibung', 'Menge', 'Einheit', 'Einzelpreis', 'Gesamt'].forEach((h, i) => {
      page.drawText(h, { x: colX[i] || margin, y, size: 8, font: fontBold, color: rgb(0.4, 0.4, 0.4) });
    });
    y -= 6;
    page.drawLine({ start: { x: margin, y }, end: { x: width - margin, y }, thickness: 0.5, color: rgb(0.8, 0.8, 0.8) });
    y -= 14;

    // Items
    for (const item of zugferdData.items) {
      if (y < 120) { // New page if needed
        const newPage = pdfDoc.addPage([595.28, 841.89]);
        y = height - margin;
      }
      const desc = item.description.length > 50 ? item.description.substring(0, 50) + '...' : item.description;
      page.drawText(`${item.position}`, { x: colX[0], y, size: 9, font });
      page.drawText(desc, { x: colX[1], y, size: 9, font });
      page.drawText(`${item.quantity}`, { x: colX[2], y, size: 9, font });
      page.drawText(item.unit, { x: colX[3], y, size: 9, font });
      page.drawText(`${item.unitPrice.toFixed(2)} €`, { x: colX[4], y, size: 9, font });
      page.drawText(`${item.totalPrice.toFixed(2)} €`, { x: colX[5], y, size: 9, font });
      y -= 16;
    }

    // Totals
    y -= 10;
    page.drawLine({ start: { x: margin + 350, y + 6 }, end: { x: width - margin, y + 6 }, thickness: 1, color: rgb(0.8, 0.8, 0.8) });
    page.drawText('Netto:', { x: margin + 350, y: y - 4, size: 10, font });
    page.drawText(`${zugferdData.netAmount.toFixed(2)} €`, { x: colX[5], y: y - 4, size: 10, font });
    y -= 18;
    page.drawText(`MwSt (${zugferdData.vatRate}%):`, { x: margin + 350, y, size: 10, font });
    page.drawText(`${zugferdData.taxAmount.toFixed(2)} €`, { x: colX[5], y, size: 10, font });
    y -= 18;
    page.drawText('Brutto:', { x: margin + 350, y, size: 12, font: fontBold });
    page.drawText(`${zugferdData.grossAmount.toFixed(2)} €`, { x: colX[5], y, size: 12, font: fontBold });

    // Payment info
    y -= 40;
    page.drawText('Bankverbindung:', { x: margin, y, size: 9, font: fontBold });
    y -= 12;
    page.drawText(`IBAN: ${zugferdData.seller.iban} | BIC: ${zugferdData.seller.bic}`, { x: margin, y, size: 9, font });
    y -= 12;
    page.drawText(`${zugferdData.paymentTerms}`, { x: margin, y, size: 9, font });

    // Footer
    y = margin;
    page.drawText(`${zugferdData.seller.name} | USt-IdNr: ${zugferdData.seller.vatId} | St-Nr: ${zugferdData.seller.taxNumber}`, {
      x: margin, y, size: 7, font, color: rgb(0.5, 0.5, 0.5),
    });

    // 8. Embed XML as PDF attachment (ZUGFeRD standard)
    // Attach the XML file as an embedded file in the PDF
    const xmlStream = pdfDoc.context.stream(xmlBytes, { Type: 'EmbeddedFile', Subtype: 'text/xml' });
    const xmlStreamRef = pdfDoc.context.register(xmlStream);

    const fileSpecDict = pdfDoc.context.obj({
      Type: 'Filespec',
      F: PDFString.of('factur-x.xml'),
      UF: PDFHexString.fromText('factur-x.xml'),
      Desc: PDFString.of('ZUGFeRD Invoice XML'),
      AFRelationship: PDFName.of('Data'),
      EF: pdfDoc.context.obj({ F: xmlStreamRef, UF: xmlStreamRef }),
    });
    const fileSpecRef = pdfDoc.context.register(fileSpecDict);

    // Add to Names/EmbeddedFiles
    const namesDict = pdfDoc.context.obj({
      EmbeddedFiles: pdfDoc.context.obj({
        Names: [PDFHexString.fromText('factur-x.xml'), fileSpecRef],
      }),
    });
    pdfDoc.catalog.set(PDFName.of('Names'), pdfDoc.context.register(namesDict));

    // Add AF array to catalog
    pdfDoc.catalog.set(PDFName.of('AF'), pdfDoc.context.obj([fileSpecRef]));

    // 9. Save and return PDF
    const pdfBytes = await pdfDoc.save();

    return new Response(pdfBytes, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${invoice.invoice_number}_ZUGFeRD.pdf"`,
      },
    });
  } catch (err) {
    console.error('ZUGFeRD generation error:', err);
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
