// Core DTOs and Zod schemas for HandwerkOS entities
// Provides type-safe validation for API requests and responses

import { z } from 'zod';

// Base schemas for common fields
export const BaseEntitySchema = z.object({
  id: z.string().uuid(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
  company_id: z.string().uuid().optional(),
});

// Customer schemas
export const CustomerCreateSchema = z.object({
  company_name: z.string().min(1, 'Firmenname ist erforderlich'),
  contact_person: z.string().min(1, 'Ansprechpartner ist erforderlich'),
  email: z.string().email('Gültige E-Mail-Adresse erforderlich'),
  phone: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  postal_code: z.string().optional(),
  country: z.string().default('Deutschland'),
  tax_number: z.string().optional(),
  customer_number: z.string().optional(),
  status: z.enum(['Aktiv', 'Premium', 'Inaktiv']).default('Aktiv'),
});

export const CustomerUpdateSchema = CustomerCreateSchema.partial();

export const CustomerSchema = BaseEntitySchema.merge(CustomerCreateSchema).extend({
  customer_number: z.string().nullable(),
});

// Material schemas
export const MaterialCreateSchema = z.object({
  name: z.string().min(1, 'Materialname ist erforderlich'),
  sku: z.string().optional(),
  description: z.string().optional(),
  unit: z.string().default('Stk'),
  unit_price: z.number().min(0, 'Preis muss positiv sein').default(0),
  stock: z.number().int().min(0, 'Lagerbestand muss positiv sein').default(0),
  reorder_min: z.number().int().min(0, 'Mindestbestand muss positiv sein').default(0),
  category: z.string().optional(),
  supplier: z.string().optional(),
});

export const MaterialUpdateSchema = MaterialCreateSchema.partial();

export const MaterialSchema = BaseEntitySchema.merge(MaterialCreateSchema);

// Quote schemas
export const QuoteItemSchema = z.object({
  id: z.string().optional(),
  description: z.string().min(1, 'Beschreibung ist erforderlich'),
  quantity: z.number().min(0.01, 'Menge muss größer als 0 sein'),
  unit: z.string().default('Stk'),
  unit_price: z.number().min(0, 'Preis muss positiv sein'),
  total_price: z.number().min(0, 'Gesamtpreis muss positiv sein'),
});

export const QuoteCreateSchema = z.object({
  customer_id: z.string().uuid('Kunde ist erforderlich'),
  title: z.string().min(1, 'Titel ist erforderlich'),
  description: z.string().optional(),
  body: z.object({
    items: z.array(QuoteItemSchema).min(1, 'Mindestens ein Posten erforderlich'),
    notes: z.string().optional(),
    terms: z.string().optional(),
  }),
  tax_rate: z.number().min(0).max(100).default(19),
  valid_until: z.string().date().optional(),
});

export const QuoteUpdateSchema = QuoteCreateSchema.partial().extend({
  status: z.enum(['draft', 'sent', 'accepted', 'rejected', 'expired']).optional(),
  quote_number: z.string().optional(),
});

export const QuoteSchema = BaseEntitySchema.merge(QuoteCreateSchema).extend({
  quote_number: z.string().nullable(),
  status: z.enum(['draft', 'sent', 'accepted', 'rejected', 'expired']).default('draft'),
  total_net: z.number().optional(),
  total_gross: z.number().optional(),
  sent_at: z.string().datetime().optional(),
  accepted_at: z.string().datetime().optional(),
});

// Order schemas
export const OrderCreateSchema = z.object({
  quote_id: z.string().uuid().optional(),
  customer_id: z.string().uuid('Kunde ist erforderlich'),
  title: z.string().min(1, 'Titel ist erforderlich'),
  description: z.string().optional(),
  total_amount: z.number().min(0, 'Betrag muss positiv sein'),
});

export const OrderUpdateSchema = OrderCreateSchema.partial().extend({
  status: z.enum(['open', 'in_progress', 'completed', 'cancelled']).optional(),
  order_number: z.string().optional(),
});

export const OrderSchema = BaseEntitySchema.merge(OrderCreateSchema).extend({
  order_number: z.string().nullable(),
  status: z.enum(['open', 'in_progress', 'completed', 'cancelled']).default('open'),
});

// Project schemas (extending existing)
export const ProjectCreateSchema = z.object({
  // order_id: z.string().uuid().optional(), // TODO: Add after DB migration
  customer_id: z.string().uuid().optional(),
  name: z.string().min(1, 'Projektname ist erforderlich'),
  description: z.string().optional(),
  status: z.enum(['geplant', 'in_bearbeitung', 'abgeschlossen']).default('geplant'),
  budget: z.number().min(0, 'Budget muss positiv sein').optional(),
  start_date: z.string().date().optional(),
  end_date: z.string().date().optional(),
  // progress_percentage: z.number().min(0).max(100).default(0), // TODO: Add after DB migration
});

export const ProjectUpdateSchema = ProjectCreateSchema.partial();

export const ProjectSchema = BaseEntitySchema.merge(ProjectCreateSchema).extend({
  material_costs: z.number().default(0),
  labor_costs: z.number().default(0),
  hours_planned: z.number().optional(),
  hours_actual: z.number().default(0),
});

// Invoice schemas
export const InvoiceCreateSchema = z.object({
  project_id: z.string().uuid().optional(),
  customer_id: z.string().uuid('Kunde ist erforderlich'),
  title: z.string().min(1, 'Titel ist erforderlich'),
  description: z.string().optional(),
  amount: z.number().min(0, 'Betrag muss positiv sein'),
  tax_rate: z.number().min(0).max(100).default(19),
  due_date: z.string().date().optional(),
});

export const InvoiceUpdateSchema = InvoiceCreateSchema.partial().extend({
  status: z.enum(['draft', 'sent', 'paid', 'overdue', 'void', 'cancelled']).optional(),
  invoice_number: z.string().optional(),
});

export const InvoiceSchema = BaseEntitySchema.merge(InvoiceCreateSchema).extend({
  invoice_number: z.string().nullable(),
  status: z.enum(['draft', 'sent', 'paid', 'overdue', 'void', 'cancelled']).default('draft'),
  net_amount: z.number().optional(),
  tax_amount: z.number().optional(),
  sent_at: z.string().datetime().optional(),
  paid_at: z.string().datetime().optional(),
});

// Timesheet schemas
export const TimesheetCreateSchema = z.object({
  project_id: z.string().uuid('Projekt ist erforderlich'),
  employee_id: z.string().uuid('Mitarbeiter ist erforderlich'),
  date: z.string().date('Gültiges Datum erforderlich'),
  start_time: z.string().time().optional(),
  end_time: z.string().time().optional(),
  break_minutes: z.number().int().min(0).default(0),
  hours: z.number().min(0, 'Stunden müssen positiv sein'),
  description: z.string().optional(),
  task_category: z.string().default('general'),
  hourly_rate: z.number().min(0, 'Stundensatz muss positiv sein').optional(),
  is_billable: z.boolean().default(true),
});

export const TimesheetUpdateSchema = TimesheetCreateSchema.partial().extend({
  approved_by: z.string().uuid().optional(),
  approved_at: z.string().datetime().optional(),
});

export const TimesheetSchema = BaseEntitySchema.merge(TimesheetCreateSchema).extend({
  approved_by: z.string().uuid().optional(),
  approved_at: z.string().datetime().optional(),
});

// Expense schemas
export const ExpenseCreateSchema = z.object({
  project_id: z.string().uuid().optional(),
  employee_id: z.string().uuid().optional(),
  category: z.string().min(1, 'Kategorie ist erforderlich'),
  amount: z.number().min(0, 'Betrag muss positiv sein'),
  description: z.string().optional(),
  receipt_url: z.string().url().optional(),
  expense_date: z.string().date('Gültiges Datum erforderlich'),
  is_billable: z.boolean().default(false),
});

export const ExpenseUpdateSchema = ExpenseCreateSchema.partial().extend({
  approved_by: z.string().uuid().optional(),
  approved_at: z.string().datetime().optional(),
});

export const ExpenseSchema = BaseEntitySchema.merge(ExpenseCreateSchema).extend({
  approved_by: z.string().uuid().optional(),
  approved_at: z.string().datetime().optional(),
});

// Stock Movement schemas
export const StockMovementCreateSchema = z.object({
  material_id: z.string().uuid('Material ist erforderlich'),
  project_id: z.string().uuid().optional(),
  quantity: z.number().int().refine((val) => val !== 0, 'Menge darf nicht 0 sein'),
  movement_type: z.enum(['issue', 'receive', 'adjust', 'return']),
  reference_number: z.string().optional(),
  notes: z.string().optional(),
});

export const StockMovementSchema = BaseEntitySchema.merge(StockMovementCreateSchema);

// Employee schemas (extending existing)
export const EmployeeCreateSchema = z.object({
  first_name: z.string().min(1, 'Vorname ist erforderlich'),
  last_name: z.string().min(1, 'Nachname ist erforderlich'),
  email: z.string().email('Gültige E-Mail-Adresse erforderlich'),
  phone: z.string().optional(),
  role: z.string().default('employee'),
  hourly_wage: z.number().min(0, 'Stundenlohn muss positiv sein').default(0),
  status: z.enum(['active', 'inactive', 'invited']).default('active'),
});

export const EmployeeUpdateSchema = EmployeeCreateSchema.partial();

export const EmployeeSchema = BaseEntitySchema.merge(EmployeeCreateSchema);

// API Response schemas
export const ApiSuccessResponseSchema = z.object({
  success: z.literal(true),
  data: z.any(),
  message: z.string().optional(),
});

export const ApiErrorResponseSchema = z.object({
  success: z.literal(false),
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.any().optional(),
  }),
});

