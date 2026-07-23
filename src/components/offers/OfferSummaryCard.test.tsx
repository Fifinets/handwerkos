import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { OfferSummaryCard } from './OfferSummaryCard';

describe('OfferSummaryCard Marge', () => {
  it('zeigt Marge bei vollständiger Kostenbasis', () => {
    render(<OfferSummaryCard
      items={[{ quantity: 10, unit_price_net: 85, planned_hours_item: 10, material_purchase_cost: 200 }] as any}
      costRate={40} />);
    expect(screen.getByText(/29,4|29\.4/)).toBeInTheDocument();
  });

  it('warnt bei unvollständiger Kostenbasis', () => {
    render(<OfferSummaryCard
      items={[{ quantity: 1, unit_price_net: 100, planned_hours_item: null, material_purchase_cost: null }] as any}
      costRate={40} />);
    expect(screen.getByText(/Kosten fehlen|unvollständig/i)).toBeInTheDocument();
  });

  it('warnt fehlenden Kostensatz separat von fehlenden Positionsdaten', () => {
    render(<OfferSummaryCard
      items={[{ quantity: 10, unit_price_net: 85, planned_hours_item: 10, material_purchase_cost: 200 }] as any}
      costRate={null} />);
    expect(screen.getByText(/Kostensatz/i)).toBeInTheDocument();
    expect(screen.queryByText(/0 Positionen/i)).not.toBeInTheDocument();
  });
});
