// Enhanced Invoice Data Extractor
// Implements comprehensive German invoice field extraction
import { InvoiceData, InvoicePosition } from './ocrService';

interface ExtractionPatterns {
  [fieldName: string]: RegExp[];
}

export class EnhancedInvoiceExtractor {
  
  // German invoice patterns for all required fields
  private static readonly patterns: ExtractionPatterns = {
    // === MUSS-FELDER ===
    
    // Rechnungsnummer (eindeutig)
    invoiceNumber: [
      /Rechnungs[\s-]*(?:Nr\.?|Nummer)\s*[:.]\s*([A-Z0-9\-\/\._]+)/i,
      /Rechnung\s*(?:Nr\.?|Nummer)?\s*[:.]\s*([A-Z0-9\-\/\._]+)/i,
      /(?:Rg|Re|RG|RE)[\s-]*(?:Nr\.?|Nummer)?\s*[:.]\s*([A-Z0-9\-\/\._]+)/i,
      /Invoice\s*(?:No\.?|Number)?\s*[:.]\s*([A-Z0-9\-\/\._]+)/i,
      /Beleg[\s-]*(?:Nr\.?|Nummer)?\s*[:.]\s*([A-Z0-9\-\/\._]+)/i,
      /(?:Nr\.?|Nummer)\s*[:.]\s*([A-Z0-9\-\/\._]{3,})/i
    ],

    // Ausstellungsdatum (Rechnungsdatum)
    invoiceDate: [
      /(?:rechnungsdatum|datum der rechnung)[:\s]*(\d{1,2}[\.\-\/]\d{1,2}[\.\-\/]\d{2,4})/i,
      /(?:ausstellungsdatum|erstellungsdatum)[:\s]*(\d{1,2}[\.\-\/]\d{1,2}[\.\-\/]\d{2,4})/i,
      /Datum[:\s]*(\d{1,2}\.\d{1,2}\.\d{4})/i,
      /(\d{1,2}\.\d{1,2}\.\d{4})/, // Fallback: erstes gefundenes Datum
    ],

    // Leistungs-/Lieferdatum
    serviceDate: [
      /(?:leistungsdatum|lieferdatum)[:\s]*(\d{1,2}[\.\-\/]\d{1,2}[\.\-\/]\d{2,4})/i,
      /(?:leistung vom|geliefert am)[:\s]*(\d{1,2}[\.\-\/]\d{1,2}[\.\-\/]\d{2,4})/i,
    ],

    // Leistungszeitraum
    servicePeriod: [
      /(?:leistungszeitraum|zeitraum)[:\s]*(\d{1,2}[\.\-\/]\d{1,2}[\.\-\/]\d{2,4})\s*(?:bis|-)\s*(\d{1,2}[\.\-\/]\d{1,2}[\.\-\/]\d{2,4})/i,
    ],

    // Lieferant Name/Firma
    supplierName: [
      // Meist in den ersten 5 Zeilen, längste Zeile ohne Zahlen
    ],

    // Lieferant Adresse (mehrzeilig)
    supplierAddress: [
      // Straße + PLZ/Ort Pattern
      /([A-Za-zäöüÄÖÜß\s\-\.]+(?:straße|str\.|weg|platz|gasse).*?\d+.*?)\s*(\d{5}\s+[A-Za-zäöüÄÖÜß\s\-]+)/i,
    ],

    // USt-IdNr
    supplierVatId: [
      /(?:ust\.?[\s-]*id\.?[\s-]*nr\.?|umsatzsteuer[\s-]*id|vat[\s-]*id)[:\s]*([A-Z]{2}[\d\s]{8,12})/i,
      /(?:steuer[\s-]*nr\.?|steuernummer)[:\s]*(\d{2,4}\/\d{3,4}\/\d{4,6})/i,
    ],

    // IBAN
    supplierIban: [
      /IBAN[:\s]*([A-Z]{2}\d{2}[\s\d]{15,32})/i,
      /([A-Z]{2}\d{2}[\s\d]{15,32})/, // IBAN Pattern
    ],

    // BIC
    supplierBic: [
      /BIC[:\s]*([A-Z]{4}[A-Z]{2}[A-Z0-9]{2}(?:[A-Z0-9]{3})?)/i,
      /SWIFT[:\s]*([A-Z]{4}[A-Z]{2}[A-Z0-9]{2}(?:[A-Z0-9]{3})?)/i,
    ],

    // Bruttobetrag gesamt
    totalAmount: [
      /(?:gesamtbetrag|gesamt|total|summe|zu zahlen|zahlbetrag|brutto)[:\s]*€?\s*([\d]{1,3}(?:[\.\s]\d{3})*[,\.]\d{2})/i,
      /(?:endsumme|rechnungsbetrag)[:\s]*€?\s*([\d]{1,3}(?:[\.\s]\d{3})*[,\.]\d{2})/i,
      /([\d]{1,3}(?:\.\d{3})*,\d{2})\s*€/, // Format: 1.190,00 €
      /€\s*([\d]{1,3}(?:\.\d{3})*,\d{2})/, // Format: € 1.190,00
    ],

    // Nettobetrag
    netAmount: [
      /(?:netto(?:betrag|summe)?|summe netto)[:\s]*€?\s*([\d]{1,3}(?:[\.\s]\d{3})*[,\.]\d{2})/i,
    ],

    // MwSt/USt Sätze
    vatRates: [
      /(\d{1,2}(?:[,\.]\d{1,2})?)\s*%\s*(?:mwst|ust|vat)/i,
      /(?:mwst|ust|vat)\s*(\d{1,2}(?:[,\.]\d{1,2})?)\s*%/i,
    ],

    // MwSt/USt Beträge
    vatAmount: [
      /(?:mwst|ust|steuer)[:\s]*€?\s*([\d]{1,3}(?:[\.\s]\d{3})*[,\.]\d{2})/i,
      /(\d{1,2}(?:[,\.]\d{1,2})?)\s*%[:\s]*€?\s*([\d]{1,3}(?:[\.\s]\d{3})*[,\.]\d{2})/i,
    ],

    // Zahlungsziel/Fälligkeit
    dueDate: [
      /(?:fällig am|zahlbar bis|zahlungsziel|zahlung bis)[:\s]*(\d{1,2}[\.\-\/]\d{1,2}[\.\-\/]\d{2,4})/i,
      /(?:fälligkeit)[:\s]*(\d{1,2}[\.\-\/]\d{1,2}[\.\-\/]\d{2,4})/i,
      /(?:zahlbar innerhalb|zahlung innerhalb)\s*(\d{1,2})\s*(?:tage|tag)/i,
    ],

    // Zahlungsreferenz
    paymentReference: [
      /(?:verwendungszweck|zahlungsreferenz|referenz)[:\s]*([A-Z0-9\-\/\s]+)/i,
      /(?:bei zahlung bitte angeben)[:\s]*([A-Z0-9\-\/\s]+)/i,
    ],

    // === SOLLTE-FELDER ===

    // Bestell-/Auftragsnummer
    orderNumber: [
      /(?:bestell[\s-]*nr\.?|bestellung|auftrag[\s-]*nr\.?)[:\s]*([A-Z0-9\-\/]+)/i,
      /(?:order|po)[\s-]*(?:no\.?|number)[:\s]*([A-Z0-9\-\/]+)/i,
    ],

    // Lieferscheinnummer
    deliveryNoteNumber: [
      /(?:liefer[\s-]*schein[\s-]*nr\.?|ls[\s-]*nr\.?)[:\s]*([A-Z0-9\-\/]+)/i,
    ],

    // Projekt-Referenz
    projectReference: [
      /(?:projekt[\s-]*nr\.?|projekt|project)[:\s]*([A-Z0-9\-\/]+)/i,
    ],

    // Kontaktperson
    contactPerson: [
      /(?:ansprechpartner|kontakt|ihr ansprechpartner)[:\s]*([A-Za-zäöüÄÖÜß\s\-\.]+)/i,
    ],

    // E-Mail
    supplierEmail: [
      /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/,
    ],

    // Telefon
    supplierPhone: [
      /(?:tel\.?|telefon|phone)[:\s]*([+\d\s\-\/\(\)]+)/i,
    ],

    // Reverse Charge Hinweis
    reverseCharge: [
      /reverse[\s-]*charge/i,
      /steuerschuldnerschaft des leistungsempfängers/i,
      /§\s*13b\s*ustg/i,
    ],

    // Innergemeinschaftliche Lieferung
    intraCommunitySupply: [
      /innergemeinschaftliche\s+lieferung/i,
      /§\s*4\s*nr\.\s*1b\s*ustg/i,
    ],

    // Währung
    currency: [
      /€|EUR|EURO/i,
      /\$|USD|DOLLAR/i,
      /CHF|FRANKEN/i,
    ],
  };

