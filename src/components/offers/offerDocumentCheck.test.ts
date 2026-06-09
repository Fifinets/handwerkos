import { describe, expect, it } from 'vitest';
import { checkOfferBeforeSend } from './offerDocumentCheck';

const validInput = () => ({
  offer: {
    offer_number: 'ANG-1',
    project_name: 'Badsanierung',
    valid_until: '2026-06-30',
    customer_name: 'Bauer GmbH',
    customer_address: 'Ackerstrasse 28',
    is_reverse_charge: false,
  },
  company: {
    company_name: 'FifiBau',
    street_address: 'Flurstrasse 28',
    postal_code: '41065',
    city: 'Moenchengladbach',
    vat_id: 'DE123456789',
  },
  customer: {
    company_name: 'Bauer GmbH',
    address: 'Ackerstrasse 28',
    postal_code: '41065',
    city: 'Moenchengladbach',
  },
  items: [
    { item_type: 'labor', description: 'Montageleistung', quantity: 1, unit_price_net: 75, vat_rate: 19 },
  ],
});

describe('checkOfferBeforeSend', () => {
  it('meldet ein vollständiges Angebot als versandbereit', () => {
    const result = checkOfferBeforeSend(validInput());

    expect(result.canSend).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it('blockiert den Versand bei fehlenden harten Angaben', () => {
    const input = validInput();
    input.offer.customer_name = '';
    input.offer.customer_address = '';
    input.customer.company_name = '';
    input.customer.address = '';
    input.items = [];

    const result = checkOfferBeforeSend(input);

    expect(result.canSend).toBe(false);
    expect(result.errors).toContain('Kunde fehlt.');
    expect(result.errors).toContain('Kundenadresse fehlt.');
    expect(result.errors).toContain('Mindestens eine abrechenbare Position fehlt.');
  });

  it('warnt bei fehlender Steuerangabe, blockiert Angebote aber nicht', () => {
    const input = validInput();
    input.company.vat_id = '';

    const result = checkOfferBeforeSend(input);

    expect(result.canSend).toBe(true);
    expect(result.warnings).toContain('Steuernummer oder USt-IdNr. fehlt im Firmenprofil.');
  });

  it('warnt bei Reverse Charge ohne deutliche Kundensteuerangabe', () => {
    const input = validInput();
    input.offer.is_reverse_charge = true;

    const result = checkOfferBeforeSend(input);

    expect(result.canSend).toBe(true);
    expect(result.warnings).toContain('Reverse Charge ist aktiv. Bitte Kunden-USt-IdNr. bzw. Steuerangaben prüfen.');
  });
});
