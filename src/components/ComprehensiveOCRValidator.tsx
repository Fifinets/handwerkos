import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import { 
  Check, 
  X, 
  AlertCircle, 
  FileText, 
  Edit3, 
  Save,
  Eye,
  EyeOff,
  Building2,
  Calculator,
  Calendar,
  CreditCard,
  MapPin,
  Phone,
  Mail,
  Hash,
  Receipt,
  User
} from 'lucide-react';
import { InvoiceData, OCRResult } from '@/services/ocrService';
import { useToast } from '@/hooks/use-toast';

interface ComprehensiveOCRValidatorProps {
  ocrResult: OCRResult;
  onValidated?: (data: InvoiceData) => void;
  onRejected?: () => void;
  onCancel?: () => void;
}

export function ComprehensiveOCRValidator({ 
  ocrResult, 
  onValidated, 
  onRejected, 
  onCancel 
}: ComprehensiveOCRValidatorProps) {
  const { toast } = useToast();
  const [validatedData, setValidatedData] = useState<InvoiceData>(ocrResult.structured_data);
  const [validationNotes, setValidationNotes] = useState('');
  const [showRawText, setShowRawText] = useState(false);
  const [activeTab, setActiveTab] = useState('basic');
  const [imageUrl, setImageUrl] = useState<string | null>(null);

  useEffect(() => {
    setValidatedData(ocrResult.structured_data);
    
    // Versuche das Bild zu laden
    if (ocrResult.original_file_path && ocrResult.original_file_path.startsWith('data:image')) {
      setImageUrl(ocrResult.original_file_path);
    }
  }, [ocrResult]);

  const handleValidate = () => {
    // Validiere Pflichtfelder
    const errors = [];
    if (!validatedData.invoiceNumber) errors.push('Rechnungsnummer fehlt');
    if (!validatedData.invoiceDate) errors.push('Rechnungsdatum fehlt');
    if (!validatedData.supplierName) errors.push('Lieferantenname fehlt');
    if (!validatedData.totalAmount || validatedData.totalAmount <= 0) errors.push('Gesamtbetrag fehlt');
    if (!validatedData.serviceDescription) errors.push('Leistungsbeschreibung fehlt');

    if (errors.length > 0) {
      toast({
        title: 'Validierungsfehler',
        description: `Pflichtfelder fehlen: ${errors.join(', ')}`,
        variant: 'destructive'
      });
      return;
    }

    toast({
      title: 'Rechnung validiert',
      description: 'Die Rechnungsdaten wurden erfolgreich validiert.',
    });
    
    onValidated?.(validatedData);
  };

  const handleInputChange = (field: keyof InvoiceData, value: any) => {
    setValidatedData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const getConfidenceColor = (score: number) => {
    if (score >= 0.8) return 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400';
    if (score >= 0.6) return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400';
    return 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400';
  };

  const formatCurrency = (amount: number | undefined): string => {
    if (!amount) return '0,00 €';
    return amount.toLocaleString('de-DE', {
      style: 'currency',
      currency: 'EUR'
    });
  };

  const extractedFieldsCount = Object.entries(validatedData).filter(([key, value]) => 
    value !== undefined && value !== '' && value !== 0 && 
    !(Array.isArray(value) && value.length === 0) &&
    !(typeof value === 'object' && Object.keys(value).length === 0)
  ).length;

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/20">
                <FileText className="h-6 w-6 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <CardTitle>Rechnungsvalidierung</CardTitle>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {extractedFieldsCount} Felder erfasst • Überprüfen und korrigieren Sie die Daten
                </p>
              </div>
            </div>
            
            <div className="flex gap-2">
              <Badge variant="outline" className={getConfidenceColor(ocrResult.confidence_scores?.overall || 0)}>
                {Math.round((ocrResult.confidence_scores?.overall || 0) * 100)}% Vertrauen
              </Badge>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowRawText(!showRawText)}
              >
                {showRawText ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                OCR-Text
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Bild-Vorschau - Deutlich größer */}
        {imageUrl && (
          <div className="xl:col-span-1">
            <Card className="h-fit sticky top-6">
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>Original-Dokument</span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => window.open(imageUrl, '_blank')}
                  >
                    <Eye className="h-4 w-4 mr-2" />
                    Vollbild
                  </Button>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="relative">
                  <img 
                    src={imageUrl} 
                    alt="Invoice" 
                    className="w-full h-auto rounded-b-lg cursor-zoom-in hover:shadow-lg transition-shadow"
                    style={{ 
                      maxHeight: 'calc(100vh - 200px)', 
                      minHeight: '600px',
                      objectFit: 'contain',
                      backgroundColor: '#f8f9fa'
                    }}
                    onClick={() => window.open(imageUrl, '_blank')}
                    title="Klicken für Vollbildansicht"
                  />
                  {/* Zoom-Hinweis */}
                  <div className="absolute top-2 right-2 bg-black/70 text-white px-2 py-1 rounded text-xs">
                    Klicken zum Vergrößern
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Haupt-Validierungs-Interface */}
        <div className={imageUrl ? 'xl:col-span-1' : 'xl:col-span-2'}>
          <Card>
            <CardContent className="p-0">
              <Tabs value={activeTab} onValueChange={setActiveTab}>
                <div className="p-6 pb-0">
                  <TabsList className="grid w-full grid-cols-5">
                    <TabsTrigger value="basic">Basis</TabsTrigger>
                    <TabsTrigger value="supplier">Lieferant</TabsTrigger>
                    <TabsTrigger value="amounts">Beträge</TabsTrigger>
                    <TabsTrigger value="references">Referenzen</TabsTrigger>
                    <TabsTrigger value="additional">Erweitert</TabsTrigger>
                  </TabsList>
                </div>

                {/* Basis-Informationen */}
                <TabsContent value="basic" className="p-6 space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="invoiceNumber" className="flex items-center gap-2">
                        <Hash className="h-4 w-4" />
                        Rechnungsnummer *
                      </Label>
                      <Input
                        id="invoiceNumber"
                        value={validatedData.invoiceNumber || ''}
                        onChange={(e) => handleInputChange('invoiceNumber', e.target.value)}
                        className={!validatedData.invoiceNumber ? 'border-red-500' : ''}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="invoiceDate" className="flex items-center gap-2">
                        <Calendar className="h-4 w-4" />
                        Rechnungsdatum *
                      </Label>
                      <Input
                        id="invoiceDate"
                        type="date"
                        value={validatedData.invoiceDate || ''}
                        onChange={(e) => handleInputChange('invoiceDate', e.target.value)}
                        className={!validatedData.invoiceDate ? 'border-red-500' : ''}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="serviceDate">
                        Leistungsdatum
                      </Label>
                      <Input
                        id="serviceDate"
                        type="date"
                        value={validatedData.serviceDate || ''}
                        onChange={(e) => handleInputChange('serviceDate', e.target.value)}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="dueDate">
                        Fälligkeitsdatum
                      </Label>
                      <Input
                        id="dueDate"
                        type="date"
                        value={validatedData.dueDate || ''}
                        onChange={(e) => handleInputChange('dueDate', e.target.value)}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="currency">
                        Währung
                      </Label>
                      <Input
                        id="currency"
                        value={validatedData.currency || 'EUR'}
                        onChange={(e) => handleInputChange('currency', e.target.value)}
                      />
                    </div>
                  </div>

                  <Separator />

                  <div className="space-y-2">
                    <Label htmlFor="serviceDescription" className="flex items-center gap-2">
                      <FileText className="h-4 w-4" />
                      Leistungsbeschreibung *
                    </Label>
                    <Textarea
                      id="serviceDescription"
                      value={validatedData.serviceDescription || ''}
                      onChange={(e) => handleInputChange('serviceDescription', e.target.value)}
                      className={!validatedData.serviceDescription ? 'border-red-500' : ''}
                      rows={3}
                    />
                  </div>
                </TabsContent>

                {/* Lieferanten-Informationen */}
                <TabsContent value="supplier" className="p-6 space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="supplierName" className="flex items-center gap-2">
                        <Building2 className="h-4 w-4" />
                        Lieferant/Firma *
                      </Label>
                      <Input
                        id="supplierName"
                        value={validatedData.supplierName || ''}
                        onChange={(e) => handleInputChange('supplierName', e.target.value)}
                        className={!validatedData.supplierName ? 'border-red-500' : ''}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="contactPerson" className="flex items-center gap-2">
                        <User className="h-4 w-4" />
                        Ansprechpartner
                      </Label>
                      <Input
                        id="contactPerson"
                        value={validatedData.contactPerson || ''}
                        onChange={(e) => handleInputChange('contactPerson', e.target.value)}
                      />
                    </div>

                    <div className="md:col-span-2 space-y-2">
                      <Label htmlFor="supplierAddress" className="flex items-center gap-2">
                        <MapPin className="h-4 w-4" />
                        Lieferantenadresse
                      </Label>
                      <Textarea
                        id="supplierAddress"
                        value={validatedData.supplierAddress || ''}
                        onChange={(e) => handleInputChange('supplierAddress', e.target.value)}
                        rows={2}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="supplierVatId">
                        USt-IdNr.
                      </Label>
                      <Input
                        id="supplierVatId"
                        value={validatedData.supplierVatId || ''}
                        onChange={(e) => handleInputChange('supplierVatId', e.target.value)}
                        placeholder="DE123456789"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="supplierTaxNumber">
                        Steuernummer
                      </Label>
                      <Input
                        id="supplierTaxNumber"
                        value={validatedData.supplierTaxNumber || ''}
                        onChange={(e) => handleInputChange('supplierTaxNumber', e.target.value)}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="supplierEmail" className="flex items-center gap-2">
                        <Mail className="h-4 w-4" />
                        E-Mail
                      </Label>
                      <Input
                        id="supplierEmail"
                        type="email"
                        value={validatedData.supplierEmail || ''}
                        onChange={(e) => handleInputChange('supplierEmail', e.target.value)}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="supplierPhone" className="flex items-center gap-2">
                        <Phone className="h-4 w-4" />
                        Telefon
                      </Label>
                      <Input
                        id="supplierPhone"
                        value={validatedData.supplierPhone || ''}
                        onChange={(e) => handleInputChange('supplierPhone', e.target.value)}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="supplierIban" className="flex items-center gap-2">
                        <CreditCard className="h-4 w-4" />
                        IBAN
                      </Label>
                      <Input
                        id="supplierIban"
                        value={validatedData.supplierIban || ''}
                        onChange={(e) => handleInputChange('supplierIban', e.target.value)}
                        placeholder="DE89 3704 0044 0532 0130 00"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="supplierBic">
                        BIC
                      </Label>
                      <Input
                        id="supplierBic"
                        value={validatedData.supplierBic || ''}
                        onChange={(e) => handleInputChange('supplierBic', e.target.value)}
                        placeholder="COBADEFFXXX"
                      />
                    </div>
                  </div>
                </TabsContent>

                {/* Beträge & Steuern */}
                <TabsContent value="amounts" className="p-6 space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="totalAmount" className="flex items-center gap-2">
                        <Calculator className="h-4 w-4" />
                        Gesamtbetrag (Brutto) *
                      </Label>
                      <Input
                        id="totalAmount"
                        type="number"
                        step="0.01"
                        value={validatedData.totalAmount || ''}
                        onChange={(e) => handleInputChange('totalAmount', parseFloat(e.target.value) || 0)}
                        className={!validatedData.totalAmount ? 'border-red-500' : ''}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="netAmount">
                        Nettobetrag
                      </Label>
                      <Input
                        id="netAmount"
                        type="number"
                        step="0.01"
                        value={validatedData.netAmount || ''}
                        onChange={(e) => handleInputChange('netAmount', parseFloat(e.target.value) || 0)}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="vatAmount">
                        MwSt-Betrag
                      </Label>
                      <Input
                        id="vatAmount"
                        type="number"
                        step="0.01"
                        value={validatedData.vatAmount || ''}
                        onChange={(e) => handleInputChange('vatAmount', parseFloat(e.target.value) || 0)}
                      />
                    </div>
                  </div>

                  {/* MwSt-Sätze */}
                  {validatedData.taxRates && validatedData.taxRates.length > 0 && (
                    <div className="space-y-2">
                      <Label>Erkannte MwSt-Sätze</Label>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        {validatedData.taxRates.map((rate, index) => (
                          <div key={index} className="flex items-center justify-between p-2 border rounded">
                            <span>{rate}% MwSt</span>
                            <div className="text-sm text-gray-500">
                              Netto: {formatCurrency(validatedData.netAmounts?.[rate.toString()] || 0)} 
                              {' • '}
                              Steuer: {formatCurrency(validatedData.taxAmounts?.[rate.toString()] || 0)}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Spezielle Steuerhinweise */}
                  <div className="space-y-3">
                    <Label>Spezielle Steuerarten</Label>
                    <div className="space-y-2">
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="hasReverseCharge"
                          checked={validatedData.hasReverseCharge || false}
                          onCheckedChange={(checked) => handleInputChange('hasReverseCharge', checked)}
                        />
                        <Label htmlFor="hasReverseCharge" className="text-sm">
                          Reverse-Charge (Steuerschuldnerschaft des Leistungsempfängers)
                        </Label>
                      </div>
                      
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="isIntraCommunitySupply"
                          checked={validatedData.isIntraCommunitySupply || false}
                          onCheckedChange={(checked) => handleInputChange('isIntraCommunitySupply', checked)}
                        />
                        <Label htmlFor="isIntraCommunitySupply" className="text-sm">
                          Innergemeinschaftliche Lieferung
                        </Label>
                      </div>

                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="isExport"
                          checked={validatedData.isExport || false}
                          onCheckedChange={(checked) => handleInputChange('isExport', checked)}
                        />
                        <Label htmlFor="isExport" className="text-sm">
                          Ausfuhrlieferung
                        </Label>
                      </div>
                    </div>
                  </div>
                </TabsContent>

                {/* Referenzen */}
                <TabsContent value="references" className="p-6 space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="orderNumber">
                        Bestellnummer
                      </Label>
                      <Input
                        id="orderNumber"
                        value={validatedData.orderNumber || ''}
                        onChange={(e) => handleInputChange('orderNumber', e.target.value)}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="projectReference">
                        Projekt-Referenz
                      </Label>
                      <Input
                        id="projectReference"
                        value={validatedData.projectReference || ''}
                        onChange={(e) => handleInputChange('projectReference', e.target.value)}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="deliveryNoteNumber">
                        Lieferscheinnummer
                      </Label>
                      <Input
                        id="deliveryNoteNumber"
                        value={validatedData.deliveryNoteNumber || ''}
                        onChange={(e) => handleInputChange('deliveryNoteNumber', e.target.value)}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="paymentReference">
                        Zahlungsreferenz/Verwendungszweck
                      </Label>
                      <Input
                        id="paymentReference"
                        value={validatedData.paymentReference || ''}
                        onChange={(e) => handleInputChange('paymentReference', e.target.value)}
                      />
                    </div>

                    <div className="md:col-span-2 space-y-2">
                      <Label htmlFor="serviceLocation">
                        Liefer-/Leistungsort
                      </Label>
                      <Input
                        id="serviceLocation"
                        value={validatedData.serviceLocation || ''}
                        onChange={(e) => handleInputChange('serviceLocation', e.target.value)}
                      />
                    </div>
                  </div>
                </TabsContent>

                {/* Erweiterte Informationen */}
                <TabsContent value="additional" className="p-6 space-y-4">
                  <div className="space-y-4">
                    {/* Leistungszeitraum */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="servicePeriodStart">
                          Leistungszeitraum - Von
                        </Label>
                        <Input
                          id="servicePeriodStart"
                          type="date"
                          value={validatedData.servicePeriodStart || ''}
                          onChange={(e) => handleInputChange('servicePeriodStart', e.target.value)}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="servicePeriodEnd">
                          Leistungszeitraum - Bis
                        </Label>
                        <Input
                          id="servicePeriodEnd"
                          type="date"
                          value={validatedData.servicePeriodEnd || ''}
                          onChange={(e) => handleInputChange('servicePeriodEnd', e.target.value)}
                        />
                      </div>
                    </div>

                    {/* Empfänger-Informationen */}
                    <Separator />
                    <div className="space-y-2">
                      <Label>Empfänger (Ihr Unternehmen)</Label>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <Input
                          placeholder="Firmenname"
                          value={validatedData.customerName || ''}
                          onChange={(e) => handleInputChange('customerName', e.target.value)}
                        />
                        <Textarea
                          placeholder="Adresse"
                          value={validatedData.customerAddress || ''}
                          onChange={(e) => handleInputChange('customerAddress', e.target.value)}
                          rows={2}
                        />
                      </div>
                    </div>

                    {/* Validierungsnotizen */}
                    <Separator />
                    <div className="space-y-2">
                      <Label htmlFor="validationNotes">
                        Validierungsnotizen
                      </Label>
                      <Textarea
                        id="validationNotes"
                        value={validationNotes}
                        onChange={(e) => setValidationNotes(e.target.value)}
                        placeholder="Notizen zur Validierung..."
                        rows={3}
                      />
                    </div>

                    {/* Positionen (falls vorhanden) */}
                    {validatedData.positions && validatedData.positions.length > 0 && (
                      <div className="space-y-2">
                        <Label>Erkannte Rechnungspositionen ({validatedData.positions.length})</Label>
                        <div className="border rounded-lg p-3 space-y-2 max-h-40 overflow-y-auto">
                          {validatedData.positions.map((pos, index) => (
                            <div key={index} className="text-sm p-2 bg-gray-50 dark:bg-gray-800 rounded">
                              <div className="font-medium">{pos.description}</div>
                              <div className="text-gray-500">
                                {pos.quantity} {pos.unit || 'Stk'} × {formatCurrency(pos.unitPrice || 0)} = {formatCurrency(pos.totalPrice || 0)}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* OCR Raw Text */}
      {showRawText && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Eye className="h-5 w-5" />
              OCR Rohtext
            </CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="text-sm bg-gray-100 dark:bg-gray-800 p-4 rounded-lg whitespace-pre-wrap max-h-60 overflow-y-auto">
              {ocrResult.extracted_text}
            </pre>
          </CardContent>
        </Card>
      )}

      {/* Action Buttons - Elegante Floating Action Bar */}
      <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 z-50">
        <Card className="shadow-2xl border border-gray-200 dark:border-gray-700 bg-white/95 dark:bg-gray-900/95 backdrop-blur-sm">
          <CardContent className="p-4">
            <div className="flex flex-col sm:flex-row items-center gap-4">
              {/* Status Information */}
              <div className="flex items-center gap-3 text-sm text-gray-600 dark:text-gray-400 min-w-max">
                <div className="flex items-center gap-2 bg-green-50 dark:bg-green-900/20 px-3 py-1.5 rounded-full">
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                  <span className="font-medium text-green-700 dark:text-green-400">
                    {extractedFieldsCount} von 30+ Feldern erfasst
                  </span>
                </div>
                <Badge 
                  variant="outline" 
                  className={`${
                    (ocrResult.confidence_scores?.overall || 0) >= 0.8 
                      ? 'bg-green-50 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800'
                      : (ocrResult.confidence_scores?.overall || 0) >= 0.6 
                        ? 'bg-yellow-50 text-yellow-700 border-yellow-200 dark:bg-yellow-900/20 dark:text-yellow-400 dark:border-yellow-800'
                        : 'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800'
                  }`}
                >
                  {Math.round((ocrResult.confidence_scores?.overall || 0) * 100)}% Vertrauen
                </Badge>
              </div>
              
              {/* Action Buttons */}
              <div className="flex items-center gap-2">
                <Button 
                  variant="outline" 
                  onClick={onCancel}
                  className="px-5 py-2 text-gray-600 hover:text-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800 border-gray-300 dark:border-gray-600 transition-all duration-200"
                  size="sm"
                >
                  Abbrechen
                </Button>
                
                <Button 
                  variant="outline" 
                  onClick={onRejected} 
                  className="px-5 py-2 text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/30 border-red-200 hover:border-red-300 dark:border-red-800 dark:hover:border-red-700 transition-all duration-200"
                  size="sm"
                >
                  <X className="h-3.5 w-3.5 mr-1.5" />
                  Ablehnen
                </Button>
                
                <Button 
                  onClick={handleValidate}
                  disabled={validateMutation.isPending}
                  className="px-6 py-2 bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white font-medium shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
                  size="sm"
                >
                  {validateMutation.isPending ? (
                    <>
                      <div className="animate-spin h-3.5 w-3.5 mr-1.5 border-2 border-white border-t-transparent rounded-full"></div>
                      Verarbeitung...
                    </>
                  ) : (
                    <>
                      <Check className="h-3.5 w-3.5 mr-1.5" />
                      Validieren & Übernehmen
                    </>
                  )}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}