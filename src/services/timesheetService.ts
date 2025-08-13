// Timesheet service for HandwerkOS
// Handles CRUD operations for time tracking and labor cost calculation

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
  Timesheet,
  TimesheetCreate,
  TimesheetUpdate,
  TimesheetCreateSchema,
  TimesheetUpdateSchema,
  PaginationQuery,
  PaginationResponse
} from '@/types';
import { eventBus } from './eventBus';

export class TimesheetService {
  
  // Get all timesheets with pagination and filtering
  static async getTimesheets(
    pagination?: PaginationQuery,
    filters?: {
      project_id?: string;
      employee_id?: string;
      date_from?: string;
      date_to?: string;
      approved?: boolean;
    }
  ): Promise<PaginationResponse<Timesheet>> {
    return apiCall(async () => {
      let query = supabase
        .from('timesheets')
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
      if (filters?.project_id) {
        query = query.eq('project_id', filters.project_id);
      }
      
      if (filters?.employee_id) {
        query = query.eq('employee_id', filters.employee_id);
      }
      
      if (filters?.date_from) {
        query = query.gte('date', filters.date_from);
      }
      
      if (filters?.date_to) {
        query = query.lte('date', filters.date_to);
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
          .order(pagination.sort_by || 'date', { 
            ascending: pagination.sort_order === 'asc' 
          });
      } else {
        query = query.order('date', { ascending: false });
      }
      
      const { data, count } = await createQuery<Timesheet>(query).executeWithCount();
      
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
    }, 'Get timesheets');
  }
  
  // Get timesheet by ID
  static async getTimesheet(id: string): Promise<Timesheet> {
    return apiCall(async () => {
      const query = supabase
        .from('timesheets')
        .select(`
          *,
          projects (
            name,
            project_number,
            status
          ),
          employees (
            name,
            email,
            hourly_rate
          )
        `)
        .eq('id', id);
      
      return createQuery<Timesheet>(query).executeSingle();
    }, `Get timesheet ${id}`);
  }
  
  // Create new timesheet entry
  static async createTimesheet(data: TimesheetCreate): Promise<Timesheet> {
    return apiCall(async () => {
      // Validate input
      const validatedData = validateInput(TimesheetCreateSchema, data);
      
      // Get employee's hourly rate if not provided
      if (!validatedData.hourly_rate && validatedData.employee_id) {
        const { data: employee } = await supabase
          .from('employees')
          .select('hourly_rate')
          .eq('id', validatedData.employee_id)
          .single();
        
        if (employee?.hourly_rate) {
          validatedData.hourly_rate = employee.hourly_rate;
        }
      }
      
      // Calculate total cost
      if (validatedData.hours && validatedData.hourly_rate) {
        validatedData.total_cost = validatedData.hours * validatedData.hourly_rate;
      }
      
      // Validate business rules
      await this.validateTimesheetEntry(validatedData);
      
      const query = supabase
        .from('timesheets')
        .insert(validatedData)
        .select()
        .single();
      
      const timesheet = await createQuery<Timesheet>(query).executeSingle();
      
      // Emit event for project cost updates
      eventBus.emit('TIMESHEET_CREATED', {
        timesheet,
        user_id: (await supabase.auth.getUser()).data.user?.id,
      });
      
      return timesheet;
    }, 'Create timesheet');
  }
  
