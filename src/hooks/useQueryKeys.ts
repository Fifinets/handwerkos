// Shared query keys and types for all domain-specific hook files
// Extracted from useApi.ts for consistent caching and invalidation

import { UseQueryOptions, UseMutationOptions } from '@tanstack/react-query';
import { ApiError } from '@/utils/api';

// Query keys for consistent caching and invalidation
export const QUERY_KEYS = {
  // KPI, Notification, and GoBD keys
  PROJECT_KPIS: 'project-kpis',
  PROJECT_KPIS_SUMMARY: 'project-kpis-summary',
  NOTIFICATIONS: 'notifications',
  NOTIFICATION_STATS: 'notification-stats',
  WORKER_STATUS: 'worker-status',
  AUDIT_LOGS: 'audit-logs',
  AUDIT_TRAIL: 'audit-trail',
  AUDIT_STATS: 'audit-stats',
  NUMBER_SEQUENCES: 'number-sequences',
  GOBD_DOCUMENTS: 'gobd-documents',
  IMMUTABILITY_CHECK: 'immutability-check',
  DATEV_EXPORTS: 'datev-exports',
  DATEV_ACCOUNT_MAPPINGS: 'datev-account-mappings',
  GERMAN_VAT_RETURNS: 'german-vat-returns',
  GERMAN_PERIODS: 'german-periods',
  GERMAN_EXPENSE_REPORTS: 'german-expense-reports',
  AI_DOCUMENTS: 'ai-documents',
  AI_SEARCH_RESULTS: 'ai-search-results',
  AI_INTENT_ANALYSES: 'ai-intent-analyses',
  AI_ESTIMATIONS: 'ai-estimations',
  AI_INDEXING_STATUS: 'ai-indexing-status',
  // Customer keys
  customers: ['customers'] as const,
  customer: (id: string) => ['customers', id] as const,
  customerStats: (id: string) => ['customers', id, 'stats'] as const,
  customerProjects: (id: string) => ['customers', id, 'projects'] as const,
  customerInvoices: (id: string) => ['customers', id, 'invoices'] as const,

  // Offer keys
  offers: ['offers'] as const,
  offer: (id: string) => ['offers', id] as const,
  offerItems: (id: string) => ['offers', id, 'items'] as const,
  offerTargets: (id: string) => ['offers', id, 'targets'] as const,
  offerStats: ['offers', 'stats'] as const,
  customerOffers: (customerId: string) => ['customers', customerId, 'offers'] as const,
  offerTemplates: ['offer-position-templates'] as const,
  companyAISettings: ['company-ai-settings'] as const,
  effectiveHourlyRate: ['effective-hourly-rate'] as const,

  // Order keys
  orders: ['orders'] as const,
  order: (id: string) => ['orders', id] as const,
  orderStats: ['orders', 'stats'] as const,

  // Project keys
  projects: ['projects'] as const,
  project: (id: string) => ['projects', id] as const,
  projectStats: (id: string) => ['projects', id, 'stats'] as const,
  projectTimeline: (id: string) => ['projects', id, 'timeline'] as const,

  // Timesheet keys
  timesheets: ['timesheets'] as const,
  timesheet: (id: string) => ['timesheets', id] as const,
  employeeTimesheetStats: (employeeId: string) => ['timesheets', 'employee', employeeId, 'stats'] as const,
  projectTimesheetSummary: (projectId: string) => ['timesheets', 'project', projectId, 'summary'] as const,

  // Material & Stock keys
  materials: ['materials'] as const,
  material: (id: string) => ['materials', id] as const,
  materialStats: ['materials', 'stats'] as const,
  lowStockMaterials: ['materials', 'low-stock'] as const,
  stockMovements: ['stock-movements'] as const,
  stockValuation: ['stock', 'valuation'] as const,
  stockAnalytics: ['stock', 'analytics'] as const,

  // Finance keys
  invoices: ['invoices'] as const,
  invoice: (id: string) => ['invoices', id] as const,
  expenses: ['expenses'] as const,
  expense: (id: string) => ['expenses', id] as const,
  financialKpis: ['finance', 'kpis'] as const,
  revenueByMonth: ['finance', 'revenue-by-month'] as const,
  expensesByCategory: ['finance', 'expenses-by-category'] as const,
  profitLossReport: ['finance', 'profit-loss'] as const,

  // Document keys
  documents: ['documents'] as const,
  document: (id: string) => ['documents', id] as const,
  documentStats: ['documents', 'stats'] as const,
  expiringDocuments: ['documents', 'expiring'] as const,

  // Employee keys
  employees: ['employees'] as const,
  employee: (id: string) => ['employees', id] as const,

  // Planner keys
  plannerEmployees: (companyId: string) => ['planner', 'employees', companyId] as const,
  plannerProjects: (companyId: string) => ['planner', 'projects', companyId] as const,
  plannerVacations: (companyId: string) => ['planner', 'vacations', companyId] as const,
  plannerCalendarEvents: (companyId: string) => ['planner', 'calendar-events', companyId] as const,
  plannerDevices: (companyId: string) => ['planner', 'devices', companyId] as const,
  plannerEquipmentAssignments: (companyId: string) => ['planner', 'equipment-assignments', companyId] as const,

  // Machine/Equipment keys
  machines: ['machines'] as const,
  machine: (id: string) => ['machines', id] as const,
  machineAssignments: (deviceId: string) => ['machines', deviceId, 'assignments'] as const,

  // Site Documentation keys
  siteDocEntries: (projectId: string) => ['site-docs', projectId, 'entries'] as const,
  siteDocEntry: (id: string) => ['site-docs', 'entry', id] as const,
  siteDocPhotos: (projectId: string) => ['site-docs', projectId, 'photos'] as const,
} as const;

// Generic hook types
export type UseApiQueryOptions<T> = Omit<UseQueryOptions<T, ApiError>, 'queryKey' | 'queryFn'>;
export type UseApiMutationOptions<T, V> = Omit<UseMutationOptions<T, ApiError, V>, 'mutationFn'>;