export const ApiResponseSchema = z.union([ApiSuccessResponseSchema, ApiErrorResponseSchema]);

// Pagination schemas
export const PaginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  sort_by: z.string().optional(),
  sort_order: z.enum(['asc', 'desc']).default('desc'),
});

export const PaginationResponseSchema = z.object({
  items: z.array(z.any()),
  pagination: z.object({
    page: z.number(),
    limit: z.number(),
    total_items: z.number(),
    total_pages: z.number(),
    has_next: z.boolean(),
    has_prev: z.boolean(),
  }),
});

// Export TypeScript types
export type Customer = z.infer<typeof CustomerSchema>;
export type CustomerCreate = z.infer<typeof CustomerCreateSchema>;
export type CustomerUpdate = z.infer<typeof CustomerUpdateSchema>;

export type Material = z.infer<typeof MaterialSchema>;
export type MaterialCreate = z.infer<typeof MaterialCreateSchema>;
export type MaterialUpdate = z.infer<typeof MaterialUpdateSchema>;

export type Quote = z.infer<typeof QuoteSchema>;
export type QuoteCreate = z.infer<typeof QuoteCreateSchema>;
export type QuoteUpdate = z.infer<typeof QuoteUpdateSchema>;
export type QuoteItem = z.infer<typeof QuoteItemSchema>;

