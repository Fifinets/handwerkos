import { describe, it, expect } from 'vitest';
import { QUERY_KEYS } from './useQueryKeys';

describe('QUERY_KEYS', () => {
  describe('static string keys', () => {
    it('has correct value for PROJECT_KPIS', () => {
      expect(QUERY_KEYS.PROJECT_KPIS).toBe('project-kpis');
    });

    it('has correct value for PROJECT_KPIS_SUMMARY', () => {
      expect(QUERY_KEYS.PROJECT_KPIS_SUMMARY).toBe('project-kpis-summary');
    });

    it('has correct value for NOTIFICATIONS', () => {
      expect(QUERY_KEYS.NOTIFICATIONS).toBe('notifications');
    });

    it('has correct value for NOTIFICATION_STATS', () => {
      expect(QUERY_KEYS.NOTIFICATION_STATS).toBe('notification-stats');
    });

    it('has correct value for WORKER_STATUS', () => {
      expect(QUERY_KEYS.WORKER_STATUS).toBe('worker-status');
    });

    it('has correct value for AUDIT_LOGS', () => {
      expect(QUERY_KEYS.AUDIT_LOGS).toBe('audit-logs');
    });

    it('has correct value for AUDIT_TRAIL', () => {
      expect(QUERY_KEYS.AUDIT_TRAIL).toBe('audit-trail');
    });

    it('has correct value for AUDIT_STATS', () => {
      expect(QUERY_KEYS.AUDIT_STATS).toBe('audit-stats');
    });

    it('has correct value for GOBD_DOCUMENTS', () => {
      expect(QUERY_KEYS.GOBD_DOCUMENTS).toBe('gobd-documents');
    });

    it('has correct value for AI_DOCUMENTS', () => {
      expect(QUERY_KEYS.AI_DOCUMENTS).toBe('ai-documents');
    });
  });

  describe('static array keys', () => {
    it('customers is a readonly array with correct value', () => {
      expect(QUERY_KEYS.customers).toEqual(['customers']);
    });

    it('offers is a readonly array with correct value', () => {
      expect(QUERY_KEYS.offers).toEqual(['offers']);
    });

    it('orders is a readonly array with correct value', () => {
      expect(QUERY_KEYS.orders).toEqual(['orders']);
    });

    it('projects is a readonly array with correct value', () => {
      expect(QUERY_KEYS.projects).toEqual(['projects']);
    });

    it('timesheets is a readonly array with correct value', () => {
      expect(QUERY_KEYS.timesheets).toEqual(['timesheets']);
    });

    it('materials is a readonly array with correct value', () => {
      expect(QUERY_KEYS.materials).toEqual(['materials']);
    });

    it('invoices is a readonly array with correct value', () => {
      expect(QUERY_KEYS.invoices).toEqual(['invoices']);
    });

    it('expenses is a readonly array with correct value', () => {
      expect(QUERY_KEYS.expenses).toEqual(['expenses']);
    });

    it('documents is a readonly array with correct value', () => {
      expect(QUERY_KEYS.documents).toEqual(['documents']);
    });

    it('employees is a readonly array with correct value', () => {
      expect(QUERY_KEYS.employees).toEqual(['employees']);
    });

    it('offerStats is a readonly array with correct value', () => {
      expect(QUERY_KEYS.offerStats).toEqual(['offers', 'stats']);
    });

    it('orderStats is a readonly array with correct value', () => {
      expect(QUERY_KEYS.orderStats).toEqual(['orders', 'stats']);
    });

    it('materialStats is a readonly array with correct value', () => {
      expect(QUERY_KEYS.materialStats).toEqual(['materials', 'stats']);
    });

    it('financialKpis is a readonly array with correct value', () => {
      expect(QUERY_KEYS.financialKpis).toEqual(['finance', 'kpis']);
    });
  });

  describe('dynamic key functions - customer', () => {
    it('customer(id) returns correct array', () => {
      expect(QUERY_KEYS.customer('abc-123')).toEqual(['customers', 'abc-123']);
    });

    it('customerStats(id) returns correct array', () => {
      expect(QUERY_KEYS.customerStats('abc-123')).toEqual(['customers', 'abc-123', 'stats']);
    });

    it('customerProjects(id) returns correct array', () => {
      expect(QUERY_KEYS.customerProjects('abc-123')).toEqual(['customers', 'abc-123', 'projects']);
    });

    it('customerInvoices(id) returns correct array', () => {
      expect(QUERY_KEYS.customerInvoices('abc-123')).toEqual(['customers', 'abc-123', 'invoices']);
    });

    it('customerOffers(id) returns correct array', () => {
      expect(QUERY_KEYS.customerOffers('c-1')).toEqual(['customers', 'c-1', 'offers']);
    });
  });

  describe('dynamic key functions - offer', () => {
    it('offer(id) returns correct array', () => {
      expect(QUERY_KEYS.offer('offer-1')).toEqual(['offers', 'offer-1']);
    });

    it('offerItems(id) returns correct array', () => {
      expect(QUERY_KEYS.offerItems('offer-1')).toEqual(['offers', 'offer-1', 'items']);
    });

    it('offerTargets(id) returns correct array', () => {
      expect(QUERY_KEYS.offerTargets('offer-1')).toEqual(['offers', 'offer-1', 'targets']);
    });
  });

  describe('dynamic key functions - order', () => {
    it('order(id) returns correct array', () => {
      expect(QUERY_KEYS.order('order-1')).toEqual(['orders', 'order-1']);
    });
  });

  describe('dynamic key functions - project', () => {
    it('project(id) returns correct array', () => {
      expect(QUERY_KEYS.project('proj-1')).toEqual(['projects', 'proj-1']);
    });

    it('projectStats(id) returns correct array', () => {
      expect(QUERY_KEYS.projectStats('proj-1')).toEqual(['projects', 'proj-1', 'stats']);
    });

    it('projectTimeline(id) returns correct array', () => {
      expect(QUERY_KEYS.projectTimeline('proj-1')).toEqual(['projects', 'proj-1', 'timeline']);
    });
  });

  describe('dynamic key functions - timesheet', () => {
    it('timesheet(id) returns correct array', () => {
      expect(QUERY_KEYS.timesheet('ts-1')).toEqual(['timesheets', 'ts-1']);
    });

    it('employeeTimesheetStats(id) returns correct array', () => {
      expect(QUERY_KEYS.employeeTimesheetStats('emp-1')).toEqual(['timesheets', 'employee', 'emp-1', 'stats']);
    });

    it('projectTimesheetSummary(id) returns correct array', () => {
      expect(QUERY_KEYS.projectTimesheetSummary('proj-1')).toEqual(['timesheets', 'project', 'proj-1', 'summary']);
    });
  });

  describe('dynamic key functions - material', () => {
    it('material(id) returns correct array', () => {
      expect(QUERY_KEYS.material('mat-1')).toEqual(['materials', 'mat-1']);
    });
  });

  describe('dynamic key functions - finance', () => {
    it('invoice(id) returns correct array', () => {
      expect(QUERY_KEYS.invoice('inv-1')).toEqual(['invoices', 'inv-1']);
    });

    it('expense(id) returns correct array', () => {
      expect(QUERY_KEYS.expense('exp-1')).toEqual(['expenses', 'exp-1']);
    });
  });

  describe('dynamic key functions - document', () => {
    it('document(id) returns correct array', () => {
      expect(QUERY_KEYS.document('doc-1')).toEqual(['documents', 'doc-1']);
    });
  });

  describe('dynamic key functions - employee', () => {
    it('employee(id) returns correct array', () => {
      expect(QUERY_KEYS.employee('emp-1')).toEqual(['employees', 'emp-1']);
    });
  });

  describe('dynamic key functions - site documentation', () => {
    it('siteDocEntries(projectId) returns correct array', () => {
      expect(QUERY_KEYS.siteDocEntries('proj-1')).toEqual(['site-docs', 'proj-1', 'entries']);
    });

    it('siteDocEntry(id) returns correct array', () => {
      expect(QUERY_KEYS.siteDocEntry('entry-1')).toEqual(['site-docs', 'entry', 'entry-1']);
    });

    it('siteDocPhotos(projectId) returns correct array', () => {
      expect(QUERY_KEYS.siteDocPhotos('proj-1')).toEqual(['site-docs', 'proj-1', 'photos']);
    });
  });

  describe('key uniqueness across domains', () => {
    it('top-level list keys are unique', () => {
      const listKeys = [
        QUERY_KEYS.customers,
        QUERY_KEYS.offers,
        QUERY_KEYS.orders,
        QUERY_KEYS.projects,
        QUERY_KEYS.timesheets,
        QUERY_KEYS.materials,
        QUERY_KEYS.invoices,
        QUERY_KEYS.expenses,
        QUERY_KEYS.documents,
        QUERY_KEYS.employees,
      ];

      const firstElements = listKeys.map((k) => k[0]);
      const uniqueFirstElements = new Set(firstElements);
      expect(uniqueFirstElements.size).toBe(firstElements.length);
    });

    it('customer(id) and project(id) produce different keys for same id', () => {
      const id = 'shared-id';
      expect(QUERY_KEYS.customer(id)).not.toEqual(QUERY_KEYS.project(id));
    });

    it('offer(id) and order(id) produce different keys for same id', () => {
      const id = 'shared-id';
      expect(QUERY_KEYS.offer(id)).not.toEqual(QUERY_KEYS.order(id));
    });

    it('invoice(id) and expense(id) produce different keys for same id', () => {
      const id = 'shared-id';
      expect(QUERY_KEYS.invoice(id)).not.toEqual(QUERY_KEYS.expense(id));
    });

    it('static string keys are all unique', () => {
      const stringKeys = [
        QUERY_KEYS.PROJECT_KPIS,
        QUERY_KEYS.PROJECT_KPIS_SUMMARY,
        QUERY_KEYS.NOTIFICATIONS,
        QUERY_KEYS.NOTIFICATION_STATS,
        QUERY_KEYS.WORKER_STATUS,
        QUERY_KEYS.AUDIT_LOGS,
        QUERY_KEYS.AUDIT_TRAIL,
        QUERY_KEYS.AUDIT_STATS,
        QUERY_KEYS.NUMBER_SEQUENCES,
        QUERY_KEYS.GOBD_DOCUMENTS,
        QUERY_KEYS.IMMUTABILITY_CHECK,
        QUERY_KEYS.DATEV_EXPORTS,
        QUERY_KEYS.DATEV_ACCOUNT_MAPPINGS,
        QUERY_KEYS.GERMAN_VAT_RETURNS,
        QUERY_KEYS.GERMAN_PERIODS,
        QUERY_KEYS.GERMAN_EXPENSE_REPORTS,
        QUERY_KEYS.AI_DOCUMENTS,
        QUERY_KEYS.AI_SEARCH_RESULTS,
        QUERY_KEYS.AI_INTENT_ANALYSES,
        QUERY_KEYS.AI_ESTIMATIONS,
        QUERY_KEYS.AI_INDEXING_STATUS,
      ];

      const uniqueKeys = new Set(stringKeys);
      expect(uniqueKeys.size).toBe(stringKeys.length);
    });
  });
});
