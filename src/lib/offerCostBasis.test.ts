import { describe, it, expect } from 'vitest';
import { computeOfferCostBasis } from './offerCostBasis';

const rate = 40;

describe('computeOfferCostBasis', () => {
  it('rechnet Erlös, Kosten und Marge bei vollständiger Basis', () => {
    const r = computeOfferCostBasis(
      [{ quantity: 10, unit_price_net: 85, planned_hours_item: 10, material_purchase_cost: 200 }],
      rate,
    );
    expect(r.revenue).toBe(850);
    expect(r.cost).toBe(600);
    expect(r.marginPct).toBeCloseTo(29.41, 2);
    expect(r.isComplete).toBe(true);
  });

  it('markiert fehlende Kosten als unvollständig, Kosten/Marge null', () => {
    const r = computeOfferCostBasis(
      [{ quantity: 1, unit_price_net: 100, planned_hours_item: null, material_purchase_cost: null }],
      rate,
    );
    expect(r.revenue).toBe(100);
    expect(r.cost).toBeNull();
    expect(r.marginPct).toBeNull();
    expect(r.isComplete).toBe(false);
  });

  it('0 Stunden vom Nutzer zählt als bekannt (reine Materialposition)', () => {
    const r = computeOfferCostBasis(
      [{ quantity: 1, unit_price_net: 100, planned_hours_item: 0, material_purchase_cost: 50 }],
      rate,
    );
    expect(r.cost).toBe(50);
    expect(r.isComplete).toBe(true);
  });

  it('ohne Kostensatz ist die Basis unvollständig', () => {
    const r = computeOfferCostBasis(
      [{ quantity: 1, unit_price_net: 100, planned_hours_item: 2, material_purchase_cost: 0 }],
      null,
    );
    expect(r.cost).toBeNull();
    expect(r.isComplete).toBe(false);
  });
});
