import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { OfferMarginBar } from './OfferMarginBar';

// 1 Arbeitszeit-Position: 10 Std @ 85 € → Umsatz 850 €, 10 Std
const laborItems = [{ item_type: 'labor', quantity: 10, unit_price_net: 85 }];

describe('OfferMarginBar', () => {
  it('warnt, wenn kein Kostensatz hinterlegt ist', () => {
    render(<OfferMarginBar items={laborItems} costRate={null} plannedMaterial={200} onChangeMaterial={vi.fn()} />);
    expect(screen.getByText(/Kein interner Kostensatz/i)).toBeInTheDocument();
    expect(screen.queryByRole('spinbutton')).not.toBeInTheDocument();
  });

  it('leitet die Stunden aus den Positionen ab und zeigt die Marge live', () => {
    render(<OfferMarginBar items={laborItems} costRate={40.39} plannedMaterial={200} onChangeMaterial={vi.fn()} />);
    expect(screen.getByText(/aus Positionen/)).toBeInTheDocument();
    expect(screen.getByText(/Marge/)).toBeInTheDocument();
    expect(screen.queryByText(/Marge\s*—/)).not.toBeInTheDocument();
    expect(screen.queryByText(/unvollständig/i)).not.toBeInTheDocument();
  });

  it('Material ist das einzige Eingabefeld und meldet Änderungen', () => {
    const onChangeMaterial = vi.fn();
    render(<OfferMarginBar items={laborItems} costRate={40.39} plannedMaterial={null} onChangeMaterial={onChangeMaterial} />);
    const inputs = screen.getAllByRole('spinbutton');
    expect(inputs).toHaveLength(1);
    fireEvent.change(inputs[0], { target: { value: '80' } });
    expect(onChangeMaterial).toHaveBeenCalledWith(80);
  });

  it('zeigt „Marge —" statt irreführender 100 %, wenn keine Kosten anfallen', () => {
    const noCost = [{ item_type: 'material', quantity: 1, unit_price_net: 100 }]; // 0 Std, Umsatz 100
    render(<OfferMarginBar items={noCost} costRate={40.39} plannedMaterial={null} onChangeMaterial={vi.fn()} />);
    expect(screen.getByText(/Marge\s*—/)).toBeInTheDocument();
  });

  it('ist bei gesperrtem Angebot lesend und zeigt den Snapshot-Wert', () => {
    render(<OfferMarginBar items={laborItems} costRate={40.39} plannedMaterial={200} onChangeMaterial={vi.fn()}
      isLocked snapshot={{ cost: 111, revenue: 850, marginPct: 87 }} />);
    expect(screen.queryByRole('spinbutton')).not.toBeInTheDocument();
    // 87 % stammt aus dem Snapshot, nicht aus der Live-Rechnung (die 28,95 % ergäbe)
    expect(screen.getByText(/Marge 87,0 %/)).toBeInTheDocument();
  });
});
