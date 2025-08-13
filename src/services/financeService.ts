// Finance service for HandwerkOS
// Handles invoices, expenses, financial KPIs and reporting

import { supabase } from '@/integrations/supabase/client';
import { 
  apiCall, 
  createQuery, 
  validateInput,
  getCurrentUserProfile,
  ApiError,
  API_ERROR_CODES 
} from '@/utils/api';
import {
  Invoice,
  InvoiceCreate,
  InvoiceUpdate,
  InvoiceCreateSchema,
  InvoiceUpdateSchema,
  Expense,
  ExpenseCreate,
  ExpenseUpdate,
  ExpenseCreateSchema,
  ExpenseUpdateSchema,
  PaginationQuery,
  PaginationResponse
} from '@/types';
import { eventBus } from './eventBus';

export interface FinancialKPIs {
  revenue: {
    total: number;
    this_month: number;
    last_month: number;
    growth_rate: number;
  };
  expenses: {
    total: number;
    this_month: number;
    last_month: number;
  };
  profit: {
    total: number;
    this_month: number;
    margin: number;
  };
  outstanding: {
    total: number;
    overdue: number;
    count: number;
  };
  cash_flow: {
    inflow: number;
    outflow: number;
    net: number;
  };
}

export class FinanceService {
  
  // === INVOICE OPERATIONS ===
  
  // Get all invoices with pagination and filtering
  static async getInvoices(
    pagination?: PaginationQuery,
    filters?: {
      status?: Invoice['status'];
      customer_id?: string;
      project_id?: string;
      overdue?: boolean;
      date_from?: string;
      date_to?: string;
    }
  ): Promise<PaginationResponse<Invoice>> {
    return apiCall(async () => {
      let query = supabase
        .from('invoices')
        .select(`
          *,
          customers (
            company_name,
            contact_person,
            email
          ),
          projects (
            name,
            project_number
          )
        `, { count: 'exact' });
      
      // Apply filters
      if (filters?.status) {
        query = query.eq('status', filters.status);
      }
      
      if (filters?.customer_id) {
        query = query.eq('customer_id', filters.customer_id);
      }
      
      if (filters?.project_id) {
        query = query.eq('project_id', filters.project_id);
      }
      
      if (filters?.overdue) {
        query = query
          .eq('status', 'sent')
          .lt('due_date', new Date().toISOString().split('T')[0]);
      }
      
      if (filters?.date_from) {
        query = query.gte('invoice_date', filters.date_from);
      }
      
      if (filters?.date_to) {
        query = query.lte('invoice_date', filters.date_to);
      }
      
      // Apply pagination
      if (pagination) {
        const offset = (pagination.page - 1) * pagination.limit;
        query = query
          .range(offset, offset + pagination.limit - 1)
          .order(pagination.sort_by || 'created_at', { 
            ascending: pagination.sort_order === 'asc' 
          });
      } else {
        query = query.order('created_at', { ascending: false });
      }
      
      const { data, count } = await createQuery<Invoice>(query).executeWithCount();
      
      return {
        items: data,
        pagination: {
          page: pagination?.page || 1,
          limit: pagination?.limit || data.length,
          total_items: count,
          total_pages: Math.ceil(count / (pagination?.limit || 20)),
          has_next: pagination ? (pagination.page * pagination.limit < count) : false,
          has_prev: pagination ? pagination.page > 1 : false,
        },
      };
    }, 'Get invoices');
  }
  
  // Get invoice by ID
  static async getInvoice(id: string): Promise<Invoice> {
    return apiCall(async () => {
      const query = supabase
        .from('invoices')
        .select(`
          *,
          customers (
            company_name,
            contact_person,
            email,
            address,
            city,
            postal_code
          ),
          projects (
            name,
            project_number,
            status
          )
        `)
        .eq('id', id);
      
      return createQuery<Invoice>(query).executeSingle();
    }, `Get invoice ${id}`);
  }
  
