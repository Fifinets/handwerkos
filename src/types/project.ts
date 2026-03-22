/**
 * Enhanced Project Data Types with Role-Based Access Control
 * Basiert auf den spezifizierten Anforderungen für Projektmanagement
 */

export type ProjectStatus = 'anfrage' | 'besichtigung' | 'angebot' | 'beauftragt' | 'in_bearbeitung' | 'abgeschlossen';

export const WORKFLOW_STAGES: ProjectStatus[] = [
  'anfrage', 'besichtigung', 'angebot', 'beauftragt', 'in_bearbeitung', 'abgeschlossen'
];

export type UserRole = 'mitarbeiter' | 'projektleiter' | 'admin';

export interface ProjectBaseData {
  id: string;
  company_id: string;
  
  // 🔖 Verpflichtende Basisdaten
  project_name: string;                    // Projektname
  customer_id: string;                     // Kunde (Referenz)
  start_date: string;                      // Startdatum
  planned_end_date: string;                // Geplantes Enddatum
  status: ProjectStatus;                   // Status
  offer_order_number?: string;             // Angebots-/Auftragsnummer
  project_address: string;                 // Projektadresse
  project_description: string;             // Projektbeschreibung
  
  // 🧾 Verknüpfte Daten
  linked_invoices: string[];               // Verknüpfte Rechnungen
  linked_offers: string[];                 // Verknüpfte Angebote
  
  // 📊 Berechnete/Tracking-Felder
  actual_end_date?: string;                // Tatsächliches Ende
  total_hours?: number;                    // Gesamtstunden
  total_material_cost?: number;            // Materialkosten
  budget_planned?: number;                 // Geplantes Budget
  budget_actual?: number;                  // Aktueller Verbrauch
  
  // 🔒 Metadaten
  created_at: string;
  updated_at: string;
  created_by: string;                      // User ID
  project_manager?: string;                // Projektleiter ID
  assigned_team: string[];                 // Zugewiesene Mitarbeiter IDs
}

export interface TimeEntry {
  id: string;
  project_id: string;
  employee_id: string;
  employee_name: string;

  work_date: string;
  start_time: string;
  end_time: string;
  break_duration_min: number;
  total_hours: number;

  task_description: string;

  created_at: string;

  // Kostenberechnung
  hourly_rate?: number;
  total_cost?: number;
}

export interface MaterialEntry {
  id: string;
  project_id: string;
  employee_id: string;
  employee_name: string;
  
  entry_date: string;
  material_name: string;
  quantity: number;
  unit: string;
  unit_cost: number;
  total_cost: number;
  
  category: 'baumaterial' | 'werkzeug' | 'verbrauchsmaterial' | 'sonstiges';
  supplier?: string;
  invoice_reference?: string;
  
  created_at: string;
  approved_by?: string;
  approved_at?: string;
}

export interface ProjectDocument {
  id: string;
  project_id: string;
  uploaded_by: string;
  uploaded_by_name: string;
  
  file_name: string;
  file_type: string;
  file_size: number;
  file_url: string;
  
  category: 'plaene' | 'fotos' | 'rechnungen' | 'vertraege' | 'protokolle' | 'sonstiges';
  description?: string;
  
  uploaded_at: string;
  is_public: boolean;                      // Sichtbar für alle Projektteilnehmer
}

export interface ProjectComment {
  id: string;
  project_id: string;
  author_id: string;
  author_name: string;
  author_role: UserRole;
  
  comment_text: string;
  comment_type: 'info' | 'problem' | 'success' | 'warning';
  
  is_internal: boolean;                    // Nur für Team sichtbar
  mentioned_users?: string[];              // @-mentions
  
  created_at: string;
  edited_at?: string;
  
  // Antworten/Thread
  parent_comment_id?: string;
  replies_count: number;
}

export interface ProjectStatusChange {
  id: string;
  project_id: string;
  changed_by: string;
  changed_by_name: string;
  
  from_status: ProjectStatus;
  to_status: ProjectStatus;
  reason?: string;
  
  changed_at: string;
}

// 👥 Berechtigungen basierend auf Rollen
export interface ProjectPermissions {
  can_view: boolean;
  can_edit_basic_data: boolean;
  can_add_time: boolean;
  can_add_materials: boolean;
  can_upload_files: boolean;
  can_change_status: boolean;
  can_link_invoices: boolean;
  can_delete: boolean;
  can_manage_team: boolean;
}

