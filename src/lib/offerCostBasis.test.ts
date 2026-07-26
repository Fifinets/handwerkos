import { describe, it, expect } from 'vitest';
import { computeOfferCostBasis, sumLaborHours, computeOfferMargin } from './offerCostBasis';

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

  // Parität zur SQL-Funktion get_offer_cost_basis (Migration 20260722180000).
  // Die Erwartungswerte sind KEINE Handrechnung, sondern die real gemessene
  // Ausgabe der SQL-Funktion gegen dieselben Eingaben (lokale DB, 2026-07-22):
  //   revenue 850.00000 | cost 603.9000 | margin_pct 28.95 | cost_rate 40.39 | complete t
  // Weichen beide Seiten voneinander ab, ist eine der Formeln geändert worden.
  it('liefert dieselben Zahlen wie die SQL-Funktion get_offer_cost_basis', () => {
    const r = computeOfferCostBasis(
      [{ quantity: 10, unit_price_net: 85, planned_hours_item: 10, material_purchase_cost: 200 }],
      40.39,
    );
    expect(r.revenue).toBe(850);
    expect(r.cost).toBeCloseTo(603.9, 4);
    expect(r.marginPct).toBe(28.95);
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

  it('rechnet angebotsweit, wenn keine Position Kostendaten hat', () => {
    const r = computeOfferCostBasis(
      [{ quantity: 10, unit_price_net: 85, planned_hours_item: null, material_purchase_cost: null }],
      40.39,
      { plannedHours: 10, plannedMaterial: 200 },
    );
    expect(r.revenue).toBe(850);
    expect(r.cost).toBeCloseTo(603.9, 4);
    expect(r.marginPct).toBe(28.95);
    expect(r.isComplete).toBe(true);
  });

  it('angebotsweit unvollständig, wenn Material fehlt', () => {
    const r = computeOfferCostBasis(
      [{ quantity: 1, unit_price_net: 100, planned_hours_item: null, material_purchase_cost: null }],
      40,
      { plannedHours: 5, plannedMaterial: null },
    );
    expect(r.cost).toBeNull();
    expect(r.isComplete).toBe(false);
  });

  it('Pro-Positions-Daten haben Vorrang vor angebotsweiten Totalen', () => {
    const r = computeOfferCostBasis(
      [{ quantity: 1, unit_price_net: 1000, planned_hours_item: 2, material_purchase_cost: 100 }],
      40,
      { plannedHours: 999, plannedMaterial: 999 },
    );
    // Position: 2*40 + 100 = 180, nicht die Totale
    expect(r.cost).toBe(180);
    expect(r.isComplete).toBe(true);
  });

  it('angebotsweit ohne Kostensatz ist unvollständig', () => {
    const r = computeOfferCostBasis(
      [{ quantity: 1, unit_price_net: 100, planned_hours_item: null, material_purchase_cost: null }],
      null,
      { plannedHours: 5, plannedMaterial: 20 },
    );
    expect(r.cost).toBeNull();
    expect(r.isComplete).toBe(false);
  });
});

describe('sumLaborHours', () => {
  it('summiert die Mengen der Arbeitszeit-Positionen (item_type labor)', () => {
    expect(sumLaborHours([
      { item_type: 'labor', quantity: 10, unit_price_net: 85 },
      { item_type: 'labor', quantity: 4, unit_price_net: 60 },
    ])).toBe(14);
  });

  it('ignoriert Nicht-Arbeitszeit-Positionen', () => {
    expect(sumLaborHours([
      { item_type: 'labor', quantity: 10, unit_price_net: 85 },
      { item_type: 'material', quantity: 3, unit_price_net: 20 },
    ])).toBe(10);
  });

  it('ignoriert optionale Arbeitszeit-Positionen', () => {
    expect(sumLaborHours([
      { item_type: 'labor', quantity: 10, unit_price_net: 85 },
      { item_type: 'labor', quantity: 5, unit_price_net: 90, is_optional: true },
    ])).toBe(10);
  });

  it('ist 0 ohne Arbeitszeit-Positionen', () => {
    expect(sumLaborHours([{ item_type: 'material', quantity: 2, unit_price_net: 50 }])).toBe(0);
  });
});

describe('computeOfferMargin', () => {
  it('leitet Stunden aus Arbeitszeit-Positionen ab und rechnet mit Materialsumme', () => {
    const r = computeOfferMargin(
      [{ item_type: 'labor', quantity: 10, unit_price_net: 85 }],
      40.39,
      200,
    );
    expect(r.revenue).toBe(850);
    expect(r.laborHours).toBe(10);
    expect(r.cost).toBeCloseTo(603.9, 4);
    expect(r.marginPct).toBe(28.95);
  });

  it('schließt optionale Positionen aus Umsatz und Stunden aus', () => {
    const r = computeOfferMargin(
      [
        { item_type: 'labor', quantity: 10, unit_price_net: 85 },
        { item_type: 'labor', quantity: 5, unit_price_net: 100, is_optional: true },
      ],
      40,
      0,
    );
    expect(r.revenue).toBe(850);
    expect(r.laborHours).toBe(10);
    expect(r.cost).toBe(400);
  });

  it('rechnet reine Materialkosten ohne Arbeitszeit-Positionen', () => {
    const r = computeOfferMargin(
      [{ item_type: 'material', quantity: 1, unit_price_net: 100 }],
      40,
      50,
    );
    expect(r.laborHours).toBe(0);
    expect(r.cost).toBe(50);
    expect(r.marginPct).toBe(50);
  });

  it('marginPct ist null, wenn es keinen Umsatz gibt', () => {
    const r = computeOfferMargin([], 40, 0);
    expect(r.revenue).toBe(0);
    expect(r.marginPct).toBeNull();
  });
});
