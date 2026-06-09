import { describe, expect, it } from 'vitest';
import { buildPublicOfferUrl, getPublicBaseUrl } from './publicUrl';

describe('publicUrl', () => {
  it('nutzt die konfigurierte öffentliche App-URL statt localhost', () => {
    expect(getPublicBaseUrl(
      { VITE_PUBLIC_APP_URL: 'https://app.handwerkos.de/' },
      'http://localhost:8080'
    )).toBe('https://app.handwerkos.de');
  });

  it('fällt im lokalen Betrieb auf den aktuellen Origin zurück', () => {
    expect(getPublicBaseUrl({}, 'http://localhost:8080')).toBe('http://localhost:8080');
  });

  it('baut öffentliche Angebotslinks ohne doppelte Slashes', () => {
    expect(buildPublicOfferUrl(
      'abc-token',
      { VITE_PUBLIC_APP_URL: 'https://app.handwerkos.de/' },
      'http://localhost:8080'
    )).toBe('https://app.handwerkos.de/public/offer/abc-token');
  });
});
