import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Receipt,
  Plus,
  Trash2,
  Save,
  X,
  AlertCircle,
  GripVertical
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";

interface Invoice {
  id: string;
  invoice_number: string | null;
  title: string;
  description: string | null;
  status: 'draft' | 'sent' | 'paid' | 'overdue' | 'void' | 'cancelled';
  invoice_type: 'final' | 'partial' | 'advance' | 'credit' | null;
  invoice_date: string | null;
  due_date: string | null;
  net_amount: number | null;
  tax_amount: number | null;
  tax_rate: number | null;
  gross_amount: number | null;
  payment_terms: string | null;
  service_period_start: string | null;
  service_period_end: string | null;
  customer_id: string | null;
  project_id: string | null;
}

interface InvoiceItem {
  id: string;
  position: number;
  description: string;
  quantity: number;
  unit: string;
  unit_price: number;
  total_price: number;
  isNew?: boolean;
  isDeleted?: boolean;
}

interface EditInvoiceDialogProps {
  isOpen: boolean;
  onClose: () => void;
  invoice: Invoice;
  onUpdate?: () => void;
}

const UNITS = ['Stk', 'Std', 'm', 'm²', 'm³', 'kg', 'l', 'psch', 'Tag'];

const EditInvoiceDialog: React.FC<EditInvoiceDialogProps> = ({
  isOpen,
  onClose,
  invoice,
  onUpdate
}) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Form state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [invoiceDate, setInvoiceDate] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [paymentTerms, setPaymentTerms] = useState('');
  const [taxRate, setTaxRate] = useState(19);
  const [invoiceType, setInvoiceType] = useState<string>('final');

  // Items state
  const [items, setItems] = useState<InvoiceItem[]>([]);

  // Calculated totals
  const [netTotal, setNetTotal] = useState(0);
  const [taxTotal, setTaxTotal] = useState(0);
  const [grossTotal, setGrossTotal] = useState(0);

  useEffect(() => {
    if (isOpen && invoice.id) {
      loadInvoiceData();
    }
  }, [isOpen, invoice.id]);

  // Helper: check if item is a day section header
  const isDayHeader = (item: InvoiceItem) => item.description.startsWith('§DATE§');

  useEffect(() => {
    // Recalculate totals when items change (exclude header rows)
    const activeItems = items.filter(i => !i.isDeleted && !isDayHeader(i));
    const net = activeItems.reduce((sum, item) => sum + (item.quantity * item.unit_price), 0);
    const tax = net * (taxRate / 100);
    const gross = net + tax;

    setNetTotal(net);
    setTaxTotal(tax);
    setGrossTotal(gross);
  }, [items, taxRate]);

  const loadInvoiceData = async () => {
    setLoading(true);
    try {
      // Load invoice details
      const { data: invoiceData, error: invoiceError } = await supabase
        .from('invoices')
        .select('*')
        .eq('id', invoice.id)
        .single();

      if (invoiceError) throw invoiceError;

      // Set form values
      setTitle(invoiceData.title || '');
      setDescription(invoiceData.description || '');
      setInvoiceDate(invoiceData.invoice_date || '');
      setDueDate(invoiceData.due_date || '');
      setPaymentTerms(invoiceData.payment_terms || '');
      setTaxRate(invoiceData.tax_rate || 19);
      setInvoiceType(invoiceData.invoice_type || 'final');

      // Load invoice items from document_items
      const { data: itemsData, error: itemsError } = await supabase
        .from('document_items')
        .select('*')
        .eq('invoice_id', invoice.id)
        .order('position', { ascending: true });

      if (itemsError) throw itemsError;
      setItems(itemsData || []);
    } catch (error) {
      console.error('Error loading invoice:', error);
      toast({
        title: "Fehler",
        description: "Rechnung konnte nicht geladen werden.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleAddItem = () => {
    const maxPosition = Math.max(0, ...items.filter(i => !i.isDeleted).map(i => i.position));
    const newItem: InvoiceItem = {
      id: `new-${Date.now()}`,
      position: maxPosition + 1,
      description: '',
      quantity: 1,
      unit: 'Stk',
      unit_price: 0,
      total_price: 0,
      isNew: true
    };
    setItems([...items, newItem]);
  };

  const handleUpdateItem = (id: string, field: keyof InvoiceItem, value: any) => {
    setItems(items.map(item => {
      if (item.id === id) {
        const updated = { ...item, [field]: value };
        // Recalculate total_price
        if (field === 'quantity' || field === 'unit_price') {
          updated.total_price = updated.quantity * updated.unit_price;
        }
        return updated;
      }
      return item;
    }));
  };

  const handleDeleteItem = (id: string) => {
    setItems(items.map(item => {
      if (item.id === id) {
        if (item.isNew) {
          // Remove new items completely
          return null;
        }
        // Mark existing items as deleted
        return { ...item, isDeleted: true };
      }
      return item;
    }).filter(Boolean) as InvoiceItem[]);
  };

  const handleSave = async () => {
    if (!title.trim()) {
      toast({
        title: "Fehler",
        description: "Bitte geben Sie einen Titel ein.",
        variant: "destructive"
      });
      return;
    }

    setSaving(true);
    try {
      // Update invoice
      const { error: invoiceError } = await supabase
        .from('invoices')
        .update({
          title,
          description: description || null,
          invoice_date: invoiceDate || null,
          due_date: dueDate || null,
          payment_terms: paymentTerms || null,
          tax_rate: taxRate,
          net_amount: netTotal,
          tax_amount: taxTotal,
          gross_amount: netTotal + taxTotal,
          notes: description || null,
          updated_at: new Date().toISOString()
        })
        .eq('id', invoice.id);

      if (invoiceError) throw invoiceError;

      // Handle items
      const itemsToDelete = items.filter(i => i.isDeleted && !i.isNew);
      const itemsToInsert = items.filter(i => i.isNew && !i.isDeleted);
      const itemsToUpdate = items.filter(i => !i.isNew && !i.isDeleted);

      // Delete removed items
      if (itemsToDelete.length > 0) {
        const { error } = await supabase
          .from('document_items')
          .delete()
          .in('id', itemsToDelete.map(i => i.id));
        if (error) throw error;
      }

      // Insert new items
      if (itemsToInsert.length > 0) {
        const { error } = await supabase
          .from('document_items')
          .insert(itemsToInsert.map(item => ({
            invoice_id: invoice.id,
            position: item.position,
            description: item.description,
            quantity: item.quantity,
            unit: item.unit,
            unit_price: item.unit_price,
            total_price: item.quantity * item.unit_price
          })));
        if (error) throw error;
      }

      // Update existing items
      for (const item of itemsToUpdate) {
        const { error } = await supabase
          .from('document_items')
          .update({
            position: item.position,
            description: item.description,
            quantity: item.quantity,
            unit: item.unit,
            unit_price: item.unit_price,
            total_price: item.quantity * item.unit_price
          })
          .eq('id', item.id);
        if (error) throw error;
      }

      toast({
        title: "Gespeichert",
        description: "Die Rechnung wurde erfolgreich aktualisiert."
      });

      onUpdate?.();
      onClose();
    } catch (error) {
      console.error('Error saving invoice:', error);
      toast({
        title: "Fehler",
        description: "Die Rechnung konnte nicht gespeichert werden.",
        variant: "destructive"
      });
    } finally {
      setSaving(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return amount.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' });
  };

  const canEdit = invoice.status === 'draft';

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-emerald-50">
              <Receipt className="h-5 w-5 text-emerald-600" />
            </div>
            <div>
              <DialogTitle className="text-xl">
                Rechnung bearbeiten
              </DialogTitle>
              <p className="text-sm text-slate-500 mt-0.5">
                {invoice.invoice_number || 'Entwurf'}
              </p>
            </div>
          </div>
        </DialogHeader>

        {!canEdit && (
          <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-800 text-sm">
            <AlertCircle className="h-4 w-4" />
            <span>Diese Rechnung kann nicht mehr bearbeitet werden, da sie bereits versendet wurde.</span>
          </div>
        )}

        {loading ? (
          <div className="space-y-4 py-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-40 w-full" />
          </div>
        ) : (
          <div className="space-y-6 py-4">
            {/* Basic Info */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="title">Titel *</Label>
                <Input
                  id="title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="z.B. Schlussrechnung Projekt XY"
                  disabled={!canEdit}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="invoiceType">Rechnungstyp</Label>
                <Select value={invoiceType} onValueChange={setInvoiceType} disabled={!canEdit}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="final">Schlussrechnung</SelectItem>
                    <SelectItem value="partial">Teilrechnung</SelectItem>
                    <SelectItem value="advance">Abschlagsrechnung</SelectItem>
                    <SelectItem value="credit">Gutschrift</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Dates */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="invoiceDate">Rechnungsdatum</Label>
                <Input
                  id="invoiceDate"
                  type="date"
                  value={invoiceDate}
                  onChange={(e) => setInvoiceDate(e.target.value)}
                  disabled={!canEdit}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="dueDate">Fälligkeitsdatum</Label>
                <Input
                  id="dueDate"
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  disabled={!canEdit}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="taxRate">MwSt.-Satz (%)</Label>
                <Select value={String(taxRate)} onValueChange={(v) => setTaxRate(Number(v))} disabled={!canEdit}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="19">19%</SelectItem>
                    <SelectItem value="7">7%</SelectItem>
                    <SelectItem value="0">0%</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Payment Terms */}
            <div className="space-y-2">
              <Label htmlFor="paymentTerms">Zahlungsbedingungen</Label>
              <Input
                id="paymentTerms"
                value={paymentTerms}
                onChange={(e) => setPaymentTerms(e.target.value)}
                placeholder="z.B. 14 Tage netto, 2% Skonto bei Zahlung innerhalb 7 Tagen"
                disabled={!canEdit}
              />
            </div>

            {/* Items */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-base font-semibold">Positionen</Label>
                {canEdit && (
                  <Button variant="outline" size="sm" onClick={handleAddItem}>
                    <Plus className="h-4 w-4 mr-1" />
                    Position hinzufügen
                  </Button>
                )}
              </div>

              <Card className="border-slate-200">
                <CardContent className="p-0">
                  {items.filter(i => !i.isDeleted).length === 0 ? (
                    <div className="p-8 text-center text-slate-400">
                      <Receipt className="h-10 w-10 mx-auto mb-2 opacity-50" />
                      <p>Keine Positionen vorhanden</p>
                      {canEdit && (
                        <Button variant="link" onClick={handleAddItem} className="mt-2">
                          Erste Position hinzufügen
                        </Button>
                      )}
                    </div>
                  ) : (
                    <div className="divide-y divide-slate-100">
                      {/* Header */}
                      <div className="grid grid-cols-12 gap-2 px-4 py-2 bg-slate-50 text-xs font-medium text-slate-500 uppercase tracking-wide">
                        <div className="col-span-1">Pos.</div>
                        <div className="col-span-4">Beschreibung</div>
                        <div className="col-span-2 text-right">Menge</div>
                        <div className="col-span-1">Einheit</div>
                        <div className="col-span-2 text-right">Einzelpreis</div>
                        <div className="col-span-1 text-right">Gesamt</div>
                        <div className="col-span-1"></div>
                      </div>

                      {/* Items */}
                      {(() => {
                        let realPos = 0;
                        return items.filter(i => !i.isDeleted).map((item) => {
                          // Day section header
                          if (isDayHeader(item)) {
                            const parts = item.description.replace('§DATE§', '').split('§DESC§');
                            const dateLabel = parts[0];
                            const descText = parts[1] || '';
                            return (
                              <div key={item.id} className="px-4 py-3 bg-slate-100 border-t-2 border-slate-300">
                                <div className="flex items-center justify-between">
                                  <div>
                                    <p className="font-semibold text-slate-700 text-sm">{dateLabel}</p>
                                    {descText && (
                                      <p className="text-xs text-slate-500 mt-0.5">{descText}</p>
                                    )}
                                  </div>
                                  {canEdit && (
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => handleDeleteItem(item.id)}
                                      className="h-8 w-8 p-0 text-slate-400 hover:text-red-500"
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  )}
                                </div>
                              </div>
                            );
                          }

                          // Regular item row
                          realPos++;
                          return (
                            <div key={item.id} className="grid grid-cols-12 gap-2 px-4 py-3 items-center hover:bg-slate-50">
                              <div className="col-span-1 text-sm text-slate-600">
                                {realPos}
                              </div>

                              <div className="col-span-4">
                                <Input
                                  value={item.description}
                                  onChange={(e) => handleUpdateItem(item.id, 'description', e.target.value)}
                                  placeholder="Beschreibung..."
                                  className="h-8 text-sm"
                                  disabled={!canEdit}
                                />
                              </div>

                              <div className="col-span-2">
                                <Input
                                  type="number"
                                  value={item.quantity}
                                  onChange={(e) => handleUpdateItem(item.id, 'quantity', parseFloat(e.target.value) || 0)}
                                  className="h-8 text-sm text-right"
                                  min="0"
                                  step="0.01"
                                  disabled={!canEdit}
                                />
                              </div>

                              <div className="col-span-1">
                                <Select
                                  value={item.unit}
                                  onValueChange={(v) => handleUpdateItem(item.id, 'unit', v)}
                                  disabled={!canEdit}
                                >
                                  <SelectTrigger className="h-8 text-sm">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {UNITS.map(unit => (
                                      <SelectItem key={unit} value={unit}>{unit}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>

                              <div className="col-span-2">
                                <Input
                                  type="number"
                                  value={item.unit_price}
                                  onChange={(e) => handleUpdateItem(item.id, 'unit_price', parseFloat(e.target.value) || 0)}
                                  className="h-8 text-sm text-right"
                                  min="0"
                                  step="0.01"
                                  disabled={!canEdit}
                                />
                              </div>

                              <div className="col-span-1 text-right text-sm font-medium">
                                {formatCurrency(item.quantity * item.unit_price)}
                              </div>

                              <div className="col-span-1 text-right">
                                {canEdit && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleDeleteItem(item.id)}
                                    className="h-8 w-8 p-0 text-slate-400 hover:text-red-500"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                )}
                              </div>
                            </div>
                          );
                        });
                      })()}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Totals */}
              <div className="flex justify-end">
                <div className="w-64 space-y-2 bg-slate-50 rounded-lg p-4">
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-600">Netto</span>
                    <span className="font-medium">{formatCurrency(netTotal)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-600">MwSt. ({taxRate}%)</span>
                    <span className="font-medium">{formatCurrency(taxTotal)}</span>
                  </div>
                  <div className="flex justify-between text-base pt-2 border-t border-slate-200">
                    <span className="font-semibold">Brutto</span>
                    <span className="font-bold">{formatCurrency(grossTotal)}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} disabled={saving}>
            <X className="h-4 w-4 mr-2" />
            Abbrechen
          </Button>
          {canEdit && (
            <Button onClick={handleSave} disabled={saving} className="bg-emerald-600 hover:bg-emerald-700">
              <Save className="h-4 w-4 mr-2" />
              {saving ? 'Speichern...' : 'Speichern'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default EditInvoiceDialog;
