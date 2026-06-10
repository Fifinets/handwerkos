import { describe, expect, it } from 'vitest';
import {
  getInvoiceableAddendums,
  getOpenAddendumCount,
  toInvoiceLine,
  type ProjectAddendum,
} from '../projectAddendums';

const addendum = (overrides: Partial<ProjectAddendum>): ProjectAddendum => ({
  id: 'a1',
  project_id: 'p1',
  description: 'Zusaetzliche Steckdose im Keller',
  quantity: 1,
  unit: 'Stk',
  unit_price: 120,
  amount_net: 120,
  vat_rate: 19,
  status: 'detected',
  invoice_id: null,
  ...overrides,
});

describe('project addendums', () => {
  it('counts detected, draft, pending and approved addendums as open', () => {
    const count = getOpenAddendumCount([
      addendum({ id: 'detected', status: 'detected' }),
      addendum({ id: 'draft', status: 'draft' }),
      addendum({ id: 'pending', status: 'pending_customer' }),
      addendum({ id: 'approved', status: 'approved' }),
      addendum({ id: 'rejected', status: 'rejected' }),
      addendum({ id: 'invoiced', status: 'invoiced', invoice_id: 'i1' }),
    ]);

    expect(count).toBe(4);
  });

  it('returns only approved addendums without invoice as invoiceable', () => {
    const invoiceable = getInvoiceableAddendums([
      addendum({ id: 'a1', status: 'approved', invoice_id: null }),
      addendum({ id: 'a2', status: 'approved', invoice_id: 'i1' }),
      addendum({ id: 'a3', status: 'pending_customer', invoice_id: null }),
      addendum({ id: 'a4', status: 'rejected', invoice_id: null }),
    ]);

    expect(invoiceable.map((item) => item.id)).toEqual(['a1']);
  });

  it('converts approved addendums into invoice document lines', () => {
    const line = toInvoiceLine(addendum({
      id: 'a5',
      description: 'Mehrarbeit Kabelweg stemmen',
      quantity: 2.5,
      unit: 'Std',
      unit_price: 78,
      amount_net: 195,
      vat_rate: 19,
      status: 'approved',
    }), {
      invoiceId: 'invoice-1',
      companyId: 'company-1',
      position: 7,
    });

    expect(line).toEqual({
      invoice_id: 'invoice-1',
      position: 7,
      description: 'Nachtrag: Mehrarbeit Kabelweg stemmen',
      quantity: 2.5,
      unit: 'Std',
      unit_price: 78,
      total_price: 195,
      company_id: 'company-1',
    });
  });
});
