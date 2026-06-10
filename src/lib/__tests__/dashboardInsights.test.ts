import { describe, expect, it } from 'vitest';
import { createDashboardInsights } from '../dashboardInsights';

describe('createDashboardInsights', () => {
  it('marks active projects as critical when actual costs exceed the planned budget', () => {
    const insights = createDashboardInsights({
      today: new Date('2026-06-10T12:00:00Z'),
      projects: [
        {
          id: 'p1',
          name: 'PV Becker',
          status: 'in_bearbeitung',
          start_date: '2026-06-01',
          end_date: '2026-06-20',
          work_end_date: null,
          completed_at: null,
          description: 'planned_hours: 32',
          budget: 5000,
          labor_costs: 3200,
          material_costs: 2400,
        },
      ],
      workHours: [{ project_id: 'p1', hours_worked: 38, work_description: 'Montage dauerte laenger' }],
      timeEntries: [],
      invoices: [],
    });

    expect(insights.criticalCount).toBe(1);
    expect(insights.riskyProjects[0].riskLevel).toBe('critical');
    expect(insights.riskyProjects[0].signals).toContain('600 EUR ueber Budget');
    expect(insights.riskyProjects[0].signals).toContain('6 h ueber Plan');
  });

  it('detects possible addendum work from field notes', () => {
    const insights = createDashboardInsights({
      today: new Date('2026-06-10T12:00:00Z'),
      projects: [
        {
          id: 'p2',
          name: 'Meyer Keller',
          status: 'active',
          start_date: '2026-06-08',
          end_date: '2026-06-30',
          work_end_date: null,
          completed_at: null,
          description: null,
          budget: 1500,
          labor_costs: 400,
          material_costs: 200,
        },
      ],
      workHours: [],
      timeEntries: [
        {
          project_id: 'p2',
          description: 'Zusaetzlich zwei Steckdosen im Keller gesetzt',
          start_time: '2026-06-10T08:00:00Z',
          end_time: '2026-06-10T10:00:00Z',
          break_duration: 0,
        },
      ],
      invoices: [],
    });

    expect(insights.openAddendumCount).toBe(1);
    expect(insights.riskyProjects[0].recommendedAction).toBe('Nachtrag pruefen');
  });

  it('counts completed projects without invoices as ready to invoice', () => {
    const insights = createDashboardInsights({
      today: new Date('2026-06-10T12:00:00Z'),
      projects: [
        {
          id: 'p3',
          name: 'Zaehlerschrank Weber',
          status: 'abgeschlossen',
          start_date: '2026-06-01',
          end_date: '2026-06-07',
          work_end_date: null,
          completed_at: '2026-06-07T16:00:00Z',
          description: 'planned_hours: 12',
          budget: 2400,
          labor_costs: 800,
          material_costs: 600,
        },
      ],
      workHours: [],
      timeEntries: [],
      invoices: [],
    });

    expect(insights.invoiceReadyCount).toBe(1);
  });

  it('marks active projects without budget or planned hours as missing calculation', () => {
    const insights = createDashboardInsights({
      today: new Date('2026-06-10T12:00:00Z'),
      projects: [
        {
          id: 'p4',
          name: 'Wallbox Klein',
          status: 'beauftragt',
          start_date: '2026-06-15',
          end_date: null,
          work_end_date: null,
          completed_at: null,
          description: 'Kunde wartet auf Termin',
          budget: null,
          labor_costs: null,
          material_costs: null,
        },
      ],
      workHours: [],
      timeEntries: [],
      invoices: [],
    });

    expect(insights.missingCalculationCount).toBe(1);
    expect(insights.riskyProjects[0].signals).toContain('Kalkulation fehlt');
  });

  it('uses accepted offer targets as the project baseline', () => {
    const insights = createDashboardInsights({
      today: new Date('2026-06-10T12:00:00Z'),
      projects: [
        {
          id: 'p5',
          name: 'Bad Sanierung Schmitt',
          status: 'in_bearbeitung',
          start_date: '2026-06-01',
          end_date: '2026-06-30',
          work_end_date: null,
          completed_at: null,
          description: null,
          budget: null,
          labor_costs: 2600,
          material_costs: 900,
        },
      ],
      acceptedOffers: [
        {
          id: 'o5',
          project_id: 'p5',
          snapshot_net_total: 4200,
          targets: {
            planned_hours_total: 30,
            planned_material_cost_total: 850,
            planned_other_cost: 120,
            snapshot_target_cost: 2800,
            snapshot_target_margin: 33,
            snapshot_target_revenue: 4200,
          },
        },
      ],
      workHours: [{ project_id: 'p5', hours_worked: 34, work_description: 'Fliesenarbeiten fertig' }],
      timeEntries: [],
      invoices: [],
    });

    expect(insights.missingCalculationCount).toBe(0);
    expect(insights.criticalCount).toBe(1);
    expect(insights.riskyProjects[0].plannedHours).toBe(30);
    expect(insights.riskyProjects[0].budget).toBe(4200);
    expect(insights.riskyProjects[0].signals).toContain('4 h ueber Plan');
  });

  it('adds recorded material usage to actual project costs', () => {
    const insights = createDashboardInsights({
      today: new Date('2026-06-10T12:00:00Z'),
      projects: [
        {
          id: 'p6',
          name: 'Wallbox Hoffmann',
          status: 'active',
          start_date: '2026-06-09',
          end_date: '2026-06-12',
          work_end_date: null,
          completed_at: null,
          description: 'planned_hours: 8',
          budget: 1000,
          labor_costs: 450,
          material_costs: 300,
        },
      ],
      materialUsage: [
        { project_id: 'p6', quantity_used: 3, unit_price: 95 },
        { project_id: 'p6', quantity_used: 1, unit_price: 20 },
      ],
      workHours: [],
      timeEntries: [],
      invoices: [],
    });

    expect(insights.criticalCount).toBe(1);
    expect(insights.riskyProjects[0].actualCost).toBe(1055);
    expect(insights.riskyProjects[0].signals).toContain('55 EUR ueber Budget');
  });

  it('counts persisted open addendums without double-counting field note signals for the same project', () => {
    const insights = createDashboardInsights({
      today: new Date('2026-06-10T12:00:00Z'),
      projects: [
        {
          id: 'p7',
          name: 'Kueche Lang',
          status: 'in_bearbeitung',
          start_date: '2026-06-01',
          end_date: '2026-06-20',
          work_end_date: null,
          completed_at: null,
          description: 'planned_hours: 16',
          budget: 2500,
          labor_costs: 700,
          material_costs: 500,
        },
        {
          id: 'p8',
          name: 'Garage Altmann',
          status: 'active',
          start_date: '2026-06-02',
          end_date: '2026-06-21',
          work_end_date: null,
          completed_at: null,
          description: 'planned_hours: 10',
          budget: 1500,
          labor_costs: 300,
          material_costs: 400,
        },
      ],
      projectAddendums: [
        { id: 'a7', project_id: 'p7', status: 'approved' },
        { id: 'a8', project_id: 'p8', status: 'invoiced' },
      ],
      workHours: [{ project_id: 'p7', hours_worked: 4, work_description: 'Nachtrag: Leitung versetzen' }],
      timeEntries: [],
      invoices: [],
    });

    expect(insights.openAddendumCount).toBe(1);
    expect(insights.riskyProjects[0].signals).toContain('Nachtrag offen');
  });
});
