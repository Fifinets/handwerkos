import { beforeEach, describe, expect, it, vi } from 'vitest';

type QueryResult = { data: any; error: any };

const { tableResults, mockFrom } = vi.hoisted(() => ({
  tableResults: new Map<string, QueryResult>(),
  mockFrom: vi.fn(),
}));

function createQueryBuilder(tableName: string) {
  const builder: any = {
    select: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    neq: vi.fn(() => builder),
    not: vi.fn(() => builder),
    gte: vi.fn(() => builder),
    lte: vi.fn(() => builder),
    in: vi.fn(() => builder),
    order: vi.fn(() => builder),
    single: vi.fn(() => builder),
    then: (resolve: (value: QueryResult) => void, reject?: (reason: unknown) => void) => {
      return Promise.resolve(tableResults.get(tableName) || { data: [], error: null }).then(resolve, reject);
    },
  };

  return builder;
}

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: (tableName: string) => {
      mockFrom(tableName);
      return createQueryBuilder(tableName);
    },
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-1' } } }),
    },
  },
}));

vi.mock('sonner', () => ({
  toast: { error: vi.fn() },
}));

import { ProjectKPIService } from './projectKPIService';

describe('ProjectKPIService.getProjectPostCalculation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    tableResults.clear();
    tableResults.set('projects', {
      data: {
        id: 'project-1',
        name: 'Bad Sanierung',
        budget: 5000,
        status: 'in_bearbeitung',
        start_date: '2026-06-01',
        end_date: null,
      },
      error: null,
    });
    tableResults.set('offers', { data: [], error: null });
    tableResults.set('offer_targets', { data: [], error: null });
    tableResults.set('offer_items', { data: [], error: null });
    tableResults.set('time_entries', { data: [], error: null });
    tableResults.set('employees', { data: [], error: null });
    tableResults.set('project_materials', { data: [], error: null });
    tableResults.set('expenses', { data: [], error: null });
    tableResults.set('invoices', { data: [], error: null });
  });

  it('berechnet Gewinn aus Angebot, abgeschlossenen Zeiten, Material und Expenses', async () => {
    tableResults.set('offers', {
      data: [{ id: 'offer-1', snapshot_net_total: 10000, snapshot_gross_total: 11900, status: 'accepted' }],
      error: null,
    });
    tableResults.set('offer_targets', {
      data: [{
        offer_id: 'offer-1',
        planned_hours_total: 80,
        internal_hourly_rate: 45,
        planned_material_cost_total: 1500,
        planned_other_cost: 200,
      }],
      error: null,
    });
    tableResults.set('time_entries', {
      data: [
        {
          id: 'time-1',
          employee_id: 'employee-1',
          start_time: '2026-06-01T08:00:00.000Z',
          end_time: '2026-06-01T16:30:00.000Z',
          break_duration: 30,
        },
        {
          id: 'time-open',
          employee_id: 'employee-1',
          start_time: '2026-06-02T08:00:00.000Z',
          end_time: null,
          break_duration: 0,
        },
      ],
      error: null,
    });
    tableResults.set('employees', {
      data: [{ id: 'employee-1', hourly_wage: 50, hourly_rate: 65 }],
      error: null,
    });
    tableResults.set('project_materials', {
      data: [{ id: 'mat-1', total_price: 2000, quantity: 5, unit_price: 400 }],
      error: null,
    });
    tableResults.set('expenses', {
      data: [{ id: 'expense-1', amount: 300, approved_at: '2026-06-03T10:00:00.000Z' }],
      error: null,
    });
    tableResults.set('invoices', {
      data: [{ id: 'invoice-1', net_amount: 9000, gross_amount: 10710, status: 'Bezahlt' }],
      error: null,
    });

    const result = await ProjectKPIService.getProjectPostCalculation('project-1');

    expect(result.planned.revenueNet).toBe(10000);
    expect(result.planned.hours).toBe(80);
    expect(result.planned.materialCosts).toBe(1500);
    expect(result.actual.hours).toBe(8);
    expect(result.actual.laborCosts).toBe(400);
    expect(result.actual.materialCosts).toBe(2000);
    expect(result.actual.expenses).toBe(300);
    expect(result.actual.revenueNet).toBe(9000);
    expect(result.actual.totalCosts).toBe(2700);
    expect(result.result.profit).toBe(6300);
    expect(result.result.status).toBe('profit');
    expect(result.openTimeEntries).toBe(1);
  });

  it('meldet Projekte ohne verknuepftes Angebot als unvollstaendig', async () => {
    const result = await ProjectKPIService.getProjectPostCalculation('project-1');

    expect(result.result.status).toBe('incomplete');
    expect(result.missingData).toContain('Kein verknüpftes Angebot');
  });

  it('nutzt offer_items als Fallback fuer Angebotswerte und geplante Stunden', async () => {
    tableResults.set('offers', {
      data: [{ id: 'offer-1', snapshot_net_total: null, snapshot_gross_total: null, status: 'sent' }],
      error: null,
    });
    tableResults.set('offer_items', {
      data: [
        { offer_id: 'offer-1', quantity: 2, unit_price_net: 1000, planned_hours_item: 10, material_purchase_cost: 300 },
        { offer_id: 'offer-1', quantity: 1, unit_price_net: 500, planned_hours_item: 5, material_purchase_cost: 100 },
      ],
      error: null,
    });

    const result = await ProjectKPIService.getProjectPostCalculation('project-1');

    expect(result.planned.revenueNet).toBe(2500);
    expect(result.planned.hours).toBe(15);
    expect(result.planned.materialCosts).toBe(400);
  });
});
