import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { StatusChip } from './status-chip';

describe('StatusChip', () => {
  it('rendert bekannte Status mit deutschem Label', () => {
    render(<StatusChip status="overdue" />);
    const chip = screen.getByText('Überfällig');
    expect(chip).toBeInTheDocument();
    expect(chip.className).toContain('bg-rose-50');
    expect(chip.className).toContain('text-rose-700');
  });

  it('rendert positive Status in Teal', () => {
    render(<StatusChip status="accepted" />);
    const chip = screen.getByText('Angenommen');
    expect(chip.className).toContain('bg-teal-50');
    expect(chip.className).toContain('text-teal-700');
  });

  it('rendert wartende Status in Amber', () => {
    render(<StatusChip status="sent" />);
    const chip = screen.getByText('Gesendet');
    expect(chip.className).toContain('bg-amber-50');
  });

  it('blendet erledigte Status neutral ab', () => {
    render(<StatusChip status="draft" />);
    const chip = screen.getByText('Entwurf');
    expect(chip.className).toContain('bg-slate-100');
    expect(chip.className).toContain('text-slate-500');
  });

  it('unterstützt legacy-deutsche Projektstatus', () => {
    render(<StatusChip status="in_bearbeitung" />);
    expect(screen.getByText('In Arbeit')).toBeInTheDocument();
  });

  it('zeigt unbekannte Status als neutralen Fallback mit Rohwert', () => {
    render(<StatusChip status="somethingnew" />);
    const chip = screen.getByText('somethingnew');
    expect(chip.className).toContain('bg-slate-100');
  });

  it('erlaubt Label-Override', () => {
    render(<StatusChip status="sent" label="Wartet auf Antwort" />);
    expect(screen.getByText('Wartet auf Antwort')).toBeInTheDocument();
  });

  it('rendert den Korrektur-Status in Amber', () => {
    render(<StatusChip status="corrected" />);
    expect(screen.getByText('Korrigiert')).toBeInTheDocument();
  });
});
