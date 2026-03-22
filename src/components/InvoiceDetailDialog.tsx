import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  FileText,
  Send,
  CheckCircle,
  AlertTriangle,
  XCircle,
  Mail,
  CreditCard,
  Pencil,
  Download,
  Save,
  Plus,
  Trash2,
  X
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import InvoicePrintView from "./InvoicePrintView";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { generateA4PDF } from "@/lib/pdfGenerator";

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
  paid_at: string | null;
  sent_at: string | null;
  payment_terms: string | null;
  service_period_start: string | null;
  service_period_end: string | null;
  customer_id: string | null;
  project_id: string | null;
  created_at: string;
  customers?: {
    company_name: string | null;
    contact_person: string | null;
    address: string | null;
    postal_code: string | null;
    city: string | null;
    email: string | null;
    phone: string | null;
  } | null;
  projects?: {
    name: string | null;
    project_number: string | null;
  } | null;
}

interface InvoiceItem {
  id: string;
  position_number: number;
  description: string;
  quantity: number;
  unit: string;
  unit_price: number;
  vat_rate: number | null;
  total_net: number | null;
  source_type: string | null;
}

// Internal editable item type
interface EditableItem {
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

interface InvoiceDetailDialogProps {
  isOpen: boolean;
  onClose: () => void;
  invoice: Invoice;
  onUpdate?: () => void;
}

const STATUS_CONFIG = {
  draft: { label: 'Entwurf', color: 'bg-slate-100 text-slate-700 border-slate-200', icon: FileText, bgColor: 'bg-slate-50' },
  sent: { label: 'Versendet', color: 'bg-blue-50 text-blue-700 border-blue-200', icon: Send, bgColor: 'bg-blue-50' },
  paid: { label: 'Bezahlt', color: 'bg-emerald-50 text-emerald-700 border-emerald-200', icon: CheckCircle, bgColor: 'bg-emerald-50' },
  overdue: { label: 'Überfällig', color: 'bg-red-50 text-red-700 border-red-200', icon: AlertTriangle, bgColor: 'bg-red-50' },
  void: { label: 'Storniert', color: 'bg-slate-100 text-slate-500 border-slate-200', icon: XCircle, bgColor: 'bg-slate-50' },
  cancelled: { label: 'Abgebrochen', color: 'bg-slate-100 text-slate-500 border-slate-200', icon: XCircle, bgColor: 'bg-slate-50' }
};

const UNITS = ['Stk', 'Std', 'm', 'm²', 'm³', 'kg', 'l', 'psch', 'Tag'];

const isDayHeader = (item: EditableItem) => item.description.startsWith('§DATE§');

const InvoiceDetailDialog: React.FC<InvoiceDetailDialogProps> = ({
  isOpen,
  onClose,
  invoice,
  onUpdate
}) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [fullInvoice, setFullInvoice] = useState<Invoice>(invoice);
  const [pdfGenerating, setPdfGenerating] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // Editable items state
  const [editItems, setEditItems] = useState<EditableItem[]>([]);
  // Display items (for InvoicePrintView)
  const [displayItems, setDisplayItems] = useState<InvoiceItem[]>([]);
  // Highlighted item (click-to-scroll)
  const [highlightedItemId, setHighlightedItemId] = useState<string | null>(null);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const highlightTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Editable invoice fields
  const [editTitle, setEditTitle] = useState('');
  const [editTaxRate, setEditTaxRate] = useState(19);
  const [editPaymentTerms, setEditPaymentTerms] = useState('');

  const { data: companySettings } = useQuery({
    queryKey: ["company-settings"],
    queryFn: async () => {
      const { data } = await supabase
        .from("company_settings")
        .select("*")
        .eq("is_active", true)
        .limit(1)
        .single();
      return data;
    },
  });

  useEffect(() => {
    if (isOpen && invoice.id) {
      fetchInvoiceDetails();
      setIsEditing(false);
      setHasUnsavedChanges(false);
    }
  }, [isOpen, invoice.id]);

