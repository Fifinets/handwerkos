// Project service for HandwerkOS
// Handles CRUD operations and status management for projects

import { supabase } from '@/integrations/supabase/client';
import { 
  apiCall, 
  createQuery, 
  validateInput,
  ApiError,
  API_ERROR_CODES 
} from '@/utils/api';
import {
  Project,
  ProjectCreate,
  ProjectUpdate,
  ProjectCreateSchema,
  ProjectUpdateSchema,
  PaginationQuery,
  PaginationResponse
} from '@/types';
import { eventBus } from './eventBus';

export class ProjectService {
  
  // Get all projects with pagination and filtering
  static async getProjects(
    pagination?: PaginationQuery,
    filters?: {
      status?: Project['status'];
      customer_id?: string;
      employee_id?: string;
      search?: string;
    }
  ): Promise<PaginationResponse<Project>> {
    return apiCall(async () => {
      let query = supabase
        .from('projects')
        .select(`
          *,
          customers (
            company_name,
            contact_person,
            email
          )
        `, { count: 'exact' });
      
      // Apply filters
      if (filters?.status) {
        query = query.eq('status', filters.status);
      }
      
      if (filters?.customer_id) {
        query = query.eq('customer_id', filters.customer_id);
      }
      
      if (filters?.employee_id) {
        query = query.contains('assigned_employees', [filters.employee_id]);
      }
      
      if (filters?.search) {
        query = query.or(
          `name.ilike.%${filters.search}%,` +
          `description.ilike.%${filters.search}%,` +
          `project_number.ilike.%${filters.search}%`
        );
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
      
      const { data, count } = await createQuery<Project>(query).executeWithCount();
      
      // Debug logging
      console.log('ProjectService.getProjects:', {
        query: query.toString(),
        data,
        count,
        pagination,
        filters
      });
      
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
    }, 'Get projects');
  }
  
  // Get project by ID with detailed information
  static async getProject(id: string): Promise<Project> {
    return apiCall(async () => {
      const query = supabase
        .from('projects')
        .select(`
          *,
          customers (
            company_name,
            contact_person,
            email,
            address,
            city,
            postal_code
          )
        `)
        .eq('id', id);
      
      return createQuery<Project>(query).executeSingle();
    }, `Get project ${id}`);
  }
  
  // Create new project
  static async createProject(data: ProjectCreate): Promise<Project> {
    return apiCall(async () => {
      // Validate input
      const validatedData = validateInput(ProjectCreateSchema, data);
      
      const projectData = {
        ...validatedData,
        status: 'planned' as const,
        // Team assignments are handled separately via project_assignments table
      };
      
      const query = supabase
        .from('projects')
        .insert(projectData)
        .select()
        .single();
      
      const project = await createQuery<Project>(query).executeSingle();
      
      // Emit event for audit trail and notifications
      eventBus.emit('PROJECT_CREATED', {
        project,
        user_id: (await supabase.auth.getUser()).data.user?.id,
      });
      
      return project;
    }, 'Create project');
  }
  
  // Update existing project
  static async updateProject(id: string, data: ProjectUpdate): Promise<Project> {
    return apiCall(async () => {
      // Get existing project for validation
      const existingProject = await this.getProject(id);
      
      // Validate business rules
      if (existingProject.status === 'completed' && data.status !== 'completed') {
        throw new ApiError(
          API_ERROR_CODES.BUSINESS_RULE_VIOLATION,
          'Abgeschlossene Projekte können nicht wieder aktiviert werden.',
          { currentStatus: existingProject.status }
        );
      }
      
      // Validate input
      const validatedData = validateInput(ProjectUpdateSchema, data);
      
      // Handle status change logic
      if (validatedData.status && validatedData.status !== existingProject.status) {
        await this.validateStatusTransition(existingProject.status, validatedData.status);
        
        // Set dates based on status
        if (validatedData.status === 'active' && !existingProject.start_date) {
          validatedData.start_date = new Date().toISOString().split('T')[0];
        } else if (validatedData.status === 'completed' && !validatedData.end_date) {
          validatedData.end_date = new Date().toISOString().split('T')[0];
        }
      }
      
      const query = supabase
        .from('projects')
        .update(validatedData)
        .eq('id', id)
        .select()
        .single();
      
      const updatedProject = await createQuery<Project>(query).executeSingle();
      
      // Emit status change event if status changed
      if (validatedData.status && validatedData.status !== existingProject.status) {
        eventBus.emit('PROJECT_STATUS_CHANGED', {
          project: updatedProject,
          previous_status: existingProject.status,
          new_status: validatedData.status,
          user_id: (await supabase.auth.getUser()).data.user?.id,
        });
      }
      
      // Emit general update event
      eventBus.emit('PROJECT_UPDATED', {
        project: updatedProject,
        previous_project: existingProject,
        changes: validatedData,
        user_id: (await supabase.auth.getUser()).data.user?.id,
      });
      
      return updatedProject;
    }, `Update project ${id}`);
  }
  
  // Validate status transitions
  private static async validateStatusTransition(from: Project['status'], to: Project['status']): Promise<void> {
    const validTransitions: Record<Project['status'], Project['status'][]> = {
      planned: ['active', 'cancelled'],
      active: ['blocked', 'completed', 'cancelled'],
      blocked: ['active', 'cancelled'],
      completed: [], // No transitions from completed
      cancelled: [], // No transitions from cancelled
    };
    
    if (!validTransitions[from].includes(to)) {
      throw new ApiError(
        API_ERROR_CODES.BUSINESS_RULE_VIOLATION,
        `Ungültiger Statuswechsel von "${from}" zu "${to}".`,
        { from, to, validTransitions: validTransitions[from] }
      );
    }
  }
  
  // Start project (transition from planned to active)
  static async startProject(id: string): Promise<Project> {
    return apiCall(async () => {
      const existingProject = await this.getProject(id);
      
      if (existingProject.status !== 'planned') {
        throw new ApiError(
          API_ERROR_CODES.BUSINESS_RULE_VIOLATION,
          'Nur geplante Projekte können gestartet werden.',
          { currentStatus: existingProject.status }
        );
      }
      
      const updateData = {
        status: 'active' as const,
        start_date: new Date().toISOString().split('T')[0],
      };
      
      return this.updateProject(id, updateData);
    }, `Start project ${id}`);
  }
  
  // Complete project
  static async completeProject(id: string): Promise<Project> {
    return apiCall(async () => {
      const existingProject = await this.getProject(id);
      
      if (existingProject.status !== 'active') {
        throw new ApiError(
          API_ERROR_CODES.BUSINESS_RULE_VIOLATION,
          'Nur aktive Projekte können abgeschlossen werden.',
          { currentStatus: existingProject.status }
        );
      }
      
      const updateData = {
        status: 'completed' as const,
        end_date: new Date().toISOString().split('T')[0],
      };
      
      return this.updateProject(id, updateData);
    }, `Complete project ${id}`);
  }
  
  // Block project (with reason)
  static async blockProject(id: string, reason?: string): Promise<Project> {
    return apiCall(async () => {
      const existingProject = await this.getProject(id);
      
      if (existingProject.status !== 'active') {
        throw new ApiError(
          API_ERROR_CODES.BUSINESS_RULE_VIOLATION,
          'Nur aktive Projekte können blockiert werden.',
          { currentStatus: existingProject.status }
        );
      }
      
      const updateData: ProjectUpdate = {
        status: 'blocked' as const,
        description: reason 
          ? `${existingProject.description || ''}\n\nBlockiert: ${reason}`.trim()
          : existingProject.description,
      };
      
      return this.updateProject(id, updateData);
    }, `Block project ${id}`);
  }
  
  // Unblock project (resume from blocked)
  static async unblockProject(id: string): Promise<Project> {
    return apiCall(async () => {
      const existingProject = await this.getProject(id);
      
      if (existingProject.status !== 'blocked') {
        throw new ApiError(
          API_ERROR_CODES.BUSINESS_RULE_VIOLATION,
          'Nur blockierte Projekte können entsperrt werden.',
          { currentStatus: existingProject.status }
        );
      }
      
      const updateData = {
        status: 'active' as const,
      };
      
      return this.updateProject(id, updateData);
    }, `Unblock project ${id}`);
  }
  
  // Cancel project
  static async cancelProject(id: string, reason?: string): Promise<Project> {
    return apiCall(async () => {
      const existingProject = await this.getProject(id);
      
      if (existingProject.status === 'completed') {
        throw new ApiError(
          API_ERROR_CODES.BUSINESS_RULE_VIOLATION,
          'Abgeschlossene Projekte können nicht storniert werden.',
          { currentStatus: existingProject.status }
        );
      }
      
      const updateData: ProjectUpdate = {
        status: 'cancelled' as const,
        description: reason 
          ? `${existingProject.description || ''}\n\nStorniert: ${reason}`.trim()
          : existingProject.description,
      };
      
      return this.updateProject(id, updateData);
    }, `Cancel project ${id}`);
  }
  
  // Get project statistics
  static async getProjectStats(id: string): Promise<{
    total_hours: number;
    total_material_cost: number;
    total_expenses: number;
    budget_used: number;
    budget_remaining: number;
    days_active: number;
    team_size: number;
    completion_percentage: number;
  }> {
    return apiCall(async () => {
      const project = await this.getProject(id);
      
      // Get timesheets
      const { data: timesheets } = await supabase
        .from('timesheets')
        .select('hours, hourly_rate')
        .eq('project_id', id);
      
      // Get materials
      const { data: materials } = await supabase
        .from('materials')
        .select('quantity, unit_cost')
        .eq('project_id', id);
      
      // Get expenses
      const { data: expenses } = await supabase
        .from('expenses')
        .select('amount')
        .eq('project_id', id);
      
      const totalHours = timesheets?.reduce((sum, t) => sum + (t.hours || 0), 0) || 0;
      const totalMaterialCost = materials?.reduce((sum, m) => sum + (m.quantity * m.unit_cost || 0), 0) || 0;
      const totalExpenses = expenses?.reduce((sum, e) => sum + (e.amount || 0), 0) || 0;
      const totalCost = totalMaterialCost + totalExpenses;
      
      const budgetUsed = totalCost;
      const budgetRemaining = Math.max(0, (project.budget || 0) - budgetUsed);
      
      // Calculate days active
      let daysActive = 0;
      if (project.start_date) {
        const startDate = new Date(project.start_date);
        const endDate = project.end_date ? new Date(project.end_date) : new Date();
        daysActive = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
      }
      
      // Simple completion percentage based on status
      const completionPercentage = {
        planned: 0,
        active: 50,
        blocked: 50,
        completed: 100,
        cancelled: 0,
      }[project.status];
      
      return {
        total_hours: totalHours,
        total_material_cost: totalMaterialCost,
        total_expenses: totalExpenses,
        budget_used: budgetUsed,
        budget_remaining: budgetRemaining,
        days_active: daysActive,
        team_size: project.assigned_employees?.length || 0,
        completion_percentage: completionPercentage,
      };
    }, `Get project stats ${id}`);
  }
  
  // Get project timeline/activities
  static async getProjectTimeline(id: string, limit: number = 50): Promise<any[]> {
    return apiCall(async () => {
      // Get recent timesheets
      const { data: timesheets } = await supabase
        .from('timesheets')
        .select(`
          id, date, hours, description, created_at,
          employees (name)
        `)
        .eq('project_id', id)
        .order('created_at', { ascending: false })
        .limit(limit / 2);
      
      // Get recent materials
      const { data: materials } = await supabase
        .from('materials')
        .select(`
          id, name, quantity, unit_cost, created_at,
          employees (name)
        `)
        .eq('project_id', id)
        .order('created_at', { ascending: false })
        .limit(limit / 2);
      
      // Combine and sort timeline events
      const timelineEvents = [
        ...(timesheets?.map(t => ({
          id: t.id,
          type: 'timesheet',
          title: `Arbeitszeit erfasst: ${t.hours}h`,
          description: t.description,
          user: t.employees?.name || 'Unbekannt',
          timestamp: t.created_at,
        })) || []),
        ...(materials?.map(m => ({
          id: m.id,
          type: 'material',
          title: `Material hinzugefügt: ${m.name}`,
          description: `${m.quantity} × ${m.unit_cost}€`,
          user: m.employees?.name || 'Unbekannt',
          timestamp: m.created_at,
        })) || []),
      ].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      
      return timelineEvents.slice(0, limit);
    }, `Get project timeline ${id}`);
  }
  
  // Assign employee to project
  static async assignEmployee(id: string, employeeId: string): Promise<Project> {
    return apiCall(async () => {
      const project = await this.getProject(id);
      
      const currentEmployees = project.assigned_employees || [];
      if (currentEmployees.includes(employeeId)) {
        throw new ApiError(
          API_ERROR_CODES.BUSINESS_RULE_VIOLATION,
          'Mitarbeiter ist bereits dem Projekt zugewiesen.',
          { employeeId }
        );
      }
      
      const updatedEmployees = [...currentEmployees, employeeId];
      
      return this.updateProject(id, { assigned_employees: updatedEmployees });
    }, `Assign employee to project ${id}`);
  }
  
  // Remove employee from project
  static async removeEmployee(id: string, employeeId: string): Promise<Project> {
    return apiCall(async () => {
      const project = await this.getProject(id);
      
      const currentEmployees = project.assigned_employees || [];
      const updatedEmployees = currentEmployees.filter(emp => emp !== employeeId);
      
      return this.updateProject(id, { assigned_employees: updatedEmployees });
    }, `Remove employee from project ${id}`);
  }
  
  // Delete project (with safety checks)
  static async deleteProject(id: string): Promise<void> {
    return apiCall(async () => {
      const existingProject = await this.getProject(id);
      
      // Only allow deletion of planned or cancelled projects
      if (!['planned', 'cancelled'].includes(existingProject.status)) {
        throw new ApiError(
          API_ERROR_CODES.BUSINESS_RULE_VIOLATION,
          'Nur geplante oder stornierte Projekte können gelöscht werden.',
          { currentStatus: existingProject.status }
        );
      }
      
      // Check for related timesheets
      const { data: timesheets } = await supabase
        .from('timesheets')
        .select('id')
        .eq('project_id', id)
        .limit(1);
      
      if (timesheets && timesheets.length > 0) {
        throw new ApiError(
          API_ERROR_CODES.BUSINESS_RULE_VIOLATION,
          'Projekt kann nicht gelöscht werden, da bereits Arbeitszeiten erfasst wurden.'
        );
      }
      
      const { error } = await supabase
        .from('projects')
        .delete()
        .eq('id', id);
      
      if (error) {
        throw error;
      }
      
      // Emit event for audit trail
      eventBus.emit('PROJECT_DELETED', {
        project: existingProject,
        user_id: (await supabase.auth.getUser()).data.user?.id,
      });
    }, `Delete project ${id}`);
  }
  
  // Search projects
  static async searchProjects(query: string, limit: number = 10): Promise<Project[]> {
    return apiCall(async () => {
      const searchQuery = supabase
        .from('projects')
        .select(`
          *,
          customers (
            company_name,
            contact_person
          )
        `)
        .or(
          `name.ilike.%${query}%,` +
          `description.ilike.%${query}%,` +
          `project_number.ilike.%${query}%`
        )
        .order('name')
        .limit(limit);
      
      return createQuery<Project>(searchQuery).execute();
    }, `Search projects: ${query}`);
  }
}

// Export singleton instance
export const projectService = new ProjectService();