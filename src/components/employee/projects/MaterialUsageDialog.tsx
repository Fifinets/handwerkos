// Dialog zum Verbuchen von Material auf ein Projekt.
// Lädt den Material-Katalog der Firma (RLS-gescoped), lässt den Mitarbeiter per
// Suche ein Material wählen, Menge + Notiz erfassen und speichert über
// useRecordMaterialUsage (schreibt NUR echte Spalten von employee_material_usage).

import { useEffect, useMemo, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Package } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useEmployeePermissions } from '@/hooks/useEmployeePermissions';
import { useSupabaseAuth } from '@/hooks/useSupabaseAuth';
import { buildMaterialUsageInsert, useRecordMaterialUsage } from '@/hooks/useEmployeeMaterialUsage';
import { cn } from '@/lib/utils';

interface MaterialCatalogItem {
  id: string;
  name: string;
  sku: string | null;
  unit: string;
  unit_price: number | null;
  category: string | null;
}

interface MaterialUsageDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
}

const formatEUR = (value: number) =>
  new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(value);

export function MaterialUsageDialog({ open, onOpenChange, projectId }: MaterialUsageDialogProps) {
  const { employee, canViewPrices } = useEmployeePermissions();
  const { user } = useSupabaseAuth();
  const { mutateAsync, isPending } = useRecordMaterialUsage(projectId);

  const [materials, setMaterials] = useState<MaterialCatalogItem[]>([]);
  const [isLoadingMaterials, setIsLoadingMaterials] = useState(false);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<MaterialCatalogItem | null>(null);
  const [quantity, setQuantity] = useState('');
  const [notes, setNotes] = useState('');

  // Material-Katalog beim Öffnen laden
  useEffect(() => {
    if (!open) return;
    let cancelled = false;

    const fetchMaterials = async () => {
      setIsLoadingMaterials(true);
      try {
        const { data, error } = await supabase
          .from('materials')
          .select('id, name, sku, unit, unit_price, category')
          .order('name');
        if (error) throw error;
        if (!cancelled) setMaterials(data || []);
      } catch (err) {
        console.error('Error fetching materials:', err);
      } finally {
        if (!cancelled) setIsLoadingMaterials(false);
      }
    };

    fetchMaterials();
    return () => {
      cancelled = true;
    };
  }, [open]);

  // Formular bei jedem Öffnen zurücksetzen
  useEffect(() => {
    if (open) {
      setSearch('');
      setSelected(null);
      setQuantity('');
      setNotes('');
    }
  }, [open]);

  const filteredMaterials = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return materials;
    return materials.filter(
      (m) =>
        m.name.toLowerCase().includes(term) ||
        (m.sku ? m.sku.toLowerCase().includes(term) : false)
    );
  }, [materials, search]);

  const parsedQuantity = parseFloat(quantity);
  const hasValidQuantity = quantity !== '' && !Number.isNaN(parsedQuantity) && parsedQuantity > 0;

  const estimatedValue =
    canViewPrices() && selected?.unit_price != null && hasValidQuantity
      ? selected.unit_price * parsedQuantity
      : null;

  const canSave = !!selected && hasValidQuantity && !isPending;

  const handleSave = async () => {
    if (!selected || !hasValidQuantity) return;
    if (!employee || !user) return;

    const insert = buildMaterialUsageInsert({
      projectId,
      materialId: selected.id,
      employeeId: employee.id,
      userId: user.id,
      quantity: parsedQuantity,
      notes: notes.trim() || undefined,
      usageDate: new Date().toISOString().split('T')[0],
    });

    await mutateAsync(insert);
    setSelected(null);
    setQuantity('');
    setNotes('');
    setSearch('');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5 text-blue-600" />
            Material verbuchen
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div>
            <Label>Material</Label>
            <Input
              className="mt-1"
              placeholder="Material suchen (Name oder Artikelnummer)..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <div className="mt-2 max-h-48 overflow-y-auto rounded-md border">
              {isLoadingMaterials ? (
                <p className="text-sm text-muted-foreground p-3">Wird geladen...</p>
              ) : filteredMaterials.length === 0 ? (
                <p className="text-sm text-muted-foreground p-3">Kein Material gefunden.</p>
              ) : (
                filteredMaterials.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setSelected(m)}
                    className={cn(
                      'flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-accent',
                      selected?.id === m.id && 'bg-accent'
                    )}
                  >
                    <span className="truncate">
                      {m.name}
                      {m.sku ? <span className="text-muted-foreground"> ({m.sku})</span> : null}
                    </span>
                    <span className="shrink-0 text-xs text-muted-foreground">{m.unit}</span>
                  </button>
                ))
              )}
            </div>
          </div>

          <div>
            <Label>Menge{selected ? ` (${selected.unit})` : ''}</Label>
            <Input
              className="mt-1"
              type="number"
              inputMode="decimal"
              step="any"
              min={0}
              placeholder="0"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
            />
          </div>

          <div>
            <Label>Notiz (optional)</Label>
            <Textarea
              className="mt-1"
              rows={2}
              placeholder="Zusätzliche Hinweise..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          {estimatedValue != null && (
            <p className="text-sm text-muted-foreground">
              Geschätzter Wert: {formatEUR(estimatedValue)}
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Abbrechen
          </Button>
          <Button onClick={handleSave} disabled={!canSave}>
            {isPending ? 'Speichern...' : 'Verbuchen'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default MaterialUsageDialog;
