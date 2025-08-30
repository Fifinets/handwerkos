import React, { useState, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Upload, FileText, AlertCircle, CheckCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import Tesseract from 'tesseract.js';

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

interface SimpleOCRUploadZoneProps {
  onOCRComplete?: (result: SimpleOCRResult) => void;
  maxFiles?: number;
}

export function SimpleOCRUploadZone({ onOCRComplete, maxFiles = 3 }: SimpleOCRUploadZoneProps) {
  const { toast } = useToast();
  const [dragActive, setDragActive] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentFile, setCurrentFile] = useState<string>('');
  const [results, setResults] = useState<SimpleOCRResult[]>([]);

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFiles(Array.from(e.dataTransfer.files));
    }
  }, []);

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      handleFiles(Array.from(e.target.files));
    }
  };

  const extractStructuredData = (text: string): SimpleOCRResult['structuredData'] => {
    const lines = text.split('\n').map(line => line.trim()).filter(Boolean);
    
    let invoiceNumber = '';
    let supplier = '';
    let date = '';
    let amount = '';

    // Simple pattern matching for German invoices
    for (const line of lines) {
      // Invoice number patterns
      if (!invoiceNumber && /(?:rechnung|invoice|rg[\.\-]?\s*nr|nr[\.\-]?\s*\d)/i.test(line)) {
        const match = line.match(/(?:rechnung|invoice|rg|nr)[\.\-\s]*(\w+[\-\/]?\d+)/i);
        if (match) invoiceNumber = match[1];
      }
      
      // Date patterns (German format)
      if (!date && /\d{1,2}[\.\-\/]\d{1,2}[\.\-\/]\d{4}/.test(line)) {
        const match = line.match(/(\d{1,2}[\.\-\/]\d{1,2}[\.\-\/]\d{4})/);
        if (match) date = match[1];
      }
      
      // Amount patterns (Euro)
      if (!amount && /\d+[,\.]\d{2}\s*€?/.test(line)) {
        const match = line.match(/(\d+[,\.]\d{2})\s*€?/);
        if (match) amount = match[1];
      }
      
      // Supplier (first meaningful line, often company name)
      if (!supplier && line.length > 5 && /[a-zA-Z].*[a-zA-Z]/.test(line) && 
          !/(datum|date|betrag|amount|rechnung|invoice)/i.test(line)) {
        supplier = line;
      }
    }

    return {
      invoiceNumber: invoiceNumber || undefined,
      supplier: supplier || undefined,
      date: date || undefined,
      amount: amount || undefined
    };
  };

  const handleFiles = async (files: File[]) => {
    if (processing) return;

    const validFiles = files.filter(file => {
      const isValidType = ['image/jpeg', 'image/jpg', 'image/png', 'application/pdf'].includes(file.type);
      const isValidSize = file.size <= 10 * 1024 * 1024; // 10MB
      
      if (!isValidType) {
        toast({
          title: 'Ungültiger Dateityp',
          description: 'Nur PDF, JPG und PNG Dateien sind erlaubt.',
          variant: 'destructive'
        });
        return false;
      }
      
      if (!isValidSize) {
        toast({
          title: 'Datei zu groß',
          description: 'Maximale Dateigröße: 10MB',
          variant: 'destructive'
        });
        return false;
      }
      
      return true;
    });

    if (validFiles.length === 0) return;

    setProcessing(true);
    setProgress(0);

    for (const file of validFiles.slice(0, maxFiles)) {
      try {
        setCurrentFile(file.name);
        
        const result: SimpleOCRResult = {
          id: `ocr_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          filename: file.name,
          text: '',
          confidence: 0,
          status: 'processing'
        };

        setResults(prev => [...prev, result]);

        // OCR with Tesseract
        const { data: { text, confidence } } = await Tesseract.recognize(
          file,
          'deu',
          {
            logger: m => {
              if (m.status === 'recognizing text') {
                const progressPercent = Math.round(m.progress * 100);
                setProgress(progressPercent);
              }
            }
          }
        );

        const structuredData = extractStructuredData(text);

        const completedResult: SimpleOCRResult = {
          ...result,
          text,
          confidence: Math.round(confidence),
          status: 'completed',
          structuredData
        };

        setResults(prev => 
          prev.map(r => r.id === result.id ? completedResult : r)
        );

        onOCRComplete?.(completedResult);

        toast({
          title: 'OCR erfolgreich',
          description: `${file.name} wurde verarbeitet (${Math.round(confidence)}% Genauigkeit)`,
        });

      } catch (error) {
        console.error('OCR Error:', error);
        
        const errorResult: SimpleOCRResult = {
          id: `error_${Date.now()}`,
          filename: file.name,
          text: '',
          confidence: 0,
          status: 'error'
        };

        setResults(prev => [...prev, errorResult]);

        toast({
          title: 'OCR Fehler',
          description: `Fehler beim Verarbeiten von ${file.name}`,
          variant: 'destructive'
        });
      }
    }

    setProcessing(false);
    setProgress(0);
    setCurrentFile('');
  };

  return (
    <div className="space-y-6">
      {/* Upload Zone */}
      <Card
        className={`border-2 border-dashed transition-all duration-200 ${
          dragActive 
            ? 'border-blue-400 bg-blue-50 dark:bg-blue-950/20' 
            : 'border-gray-300 dark:border-gray-600 hover:border-gray-400'
        } ${processing ? 'pointer-events-none opacity-50' : ''}`}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
      >
        <CardContent className="p-8">
          <div className="flex flex-col items-center justify-center text-center space-y-4">
            <div className="p-4 rounded-full bg-gray-100 dark:bg-gray-800">
              <Upload className="h-8 w-8 text-gray-400" />
            </div>
            
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Rechnungen hochladen
              </h3>
              <p className="text-gray-500 dark:text-gray-400 mt-1">
                Drag & Drop oder klicken Sie zum Auswählen
              </p>
            </div>

            <div className="flex flex-wrap gap-2 justify-center">
              <Badge variant="secondary">PDF</Badge>
              <Badge variant="secondary">JPG</Badge>
              <Badge variant="secondary">PNG</Badge>
              <Badge variant="secondary">Max 10MB</Badge>
            </div>

            <Button
              variant="outline"
              onClick={() => document.getElementById('file-upload')?.click()}
              disabled={processing}
            >
              Dateien auswählen
            </Button>

            <input
              id="file-upload"
              type="file"
              multiple
              accept=".pdf,.jpg,.jpeg,.png"
              onChange={handleFileInput}
              className="hidden"
            />
          </div>
        </CardContent>
      </Card>

      {/* Progress */}
      {processing && (
        <Card>
          <CardContent className="p-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span>Verarbeite: {currentFile}</span>
                <span>{progress}%</span>
              </div>
              <Progress value={progress} />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Results */}
      {results.length > 0 && (
        <Card>
          <CardContent className="p-4">
            <h4 className="font-semibold mb-3">OCR Ergebnisse</h4>
            <div className="space-y-3">
              {results.map((result) => (
                <div 
                  key={result.id} 
                  className="flex items-center justify-between p-3 border rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/20">
                      <FileText className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div>
                      <div className="font-medium">{result.filename}</div>
                      {result.structuredData?.supplier && (
                        <div className="text-sm text-gray-500">
                          {result.structuredData.supplier}
                          {result.structuredData.invoiceNumber && ` • ${result.structuredData.invoiceNumber}`}
                          {result.structuredData.amount && ` • ${result.structuredData.amount}`}
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    {result.status === 'completed' && (
                      <Badge variant="outline" className="text-xs">
                        {result.confidence}% Genauigkeit
                      </Badge>
                    )}
                    
                    {result.status === 'processing' && (
                      <Badge variant="secondary">
                        <div className="animate-spin h-3 w-3 border border-current border-t-transparent rounded-full mr-1" />
                        Verarbeitung
                      </Badge>
                    )}
                    
                    {result.status === 'completed' && (
                      <Badge variant="secondary" className="bg-green-100 text-green-800">
                        <CheckCircle className="h-3 w-3 mr-1" />
                        Fertig
                      </Badge>
                    )}
                    
                    {result.status === 'error' && (
                      <Badge variant="destructive">
                        <AlertCircle className="h-3 w-3 mr-1" />
                        Fehler
                      </Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}