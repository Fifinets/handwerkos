import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent } from '@/components/ui/card';
import { Plus, Trash2, GripVertical } from 'lucide-react';
import {
  OfferItem,
  OfferItemCreate,
  OfferItemType,
  OFFER_ITEM_TYPE_LABELS,
  OFFER_ITEM_UNITS,
} from '@/types/offer';

interface OfferItemsEditorProps {
  items: (OfferItem | OfferItemCreate)[];
  onChange: (items: (OfferItem | OfferItemCreate)[]) => void;
  disabled?: boolean;
}

const DEFAULT_ITEM: OfferItemCreate = {
  position_number: 1,
  description: '',
  quantity: 1,
  unit: 'Stk',
  unit_price_net: 0,
  vat_rate: 19,
  item_type: 'labor',
  is_optional: false,
};

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: 'EUR',
  }).format(value);
}

export function OfferItemsEditor({
  items,
  onChange,
  disabled = false,
}: OfferItemsEditorProps) {

  const addItem = () => {
    const maxPosition = Math.max(0, ...items.map(i => i.position_number));
    const newItem: OfferItemCreate = {
      ...DEFAULT_ITEM,
      position_number: maxPosition + 1,
    };
    onChange([...items, newItem]);
  };

  const updateItem = (index: number, field: keyof OfferItemCreate, value: any) => {
    const updatedItems = [...items];
    updatedItems[index] = { ...updatedItems[index], [field]: value };
    onChange(updatedItems);
  };

  const removeItem = (index: number) => {
    const updatedItems = items.filter((_, i) => i !== index);
    // Renumber positions
    updatedItems.forEach((item, i) => {
      item.position_number = i + 1;
    });
    onChange(updatedItems);
  };

  const calculateItemTotal = (item: OfferItem | OfferItemCreate): number => {
    return item.quantity * item.unit_price_net;
  };

  const totalNet = items
    .filter(item => !item.is_optional)
    .reduce((sum, item) => sum + calculateItemTotal(item), 0);

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <Label className="text-base font-semibold">Positionen</Label>
        {!disabled && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={addItem}
          >
            <Plus className="h-4 w-4 mr-1" />
            Position hinzufügen
          </Button>
        )}
      </div>

      {items.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            Keine Positionen vorhanden. Fügen Sie eine Position hinzu.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {items.map((item, index) => (
            <Card key={index} className={item.is_optional ? 'border-dashed opacity-75' : ''}>
              <CardContent className="pt-4">
                <div className="grid grid-cols-12 gap-3">
                  {/* Position Number & Drag Handle */}
                  <div className="col-span-1 flex items-start gap-1">
                    <GripVertical className="h-5 w-5 text-muted-foreground cursor-move" />
                    <span className="text-sm font-medium text-muted-foreground">
                      {item.position_number}.
                    </span>
                  </div>

                  {/* Description */}
                  <div className="col-span-11 space-y-3">
                    <div className="grid grid-cols-12 gap-3">
                      <div className="col-span-8">
                        <Textarea
                          placeholder="Beschreibung der Leistung/des Materials"
                          value={item.description}
                          onChange={(e) => updateItem(index, 'description', e.target.value)}
                          disabled={disabled}
                          rows={2}
                          className="resize-none"
                        />
                      </div>
                      <div className="col-span-2">
                        <Select
                          value={item.item_type}
                          onValueChange={(value) => updateItem(index, 'item_type', value as OfferItemType)}
                          disabled={disabled}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {Object.entries(OFFER_ITEM_TYPE_LABELS).map(([value, label]) => (
                              <SelectItem key={value} value={value}>
                                {label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="col-span-2 flex items-center justify-end gap-2">
                        <div className="flex items-center space-x-2">
                          <Checkbox
                            id={`optional-${index}`}
                            checked={item.is_optional}
                            onCheckedChange={(checked) => updateItem(index, 'is_optional', !!checked)}
                            disabled={disabled}
                          />
                          <Label htmlFor={`optional-${index}`} className="text-xs">
                            Optional
                          </Label>
                        </div>
                        {!disabled && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => removeItem(index)}
                            className="h-8 w-8 text-destructive hover:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-12 gap-3">
                      <div className="col-span-2">
                        <Label className="text-xs text-muted-foreground">Menge</Label>
                        <Input
                          type="number"
                          step="0.001"
                          min="0"
                          value={item.quantity}
                          onChange={(e) => updateItem(index, 'quantity', parseFloat(e.target.value) || 0)}
                          disabled={disabled}
                        />
                      </div>
                      <div className="col-span-2">
                        <Label className="text-xs text-muted-foreground">Einheit</Label>
                        <Select
                          value={item.unit}
                          onValueChange={(value) => updateItem(index, 'unit', value)}
                          disabled={disabled}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {OFFER_ITEM_UNITS.map(({ value, label }) => (
                              <SelectItem key={value} value={value}>
                                {label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="col-span-2">
                        <Label className="text-xs text-muted-foreground">Einzelpreis (netto)</Label>
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          value={item.unit_price_net}
                          onChange={(e) => updateItem(index, 'unit_price_net', parseFloat(e.target.value) || 0)}
                          disabled={disabled}
                        />
                      </div>
                      <div className="col-span-2">
                        <Label className="text-xs text-muted-foreground">MwSt. %</Label>
                        <Select
                          value={String(item.vat_rate)}
                          onValueChange={(value) => updateItem(index, 'vat_rate', parseFloat(value))}
                          disabled={disabled}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="0">0%</SelectItem>
                            <SelectItem value="7">7%</SelectItem>
                            <SelectItem value="19">19%</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="col-span-4 flex items-end">
                        <div className="w-full text-right">
                          <Label className="text-xs text-muted-foreground">Gesamt (netto)</Label>
                          <div className={`text-lg font-semibold ${item.is_optional ? 'text-muted-foreground' : ''}`}>
                            {formatCurrency(calculateItemTotal(item))}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Total */}
      <div className="flex justify-end">
        <div className="text-right">
          <span className="text-sm text-muted-foreground mr-4">Summe (netto):</span>
          <span className="text-xl font-bold">{formatCurrency(totalNet)}</span>
        </div>
      </div>
    </div>
  );
}

export default OfferItemsEditor;
