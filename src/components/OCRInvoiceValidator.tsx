import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { 
  Check, 
  X, 
  AlertCircle, 
  FileText, 
  Edit3, 
  Save,
  Eye,
  EyeOff
} from 'lucide-react';
import { useValidateOCRResult } from '@/hooks/useApi';
import { InvoiceData, OCRResult } from '@/services/ocrService';

interface OCRInvoiceValidatorProps {
  ocrResult: OCRResult;
  onValidated?: () => void;
  onRejected?: () => void;
  onCancel?: () => void;
}

export function OCRInvoiceValidator({ 
  ocrResult, 
  onValidated, 
  onRejected, 
  onCancel 
}: OCRInvoiceValidatorProps) {
  const [validatedData, setValidatedData] = useState<InvoiceData>(ocrResult.structured_data);
  const [validationNotes, setValidationNotes] = useState('');
  const [showRawText, setShowRawText] = useState(false);
  const [imageUrl, setImageUrl] = useState<string | null>(null);

  const validateMutation = useValidateOCRResult();

  useEffect(() => {
    setValidatedData(ocrResult.structured_data);
    
    // Versuche das Bild zu laden
    if (ocrResult.original_file_path && ocrResult.original_file_path !== 'demo/') {
      // Wenn es Base64 Daten gibt, verwende diese direkt
      if (ocrResult.original_file_path.startsWith('data:image')) {
        setImageUrl(ocrResult.original_file_path);
      } else {
        // Ansonsten lade von Supabase Storage
        // TODO: Implementiere Supabase Storage URL Generation
        setImageUrl(null);
      }
    }
  }, [ocrResult]);

  const handleValidate = async () => {
    try {
      await validateMutation.mutateAsync({
        ocrId: ocrResult.id,
        validatedData,
        notes: validationNotes
      });
      onValidated?.();
    } catch (error) {
      console.error('Validation failed:', error);
    }
  };


  const getConfidenceColor = (score: number) => {
    if (score >= 0.8) return 'bg-green-100 text-green-800';
    if (score >= 0.6) return 'bg-yellow-100 text-yellow-800';
    return 'bg-red-100 text-red-800';
  };

  const getConfidenceIcon = (score: number) => {
    if (score >= 0.8) return <Check className="h-4 w-4" />;
    if (score >= 0.6) return <AlertCircle className="h-4 w-4" />;
    return <X className="h-4 w-4" />;
  };

  const handleInputChange = (field: keyof InvoiceData, value: any) => {
    setValidatedData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const formatAmount = (amount: number): string => {
    return amount.toLocaleString('de-DE', {
      style: 'currency',
      currency: 'EUR'
    });
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">OCR-Rechnungsvalidierung</h2>
          <p className="text-muted-foreground">
            Überprüfen Sie die erkannten Daten und korrigieren Sie bei Bedarf
          </p>
        </div>
        <Badge 
          variant="outline" 
          className={getConfidenceColor(ocrResult.confidence_scores.overall)}
        >
          Gesamtkonfidenz: {Math.round(ocrResult.confidence_scores.overall * 100)}%
        </Badge>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Original Dokument */}
        <Card className="lg:sticky lg:top-4 lg:h-fit">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Original Dokument
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Bild-Anzeige */}
            <div className="bg-muted rounded-lg p-4 max-h-96 overflow-auto">
              {imageUrl && imageUrl.startsWith('data:image') ? (
                <div className="space-y-2">
                  <p className="text-sm font-medium">Original-Dokument:</p>
                  <img 
                    src={imageUrl} 
                    alt="Original Rechnung" 
                    className="w-full rounded border bg-white"
                    style={{ maxHeight: '300px', objectFit: 'contain' }}
                  />
                </div>
              ) : ocrResult.extracted_text ? (
                <div className="space-y-2">
                  <p className="text-sm font-medium">OCR-Textvorschau:</p>
                  <div className="bg-white rounded border p-3 max-h-60 overflow-y-auto">
                    <pre className="text-xs whitespace-pre-wrap font-mono">
                      {ocrResult.extracted_text.substring(0, 500)}
                      {ocrResult.extracted_text.length > 500 && '...'}
                    </pre>
                  </div>
                </div>
              ) : (
                <div className="text-center py-4">
                  <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-2" />
                  <p className="text-sm text-muted-foreground">
                    Kein Originalbild verfügbar
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Pfad: {ocrResult.original_file_path || 'Nicht angegeben'}
                  </p>
                </div>
              )}
            </div>

            {/* Toggle für Rohtext */}
            <div className="space-y-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowRawText(!showRawText)}
                className="w-full"
              >
                {showRawText ? <EyeOff className="h-4 w-4 mr-2" /> : <Eye className="h-4 w-4 mr-2" />}
                {showRawText ? 'OCR-Text ausblenden' : 'OCR-Text anzeigen'}
              </Button>

              {showRawText && (
                <div className="bg-muted/50 rounded-lg p-3">
                  <Label className="text-xs font-medium">Erkannter Text:</Label>
                  <div className="mt-2 text-xs font-mono bg-white p-2 rounded border max-h-40 overflow-y-auto">
                    {ocrResult.extracted_text}
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Validierung */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Edit3 className="h-5 w-5" />
              Daten-Validierung
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Rechnungsnummer */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Label htmlFor="invoiceNumber">Rechnungsnummer</Label>
                <Badge 
                  variant="outline" 
                  className={getConfidenceColor(ocrResult.confidence_scores.invoice_number)}
                >
                  {getConfidenceIcon(ocrResult.confidence_scores.invoice_number)}
                  {Math.round(ocrResult.confidence_scores.invoice_number * 100)}%
                </Badge>
              </div>
              <Input
                id="invoiceNumber"
                value={validatedData.invoiceNumber}
                onChange={(e) => handleInputChange('invoiceNumber', e.target.value)}
                className={ocrResult.confidence_scores.invoice_number < 0.7 ? 'border-yellow-500' : ''}
              />
            </div>

            {/* Lieferant */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Label htmlFor="supplierName">Lieferant</Label>
                <Badge 
                  variant="outline" 
                  className={getConfidenceColor(ocrResult.confidence_scores.supplier)}
                >
                  {getConfidenceIcon(ocrResult.confidence_scores.supplier)}
                  {Math.round(ocrResult.confidence_scores.supplier * 100)}%
                </Badge>
              </div>
              <Input
                id="supplierName"
                value={validatedData.supplierName}
                onChange={(e) => handleInputChange('supplierName', e.target.value)}
                className={ocrResult.confidence_scores.supplier < 0.7 ? 'border-yellow-500' : ''}
                placeholder="Name des Lieferanten"
              />
            </div>

            {/* Datum */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Label htmlFor="date">Rechnungsdatum</Label>
                <Badge 
                  variant="outline" 
                  className={getConfidenceColor(ocrResult.confidence_scores.date)}
                >
                  {getConfidenceIcon(ocrResult.confidence_scores.date)}
                  {Math.round(ocrResult.confidence_scores.date * 100)}%
                </Badge>
              </div>
              <Input
                id="date"
                type="date"
                value={validatedData.date}
                onChange={(e) => handleInputChange('date', e.target.value)}
                className={ocrResult.confidence_scores.date < 0.7 ? 'border-yellow-500' : ''}
              />
            </div>

            {/* Beträge */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Label htmlFor="totalAmount">Gesamtbetrag (€)</Label>
                  <Badge 
                    variant="outline" 
                    className={getConfidenceColor(ocrResult.confidence_scores.amount)}
                  >
                    {getConfidenceIcon(ocrResult.confidence_scores.amount)}
                    {Math.round(ocrResult.confidence_scores.amount * 100)}%
                  </Badge>
                </div>
                <Input
                  id="totalAmount"
                  type="number"
                  step="0.01"
                  value={validatedData.totalAmount}
                  onChange={(e) => handleInputChange('totalAmount', parseFloat(e.target.value) || 0)}
                  className={ocrResult.confidence_scores.amount < 0.7 ? 'border-yellow-500' : ''}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="vatAmount">MwSt-Betrag (€)</Label>
                <Input
                  id="vatAmount"
                  type="number"
                  step="0.01"
                  value={validatedData.vatAmount || ''}
                  onChange={(e) => handleInputChange('vatAmount', parseFloat(e.target.value) || undefined)}
                />
              </div>
            </div>

            {/* IBAN */}
            <div className="space-y-2">
              <Label htmlFor="iban">IBAN (optional)</Label>
              <Input
                id="iban"
                value={validatedData.iban || ''}
                onChange={(e) => handleInputChange('iban', e.target.value || undefined)}
                placeholder="DE89 3704 0044 0532 0130 00"
              />
            </div>

            {/* Beschreibung */}
            <div className="space-y-2">
              <Label htmlFor="description">Beschreibung</Label>
              <Textarea
                id="description"
                value={validatedData.description || ''}
                onChange={(e) => handleInputChange('description', e.target.value || undefined)}
                placeholder="Zusätzliche Informationen..."
                rows={3}
              />
            </div>

            <Separator />

            {/* Validierungsnotizen */}
            <div className="space-y-2">
              <Label htmlFor="validationNotes">Validierungsnotizen (optional)</Label>
              <Textarea
                id="validationNotes"
                value={validationNotes}
                onChange={(e) => setValidationNotes(e.target.value)}
                placeholder="Notizen zur Validierung..."
                rows={2}
              />
            </div>

            {/* Warnung bei niedriger Konfidenz */}
            {ocrResult.confidence_scores.overall < 0.7 && (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  <strong>Niedrige Konfidenz erkannt!</strong> Bitte überprüfen Sie alle Felder 
                  sorgfältig, besonders die rot/gelb markierten Werte.
                </AlertDescription>
              </Alert>
            )}

            {/* Zusammenfassung */}
            <Card className="bg-muted/50">
              <CardContent className="pt-4">
                <h4 className="font-medium mb-2">Zusammenfassung:</h4>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span>Lieferant:</span>
                    <span className="font-medium">{validatedData.supplierName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Rechnungsnr.:</span>
                    <span className="font-medium">{validatedData.invoiceNumber}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Datum:</span>
                    <span className="font-medium">
                      {new Date(validatedData.date).toLocaleDateString('de-DE')}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Gesamtbetrag:</span>
                    <span className="font-medium text-primary">
                      {formatAmount(validatedData.totalAmount)}
                    </span>
                  </div>
                  {validatedData.vatAmount && (
                    <div className="flex justify-between">
                      <span>davon MwSt:</span>
                      <span>{formatAmount(validatedData.vatAmount)}</span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Aktionen */}
            <div className="flex gap-3">
              <Button 
                onClick={handleValidate}
                disabled={validateMutation.isPending}
                className="flex-1"
              >
                <Save className="mr-2 h-4 w-4" />
                {validateMutation.isPending ? 'Speichere...' : 'Lieferantenrechnung erstellen'}
              </Button>

              {onCancel && (
                <Button 
                  variant="outline"
                  onClick={onCancel}
                >
                  Abbrechen
                </Button>
              )}
            </div>

          </CardContent>
        </Card>
      </div>
    </div>
  );
}