  /**
   * Extrahiert umfassende Rechnungsdaten aus OCR-Text
   */
  static extractInvoiceData(text: string): InvoiceData {
    const lines = text.split('\n').map(line => line.trim()).filter(Boolean);
    const cleanText = text.replace(/\n/g, ' ').replace(/\s+/g, ' ').trim();
    
    console.log('🔍 Starting comprehensive invoice extraction...');
    console.log('📄 Text lines:', lines.length);

    // Initialisiere Basis-Datenstruktur
    const invoiceData: InvoiceData = {
      invoiceNumber: '',
      invoiceDate: '',
      currency: 'EUR', // Standard
      supplierName: '',
      supplierAddress: '',
      netAmounts: {},
      taxRates: [],
      taxAmounts: {},
      totalAmount: 0,
      serviceDescription: '',
    };

    // === MUSS-FELDER EXTRACTION ===

    // Rechnungsnummer
    invoiceData.invoiceNumber = this.extractFirstMatch(cleanText, this.patterns.invoiceNumber) || 'NICHT_GEFUNDEN';

    // Rechnungsdatum
    invoiceData.invoiceDate = this.extractFirstMatch(cleanText, this.patterns.invoiceDate) || '';

    // Leistungsdatum
    invoiceData.serviceDate = this.extractFirstMatch(cleanText, this.patterns.serviceDate);

    // Leistungszeitraum
    const servicePeriodMatch = cleanText.match(this.patterns.servicePeriod[0]);
    if (servicePeriodMatch) {
      invoiceData.servicePeriodStart = servicePeriodMatch[1];
      invoiceData.servicePeriodEnd = servicePeriodMatch[2];
    }

    // Lieferant Name (intelligente Extraktion)
    invoiceData.supplierName = this.extractSupplierName(lines);

    // Lieferant Adresse
    invoiceData.supplierAddress = this.extractSupplierAddress(lines);

    // USt-IdNr / Steuernummer
    invoiceData.supplierVatId = this.extractFirstMatch(cleanText, this.patterns.supplierVatId);

    // IBAN & BIC
    invoiceData.supplierIban = this.extractFirstMatch(cleanText, this.patterns.supplierIban);
    invoiceData.supplierBic = this.extractFirstMatch(cleanText, this.patterns.supplierBic);

    // Beträge
    const totalAmountStr = this.extractFirstMatch(cleanText, this.patterns.totalAmount);
    invoiceData.totalAmount = this.parseGermanAmount(totalAmountStr) || 0;

    const netAmountStr = this.extractFirstMatch(cleanText, this.patterns.netAmount);
    const netAmount = this.parseGermanAmount(netAmountStr) || 0;

    // MwSt-Sätze und -Beträge
    const vatInfo = this.extractVATInfo(cleanText);
    invoiceData.taxRates = vatInfo.rates;
    invoiceData.taxAmounts = vatInfo.amounts;
    invoiceData.netAmounts = vatInfo.netAmounts;

    // Falls keine Detail-MwSt gefunden, verwende Basis-Berechnung
    if (invoiceData.taxRates.length === 0 && invoiceData.totalAmount > 0) {
      const standardVatRate = 19; // Standard: 19%
      const netFromGross = invoiceData.totalAmount / 1.19;
      const vatAmount = invoiceData.totalAmount - netFromGross;
      
      invoiceData.taxRates = [standardVatRate];
      invoiceData.netAmounts[standardVatRate.toString()] = Math.round(netFromGross * 100) / 100;
      invoiceData.taxAmounts[standardVatRate.toString()] = Math.round(vatAmount * 100) / 100;
    }

    // Zahlungsziel
    invoiceData.dueDate = this.extractDueDate(cleanText);

    // Zahlungsreferenz
    invoiceData.paymentReference = this.extractFirstMatch(cleanText, this.patterns.paymentReference);

    // Service Description (erste sinnvolle Beschreibung)
    invoiceData.serviceDescription = this.extractServiceDescription(lines);

    // === SOLLTE-FELDER EXTRACTION ===

    // Referenzen
    invoiceData.orderNumber = this.extractFirstMatch(cleanText, this.patterns.orderNumber);
    invoiceData.deliveryNoteNumber = this.extractFirstMatch(cleanText, this.patterns.deliveryNoteNumber);
    invoiceData.projectReference = this.extractFirstMatch(cleanText, this.patterns.projectReference);

    // Kontaktdaten
    invoiceData.contactPerson = this.extractFirstMatch(cleanText, this.patterns.contactPerson);
    invoiceData.supplierEmail = this.extractFirstMatch(cleanText, this.patterns.supplierEmail);
    invoiceData.supplierPhone = this.extractFirstMatch(cleanText, this.patterns.supplierPhone);

    // Spezielle Steuerhinweise
    invoiceData.hasReverseCharge = this.patterns.reverseCharge.some(pattern => pattern.test(cleanText));
    invoiceData.isIntraCommunitySupply = this.patterns.intraCommunitySupply.some(pattern => pattern.test(cleanText));

    // Währung
    const currencyMatch = cleanText.match(/€|EUR/) ? 'EUR' : 
                         cleanText.match(/\$|USD/) ? 'USD' : 
                         cleanText.match(/CHF/) ? 'CHF' : 'EUR';
    invoiceData.currency = currencyMatch;

    // Positionen extrahieren
    invoiceData.positions = this.extractInvoicePositions(text);

    // Legacy-Felder für Kompatibilität
    invoiceData.date = invoiceData.invoiceDate; // Legacy
    invoiceData.netAmount = Object.values(invoiceData.netAmounts).reduce((sum, amount) => sum + amount, 0);
    invoiceData.vatAmount = Object.values(invoiceData.taxAmounts).reduce((sum, amount) => sum + amount, 0);
    invoiceData.description = invoiceData.serviceDescription; // Legacy

    console.log('✅ Invoice extraction completed:', {
      invoiceNumber: invoiceData.invoiceNumber,
      supplierName: invoiceData.supplierName,
      totalAmount: invoiceData.totalAmount,
      taxRates: invoiceData.taxRates,
      fieldsExtracted: Object.keys(invoiceData).filter(key => 
        invoiceData[key as keyof InvoiceData] !== undefined && 
        invoiceData[key as keyof InvoiceData] !== '' && 
        invoiceData[key as keyof InvoiceData] !== 0
      ).length
    });

    return invoiceData;
  }

