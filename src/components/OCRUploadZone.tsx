import React, { useCallback, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Upload, 
  FileText, 
  X, 
  AlertCircle, 
  CheckCircle,
  Camera,
  Scan,
  Sparkles
} from 'lucide-react';
import { useProcessInvoiceOCR } from '@/hooks/useApi';
import { OCRResult } from '@/services/ocrService';
import { isOpenAIConfigured } from '../services/openaiService';

interface OCRUploadZoneProps {
  onOCRComplete?: (result: OCRResult) => void;
  onError?: (error: string) => void;
  className?: string;
  accept?: string;
  maxSize?: number; // in MB
}

export function OCRUploadZone({ 
  onOCRComplete, 
  onError, 
  className = '',
  accept = 'image/*,.pdf',
  maxSize = 10
}: OCRUploadZoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);

  const processMutation = useProcessInvoiceOCR({
    onSuccess: (result) => {
      setSelectedFile(null);
      setUploadProgress(0);
      onOCRComplete?.(result);
    },
    onError: (error) => {
      setSelectedFile(null);
      setUploadProgress(0);
      onError?.(error.message);
    }
  });

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      handleFileSelection(files[0]);
    }
  }, []);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleFileSelection(files[0]);
    }
    // Reset input
    e.target.value = '';
  }, []);

  const handleFileSelection = useCallback((file: File) => {
    // Validiere Dateityp
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/bmp', 'image/webp', 'application/pdf'];
    if (!allowedTypes.includes(file.type)) {
      onError?.('Nur Bilddateien (JPEG, PNG, GIF, BMP, WebP) und PDF-Dateien sind erlaubt.');
      return;
    }

    // Validiere Dateigröße
    const fileSizeMB = file.size / (1024 * 1024);
    if (fileSizeMB > maxSize) {
      onError?.(`Datei zu groß. Maximale Größe: ${maxSize}MB`);
      return;
    }

    setSelectedFile(file);
  }, [maxSize, onError]);

  const handleProcessFile = useCallback(async () => {
    if (!selectedFile) return;

    try {
      setUploadProgress(25);
      console.log('Starting OCR processing for:', selectedFile.name);
      await processMutation.mutateAsync(selectedFile);
    } catch (error) {
      console.error('OCR processing failed:', error);
      onError?.(error instanceof Error ? error.message : 'OCR-Verarbeitung fehlgeschlagen');
      setSelectedFile(null);
      setUploadProgress(0);
    }
  }, [selectedFile, processMutation, onError]);

  const handleCancelFile = useCallback(() => {
    setSelectedFile(null);
    setUploadProgress(0);
  }, []);

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getFileTypeIcon = (file: File) => {
    if (file.type.startsWith('image/')) {
      return <Camera className="h-8 w-8 text-blue-500" />;
    }
    if (file.type === 'application/pdf') {
      return <FileText className="h-8 w-8 text-red-500" />;
    }
    return <FileText className="h-8 w-8 text-gray-500" />;
  };

  if (selectedFile && !processMutation.isPending) {
    // Datei ausgewählt - Vorschau und Bestätigung
    return (
      <Card className={className}>
        <CardContent className="p-6">
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              {getFileTypeIcon(selectedFile)}
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate">{selectedFile.name}</p>
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  <span>{formatFileSize(selectedFile.size)}</span>
                  <span>{selectedFile.type}</span>
                  <Badge variant="outline">Bereit für OCR</Badge>
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleCancelFile}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            <Alert>
              <Scan className="h-4 w-4" />
              <AlertDescription>
                Die Datei wird mit OCR verarbeitet und automatisch in deutsche Rechnung 
                konvertiert. Dieser Vorgang kann 10-30 Sekunden dauern.
              </AlertDescription>
            </Alert>

            <div className="flex gap-2">
              <Button
                onClick={handleProcessFile}
                disabled={processMutation.isPending}
                className="flex-1"
              >
                <Scan className="mr-2 h-4 w-4" />
                OCR starten
              </Button>
              <Button
                variant="outline"
                onClick={handleCancelFile}
              >
                Abbrechen
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (processMutation.isPending) {
    // OCR in Bearbeitung
    return (
      <Card className={className}>
        <CardContent className="p-6">
          <div className="space-y-4">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
              <h3 className="font-medium">OCR-Verarbeitung läuft...</h3>
              <p className="text-sm text-muted-foreground">
                Rechnung wird analysiert und Daten extrahiert
              </p>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Fortschritt</span>
                <span>{Math.round(uploadProgress)}%</span>
              </div>
              <Progress value={uploadProgress} className="h-2" />
            </div>

            <div className="bg-muted/50 rounded-lg p-3">
              <div className="flex items-center gap-2 text-sm">
                <CheckCircle className="h-4 w-4 text-green-500" />
                <span>Datei hochgeladen</span>
              </div>
              <div className="flex items-center gap-2 text-sm mt-1">
                <div className="animate-spin rounded-full h-3 w-3 border-b border-primary"></div>
                <span>Tesseract OCR läuft...</span>
              </div>
            </div>

            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Bitte warten Sie, bis die Verarbeitung abgeschlossen ist. 
                Bei komplexen Dokumenten kann dies länger dauern.
              </AlertDescription>
            </Alert>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Upload Zone
  return (
    <Card 
      className={`transition-colors ${isDragging ? 'border-primary bg-primary/5' : 'border-dashed'} ${className}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <CardContent className="p-8">
        <div className="text-center space-y-4">
          <div className="mx-auto w-16 h-16 bg-muted rounded-full flex items-center justify-center">
            <Upload className={`h-8 w-8 ${isDragging ? 'text-primary' : 'text-muted-foreground'}`} />
          </div>
          
          <div className="space-y-2">
            <h3 className="text-lg font-medium">
              Rechnung für OCR hochladen
            </h3>
            <p className="text-muted-foreground">
              Ziehen Sie eine Datei hierher oder klicken Sie zum Auswählen
            </p>
          </div>

          <div className="flex justify-center">
            <Button 
              variant="outline"
              onClick={() => document.getElementById('ocr-file-input')?.click()}
            >
              <FileText className="mr-2 h-4 w-4" />
              Datei auswählen
            </Button>
          </div>

          <input
            id="ocr-file-input"
            type="file"
            accept={accept}
            onChange={handleFileInput}
            className="hidden"
          />

          <div className="text-xs text-muted-foreground space-y-1">
            <p>Unterstützte Formate: JPEG, PNG, GIF, BMP, WebP, PDF</p>
            <p>Maximale Dateigröße: {maxSize}MB</p>
            <p>Empfohlen: Hochauflösende Scans für beste Ergebnisse</p>
          </div>

          {isOpenAIConfigured() ? (
            <Alert className="border-green-500 bg-green-50">
              <Sparkles className="h-4 w-4 text-green-600" />
              <AlertDescription>
                <strong className="text-green-800">KI-OCR aktiv:</strong> OpenAI Vision erkennt Rechnungsdaten 
                intelligent und extrahiert alle Felder automatisch - auch komplexe Tabellen!
              </AlertDescription>
            </Alert>
          ) : (
            <Alert>
              <Scan className="h-4 w-4" />
              <AlertDescription>
                <strong>OCR-Verarbeitung:</strong> Basis-Texterkennung aktiv. 
                Für beste Ergebnisse: VITE_OPENAI_API_KEY in .env setzen für KI-Extraktion.
              </AlertDescription>
            </Alert>
          )}
        </div>
      </CardContent>
    </Card>
  );
}