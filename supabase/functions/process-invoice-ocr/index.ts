import { serve } from "https://deno.land/std@0.131.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { base64Image, ocrText } = await req.json()

    // Get OpenAI API key from environment
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY')
    if (!openaiApiKey) {
      throw new Error('OpenAI API key not configured')
    }

    // Prepare the prompt for invoice extraction
    const systemPrompt = `Du bist ein Experte für die Extraktion von Daten aus deutschen Handwerker-Rechnungen.
    Extrahiere ALLE relevanten Informationen aus der Rechnung und gebe sie als strukturiertes JSON zurück.
    
    Achte besonders auf:
    - Deutsche Datumsformate (DD.MM.YYYY) -> konvertiere zu YYYY-MM-DD
    - Deutsche Zahlenformate (1.234,56 €) -> konvertiere zu Dezimalzahlen
    - Handwerker-spezifische Begriffe
    - Positionen/Artikel in Tabellen
    
    Gib NUR valides JSON zurück, keine zusätzlichen Erklärungen.`

    const userPrompt = `Extrahiere alle Rechnungsdaten aus diesem Bild. 
    ${ocrText ? `Hier ist der bereits erkannte Text als Hilfe: ${ocrText}` : ''}
    
    Gib die Daten in diesem exakten JSON-Format zurück:
    {
      "invoiceNumber": "Rechnungsnummer",
      "date": "YYYY-MM-DD",
      "invoiceDate": "YYYY-MM-DD",
      "deliveryDate": "YYYY-MM-DD oder null",
      "dueDate": "YYYY-MM-DD oder null",
      "supplierName": "Firmenname",
      "supplierAddress": "Adresse oder null",
      "supplierTaxNumber": "Steuernummer oder null",
      "supplierVatId": "USt-IdNr oder null",
      "customerName": "Kundenname oder null",
      "customerNumber": "Kundennummer oder null",
      "customerAddress": "Kundenadresse oder null",
      "positions": [
        {
          "description": "Beschreibung",
          "quantity": Menge als Zahl,
          "unit": "Einheit oder null",
          "unitPrice": Einzelpreis als Zahl,
          "totalPrice": Gesamtpreis als Zahl
        }
      ],
      "netAmount": Nettobetrag als Zahl oder null,
      "vatRate": MwSt-Satz als Zahl (z.B. 19) oder null,
      "vatAmount": MwSt-Betrag als Zahl oder null,
      "totalAmount": Gesamtbetrag als Zahl,
      "iban": "IBAN oder null",
      "bic": "BIC oder null",
      "orderNumber": "Auftragsnummer oder null",
      "deliveryNoteNumber": "Lieferscheinnummer oder null",
      "projectNumber": "Projektnummer oder null",
      "paymentTerms": "Zahlungsbedingungen oder null",
      "discountTerms": "Skonto-Bedingungen oder null"
    }`

    // Call OpenAI API
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: systemPrompt
          },
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: userPrompt
              },
              {
                type: 'image_url',
                image_url: {
                  url: `data:image/jpeg;base64,${base64Image}`,
                  detail: 'high'
                }
              }
            ]
          }
        ],
        max_tokens: 2000,
        temperature: 0.1,
        response_format: { type: 'json_object' }
      })
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`OpenAI API error: ${error}`)
    }

    const data = await response.json()
    const extractedData = JSON.parse(data.choices[0].message.content)

    console.log('Successfully extracted invoice data:', extractedData)

    return new Response(
      JSON.stringify(extractedData),
      { 
        headers: { 
          ...corsHeaders,
          'Content-Type': 'application/json'
        } 
      }
    )
  } catch (error) {
    console.error('Error processing invoice:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 400,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      }
    )
  }
})