  // Recalculate totals from editable items
  const calcTotals = useCallback((items: EditableItem[], taxRate: number) => {
    const activeItems = items.filter(i => !i.isDeleted && !isDayHeader(i));
    const net = activeItems.reduce((sum, item) => sum + (item.quantity * item.unit_price), 0);
    const tax = net * (taxRate / 100);
    return { net, tax, gross: net + tax };
  }, []);

  // Update display items when edit items change (for live preview)
  useEffect(() => {
    if (isEditing) {
      const activeItems = editItems.filter(i => !i.isDeleted);
      setDisplayItems(activeItems.map(item => ({
        id: item.id,
        position_number: item.position,
        description: item.description,
        quantity: item.quantity,
        unit: item.unit,
        unit_price: item.unit_price,
        vat_rate: null,
        total_net: item.quantity * item.unit_price,
        source_type: null
      })));
      // Update invoice totals for preview
      const totals = calcTotals(editItems, editTaxRate);
      setFullInvoice(prev => ({
        ...prev,
        title: editTitle,
        tax_rate: editTaxRate,
        payment_terms: editPaymentTerms,
        net_amount: totals.net,
        tax_amount: totals.tax,
        gross_amount: totals.gross
      }));
    }
  }, [editItems, isEditing, editTitle, editTaxRate, editPaymentTerms, calcTotals]);

