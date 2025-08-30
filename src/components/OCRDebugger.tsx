import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Upload, FileText, Brain, AlertCircle, CheckCircle } from 'lucide-react';
import { ocrService } from '@/services/ocrService';

export function OCRDebugger() {
  const [isProcessing, setIsProcessing] = useState(false);
  const [debugInfo, setDebugInfo] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [testText, setTestText] = useState(`
    Müller Handwerk GmbH
    Hauptstraße 123
    12345 Musterstadt
    
    Rechnung Nr. 2024-001
    Datum: 15.03.2024
    
    Kundennr: K-12345
    Auftrag: A-2024-03-001
    
    Pos. Beschreibung           Menge  Einheit  Einzelpreis  Gesamt
    1.   Arbeitszeit            8      Std      45,00 €      360,00 €
    2.   Material Holz          10     m²       25,00 €      250,00 €
    3.   Zusatzleistung         1      Stk      50,00 €      50,00 €
    
    Nettobetrag:                                             660,00 €
    MwSt 19%:                                                125,40 €
    ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    Gesamtbetrag:                                            785,40 €
    
    Zahlbar innerhalb 14 Tagen
    IBAN: DE89 3704 0044 0532 0130 00
    BIC: COBADEFFXXX
  `);

  const handleTestExtraction = () => {
    setError(null);
    setDebugInfo(null);

    try {
      // Teste die Extraktionsfunktion direkt
      const extracted = (ocrService as any).extractInvoiceData(testText);
      const cleaned = (ocrService as any).cleanOCRText(testText);
      const confidence = (ocrService as any).calculateConfidenceScores(testText, extracted);

      setDebugInfo({
        cleanedText: cleaned,
        extractedData: extracted,
        confidenceScores: confidence,
        foundPatterns: {
          invoiceNumber: !!extracted.invoiceNumber && extracted.invoiceNumber !== 'UNBEKANNT',
          date: !!extracted.date,
          supplier: !!extracted.supplierName && extracted.supplierName !== 'UNBEKANNT',
          totalAmount: extracted.totalAmount > 0,
          netAmount: !!extracted.netAmount,
          vatAmount: !!extracted.vatAmount,
          iban: !!extracted.iban,
          positions: extracted.positions?.length > 0
        }
      });
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);
    setError(null);
    setDebugInfo(null);

    try {
      // Initialisiere OCR Service
      await (ocrService as any).initialize();
      
      // Teste nur die OCR-Erkennung ohne Datenbank
      const worker = (ocrService as any).worker;
      const ocrResult = await worker.recognize(file);
      
      const extractedText = ocrResult.data.text || '';
      const cleanedText = (ocrService as any).cleanOCRText(extractedText);
      const extracted = (ocrService as any).extractInvoiceData(cleanedText);
      const confidence = (ocrService as any).calculateConfidenceScores(cleanedText, extracted);

      setDebugInfo({
        rawText: extractedText,
        cleanedText: cleanedText,
        extractedData: extracted,
        confidenceScores: confidence,
        ocrConfidence: ocrResult.data.confidence,
        foundPatterns: {
          invoiceNumber: !!extracted.invoiceNumber && extracted.invoiceNumber !== 'UNBEKANNT',
          date: !!extracted.date,
          supplier: !!extracted.supplierName && extracted.supplierName !== 'UNBEKANNT',
          totalAmount: extracted.totalAmount > 0,
          netAmount: !!extracted.netAmount,
          vatAmount: !!extracted.vatAmount,
          iban: !!extracted.iban,
          positions: extracted.positions?.length > 0
        }
      });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto p-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5" />
            OCR Debug Tool
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Test mit Beispieltext */}
          <div className="space-y-2">
            <h3 className="text-sm font-medium">Test mit Beispieltext</h3>
            <Textarea
              value={testText}
              onChange={(e) => setTestText(e.target.value)}
              rows={10}
              className="font-mono text-xs"
              placeholder="Fügen Sie hier Beispiel-Rechnungstext ein..."
            />
            <Button onClick={handleTestExtraction} variant="outline">
              <FileText className="mr-2 h-4 w-4" />
              Extraktion testen
            </Button>
          </div>

          {/* Datei-Upload */}
          <div className="space-y-2">
            <h3 className="text-sm font-medium">Bild-Upload testen</h3>
            <div className="flex items-center gap-4">
              <input
                type="file"
                accept="image/*,.pdf"
                onChange={handleFileUpload}
                disabled={isProcessing}
                className="file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary file:text-primary-foreground hover:file:bg-primary/90"
              />
              {isProcessing && (
                <span className="text-sm text-muted-foreground">
                  Verarbeite...
                </span>
              )}
            </div>
          </div>

          {/* Fehleranzeige */}
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Debug-Informationen */}
          {debugInfo && (
            <div className="space-y-4">
              <Separator />
              
              {/* Gefundene Muster */}
              <div>
                <h3 className="text-sm font-medium mb-2">Erkannte Felder</h3>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(debugInfo.foundPatterns).map(([key, found]) => (
                    <Badge
                      key={key}
                      variant={found ? "default" : "secondary"}
                      className="gap-1"
                    >
                      {found ? <CheckCircle className="h-3 w-3" /> : <X className="h-3 w-3" />}
                      {key}
                    </Badge>
                  ))}
                </div>
              </div>

              {/* Konfidenz-Scores */}
              <div>
                <h3 className="text-sm font-medium mb-2">Konfidenz-Werte</h3>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  {Object.entries(debugInfo.confidenceScores).map(([key, score]) => (
                    <div key={key} className="flex justify-between">
                      <span className="text-muted-foreground">{key}:</span>
                      <span className={score > 0.7 ? 'text-green-600' : score > 0.4 ? 'text-yellow-600' : 'text-red-600'}>
                        {(score * 100).toFixed(0)}%
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Extrahierte Daten */}
              <div>
                <h3 className="text-sm font-medium mb-2">Extrahierte Daten</h3>
                <div className="bg-muted rounded-lg p-3">
                  <pre className="text-xs overflow-auto">
                    {JSON.stringify(debugInfo.extractedData, null, 2)}
                  </pre>
                </div>
              </div>

              {/* Bereinigter Text */}
              {debugInfo.cleanedText && (
                <div>
                  <h3 className="text-sm font-medium mb-2">Bereinigter Text (erste 500 Zeichen)</h3>
                  <div className="bg-muted rounded-lg p-3">
                    <pre className="text-xs whitespace-pre-wrap">
                      {debugInfo.cleanedText.substring(0, 500)}
                    </pre>
                  </div>
                </div>
              )}

              {/* Rohtext */}
              {debugInfo.rawText && (
                <div>
                  <h3 className="text-sm font-medium mb-2">OCR Rohtext (erste 500 Zeichen)</h3>
                  <div className="bg-muted rounded-lg p-3">
                    <pre className="text-xs whitespace-pre-wrap">
                      {debugInfo.rawText.substring(0, 500)}
                    </pre>
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}