  // Update existing timesheet
  static async updateTimesheet(id: string, data: TimesheetUpdate): Promise<Timesheet> {
    return apiCall(async () => {
      // Get existing timesheet for validation
      const existingTimesheet = await this.getTimesheet(id);
      
      // Validate timesheet can be edited
      if (existingTimesheet.approved_at) {
        throw new ApiError(
          API_ERROR_CODES.IMMUTABLE_RECORD,
          'Genehmigte Zeiteinträge können nicht mehr bearbeitet werden.',
          { approvedAt: existingTimesheet.approved_at }
        );
      }
      
      // Only allow editing own timesheets (except for admins)
      const currentUser = await getCurrentUserProfile();
      if (existingTimesheet.employee_id !== currentUser.id && !currentUser.is_admin) {
        throw new ApiError(
          API_ERROR_CODES.UNAUTHORIZED,
          'Sie können nur Ihre eigenen Zeiteinträge bearbeiten.'
        );
      }
      
      // Validate input
      const validatedData = validateInput(TimesheetUpdateSchema, data);
      
      // Recalculate total cost if hours or rate changed
      if (validatedData.hours || validatedData.hourly_rate) {
        const hours = validatedData.hours || existingTimesheet.hours;
        const rate = validatedData.hourly_rate || existingTimesheet.hourly_rate;
        if (hours && rate) {
          validatedData.total_cost = hours * rate;
        }
      }
      
      // Validate business rules
      const updatedData = { ...existingTimesheet, ...validatedData };
      await this.validateTimesheetEntry(updatedData);
      
      const query = supabase
        .from('timesheets')
        .update(validatedData)
        .eq('id', id)
        .select()
        .single();
      
      const updatedTimesheet = await createQuery<Timesheet>(query).executeSingle();
      
      // Emit event for audit trail
      eventBus.emit('TIMESHEET_UPDATED', {
        timesheet: updatedTimesheet,
        previous_timesheet: existingTimesheet,
        changes: validatedData,
        user_id: (await supabase.auth.getUser()).data.user?.id,
      });
      
      return updatedTimesheet;
    }, `Update timesheet ${id}`);
  }
  
  // Approve timesheet (for project managers/admins)
  static async approveTimesheet(id: string): Promise<Timesheet> {
    return apiCall(async () => {
      const existingTimesheet = await this.getTimesheet(id);
      
      // Validate timesheet can be approved
      if (existingTimesheet.approved_at) {
        throw new ApiError(
          API_ERROR_CODES.BUSINESS_RULE_VIOLATION,
          'Zeiteintrag ist bereits genehmigt.',
          { approvedAt: existingTimesheet.approved_at }
        );
      }
      
      // Check if user has permission to approve
      const currentUser = await getCurrentUserProfile();
      if (!currentUser.is_admin && !currentUser.is_project_manager) {
        throw new ApiError(
          API_ERROR_CODES.UNAUTHORIZED,
          'Nur Projektleiter und Administratoren können Zeiteinträge genehmigen.'
        );
      }
      
      const updateData = {
        approved_at: new Date().toISOString(),
        approved_by: currentUser.id,
      };
      
      const query = supabase
        .from('timesheets')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();
      
      const approvedTimesheet = await createQuery<Timesheet>(query).executeSingle();
      
      // Emit event for notifications
      eventBus.emit('TIMESHEET_APPROVED', {
        timesheet: approvedTimesheet,
        approved_by: currentUser.id,
        user_id: currentUser.id,
      });
      
      return approvedTimesheet;
    }, `Approve timesheet ${id}`);
  }
  
  // Reject timesheet approval
  static async rejectTimesheet(id: string, reason?: string): Promise<Timesheet> {
    return apiCall(async () => {
      const existingTimesheet = await this.getTimesheet(id);
      
      // Check if user has permission to reject
      const currentUser = await getCurrentUserProfile();
      if (!currentUser.is_admin && !currentUser.is_project_manager) {
        throw new ApiError(
          API_ERROR_CODES.UNAUTHORIZED,
          'Nur Projektleiter und Administratoren können Zeiteinträge ablehnen.'
        );
      }
      
      const updateData = {
        approved_at: null,
        approved_by: null,
        description: reason 
          ? `${existingTimesheet.description || ''}\n\nAbgelehnt: ${reason}`.trim()
          : existingTimesheet.description,
      };
      
      const query = supabase
        .from('timesheets')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();
      
      const rejectedTimesheet = await createQuery<Timesheet>(query).executeSingle();
      
      // Emit event for notifications
      eventBus.emit('TIMESHEET_REJECTED', {
        timesheet: rejectedTimesheet,
        reason,
        rejected_by: currentUser.id,
        user_id: currentUser.id,
      });
      
      return rejectedTimesheet;
    }, `Reject timesheet ${id}`);
  }
  