  // === HILFSMETHODEN ===

  private static extractFirstMatch(text: string, patterns: RegExp[]): string | undefined {
    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match && match[1]) {
        return match[1].trim();
      }
    }
    return undefined;
  }

  private static parseGermanAmount(amountStr: string | undefined): number | undefined {
    if (!amountStr) return undefined;
    
    // Deutsche Zahlenformate: 1.234,56 oder 1234,56 oder 1,234.56
    const cleaned = amountStr
      .replace(/[^\d,\.]/g, '') // Nur Zahlen, Kommas und Punkte
      .replace(/\s/g, ''); // Leerzeichen entfernen

    // Deutsches Format: 1.234,56
    if (/^\d{1,3}(\.\d{3})*,\d{2}$/.test(cleaned)) {
      return parseFloat(cleaned.replace(/\./g, '').replace(',', '.'));
    }
    
    // Englisches Format: 1,234.56
    if (/^\d{1,3}(,\d{3})*\.\d{2}$/.test(cleaned)) {
      return parseFloat(cleaned.replace(/,/g, ''));
    }
    
    // Einfaches Format: 1234.56 oder 1234,56
    return parseFloat(cleaned.replace(',', '.'));
  }

  private static extractSupplierName(lines: string[]): string {
    // Suche in den ersten 10 Zeilen nach der längsten Zeile ohne Zahlen
    // und ohne typische Rechnungs-Keywords
    const skipKeywords = /rechnung|invoice|datum|total|mwst|ust|€|tel|fax|email|www/i;
    
    for (let i = 0; i < Math.min(10, lines.length); i++) {
      const line = lines[i].trim();
      if (line.length > 10 && 
          !skipKeywords.test(line) && 
          !/^\d/.test(line) && // Beginnt nicht mit Zahl
          /[a-zA-ZäöüÄÖÜß]/.test(line)) { // Enthält Buchstaben
        return line;
      }
    }
    
    return 'NICHT_GEFUNDEN';
  }

  private static extractSupplierAddress(lines: string[]): string {
    // Suche nach Straße + PLZ/Ort Pattern in ersten 15 Zeilen
    for (let i = 0; i < Math.min(15, lines.length); i++) {
      const line = lines[i].trim();
      
      // Pattern: Straße + Nummer + PLZ + Ort
      const addressPattern = /([A-Za-zäöüÄÖÜß\s\-\.]+(?:straße|str\.|weg|platz|gasse|allee).*?\d+.*?)(\d{5}\s+[A-Za-zäöüÄÖÜß\s\-]+)/i;
      const match = line.match(addressPattern);
      
      if (match) {
        return `${match[1].trim()}, ${match[2].trim()}`;
      }
      
      // Fallback: PLZ + Ort
      const cityPattern = /(\d{5}\s+[A-Za-zäöüÄÖÜß\s\-]+)/;
      const cityMatch = line.match(cityPattern);
      if (cityMatch && i > 0) {
        return `${lines[i-1].trim()}, ${cityMatch[1].trim()}`;
      }
    }
    
    return '';
  }

  private static extractVATInfo(text: string): {
    rates: number[];
    amounts: {[rate: string]: number};
    netAmounts: {[rate: string]: number};
  } {
    const vatInfo = { rates: [], amounts: {}, netAmounts: {} } as any;
    
    // Suche nach MwSt-Sätzen und -Beträgen
    const vatPattern = /(\d{1,2}(?:[,\.]\d{1,2})?)\s*%.*?€?\s*([\d]{1,3}(?:[\.\s]\d{3})*[,\.]\d{2})/gi;
    let match;
    
    while ((match = vatPattern.exec(text)) !== null) {
      const rate = parseFloat(match[1].replace(',', '.'));
      const amount = this.parseGermanAmount(match[2]);
      
      if (rate >= 0 && rate <= 25 && amount && amount > 0) {
        if (!vatInfo.rates.includes(rate)) {
          vatInfo.rates.push(rate);
        }
        vatInfo.amounts[rate.toString()] = amount;
        
        // Berechne Nettobetrag (rückwärts aus MwSt)
        const netAmount = amount / (rate / 100);
        vatInfo.netAmounts[rate.toString()] = Math.round(netAmount * 100) / 100;
      }
    }
    
    return vatInfo;
  }

  private static extractDueDate(text: string): string | undefined {
    // Suche nach Zahlungsziel
    for (const pattern of this.patterns.dueDate) {
      const match = text.match(pattern);
      if (match) {
        if (match[1].includes('tage') || match[1].includes('tag')) {
          // Relative Angabe: "14 Tage" -> berechne Datum
          const days = parseInt(match[1]);
          const dueDate = new Date();
          dueDate.setDate(dueDate.getDate() + days);
          return dueDate.toLocaleDateString('de-DE');
        } else {
          return match[1]; // Absolutes Datum
        }
      }
    }
    return undefined;
  }

  private static extractServiceDescription(lines: string[]): string {
    // Suche nach Dienstleistungsbeschreibung in mittleren Zeilen
    const skipPatterns = /rechnung|invoice|datum|total|mwst|ust|€|tel|fax|email|www|iban|bic|nr\./i;
    
    for (let i = 5; i < Math.min(lines.length - 5, 20); i++) {
      const line = lines[i].trim();
      if (line.length > 20 && 
          !skipPatterns.test(line) && 
          !/^\d+[\.,]\d/.test(line) && // Keine Preise
          /[a-zA-ZäöüÄÖÜß]/.test(line)) {
        return line;
      }
    }
    
    return 'Dienstleistung/Warenlieferung';
  }

  private static extractInvoicePositions(text: string): InvoicePosition[] {
    // Vereinfachte Positions-Extraktion - kann später erweitert werden
    const positions: InvoicePosition[] = [];
    const lines = text.split('\n');
    
    // Pattern für typische Rechnungspositionen
    const posPattern = /(\d+)\s+(.+?)\s+(\d+(?:[,\.]\d+)?)\s+([A-Za-z]+)\s+([\d,\.]+)\s+([\d,\.]+)/;
    
    for (const line of lines) {
      const match = line.match(posPattern);
      if (match) {
        positions.push({
          position: parseInt(match[1]),
          description: match[2].trim(),
          quantity: parseFloat(match[3].replace(',', '.')),
          unit: match[4],
          unitPrice: parseFloat(match[5].replace(',', '.')),
          totalPrice: parseFloat(match[6].replace(',', '.'))
        });
      }
    }
    
    return positions;
  }
}