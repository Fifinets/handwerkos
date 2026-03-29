import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
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
  ClipboardList,
  Clock,
  Package,
  Plus,
  ChevronRight,
  Check,
  AlertCircle,
  Euro
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useSupabaseAuth } from "@/hooks/useSupabaseAuth";
import { Skeleton } from "@/components/ui/skeleton";
import { summarizeInvoiceDescriptions, isOpenAIConfigured, type SummaryLength } from "@/services/openaiService";

interface CreateInvoiceFromProjectDialogProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
  projectName: string;
  customerId?: string | null;
  onInvoiceCreated?: (invoiceId: string) => void;
}

interface OfferData {
  id: string;
  offer_number: string;
  status: string;
  snapshot_net_total: number | null;
  snapshot_gross_total: number | null;
  items: Array<{
    id: string;
    description: string;
    quantity: number;
    unit: string;
    unit_price_net: number;
    vat_rate: number;
  }>;
}

interface DeliveryNoteData {
  id: string;
  delivery_note_number: string;
  work_date: string;
  description: string;
  hours: number;
  employee_name: string;
  hourly_rate: number;
  materials: Array<{
    id: string;
    material_name: string;
    material_quantity: number;
    material_unit: string;
    unit_price: number;
  }>;
}

interface TimeEntryData {
  id: string;
  employee_name: string;
  date: string;
  hours: number;
  description: string;
  hourly_rate: number;
}

interface ProjectMaterialData {
  id: string;
  name: string;
  quantity: number;
  unit: string;
  unit_price: number;
  total_price: number;
  supplier: string | null;
  delivery_date: string | null;
}

