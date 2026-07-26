import type { ReactNode } from 'react';
import { Input } from '@/components/ui/input';
import { computeOfferMargin, OfferCostItem } from '@/lib/offerCostBasis';

interface Snapshot {
  cost: number | null;
  revenue: number | null;
  marginPct: number | null;
}

interface OfferMarginBarProps {
  items: OfferCostItem[];
  /** Interner Vollkostensatz €/Std aus amge_calculations.lohn_mit_agk. */
  costRate: number | null;
  /** Einziges manuelles Feld — Stunden kommen automatisch aus den Positionen. */
  plannedMaterial: number | null;
  onChangeMaterial: (value: number | null) => void;
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

function Bar({ children }: { children: ReactNode }) {
  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 border-t bg-background/95 backdrop-blur px-4 py-2 print:hidden">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-4 gap-y-1 text-sm">
        <span className="font-medium text-muted-foreground">Interne Kalkulation</span>
        {children}
      </div>
    </div>
  );
}

export function OfferMarginBar({
  items,
  costRate,
  plannedMaterial,
  onChangeMaterial,
  isLocked = false,
  snapshot = null,
}: OfferMarginBarProps) {
  // Kein aktiver Kostensatz — Hinweis mit dem Weg zur Kalkulation.
  if (!isLocked && costRate == null) {
    return (
      <Bar>
        <span className="text-amber-600">
          Kein interner Kostensatz hinterlegt — lege eine aktive Kalkulation unter Finanzen → Kalkulation an
        </span>
      </Bar>
    );
  }

  // Gesperrtes Angebot: nur lesend, eingefrorene Marge (Snapshot bevorzugt).
  if (isLocked) {
    const fallback = costRate != null ? computeOfferMargin(items, costRate, plannedMaterial ?? 0) : null;
    const revenue = snapshot?.revenue ?? fallback?.revenue ?? 0;
    const cost = snapshot?.cost ?? fallback?.cost ?? null;
    const marginPct = snapshot?.marginPct ?? fallback?.marginPct ?? null;
    const marginClass = marginPct != null && marginPct < 0 ? 'text-red-600' : 'text-green-600';
    return (
      <Bar>
        <span className="ml-auto flex flex-wrap items-center gap-x-4 gap-y-1">
          {cost != null && <span className="text-muted-foreground">Kosten {eur(cost)}</span>}
          <span className="text-muted-foreground">Umsatz {eur(revenue)}</span>
          {marginPct != null ? (
            <span className={`font-semibold ${marginClass}`}>Marge {pct(marginPct)} %</span>
          ) : (
            <span className="text-muted-foreground">Marge —</span>
          )}
        </span>
      </Bar>
    );
  }

  const m = computeOfferMargin(items, costRate!, plannedMaterial ?? 0);
  const showMargin = m.marginPct != null && m.cost > 0;
  const marginClass = m.marginPct != null && m.marginPct < 0 ? 'text-red-600' : 'text-green-600';

  return (
    <Bar>
      <span className="text-muted-foreground">
        <b className="text-foreground">{m.laborHours}</b> Std{' '}
        <span className="text-xs">(aus Positionen)</span> × {eur(costRate!)}
      </span>
      <span className="flex items-center gap-2 text-muted-foreground">
        + Material
        <Input
          aria-label="Materialeinkauf in Euro"
          type="number"
          className="h-8 w-24"
          placeholder="0"
          value={plannedMaterial ?? ''}
          onChange={(e) => onChangeMaterial(parse(e.target.value))}
        />
        €
      </span>
      <span className="text-muted-foreground">= Kosten {eur(m.cost)}</span>
      <span className="ml-auto flex flex-wrap items-center gap-x-4 gap-y-1">
        <span className="text-muted-foreground">Umsatz {eur(m.revenue)}</span>
        {showMargin ? (
          <span className={`font-semibold ${marginClass}`}>Marge {pct(m.marginPct!)} %</span>
        ) : (
          <span className="text-muted-foreground">Marge —</span>
        )}
      </span>
    </Bar>
  );
}

export default OfferMarginBar;
