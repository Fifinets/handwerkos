/**
 * Finanzmodul - TypeScript Definitionen
 * Einnahmen, Ausgaben, Rechnungen, Berichte
 */

// === EINNAHMEN / RECHNUNGEN ===
export interface Invoice {
  id: string;
  company_id: string;
  customer_id: string;
  project_id?: string;
  order_id?: string;
  
  // Rechnungsdetails
  invoice_number: string;
  invoice_date: string;
  due_date: string;
  title: string;
  description?: string;
  
  // Finanzielle Daten
  subtotal: number;        // Nettobetrag
  tax_rate: number;        // Steuersatz (19%, 7%, etc.)
  tax_amount: number;      // Steuerbetrag
  total_amount: number;    // Bruttobetrag
  
  // Status & Workflow
  status: 'draft' | 'sent' | 'paid' | 'overdue' | 'cancelled';
  payment_status: 'unpaid' | 'partial' | 'paid';
  payment_date?: string;
  payment_method?: string;
  
  // Versand & Dokumente
  pdf_url?: string;
  sent_date?: string;
  sent_via?: 'email' | 'post' | 'hand';
  
  // Teilrechnungen
  is_partial: boolean;
  parent_invoice_id?: string;
  partial_amount?: number;
  
  // Storno
  is_cancelled: boolean;
  cancellation_reason?: string;
  cancellation_date?: string;
  
  // Metadaten
  created_at: string;
  updated_at: string;
  created_by: string;
}

export interface InvoiceItem {
  id: string;
  invoice_id: string;
  
  description: string;
  quantity: number;
  unit: string;
  unit_price: number;
  total_price: number;
  tax_rate: number;
  
  // Projektzuordnung
  project_id?: string;
  category?: string;
}

export interface Offer {
  id: string;
  company_id: string;
  customer_id: string;
  project_id?: string;
  
  offer_number: string;
  offer_date: string;
  valid_until: string;
  title: string;
  description?: string;
  
  subtotal: number;
  tax_rate: number;
  tax_amount: number;
  total_amount: number;
  
  status: 'draft' | 'sent' | 'accepted' | 'rejected' | 'expired';
  
  // Conversion zu Auftrag/Rechnung
  converted_to_order?: boolean;
  order_id?: string;
  invoice_id?: string;
  
  created_at: string;
  updated_at: string;
}

// === AUSGABEN ===
export interface Expense {
  id: string;
  company_id: string;
  project_id?: string;
  
  // Ausgabendetails
  expense_date: string;
  description: string;
  category: 'materials' | 'subcontractor' | 'labor' | 'operating' | 'other';
  subcategory?: string;
  
  // Finanzielle Daten
  net_amount: number;
  tax_rate: number;
  tax_amount: number;
  gross_amount: number;
  
  // Lieferant/Dienstleister
  supplier_name?: string;
  supplier_id?: string;
  
  // Belege & Dokumentation
  receipt_url?: string;
  invoice_number?: string;
  
  // Genehmigung & Status
  status: 'pending' | 'approved' | 'paid' | 'rejected';
  approved_by?: string;
  approved_date?: string;
  
  // Lagerbezug
  inventory_items?: InventoryUsage[];
  
  created_at: string;
  updated_at: string;
  created_by: string;
}

export interface InventoryUsage {
  id: string;
  expense_id: string;
  project_id?: string;
  
  item_name: string;
  quantity: number;
  unit: string;
  unit_cost: number;
  total_cost: number;
}

export interface LaborCost {
  id: string;
  company_id: string;
  project_id?: string;
  employee_id: string;
  
  work_date: string;
  hours_worked: number;
  hourly_rate: number;
  total_cost: number;
  
  description?: string;
  overtime_hours?: number;
  overtime_rate?: number;
  
  status: 'draft' | 'approved' | 'billed';
  
  created_at: string;
  updated_at: string;
}

// === BERICHTE & AUSWERTUNGEN ===
export interface FinancialReport {
  id: string;
  company_id: string;
  
  report_type: 'revenue' | 'expenses' | 'profit_loss' | 'project_profitability' | 'tax';
  period_start: string;
  period_end: string;
  
  data: any; // JSON mit Berichtsdaten
  generated_at: string;
  generated_by: string;
}

export interface OpenItem {
  invoice_id: string;
  customer_name: string;
  invoice_number: string;
  invoice_date: string;
  due_date: string;
  total_amount: number;
  paid_amount: number;
  outstanding_amount: number;
  days_overdue: number;
  status: 'open' | 'overdue';
}

export interface ProjectProfitability {
  project_id: string;
  project_name: string;
  
  // Einnahmen
  total_revenue: number;
  invoiced_amount: number;
  outstanding_amount: number;
  
  // Ausgaben
  total_expenses: number;
  material_costs: number;
  labor_costs: number;
  subcontractor_costs: number;
  operating_costs: number;
  
  // Gewinn
  gross_profit: number;
  profit_margin: number;
  
  // Status
  budget_utilization: number;
  cost_overrun: boolean;
}

// === STEUERLICHE DATEN ===
export interface TaxReport {
  id: string;
  company_id: string;
  
  report_period: string; // 'monthly' | 'quarterly' | 'yearly'
  period_start: string;
  period_end: string;
  
  // Umsatzsteuer
  revenue_19_percent: number;
  tax_19_percent: number;
  revenue_7_percent: number;
  tax_7_percent: number;
  
  // Vorsteuer
  input_tax: number;
  
  // Saldo
  tax_liability: number; // Zu zahlen
  tax_refund: number;    // Zu erstatten
  
  // Export
  datev_exported: boolean;
  datev_export_date?: string;
  
  created_at: string;
}

export interface PaymentRecord {
  id: string;
  invoice_id?: string;
  expense_id?: string;
  
  payment_date: string;
  amount: number;
  payment_method: 'bank_transfer' | 'cash' | 'card' | 'check' | 'other';
  reference?: string;
  
  // Bankdaten
  bank_account?: string;
  transaction_id?: string;
  
  created_at: string;
  created_by: string;
}

// === UI/FORM TYPES ===
export interface InvoiceFormData {
  customer_id: string;
  project_id?: string;
  title: string;
  description?: string;
  invoice_date: string;
  due_date: string;
  items: InvoiceItemFormData[];
  tax_rate: number;
}

export interface InvoiceItemFormData {
  description: string;
  quantity: number;
  unit: string;
  unit_price: number;
}

export interface ExpenseFormData {
  project_id?: string;
  expense_date: string;
  description: string;
  category: string;
  subcategory?: string;
  supplier_name?: string;
  net_amount: number;
  tax_rate: number;
}

// === DASHBOARD STATS ===
export interface FinancialStats {
  // Aktueller Monat
  monthly_revenue: number;
  monthly_expenses: number;
  monthly_profit: number;
  
  // Offene Posten
  total_outstanding: number;
  overdue_count: number;
  
  // Projekt-Performance
  active_projects_profit: number;
  avg_profit_margin: number;
  
  // Trends
  revenue_trend: number; // Prozentuale Änderung zum Vormonat
  expense_trend: number;
  profit_trend: number;
}

export interface MonthlyRevenue {
  month: string;
  revenue: number;
  expenses: number;
  profit: number;
}