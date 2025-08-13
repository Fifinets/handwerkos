// GoBD Compliance DTOs and Zod schemas for HandwerkOS
// German tax compliance requirements: audit trails, immutable records, numbered documents

import { z } from 'zod';

// Audit Log schemas
export const AuditLogCreateSchema = z.object({
  entity_type: z.string().min(1, 'Entity type is required'),
  entity_id: z.string().uuid('Valid entity ID required'),
  action: z.enum(['INSERT', 'UPDATE', 'DELETE', 'STATUS_CHANGE']),
  old_values: z.record(z.any()).optional(),
  new_values: z.record(z.any()).optional(),
  changed_fields: z.array(z.string()).optional(),
  reason: z.string().optional(),
  ip_address: z.string().ip().optional(),
  user_agent: z.string().optional(),
});

export const AuditLogSchema = z.object({
  id: z.string().uuid(),
  entity_type: z.string(),
  entity_id: z.string().uuid(),
  action: z.enum(['INSERT', 'UPDATE', 'DELETE', 'STATUS_CHANGE']),
  old_values: z.record(z.any()).optional(),
  new_values: z.record(z.any()).optional(),
  changed_fields: z.array(z.string()).optional(),
  user_id: z.string().uuid().optional(),
  user_email: z.string().email().optional(),
  reason: z.string().optional(),
  ip_address: z.string().optional(),
  user_agent: z.string().optional(),
  company_id: z.string().uuid().optional(),
  created_at: z.string().datetime(),
});

// Number Sequences schemas for GoBD-compliant document numbering
export const NumberSequenceCreateSchema = z.object({
  sequence_name: z.string().min(1, 'Sequence name is required'),
  prefix: z.string().default(''),
  format_pattern: z.string().default('{prefix}-{year}-{number:04d}'),
  year_reset: z.boolean().default(true),
  current_value: z.number().int().min(0).default(0),
});

export const NumberSequenceUpdateSchema = NumberSequenceCreateSchema.partial();

