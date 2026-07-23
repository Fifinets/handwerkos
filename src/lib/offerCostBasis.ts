export interface OfferCostItem {
  quantity: number | null;
  unit_price_net: number | null;
  planned_hours_item: number | null;
  material_purchase_cost: number | null;
}

export interface OfferCostBasis {
  revenue: number;
  cost: number | null;
  marginPct: number | null;
  isComplete: boolean;
}

const itemKnown = (i: OfferCostItem) =>
  i.planned_hours_item != null || i.material_purchase_cost != null;

export function computeOfferCostBasis(
  items: OfferCostItem[],
  costRate: number | null,
): OfferCostBasis {
  const revenue = items.reduce(
    (s, i) => s + (i.quantity ?? 0) * (i.unit_price_net ?? 0),
    0,
  );
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
  const marginPct = revenue > 0
    ? Math.round(((revenue - cost) / revenue) * 10000) / 100
    : null;
  return { revenue, cost, marginPct, isComplete: true };
}
