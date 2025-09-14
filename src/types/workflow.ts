export interface WorkflowSettings {
  id: string
  company_id: string

  // Schwellwerte für automatische Workflow-Erkennung
  min_hours_for_delivery_note: number      // Standard: 8h
  min_material_value_for_delivery_note: number  // Standard: 500€

  // Kunde-basierte Regeln
  b2b_always_delivery_note: boolean        // Standard: true
  b2c_delivery_note_threshold: number      // Standard: 1000€

  // Projekt-spezifische Überschreibungen
  allow_manual_override: boolean           // Standard: true

  // Benachrichtigungen
  notify_on_workflow_auto_switch: boolean  // Standard: true

  created_at: string
  updated_at: string
}

export interface ProjectWorkflowConfig {
  id: string
  project_id: string

  // Manuelle Einstellungen (überschreibt automatische Regeln)
  workflow_type: 'auto' | 'small' | 'large'
  requires_delivery_note: boolean | null   // null = automatisch bestimmen

  // Grund für manuelle Überschreibung
  override_reason?: string

  created_at: string
  updated_at: string
}

export type WorkflowType = 'direct_invoice' | 'delivery_note_first'

export interface WorkflowDecision {
  workflow: WorkflowType
  reason: string[]                         // Gründe für die Entscheidung
  auto_determined: boolean                 // Automatisch oder manuell
  triggered_rules: string[]                // Welche Regeln ausgelöst wurden
}

// Erweiterte Projekt-Typen
export interface ProjectWithWorkflow {
  id: string
  name: string
  customer_id: string
  customer_type: 'b2b' | 'b2c'
  estimated_budget?: number

  // Workflow-Konfiguration
  workflow_config?: ProjectWorkflowConfig

  // Berechnete Werte für Workflow-Entscheidung
  total_hours?: number
  total_material_value?: number

  // Standard Projekt-Felder
  status: 'active' | 'completed' | 'cancelled'
  start_date?: string
  end_date?: string
  description?: string
  created_at: string
  updated_at: string
}

// Hook-Interface für Workflow-Management
export interface UseWorkflowResult {
  // Settings
  settings: WorkflowSettings | null
  updateSettings: (settings: Partial<WorkflowSettings>) => Promise<void>

  // Workflow-Entscheidung
  determineWorkflow: (project: ProjectWithWorkflow) => WorkflowDecision

  // Projekt-Konfiguration
  updateProjectWorkflow: (projectId: string, config: Partial<ProjectWorkflowConfig>) => Promise<void>
  getProjectWorkflow: (projectId: string) => ProjectWorkflowConfig | null

  // Statistiken
  getWorkflowStats: () => {
    total_projects: number
    direct_invoices: number
    delivery_note_first: number
    auto_determined: number
    manual_override: number
  }

  isLoading: boolean
  error: string | null
}