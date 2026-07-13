import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { StatCard } from './stat-card';

describe('StatCard', () => {
  it('rendert Label uppercase-klein und Wert groß mit Tabellenziffern', () => {
    render(<StatCard label="Umsatz Juli" value="24.300 €" />);
    const label = screen.getByText('Umsatz Juli');
    expect(label.className).toContain('uppercase');
    expect(label.className).toContain('text-xs');
    const value = screen.getByText('24.300 €');
    expect(value.className).toContain('tabular-nums');
    expect(value.className).toContain('font-bold');
  });

  it('macht den Hero-Wert größer als den Standard-Wert', () => {
    const { rerender } = render(<StatCard label="A" value="1" />);
    expect(screen.getByText('1').className).toContain('text-2xl');
    rerender(<StatCard label="A" value="1" emphasis="hero" />);
    expect(screen.getByText('1').className).toContain('text-3xl');
  });

  it('rendert einen positiven Trend als Teal-Chip', () => {
    render(<StatCard label="Umsatz" value="24.300 €" trend={{ text: '+12 %', positive: true }} />);
    const trend = screen.getByText('▲ +12 %');
    expect(trend.className).toContain('text-teal-700');
  });

  it('rendert einen negativen Trend als Rose-Chip', () => {
    render(<StatCard label="Umsatz" value="20.000 €" trend={{ text: '-8 %', positive: false }} />);
    const trend = screen.getByText('▼ -8 %');
    expect(trend.className).toContain('text-rose-700');
  });

  it('färbt den Wert nach tone ein', () => {
    render(<StatCard label="Überfällig" value="2.400 €" tone="critical" />);
    expect(screen.getByText('2.400 €').className).toContain('text-rose-600');
  });

  it('zeigt eine dezente Hinweiszeile', () => {
    render(<StatCard label="Projekte" value="7" hint="von 12 total" />);
    const hint = screen.getByText('von 12 total');
    expect(hint.className).toContain('text-slate-400');
  });
});
