import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { OfferSidebar } from './OfferSidebar';

vi.mock('./OfferMaterialCatalog', () => ({
  OfferMaterialCatalog: () => <div>Materialkatalog</div>,
}));

vi.mock('./AIOfferAssistant', () => ({
  AIOfferAssistant: () => <div>KI-Assistent</div>,
}));

describe('OfferSidebar', () => {
  it('entfernt feste Beispielvorlagen und zeigt eigene Bausteine als leeren Bereich', () => {
    const onAddItem = vi.fn();

    render(<OfferSidebar isOpen onAddItem={onAddItem} />);

    expect(screen.queryByText('Badsanierung Startpaket')).not.toBeInTheDocument();
    expect(screen.queryByText('Zählertausch Elektro')).not.toBeInTheDocument();
    expect(screen.queryByText('Nachtragsangebot')).not.toBeInTheDocument();
    expect(screen.getByText('Eigene Bausteine')).toBeInTheDocument();
    expect(screen.getByText('Noch keine eigenen Bausteine')).toBeInTheDocument();
  });

  it('bietet klare Grundelemente für typische Angebotsbausteine an', () => {
    const onAddItem = vi.fn();

    render(<OfferSidebar isOpen onAddItem={onAddItem} />);

    expect(screen.getByRole('button', { name: /Abschnitt/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Hinweistext/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Leistung' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Pauschale' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Optionalposition' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Alternative' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Pauschale' }));
    expect(onAddItem).toHaveBeenCalledWith('position', expect.objectContaining({
      item_type: 'lump_sum',
      unit: 'psch',
    }));

    fireEvent.click(screen.getByRole('button', { name: 'Optionalposition' }));
    expect(onAddItem).toHaveBeenCalledWith('position', expect.objectContaining({
      is_optional: true,
    }));
  });
});
