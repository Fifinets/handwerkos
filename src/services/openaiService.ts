import OpenAI from 'openai';
import { InvoiceData, InvoicePosition } from './ocrService';

// Initialisiere OpenAI Client
const openai = new OpenAI({
  apiKey: import.meta.env.VITE_OPENAI_API_KEY || '',
  dangerouslyAllowBrowser: true
});

/**
 * Extrahiert Rechnungsdaten mit OpenAI Vision API
 */
export async function extractInvoiceWithAI(base64Image: string, ocrText?: string): Promise<InvoiceData> {
  try {
    console.log('OpenAI Extraktion gestartet...');
    
    const systemPrompt = `Du bist ein Experte für die Extraktion von Daten aus deutschen Handwerker-Rechnungen.
    Extrahiere ALLE relevanten Informationen aus der Rechnung und gebe sie als strukturiertes JSON zurück.
    
    Achte besonders auf:
    - Deutsche Datumsformate (DD.MM.YYYY) -> konvertiere zu YYYY-MM-DD
    - Deutsche Zahlenformate (1.234,56 €) -> konvertiere zu Dezimalzahlen
    - Handwerker-spezifische Begriffe
    - Positionen/Artikel in Tabellen
    
    Gib NUR valides JSON zurück, keine zusätzlichen Erklärungen.`;

    const userPrompt = `Extrahiere alle Rechnungsdaten aus diesem Bild. 
    ${ocrText ? `Hier ist der bereits erkannte Text als Hilfe: ${ocrText}` : ''}
    
    Gib die Daten in diesem exakten JSON-Format zurück:
    {
      "invoiceNumber": "Rechnungsnummer",
      "date": "YYYY-MM-DD",
      "supplierName": "Firmenname",
      "totalAmount": Gesamtbetrag als Zahl,
      "vatAmount": MwSt-Betrag als Zahl oder null,
      "vatRate": MwSt-Satz als Zahl oder null,
      "netAmount": Nettobetrag als Zahl oder null,
      "iban": "IBAN oder null",
      "customerNumber": "Kundennummer oder null",
      "orderNumber": "Auftragsnummer oder null"
    }`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: systemPrompt
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: userPrompt
            },
            {
              type: "image_url",
              image_url: {
                url: `data:image/jpeg;base64,${base64Image}`,
                detail: "high"
              }
            }
          ]
        }
      ],
      max_tokens: 2000,
      temperature: 0.1,
      response_format: { type: "json_object" }
    });

    const extractedData = JSON.parse(response.choices[0].message.content || '{}');
    
    console.log('OpenAI extrahierte Daten:', extractedData);
    
    // Validierung und Defaults
    return {
      invoiceNumber: extractedData.invoiceNumber || 'UNBEKANNT',
      date: extractedData.date || extractedData.invoiceDate || new Date().toISOString().split('T')[0],
      invoiceDate: extractedData.invoiceDate,
      deliveryDate: extractedData.deliveryDate,
      dueDate: extractedData.dueDate,
      supplierName: extractedData.supplierName || 'UNBEKANNT',
      supplierAddress: extractedData.supplierAddress,
      supplierTaxNumber: extractedData.supplierTaxNumber,
      supplierVatId: extractedData.supplierVatId,
      customerName: extractedData.customerName,
      customerNumber: extractedData.customerNumber,
      customerAddress: extractedData.customerAddress,
      positions: extractedData.positions || [],
      netAmount: extractedData.netAmount,
      vatRate: extractedData.vatRate,
      vatAmount: extractedData.vatAmount,
      totalAmount: extractedData.totalAmount || 0,
      iban: extractedData.iban,
      bic: extractedData.bic,
      orderNumber: extractedData.orderNumber,
      deliveryNoteNumber: extractedData.deliveryNoteNumber,
      projectNumber: extractedData.projectNumber,
      paymentTerms: extractedData.paymentTerms,
      discountTerms: extractedData.discountTerms,
      description: `AI-extrahiert am ${new Date().toLocaleDateString('de-DE')}`
    };
  } catch (error) {
    console.error('OpenAI Extraktion fehlgeschlagen:', error);
    throw new Error('KI-Extraktion fehlgeschlagen: ' + (error as Error).message);
  }
}

/**
 * Prüft ob OpenAI API verfügbar ist
 */
export function isOpenAIConfigured(): boolean {
  // Temporär: Verwende lokalen API Key für bessere Zuverlässigkeit
  return !!import.meta.env.VITE_OPENAI_API_KEY;
}