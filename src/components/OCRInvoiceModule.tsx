import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScanText, Upload, CheckCircle, AlertCircle, FileText, Users } from 'lucide-react';
import { EnhancedOCRUploadZone } from './EnhancedOCRUploadZone';
import { EnhancedOCRValidator } from './EnhancedOCRValidator';
import { useToast } from '@/hooks/use-toast';

// Mock data for demonstration
const mockInvoices = [
  {
    id: '1',
    supplierName: 'Bau-Max GmbH',
    invoiceNumber: 'RE-2024-001',
    date: '2024-08-30',
    amount: 1247.50,
    status: 'pending' as const,
    confidence: 0.92
  },
  {
    id: '2', 
    supplierName: 'Elektro Schmidt',
    invoiceNumber: 'ESM-2024-445',
    date: '2024-08-29',
    amount: 524.30,
    status: 'approved' as const,
    confidence: 0.98
  },
  {
    id: '3',
    supplierName: 'Heizung & Sanitär Müller',
    invoiceNumber: 'HSM-024-789',
    date: '2024-08-28',
    amount: 2150.00,
    status: 'validated' as const,
    confidence: 0.87
  }
];

interface OCRResult {
  id: string;
  originalFilename: string;
  status: 'processing' | 'validated' | 'error';
  structuredData?: any;
  confidence?: number;
  createdAt: string;
}

export function OCRInvoiceModule() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState('upload');
  const [ocrResults, setOcrResults] = useState<OCRResult[]>([]);
  const [selectedResult, setSelectedResult] = useState<OCRResult | null>(null);

  const handleFileProcessed = (result: OCRResult) => {
    setOcrResults(prev => [...prev, result]);
    toast({
      title: 'OCR verarbeitet',
      description: `Rechnung ${result.originalFilename} wurde erfolgreich verarbeitet.`
    });
    
    // Switch to validation tab
    setActiveTab('validate');
  };

  const handleValidationComplete = (validatedData: any) => {
    toast({
      title: 'Rechnung validiert',
      description: 'Die Rechnung wurde erfolgreich validiert und kann importiert werden.'
    });
    
    // Switch to results tab
    setActiveTab('results');
  };

  const getStatusBadge = (status: string, confidence?: number) => {
    switch (status) {
      case 'processing':
        return <Badge variant="secondary" className="bg-blue-100 text-blue-800">Verarbeitung</Badge>;
      case 'validated':
        return <Badge variant="secondary" className="bg-green-100 text-green-800">Validiert</Badge>;
      case 'approved':
        return <Badge variant="secondary" className="bg-emerald-100 text-emerald-800">Genehmigt</Badge>;
      case 'pending':
        return <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">Wartend</Badge>;
      case 'error':
        return <Badge variant="destructive">Fehler</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/20">
            <ScanText className="h-6 w-6 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">
              OCR Rechnungserfassung
            </h1>
            <p className="text-gray-500 dark:text-gray-400">
              Automatische Erkennung und Verarbeitung von Lieferantenrechnungen
            </p>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="flex gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
              {mockInvoices.length}
            </div>
            <div className="text-sm text-gray-500 dark:text-gray-400">
              Heute verarbeitet
            </div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-green-600 dark:text-green-400">
              {mockInvoices.filter(i => i.status === 'approved').length}
            </div>
            <div className="text-sm text-gray-500 dark:text-gray-400">
              Genehmigt
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="upload" className="flex items-center gap-2">
            <Upload className="h-4 w-4" />
            Upload
          </TabsTrigger>
          <TabsTrigger value="validate" className="flex items-center gap-2">
            <CheckCircle className="h-4 w-4" />
            Validierung
          </TabsTrigger>
          <TabsTrigger value="results" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Ergebnisse
          </TabsTrigger>
          <TabsTrigger value="suppliers" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            Lieferanten
          </TabsTrigger>
        </TabsList>

        {/* Upload Tab */}
        <TabsContent value="upload" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Upload className="h-5 w-5" />
                Rechnungen hochladen
              </CardTitle>
            </CardHeader>
            <CardContent>
              <EnhancedOCRUploadZone 
                onFileProcessed={handleFileProcessed}
                maxFiles={5}
                acceptedTypes={['.pdf', '.jpg', '.jpeg', '.png']}
              />
            </CardContent>
          </Card>

          {/* Recent OCR Results */}
          {ocrResults.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Zuletzt verarbeitet</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {ocrResults.slice(-3).map((result) => (
                    <div key={result.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center gap-3">
                        <FileText className="h-5 w-5 text-blue-500" />
                        <div>
                          <div className="font-medium">{result.originalFilename}</div>
                          <div className="text-sm text-gray-500">
                            {new Date(result.createdAt).toLocaleString('de-DE')}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {result.confidence && (
                          <Badge variant="outline" className="text-xs">
                            {Math.round(result.confidence * 100)}% Vertrauen
                          </Badge>
                        )}
                        {getStatusBadge(result.status, result.confidence)}
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setSelectedResult(result);
                            setActiveTab('validate');
                          }}
                        >
                          Bearbeiten
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Validation Tab */}
        <TabsContent value="validate" className="space-y-6">
          {selectedResult ? (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CheckCircle className="h-5 w-5" />
                  Rechnung validieren: {selectedResult.originalFilename}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <EnhancedOCRValidator
                  ocrResult={selectedResult}
                  onValidationComplete={handleValidationComplete}
                  onCancel={() => setSelectedResult(null)}
                />
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="text-center py-12">
                <AlertCircle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                  Keine Rechnung zur Validierung ausgewählt
                </h3>
                <p className="text-gray-500 dark:text-gray-400 mb-4">
                  Laden Sie zuerst eine Rechnung hoch oder wählen Sie eine aus den Ergebnissen aus.
                </p>
                <Button onClick={() => setActiveTab('upload')}>
                  Rechnung hochladen
                </Button>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Results Tab */}
        <TabsContent value="results" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Verarbeitete Rechnungen
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {mockInvoices.map((invoice) => (
                  <div key={invoice.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                    <div className="flex items-center gap-4">
                      <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/20">
                        <FileText className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                      </div>
                      <div>
                        <div className="font-medium text-gray-900 dark:text-white">
                          {invoice.supplierName}
                        </div>
                        <div className="text-sm text-gray-500 dark:text-gray-400">
                          {invoice.invoiceNumber} • {invoice.date}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <div className="font-semibold text-gray-900 dark:text-white">
                          {invoice.amount.toLocaleString('de-DE', { 
                            style: 'currency', 
                            currency: 'EUR' 
                          })}
                        </div>
                        <div className="text-sm text-gray-500 dark:text-gray-400">
                          {Math.round(invoice.confidence * 100)}% Vertrauen
                        </div>
                      </div>
                      {getStatusBadge(invoice.status, invoice.confidence)}
                      <Button size="sm" variant="outline">
                        Details
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Suppliers Tab */}
        <TabsContent value="suppliers" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Lieferanten-Matching
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center py-12">
                <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                  Lieferanten-Verwaltung
                </h3>
                <p className="text-gray-500 dark:text-gray-400 mb-4">
                  Hier können Sie die automatische Lieferanten-Zuordnung verwalten und neue Lieferanten hinzufügen.
                </p>
                <Button variant="outline">
                  Lieferanten verwalten
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}