  // Validate timesheet entry business rules
  private static async validateTimesheetEntry(data: any): Promise<void> {
    // Check for overlapping time entries on the same day
    if (data.employee_id && data.date && data.start_time && data.end_time) {
      const { data: overlappingEntries } = await supabase
        .from('timesheets')
        .select('id')
        .eq('employee_id', data.employee_id)
        .eq('date', data.date)
        .neq('id', data.id || '')
        .or(`start_time.lte.${data.start_time}.and.end_time.gt.${data.start_time},start_time.lt.${data.end_time}.and.end_time.gte.${data.end_time}`);
      
      if (overlappingEntries && overlappingEntries.length > 0) {
        throw new ApiError(
          API_ERROR_CODES.BUSINESS_RULE_VIOLATION,
          'Überschneidende Arbeitszeiten am selben Tag sind nicht erlaubt.'
        );
      }
    }
    
    // Validate hours don't exceed daily limit (e.g., 12 hours)
    if (data.hours && data.hours > 12) {
      throw new ApiError(
        API_ERROR_CODES.BUSINESS_RULE_VIOLATION,
        'Maximale Arbeitszeit von 12 Stunden pro Tag überschritten.',
        { hours: data.hours }
      );
    }
    
    // Validate date is not in the future
    if (data.date && new Date(data.date) > new Date()) {
      throw new ApiError(
        API_ERROR_CODES.BUSINESS_RULE_VIOLATION,
        'Zeiteinträge für zukünftige Daten sind nicht erlaubt.'
      );
    }
    
    // Validate project is active
    if (data.project_id) {
      const { data: project } = await supabase
        .from('projects')
        .select('status')
        .eq('id', data.project_id)
        .single();
      
      if (project && !['active', 'blocked'].includes(project.status)) {
        throw new ApiError(
          API_ERROR_CODES.BUSINESS_RULE_VIOLATION,
          'Zeiteinträge können nur für aktive oder blockierte Projekte erfasst werden.',
          { projectStatus: project.status }
        );
      }
    }
  }
  
  // Get timesheet statistics for employee
  static async getEmployeeTimesheetStats(
    employeeId: string,
    dateFrom?: string,
    dateTo?: string
  ): Promise<{
    total_hours: number;
    total_cost: number;
    approved_hours: number;
    pending_hours: number;
    days_worked: number;
    avg_hours_per_day: number;
    overtime_hours: number;
  }> {
    return apiCall(async () => {
      let query = supabase
        .from('timesheets')
        .select('hours, total_cost, approved_at, overtime_hours')
        .eq('employee_id', employeeId);
      
      if (dateFrom) {
        query = query.gte('date', dateFrom);
      }
      
      if (dateTo) {
        query = query.lte('date', dateTo);
      }
      
      const timesheets = await createQuery<Timesheet>(query).execute();
      
      const stats = timesheets.reduce(
        (acc, timesheet) => {
          const hours = timesheet.hours || 0;
          const cost = timesheet.total_cost || 0;
          const overtimeHours = timesheet.overtime_hours || 0;
          
          acc.total_hours += hours;
          acc.total_cost += cost;
          acc.overtime_hours += overtimeHours;
          
          if (timesheet.approved_at) {
            acc.approved_hours += hours;
          } else {
            acc.pending_hours += hours;
          }
          
          return acc;
        },
        {
          total_hours: 0,
          total_cost: 0,
          approved_hours: 0,
          pending_hours: 0,
          days_worked: 0,
          avg_hours_per_day: 0,
          overtime_hours: 0,
        }
      );
      
      // Calculate unique working days
      const uniqueDates = new Set(timesheets.map(t => t.date));
      stats.days_worked = uniqueDates.size;
      
      // Calculate average hours per day
      if (stats.days_worked > 0) {
        stats.avg_hours_per_day = stats.total_hours / stats.days_worked;
      }
      
      return stats;
    }, `Get employee timesheet stats ${employeeId}`);
  }
  