  // Create new invoice
  static async createInvoice(data: InvoiceCreate): Promise<Invoice> {
    return apiCall(async () => {
      // Validate input
      const validatedData = validateInput(InvoiceCreateSchema, data);
      
      // Calculate totals from items
      const items = validatedData.body?.items || [];
      const totalNet = items.reduce((sum, item) => sum + item.total_price, 0);
      const taxRate = validatedData.tax_rate || 19;
      const totalGross = totalNet * (1 + taxRate / 100);
      
      const invoiceData = {
        ...validatedData,
        total_net: totalNet,
        total_gross: totalGross,
        amount: totalGross,
        status: 'draft' as const,
        due_date: validatedData.due_date || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      };
      
      const query = supabase
        .from('invoices')
        .insert(invoiceData)
        .select()
        .single();
      
      const invoice = await createQuery<Invoice>(query).executeSingle();
      
      // Emit event for audit trail
      eventBus.emit('INVOICE_CREATED', {
        invoice,
        user_id: (await supabase.auth.getUser()).data.user?.id,
      });
      
      return invoice;
    }, 'Create invoice');
  }
  
  // Update existing invoice
  static async updateInvoice(id: string, data: InvoiceUpdate): Promise<Invoice> {
    return apiCall(async () => {
      // Get existing invoice for validation
      const existingInvoice = await this.getInvoice(id);
      
      // Validate business rules
      if (existingInvoice.status === 'paid') {
        throw new ApiError(
          API_ERROR_CODES.IMMUTABLE_RECORD,
          'Bezahlte Rechnungen können nicht mehr bearbeitet werden.',
          { currentStatus: existingInvoice.status }
        );
      }
      
      if (existingInvoice.status === 'sent' && data.invoice_number) {
        throw new ApiError(
          API_ERROR_CODES.IMMUTABLE_RECORD,
          'Rechnungsnummer kann nach dem Versand nicht mehr geändert werden.',
          { currentStatus: existingInvoice.status }
        );
      }
      
      // Validate input
      const validatedData = validateInput(InvoiceUpdateSchema, data);
      
      // Recalculate totals if items changed
      if (validatedData.body?.items) {
        const items = validatedData.body.items;
        const totalNet = items.reduce((sum, item) => sum + item.total_price, 0);
        const taxRate = validatedData.tax_rate || existingInvoice.tax_rate || 19;
        validatedData.total_net = totalNet;
        validatedData.total_gross = totalNet * (1 + taxRate / 100);
        validatedData.amount = validatedData.total_gross;
      }
      
      const query = supabase
        .from('invoices')
        .update(validatedData)
        .eq('id', id)
        .select()
        .single();
      
      const updatedInvoice = await createQuery<Invoice>(query).executeSingle();
      
      // Emit event for audit trail
      eventBus.emit('INVOICE_UPDATED', {
        invoice: updatedInvoice,
        previous_invoice: existingInvoice,
        changes: validatedData,
        user_id: (await supabase.auth.getUser()).data.user?.id,
      });
      
      return updatedInvoice;
    }, `Update invoice ${id}`);
  }
  
  // Send invoice to customer
  static async sendInvoice(id: string): Promise<Invoice> {
    return apiCall(async () => {
      const existingInvoice = await this.getInvoice(id);
      
      // Validate invoice can be sent
      if (existingInvoice.status !== 'draft') {
        throw new ApiError(
          API_ERROR_CODES.BUSINESS_RULE_VIOLATION,
          'Nur Entwürfe können versendet werden.',
          { currentStatus: existingInvoice.status }
        );
      }
      
      // Validate invoice has required data
      if (!existingInvoice.body?.items || existingInvoice.body.items.length === 0) {
        throw new ApiError(
          API_ERROR_CODES.BUSINESS_RULE_VIOLATION,
          'Rechnung muss mindestens eine Position enthalten.'
        );
      }
      
      // Update status to 'sent' (this triggers invoice numbering via database trigger)
      const updateData = {
        status: 'sent' as const,
        sent_at: new Date().toISOString(),
      };
      
      const query = supabase
        .from('invoices')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();
      
      const sentInvoice = await createQuery<Invoice>(query).executeSingle();
      
      // Emit event for PDF generation and email sending
      eventBus.emit('INVOICE_SENT', {
        invoice: sentInvoice,
        user_id: (await supabase.auth.getUser()).data.user?.id,
      });
      
      return sentInvoice;
    }, `Send invoice ${id}`);
  }
  