export const getProjectPermissions = (userRole: UserRole, isProjectManager: boolean = false): ProjectPermissions => {
  const basePermissions: ProjectPermissions = {
    can_view: false,
    can_edit_basic_data: false,
    can_add_time: false,
    can_add_materials: false,
    can_upload_files: false,
    can_change_status: false,
    can_link_invoices: false,
    can_delete: false,
    can_manage_team: false,
  };

  switch (userRole) {
    case 'mitarbeiter':
      return {
        ...basePermissions,
        can_view: true,
        can_add_time: true,
        can_add_materials: true,
        can_upload_files: true,
      };
      
    case 'projektleiter':
      return {
        ...basePermissions,
        can_view: true,
        can_edit_basic_data: true,
        can_add_time: true,
        can_add_materials: true,
        can_upload_files: true,
        can_change_status: true,
        can_link_invoices: true,
        can_manage_team: true,
      };
      
    case 'admin':
      return {
        can_view: true,
        can_edit_basic_data: true,
        can_add_time: true,
        can_add_materials: true,
        can_upload_files: true,
        can_change_status: true,
        can_link_invoices: true,
        can_delete: true,
        can_manage_team: true,
      };
      
    default:
      return basePermissions;
  }
};

// 📊 Projekt-Statistiken
export interface ProjectStats {
  total_hours_logged: number;
  total_material_cost: number;
  total_project_cost: number;
  budget_utilization: number;             // Prozent
  days_active: number;
  days_remaining: number;
  team_size: number;
  documents_count: number;
  comments_count: number;
  last_activity: string;
}

// 🔄 Projekt-Timeline-Events  
export interface ProjectTimelineEvent {
  id: string;
  project_id: string;
  event_type: 'created' | 'status_change' | 'team_change' | 'milestone' | 'comment' | 'document' | 'invoice';
  title: string;
  description?: string;
  user_name: string;
  user_role: UserRole;
  timestamp: string;
  metadata?: Record<string, any>;
}

// 🎯 Projekt-Dashboard-Daten
export interface ProjectDashboardData extends ProjectBaseData {
  customer: {
    company_name: string;
    contact_person: string;
    email: string;
    phone?: string;
  };
  stats: ProjectStats;
  recent_activities: ProjectTimelineEvent[];
  team_members: Array<{
    id: string;
    name: string;
    role: UserRole;
    email: string;
    hours_this_week: number;
  }>;
  permissions: ProjectPermissions;
}

// 📋 Form-Datentypen
export interface ProjectFormData {
  project_name: string;
  customer_id: string;
  start_date: string;
  planned_end_date: string;
  project_address: string;
  project_description: string;
  offer_order_number?: string;
  budget_planned?: number;
  assigned_team: string[];
  project_manager?: string;
}

export interface TimeEntryFormData {
  work_date: string;
  start_time: string;
  end_time: string;
  break_duration_min: number;
  task_description: string;
  employee_id?: string;
}

export interface MaterialEntryFormData {
  entry_date: string;
  material_name: string;
  quantity: number;
  unit: string;
  unit_cost: number;
  category: MaterialEntry['category'];
  supplier?: string;
}

// 🔍 Filter & Such-Optionen
export interface ProjectFilters {
  status?: ProjectStatus[];
  customer_id?: string;
  project_manager?: string;
  date_range?: {
    start: string;
    end: string;
  };
  search_term?: string;
}

// 📈 Status-Definitionen mit Beschreibungen
export const PROJECT_STATUS_CONFIG: Record<ProjectStatus, {
  label: string;
  color: string;
  bgColor: string;
  icon: string;
  description: string;
}> = {
  anfrage: {
    label: 'Anfrage',
    color: 'text-purple-700',
    bgColor: 'bg-purple-100',
    icon: '📋',
    description: 'Projekt-Anfrage eingegangen',
  },
  besichtigung: {
    label: 'Besichtigung',
    color: 'text-orange-700',
    bgColor: 'bg-orange-100',
    icon: '🔍',
    description: 'Besichtigungstermin vereinbaren',
  },
  angebot: {
    label: 'Angebot',
    color: 'text-blue-700',
    bgColor: 'bg-blue-100',
    icon: '📄',
    description: 'Angebot erstellen und versenden',
  },
  beauftragt: {
    label: 'Beauftragt',
    color: 'text-indigo-700',
    bgColor: 'bg-indigo-100',
    icon: '✅',
    description: 'Auftrag erteilt',
  },
  in_bearbeitung: {
    label: 'In Arbeit',
    color: 'text-yellow-700',
    bgColor: 'bg-yellow-100',
    icon: '🔨',
    description: 'Projekt läuft aktiv',
  },
  abgeschlossen: {
    label: 'Fertig',
    color: 'text-green-700',
    bgColor: 'bg-green-100',
    icon: '🏁',
    description: 'Projekt ist abgeschlossen',
  },
};