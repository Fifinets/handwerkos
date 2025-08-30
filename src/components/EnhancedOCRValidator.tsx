// Enhanced OCR Validator with Confidence Scores and Validation
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { 
  CheckCircle, 
  AlertTriangle, 
  XCircle, 
  TrendingUp, 
  TrendingDown,
  Eye,
  Edit3,
  DollarSign,
  Calendar,
  Building,
  FileText,
  Plus,
  Minus,
  Info
} from 'lucide-react';
import { EnhancedOCRResult, StructuredInvoiceData, DetailedConfidenceScores } from '@/services/enhancedOcrService';
import { OCRPipelineService, PipelineValidationResult, SupplierMatch, DuplicateWarning } from '@/services/ocrPipelineService';
import { useToast } from '@/hooks/use-toast';

interface EnhancedOCRValidatorProps {
  ocrResult: EnhancedOCRResult;
  onValidated?: (invoiceId: string) => void;
  onRejected?: (reason: string) => void;
  onCancel?: () => void;
}

interface ValidationState {
  structuredData: StructuredInvoiceData;
  confidenceScores: DetailedConfidenceScores;
  validationResult: PipelineValidationResult | null;
  supplierMatches: SupplierMatch[];
  duplicateWarnings: DuplicateWarning[];
  isEditing: boolean;
  isValidating: boolean;
  showRawText: boolean;
}