  // Get project timesheet summary
  static async getProjectTimesheetSummary(projectId: string): Promise<{
    total_hours: number;
    total_cost: number;
    by_employee: Array<{
      employee_id: string;
      employee_name: string;
      hours: number;
      cost: number;
    }>;
    by_date: Array<{
      date: string;
      hours: number;
      cost: number;
    }>;
  }> {
    return apiCall(async () => {
      const query = supabase
        .from('timesheets')
        .select(`
          hours,
          total_cost,
          date,
          employee_id,
          employees (
            name
          )
        `)
        .eq('project_id', projectId);
      
      const timesheets = await createQuery<Timesheet>(query).execute();
      
      const totalHours = timesheets.reduce((sum, t) => sum + (t.hours || 0), 0);
      const totalCost = timesheets.reduce((sum, t) => sum + (t.total_cost || 0), 0);
      
      // Group by employee
      const byEmployee = timesheets.reduce((acc, timesheet) => {
        const employeeId = timesheet.employee_id;
        if (!acc[employeeId]) {
          acc[employeeId] = {
            employee_id: employeeId,
            employee_name: timesheet.employees?.name || 'Unbekannt',
            hours: 0,
            cost: 0,
          };
        }
        
        acc[employeeId].hours += timesheet.hours || 0;
        acc[employeeId].cost += timesheet.total_cost || 0;
        
        return acc;
      }, {} as Record<string, any>);
      
      // Group by date
      const byDate = timesheets.reduce((acc, timesheet) => {
        const date = timesheet.date;
        if (!acc[date]) {
          acc[date] = {
            date,
            hours: 0,
            cost: 0,
          };
        }
        
        acc[date].hours += timesheet.hours || 0;
        acc[date].cost += timesheet.total_cost || 0;
        
        return acc;
      }, {} as Record<string, any>);
      
      return {
        total_hours: totalHours,
        total_cost: totalCost,
        by_employee: Object.values(byEmployee),
        by_date: Object.values(byDate).sort((a: any, b: any) => a.date.localeCompare(b.date)),
      };
    }, `Get project timesheet summary ${projectId}`);
  }
  
  // Delete timesheet (with safety checks)
  static async deleteTimesheet(id: string): Promise<void> {
    return apiCall(async () => {
      const existingTimesheet = await this.getTimesheet(id);
      
      // Only allow deletion of unapproved timesheets
      if (existingTimesheet.approved_at) {
        throw new ApiError(
          API_ERROR_CODES.BUSINESS_RULE_VIOLATION,
          'Genehmigte Zeiteinträge können nicht gelöscht werden.',
          { approvedAt: existingTimesheet.approved_at }
        );
      }
      
      // Only allow deleting own timesheets (except for admins)
      const currentUser = await getCurrentUserProfile();
      if (existingTimesheet.employee_id !== currentUser.id && !currentUser.is_admin) {
        throw new ApiError(
          API_ERROR_CODES.UNAUTHORIZED,
          'Sie können nur Ihre eigenen Zeiteinträge löschen.'
        );
      }
      
      const { error } = await supabase
        .from('timesheets')
        .delete()
        .eq('id', id);
      
      if (error) {
        throw error;
      }
      
      // Emit event for audit trail
      eventBus.emit('TIMESHEET_DELETED', {
        timesheet: existingTimesheet,
        user_id: currentUser.id,
      });
    }, `Delete timesheet ${id}`);
  }
  
  // Bulk approve timesheets
  static async bulkApproveTimesheets(ids: string[]): Promise<Timesheet[]> {
    return apiCall(async () => {
      const currentUser = await getCurrentUserProfile();
      
      if (!currentUser.is_admin && !currentUser.is_project_manager) {
        throw new ApiError(
          API_ERROR_CODES.UNAUTHORIZED,
          'Nur Projektleiter und Administratoren können Zeiteinträge genehmigen.'
        );
      }
      
      const updateData = {
        approved_at: new Date().toISOString(),
        approved_by: currentUser.id,
      };
      
      const query = supabase
        .from('timesheets')
        .update(updateData)
        .in('id', ids)
        .is('approved_at', null) // Only approve unapproved entries
        .select();
      
      const approvedTimesheets = await createQuery<Timesheet>(query).execute();
      
      // Emit event for each approved timesheet
      approvedTimesheets.forEach(timesheet => {
        eventBus.emit('TIMESHEET_APPROVED', {
          timesheet,
          approved_by: currentUser.id,
          user_id: currentUser.id,
        });
      });
      
      return approvedTimesheets;
    }, 'Bulk approve timesheets');
  }
}

// Export singleton instance
export const timesheetService = TimesheetService;