export type Order = z.infer<typeof OrderSchema>;
export type OrderCreate = z.infer<typeof OrderCreateSchema>;
export type OrderUpdate = z.infer<typeof OrderUpdateSchema>;

export type Project = z.infer<typeof ProjectSchema>;
export type ProjectCreate = z.infer<typeof ProjectCreateSchema>;
export type ProjectUpdate = z.infer<typeof ProjectUpdateSchema>;

export type Invoice = z.infer<typeof InvoiceSchema>;
export type InvoiceCreate = z.infer<typeof InvoiceCreateSchema>;
export type InvoiceUpdate = z.infer<typeof InvoiceUpdateSchema>;

export type Timesheet = z.infer<typeof TimesheetSchema>;
export type TimesheetCreate = z.infer<typeof TimesheetCreateSchema>;
export type TimesheetUpdate = z.infer<typeof TimesheetUpdateSchema>;

export type Expense = z.infer<typeof ExpenseSchema>;
export type ExpenseCreate = z.infer<typeof ExpenseCreateSchema>;
export type ExpenseUpdate = z.infer<typeof ExpenseUpdateSchema>;

export type StockMovement = z.infer<typeof StockMovementSchema>;
export type StockMovementCreate = z.infer<typeof StockMovementCreateSchema>;

export type Employee = z.infer<typeof EmployeeSchema>;
export type EmployeeCreate = z.infer<typeof EmployeeCreateSchema>;
export type EmployeeUpdate = z.infer<typeof EmployeeUpdateSchema>;

export type ApiSuccessResponse<T = any> = {
  success: true;
  data: T;
  message?: string;
};

export type ApiErrorResponse = {
  success: false;
  error: {
    code: string;
    message: string;
    details?: any;
  };
};

export type ApiResponse<T = any> = ApiSuccessResponse<T> | ApiErrorResponse;

export type PaginationQuery = z.infer<typeof PaginationQuerySchema>;
export type PaginationResponse<T = any> = {
  items: T[];
  pagination: {
    page: number;
    limit: number;
    total_items: number;
    total_pages: number;
    has_next: boolean;
    has_prev: boolean;
  };
};