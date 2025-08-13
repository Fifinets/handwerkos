// Central export for all HandwerkOS types and schemas
// Provides a single import point for type-safe development

// Core business entities
export * from './core';
export * from './ai';
export * from './gobd';

// Legacy types (for backward compatibility during migration)
export * from './project';
export * from './financial';
export * from './legacy-migration';

// Re-export commonly used Zod for convenience
export { z } from 'zod';

// Common type utilities
export type Optional<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;
export type Required<T, K extends keyof T> = T & Required<Pick<T, K>>;
export type Nullable<T> = T | null;
export type Maybe<T> = T | undefined;

// Database entity base type
export interface BaseEntity {
  id: string;
  created_at: string;
  updated_at: string;
  company_id?: string;
}

// Common response patterns
export interface ApiListResponse<T> {
  data: T[];
  count?: number;
  next?: string;
  previous?: string;
}

export interface ApiDetailResponse<T> {
  data: T;
}

// Status enums for consistency
export enum ProjectStatus {
  PLANNED = 'planned',
  ACTIVE = 'active', 
  BLOCKED = 'blocked',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
}

export enum QuoteStatus {
  DRAFT = 'draft',
  SENT = 'sent',
  ACCEPTED = 'accepted',
  REJECTED = 'rejected',
  EXPIRED = 'expired',
}

export enum OrderStatus {
  OPEN = 'open',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed', 
  CANCELLED = 'cancelled',
}

export enum InvoiceStatus {
  DRAFT = 'draft',
  SENT = 'sent',
  PAID = 'paid',
  OVERDUE = 'overdue',
  VOID = 'void',
  CANCELLED = 'cancelled',
}

export enum CustomerStatus {
  ACTIVE = 'Aktiv',
  PREMIUM = 'Premium', 
  INACTIVE = 'Inaktiv',
}

export enum EmployeeStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  INVITED = 'invited',
}

// AI-specific enums
export enum AiSuggestionType {
  PARSE_INTENT = 'parse_intent',
  ESTIMATE = 'estimate',
  SCHEDULE = 'schedule',
  MATERIAL_LIST = 'material_list',
  COST_BREAKDOWN = 'cost_breakdown',
  TIMELINE = 'timeline',
}

export enum AiSuggestionStatus {
  ACTIVE = 'active',
  APPLIED = 'applied',
  REJECTED = 'rejected',
  SUPERSEDED = 'superseded',
}

// GoBD-specific enums
export enum AuditAction {
  INSERT = 'INSERT',
  UPDATE = 'UPDATE',
  DELETE = 'DELETE',
  STATUS_CHANGE = 'STATUS_CHANGE',
}

export enum LegalCategory {
  INVOICE = 'invoice',
  CONTRACT = 'contract', 
  RECEIPT = 'receipt',
  TAX_DOCUMENT = 'tax_document',
  CORRESPONDENCE = 'correspondence',
}

// Utility type for form handling
export type FormData<T> = {
  [K in keyof T]: T[K] extends string | number | boolean | null | undefined 
    ? T[K] 
    : T[K] extends Array<any>
    ? T[K]
    : string;
};

// Type for select options
export interface SelectOption<T = string> {
  value: T;
  label: string;
  disabled?: boolean;
}

// Common filter types
export interface DateRangeFilter {
  from_date?: string;
  to_date?: string;
}

export interface StatusFilter<T = string> {
  status?: T | T[];
}

export interface SearchFilter {
  search?: string;
  search_fields?: string[];
}

export interface PaginationFilter {
  page?: number;
  limit?: number;
  offset?: number;
}

export interface SortFilter {
  sort_by?: string;
  sort_order?: 'asc' | 'desc';
}

export type CommonFilter = DateRangeFilter & StatusFilter & SearchFilter & PaginationFilter & SortFilter;

// Type for table column definitions
export interface TableColumn<T = any> {
  key: keyof T | string;
  label: string;
  sortable?: boolean;
  width?: string | number;
  align?: 'left' | 'center' | 'right';
  render?: (value: any, row: T) => React.ReactNode;
}

// Type for form field definitions
export interface FormField<T = any> {
  name: keyof T | string;
  label: string;
  type: 'text' | 'email' | 'password' | 'number' | 'date' | 'select' | 'textarea' | 'checkbox' | 'radio';
  required?: boolean;
  placeholder?: string;
  options?: SelectOption[];
  validation?: any; // Zod schema
  disabled?: boolean;
  description?: string;
}

// Export schemas for runtime validation
export {
  CustomerSchema,
  CustomerCreateSchema,
  CustomerUpdateSchema,
  MaterialSchema,
  MaterialCreateSchema,
  MaterialUpdateSchema,
  QuoteSchema,
  QuoteCreateSchema,
  QuoteUpdateSchema,
  OrderSchema,
  OrderCreateSchema,
  OrderUpdateSchema,
  ProjectSchema,
  ProjectCreateSchema,
  ProjectUpdateSchema,
  InvoiceSchema,
  InvoiceCreateSchema,
  InvoiceUpdateSchema,
  TimesheetSchema,
  TimesheetCreateSchema,
  TimesheetUpdateSchema,
  ExpenseSchema,
  ExpenseCreateSchema,
  ExpenseUpdateSchema,
  EmployeeSchema,
  EmployeeCreateSchema,
  EmployeeUpdateSchema,
  ApiResponseSchema,
  PaginationQuerySchema,
  PaginationResponseSchema,
} from './core';

export {
  AiSuggestionSchema,
  AiSuggestionCreateSchema,
  AiSuggestionUpdateSchema,
  ParseIntentRequestSchema,
  ParseIntentResponseSchema,
  GenerateEstimateRequestSchema,
  GenerateEstimateResponseSchema,
} from './ai';

export {
  AuditLogSchema,
  NumberSequenceSchema,
  ImmutableFileSchema,
  DatevExportRequestSchema,
  DatevExportResponseSchema,
  ComplianceReportRequestSchema,
  ComplianceReportResponseSchema,
} from './gobd';