const CreateInvoiceFromProjectDialog: React.FC<CreateInvoiceFromProjectDialogProps> = ({
  isOpen,
  onClose,
  projectId,
  projectName,
  customerId,
  onInvoiceCreated
}) => {
  const { toast } = useToast();
  const { companyId } = useSupabaseAuth();

  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [step, setStep] = useState<'select' | 'configure' | 'preview'>('select');

  // Data
  const [offers, setOffers] = useState<OfferData[]>([]);
  const [deliveryNotes, setDeliveryNotes] = useState<DeliveryNoteData[]>([]);
  const [timeEntries, setTimeEntries] = useState<TimeEntryData[]>([]);
  const [projectMaterials, setProjectMaterials] = useState<ProjectMaterialData[]>([]);

  // Selections
  const [selectedOffers, setSelectedOffers] = useState<string[]>([]);
  const [selectedDeliveryNotes, setSelectedDeliveryNotes] = useState<string[]>([]);
  const [selectedTimeEntries, setSelectedTimeEntries] = useState<string[]>([]);
  const [selectedMaterials, setSelectedMaterials] = useState<string[]>([]);

  // Invoice config
  const [invoiceType, setInvoiceType] = useState<string>('final');
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().split('T')[0]);
  const [dueDate, setDueDate] = useState(() => {
    const date = new Date();
    date.setDate(date.getDate() + 14);
    return date.toISOString().split('T')[0];
  });
  const [taxRate, setTaxRate] = useState(19);
  const [includeOfferItems, setIncludeOfferItems] = useState(true);
  const [includeDeliveryNoteHours, setIncludeDeliveryNoteHours] = useState(true);
  const [includeDeliveryNoteMaterials, setIncludeDeliveryNoteMaterials] = useState(true);
  const [includeTimeEntries, setIncludeTimeEntries] = useState(false);
  const [includeProjectMaterials, setIncludeProjectMaterials] = useState(true);
  const [invoiceFormat, setInvoiceFormat] = useState<'daily' | 'summary'>('daily');
  const [summaryLength, setSummaryLength] = useState<SummaryLength>('mittel');

  useEffect(() => {
    if (isOpen && projectId) {
      loadProjectData();
      setStep('select');
      setSelectedOffers([]);
      setSelectedDeliveryNotes([]);
      setSelectedTimeEntries([]);
      setSelectedMaterials([]);
    }
  }, [isOpen, projectId]);

  const loadProjectData = async () => {
    setLoading(true);
    try {
      // Load offers
      const { data: offersData } = await supabase
        .from('offers')
        .select(`
          id, offer_number, status, snapshot_net_total, snapshot_gross_total,
          offer_items(id, description, quantity, unit, unit_price_net, vat_rate)
        `)
        .eq('project_id', projectId)
        .in('status', ['accepted', 'sent']);

      const processedOffers: OfferData[] = (offersData || []).map(o => ({
        id: o.id,
        offer_number: o.offer_number,
        status: o.status,
        snapshot_net_total: o.snapshot_net_total,
        snapshot_gross_total: o.snapshot_gross_total,
        items: o.offer_items || []
      }));
      setOffers(processedOffers);

      // Load delivery notes
      const { data: dnData } = await supabase
        .from('delivery_notes')
        .select(`
          id, delivery_note_number, work_date, description, start_time, end_time, break_minutes, employee_id,
          delivery_note_items(id, item_type, material_name, material_quantity, material_unit, unit_price)
        `)
        .eq('project_id', projectId)
        .order('work_date', { ascending: false });

      // Get employee names and hourly rates
      const empIds = [...new Set((dnData || []).map(dn => dn.employee_id).filter(Boolean))];
      let empMap: Record<string, string> = {};
      let rateMap: Record<string, number> = {};
      if (empIds.length > 0) {
        const { data: empData } = await supabase
          .from('employees')
          .select('id, first_name, last_name, hourly_wage')
          .in('id', empIds);
        (empData || []).forEach(e => {
          empMap[e.id] = `${e.first_name || ''} ${e.last_name || ''}`.trim();
          if (e.hourly_wage) rateMap[e.id] = e.hourly_wage;
        });
      }

      const processedDN: DeliveryNoteData[] = (dnData || []).map(dn => {
        let hours = 0;
        if (dn.start_time && dn.end_time) {
          const [sh, sm] = dn.start_time.split(':').map(Number);
          const [eh, em] = dn.end_time.split(':').map(Number);
          hours = Math.max(0, ((eh * 60 + em) - (sh * 60 + sm) - (dn.break_minutes || 0)) / 60);
        }
        return {
          id: dn.id,
          delivery_note_number: dn.delivery_note_number,
          work_date: dn.work_date,
          description: dn.description || '',
          hours,
          employee_name: empMap[dn.employee_id] || 'Mitarbeiter',
          hourly_rate: rateMap[dn.employee_id] || 65,
          materials: (dn.delivery_note_items || [])
            .filter((i: any) => i.item_type === 'material')
            .map((i: any) => ({
              id: i.id,
              material_name: i.material_name,
              material_quantity: i.material_quantity,
              material_unit: i.material_unit,
              unit_price: i.unit_price || 0
            }))
        };
      });
      setDeliveryNotes(processedDN);

      // Load time entries (not from delivery notes)
      const { data: teData } = await supabase
        .from('time_entries')
        .select('id, employee_id, start_time, end_time, break_duration, description')
        .eq('project_id', projectId)
        .order('start_time', { ascending: false });

      // Get employee names for time entries
      const teEmpIds = [...new Set((teData || []).map(te => te.employee_id).filter(Boolean))];
      if (teEmpIds.length > 0) {
        const { data: teEmpData } = await supabase
          .from('employees')
          .select('id, first_name, last_name, hourly_wage')
          .in('id', teEmpIds);
        (teEmpData || []).forEach(e => {
          empMap[e.id] = `${e.first_name || ''} ${e.last_name || ''}`.trim();
          if (e.hourly_wage) rateMap[e.id] = e.hourly_wage;
        });
      }

      const processedTE: TimeEntryData[] = (teData || []).map(te => {
        let hours = 0;
        if (te.start_time && te.end_time) {
          const start = new Date(te.start_time).getTime();
          const end = new Date(te.end_time).getTime();
          hours = Math.max(0, (end - start - (te.break_duration || 0) * 60 * 1000) / (1000 * 60 * 60));
        }
        return {
          id: te.id,
          employee_name: empMap[te.employee_id] || 'Mitarbeiter',
          date: te.start_time ? new Date(te.start_time).toISOString().split('T')[0] : '',
          hours,
          description: te.description || '',
          hourly_rate: rateMap[te.employee_id] || 65
        };
      });
      setTimeEntries(processedTE);

      // Load project materials
      const { data: matData } = await supabase
        .from('project_materials')
        .select('id, name, quantity, unit, unit_price, total_price, supplier, delivery_date')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false });

      const processedMat: ProjectMaterialData[] = (matData || []).map(m => ({
        id: m.id,
        name: m.name,
        quantity: m.quantity || 0,
        unit: m.unit || 'Stk',
        unit_price: m.unit_price || 0,
        total_price: m.total_price || (m.quantity || 0) * (m.unit_price || 0),
        supplier: m.supplier,
        delivery_date: m.delivery_date
      }));
      setProjectMaterials(processedMat);

    } catch (error) {
      console.error('Error loading project data:', error);
      toast({
        title: "Fehler",
        description: "Projektdaten konnten nicht geladen werden.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return amount.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' });
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('de-DE');
  };

  // Calculate totals
  const calculateTotals = () => {
    let netTotal = 0;

    // From offers
    if (includeOfferItems) {
      selectedOffers.forEach(offerId => {
        const offer = offers.find(o => o.id === offerId);
        if (offer) {
          offer.items.forEach(item => {
            netTotal += item.quantity * item.unit_price_net;
          });
        }
      });
    }

    // From delivery notes - hours
    if (includeDeliveryNoteHours) {
      selectedDeliveryNotes.forEach(dnId => {
        const dn = deliveryNotes.find(d => d.id === dnId);
        if (dn) {
          netTotal += dn.hours * dn.hourly_rate;
        }
      });
    }

    // From delivery notes - materials
    if (includeDeliveryNoteMaterials) {
      selectedDeliveryNotes.forEach(dnId => {
        const dn = deliveryNotes.find(d => d.id === dnId);
        if (dn) {
          dn.materials.forEach(mat => {
            netTotal += mat.material_quantity * mat.unit_price;
          });
        }
      });
    }

    // From time entries
    if (includeTimeEntries) {
      selectedTimeEntries.forEach(teId => {
        const te = timeEntries.find(t => t.id === teId);
        if (te) {
          netTotal += te.hours * te.hourly_rate;
        }
      });
    }

    // From project materials
    if (includeProjectMaterials) {
      selectedMaterials.forEach(matId => {
        const mat = projectMaterials.find(m => m.id === matId);
        if (mat) {
          netTotal += mat.total_price;
        }
      });
    }

    const taxTotal = netTotal * (taxRate / 100);
    const grossTotal = netTotal + taxTotal;

    return { netTotal, taxTotal, grossTotal };
  };

  const handleSelectAll = (type: 'offers' | 'deliveryNotes' | 'timeEntries' | 'materials') => {
    switch (type) {
      case 'offers':
        setSelectedOffers(selectedOffers.length === offers.length ? [] : offers.map(o => o.id));
        break;
      case 'deliveryNotes':
        setSelectedDeliveryNotes(selectedDeliveryNotes.length === deliveryNotes.length ? [] : deliveryNotes.map(d => d.id));
        break;
      case 'materials':
        setSelectedMaterials(selectedMaterials.length === projectMaterials.length ? [] : projectMaterials.map(m => m.id));
        break;
      case 'timeEntries':
        setSelectedTimeEntries(selectedTimeEntries.length === timeEntries.length ? [] : timeEntries.map(t => t.id));
        break;
    }
  };

  const handleCreateInvoice = async () => {
    const totals = calculateTotals();

    if (totals.netTotal === 0) {
      toast({
        title: "Keine Positionen",
        description: "Bitte wählen Sie mindestens eine Position aus.",
        variant: "destructive"
      });
      return;
    }

    setCreating(true);
    try {
      // Create invoice (invoice_number is auto-generated by DB trigger)
      const { data: invoiceData, error: invoiceError } = await supabase
        .from('invoices')
        .insert({
          company_id: companyId,
          project_id: projectId,
          customer_id: customerId as string,
          title: `Rechnung – ${projectName}`,
          invoice_date: invoiceDate,
          due_date: dueDate,
          tax_rate: taxRate,
          net_amount: totals.netTotal,
          tax_amount: totals.taxTotal,
          gross_amount: totals.grossTotal,
          status: 'draft',
          invoice_number: '' // auto-generated by trigger
        } as any)
        .select()
        .single();

      if (invoiceError) throw invoiceError;

      // Create document items grouped by date:
      // For each day: section header → description → materials → hours
      // Items with quantity=0 and unit_price=0 are rendered as section headers in InvoicePrintView
      const docItems: Array<{
        invoice_id: string;
        position: number;
        description: string;
        quantity: number;
        unit: string;
        unit_price: number;
        total_price: number;
        company_id: string | null;
      }> = [];
      let positionNumber = 1;

      // 1. Offer items first (contract items, no date grouping)
      if (includeOfferItems) {
        selectedOffers.forEach(offerId => {
          const offer = offers.find(o => o.id === offerId);
          if (offer) {
            offer.items.forEach(item => {
              docItems.push({
                invoice_id: invoiceData.id,
                position: positionNumber++,
                description: item.description,
                quantity: item.quantity,
                unit: item.unit,
                unit_price: item.unit_price_net,
                total_price: item.quantity * item.unit_price_net,
                company_id: companyId
              });
            });
          }
        });
      }

      // 2. Build items based on selected format
      if (invoiceFormat === 'daily') {
        // === TAGESWEISE: Grouped by date ===
        const dailyData: Record<string, {
          descriptions: string[];
          materials: Array<{ name: string; quantity: number; unit: string; unit_price: number }>;
          hours: Array<{ employee: string; hours: number; description: string; rate: number }>;
        }> = {};

        if (selectedDeliveryNotes.length > 0) {
          selectedDeliveryNotes.forEach(dnId => {
            const dn = deliveryNotes.find(d => d.id === dnId);
            if (!dn) return;
            const dateKey = dn.work_date;
            if (!dailyData[dateKey]) {
              dailyData[dateKey] = { descriptions: [], materials: [], hours: [] };
            }
            if (dn.description) {
              dailyData[dateKey].descriptions.push(dn.description);
            }
            if (includeDeliveryNoteMaterials) {
              dn.materials.forEach(mat => {
                dailyData[dateKey].materials.push({
                  name: mat.material_name,
                  quantity: mat.material_quantity,
                  unit: mat.material_unit,
                  unit_price: mat.unit_price
                });
              });
            }
            if (includeDeliveryNoteHours && dn.hours > 0) {
              dailyData[dateKey].hours.push({
                employee: dn.employee_name,
                hours: dn.hours,
                description: dn.description || '',
                rate: dn.hourly_rate
              });
            }
          });
        }

        if (includeTimeEntries) {
          selectedTimeEntries.forEach(teId => {
            const te = timeEntries.find(t => t.id === teId);
            if (!te || te.hours <= 0) return;
            const dateKey = te.date;
            if (!dailyData[dateKey]) {
              dailyData[dateKey] = { descriptions: [], materials: [], hours: [] };
            }
            if (te.description && !dailyData[dateKey].descriptions.includes(te.description)) {
              dailyData[dateKey].descriptions.push(te.description);
            }
            dailyData[dateKey].hours.push({
              employee: te.employee_name,
              hours: te.hours,
              description: te.description || '',
              rate: te.hourly_rate
            });
          });
        }

        const sortedDates = Object.keys(dailyData).sort();
        sortedDates.forEach(dateKey => {
          const day = dailyData[dateKey];
          const dateLabel = new Date(dateKey).toLocaleDateString('de-DE', {
            weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric'
          });
          const descText = day.descriptions.length > 0 ? day.descriptions.join('; ') : '';
          docItems.push({
            invoice_id: invoiceData.id,
            position: positionNumber++,
            description: `§DATE§${dateLabel}${descText ? '§DESC§' + descText : ''}`,
            quantity: 0, unit: '', unit_price: 0, total_price: 0,
            company_id: companyId
          });

          day.materials.forEach(mat => {
            docItems.push({
              invoice_id: invoiceData.id,
              position: positionNumber++,
              description: mat.name,
              quantity: mat.quantity,
              unit: mat.unit,
              unit_price: mat.unit_price,
              total_price: mat.quantity * mat.unit_price,
              company_id: companyId
            });
          });

          day.hours.forEach(h => {
            docItems.push({
              invoice_id: invoiceData.id,
              position: positionNumber++,
              description: `Arbeitszeit – ${h.employee}`,
              quantity: Math.round(h.hours * 100) / 100,
              unit: 'Std',
              unit_price: h.rate,
              total_price: Math.round(h.hours * h.rate * 100) / 100,
              company_id: companyId
            });
          });
        });
      } else {
        // === ZUSAMMENGEFASST: All materials listed, hours per employee ===

        // Collect all descriptions
        const allDescriptions: string[] = [];
        if (selectedDeliveryNotes.length > 0) {
          selectedDeliveryNotes.forEach(dnId => {
            const dn = deliveryNotes.find(d => d.id === dnId);
            if (dn?.description && !allDescriptions.includes(dn.description)) {
              allDescriptions.push(dn.description);
            }
          });
        }
        if (includeTimeEntries) {
          selectedTimeEntries.forEach(teId => {
            const te = timeEntries.find(t => t.id === teId);
            if (te?.description && !allDescriptions.includes(te.description)) {
              allDescriptions.push(te.description);
            }
          });
        }

        // Combined description as first item (if any) — AI summary or fallback
        if (allDescriptions.length > 0) {
          let summaryText: string;
          if (isOpenAIConfigured() && allDescriptions.length > 1) {
            try {
              summaryText = await summarizeInvoiceDescriptions(allDescriptions, projectName, summaryLength);
            } catch (e) {
              summaryText = allDescriptions.join('; ');
            }
          } else {
            summaryText = allDescriptions.join('; ');
          }
          docItems.push({
            invoice_id: invoiceData.id,
            position: positionNumber++,
            description: `Ausgeführte Arbeiten: ${summaryText}`,
            quantity: 0, unit: '', unit_price: 0, total_price: 0,
            company_id: companyId
          });
        }

        // All materials listed directly
        const allMaterials: Array<{ name: string; quantity: number; unit: string; unit_price: number }> = [];
        if (includeDeliveryNoteMaterials && selectedDeliveryNotes.length > 0) {
          selectedDeliveryNotes.forEach(dnId => {
            const dn = deliveryNotes.find(d => d.id === dnId);
            if (!dn) return;
            dn.materials.forEach(mat => {
              // Merge same materials
              const existing = allMaterials.find(m => m.name === mat.material_name && m.unit_price === mat.unit_price);
              if (existing) {
                existing.quantity += mat.material_quantity;
              } else {
                allMaterials.push({
                  name: mat.material_name,
                  quantity: mat.material_quantity,
                  unit: mat.material_unit,
                  unit_price: mat.unit_price
                });
              }
            });
          });
        }

        allMaterials.forEach(mat => {
          docItems.push({
            invoice_id: invoiceData.id,
            position: positionNumber++,
            description: mat.name,
            quantity: mat.quantity,
            unit: mat.unit,
            unit_price: mat.unit_price,
            total_price: mat.quantity * mat.unit_price,
            company_id: companyId
          });
        });

        // Hours summarized per employee (with individual rates)
        const employeeData: Record<string, { hours: number; rate: number }> = {};
        if (includeDeliveryNoteHours && selectedDeliveryNotes.length > 0) {
          selectedDeliveryNotes.forEach(dnId => {
            const dn = deliveryNotes.find(d => d.id === dnId);
            if (!dn || dn.hours <= 0) return;
            if (!employeeData[dn.employee_name]) employeeData[dn.employee_name] = { hours: 0, rate: dn.hourly_rate };
            employeeData[dn.employee_name].hours += dn.hours;
          });
        }
        if (includeTimeEntries) {
          selectedTimeEntries.forEach(teId => {
            const te = timeEntries.find(t => t.id === teId);
            if (!te || te.hours <= 0) return;
            if (!employeeData[te.employee_name]) employeeData[te.employee_name] = { hours: 0, rate: te.hourly_rate };
            employeeData[te.employee_name].hours += te.hours;
          });
        }

        Object.entries(employeeData).forEach(([employee, { hours, rate }]) => {
          docItems.push({
            invoice_id: invoiceData.id,
            position: positionNumber++,
            description: `Arbeitszeit – ${employee}`,
            quantity: Math.round(hours * 100) / 100,
            unit: 'Std',
            unit_price: rate,
            total_price: Math.round(hours * rate * 100) / 100,
            company_id: companyId
          });
        });
      }

      // 3. Standalone project materials (not part of delivery notes)
      if (includeProjectMaterials) {
        selectedMaterials.forEach(matId => {
          const mat = projectMaterials.find(m => m.id === matId);
          if (mat) {
            docItems.push({
              invoice_id: invoiceData.id,
              position: positionNumber++,
              description: mat.name + (mat.supplier ? ` (${mat.supplier})` : ''),
              quantity: mat.quantity,
              unit: mat.unit,
              unit_price: mat.unit_price,
              total_price: mat.total_price,
              company_id: companyId
            });
          }
        });
      }

      // Insert items into document_items table
      if (docItems.length > 0) {
        const { error: itemsError } = await supabase
          .from('document_items')
          .insert(docItems);
        if (itemsError) throw itemsError;
      }

      toast({
        title: "Rechnung erstellt",
        description: "Rechnung wird im Editor geöffnet..."
      });

      onInvoiceCreated?.(invoiceData.id);
      onClose();

    } catch (error: any) {
      console.error('Error creating invoice:', error);
      toast({
        title: "Fehler",
        description: `Rechnung konnte nicht erstellt werden: ${error?.message || JSON.stringify(error)}`,
        variant: "destructive"
      });
    } finally {
      setCreating(false);
    }
  };

  const totals = calculateTotals();
  const hasSelections = selectedOffers.length > 0 || selectedDeliveryNotes.length > 0 || selectedTimeEntries.length > 0;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-emerald-50">
              <Receipt className="h-5 w-5 text-emerald-600" />
            </div>
            <div>
              <DialogTitle className="text-xl">Rechnung erstellen</DialogTitle>
              <p className="text-sm text-slate-500 mt-0.5">{projectName}</p>
            </div>
          </div>
        </DialogHeader>

        {loading ? (
          <div className="space-y-4 py-4">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
          </div>
        ) : (
          <div className="space-y-6 py-4">
            {/* Step indicator */}
            <div className="flex items-center gap-2 text-sm">
              <span className={`px-3 py-1 rounded-full ${step === 'select' ? 'bg-emerald-100 text-emerald-700 font-medium' : 'bg-slate-100 text-slate-500'}`}>
                1. Auswählen
              </span>
              <ChevronRight className="h-4 w-4 text-slate-300" />
              <span className={`px-3 py-1 rounded-full ${step === 'configure' ? 'bg-emerald-100 text-emerald-700 font-medium' : 'bg-slate-100 text-slate-500'}`}>
                2. Konfigurieren
              </span>
            </div>

            {step === 'select' && (
              <>
                {/* Offers */}
                {offers.length > 0 && (
                  <Card className="border-slate-200">
                    <CardHeader className="py-3 px-4 border-b border-slate-100 bg-orange-50/50">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-sm font-semibold text-orange-700 flex items-center gap-2">
                          <FileText className="h-4 w-4" />
                          Angebote ({offers.length})
                        </CardTitle>
                        <Button variant="ghost" size="sm" onClick={() => handleSelectAll('offers')} className="text-xs">
                          {selectedOffers.length === offers.length ? 'Keine' : 'Alle'} auswählen
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent className="p-0 divide-y divide-slate-100">
                      {offers.map(offer => (
                        <label
                          key={offer.id}
                          className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50 cursor-pointer"
                        >
                          <Checkbox
                            checked={selectedOffers.includes(offer.id)}
                            onCheckedChange={(checked) => {
                              setSelectedOffers(prev =>
                                checked ? [...prev, offer.id] : prev.filter(id => id !== offer.id)
                              );
                            }}
                          />
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-slate-800">{offer.offer_number}</span>
                              <Badge variant="outline" className="text-[10px] bg-green-50 text-green-700">
                                {offer.status === 'accepted' ? 'Angenommen' : 'Versendet'}
                              </Badge>
                            </div>
                            <p className="text-xs text-slate-500">{offer.items.length} Positionen</p>
                          </div>
                          <span className="font-semibold text-slate-800">
                            {formatCurrency(offer.snapshot_gross_total || 0)}
                          </span>
                        </label>
                      ))}
                    </CardContent>
                  </Card>
                )}

                {/* Delivery Notes */}
                {deliveryNotes.length > 0 && (
                  <Card className="border-slate-200">
                    <CardHeader className="py-3 px-4 border-b border-slate-100 bg-teal-50/50">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-sm font-semibold text-teal-700 flex items-center gap-2">
                          <ClipboardList className="h-4 w-4" />
                          Lieferscheine ({deliveryNotes.length})
                        </CardTitle>
                        <Button variant="ghost" size="sm" onClick={() => handleSelectAll('deliveryNotes')} className="text-xs">
                          {selectedDeliveryNotes.length === deliveryNotes.length ? 'Keine' : 'Alle'} auswählen
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent className="p-0 divide-y divide-slate-100 max-h-[200px] overflow-y-auto">
                      {deliveryNotes.map(dn => (
                        <label
                          key={dn.id}
                          className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50 cursor-pointer"
                        >
                          <Checkbox
                            checked={selectedDeliveryNotes.includes(dn.id)}
                            onCheckedChange={(checked) => {
                              setSelectedDeliveryNotes(prev =>
                                checked ? [...prev, dn.id] : prev.filter(id => id !== dn.id)
                              );
                            }}
                          />
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-slate-800">{dn.delivery_note_number}</span>
                              <span className="text-xs text-slate-400">{formatDate(dn.work_date)}</span>
                            </div>
                            <p className="text-xs text-slate-500">
                              {dn.employee_name} · {dn.hours.toFixed(1)}h
                              {dn.materials.length > 0 && ` · ${dn.materials.length} Material`}
                            </p>
                          </div>
                        </label>
                      ))}
                    </CardContent>
                  </Card>
                )}

                {/* Time Entries */}
                {timeEntries.length > 0 && (
                  <Card className="border-slate-200">
                    <CardHeader className="py-3 px-4 border-b border-slate-100 bg-slate-50/50">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                          <Clock className="h-4 w-4" />
                          Manuelle Zeiteinträge ({timeEntries.length})
                        </CardTitle>
                        <Button variant="ghost" size="sm" onClick={() => handleSelectAll('timeEntries')} className="text-xs">
                          {selectedTimeEntries.length === timeEntries.length ? 'Keine' : 'Alle'} auswählen
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent className="p-0 divide-y divide-slate-100 max-h-[200px] overflow-y-auto">
                      {timeEntries.map(te => (
                        <label
                          key={te.id}
                          className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50 cursor-pointer"
                        >
                          <Checkbox
                            checked={selectedTimeEntries.includes(te.id)}
                            onCheckedChange={(checked) => {
                              setSelectedTimeEntries(prev =>
                                checked ? [...prev, te.id] : prev.filter(id => id !== te.id)
                              );
                            }}
                          />
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-slate-800">{te.employee_name}</span>
                              <span className="text-xs text-slate-400">{formatDate(te.date)}</span>
                            </div>
                            <p className="text-xs text-slate-500 truncate">{te.description || '—'}</p>
                          </div>
                          <span className="text-sm font-medium text-slate-600">{te.hours.toFixed(1)}h</span>
                        </label>
                      ))}
                    </CardContent>
                  </Card>
                )}

                {/* Project Materials */}
                {projectMaterials.length > 0 && (
                  <Card className="border-slate-200 overflow-hidden">
                    <CardHeader className="py-3 px-4 border-b border-slate-100 bg-purple-50/50">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-sm font-semibold text-purple-700 m-0 flex items-center gap-2">
                          <Package className="h-4 w-4" />
                          Materialien ({projectMaterials.length})
                        </CardTitle>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleSelectAll('materials')}
                          className="h-7 text-xs text-purple-600 hover:text-purple-800"
                        >
                          {selectedMaterials.length === projectMaterials.length ? 'Keine' : 'Alle'} auswählen
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent className="p-0 divide-y divide-slate-100 max-h-[200px] overflow-y-auto">
                      {projectMaterials.map(mat => (
                        <label
                          key={mat.id}
                          className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50 cursor-pointer"
                        >
                          <Checkbox
                            checked={selectedMaterials.includes(mat.id)}
                            onCheckedChange={(checked) => {
                              setSelectedMaterials(prev =>
                                checked ? [...prev, mat.id] : prev.filter(id => id !== mat.id)
                              );
                            }}
                          />
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-slate-800">{mat.name}</span>
                              {mat.supplier && (
                                <span className="text-xs text-slate-400">({mat.supplier})</span>
                              )}
                            </div>
                            <p className="text-xs text-slate-500">
                              {mat.quantity} {mat.unit} × {formatCurrency(mat.unit_price)}
                            </p>
                          </div>
                          <span className="text-sm font-medium text-slate-600">{formatCurrency(mat.total_price)}</span>
                        </label>
                      ))}
                    </CardContent>
                  </Card>
                )}

                {/* Empty state */}
                {offers.length === 0 && deliveryNotes.length === 0 && timeEntries.length === 0 && projectMaterials.length === 0 && (
                  <div className="text-center py-8">
                    <AlertCircle className="h-10 w-10 text-slate-300 mx-auto mb-3" />
                    <p className="text-slate-500">Keine abrechenbaren Daten vorhanden</p>
                    <p className="text-xs text-slate-400 mt-1">Erstellen Sie zuerst Angebote, Lieferscheine oder Materialien</p>
                  </div>
                )}
              </>
            )}

            {step === 'configure' && (
              <>
                {/* Invoice Type & Dates */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>Rechnungstyp</Label>
                    <Select value={invoiceType} onValueChange={setInvoiceType}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="final">Schlussrechnung</SelectItem>
                        <SelectItem value="partial">Teilrechnung</SelectItem>
                        <SelectItem value="advance">Abschlagsrechnung</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Rechnungsdatum</Label>
                    <Input
                      type="date"
                      value={invoiceDate}
                      onChange={(e) => setInvoiceDate(e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Fällig am</Label>
                    <Input
                      type="date"
                      value={dueDate}
                      onChange={(e) => setDueDate(e.target.value)}
                    />
                  </div>
                </div>

                {/* Tax & Hourly Rate */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>MwSt.-Satz</Label>
                    <Select value={String(taxRate)} onValueChange={(v) => setTaxRate(Number(v))}>
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

                {/* Include Options */}
                <Card className="border-slate-200">
                  <CardHeader className="py-3 px-4 border-b border-slate-100">
                    <CardTitle className="text-sm font-semibold text-slate-700">
                      Was soll abgerechnet werden?
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-4 space-y-3">
                    {selectedOffers.length > 0 && (
                      <label className="flex items-center gap-3 cursor-pointer">
                        <Checkbox
                          checked={includeOfferItems}
                          onCheckedChange={(checked) => setIncludeOfferItems(!!checked)}
                        />
                        <span className="text-sm">Angebotspositionen ({selectedOffers.length} Angebote)</span>
                      </label>
                    )}

                    {selectedDeliveryNotes.length > 0 && (
                      <>
                        <label className="flex items-center gap-3 cursor-pointer">
                          <Checkbox
                            checked={includeDeliveryNoteHours}
                            onCheckedChange={(checked) => setIncludeDeliveryNoteHours(!!checked)}
                          />
                          <span className="text-sm">Arbeitszeiten aus Lieferscheinen</span>
                        </label>

                        <label className="flex items-center gap-3 cursor-pointer">
                          <Checkbox
                            checked={includeDeliveryNoteMaterials}
                            onCheckedChange={(checked) => setIncludeDeliveryNoteMaterials(!!checked)}
                          />
                          <span className="text-sm">Material aus Lieferscheinen</span>
                        </label>
                      </>
                    )}

                    {selectedTimeEntries.length > 0 && (
                      <label className="flex items-center gap-3 cursor-pointer">
                        <Checkbox
                          checked={includeTimeEntries}
                          onCheckedChange={(checked) => setIncludeTimeEntries(!!checked)}
                        />
                        <span className="text-sm">Manuelle Zeiteinträge ({selectedTimeEntries.length})</span>
                      </label>
                    )}

                    {selectedMaterials.length > 0 && (
                      <label className="flex items-center gap-3 cursor-pointer">
                        <Checkbox
                          checked={includeProjectMaterials}
                          onCheckedChange={(checked) => setIncludeProjectMaterials(!!checked)}
                        />
                        <span className="text-sm">Projekt-Materialien ({selectedMaterials.length})</span>
                      </label>
                    )}
                  </CardContent>
                </Card>

                {/* Invoice Format Toggle */}
                <Card className="border-slate-200">
                  <CardHeader className="py-3 px-4 border-b border-slate-100">
                    <CardTitle className="text-sm font-semibold text-slate-700">
                      Rechnungsformat
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-4">
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setInvoiceFormat('daily')}
                        className={`p-3 rounded-lg border-2 text-left transition-all ${
                          invoiceFormat === 'daily'
                            ? 'border-emerald-500 bg-emerald-50'
                            : 'border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        <p className={`text-sm font-semibold ${invoiceFormat === 'daily' ? 'text-emerald-700' : 'text-slate-700'}`}>
                          Tagesweise
                        </p>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          Pro Tag: Datum, Beschreibung, Material, Stunden
                        </p>
                      </button>
                      <button
                        type="button"
                        onClick={() => setInvoiceFormat('summary')}
                        className={`p-3 rounded-lg border-2 text-left transition-all ${
                          invoiceFormat === 'summary'
                            ? 'border-emerald-500 bg-emerald-50'
                            : 'border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        <p className={`text-sm font-semibold ${invoiceFormat === 'summary' ? 'text-emerald-700' : 'text-slate-700'}`}>
                          Zusammengefasst
                        </p>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          Material gelistet, Stunden pro Mitarbeiter
                        </p>
                      </button>
                    </div>

                    {invoiceFormat === 'summary' && isOpenAIConfigured() && (
                      <div className="mt-3 pt-3 border-t border-slate-100">
                        <p className="text-xs font-medium text-slate-600 mb-2">KI-Zusammenfassung — Textlänge</p>
                        <div className="flex gap-1.5">
                          {([
                            { value: 'kurz' as SummaryLength, label: 'Kurz', desc: '2-3 Sätze' },
                            { value: 'mittel' as SummaryLength, label: 'Mittel', desc: '4-6 Sätze' },
                            { value: 'ausfuehrlich' as SummaryLength, label: 'Ausführlich', desc: 'Sehr detailliert' },
                          ]).map(opt => (
                            <button
                              key={opt.value}
                              type="button"
                              onClick={() => setSummaryLength(opt.value)}
                              className={`flex-1 px-2 py-1.5 rounded-md text-center transition-all ${
                                summaryLength === opt.value
                                  ? 'bg-emerald-100 border border-emerald-400 text-emerald-700'
                                  : 'bg-slate-50 border border-slate-200 text-slate-600 hover:border-slate-300'
                              }`}
                            >
                              <span className="text-xs font-medium block">{opt.label}</span>
                              <span className="text-[10px] text-slate-400 block">{opt.desc}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Preview Totals */}
                <Card className="border-emerald-200 bg-emerald-50">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Euro className="h-5 w-5 text-emerald-600" />
                        <span className="font-semibold text-emerald-800">Vorschau</span>
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-emerald-600">Netto: {formatCurrency(totals.netTotal)}</p>
                        <p className="text-sm text-emerald-600">MwSt.: {formatCurrency(totals.taxTotal)}</p>
                        <p className="text-lg font-bold text-emerald-800">Brutto: {formatCurrency(totals.grossTotal)}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </>
            )}
          </div>
        )}

        <DialogFooter className="gap-2">
          {step === 'select' && (
            <>
              <Button variant="outline" onClick={onClose}>
                Abbrechen
              </Button>
              <Button
                onClick={() => setStep('configure')}
                disabled={!hasSelections}
                className="bg-emerald-600 hover:bg-emerald-700"
              >
                Weiter
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </>
          )}

          {step === 'configure' && (
            <>
              <Button variant="outline" onClick={() => setStep('select')}>
                Zurück
              </Button>
              <Button
                onClick={handleCreateInvoice}
                disabled={creating || totals.netTotal === 0}
                className="bg-emerald-600 hover:bg-emerald-700"
              >
                {creating ? 'Erstelle...' : 'Rechnung erstellen'}
                <Check className="h-4 w-4 ml-1" />
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default CreateInvoiceFromProjectDialog;
