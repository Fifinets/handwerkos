import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import ProfitabilitySummary from './ProfitabilitySummary';

describe('ProfitabilitySummary', () => {
  it('zeigt Netto-Erlös, interne Kosten und Deckungsbeitrag nebeneinander', () => {
    render(
      <ProfitabilitySummary
        offers={[{ status: 'accepted', snapshot_net_total: 124.52 }]}
        internalCost={1057.4}
        materialCost={0}
      />
    );

    expect(screen.getByText('Angebot (netto)')).toBeInTheDocument();
    expect(screen.getByText('Interne Kosten')).toBeInTheDocument();
    expect(screen.getByText('Deckungsbeitrag')).toBeInTheDocument();
    expect(screen.getByText(/124,52/)).toBeInTheDocument();
    expect(screen.getByText(/1\.057,40/)).toBeInTheDocument();
  });

  it('zeigt einen negativen Deckungsbeitrag rot mit Kostendeckungs-Hinweis', () => {
    render(
      <ProfitabilitySummary
        offers={[{ status: 'accepted', snapshot_net_total: 124.52 }]}
        internalCost={1057.4}
        materialCost={0}
      />
    );

    const marginValue = screen.getByText(/932,88/);
    expect(marginValue.className).toContain('text-red-600');
    expect(screen.getByText('Erlös deckt 12 % der Kosten')).toBeInTheDocument();
  });

  it('zeigt einen positiven Deckungsbeitrag grün mit Marge', () => {
    render(
      <ProfitabilitySummary
        offers={[{ status: 'accepted', snapshot_net_total: 1000 }]}
        internalCost={400}
        materialCost={100}
      />
    );

    const marginValue = screen.getByText(/600,00/);
    expect(marginValue.className).toContain('text-emerald-600');
    expect(screen.getByText('Marge 60 %')).toBeInTheDocument();
  });

  it('zeigt ohne akzeptiertes Angebot einen Platzhalter statt Deckungsbeitrag', () => {
    render(
      <ProfitabilitySummary
        offers={[{ status: 'sent', snapshot_net_total: 500 }]}
        internalCost={200}
        materialCost={0}
      />
    );

    expect(screen.getByText('—')).toBeInTheDocument();
    expect(screen.getByText('Kein akzeptiertes Angebot')).toBeInTheDocument();
  });

  it('zeigt das geplante Budget unter den internen Kosten an, wenn gesetzt', () => {
    render(
      <ProfitabilitySummary
        offers={[]}
        internalCost={200}
        materialCost={0}
        budgetPlanned={5000}
      />
    );

    expect(screen.getByText(/von 5\.000,00\s*€ Budget/)).toBeInTheDocument();
  });
});
