import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ShareLinkDialog } from './ShareLinkDialog';

const renderShareLinkDialog = (customerEmail?: string) => render(
  <ShareLinkDialog
    open
    onOpenChange={vi.fn()}
    shareLink="http://localhost:8080/public/offer/test-token"
    offerNumber="ANG-1"
    customerName="Bauer"
    projectName="Badsanierung"
    customerEmail={customerEmail}
  />
);

describe('ShareLinkDialog', () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('öffnet Gmail mit Empfängeradresse, wenn beim Kunden eine E-Mail gespeichert ist', () => {
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);
    renderShareLinkDialog('kunde@example.com');

    fireEvent.click(screen.getByRole('button', { name: /gmail/i }));

    expect(openSpy).toHaveBeenCalledWith(
      expect.stringContaining('to=kunde%40example.com'),
      '_blank'
    );
  });

  it('öffnet Gmail nicht und zeigt einen Hinweis, wenn die Kunden-E-Mail fehlt', () => {
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);
    renderShareLinkDialog();

    fireEvent.click(screen.getByRole('button', { name: /gmail/i }));

    expect(openSpy).not.toHaveBeenCalled();
    expect(screen.getByText('Beim Kunden ist keine E-Mail-Adresse hinterlegt.')).toBeInTheDocument();
  });
});
