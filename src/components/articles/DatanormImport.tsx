import React, { useState, useCallback } from 'react';
import { Upload, FileArchive, AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { parseDatanormFile } from '@/services/datanormParser';
import { useImportDatanorm } from '@/hooks/useArticles';
import type { DatanormParseResult } from '@/types/article';

interface DatanormImportProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type ImportStep = 'upload' | 'preview' | 'importing' | 'done';

export function DatanormImport({ open, onOpenChange }: DatanormImportProps) {
  const [step, setStep] = useState<ImportStep>('upload');
  const [supplierName, setSupplierName] = useState('');
  const [fileName, setFileName] = useState('');
  const [parseResult, setParseResult] = useState<DatanormParseResult | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const importMutation = useImportDatanorm();

  const reset = () => {
    setStep('upload');
    setSupplierName('');
    setFileName('');
    setParseResult(null);
    setParseError(null);
  };

  const handleFileUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setParseError(null);
    setFileName(file.name);

    try {
      let content = '';

      if (file.name.toLowerCase().endsWith('.zip')) {
        const JSZip = (await import('jszip')).default;
        const zip = await JSZip.loadAsync(file);
        const datanormFiles = Object.keys(zip.files).filter(
          name => /\.(dat|dnr|datanorm|txt)$/i.test(name) && !name.startsWith('__MACOSX')
        );

        if (datanormFiles.length === 0) {
          setParseError('Keine Datanorm-Dateien (.dat, .dnr) im ZIP gefunden.');
          return;
        }

        const contents: string[] = [];
        for (const name of datanormFiles) {
          const text = await zip.files[name].async('string');
          contents.push(text);
        }
        content = contents.join('\n');
      } else {
        content = await file.text();
      }

      const result = parseDatanormFile(content);

      if (result.articles.length === 0) {
        setParseError(
          `Keine Artikel gefunden. ${result.errors.length} Fehler beim Parsen.` +
          (result.totalLines === 0 ? ' Die Datei scheint leer zu sein.' : '')
        );
        return;
      }

      setParseResult(result);
      setStep('preview');
    } catch (err) {
      setParseError(
        err instanceof Error ? err.message : 'Fehler beim Lesen der Datei'
      );
    }
  }, []);

  const handleImport = async () => {
    if (!parseResult || !supplierName.trim()) return;

    setStep('importing');

    try {
      await importMutation.mutateAsync({
        parseResult,
        supplierName: supplierName.trim(),
        fileName,
      });
      setStep('done');
    } catch {
      setStep('preview');
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) reset(); onOpenChange(o); }}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileArchive className="h-5 w-5" />
            Datanorm Import
          </DialogTitle>
          <DialogDescription>
            Artikelkatalog aus Datanorm 4.0 Dateien importieren (ZIP oder .dat)
          </DialogDescription>
        </DialogHeader>

        {/* Step 1: Upload */}
        {step === 'upload' && (
          <div className="space-y-4 py-4">
            <div>
              <Label>Lieferant / Grosshandel</Label>
              <Input
                placeholder="z.B. Sonepar, Rexel, Alexander Buerkle..."
                value={supplierName}
                onChange={(e) => setSupplierName(e.target.value)}
                className="mt-1"
              />
            </div>

            <div>
              <Label>Datanorm-Datei</Label>
              <div className="mt-1 border-2 border-dashed rounded-lg p-8 text-center hover:border-emerald-500 transition-colors">
                <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground mb-2">
                  ZIP-Datei oder .dat/.dnr Datei hochladen
                </p>
                <Input
                  type="file"
                  accept=".zip,.dat,.dnr,.datanorm,.txt"
                  onChange={handleFileUpload}
                  className="max-w-xs mx-auto"
                />
              </div>
            </div>

            {parseError && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{parseError}</AlertDescription>
              </Alert>
            )}
          </div>
        )}

        {/* Step 2: Preview */}
        {step === 'preview' && parseResult && (
          <div className="space-y-4 py-4">
            {!supplierName.trim() && (
              <div>
                <Label>Lieferant benennen</Label>
                <Input
                  placeholder="z.B. Sonepar"
                  value={supplierName}
                  onChange={(e) => setSupplierName(e.target.value)}
                  className="mt-1"
                  autoFocus
                />
              </div>
            )}

            <div className="grid grid-cols-3 gap-3">
              <div className="bg-emerald-50 rounded-lg p-3 text-center">
                <div className="text-2xl font-bold text-emerald-700">
                  {parseResult.articles.length}
                </div>
                <div className="text-xs text-emerald-600">Artikel</div>
              </div>
              <div className="bg-blue-50 rounded-lg p-3 text-center">
                <div className="text-2xl font-bold text-blue-700">
                  {parseResult.categories.length}
                </div>
                <div className="text-xs text-blue-600">Warengruppen</div>
              </div>
              <div className="bg-amber-50 rounded-lg p-3 text-center">
                <div className="text-2xl font-bold text-amber-700">
                  {parseResult.errors.length}
                </div>
                <div className="text-xs text-amber-600">Fehler</div>
              </div>
            </div>

            <ScrollArea className="h-64 border rounded-lg">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 sticky top-0">
                  <tr>
                    <th className="text-left p-2">Art.Nr.</th>
                    <th className="text-left p-2">Bezeichnung</th>
                    <th className="text-right p-2">Preis</th>
                    <th className="text-left p-2">ME</th>
                  </tr>
                </thead>
                <tbody>
                  {parseResult.articles.slice(0, 100).map((art, i) => (
                    <tr key={i} className="border-t hover:bg-gray-50">
                      <td className="p-2 font-mono text-xs">{art.articleNumber}</td>
                      <td className="p-2">
                        <div className="font-medium">{art.shortText1}</div>
                        {art.shortText2 && (
                          <div className="text-muted-foreground text-xs">{art.shortText2}</div>
                        )}
                      </td>
                      <td className="p-2 text-right font-mono">
                        {art.listPrice.toFixed(2)} EUR
                      </td>
                      <td className="p-2">{art.unit}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {parseResult.articles.length > 100 && (
                <div className="p-3 text-center text-sm text-muted-foreground">
                  ... und {parseResult.articles.length - 100} weitere Artikel
                </div>
              )}
            </ScrollArea>

            {parseResult.errors.length > 0 && (
              <details className="text-sm">
                <summary className="cursor-pointer text-amber-600">
                  {parseResult.errors.length} Parse-Fehler anzeigen
                </summary>
                <ScrollArea className="h-32 mt-2 border rounded p-2">
                  {parseResult.errors.map((err, i) => (
                    <div key={i} className="text-xs text-red-600 mb-1">
                      Zeile {err.line}: {err.error}
                    </div>
                  ))}
                </ScrollArea>
              </details>
            )}
          </div>
        )}

        {/* Step 3: Importing */}
        {step === 'importing' && (
          <div className="py-12 text-center">
            <Loader2 className="h-8 w-8 animate-spin mx-auto text-emerald-600 mb-4" />
            <p className="text-sm text-muted-foreground">
              Importiere {parseResult?.articles.length} Artikel...
            </p>
          </div>
        )}

        {/* Step 4: Done */}
        {step === 'done' && (
          <div className="py-12 text-center">
            <CheckCircle2 className="h-12 w-12 mx-auto text-emerald-600 mb-4" />
            <h3 className="text-lg font-semibold mb-2">Import abgeschlossen!</h3>
            <p className="text-sm text-muted-foreground">
              {parseResult?.articles.length} Artikel von{' '}
              <span className="font-medium">{supplierName}</span> importiert.
            </p>
          </div>
        )}

        <DialogFooter>
          {step === 'preview' && (
            <>
              <Button variant="outline" onClick={reset}>Zurueck</Button>
              <Button
                onClick={handleImport}
                disabled={!supplierName.trim() || importMutation.isPending}
              >
                {parseResult?.articles.length} Artikel importieren
              </Button>
            </>
          )}
          {step === 'done' && (
            <Button onClick={() => { reset(); onOpenChange(false); }}>
              Schliessen
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