  const fetchInvoiceDetails = async () => {
    setLoading(true);
    try {
      const { data: invoiceData, error: invoiceError } = await supabase
        .from('invoices')
        .select(`*, customers(company_name, contact_person, address, postal_code, city, email, phone), projects(name)`)
        .eq('id', invoice.id)
        .single();

      if (invoiceError) throw invoiceError;
      setFullInvoice(invoiceData);
      setEditTitle(invoiceData.title || '');
      setEditTaxRate(invoiceData.tax_rate || 19);
      setEditPaymentTerms(invoiceData.payment_terms || '');

      const { data: itemsData, error: itemsError } = await supabase
        .from('document_items')
        .select('*')
        .eq('invoice_id', invoice.id)
        .order('position', { ascending: true });

      if (itemsError) throw itemsError;

      const rawItems = (itemsData || []).map((item: any) => ({
        id: item.id,
        position: item.position,
        description: item.description,
        quantity: item.quantity,
        unit: item.unit || 'Stk',
        unit_price: item.unit_price,
        total_price: item.total_price || (item.quantity * item.unit_price)
      }));
      setEditItems(rawItems);

      // Set display items
      setDisplayItems(rawItems.map((item: EditableItem) => ({
        id: item.id,
        position_number: item.position,
        description: item.description,
        quantity: item.quantity,
        unit: item.unit,
        unit_price: item.unit_price,
        vat_rate: null,
        total_net: item.total_price,
        source_type: null
      })));
    } catch (error) {
      console.error('Error fetching invoice details:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number | null) => {
    return (amount || 0).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' });
  };

  const handleMarkAsSent = async () => {
    try {
      const { error } = await supabase
        .from('invoices')
        .update({ status: 'sent', sent_at: new Date().toISOString() })
        .eq('id', invoice.id);
      if (error) throw error;
      toast({ title: "Rechnung versendet", description: "Die Rechnung wurde als versendet markiert." });
      onUpdate?.();
      fetchInvoiceDetails();
    } catch {
      toast({ title: "Fehler", description: "Status konnte nicht geändert werden.", variant: "destructive" });
    }
  };

  const handleMarkAsPaid = async () => {
    try {
      const { error } = await supabase
        .from('invoices')
        .update({ status: 'paid', paid_at: new Date().toISOString() })
        .eq('id', invoice.id);
      if (error) throw error;
      toast({ title: "Rechnung bezahlt", description: "Die Rechnung wurde als bezahlt markiert." });
      onUpdate?.();
      fetchInvoiceDetails();
    } catch {
      toast({ title: "Fehler", description: "Status konnte nicht geändert werden.", variant: "destructive" });
    }
  };

  // === Editing functions ===
  const startEditing = () => {
    setIsEditing(true);
    setHasUnsavedChanges(false);
  };

  const cancelEditing = () => {
    setIsEditing(false);
    setHasUnsavedChanges(false);
    fetchInvoiceDetails();
  };

  const handleUpdateItem = (id: string, field: keyof EditableItem, value: any) => {
    setEditItems(prev => prev.map(item => {
      if (item.id === id) {
        const updated = { ...item, [field]: value };
        if (field === 'quantity' || field === 'unit_price') {
          updated.total_price = updated.quantity * updated.unit_price;
        }
        return updated;
      }
      return item;
    }));
    setHasUnsavedChanges(true);
  };

  const handleAddItem = () => {
    const maxPos = Math.max(0, ...editItems.filter(i => !i.isDeleted).map(i => i.position));
    setEditItems(prev => [...prev, {
      id: `new-${Date.now()}`,
      position: maxPos + 1,
      description: '',
      quantity: 1,
      unit: 'Stk',
      unit_price: 0,
      total_price: 0,
      isNew: true
    }]);
    setHasUnsavedChanges(true);
  };

  const handleDeleteItem = (id: string) => {
    setEditItems(prev => prev.map(item => {
      if (item.id === id) {
        if (item.isNew) return null as any;
        return { ...item, isDeleted: true };
      }
      return item;
    }).filter(Boolean));
    setHasUnsavedChanges(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const totals = calcTotals(editItems, editTaxRate);

      const { error: invoiceError } = await supabase
        .from('invoices')
        .update({
          title: editTitle,
          tax_rate: editTaxRate,
          payment_terms: editPaymentTerms || null,
          net_amount: totals.net,
          tax_amount: totals.tax,
          gross_amount: totals.gross,
          updated_at: new Date().toISOString()
        } as any)
        .eq('id', invoice.id);
      if (invoiceError) throw invoiceError;

      // Delete removed items
      const toDelete = editItems.filter(i => i.isDeleted && !i.isNew);
      if (toDelete.length > 0) {
        await supabase.from('document_items').delete().in('id', toDelete.map(i => i.id));
      }

      // Insert new items
      const toInsert = editItems.filter(i => i.isNew && !i.isDeleted);
      if (toInsert.length > 0) {
        await supabase.from('document_items').insert(toInsert.map(item => ({
          invoice_id: invoice.id,
          position: item.position,
          description: item.description,
          quantity: item.quantity,
          unit: item.unit,
          unit_price: item.unit_price,
          total_price: item.quantity * item.unit_price
        })));
      }

      // Update existing items
      const toUpdate = editItems.filter(i => !i.isNew && !i.isDeleted);
      for (const item of toUpdate) {
        await supabase.from('document_items').update({
          position: item.position,
          description: item.description,
          quantity: item.quantity,
          unit: item.unit,
          unit_price: item.unit_price,
          total_price: item.quantity * item.unit_price
        }).eq('id', item.id);
      }

      toast({ title: "Gespeichert", description: "Rechnung wurde aktualisiert." });
      setHasUnsavedChanges(false);
      setIsEditing(false);
      onUpdate?.();
      fetchInvoiceDetails();
    } catch (error) {
      console.error('Save error:', error);
      toast({ title: "Fehler", description: "Speichern fehlgeschlagen.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  // Click on A4 item → scroll to sidebar item + highlight
  const handleA4ItemClick = useCallback((itemId: string) => {
    if (!isEditing) return;
    setHighlightedItemId(itemId);
    // Scroll sidebar to the item
    const el = document.getElementById(`sidebar-item-${itemId}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      // Focus first input in the item
      setTimeout(() => {
        const input = el.querySelector('input');
        if (input) input.focus();
      }, 300);
    }
    // Clear highlight after 2s
    if (highlightTimerRef.current) clearTimeout(highlightTimerRef.current);
    highlightTimerRef.current = setTimeout(() => setHighlightedItemId(null), 2000);
  }, [isEditing]);

  const statusConfig = STATUS_CONFIG[fullInvoice.status] || STATUS_CONFIG.draft;
  const StatusIcon = statusConfig.icon;
  const canEdit = fullInvoice.status === 'draft';

  return (
    <Dialog open={isOpen} onOpenChange={(open) => {
      if (!open && hasUnsavedChanges) {
        if (confirm('Ungespeicherte Änderungen verwerfen?')) {
          onClose();
        }
      } else {
        onClose();
      }
    }}>
      <DialogContent className={`${isEditing ? 'max-w-[95vw] w-[95vw] h-[95vh]' : 'max-w-5xl max-h-[95vh]'} overflow-hidden p-0`}>
        {/* Header */}
        <div className={`${statusConfig.bgColor} border-b px-6 py-4`}>
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-4">
              <div className={`p-3 rounded-xl ${
                fullInvoice.status === 'paid' ? 'bg-emerald-100' :
                fullInvoice.status === 'overdue' ? 'bg-red-100' :
                fullInvoice.status === 'sent' ? 'bg-blue-100' : 'bg-slate-200'
              }`}>
                <Receipt className={`h-6 w-6 ${
                  fullInvoice.status === 'paid' ? 'text-emerald-600' :
                  fullInvoice.status === 'overdue' ? 'text-red-600' :
                  fullInvoice.status === 'sent' ? 'text-blue-600' : 'text-slate-600'
                }`} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-xl font-bold text-slate-800">
                    {fullInvoice.invoice_number || 'Entwurf'}
                  </h2>
                  <Badge variant="outline" className={statusConfig.color}>
                    <StatusIcon className="h-3 w-3 mr-1" />
                    {statusConfig.label}
                  </Badge>
                  {hasUnsavedChanges && (
                    <Badge className="bg-amber-100 text-amber-700 border-amber-200 animate-pulse">
                      Ungespeichert
                    </Badge>
                  )}
                </div>
                {isEditing ? (
                  <Input
                    value={editTitle}
                    onChange={(e) => { setEditTitle(e.target.value); setHasUnsavedChanges(true); }}
                    className="mt-1 h-7 text-sm max-w-xs bg-white/80"
                    placeholder="Rechnungstitel..."
                  />
                ) : (
                  fullInvoice.title && <p className="text-sm text-slate-600 mt-1">{fullInvoice.title}</p>
                )}
              </div>
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold text-slate-800">{formatCurrency(fullInvoice.gross_amount)}</p>
              <p className="text-xs text-slate-500">Brutto</p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2 mt-3">
            {canEdit && !isEditing && (
              <>
                <Button onClick={startEditing} size="sm" variant="outline">
                  <Pencil className="h-4 w-4 mr-2" />
                  Bearbeiten
                </Button>
                <Button onClick={handleMarkAsSent} size="sm" className="bg-blue-600 hover:bg-blue-700 text-white">
                  <Send className="h-4 w-4 mr-2" />
                  Als versendet markieren
                </Button>
              </>
            )}
            {isEditing && (
              <>
                <Button onClick={handleSave} size="sm" disabled={saving} className="bg-emerald-600 hover:bg-emerald-700 text-white">
                  <Save className="h-4 w-4 mr-2" />
                  {saving ? 'Speichern...' : 'Speichern'}
                </Button>
                <Button onClick={cancelEditing} size="sm" variant="outline">
                  <X className="h-4 w-4 mr-2" />
                  Abbrechen
                </Button>
              </>
            )}
            {(fullInvoice.status === 'sent' || fullInvoice.status === 'overdue') && (
              <Button onClick={handleMarkAsPaid} size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white">
                <CreditCard className="h-4 w-4 mr-2" />
                Als bezahlt markieren
              </Button>
            )}
            <Button
              variant="outline" size="sm" disabled={pdfGenerating}
              onClick={async () => {
                setPdfGenerating(true);
                try {
                  const success = await generateA4PDF('invoice-print-view', `${fullInvoice.invoice_number || 'Rechnung'}.pdf`);
                  if (success) toast({ title: "PDF erstellt", description: "PDF heruntergeladen." });
                  else toast({ title: "Fehler", description: "PDF konnte nicht erstellt werden.", variant: "destructive" });
                } finally { setPdfGenerating(false); }
              }}
            >
              <Download className="h-4 w-4 mr-2" />
              {pdfGenerating ? 'Erstelle...' : 'PDF'}
            </Button>
            <Button variant="outline" size="sm">
              <Mail className="h-4 w-4 mr-2" />
              E-Mail
            </Button>
          </div>
        </div>

        {/* Main Content: A4 Preview + Edit Sidebar */}
        <div className={`${isEditing ? 'flex h-[calc(95vh-140px)]' : 'overflow-y-auto max-h-[calc(95vh-80px)]'}`}>
          {/* A4 Document Preview */}
          <div className={`p-8 bg-gray-100 ${isEditing ? 'flex-1 min-w-0 overflow-y-auto' : ''}`}>
            {loading ? (
              <Skeleton className="h-[600px] w-full" />
            ) : (
              <div className="flex justify-center">
                <div
                  id="invoice-print-view"
                  className="bg-white shadow-lg border border-gray-200"
                  style={{ transform: 'scale(0.75)', transformOrigin: 'top center', marginBottom: '-25%' }}
                >
                  <InvoicePrintView
                    invoice={fullInvoice}
                    items={displayItems}
                    companySettings={companySettings || null}
                    onItemClick={isEditing ? handleA4ItemClick : undefined}
                    highlightedItemId={isEditing ? highlightedItemId : null}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Right Sidebar (like OfferSidebar) */}
          {isEditing && !loading && (
            <div className="w-80 flex-shrink-0 border-l bg-white flex flex-col h-full shadow-sm">
              {/* Sidebar Header - Settings */}
              <div className="p-4 border-b">
                <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-3">Einstellungen</h3>
                <div className="space-y-2">
                  <div className="flex items-center justify-between p-3 bg-white border rounded-lg">
                    <span className="text-sm text-gray-700">MwSt.</span>
                    <Select value={String(editTaxRate)} onValueChange={(v) => { setEditTaxRate(Number(v)); setHasUnsavedChanges(true); }}>
                      <SelectTrigger className="h-8 text-sm w-20 border-gray-200"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="19">19%</SelectItem>
                        <SelectItem value="7">7%</SelectItem>
                        <SelectItem value="0">0%</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-white border rounded-lg">
                    <span className="text-sm text-gray-700">Zahlungsziel</span>
                    <Input
                      value={editPaymentTerms}
                      onChange={(e) => { setEditPaymentTerms(e.target.value); setHasUnsavedChanges(true); }}
                      className="h-8 text-sm w-28 text-right"
                      placeholder="30 Tage"
                    />
                  </div>
                </div>
              </div>

              {/* Positionen */}
              <div className="flex-1 overflow-y-auto">
                <div className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider">Positionen</h3>
                    <Button variant="outline" size="sm" onClick={handleAddItem} className="h-7 text-xs">
                      <Plus className="h-3 w-3 mr-1" />
                      Neu
                    </Button>
                  </div>

                  <div className="space-y-1.5">
                    {(() => {
                      let realPos = 0;
                      return editItems.filter(i => !i.isDeleted).map((item) => {
                        // Day header
                        if (isDayHeader(item)) {
                          const parts = item.description.replace('§DATE§', '').split('§DESC§');
                          const dateLabel = parts[0];
                          const descText = parts[1] || '';
                          const isHL = highlightedItemId === item.id;
                          return (
                            <div key={item.id} id={`sidebar-item-${item.id}`}
                              className={`rounded-lg px-3 py-2 transition-all group ${isHL ? 'bg-blue-200 border-2 border-blue-400 ring-2 ring-blue-300' : 'bg-blue-50 border border-blue-200 hover:bg-blue-100'}`}>
                              <div className="flex items-center justify-between mb-1">
                                <p className="text-xs font-semibold text-blue-700">{dateLabel}</p>
                                <Button variant="ghost" size="sm" onClick={() => handleDeleteItem(item.id)}
                                  className="h-6 w-6 p-0 text-blue-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity">
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </div>
                              <Input
                                value={descText}
                                onChange={(e) => {
                                  const newDesc = `§DATE§${dateLabel}${e.target.value ? '§DESC§' + e.target.value : ''}`;
                                  handleUpdateItem(item.id, 'description', newDesc);
                                }}
                                className="h-6 text-[11px] bg-white/60 border-blue-200 focus:border-blue-400"
                                placeholder="Tätigkeitsbeschreibung..."
                              />
                            </div>
                          );
                        }

                        realPos++;
                        const isHL = highlightedItemId === item.id;
                        return (
                          <div key={item.id} id={`sidebar-item-${item.id}`}
                            className={`rounded-lg p-2.5 transition-all group ${isHL ? 'bg-blue-50 border-2 border-blue-400 ring-2 ring-blue-300 shadow-md' : 'bg-white border hover:border-gray-300 hover:shadow-sm'}`}>
                            <div className="flex items-start gap-2">
                              <span className="text-[10px] text-gray-400 mt-2 w-4 text-right flex-shrink-0 font-medium">{realPos}</span>
                              <div className="flex-1 min-w-0 space-y-1.5">
                                <Input
                                  value={item.description}
                                  onChange={(e) => handleUpdateItem(item.id, 'description', e.target.value)}
                                  className="h-7 text-xs border-gray-200"
                                  placeholder="Beschreibung..."
                                />
                                <div className="flex items-center gap-1">
                                  <Input
                                    type="number"
                                    value={item.quantity}
                                    onChange={(e) => handleUpdateItem(item.id, 'quantity', parseFloat(e.target.value) || 0)}
                                    className="h-7 text-xs w-14 text-right"
                                    min="0" step="0.01"
                                  />
                                  <Select value={item.unit} onValueChange={(v) => handleUpdateItem(item.id, 'unit', v)}>
                                    <SelectTrigger className="h-7 text-xs w-14"><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                      {UNITS.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                                    </SelectContent>
                                  </Select>
                                  <span className="text-[10px] text-gray-400">×</span>
                                  <Input
                                    type="number"
                                    value={item.unit_price}
                                    onChange={(e) => handleUpdateItem(item.id, 'unit_price', parseFloat(e.target.value) || 0)}
                                    className="h-7 text-xs w-16 text-right"
                                    min="0" step="0.01"
                                  />
                                  <Button variant="ghost" size="sm" onClick={() => handleDeleteItem(item.id)}
                                    className="h-6 w-6 p-0 text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                                    <Trash2 className="h-3 w-3" />
                                  </Button>
                                </div>
                                <div className="text-right">
                                  <span className="text-xs font-semibold text-gray-700">
                                    {(item.quantity * item.unit_price).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}
                                  </span>
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      });
                    })()}
                  </div>
                </div>
              </div>

              {/* Sticky Totals Footer */}
              {editItems.length > 0 && (() => {
                const totals = calcTotals(editItems, editTaxRate);
                return (
                  <div className="border-t bg-gray-50 p-4 space-y-1.5">
                    <div className="flex justify-between text-xs text-gray-600">
                      <span>Netto</span>
                      <span>{totals.net.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}</span>
                    </div>
                    <div className="flex justify-between text-xs text-gray-600">
                      <span>MwSt. {editTaxRate}%</span>
                      <span>{totals.tax.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}</span>
                    </div>
                    <div className="flex justify-between text-sm font-bold text-gray-900 pt-1.5 border-t border-gray-200">
                      <span>Brutto</span>
                      <span>{totals.gross.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}</span>
                    </div>
                  </div>
                );
              })()}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default InvoiceDetailDialog;