export const NumberSequenceSchema = z.object({
  id: z.string().uuid(),
  sequence_name: z.string(),
  current_value: z.number().int().min(0),
  prefix: z.string(),
  year_reset: z.boolean(),
  format_pattern: z.string(),
  last_reset_year: z.number().int().optional(),
  company_id: z.string().uuid().optional(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});

// Immutable Files schemas for tamper-proof document storage
export const ImmutableFileCreateSchema = z.object({
  entity_type: z.string().min(1, 'Entity type is required'),
  entity_id: z.string().uuid('Valid entity ID required'),
  file_name: z.string().min(1, 'File name is required'),
  file_path: z.string().min(1, 'File path is required'),
  file_size: z.number().int().min(0, 'File size must be non-negative'),
  mime_type: z.string().min(1, 'MIME type is required'),
  sha256_hash: z.string().regex(/^[a-fA-F0-9]{64}$/, 'Valid SHA256 hash required'),
  is_original: z.boolean().default(true),
  legal_category: z.enum(['invoice', 'contract', 'receipt', 'tax_document', 'correspondence']),
  retention_until: z.string().date('Valid retention date required'),
});

export const ImmutableFileSchema = z.object({
  id: z.string().uuid(),
  entity_type: z.string(),
  entity_id: z.string().uuid(),
  file_name: z.string(),
  file_path: z.string(),
  file_size: z.number().int(),
  mime_type: z.string(),
  sha256_hash: z.string().regex(/^[a-fA-F0-9]{64}$/),
  created_by: z.string().uuid().optional(),
  is_original: z.boolean(),
  legal_category: z.enum(['invoice', 'contract', 'receipt', 'tax_document', 'correspondence']),
  retention_until: z.string().date(),
  company_id: z.string().uuid().optional(),
  created_at: z.string().datetime(),
});

// DATEV Export schemas
export const DatevExportRequestSchema = z.object({
  from_date: z.string().date('Valid from date required'),
  to_date: z.string().date('Valid to date required'),
  export_type: z.enum(['invoices', 'postings', 'full']).default('invoices'),
  include_drafts: z.boolean().default(false),
  consultant_number: z.string().optional(),
  client_number: z.string().optional(),
  encoding: z.enum(['UTF-8', 'CP1252']).default('CP1252'),
});

export const DatevExportResponseSchema = z.object({
  export_id: z.string().uuid(),
  file_url: z.string().url(),
  file_name: z.string(),
  record_count: z.number().int().min(0),
  export_date: z.string().datetime(),
  from_date: z.string().date(),
  to_date: z.string().date(),
  checksum: z.string().optional(),
});

// DATEV CSV Record schema (for validation)
export const DatevCsvRecordSchema = z.object({
  // Standard DATEV fields
  belegdatum: z.string().date(), // Document date
  rechnungsnummer: z.string(), // Invoice number
  debitorenkonto: z.string().optional(), // Customer account
  gegenkonto: z.string(), // Contra account
  bu_schluessel: z.string().optional(), // Posting key (VAT code)
  nettobetrag: z.number(), // Net amount
  steuerbetrag: z.number().default(0), // Tax amount
  bruttobetrag: z.number(), // Gross amount
  belegfeld1: z.string().optional(), // Reference field
  kost1: z.string().optional(), // Cost center 1
  kost2: z.string().optional(), // Cost center 2
  // Additional fields for better tracking
  project_id: z.string().uuid().optional(),
  customer_id: z.string().uuid().optional(),
  description: z.string().optional(),
});

// Document Status Change schemas (for GoBD compliance)
export const DocumentStatusChangeSchema = z.object({
  entity_type: z.enum(['quote', 'order', 'invoice']),
  entity_id: z.string().uuid(),
  from_status: z.string(),
  to_status: z.string(),
  reason: z.string().optional(),
  require_immutable_file: z.boolean().default(false),
  file_data: z.object({
    content: z.string(), // Base64 encoded file content
    filename: z.string(),
    mime_type: z.string(),
  }).optional(),
});

// Compliance Report schemas
export const ComplianceReportRequestSchema = z.object({
  report_type: z.enum(['audit_summary', 'document_integrity', 'number_sequence_gaps', 'retention_overview']),
  from_date: z.string().date().optional(),
  to_date: z.string().date().optional(),
  entity_types: z.array(z.string()).optional(),
});

export const ComplianceReportResponseSchema = z.object({
  report_type: z.string(),
  generated_at: z.string().datetime(),
  period: z.object({
    from_date: z.string().date().optional(),
    to_date: z.string().date().optional(),
  }),
  summary: z.object({
    total_records: z.number().int(),
    compliant_records: z.number().int(),
    issues_found: z.number().int(),
    compliance_percentage: z.number().min(0).max(100),
  }),
  details: z.array(z.object({
    entity_type: z.string(),
    entity_id: z.string().uuid(),
    issue_type: z.string(),
    description: z.string(),
    severity: z.enum(['low', 'medium', 'high', 'critical']),
    recommendation: z.string().optional(),
  })),
  file_integrity: z.object({
    total_files: z.number().int(),
    verified_files: z.number().int(),
    failed_verifications: z.number().int(),
    missing_files: z.number().int(),
  }).optional(),
});

// Archive schemas for long-term storage
export const ArchiveRequestSchema = z.object({
  entity_type: z.string().min(1, 'Entity type is required'),
  entity_ids: z.array(z.string().uuid()).min(1, 'At least one entity ID required'),
  archive_reason: z.string().min(1, 'Archive reason is required'),
  retention_years: z.number().int().min(1).max(30).default(10),
  include_related: z.boolean().default(true),
});

export const ArchiveResponseSchema = z.object({
  archive_id: z.string().uuid(),
  archived_count: z.number().int(),
  archive_location: z.string(),
  retention_until: z.string().date(),
  created_at: z.string().datetime(),
});

// Export TypeScript types
export type AuditLog = z.infer<typeof AuditLogSchema>;
export type AuditLogCreate = z.infer<typeof AuditLogCreateSchema>;

export type NumberSequence = z.infer<typeof NumberSequenceSchema>;
export type NumberSequenceCreate = z.infer<typeof NumberSequenceCreateSchema>;
export type NumberSequenceUpdate = z.infer<typeof NumberSequenceUpdateSchema>;

export type ImmutableFile = z.infer<typeof ImmutableFileSchema>;
export type ImmutableFileCreate = z.infer<typeof ImmutableFileCreateSchema>;

export type DatevExportRequest = z.infer<typeof DatevExportRequestSchema>;
export type DatevExportResponse = z.infer<typeof DatevExportResponseSchema>;
export type DatevCsvRecord = z.infer<typeof DatevCsvRecordSchema>;

export type DocumentStatusChange = z.infer<typeof DocumentStatusChangeSchema>;

export type ComplianceReportRequest = z.infer<typeof ComplianceReportRequestSchema>;
export type ComplianceReportResponse = z.infer<typeof ComplianceReportResponseSchema>;

export type ArchiveRequest = z.infer<typeof ArchiveRequestSchema>;
export type ArchiveResponse = z.infer<typeof ArchiveResponseSchema>;

// Utility functions for GoBD compliance
export const isImmutableStatus = (entityType: string, status: string): boolean => {
  const immutableStates = {
    quote: ['sent', 'accepted', 'rejected'],
    order: ['confirmed', 'in_progress', 'completed', 'cancelled'],
    invoice: ['sent', 'paid', 'overdue', 'void'],
  };
  
  return immutableStates[entityType as keyof typeof immutableStates]?.includes(status) || false;
};

export const requiresDocumentNumber = (entityType: string, status: string): boolean => {
  const numberingTriggers = {
    quote: ['sent'],
    order: ['confirmed', 'in_progress'],
    invoice: ['sent'],
  };
  
  return numberingTriggers[entityType as keyof typeof numberingTriggers]?.includes(status) || false;
};

export const getRetentionPeriod = (legalCategory: string): number => {
  const retentionYears = {
    invoice: 10,
    contract: 10,
    receipt: 10,
    tax_document: 10,
    correspondence: 6,
  };
  
  return retentionYears[legalCategory as keyof typeof retentionYears] || 10;
};