  // Mark invoice as paid
  static async markInvoicePaid(id: string, paymentDate?: string, notes?: string): Promise<Invoice> {
    return apiCall(async () => {
      const existingInvoice = await this.getInvoice(id);
      
      // Validate invoice can be marked as paid
      if (existingInvoice.status !== 'sent') {
        throw new ApiError(
          API_ERROR_CODES.BUSINESS_RULE_VIOLATION,
          'Nur versendete Rechnungen können als bezahlt markiert werden.',
          { currentStatus: existingInvoice.status }
        );
      }
      
      const updateData = {
        status: 'paid' as const,
        paid_at: paymentDate || new Date().toISOString(),
        notes: notes ? `${existingInvoice.notes || ''}\n\nZahlung: ${notes}`.trim() : existingInvoice.notes,
      };
      
      const query = supabase
        .from('invoices')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();
      
      const paidInvoice = await createQuery<Invoice>(query).executeSingle();
      
      // Emit event for revenue tracking
      eventBus.emit('INVOICE_PAID', {
        invoice: paidInvoice,
        payment_date: paymentDate,
        notes,
        user_id: (await supabase.auth.getUser()).data.user?.id,
      });
      
      return paidInvoice;
    }, `Mark invoice paid ${id}`);
  }
  
  // === EXPENSE OPERATIONS ===
  
  // Get all expenses with pagination and filtering
  static async getExpenses(
    pagination?: PaginationQuery,
    filters?: {
      category?: string;
      project_id?: string;
      employee_id?: string;
      date_from?: string;
      date_to?: string;
      approved?: boolean;
    }
  ): Promise<PaginationResponse<Expense>> {
    return apiCall(async () => {
      let query = supabase
        .from('expenses')
        .select(`
          *,
          projects (
            name,
            project_number
          ),
          employees (
            name,
            email
          )
        `, { count: 'exact' });
      
      // Apply filters
      if (filters?.category) {
        query = query.eq('category', filters.category);
      }
      
      if (filters?.project_id) {
        query = query.eq('project_id', filters.project_id);
      }
      
      if (filters?.employee_id) {
        query = query.eq('employee_id', filters.employee_id);
      }
      
      if (filters?.date_from) {
        query = query.gte('expense_date', filters.date_from);
      }
      
      if (filters?.date_to) {
        query = query.lte('expense_date', filters.date_to);
      }
      
      if (filters?.approved !== undefined) {
        if (filters.approved) {
          query = query.not('approved_at', 'is', null);
        } else {
          query = query.is('approved_at', null);
        }
      }
      
      // Apply pagination
      if (pagination) {
        const offset = (pagination.page - 1) * pagination.limit;
        query = query
          .range(offset, offset + pagination.limit - 1)
          .order(pagination.sort_by || 'expense_date', { 
            ascending: pagination.sort_order === 'asc' 
          });
      } else {
        query = query.order('expense_date', { ascending: false });
      }
      
      const { data, count } = await createQuery<Expense>(query).executeWithCount();
      
      return {
        items: data,
        pagination: {
          page: pagination?.page || 1,
          limit: pagination?.limit || data.length,
          total_items: count,
          total_pages: Math.ceil(count / (pagination?.limit || 20)),
          has_next: pagination ? (pagination.page * pagination.limit < count) : false,
          has_prev: pagination ? pagination.page > 1 : false,
        },
      };
    }, 'Get expenses');
  }
  
  // Create new expense
  static async createExpense(data: ExpenseCreate): Promise<Expense> {
    return apiCall(async () => {
      // Validate input
      const validatedData = validateInput(ExpenseCreateSchema, data);
      
      const query = supabase
        .from('expenses')
        .insert(validatedData)
        .select()
        .single();
      
      const expense = await createQuery<Expense>(query).executeSingle();
      
      // Emit event for project cost tracking
      eventBus.emit('EXPENSE_CREATED', {
        expense,
        user_id: (await supabase.auth.getUser()).data.user?.id,
      });
      
      return expense;
    }, 'Create expense');
  }
  
  // Approve expense
  static async approveExpense(id: string): Promise<Expense> {
    return apiCall(async () => {
      const currentUser = await getCurrentUserProfile();
      
      if (!currentUser.is_admin && !currentUser.is_project_manager) {
        throw new ApiError(
          API_ERROR_CODES.UNAUTHORIZED,
          'Nur Projektleiter und Administratoren können Ausgaben genehmigen.'
        );
      }
      
      const updateData = {
        approved_at: new Date().toISOString(),
        approved_by: currentUser.id,
      };
      
      const query = supabase
        .from('expenses')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();
      
      const approvedExpense = await createQuery<Expense>(query).executeSingle();
      
      // Emit event for notifications
      eventBus.emit('EXPENSE_APPROVED', {
        expense: approvedExpense,
        approved_by: currentUser.id,
        user_id: currentUser.id,
      });
      
      return approvedExpense;
    }, `Approve expense ${id}`);
  }
  
