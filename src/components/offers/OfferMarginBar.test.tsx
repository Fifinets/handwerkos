import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { OfferMarginBar } from './OfferMarginBar';

const baseItems = [{ quantity: 10, unit_price_net: 85, planned_hours_item: null, material_purchase_cost: null }];

describe('OfferMarginBar', () => {
  it('warnt, wenn kein Kostensatz hinterlegt ist', () => {
    render(<OfferMarginBar items={baseItems} costRate={null} plannedHours={10} plannedMaterial={200}
      onChangeTotals={vi.fn()} />);
    expect(screen.getByText(/Kein interner Kostensatz/i)).toBeInTheDocument();
  });

  it('meldet Unvollständigkeit, wenn Stunden/Material fehlen', () => {
    render(<OfferMarginBar items={baseItems} costRate={40} plannedHours={null} plannedMaterial={null}
      onChangeTotals={vi.fn()} />);
    expect(screen.getByText(/Marge unvollständig/i)).toBeInTheDocument();
  });

  it('zeigt die Marge bei vollständiger Basis (kein Warnhinweis)', () => {
    render(<OfferMarginBar items={baseItems} costRate={40.39} plannedHours={10} plannedMaterial={200}
      onChangeTotals={vi.fn()} />);
    expect(screen.getByText(/^Marge/)).toBeInTheDocument();
    expect(screen.queryByText(/unvollständig/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Kein interner Kostensatz/i)).not.toBeInTheDocument();
  });

  it('ist bei gesperrtem Angebot lesend (keine Eingabefelder)', () => {
    render(<OfferMarginBar items={baseItems} costRate={40.39} plannedHours={10} plannedMaterial={200}
      onChangeTotals={vi.fn()} isLocked
      snapshot={{ cost: 603.9, revenue: 850, marginPct: 28.95 }} />);
    expect(screen.queryByRole('spinbutton')).not.toBeInTheDocument();
    expect(screen.getByText(/^Marge/)).toBeInTheDocument();
  });
});
