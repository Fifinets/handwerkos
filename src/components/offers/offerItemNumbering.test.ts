import { describe, expect, it } from 'vitest';
import { getOfferItemDisplayNumber } from './offerItemNumbering';

const item = (item_type: string) => ({ item_type });

describe('getOfferItemDisplayNumber', () => {
  it('nummeriert ohne Abschnitte einfach fortlaufend', () => {
    const items = [item('labor'), item('text'), item('lump_sum')];

    expect(getOfferItemDisplayNumber(items, 0)).toBe(1);
    expect(getOfferItemDisplayNumber(items, 1)).toBe(2);
    expect(getOfferItemDisplayNumber(items, 2)).toBe(3);
  });

  it('ordnet Positionen vor dem ersten Abschnitt dem Abschnitt 1 unter', () => {
    const items = [
      item('labor'),
      item('text'),
      item('title'),
      item('labor'),
      item('text'),
    ];

    expect(getOfferItemDisplayNumber(items, 0)).toBe('1.1');
    expect(getOfferItemDisplayNumber(items, 1)).toBe('1.2');
    expect(getOfferItemDisplayNumber(items, 2)).toBe('2');
    expect(getOfferItemDisplayNumber(items, 3)).toBe('2.1');
    expect(getOfferItemDisplayNumber(items, 4)).toBe('2.2');
  });

  it('beginnt mit Abschnitt 1, wenn der erste Eintrag ein Abschnitt ist', () => {
    const items = [item('title'), item('labor'), item('page_break'), item('title'), item('text')];

    expect(getOfferItemDisplayNumber(items, 0)).toBe('1');
    expect(getOfferItemDisplayNumber(items, 1)).toBe('1.1');
    expect(getOfferItemDisplayNumber(items, 2)).toBe('');
    expect(getOfferItemDisplayNumber(items, 3)).toBe('2');
    expect(getOfferItemDisplayNumber(items, 4)).toBe('2.1');
  });
});
