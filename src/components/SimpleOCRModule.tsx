import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScanText, Upload, FileText, CheckCircle, AlertCircle, Edit3 } from 'lucide-react';
import { SimpleOCRUploadZone } from './SimpleOCRUploadZone';
import { useToast } from '@/hooks/use-toast';

interface SimpleOCRResult {
  id: string;
  filename: string;
  text: string;
  confidence: number;
  status: 'processing' | 'completed' | 'error';
  structuredData?: {
    invoiceNumber?: string;
    supplier?: string;
    date?: string;
    amount?: string;
  };
}

export function SimpleOCRModule() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState('upload');
  const [ocrResults, setOcrResults] = useState<SimpleOCRResult[]>([]);
  const [selectedResult, setSelectedResult] = useState<SimpleOCRResult | null>(null);
  const [editedData, setEditedData] = useState<SimpleOCRResult['structuredData']>({});

  const handleOCRComplete = (result: SimpleOCRResult) => {
    setOcrResults(prev => {
      const existingIndex = prev.findIndex(r => r.id === result.id);
      if (existingIndex >= 0) {
        const newResults = [...prev];
        newResults[existingIndex] = result;
        return newResults;
      }
      return [...prev, result];
    });

    // Switch to results tab when OCR completes
    if (result.status === 'completed') {
      setActiveTab('results');
    }
  };

  const handleEditResult = (result: SimpleOCRResult) => {
    setSelectedResult(result);
    setEditedData(result.structuredData || {});
    setActiveTab('edit');
  };

  const handleSaveEdit = () => {
    if (!selectedResult) return;

    const updatedResult = {
      ...selectedResult,
      structuredData: editedData
    };

    setOcrResults(prev => 
      prev.map(r => r.id === selectedResult.id ? updatedResult : r)
    );

    toast({
      title: 'Änderungen gespeichert',
      description: 'Die OCR-Daten wurden erfolgreich aktualisiert.'
    });

    setActiveTab('results');
    setSelectedResult(null);
  };

  const getStatusBadge = (status: string, confidence?: number) => {
    switch (status) {
      case 'processing':
        return <Badge variant="secondary" className="bg-blue-100 text-blue-800">Verarbeitung</Badge>;
      case 'completed':
        return <Badge variant="secondary" className="bg-green-100 text-green-800">Fertig</Badge>;
      case 'error':
        return <Badge variant="destructive">Fehler</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 90) return 'text-green-600';
    if (confidence >= 70) return 'text-yellow-600';
    return 'text-red-600';
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
              OCR Rechnungserfassung (Vereinfacht)
            </h1>
            <p className="text-gray-500 dark:text-gray-400">
              Lokale OCR-Verarbeitung mit Tesseract.js - Keine Datenbankverbindung erforderlich
            </p>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="flex gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
              {ocrResults.length}
            </div>
            <div className="text-sm text-gray-500 dark:text-gray-400">
              Verarbeitet
            </div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-green-600 dark:text-green-400">
              {ocrResults.filter(r => r.status === 'completed' && r.confidence >= 80).length}
            </div>
            <div className="text-sm text-gray-500 dark:text-gray-400">
              Hohe Qualität
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="upload" className="flex items-center gap-2">
            <Upload className="h-4 w-4" />
            Upload
          </TabsTrigger>
          <TabsTrigger value="results" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Ergebnisse ({ocrResults.length})
          </TabsTrigger>
          <TabsTrigger value="edit" className="flex items-center gap-2" disabled={!selectedResult}>
            <Edit3 className="h-4 w-4" />
            Bearbeiten
          </TabsTrigger>
        </TabsList>

        {/* Upload Tab */}
        <TabsContent value="upload" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Upload className="h-5 w-5" />
                Rechnungen hochladen & verarbeiten
              </CardTitle>
            </CardHeader>
            <CardContent>
              <SimpleOCRUploadZone 
                onOCRComplete={handleOCRComplete}
                maxFiles={5}
              />
            </CardContent>
          </Card>

          {/* Instructions */}
          <Card>
            <CardHeader>
              <CardTitle>Anleitung</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
                <p>• Unterstützte Formate: PDF, JPG, PNG (max. 10MB)</p>
                <p>• OCR läuft komplett im Browser (keine Serververbindung nötig)</p>
                <p>• Deutsche Texterkennung ist aktiviert</p>
                <p>• Automatische Extraktion von Rechnungsnummer, Lieferant, Datum und Betrag</p>
                <p>• Nach dem Upload können Sie die Ergebnisse im "Ergebnisse"-Tab bearbeiten</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Results Tab */}
        <TabsContent value="results" className="space-y-6">
          {ocrResults.length === 0 ? (
            <Card>
              <CardContent className="text-center py-12">
                <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                  Noch keine OCR-Ergebnisse
                </h3>
                <p className="text-gray-500 dark:text-gray-400 mb-4">
                  Laden Sie zuerst eine Rechnung hoch, um OCR-Ergebnisse zu sehen.
                </p>
                <Button onClick={() => setActiveTab('upload')}>
                  Rechnung hochladen
                </Button>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  OCR Ergebnisse
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {ocrResults.map((result) => (
                    <div key={result.id} className="border rounded-lg p-4 space-y-3">
                      {/* Header */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/20">
                            <FileText className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                          </div>
                          <div>
                            <div className="font-medium text-gray-900 dark:text-white">
                              {result.filename}
                            </div>
                            <div className="text-sm text-gray-500 dark:text-gray-400">
                              {result.status === 'completed' && (
                                <span className={getConfidenceColor(result.confidence)}>
                                  {result.confidence}% Genauigkeit
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-2">
                          {getStatusBadge(result.status, result.confidence)}
                          {result.status === 'completed' && (
                            <Button 
                              size="sm" 
                              variant="outline"
                              onClick={() => handleEditResult(result)}
                            >
                              Bearbeiten
                            </Button>
                          )}
                        </div>
                      </div>

                      {/* Structured Data */}
                      {result.structuredData && result.status === 'completed' && (
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
                          <div>
                            <Label className="text-xs text-gray-500">Lieferant</Label>
                            <div className="font-medium truncate">
                              {result.structuredData.supplier || '—'}
                            </div>
                          </div>
                          <div>
                            <Label className="text-xs text-gray-500">Rechnungsnr.</Label>
                            <div className="font-medium">
                              {result.structuredData.invoiceNumber || '—'}
                            </div>
                          </div>
                          <div>
                            <Label className="text-xs text-gray-500">Datum</Label>
                            <div className="font-medium">
                              {result.structuredData.date || '—'}
                            </div>
                          </div>
                          <div>
                            <Label className="text-xs text-gray-500">Betrag</Label>
                            <div className="font-medium">
                              {result.structuredData.amount || '—'}
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Raw Text Preview */}
                      {result.text && result.status === 'completed' && (
                        <details className="text-sm">
                          <summary className="cursor-pointer text-gray-500 hover:text-gray-700">
                            Vollständiger OCR-Text anzeigen ({result.text.length} Zeichen)
                          </summary>
                          <div className="mt-2 p-3 bg-gray-100 dark:bg-gray-800 rounded text-xs font-mono whitespace-pre-wrap max-h-40 overflow-y-auto">
                            {result.text}
                          </div>
                        </details>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Edit Tab */}
        <TabsContent value="edit" className="space-y-6">
          {selectedResult ? (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Edit3 className="h-5 w-5" />
                  OCR-Daten bearbeiten: {selectedResult.filename}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="supplier">Lieferant</Label>
                      <Input
                        id="supplier"
                        value={editedData.supplier || ''}
                        onChange={(e) => setEditedData(prev => ({ ...prev, supplier: e.target.value }))}
                        placeholder="Lieferantenname"
                      />
                    </div>
                    
                    <div>
                      <Label htmlFor="invoiceNumber">Rechnungsnummer</Label>
                      <Input
                        id="invoiceNumber"
                        value={editedData.invoiceNumber || ''}
                        onChange={(e) => setEditedData(prev => ({ ...prev, invoiceNumber: e.target.value }))}
                        placeholder="RE-2024-001"
                      />
                    </div>
                  </div>
                  
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="date">Rechnungsdatum</Label>
                      <Input
                        id="date"
                        value={editedData.date || ''}
                        onChange={(e) => setEditedData(prev => ({ ...prev, date: e.target.value }))}
                        placeholder="01.08.2024"
                      />
                    </div>
                    
                    <div>
                      <Label htmlFor="amount">Betrag</Label>
                      <Input
                        id="amount"
                        value={editedData.amount || ''}
                        onChange={(e) => setEditedData(prev => ({ ...prev, amount: e.target.value }))}
                        placeholder="1.247,50"
                      />
                    </div>
                  </div>
                </div>

                <div className="flex gap-2 mt-6">
                  <Button onClick={handleSaveEdit}>
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Änderungen speichern
                  </Button>
                  <Button 
                    variant="outline" 
                    onClick={() => {
                      setActiveTab('results');
                      setSelectedResult(null);
                    }}
                  >
                    Abbrechen
                  </Button>
                </div>

                {/* Original Text Reference */}
                {selectedResult.text && (
                  <details className="mt-6 text-sm">
                    <summary className="cursor-pointer text-gray-500 hover:text-gray-700">
                      Original OCR-Text als Referenz anzeigen
                    </summary>
                    <div className="mt-2 p-3 bg-gray-100 dark:bg-gray-800 rounded text-xs font-mono whitespace-pre-wrap max-h-40 overflow-y-auto">
                      {selectedResult.text}
                    </div>
                  </details>
                )}
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="text-center py-12">
                <AlertCircle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                  Kein OCR-Ergebnis ausgewählt
                </h3>
                <p className="text-gray-500 dark:text-gray-400 mb-4">
                  Wählen Sie ein Ergebnis aus der Liste, um es zu bearbeiten.
                </p>
                <Button onClick={() => setActiveTab('results')}>
                  Zu den Ergebnissen
                </Button>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}