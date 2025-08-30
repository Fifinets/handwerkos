// Enhanced OCR Upload Zone with Pipeline Integration
import React, { useState, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Upload, 
  FileCheck, 
  AlertTriangle, 
  CheckCircle, 
  Clock, 
  X,
  Eye,
  FileText
} from 'lucide-react';
import { OCRPipelineService, PipelineStatus, PipelineImportResult } from '@/services/ocrPipelineService';
import { useToast } from '@/hooks/use-toast';

interface EnhancedOCRUploadZoneProps {
  onInvoiceImported?: (result: PipelineImportResult) => void;
  onError?: (error: string) => void;
  autoApprove?: boolean;
  maxFileSize?: number; // MB
  acceptedTypes?: string[];
}

interface ProcessingState {
  isProcessing: boolean;
  status: PipelineStatus | null;
  result: PipelineImportResult | null;
  error: string | null;
}

export function EnhancedOCRUploadZone({
  onInvoiceImported,
  onError,
  autoApprove = false,
  maxFileSize = 10,
  acceptedTypes = ['.jpg', '.jpeg', '.png', '.pdf']
}: EnhancedOCRUploadZoneProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [processing, setProcessing] = useState<ProcessingState>({
    isProcessing: false,
    status: null,
    result: null,
    error: null
  });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  
  const { toast } = useToast();

  const resetState = useCallback(() => {
    setProcessing({
      isProcessing: false,
      status: null,
      result: null,
      error: null
    });
    setSelectedFile(null);
    setPreviewUrl(null);
  }, []);

  const validateFile = useCallback((file: File): string | null => {
    // Check file size
    if (file.size > maxFileSize * 1024 * 1024) {
      return `Datei zu groß. Maximum: ${maxFileSize}MB`;
    }

    // Check file type
    const fileExtension = '.' + file.name.split('.').pop()?.toLowerCase();
    if (!acceptedTypes.includes(fileExtension)) {
      return `Dateityp nicht unterstützt. Erlaubt: ${acceptedTypes.join(', ')}`;
    }

    return null;
  }, [maxFileSize, acceptedTypes]);

  const handleFile = useCallback(async (file: File) => {
    const validationError = validateFile(file);
    if (validationError) {
      setProcessing(prev => ({ ...prev, error: validationError }));
      onError?.(validationError);
      return;
    }

    setSelectedFile(file);
    
    // Create preview for images
    if (file.type.startsWith('image/')) {
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
    }

    setProcessing({
      isProcessing: true,
      status: null,
      result: null,
      error: null
    });

    try {
      const result = await OCRPipelineService.processInvoiceComplete(
        file,
        autoApprove,
        (status: PipelineStatus) => {
          setProcessing(prev => ({ ...prev, status }));
        }
      );

      setProcessing(prev => ({ 
        ...prev, 
        isProcessing: false, 
        result 
      }));

      if (result.success) {
        toast({
          title: 'Rechnung erfolgreich verarbeitet',
          description: `Rechnung ${result.invoice_id} wurde importiert`,
        });
        onInvoiceImported?.(result);
      } else {
        toast({
          title: 'Verarbeitung fehlgeschlagen',
          description: result.error || 'Unbekannter Fehler',
          variant: 'destructive'
        });
        onError?.(result.error || 'Unknown error');
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unbekannter Fehler';
      setProcessing(prev => ({ 
        ...prev, 
        isProcessing: false, 
        error: errorMessage 
      }));
      toast({
        title: 'Verarbeitungsfehler',
        description: errorMessage,
        variant: 'destructive'
      });
      onError?.(errorMessage);
    }
  }, [validateFile, autoApprove, onInvoiceImported, onError, toast]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      handleFile(files[0]);
    }
  }, [handleFile]);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleFile(files[0]);
    }
  }, [handleFile]);

  const getStatusColor = (stage: string) => {
    switch (stage) {
      case 'complete': return 'bg-green-500';
      case 'error': return 'bg-red-500';
      case 'validation': return 'bg-yellow-500';
      default: return 'bg-blue-500';
    }
  };

  const getStatusIcon = (stage: string) => {
    switch (stage) {
      case 'complete': return <CheckCircle className="h-4 w-4" />;
      case 'error': return <AlertTriangle className="h-4 w-4" />;
      case 'validation': return <FileCheck className="h-4 w-4" />;
      default: return <Clock className="h-4 w-4" />;
    }
  };

  return (
    <div className="space-y-4">
      {!processing.isProcessing && !processing.result ? (
        <Card 
          className={`transition-all duration-200 ${
            isDragOver 
              ? 'border-blue-500 bg-blue-50' 
              : 'border-dashed border-2 border-gray-300 hover:border-gray-400'
          }`}
          onDrop={handleDrop}
          onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
          onDragLeave={() => setIsDragOver(false)}
        >
          <CardContent className="p-8">
            <div className="text-center space-y-4">
              <div className="mx-auto w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center">
                <Upload className="h-8 w-8 text-blue-600" />
              </div>
              
              <div>
                <h3 className="text-lg font-semibold mb-2">
                  Rechnung hochladen
                </h3>
                <p className="text-gray-600 mb-4">
                  Ziehen Sie eine Rechnungs-Datei hierher oder klicken Sie zum Auswählen
                </p>
              </div>

              <input
                type="file"
                accept={acceptedTypes.join(',')}
                onChange={handleFileInput}
                className="hidden"
                id="file-upload"
              />
              
              <Button asChild className="bg-blue-600 hover:bg-blue-700">
                <label htmlFor="file-upload" className="cursor-pointer">
                  <FileText className="h-4 w-4 mr-2" />
                  Datei auswählen
                </label>
              </Button>

              <div className="text-xs text-gray-500 space-y-1">
                <p>Unterstützte Formate: {acceptedTypes.join(', ')}</p>
                <p>Maximale Größe: {maxFileSize}MB</p>
                {autoApprove && (
                  <Badge variant="outline" className="bg-green-50 text-green-700">
                    Auto-Genehmigung aktiviert
                  </Badge>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {/* Processing Status */}
      {processing.isProcessing && processing.status && (
        <Card>
          <CardContent className="p-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className={`w-3 h-3 rounded-full ${getStatusColor(processing.status.stage)} animate-pulse`} />
                  <span className="font-medium">
                    {processing.status.message}
                  </span>
                  {getStatusIcon(processing.status.stage)}
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={resetState}
                  className="text-gray-500 hover:text-gray-700"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>

              <Progress value={processing.status.progress} className="h-2" />

              <div className="flex items-center justify-between text-sm text-gray-600">
                <span>Stadium: {processing.status.stage}</span>
                <span>{processing.status.progress}%</span>
              </div>

              {/* File Preview */}
              {selectedFile && (
                <div className="border rounded-lg p-3 bg-gray-50">
                  <div className="flex items-center space-x-3">
                    <FileText className="h-5 w-5 text-gray-500" />
                    <div className="flex-1">
                      <p className="font-medium">{selectedFile.name}</p>
                      <p className="text-xs text-gray-500">
                        {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                      </p>
                    </div>
                    {previewUrl && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => window.open(previewUrl, '_blank')}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Success Result */}
      {processing.result?.success && (
        <Card className="border-green-200 bg-green-50">
          <CardContent className="p-6">
            <div className="flex items-start space-x-3">
              <CheckCircle className="h-6 w-6 text-green-600 mt-0.5" />
              <div className="flex-1">
                <h3 className="font-semibold text-green-900 mb-2">
                  Rechnung erfolgreich importiert
                </h3>
                
                <div className="space-y-2 text-sm">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <span className="text-gray-600">Rechnungs-ID:</span>
                      <span className="ml-2 font-mono">{processing.result.invoice_id}</span>
                    </div>
                    <div>
                      <span className="text-gray-600">Lieferant:</span>
                      <span className="ml-2">{processing.result.supplier_id}</span>
                    </div>
                  </div>

                  {processing.result.supplier_was_created && (
                    <Badge variant="outline" className="bg-blue-50 text-blue-700">
                      Neuer Lieferant erstellt
                    </Badge>
                  )}

                  {processing.result.duplicate_warnings && processing.result.duplicate_warnings.length > 0 && (
                    <Alert className="bg-yellow-50 border-yellow-200">
                      <AlertTriangle className="h-4 w-4" />
                      <AlertDescription>
                        <strong>Duplikat-Warnung:</strong> {processing.result.duplicate_warnings.length} 
                        ähnliche Rechnung(en) gefunden
                      </AlertDescription>
                    </Alert>
                  )}
                </div>

                <div className="flex space-x-2 mt-4">
                  <Button size="sm" onClick={resetState}>
                    Weitere Rechnung verarbeiten
                  </Button>
                  {processing.result.invoice_id && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        // Navigate to invoice details
                        console.log('Navigate to invoice:', processing.result?.invoice_id);
                      }}
                    >
                      Details anzeigen
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Error State */}
      {processing.error && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription className="flex items-center justify-between">
            <span>{processing.error}</span>
            <Button variant="outline" size="sm" onClick={resetState}>
              Erneut versuchen
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* Image Preview */}
      {previewUrl && !processing.isProcessing && (
        <Card>
          <CardContent className="p-4">
            <div className="text-center">
              <img
                src={previewUrl}
                alt="Rechnungsvorschau"
                className="max-w-full max-h-64 mx-auto rounded-lg border"
                onLoad={() => URL.revokeObjectURL(previewUrl)}
              />
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}