export interface OfferCostItem {
  quantity?: number | null;
  unit_price_net?: number | null;
  planned_hours_item?: number | null;
  material_purchase_cost?: number | null;
}

/** Angebotsweite Kostenbasis (Standard-Eingabemodus): eine Stundenzahl + eine Materialsumme. */
export interface OfferLevelTotals {
  plannedHours: number | null;
  plannedMaterial: number | null;
}

export interface OfferCostBasis {
  revenue: number;
  cost: number | null;
  marginPct: number | null;
  isComplete: boolean;
}

const itemKnown = (i: OfferCostItem) =>
  i.planned_hours_item != null || i.material_purchase_cost != null;

const marginOf = (revenue: number, cost: number): number | null =>
  revenue > 0 ? Math.round(((revenue - cost) / revenue) * 10000) / 100 : null;

export function computeOfferCostBasis(
  items: OfferCostItem[],
  costRate: number | null,
  offerTotals?: OfferLevelTotals,
): OfferCostBasis {
  const revenue = items.reduce(
    (s, i) => s + (i.quantity ?? 0) * (i.unit_price_net ?? 0),
    0,
  );

  const hasPerPositionData = items.some(itemKnown);

  // Pro-Positions-Pfad — unverändert, hält Parität zur SQL-Funktion get_offer_cost_basis.
  if (hasPerPositionData) {
    const complete =
      items.length > 0 && costRate != null && items.every(itemKnown);
    if (!complete) {
      return { revenue, cost: null, marginPct: null, isComplete: false };
    }
    const cost = items.reduce(
      (s, i) =>
        s + (i.planned_hours_item ?? 0) * costRate + (i.material_purchase_cost ?? 0),
      0,
    );
    return { revenue, cost, marginPct: marginOf(revenue, cost), isComplete: true };
  }

  // Angebotsweiter Pfad — greift nur, wenn keine Position eigene Kostendaten trägt.
  if (
    offerTotals &&
    costRate != null &&
    offerTotals.plannedHours != null &&
    offerTotals.plannedMaterial != null
  ) {
    const cost = offerTotals.plannedHours * costRate + offerTotals.plannedMaterial;
    return { revenue, cost, marginPct: marginOf(revenue, cost), isComplete: true };
  }

  return { revenue, cost: null, marginPct: null, isComplete: false };
}
