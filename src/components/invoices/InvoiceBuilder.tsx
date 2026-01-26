// Invoice Builder - Create invoices from projects with preview

import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import {
  FileText,
  Package,
  Receipt,
  Minus,
  Plus,
  Loader2,
  Eye,
  Send,
} from 'lucide-react';
import { useWorkflow } from '@/hooks/useWorkflow';
import { useInvoices } from '@/hooks/useInvoices';
import {
  type InvoiceType,
  type InvoiceWithItems,
  INVOICE_TYPE_LABELS,
  INVOICE_ITEM_SOURCE_LABELS,
  formatInvoiceAmount,
} from '@/types';

interface InvoiceBuilderProps {
  projectId: string;
  projectName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: (invoiceId: string) => void;
}

export function InvoiceBuilder({
  projectId,
  projectName,
  open,
  onOpenChange,
  onSuccess,
}: InvoiceBuilderProps) {
  const { buildInvoice, getInvoicePreview, sendInvoice, isLoading } = useWorkflow();
  const { addItem } = useInvoices();

  // Config state
  const [invoiceType, setInvoiceType] = useState<InvoiceType>('final');
  const [includeOfferItems, setIncludeOfferItems] = useState(true);
  const [includeDeliveryNotes, setIncludeDeliveryNotes] = useState(true);
  const [deductAdvances, setDeductAdvances] = useState(true);

  // Preview state
  const [previewInvoice, setPreviewInvoice] = useState<InvoiceWithItems | null>(null);
  const [createdInvoiceId, setCreatedInvoiceId] = useState<string | null>(null);
  const [step, setStep] = useState<'config' | 'preview' | 'done'>('config');

  // Reset on open
  useEffect(() => {
    if (open) {
      setStep('config');
      setPreviewInvoice(null);
      setCreatedInvoiceId(null);
      setInvoiceType('final');
      setIncludeOfferItems(true);
      setIncludeDeliveryNotes(true);
      setDeductAdvances(true);
    }
  }, [open]);

  // Build and preview
  const handleBuild = async () => {
    const invoiceId = await buildInvoice({
      project_id: projectId,
      invoice_type: invoiceType,
      include_offer_items: includeOfferItems,
      include_delivery_note_extras: includeDeliveryNotes,
      deduct_advance_invoices: deductAdvances,
    });

    if (invoiceId) {
      setCreatedInvoiceId(invoiceId);
      const preview = await getInvoicePreview(invoiceId);
      setPreviewInvoice(preview);
      setStep('preview');
    }
  };

  // Send invoice
  const handleSend = async () => {
    if (createdInvoiceId) {
      const success = await sendInvoice(createdInvoiceId);
      if (success) {
        setStep('done');
        onSuccess?.(createdInvoiceId);
      }
    }
  };

  // Format currency
  const formatCurrency = (amount: number | null | undefined) => {
    return formatInvoiceAmount(amount);
  };

  // Source badge color
  const getSourceBadgeVariant = (sourceType: string): 'default' | 'secondary' | 'outline' | 'destructive' => {
    switch (sourceType) {
      case 'offer_item':
        return 'default';
      case 'delivery_note':
        return 'secondary';
      case 'manual':
        return 'outline';
      case 'advance_deduction':
        return 'destructive';
      default:
        return 'outline';
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Receipt className="h-5 w-5" />
            Rechnung erstellen
          </DialogTitle>
          <DialogDescription>
            Projekt: {projectName}
          </DialogDescription>
        </DialogHeader>

        {/* STEP 1: Configuration */}
        {step === 'config' && (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Rechnungsart</CardTitle>
              </CardHeader>
              <CardContent>
                <Select
                  value={invoiceType}
                  onValueChange={(v) => setInvoiceType(v as InvoiceType)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(INVOICE_TYPE_LABELS).map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Inhalte</CardTitle>
                <CardDescription>
                  Wählen Sie, welche Positionen in die Rechnung übernommen werden sollen.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label className="flex items-center gap-2">
                      <FileText className="h-4 w-4" />
                      Angebotspositionen
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      Positionen aus dem ursprünglichen Angebot übernehmen
                    </p>
                  </div>
                  <Switch
                    checked={includeOfferItems}
                    onCheckedChange={setIncludeOfferItems}
                  />
                </div>

                <Separator />

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label className="flex items-center gap-2">
                      <Package className="h-4 w-4" />
                      Zusatzarbeiten aus Lieferscheinen
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      Material und Arbeiten, die nicht im Angebot waren
                    </p>
                  </div>
                  <Switch
                    checked={includeDeliveryNotes}
                    onCheckedChange={setIncludeDeliveryNotes}
                  />
                </div>

                {invoiceType === 'final' && (
                  <>
                    <Separator />

                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label className="flex items-center gap-2">
                          <Minus className="h-4 w-4" />
                          Abschläge abziehen
                        </Label>
                        <p className="text-sm text-muted-foreground">
                          Bereits bezahlte Abschlagsrechnungen abziehen
                        </p>
                      </div>
                      <Switch
                        checked={deductAdvances}
                        onCheckedChange={setDeductAdvances}
                      />
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Abbrechen
              </Button>
              <Button onClick={handleBuild} disabled={isLoading}>
                {isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Erstelle Rechnung...
                  </>
                ) : (
                  <>
                    <Eye className="h-4 w-4 mr-2" />
                    Vorschau erstellen
                  </>
                )}
              </Button>
            </DialogFooter>
          </div>
        )}

        {/* STEP 2: Preview */}
        {step === 'preview' && previewInvoice && (
          <div className="space-y-6">
            {/* Invoice Header */}
            <Card>
              <CardContent className="pt-6">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-muted-foreground">Rechnungsnummer</Label>
                    <p className="font-mono text-lg">{previewInvoice.invoice_number}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Typ</Label>
                    <p>{INVOICE_TYPE_LABELS[previewInvoice.invoice_type as InvoiceType] || previewInvoice.invoice_type}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Leistungszeitraum</Label>
                    <p>
                      {previewInvoice.service_period_start &&
                        format(new Date(previewInvoice.service_period_start), 'dd.MM.yyyy', { locale: de })}
                      {' - '}
                      {previewInvoice.service_period_end &&
                        format(new Date(previewInvoice.service_period_end), 'dd.MM.yyyy', { locale: de })}
                    </p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Status</Label>
                    <Badge variant="outline">Entwurf</Badge>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Invoice Items */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Positionen</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[60px]">Pos.</TableHead>
                      <TableHead>Beschreibung</TableHead>
                      <TableHead>Quelle</TableHead>
                      <TableHead className="text-right">Menge</TableHead>
                      <TableHead className="text-right">Einzelpreis</TableHead>
                      <TableHead className="text-right">Gesamt</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {previewInvoice.items?.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell className="font-mono">{item.position_number}</TableCell>
                        <TableCell>{item.description}</TableCell>
                        <TableCell>
                          <Badge variant={getSourceBadgeVariant(item.source_type)}>
                            {INVOICE_ITEM_SOURCE_LABELS[item.source_type as keyof typeof INVOICE_ITEM_SOURCE_LABELS] || item.source_type}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          {item.quantity} {item.unit}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(item.unit_price)}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {formatCurrency(item.total_net)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                  <TableFooter>
                    <TableRow>
                      <TableCell colSpan={5} className="text-right">
                        Netto
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatCurrency(previewInvoice.net_amount)}
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell colSpan={5} className="text-right">
                        MwSt. ({previewInvoice.tax_rate || 19}%)
                      </TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(previewInvoice.tax_amount)}
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell colSpan={5} className="text-right text-lg font-bold">
                        Gesamt
                      </TableCell>
                      <TableCell className="text-right text-lg font-bold">
                        {formatCurrency(previewInvoice.amount)}
                      </TableCell>
                    </TableRow>
                  </TableFooter>
                </Table>
              </CardContent>
            </Card>

            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => setStep('config')}>
                Zurück
              </Button>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Als Entwurf speichern
              </Button>
              <Button onClick={handleSend} disabled={isLoading}>
                {isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Wird versendet...
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4 mr-2" />
                    Rechnung versenden
                  </>
                )}
              </Button>
            </DialogFooter>
          </div>
        )}

        {/* STEP 3: Done */}
        {step === 'done' && (
          <div className="text-center py-8">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Receipt className="h-8 w-8 text-green-600" />
            </div>
            <h3 className="text-xl font-semibold mb-2">Rechnung versendet!</h3>
            <p className="text-muted-foreground mb-6">
              Die Rechnung {previewInvoice?.invoice_number} wurde erfolgreich versendet.
            </p>
            <Button onClick={() => onOpenChange(false)}>
              Schließen
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
