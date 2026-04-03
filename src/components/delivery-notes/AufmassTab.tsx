// AufmassTab — planned vs actual quantity table for delivery notes

import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Download, Plus, Trash2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface AufmassItem {
  id?: string;
  description: string;
  unit: string;
  planned_quantity: number | null;
  actual_quantity: number | null;
  measurement_note: string;
  measurement_photo_url: string | null;
}

interface AufmassTabProps {
  projectId: string | null;
  items: AufmassItem[];
  onItemsChange: (items: AufmassItem[]) => void;
}

/**
 * Returns color class based on deviation between planned and actual quantity.
 * Green: within ±5%, Amber: within ±20%, Red: >20%
 */
function deviationColor(planned: number | null, actual: number | null): string {
  if (planned == null || actual == null || planned === 0) return '';
  const pct = Math.abs((actual - planned) / planned) * 100;
  if (pct <= 5) return 'text-green-600 dark:text-green-400';
  if (pct <= 20) return 'text-amber-600 dark:text-amber-400';
  return 'text-red-600 dark:text-red-400';
}

function deviationBadgeVariant(planned: number | null, actual: number | null): 'default' | 'secondary' | 'destructive' | 'outline' {
  if (planned == null || actual == null || planned === 0) return 'outline';
  const pct = Math.abs((actual - planned) / planned) * 100;
  if (pct <= 5) return 'default';      // green-ish (default badge)
  if (pct <= 20) return 'secondary';   // amber-ish
  return 'destructive';                // red
}

