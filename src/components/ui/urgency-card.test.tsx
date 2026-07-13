import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { UrgencyCard } from './urgency-card';

describe('UrgencyCard', () => {
  it('rendert kritische Karten mit rose-Hintergrund ohne sichtbaren Rahmen', () => {
    render(
      <UrgencyCard urgency="critical" data-testid="card">
        Inhalt
      </UrgencyCard>
    );
    const card = screen.getByTestId('card');
    expect(card.className).toContain('bg-rose-50');
    expect(card.className).toContain('border-transparent');
    expect(card.className).not.toContain('border-rose');
  });

  it('rendert wartende Karten mit amber-Hintergrund', () => {
    render(
      <UrgencyCard urgency="warning" data-testid="card">
        Inhalt
      </UrgencyCard>
    );
    expect(screen.getByTestId('card').className).toContain('bg-amber-50');
  });

  it('rendert neutrale Karten mit Standard-Rahmen', () => {
    render(
      <UrgencyCard urgency="none" data-testid="card">
        Inhalt
      </UrgencyCard>
    );
    const card = screen.getByTestId('card');
    expect(card.className).toContain('bg-card');
    expect(card.className).toContain('border-border');
  });

  it('blendet erledigte Karten ab', () => {
    render(
      <UrgencyCard urgency="none" done data-testid="card">
        Inhalt
      </UrgencyCard>
    );
    expect(screen.getByTestId('card').className).toContain('opacity-60');
  });

  it('rendert den Aktions-Slot rechts', () => {
    render(
      <UrgencyCard urgency="critical" action={<button>Mahnen</button>}>
        <span>RE-118</span>
      </UrgencyCard>
    );
    expect(screen.getByRole('button', { name: 'Mahnen' })).toBeInTheDocument();
    expect(screen.getByText('RE-118')).toBeInTheDocument();
  });
});
