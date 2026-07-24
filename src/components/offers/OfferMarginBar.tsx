import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { computeOfferCostBasis, OfferCostItem } from '@/lib/offerCostBasis';

interface Snapshot {
  cost: number | null;
  revenue: number | null;
  marginPct: number | null;
}

interface OfferMarginBarProps {
  items: OfferCostItem[];
  /** Interner Vollkostensatz €/Std aus amge_calculations.lohn_mit_agk. */
  costRate: number | null;
  plannedHours: number | null;
  plannedMaterial: number | null;
  onChangeTotals: (next: { plannedHours: number | null; plannedMaterial: number | null }) => void;
  isLocked?: boolean;
  snapshot?: Snapshot | null;
}

const eur = (v: number) =>
  new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(v);
const pct = (v: number) =>
  new Intl.NumberFormat('de-DE', { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(v);

const parse = (raw: string): number | null => {
  if (raw.trim() === '') return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
};

export function OfferMarginBar({
  items,
  costRate,
  plannedHours,
  plannedMaterial,
  onChangeTotals,
  isLocked = false,
  snapshot = null,
}: OfferMarginBarProps) {
  const live = computeOfferCostBasis(items, costRate, { plannedHours, plannedMaterial });

  // Gesperrt: Snapshot bevorzugen, sonst Fallback auf die normale Berechnung.
  const view =
    isLocked && snapshot && snapshot.marginPct != null
      ? { revenue: snapshot.revenue ?? 0, cost: snapshot.cost, marginPct: snapshot.marginPct, isComplete: true }
      : live;

  const marginClass = view.marginPct != null && view.marginPct < 0 ? 'text-red-600' : 'text-green-600';

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 border-t bg-background/95 backdrop-blur px-4 py-2 print:hidden">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-6 gap-y-1 text-sm">
        <span className="font-medium text-muted-foreground">Interne Kalkulation</span>

        {!isLocked && (
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Label htmlFor="mb-hours" className="text-muted-foreground">Gesamtstunden</Label>
              <Input
                id="mb-hours"
                type="number"
                className="h-8 w-24"
                value={plannedHours ?? ''}
                onChange={(e) => onChangeTotals({ plannedHours: parse(e.target.value), plannedMaterial })}
              />
            </div>
            <div className="flex items-center gap-2">
              <Label htmlFor="mb-material" className="text-muted-foreground">Materialeinkauf €</Label>
              <Input
                id="mb-material"
                type="number"
                className="h-8 w-28"
                value={plannedMaterial ?? ''}
                onChange={(e) => onChangeTotals({ plannedHours, plannedMaterial: parse(e.target.value) })}
              />
            </div>
          </div>
        )}

        <div className="ml-auto flex items-center gap-6">
          {view.marginPct != null ? (
            <>
              {view.cost != null && <span className="text-muted-foreground">Kosten {eur(view.cost)}</span>}
              <span className="text-muted-foreground">Umsatz {eur(view.revenue)}</span>
              <span className={`font-semibold ${marginClass}`}>Marge {pct(view.marginPct)} %</span>
            </>
          ) : costRate == null ? (
            <span className="text-amber-600">Kein interner Kostensatz hinterlegt — lege eine aktive Kalkulation unter Finanzen → Kalkulation an</span>
          ) : (
            <span className="text-amber-600">Marge unvollständig — Stunden &amp; Material eintragen</span>
          )}
        </div>
      </div>
    </div>
  );
}

export default OfferMarginBar;