export function AufmassTab({ projectId, items, onItemsChange }: AufmassTabProps) {
  const [importing, setImporting] = useState(false);

  // Import offer items for the project
  const handleImportFromOffer = async () => {
    if (!projectId) {
      toast.error('Bitte zuerst ein Projekt auswählen.');
      return;
    }

    setImporting(true);
    try {
      // Load offers for this project, then their items
      const { data: offers, error: offersError } = await supabase
        .from('offers')
        .select('id')
        .eq('project_id', projectId)
        .in('status', ['accepted', 'sent']);

      if (offersError) throw offersError;

      if (!offers || offers.length === 0) {
        toast.info('Keine Angebote für dieses Projekt gefunden.');
        return;
      }

      const offerIds = offers.map(o => o.id);

      const { data: offerItems, error: itemsError } = await supabase
        .from('offer_items')
        .select('description, quantity, unit, position_number')
        .in('offer_id', offerIds)
        .order('position_number');

      if (itemsError) throw itemsError;

      if (!offerItems || offerItems.length === 0) {
        toast.info('Keine Positionen in den Angeboten gefunden.');
        return;
      }

      // Map offer items to AufmassItems, keeping existing items
      const newItems: AufmassItem[] = offerItems.map(oi => ({
        description: oi.description,
        unit: oi.unit,
        planned_quantity: oi.quantity,
        actual_quantity: null,
        measurement_note: '',
        measurement_photo_url: null,
      }));

      // Merge: keep existing items, append new ones that don't already exist (by description)
      const existingDescriptions = new Set(items.map(i => i.description));
      const toAdd = newItems.filter(ni => !existingDescriptions.has(ni.description));

      if (toAdd.length === 0) {
        toast.info('Alle Angebotspositionen sind bereits vorhanden.');
        return;
      }

      onItemsChange([...items, ...toAdd]);
      toast.success(`${toAdd.length} Position(en) aus Angebot importiert.`);
    } catch (err) {
      console.error('Import from offer failed:', err);
      toast.error('Fehler beim Import der Angebotspositionen.');
    } finally {
      setImporting(false);
    }
  };

  // Add a manual row
  const addManualRow = () => {
    onItemsChange([
      ...items,
      {
        description: '',
        unit: 'Stk',
        planned_quantity: null,
        actual_quantity: null,
        measurement_note: '',
        measurement_photo_url: null,
      },
    ]);
  };

  // Update a single field on an item
  const updateItem = (index: number, field: keyof AufmassItem, value: any) => {
    const updated = [...items];
    updated[index] = { ...updated[index], [field]: value };
    onItemsChange(updated);
  };

  // Remove an item
  const removeItem = (index: number) => {
    onItemsChange(items.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-4">
      {/* Action buttons */}
      <div className="flex gap-2">
        <Button
          type="button"
          variant="outline"
          className="flex-1"
          disabled={importing || !projectId}
          onClick={handleImportFromOffer}
        >
          <Download className="h-4 w-4 mr-2" />
          {importing ? 'Wird importiert...' : 'Aus Angebot importieren'}
        </Button>
        <Button type="button" variant="outline" onClick={addManualRow}>
          <Plus className="h-4 w-4 mr-2" />
          Zeile hinzufügen
        </Button>
      </div>

      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-4">
          Noch keine Aufmaß-Positionen. Importieren Sie aus einem Angebot oder fügen Sie manuell hinzu.
        </p>
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">Pos</TableHead>
                  <TableHead>Beschreibung</TableHead>
                  <TableHead className="w-20">Einheit</TableHead>
                  <TableHead className="w-20 text-right">Geplant</TableHead>
                  <TableHead className="w-24 text-right">Tatsächlich</TableHead>
                  <TableHead className="w-24 text-right">Differenz</TableHead>
                  <TableHead className="w-40">Notiz</TableHead>
                  <TableHead className="w-10"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item, index) => {
                  const diff =
                    item.planned_quantity != null && item.actual_quantity != null
                      ? item.actual_quantity - item.planned_quantity
                      : null;
                  const diffPct =
                    diff != null && item.planned_quantity != null && item.planned_quantity !== 0
                      ? ((diff / item.planned_quantity) * 100).toFixed(0)
                      : null;

                  return (
                    <TableRow key={index}>
                      {/* Pos */}
                      <TableCell className="text-muted-foreground text-xs">
                        {index + 1}
                      </TableCell>

                      {/* Beschreibung */}
                      <TableCell>
                        {item.planned_quantity != null ? (
                          <span className="text-sm">{item.description}</span>
                        ) : (
                          <Input
                            value={item.description}
                            onChange={(e) => updateItem(index, 'description', e.target.value)}
                            placeholder="Beschreibung..."
                            className="h-8 text-sm"
                          />
                        )}
                      </TableCell>

                      {/* Einheit */}
                      <TableCell>
                        {item.planned_quantity != null ? (
                          <span className="text-sm text-muted-foreground">{item.unit}</span>
                        ) : (
                          <Input
                            value={item.unit}
                            onChange={(e) => updateItem(index, 'unit', e.target.value)}
                            placeholder="Stk"
                            className="h-8 text-sm w-16"
                          />
                        )}
                      </TableCell>

                      {/* Geplant */}
                      <TableCell className="text-right text-sm">
                        {item.planned_quantity != null ? (
                          item.planned_quantity
                        ) : (
                          <Input
                            type="number"
                            value={item.planned_quantity ?? ''}
                            onChange={(e) =>
                              updateItem(index, 'planned_quantity', e.target.value ? Number(e.target.value) : null)
                            }
                            placeholder="—"
                            className="h-8 text-sm text-right w-16"
                          />
                        )}
                      </TableCell>

                      {/* Tatsächlich */}
                      <TableCell className="text-right">
                        <Input
                          type="number"
                          value={item.actual_quantity ?? ''}
                          onChange={(e) =>
                            updateItem(index, 'actual_quantity', e.target.value ? Number(e.target.value) : null)
                          }
                          placeholder="—"
                          className="h-8 text-sm text-right w-20"
                        />
                      </TableCell>

                      {/* Differenz */}
                      <TableCell className="text-right">
                        {diff != null ? (
                          <Badge variant={deviationBadgeVariant(item.planned_quantity, item.actual_quantity)}>
                            <span className={deviationColor(item.planned_quantity, item.actual_quantity)}>
                              {diff > 0 ? '+' : ''}{diff} {item.unit}
                              {diffPct != null && ` (${diffPct}%)`}
                            </span>
                          </Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>

                      {/* Notiz */}
                      <TableCell>
                        <Textarea
                          value={item.measurement_note}
                          onChange={(e) => updateItem(index, 'measurement_note', e.target.value)}
                          placeholder="Notiz..."
                          className="h-8 min-h-[32px] text-sm resize-none"
                          rows={1}
                        />
                      </TableCell>

                      {/* Delete */}
                      <TableCell>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-destructive"
                          onClick={() => removeItem(index)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
