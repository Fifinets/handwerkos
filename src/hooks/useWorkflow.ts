import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/integrations/supabase/client'
import { toast } from 'sonner'
import {
  WorkflowSettings,
  ProjectWorkflowConfig,
  ProjectWithWorkflow,
  WorkflowDecision,
  WorkflowType,
  UseWorkflowResult
} from '@/types/workflow'

// Standard-Einstellungen für neue Unternehmen
const DEFAULT_WORKFLOW_SETTINGS: Omit<WorkflowSettings, 'id' | 'company_id' | 'created_at' | 'updated_at'> = {
  min_hours_for_delivery_note: 8,
  min_material_value_for_delivery_note: 500,
  b2b_always_delivery_note: true,
  b2c_delivery_note_threshold: 1000,
  allow_manual_override: true,
  notify_on_workflow_auto_switch: true
}

export const useWorkflow = (): UseWorkflowResult => {
  const [settings, setSettings] = useState<WorkflowSettings | null>(null)
  const [projectConfigs, setProjectConfigs] = useState<Record<string, ProjectWorkflowConfig>>({})
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Lade Workflow-Einstellungen
  const loadSettings = useCallback(async () => {
    try {
      setIsLoading(true)
      setError(null)

      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Nicht angemeldet')

      // Versuche Einstellungen zu laden
      const { data: settingsData, error: settingsError } = await supabase
        .from('workflow_settings')
        .select('*')
        .eq('company_id', user.id) // Vereinfacht: user.id als company_id
        .single()

      if (settingsError && !settingsError.message.includes('No rows')) {
        console.error('Error loading workflow settings:', settingsError)
      }

      if (settingsData) {
        setSettings(settingsData)
      } else {
        // Erstelle Standard-Einstellungen
        const defaultSettings: Omit<WorkflowSettings, 'id' | 'created_at' | 'updated_at'> = {
          company_id: user.id,
          ...DEFAULT_WORKFLOW_SETTINGS
        }

        const { data: createdSettings, error: createError } = await supabase
          .from('workflow_settings')
          .insert(defaultSettings)
          .select()
          .single()

        if (createError) {
          console.warn('Could not create workflow settings, using defaults:', createError)
          // Verwende lokale Standard-Einstellungen als Fallback
          const fallbackSettings: WorkflowSettings = {
            id: 'fallback',
            company_id: user.id,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            ...DEFAULT_WORKFLOW_SETTINGS
          }
          setSettings(fallbackSettings)
        } else {
          setSettings(createdSettings)
        }
      }

    } catch (err: any) {
      console.error('Error in loadSettings:', err)
      setError(err.message)

      // Fallback zu Standard-Einstellungen
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const fallbackSettings: WorkflowSettings = {
          id: 'fallback',
          company_id: user.id,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          ...DEFAULT_WORKFLOW_SETTINGS
        }
        setSettings(fallbackSettings)
      }
    } finally {
      setIsLoading(false)
    }
  }, [])

  // Aktualisiere Workflow-Einstellungen
  const updateSettings = useCallback(async (updates: Partial<WorkflowSettings>) => {
    try {
      if (!settings) throw new Error('Keine Einstellungen geladen')

      const updatedSettings = { ...settings, ...updates, updated_at: new Date().toISOString() }

      // Versuche in Datenbank zu speichern
      if (settings.id !== 'fallback') {
        const { error } = await supabase
          .from('workflow_settings')
          .update(updates)
          .eq('id', settings.id)

        if (error) {
          console.warn('Could not update workflow settings:', error)
        }
      }

      setSettings(updatedSettings)
      toast.success('Workflow-Einstellungen aktualisiert')

    } catch (err: any) {
      console.error('Error updating settings:', err)
      toast.error('Fehler beim Aktualisieren der Einstellungen')
    }
  }, [settings])

  // Bestimme Workflow für ein Projekt
  const determineWorkflow = useCallback((project: ProjectWithWorkflow): WorkflowDecision => {
    if (!settings) {
      return {
        workflow: 'direct_invoice',
        reason: ['Standard-Workflow (keine Einstellungen geladen)'],
        auto_determined: true,
        triggered_rules: []
      }
    }

    const reasons: string[] = []
    const triggeredRules: string[] = []

    // 1. Prüfe manuelle Überschreibung
    if (project.workflow_config?.workflow_type === 'small') {
      return {
        workflow: 'direct_invoice',
        reason: ['Manuell als "Klein" konfiguriert'],
        auto_determined: false,
        triggered_rules: ['manual_override_small']
      }
    }

    if (project.workflow_config?.workflow_type === 'large') {
      return {
        workflow: 'delivery_note_first',
        reason: ['Manuell als "Groß" konfiguriert'],
        auto_determined: false,
        triggered_rules: ['manual_override_large']
      }
    }

    if (project.workflow_config?.requires_delivery_note === true) {
      return {
        workflow: 'delivery_note_first',
        reason: ['Lieferschein manuell erforderlich gesetzt'],
        auto_determined: false,
        triggered_rules: ['manual_delivery_note_required']
      }
    }

    if (project.workflow_config?.requires_delivery_note === false) {
      return {
        workflow: 'direct_invoice',
        reason: ['Lieferschein manuell deaktiviert'],
        auto_determined: false,
        triggered_rules: ['manual_delivery_note_disabled']
      }
    }

    // 2. Automatische Regeln anwenden
    let requiresDeliveryNote = false

    // B2B-Kunde Regel
    if (settings.b2b_always_delivery_note && project.customer_type === 'b2b') {
      requiresDeliveryNote = true
      reasons.push('B2B-Kunde (automatisch Lieferschein)')
      triggeredRules.push('b2b_auto_delivery_note')
    }

    // Stunden-Schwellwert
    if (project.total_hours && project.total_hours > settings.min_hours_for_delivery_note) {
      requiresDeliveryNote = true
      reasons.push(`Mehr als ${settings.min_hours_for_delivery_note} Stunden (${project.total_hours}h)`)
      triggeredRules.push('hours_threshold')
    }

    // Material-Wert Schwellwert
    if (project.total_material_value && project.total_material_value > settings.min_material_value_for_delivery_note) {
      requiresDeliveryNote = true
      reasons.push(`Material-Wert über ${settings.min_material_value_for_delivery_note}€ (${project.total_material_value}€)`)
      triggeredRules.push('material_value_threshold')
    }

    // B2C-Schwellwert
    if (project.customer_type === 'b2c' &&
        project.estimated_budget &&
        project.estimated_budget > settings.b2c_delivery_note_threshold) {
      requiresDeliveryNote = true
      reasons.push(`B2C-Projekt über ${settings.b2c_delivery_note_threshold}€ (${project.estimated_budget}€)`)
      triggeredRules.push('b2c_threshold')
    }

    if (requiresDeliveryNote) {
      return {
        workflow: 'delivery_note_first',
        reason: reasons,
        auto_determined: true,
        triggered_rules: triggeredRules
      }
    }

    return {
      workflow: 'direct_invoice',
      reason: ['Automatisch bestimmt: Direktabrechnung'],
      auto_determined: true,
      triggered_rules: ['default_direct']
    }
  }, [settings])

  // Projekt-Workflow Konfiguration aktualisieren
  const updateProjectWorkflow = useCallback(async (
    projectId: string,
    config: Partial<ProjectWorkflowConfig>
  ) => {
    try {
      const existingConfig = projectConfigs[projectId]
      const updatedConfig = existingConfig
        ? { ...existingConfig, ...config, updated_at: new Date().toISOString() }
        : {
            id: crypto.randomUUID(),
            project_id: projectId,
            workflow_type: 'auto' as const,
            requires_delivery_note: null,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            ...config
          }

      // Versuche in Datenbank zu speichern
      try {
        if (existingConfig) {
          await supabase
            .from('project_workflow_config')
            .update(config)
            .eq('project_id', projectId)
        } else {
          await supabase
            .from('project_workflow_config')
            .insert(updatedConfig)
        }
      } catch (dbError) {
        console.warn('Could not save project workflow config:', dbError)
      }

      // Lokal aktualisieren
      setProjectConfigs(prev => ({
        ...prev,
        [projectId]: updatedConfig
      }))

      toast.success('Projekt-Workflow aktualisiert')

    } catch (err: any) {
      console.error('Error updating project workflow:', err)
      toast.error('Fehler beim Aktualisieren der Projekt-Konfiguration')
    }
  }, [projectConfigs])

  // Projekt-Workflow Konfiguration abrufen
  const getProjectWorkflow = useCallback((projectId: string): ProjectWorkflowConfig | null => {
    return projectConfigs[projectId] || null
  }, [projectConfigs])

  // Workflow-Statistiken
  const getWorkflowStats = useCallback(() => {
    // Placeholder - würde echte Daten aus DB laden
    return {
      total_projects: 0,
      direct_invoices: 0,
      delivery_note_first: 0,
      auto_determined: 0,
      manual_override: 0
    }
  }, [])

  // Initialisierung
  useEffect(() => {
    loadSettings()
  }, [loadSettings])

  return {
    settings,
    updateSettings,
    determineWorkflow,
    updateProjectWorkflow,
    getProjectWorkflow,
    getWorkflowStats,
    isLoading,
    error
  }
}