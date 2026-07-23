import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { OfferItem } from '@/types/offer';
import { computeOfferCostBasis } from '@/lib/offerCostBasis';

interface OfferSummaryCardProps {
  items: OfferItem[];
  vatRate?: number;
  discountPercent?: number;
  snapshotTotals?: {
    subtotal_net: number | null;
    discount_amount: number | null;
    net_total: number | null;
    vat_amount: number | null;
    gross_total: number | null;
  };
  /** Interner Vollkostensatz (€/Std., z.B. amge_calculations.lohn_mit_agk) für die Live-Marge. */
  costRate?: number | null;
  className?: string;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: 'EUR',
  }).format(value);
}

function formatPercent(value: number): string {
  return new Intl.NumberFormat('de-DE', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(value);
}

export function OfferSummaryCard({
  items,
  vatRate = 19,
  discountPercent = 0,
  snapshotTotals,
  costRate,
  className = '',
}: OfferSummaryCardProps) {
  // Calculate from items if no snapshot
  const calculateTotals = () => {
    const nonOptionalItems = items.filter(item => !item.is_optional);
    const subtotalNet = nonOptionalItems.reduce(
      (sum, item) => sum + item.quantity * item.unit_price_net,
      0
    );
    const discountAmount = subtotalNet * (discountPercent / 100);
    const netTotal = subtotalNet - discountAmount;
    const vatAmount = netTotal * (vatRate / 100);
    const grossTotal = netTotal + vatAmount;

    return {
      subtotal_net: subtotalNet,
      discount_amount: discountAmount,
      net_total: netTotal,
      vat_amount: vatAmount,
      gross_total: grossTotal,
    };
  };

  const totals = snapshotTotals?.gross_total != null ? snapshotTotals : calculateTotals();
  const optionalTotal = items
    .filter(item => item.is_optional)
    .reduce((sum, item) => sum + item.quantity * item.unit_price_net, 0);

  const costBasis = computeOfferCostBasis(items, costRate ?? null);
  const itemsMissingCostBasis = items.filter(
    item => item.planned_hours_item == null && item.material_purchase_cost == null
  ).length;

  return (
    <Card className={className}>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Zusammenfassung</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Zwischensumme (netto)</span>
          <span>{formatCurrency(totals.subtotal_net || 0)}</span>
        </div>

        {discountPercent > 0 && (
          <div className="flex justify-between text-sm text-green-600">
            <span>Rabatt ({discountPercent}%)</span>
            <span>-{formatCurrency(totals.discount_amount || 0)}</span>
          </div>
        )}

        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Nettosumme</span>
          <span>{formatCurrency(totals.net_total || 0)}</span>
        </div>

        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">MwSt. ({vatRate}%)</span>
          <span>{formatCurrency(totals.vat_amount || 0)}</span>
        </div>

        <Separator />

        <div className="flex justify-between text-lg font-bold">
          <span>Gesamtsumme (brutto)</span>
          <span>{formatCurrency(totals.gross_total || 0)}</span>
        </div>

        <Separator />

        {costBasis.cost != null && (
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Kosten (Soll)</span>
            <span>{formatCurrency(costBasis.cost)}</span>
          </div>
        )}

        {costBasis.marginPct != null ? (
          <div className="flex justify-between text-sm font-medium">
            <span className="text-muted-foreground">Marge</span>
            <span>{formatPercent(costBasis.marginPct)} %</span>
          </div>
        ) : costRate === undefined ? null : items.length === 0 ? null : costRate === null ? (
          <p className="text-sm text-amber-600">
            Kein interner Kostensatz hinterlegt — Marge nicht berechenbar
          </p>
        ) : itemsMissingCostBasis > 0 ? (
          <p className="text-sm text-amber-600">
            Marge unvollständig — Kosten fehlen bei {itemsMissingCostBasis}{' '}
            {itemsMissingCostBasis === 1 ? 'Position' : 'Positionen'}
          </p>
        ) : null}

        {optionalTotal > 0 && (
          <>
            <Separator />
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>Optionale Positionen</span>
              <span>{formatCurrency(optionalTotal)}</span>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

export default OfferSummaryCard;
