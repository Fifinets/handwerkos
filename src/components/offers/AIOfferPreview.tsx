import React from 'react';
import { Check, Loader2, Package, Clock, Truck, Wrench } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { AIGeneratedPosition } from '@/types/aiOffer';

const ITEM_TYPE_ICONS: Record<string, React.ElementType> = {
  labor: Clock,
  material: Package,
  travel: Truck,
  lump_sum: Wrench,
  material_lump_sum: Package,
  small_material: Package,
  other: Package,
};

const ITEM_TYPE_COLORS: Record<string, string> = {
  labor: 'bg-blue-50 text-blue-700 border-blue-200',
  material: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  travel: 'bg-amber-50 text-amber-700 border-amber-200',
  lump_sum: 'bg-violet-50 text-violet-700 border-violet-200',
  material_lump_sum: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  small_material: 'bg-orange-50 text-orange-700 border-orange-200',
  other: 'bg-gray-50 text-gray-700 border-gray-200',
};

function formatCurrency(val: number): string {
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(val);
}

interface AIOfferPreviewProps {
  positions: AIGeneratedPosition[];
  isStreaming: boolean;
  onAccept: (positions: AIGeneratedPosition[]) => void;
  onAcceptSingle?: (position: AIGeneratedPosition) => void;
}

export function AIOfferPreview({ positions, isStreaming, onAccept, onAcceptSingle }: AIOfferPreviewProps) {
  if (positions.length === 0 && !isStreaming) return null;

  const totalNet = positions.reduce((sum, p) => sum + p.quantity * p.unit_price_net, 0);
  const totalHours = positions.reduce((sum, p) => sum + (p.planned_hours_item || 0), 0);

  return (
    <div className="border-t bg-gray-50/50">
      <div className="flex items-center justify-between px-3 py-2 bg-white border-b">
        <div className="flex items-center gap-2 text-xs text-gray-500">
          {isStreaming ? (
            <>
              <Loader2 className="h-3 w-3 animate-spin text-blue-500" />
              <span>Generiere Positionen...</span>
            </>
          ) : (
            <>
              <Check className="h-3 w-3 text-green-500" />
              <span>{positions.length} Positionen</span>
              <span className="text-gray-300">|</span>
              <span>{totalHours.toFixed(1)}h</span>
              <span className="text-gray-300">|</span>
              <span className="font-medium text-gray-700">{formatCurrency(totalNet)}</span>
            </>
          )}
        </div>
        {!isStreaming && positions.length > 0 && (
          <Button size="sm" onClick={() => onAccept(positions)} className="h-7 text-xs gap-1">
            <Check className="h-3 w-3" />
            Alle uebernehmen
          </Button>
        )}
      </div>

      <ScrollArea className="max-h-[280px]">
        <div className="p-2 space-y-1">
          {positions.map((pos, idx) => {
            const Icon = ITEM_TYPE_ICONS[pos.item_type] || Package;
            const colorClass = ITEM_TYPE_COLORS[pos.item_type] || ITEM_TYPE_COLORS.other;
            const lineTotal = pos.quantity * pos.unit_price_net;

            return (
              <div
                key={idx}
                className="group flex items-start gap-2 p-2 rounded-md hover:bg-white hover:shadow-sm transition-all text-xs border border-transparent hover:border-gray-200"
              >
                <div className={`flex-shrink-0 w-6 h-6 rounded flex items-center justify-center border ${colorClass}`}>
                  <Icon className="h-3 w-3" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-800 leading-tight truncate">{pos.description}</p>
                  <div className="flex items-center gap-2 mt-0.5 text-gray-400">
                    <span>{pos.quantity} {pos.unit}</span>
                    <span>x</span>
                    <span>{formatCurrency(pos.unit_price_net)}</span>
                    {pos.planned_hours_item ? (
                      <span className="text-blue-400">({pos.planned_hours_item}h)</span>
                    ) : null}
                  </div>
                </div>
                <div className="flex-shrink-0 text-right">
                  <p className="font-mono font-medium text-gray-700">{formatCurrency(lineTotal)}</p>
                  {onAcceptSingle && (
                    <button
                      onClick={() => onAcceptSingle(pos)}
                      className="text-[10px] text-blue-500 hover:text-blue-700 opacity-0 group-hover:opacity-100 transition-opacity mt-0.5"
                    >
                      + Einzeln
                    </button>
                  )}
                </div>
              </div>
            );
          })}

          {isStreaming && positions.length === 0 && (
            <div className="flex items-center justify-center py-6 text-gray-400 text-xs gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              KI denkt nach...
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