  // === FINANCIAL KPI CALCULATIONS ===
  
  // Get comprehensive financial KPIs
  static async getFinancialKPIs(dateRange?: { from: string; to: string }): Promise<FinancialKPIs> {
    return apiCall(async () => {
      const currentDate = new Date();
      const thisMonthStart = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1).toISOString().split('T')[0];
      const lastMonthStart = new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1).toISOString().split('T')[0];
      const lastMonthEnd = new Date(currentDate.getFullYear(), currentDate.getMonth(), 0).toISOString().split('T')[0];
      
      // Get revenue data
      const revenueQuery = supabase
        .from('invoices')
        .select('amount, status, invoice_date, paid_at');
      
      const revenues = await createQuery<Invoice>(revenueQuery).execute();
      
      // Get expense data
      const expenseQuery = supabase
        .from('expenses')
        .select('amount, expense_date, approved_at');
      
      const expenses = await createQuery<Expense>(expenseQuery).execute();
      
      // Calculate revenue metrics
      const totalRevenue = revenues
        .filter(inv => inv.status === 'paid')
        .reduce((sum, inv) => sum + (inv.amount || 0), 0);
      
      const thisMonthRevenue = revenues
        .filter(inv => 
          inv.status === 'paid' && 
          inv.paid_at && 
          inv.paid_at >= thisMonthStart
        )
        .reduce((sum, inv) => sum + (inv.amount || 0), 0);
      
      const lastMonthRevenue = revenues
        .filter(inv => 
          inv.status === 'paid' && 
          inv.paid_at && 
          inv.paid_at >= lastMonthStart && 
          inv.paid_at <= lastMonthEnd
        )
        .reduce((sum, inv) => sum + (inv.amount || 0), 0);
      
      const revenueGrowthRate = lastMonthRevenue > 0 
        ? ((thisMonthRevenue - lastMonthRevenue) / lastMonthRevenue) * 100 
        : 0;
      
      // Calculate expense metrics
      const totalExpenses = expenses
        .filter(exp => exp.approved_at)
        .reduce((sum, exp) => sum + (exp.amount || 0), 0);
      
      const thisMonthExpenses = expenses
        .filter(exp => 
          exp.approved_at && 
          exp.expense_date >= thisMonthStart
        )
        .reduce((sum, exp) => sum + (exp.amount || 0), 0);
      
      const lastMonthExpenses = expenses
        .filter(exp => 
          exp.approved_at && 
          exp.expense_date >= lastMonthStart && 
          exp.expense_date <= lastMonthEnd
        )
        .reduce((sum, exp) => sum + (exp.amount || 0), 0);
      
      // Calculate outstanding invoices
      const outstandingInvoices = revenues.filter(inv => inv.status === 'sent');
      const overdueInvoices = outstandingInvoices.filter(inv => 
        inv.due_date && inv.due_date < new Date().toISOString().split('T')[0]
      );
      
      const totalOutstanding = outstandingInvoices.reduce((sum, inv) => sum + (inv.amount || 0), 0);
      const totalOverdue = overdueInvoices.reduce((sum, inv) => sum + (inv.amount || 0), 0);
      
      // Calculate profit metrics
      const thisMonthProfit = thisMonthRevenue - thisMonthExpenses;
      const profitMargin = thisMonthRevenue > 0 ? (thisMonthProfit / thisMonthRevenue) * 100 : 0;
      
      return {
        revenue: {
          total: totalRevenue,
          this_month: thisMonthRevenue,
          last_month: lastMonthRevenue,
          growth_rate: revenueGrowthRate,
        },
        expenses: {
          total: totalExpenses,
          this_month: thisMonthExpenses,
          last_month: lastMonthExpenses,
        },
        profit: {
          total: totalRevenue - totalExpenses,
          this_month: thisMonthProfit,
          margin: profitMargin,
        },
        outstanding: {
          total: totalOutstanding,
          overdue: totalOverdue,
          count: outstandingInvoices.length,
        },
        cash_flow: {
          inflow: thisMonthRevenue,
          outflow: thisMonthExpenses,
          net: thisMonthRevenue - thisMonthExpenses,
        },
      };
    }, 'Get financial KPIs');
  }
  
  // Get revenue by month for charts
  static async getRevenueByMonth(months: number = 12): Promise<Array<{
    month: string;
    revenue: number;
    invoices: number;
  }>> {
    return apiCall(async () => {
      const revenues = await createQuery<Invoice>(
        supabase
          .from('invoices')
          .select('amount, status, paid_at')
          .eq('status', 'paid')
          .not('paid_at', 'is', null)
          .gte('paid_at', new Date(Date.now() - months * 30 * 24 * 60 * 60 * 1000).toISOString())
      ).execute();
      
      // Group by month
      const monthlyData: Record<string, { revenue: number; invoices: number }> = {};
      
      revenues.forEach(invoice => {
        if (invoice.paid_at) {
          const month = invoice.paid_at.substring(0, 7); // YYYY-MM format
          if (!monthlyData[month]) {
            monthlyData[month] = { revenue: 0, invoices: 0 };
          }
          monthlyData[month].revenue += invoice.amount || 0;
          monthlyData[month].invoices += 1;
        }
      });
      
      // Convert to array and sort
      return Object.entries(monthlyData)
        .map(([month, data]) => ({
          month,
          revenue: data.revenue,
          invoices: data.invoices,
        }))
        .sort((a, b) => a.month.localeCompare(b.month));
    }, 'Get revenue by month');
  }
  
  // Get expense breakdown by category
  static async getExpensesByCategory(dateRange?: { from: string; to: string }): Promise<Array<{
    category: string;
    amount: number;
    count: number;
  }>> {
    return apiCall(async () => {
      let query = supabase
        .from('expenses')
        .select('category, amount')
        .not('approved_at', 'is', null);
      
      if (dateRange) {
        query = query
          .gte('expense_date', dateRange.from)
          .lte('expense_date', dateRange.to);
      }
      
      const expenses = await createQuery<Expense>(query).execute();
      
      // Group by category
      const categoryData: Record<string, { amount: number; count: number }> = {};
      
      expenses.forEach(expense => {
        const category = expense.category || 'Sonstige';
        if (!categoryData[category]) {
          categoryData[category] = { amount: 0, count: 0 };
        }
        categoryData[category].amount += expense.amount || 0;
        categoryData[category].count += 1;
      });
      
      // Convert to array and sort by amount
      return Object.entries(categoryData)
        .map(([category, data]) => ({
          category,
          amount: data.amount,
          count: data.count,
        }))
        .sort((a, b) => b.amount - a.amount);
    }, 'Get expenses by category');
  }
  
  // Get profit/loss report
  static async getProfitLossReport(dateRange: { from: string; to: string }): Promise<{
    revenue: number;
    cost_of_goods: number;
    gross_profit: number;
    operating_expenses: number;
    net_profit: number;
    margin: number;
  }> {
    return apiCall(async () => {
      // Get revenue
      const revenues = await createQuery<Invoice>(
        supabase
          .from('invoices')
          .select('amount')
          .eq('status', 'paid')
          .gte('paid_at', dateRange.from)
          .lte('paid_at', dateRange.to)
      ).execute();
      
      const totalRevenue = revenues.reduce((sum, inv) => sum + (inv.amount || 0), 0);
      
      // Get expenses by category
      const expenses = await createQuery<Expense>(
        supabase
          .from('expenses')
          .select('amount, category')
          .not('approved_at', 'is', null)
          .gte('expense_date', dateRange.from)
          .lte('expense_date', dateRange.to)
      ).execute();
      
      const costOfGoods = expenses
        .filter(exp => ['Material', 'Equipment', 'Subcontractor'].includes(exp.category || ''))
        .reduce((sum, exp) => sum + (exp.amount || 0), 0);
      
      const operatingExpenses = expenses
        .filter(exp => !['Material', 'Equipment', 'Subcontractor'].includes(exp.category || ''))
        .reduce((sum, exp) => sum + (exp.amount || 0), 0);
      
      const grossProfit = totalRevenue - costOfGoods;
      const netProfit = grossProfit - operatingExpenses;
      const margin = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;
      
      return {
        revenue: totalRevenue,
        cost_of_goods: costOfGoods,
        gross_profit: grossProfit,
        operating_expenses: operatingExpenses,
        net_profit: netProfit,
        margin: margin,
      };
    }, 'Get profit/loss report');
  }
}

// Export singleton instance
export const financeService = FinanceService;