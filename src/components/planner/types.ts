export interface Assignment {
  employee_id: string;
  is_active: boolean;
  start_date: string | null;
  end_date: string | null;
  role: string | null;
}

export interface PlannerProject {
  id: string;
  name: string;
  status: string;
  start_date: string | null;
  end_date: string | null;
  location: string | null;
  work_start_date: string | null;
  work_end_date: string | null;
  project_team_assignments: Assignment[];
}

export interface PlannerEmployee {
  id: string;
  first_name: string;
  last_name: string;
  status: string;
  position: string | null;
}

export interface VacationRequest {
  id: string;
  employee_id: string;
  start_date: string;
  end_date: string;
  status: string;
  reason: string | null;
  absence_type: string;
}

export interface CalendarEvent {
  id: string;
  title: string;
  start_date: string;
  end_date: string;
  start_time: string | null;
  end_time: string | null;
  type: string;
  project_id: string | null;
  assigned_employees: string[] | null;
}

export interface DragPayload {
  projectId: string;
  employeeId: string;
  originDate: string;
  assignmentStartDate: string;
  assignmentEndDate: string | null;
}

export interface UndoEntry {
  description: string;
  revert: () => Promise<void>;
}

export type EntryType = 'project' | 'vacation' | 'sick';
export type ViewMode = 'day' | 'week' | 'month';
export type UtilizationFilter = 'all' | 'overloaded' | 'available';