export function EnhancedOCRValidator({
  ocrResult,
  onValidated,
  onRejected,
  onCancel
}: EnhancedOCRValidatorProps) {
  const [state, setState] = useState<ValidationState>({
    structuredData: ocrResult.structured_data,
    confidenceScores: ocrResult.confidence_scores,
    validationResult: null,
    supplierMatches: [],
    duplicateWarnings: [],
    isEditing: false,
    isValidating: false,
    showRawText: false
  });

  const { toast } = useToast();

  useEffect(() => {
    validateData();
    findSupplierMatches();
    checkDuplicates();
  }, [ocrResult]);

  const validateData = async () => {
    try {
      setState(prev => ({ ...prev, isValidating: true }));
      const result = await OCRPipelineService.validateOCRData(ocrResult.id);
      setState(prev => ({ 
        ...prev, 
        validationResult: result,
        isValidating: false 
      }));
    } catch (error) {
      console.error('Validation failed:', error);
      setState(prev => ({ ...prev, isValidating: false }));
    }
  };

  const findSupplierMatches = async () => {
    try {
      const matches = await OCRPipelineService.findSupplierMatches(state.structuredData);
      setState(prev => ({ ...prev, supplierMatches: matches }));
    } catch (error) {
      console.error('Supplier matching failed:', error);
    }
  };

  const checkDuplicates = async () => {
    try {
      const duplicates = await OCRPipelineService.checkForDuplicates(state.structuredData);
      setState(prev => ({ ...prev, duplicateWarnings: duplicates }));
    } catch (error) {
      console.error('Duplicate check failed:', error);
    }
  };

  const handleImport = async () => {
    try {
      setState(prev => ({ ...prev, isValidating: true }));
      const result = await OCRPipelineService.importInvoiceFromOCR(ocrResult.id);
      
      if (result.success && result.invoice_id) {
        toast({
          title: 'Import erfolgreich',
          description: `Rechnung ${result.invoice_id} wurde importiert`,
        });
        onValidated?.(result.invoice_id);
      } else {
        throw new Error(result.error || 'Import failed');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      toast({
        title: 'Import fehlgeschlagen',
        description: errorMessage,
        variant: 'destructive'
      });
    } finally {
      setState(prev => ({ ...prev, isValidating: false }));
    }
  };

  const handleReject = () => {
    const reason = prompt('Grund für Ablehnung (optional):');
    onRejected?.(reason || 'Manuell abgelehnt');
  };

  const updateStructuredData = (field: string, value: any) => {
    setState(prev => {
      const newData = { ...prev.structuredData };
      const keys = field.split('.');
      let current: any = newData;
      
      for (let i = 0; i < keys.length - 1; i++) {
        if (!current[keys[i]]) current[keys[i]] = {};
        current = current[keys[i]];
      }
      
      current[keys[keys.length - 1]] = value;
      
      return {
        ...prev,
        structuredData: newData
      };
    });
  };

  const getConfidenceColor = (score: number): string => {
    if (score >= 0.8) return 'text-green-600 bg-green-50 border-green-200';
    if (score >= 0.6) return 'text-yellow-600 bg-yellow-50 border-yellow-200';
    return 'text-red-600 bg-red-50 border-red-200';
  };

  const getConfidenceIcon = (score: number) => {
    if (score >= 0.8) return <TrendingUp className="h-3 w-3" />;
    if (score >= 0.6) return <TrendingDown className="h-3 w-3" />;
    return <AlertTriangle className="h-3 w-3" />;
  };

  const addTaxLine = () => {
    setState(prev => ({
      ...prev,
      structuredData: {
        ...prev.structuredData,
        totals: {
          ...prev.structuredData.totals,
          taxes: [
            ...prev.structuredData.totals.taxes,
            { rate: 19, base: 0, amount: 0, type: 'standard' as const }
          ]
        }
      }
    }));
  };

  const removeTaxLine = (index: number) => {
    setState(prev => ({
      ...prev,
      structuredData: {
        ...prev.structuredData,
        totals: {
          ...prev.structuredData.totals,
          taxes: prev.structuredData.totals.taxes.filter((_, i) => i !== index)
        }
      }
    }));
  };

  const addItem = () => {
    const newItem = {
      pos: (state.structuredData.items?.length || 0) + 1,
      description: '',
      qty: 1,
      unit: 'Stk',
      unit_price: 0,
      net: 0,
      tax_rate: 19
    };

    setState(prev => ({
      ...prev,
      structuredData: {
        ...prev.structuredData,
        items: [...(prev.structuredData.items || []), newItem]
      }
    }));
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                OCR-Validierung
              </CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                Überprüfen Sie die erkannten Daten und bestätigen Sie den Import
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className={getConfidenceColor(state.confidenceScores.overall)}>
                {getConfidenceIcon(state.confidenceScores.overall)}
                <span className="ml-1">
                  {Math.round(state.confidenceScores.overall * 100)}% Konfidenz
                </span>
              </Badge>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setState(prev => ({ ...prev, showRawText: !prev.showRawText }))}
              >
                <Eye className="h-4 w-4 mr-1" />
                {state.showRawText ? 'Text ausblenden' : 'Rohtext anzeigen'}
              </Button>
            </div>
          </div>
        </CardHeader>

        {state.showRawText && (
          <CardContent>
            <div className="bg-gray-50 p-4 rounded-lg max-h-32 overflow-y-auto">
              <pre className="text-xs whitespace-pre-wrap">{ocrResult.extracted_text}</pre>
            </div>
          </CardContent>
        )}
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column - Main Data */}
        <div className="space-y-6">
          {/* Invoice Information */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Rechnungsdaten</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="invoice-number">Rechnungsnummer</Label>
                  <div className="flex items-center space-x-2">
                    <Input
                      id="invoice-number"
                      value={state.structuredData.invoice.number}
                      onChange={(e) => updateStructuredData('invoice.number', e.target.value)}
                      className={getConfidenceColor(state.confidenceScores['invoice.number'])}
                    />
                    <Badge variant="outline" className="text-xs">
                      {Math.round(state.confidenceScores['invoice.number'] * 100)}%
                    </Badge>
                  </div>
                </div>

                <div>
                  <Label htmlFor="invoice-date">Rechnungsdatum</Label>
                  <div className="flex items-center space-x-2">
                    <Input
                      id="invoice-date"
                      type="date"
                      value={state.structuredData.invoice.date}
                      onChange={(e) => updateStructuredData('invoice.date', e.target.value)}
                      className={getConfidenceColor(state.confidenceScores['invoice.date'])}
                    />
                    <Badge variant="outline" className="text-xs">
                      {Math.round(state.confidenceScores['invoice.date'] * 100)}%
                    </Badge>
                  </div>
                </div>

                <div>
                  <Label htmlFor="due-date">Fälligkeitsdatum</Label>
                  <Input
                    id="due-date"
                    type="date"
                    value={state.structuredData.invoice.due_date || ''}
                    onChange={(e) => updateStructuredData('invoice.due_date', e.target.value)}
                  />
                </div>

                <div>
                  <Label htmlFor="currency">Währung</Label>
                  <Input
                    id="currency"
                    value={state.structuredData.invoice.currency}
                    onChange={(e) => updateStructuredData('invoice.currency', e.target.value)}
                  />
                </div>
              </div>

              {state.structuredData.invoice.payment_terms && (
                <div>
                  <Label htmlFor="payment-terms">Zahlungsbedingungen</Label>
                  <Input
                    id="payment-terms"
                    value={state.structuredData.invoice.payment_terms}
                    onChange={(e) => updateStructuredData('invoice.payment_terms', e.target.value)}
                  />
                </div>
              )}
            </CardContent>
          </Card>

          {/* Supplier Information */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Building className="h-5 w-5" />
                Lieferant
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="supplier-name">Firmenname</Label>
                <div className="flex items-center space-x-2">
                  <Input
                    id="supplier-name"
                    value={state.structuredData.supplier.name}
                    onChange={(e) => updateStructuredData('supplier.name', e.target.value)}
                    className={getConfidenceColor(state.confidenceScores['supplier.name'])}
                  />
                  <Badge variant="outline" className="text-xs">
                    {Math.round(state.confidenceScores['supplier.name'] * 100)}%
                  </Badge>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="supplier-vat">USt-IdNr.</Label>
                  <div className="flex items-center space-x-2">
                    <Input
                      id="supplier-vat"
                      value={state.structuredData.supplier.vat_id || ''}
                      onChange={(e) => updateStructuredData('supplier.vat_id', e.target.value)}
                      className={state.confidenceScores['supplier.vat_id'] ? 
                        getConfidenceColor(state.confidenceScores['supplier.vat_id']) : ''}
                    />
                    {state.confidenceScores['supplier.vat_id'] && (
                      <Badge variant="outline" className="text-xs">
                        {Math.round(state.confidenceScores['supplier.vat_id'] * 100)}%
                      </Badge>
                    )}
                  </div>
                </div>

                <div>
                  <Label htmlFor="supplier-iban">IBAN</Label>
                  <Input
                    id="supplier-iban"
                    value={state.structuredData.supplier.iban || ''}
                    onChange={(e) => updateStructuredData('supplier.iban', e.target.value)}
                    className={state.confidenceScores['supplier.iban'] ? 
                      getConfidenceColor(state.confidenceScores['supplier.iban']) : ''}
                  />
                </div>
              </div>

              {state.structuredData.supplier.address && (
                <div>
                  <Label htmlFor="supplier-address">Adresse</Label>
                  <Textarea
                    id="supplier-address"
                    value={state.structuredData.supplier.address}
                    onChange={(e) => updateStructuredData('supplier.address', e.target.value)}
                    rows={3}
                  />
                </div>
              )}

              {/* Supplier Match Results */}
              {state.supplierMatches.length > 0 && (
                <Alert className="bg-blue-50 border-blue-200">
                  <Info className="h-4 w-4" />
                  <AlertDescription>
                    <strong>Lieferant-Treffer gefunden:</strong>
                    <div className="mt-2 space-y-1">
                      {state.supplierMatches.slice(0, 3).map((match, index) => (
                        <div key={index} className="text-sm">
                          <Badge variant="outline" className="mr-2">
                            {Math.round(match.match_score * 100)}%
                          </Badge>
                          {match.supplier_data?.name} - {match.match_reason}
                        </div>
                      ))}
                    </div>
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right Column - Totals & Items */}
        <div className="space-y-6">
          {/* Totals */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <DollarSign className="h-5 w-5" />
                Summen
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="net-total">Nettosumme</Label>
                  <Input
                    id="net-total"
                    type="number"
                    step="0.01"
                    value={state.structuredData.totals.net}
                    onChange={(e) => updateStructuredData('totals.net', parseFloat(e.target.value))}
                  />
                </div>

                <div>
                  <Label htmlFor="gross-total">Bruttosumme</Label>
                  <div className="flex items-center space-x-2">
                    <Input
                      id="gross-total"
                      type="number"
                      step="0.01"
                      value={state.structuredData.totals.gross}
                      onChange={(e) => updateStructuredData('totals.gross', parseFloat(e.target.value))}
                      className={getConfidenceColor(state.confidenceScores['totals.gross'])}
                    />
                    <Badge variant="outline" className="text-xs">
                      {Math.round(state.confidenceScores['totals.gross'] * 100)}%
                    </Badge>
                  </div>
                </div>
              </div>

              {/* Tax Lines */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <Label>Steuern</Label>
                  <Button size="sm" variant="outline" onClick={addTaxLine}>
                    <Plus className="h-3 w-3 mr-1" />
                    Steuer hinzufügen
                  </Button>
                </div>

                <div className="space-y-2">
                  {state.structuredData.totals.taxes.map((tax, index) => (
                    <div key={index} className="grid grid-cols-4 gap-2 items-end">
                      <div>
                        <Label className="text-xs">Satz %</Label>
                        <Input
                          type="number"
                          step="0.01"
                          value={tax.rate}
                          onChange={(e) => {
                            const newTaxes = [...state.structuredData.totals.taxes];
                            newTaxes[index] = { ...tax, rate: parseFloat(e.target.value) };
                            updateStructuredData('totals.taxes', newTaxes);
                          }}
                          className="text-xs"
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Basis</Label>
                        <Input
                          type="number"
                          step="0.01"
                          value={tax.base}
                          onChange={(e) => {
                            const newTaxes = [...state.structuredData.totals.taxes];
                            newTaxes[index] = { ...tax, base: parseFloat(e.target.value) };
                            updateStructuredData('totals.taxes', newTaxes);
                          }}
                          className="text-xs"
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Betrag</Label>
                        <Input
                          type="number"
                          step="0.01"
                          value={tax.amount}
                          onChange={(e) => {
                            const newTaxes = [...state.structuredData.totals.taxes];
                            newTaxes[index] = { ...tax, amount: parseFloat(e.target.value) };
                            updateStructuredData('totals.taxes', newTaxes);
                          }}
                          className="text-xs"
                        />
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => removeTaxLine(index)}
                        className="p-1"
                      >
                        <Minus className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Validation Results */}
          {state.validationResult && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <CheckCircle className="h-5 w-5" />
                  Validierung
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    {state.validationResult.valid ? (
                      <CheckCircle className="h-5 w-5 text-green-600" />
                    ) : (
                      <XCircle className="h-5 w-5 text-red-600" />
                    )}
                    <span className="font-medium">
                      {state.validationResult.valid ? 'Daten sind valide' : 'Validierungsfehler'}
                    </span>
                  </div>

                  {state.validationResult.errors.length > 0 && (
                    <Alert variant="destructive">
                      <AlertDescription>
                        <strong>Fehler:</strong>
                        <ul className="list-disc list-inside mt-1">
                          {state.validationResult.errors.map((error, index) => (
                            <li key={index} className="text-sm">{error}</li>
                          ))}
                        </ul>
                      </AlertDescription>
                    </Alert>
                  )}

                  {state.validationResult.warnings.length > 0 && (
                    <Alert className="bg-yellow-50 border-yellow-200">
                      <AlertTriangle className="h-4 w-4" />
                      <AlertDescription>
                        <strong>Warnungen:</strong>
                        <ul className="list-disc list-inside mt-1">
                          {state.validationResult.warnings.map((warning, index) => (
                            <li key={index} className="text-sm">{warning}</li>
                          ))}
                        </ul>
                      </AlertDescription>
                    </Alert>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Duplicate Warnings */}
          {state.duplicateWarnings.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg text-orange-700">Duplikat-Warnungen</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {state.duplicateWarnings.map((warning, index) => (
                    <Alert key={index} className="bg-orange-50 border-orange-200">
                      <AlertTriangle className="h-4 w-4" />
                      <AlertDescription>
                        <div className="space-y-1">
                          <div className="font-medium">
                            {warning.duplicate_type === 'exact' ? 'Exaktes Duplikat' : 
                             warning.duplicate_type === 'likely' ? 'Wahrscheinliches Duplikat' : 
                             'Mögliches Duplikat'}
                          </div>
                          <div className="text-sm">
                            Rechnung: {warning.details.existing_invoice_number} | 
                            Betrag: {warning.details.existing_amount}€ | 
                            Differenz: {warning.details.amount_difference}€
                          </div>
                        </div>
                      </AlertDescription>
                    </Alert>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Line Items */}
      {state.structuredData.items && state.structuredData.items.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">Positionen</CardTitle>
              <Button size="sm" variant="outline" onClick={addItem}>
                <Plus className="h-3 w-3 mr-1" />
                Position hinzufügen
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {state.structuredData.items.map((item, index) => (
                <div key={index} className="grid grid-cols-6 gap-2 p-3 border rounded-lg">
                  <div>
                    <Label className="text-xs">Pos</Label>
                    <Input
                      type="number"
                      value={item.pos || index + 1}
                      className="text-xs"
                      size={1}
                    />
                  </div>
                  <div className="col-span-2">
                    <Label className="text-xs">Beschreibung</Label>
                    <Input
                      value={item.description}
                      onChange={(e) => {
                        const newItems = [...(state.structuredData.items || [])];
                        newItems[index] = { ...item, description: e.target.value };
                        updateStructuredData('items', newItems);
                      }}
                      className="text-xs"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Menge</Label>
                    <Input
                      type="number"
                      step="0.001"
                      value={item.qty}
                      className="text-xs"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Einzelpreis</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={item.unit_price}
                      className="text-xs"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Netto</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={item.net}
                      className="text-xs"
                      readOnly
                    />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Action Buttons */}
      <Card>
        <CardContent className="p-4">
          <div className="flex justify-between">
            <div className="flex space-x-2">
              <Button variant="outline" onClick={onCancel}>
                Abbrechen
              </Button>
              <Button variant="destructive" onClick={handleReject}>
                <XCircle className="h-4 w-4 mr-1" />
                Ablehnen
              </Button>
            </div>
            
            <div className="flex space-x-2">
              <Button 
                variant="outline" 
                onClick={validateData}
                disabled={state.isValidating}
              >
                <CheckCircle className="h-4 w-4 mr-1" />
                Neu validieren
              </Button>
              <Button 
                onClick={handleImport}
                disabled={state.isValidating || (state.validationResult && !state.validationResult.valid)}
                className="bg-green-600 hover:bg-green-700"
              >
                <CheckCircle className="h-4 w-4 mr-1" />
                {state.isValidating ? 'Importiere...' : 'Importieren'}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}