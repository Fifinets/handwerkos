import React from 'react'
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Separator } from "@/components/ui/separator"
import {
  FileText,
  Zap,
  Settings,
  CheckCircle2,
  AlertCircle,
  Clock,
  Package,
  Users,
  Receipt
} from "lucide-react"
import { useWorkflow } from "@/hooks/useWorkflow"
import { ProjectWithWorkflow, WorkflowDecision } from "@/types/workflow"
import { useState } from "react"

interface ProjectWorkflowIndicatorProps {
  project: ProjectWithWorkflow
  showDetails?: boolean
  allowEdit?: boolean
  className?: string
}

const ProjectWorkflowIndicator: React.FC<ProjectWorkflowIndicatorProps> = ({
  project,
  showDetails = false,
  allowEdit = false,
  className = ""
}) => {
  const { determineWorkflow, updateProjectWorkflow, getProjectWorkflow, settings } = useWorkflow()
  const [showEditDialog, setShowEditDialog] = useState(false)
  const [editConfig, setEditConfig] = useState({
    workflow_type: 'auto' as 'auto' | 'small' | 'large',
    requires_delivery_note: null as boolean | null,
    override_reason: ''
  })

  // Workflow-Entscheidung berechnen
  const decision: WorkflowDecision = determineWorkflow(project)
  const currentConfig = getProjectWorkflow(project.id)

  // Icons und Farben für Workflow-Typen
  const getWorkflowDisplay = (decision: WorkflowDecision) => {
    if (decision.workflow === 'delivery_note_first') {
      return {
        icon: <FileText className="h-4 w-4" />,
        label: 'Mit Lieferschein',
        color: 'bg-orange-500',
        badge: 'default' as const,
        description: 'Lieferschein → Kunde bestätigt → Rechnung'
      }
    } else {
      return {
        icon: <Receipt className="h-4 w-4" />,
        label: 'Direktabrechnung',
        color: 'bg-green-500',
        badge: 'secondary' as const,
        description: 'Direkt zur Rechnung'
      }
    }
  }

  const workflowDisplay = getWorkflowDisplay(decision)

  const handleSaveConfig = async () => {
    try {
      await updateProjectWorkflow(project.id, {
        workflow_type: editConfig.workflow_type,
        requires_delivery_note: editConfig.requires_delivery_note,
        override_reason: editConfig.override_reason || undefined
      })
      setShowEditDialog(false)
    } catch (error) {
      console.error('Error saving workflow config:', error)
    }
  }

  const openEditDialog = () => {
    setEditConfig({
      workflow_type: currentConfig?.workflow_type || 'auto',
      requires_delivery_note: currentConfig?.requires_delivery_note || null,
      override_reason: currentConfig?.override_reason || ''
    })
    setShowEditDialog(true)
  }

  return (
    <div className={className}>
      {/* Kompakte Anzeige */}
      {!showDetails && (
        <div className="flex items-center gap-2">
          <Badge variant={workflowDisplay.badge} className="flex items-center gap-1">
            {workflowDisplay.icon}
            {workflowDisplay.label}
          </Badge>
          {!decision.auto_determined && (
            <Badge variant="outline" className="text-xs">
              Manuell
            </Badge>
          )}
          {allowEdit && (
            <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
              <DialogTrigger asChild>
                <Button variant="ghost" size="sm" onClick={openEditDialog}>
                  <Settings className="h-3 w-3" />
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>Workflow-Einstellungen</DialogTitle>
                  <DialogDescription>
                    Projekt: {project.name}
                  </DialogDescription>
                </DialogHeader>

                <div className="space-y-4">
                  <div>
                    <Label>Workflow-Typ</Label>
                    <Select
                      value={editConfig.workflow_type}
                      onValueChange={(value: any) => setEditConfig(prev => ({ ...prev, workflow_type: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="auto">Automatisch bestimmen</SelectItem>
                        <SelectItem value="small">Klein (Direktabrechnung)</SelectItem>
                        <SelectItem value="large">Groß (Mit Lieferschein)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {editConfig.workflow_type === 'auto' && (
                    <div className="flex items-center justify-between">
                      <Label>Lieferschein erzwingen</Label>
                      <Select
                        value={editConfig.requires_delivery_note === null ? 'auto' : editConfig.requires_delivery_note.toString()}
                        onValueChange={(value) => {
                          const boolValue = value === 'auto' ? null : value === 'true'
                          setEditConfig(prev => ({ ...prev, requires_delivery_note: boolValue }))
                        }}
                      >
                        <SelectTrigger className="w-32">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="auto">Automatisch</SelectItem>
                          <SelectItem value="true">Ja</SelectItem>
                          <SelectItem value="false">Nein</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {(editConfig.workflow_type !== 'auto' || editConfig.requires_delivery_note !== null) && (
                    <div>
                      <Label>Grund für Überschreibung</Label>
                      <Textarea
                        value={editConfig.override_reason}
                        onChange={(e) => setEditConfig(prev => ({ ...prev, override_reason: e.target.value }))}
                        placeholder="z.B. Kunde-Wunsch, besondere Anforderungen..."
                        rows={2}
                      />
                    </div>
                  )}

                  <div className="flex gap-2 pt-4">
                    <Button variant="outline" onClick={() => setShowEditDialog(false)} className="flex-1">
                      Abbrechen
                    </Button>
                    <Button onClick={handleSaveConfig} className="flex-1">
                      Speichern
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          )}
        </div>
      )}

      {/* Detaillierte Anzeige */}
      {showDetails && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <div className={`h-3 w-3 rounded-full ${workflowDisplay.color}`} />
              {workflowDisplay.label}
              {!decision.auto_determined && (
                <Badge variant="outline" className="ml-2">
                  <Settings className="h-3 w-3 mr-1" />
                  Manuell
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Workflow-Beschreibung */}
            <div className="p-3 bg-muted rounded-lg">
              <p className="text-sm font-medium mb-2">Ablauf:</p>
              <p className="text-sm text-muted-foreground">
                {workflowDisplay.description}
              </p>
            </div>

            {/* Begründung */}
            <div>
              <p className="text-sm font-medium mb-2">
                {decision.auto_determined ? 'Automatisch erkannt durch:' : 'Manuell konfiguriert:'}
              </p>
              <div className="space-y-1">
                {decision.reason.map((reason, index) => (
                  <div key={index} className="flex items-center gap-2 text-sm">
                    {decision.auto_determined ? (
                      <Zap className="h-3 w-3 text-yellow-500" />
                    ) : (
                      <Settings className="h-3 w-3 text-blue-500" />
                    )}
                    <span>{reason}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Ausgelöste Regeln */}
            {decision.triggered_rules.length > 0 && (
              <div>
                <p className="text-sm font-medium mb-2">Ausgelöste Regeln:</p>
                <div className="flex flex-wrap gap-1">
                  {decision.triggered_rules.map((rule, index) => (
                    <Badge key={index} variant="outline" className="text-xs">
                      {rule}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Aktuelle Werte */}
            {settings && (
              <div>
                <Separator className="my-3" />
                <p className="text-sm font-medium mb-2">Aktuelle Schwellwerte:</p>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    <span>{settings.min_hours_for_delivery_note}h</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Package className="h-3 w-3" />
                    <span>{settings.min_material_value_for_delivery_note}€</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Users className="h-3 w-3" />
                    <span>B2B: {settings.b2b_always_delivery_note ? 'Immer' : 'Nach Regeln'}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Users className="h-3 w-3" />
                    <span>B2C: {settings.b2c_delivery_note_threshold}€</span>
                  </div>
                </div>
              </div>
            )}

            {/* Projekt-Werte */}
            {(project.total_hours || project.total_material_value) && (
              <div>
                <Separator className="my-3" />
                <p className="text-sm font-medium mb-2">Projekt-Werte:</p>
                <div className="space-y-1 text-sm">
                  {project.total_hours && (
                    <div className="flex justify-between">
                      <span>Arbeitszeit:</span>
                      <span className={project.total_hours > (settings?.min_hours_for_delivery_note || 8) ? 'text-orange-600 font-medium' : ''}>
                        {project.total_hours}h
                      </span>
                    </div>
                  )}
                  {project.total_material_value && (
                    <div className="flex justify-between">
                      <span>Material-Wert:</span>
                      <span className={project.total_material_value > (settings?.min_material_value_for_delivery_note || 500) ? 'text-orange-600 font-medium' : ''}>
                        {project.total_material_value}€
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span>Kunde:</span>
                    <span>{project.customer_type === 'b2b' ? 'Geschäftskunde' : 'Privatkunde'}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Edit Button */}
            {allowEdit && settings?.allow_manual_override && (
              <Button variant="outline" onClick={openEditDialog} className="w-full">
                <Settings className="h-4 w-4 mr-2" />
                Workflow-Einstellungen ändern
              </Button>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}

export default ProjectWorkflowIndicator