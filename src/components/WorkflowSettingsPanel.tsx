import React from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"
import { AlertCircle, Settings, CheckCircle2, Clock, Package, Users, Zap } from "lucide-react"
import { useWorkflow } from "@/hooks/useWorkflow"
import { toast } from "sonner"

const WorkflowSettingsPanel: React.FC = () => {
  const { settings, updateSettings, getWorkflowStats, isLoading } = useWorkflow()
  const stats = getWorkflowStats()

  if (isLoading || !settings) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Workflow-Einstellungen
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        </CardContent>
      </Card>
    )
  }

  const handleSettingChange = async (key: keyof typeof settings, value: any) => {
    try {
      await updateSettings({ [key]: value })
    } catch (error) {
      console.error('Error updating setting:', error)
      toast.error('Fehler beim Speichern der Einstellung')
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Workflow-Einstellungen
          </CardTitle>
          <CardDescription>
            Konfigurieren Sie die automatischen Regeln für die Workflow-Erkennung zwischen
            Direktabrechnung und Lieferschein-Workflow.
          </CardDescription>
        </CardHeader>
      </Card>

      {/* Statistiken */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5" />
            Workflow-Übersicht
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="text-center p-4 bg-blue-50 rounded-lg">
              <div className="text-2xl font-bold text-blue-600">{stats.total_projects}</div>
              <div className="text-sm text-blue-700">Gesamt-Projekte</div>
            </div>
            <div className="text-center p-4 bg-green-50 rounded-lg">
              <div className="text-2xl font-bold text-green-600">{stats.direct_invoices}</div>
              <div className="text-sm text-green-700">Direktabrechnung</div>
            </div>
            <div className="text-center p-4 bg-orange-50 rounded-lg">
              <div className="text-2xl font-bold text-orange-600">{stats.delivery_note_first}</div>
              <div className="text-sm text-orange-700">Mit Lieferschein</div>
            </div>
            <div className="text-center p-4 bg-purple-50 rounded-lg">
              <div className="text-2xl font-bold text-purple-600">{stats.auto_determined}</div>
              <div className="text-sm text-purple-700">Automatisch erkannt</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Schwellwerte */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Automatische Schwellwerte
          </CardTitle>
          <CardDescription>
            Projekte werden automatisch dem Lieferschein-Workflow zugeordnet, wenn diese Werte überschritten werden.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Stunden-Schwellwert */}
          <div className="space-y-2">
            <Label htmlFor="hours-threshold">
              Mindest-Arbeitszeit für Lieferschein (Stunden)
            </Label>
            <div className="flex items-center gap-4">
              <Input
                id="hours-threshold"
                type="number"
                min="0"
                step="0.5"
                value={settings.min_hours_for_delivery_note}
                onChange={(e) => handleSettingChange('min_hours_for_delivery_note', parseFloat(e.target.value) || 0)}
                className="max-w-32"
              />
              <Badge variant="outline">Standard: 8h (1 Arbeitstag)</Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              Projekte mit mehr als {settings.min_hours_for_delivery_note} Stunden erhalten automatisch einen Lieferschein.
            </p>
          </div>

          <Separator />

          {/* Material-Wert Schwellwert */}
          <div className="space-y-2">
            <Label htmlFor="material-threshold">
              Mindest-Materialwert für Lieferschein (€)
            </Label>
            <div className="flex items-center gap-4">
              <Input
                id="material-threshold"
                type="number"
                min="0"
                step="50"
                value={settings.min_material_value_for_delivery_note}
                onChange={(e) => handleSettingChange('min_material_value_for_delivery_note', parseFloat(e.target.value) || 0)}
                className="max-w-32"
              />
              <Badge variant="outline">Standard: 500€</Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              Projekte mit Material über {settings.min_material_value_for_delivery_note}€ erhalten automatisch einen Lieferschein.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Kunden-basierte Regeln */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Kunden-basierte Regeln
          </CardTitle>
          <CardDescription>
            Verschiedene Workflows je nach Kundentyp (B2B vs. B2C).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* B2B immer Lieferschein */}
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Label>B2B-Kunden immer mit Lieferschein</Label>
              <p className="text-sm text-muted-foreground">
                Geschäftskunden erhalten grundsätzlich einen Lieferschein zur Dokumentation.
              </p>
            </div>
            <Switch
              checked={settings.b2b_always_delivery_note}
              onCheckedChange={(checked) => handleSettingChange('b2b_always_delivery_note', checked)}
            />
          </div>

          <Separator />

          {/* B2C Schwellwert */}
          <div className="space-y-2">
            <Label htmlFor="b2c-threshold">
              B2C-Schwellwert für Lieferschein (€)
            </Label>
            <div className="flex items-center gap-4">
              <Input
                id="b2c-threshold"
                type="number"
                min="0"
                step="100"
                value={settings.b2c_delivery_note_threshold}
                onChange={(e) => handleSettingChange('b2c_delivery_note_threshold', parseFloat(e.target.value) || 0)}
                className="max-w-32"
              />
              <Badge variant="outline">Standard: 1000€</Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              Privatkunden-Projekte über {settings.b2c_delivery_note_threshold}€ erhalten einen Lieferschein.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Erweiterte Einstellungen */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Erweiterte Einstellungen
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Manuelle Überschreibung erlauben */}
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Label>Manuelle Überschreibung erlauben</Label>
              <p className="text-sm text-muted-foreground">
                Mitarbeiter können die automatischen Regeln bei Bedarf überschreiben.
              </p>
            </div>
            <Switch
              checked={settings.allow_manual_override}
              onCheckedChange={(checked) => handleSettingChange('allow_manual_override', checked)}
            />
          </div>

          <Separator />

          {/* Benachrichtigungen */}
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Label>Benachrichtigung bei automatischem Workflow-Wechsel</Label>
              <p className="text-sm text-muted-foreground">
                Benachrichtigung senden, wenn ein Projekt automatisch einem anderen Workflow zugeordnet wird.
              </p>
            </div>
            <Switch
              checked={settings.notify_on_workflow_auto_switch}
              onCheckedChange={(checked) => handleSettingChange('notify_on_workflow_auto_switch', checked)}
            />
          </div>
        </CardContent>
      </Card>

      {/* Beispiel-Erklärung */}
      <Card className="border-green-200 bg-green-50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-green-700">
            <CheckCircle2 className="h-5 w-5" />
            Beispiel-Workflows
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4 text-sm">
            <div className="p-3 bg-white rounded-lg">
              <div className="font-semibold text-green-700 mb-2">✅ Direktabrechnung</div>
              <p className="text-gray-600">
                • Privatkunde (B2C)<br/>
                • 4 Stunden Arbeitszeit<br/>
                • 200€ Material<br/>
                • 800€ Gesamtprojekt
              </p>
            </div>
            <div className="p-3 bg-white rounded-lg">
              <div className="font-semibold text-orange-700 mb-2">📋 Mit Lieferschein</div>
              <p className="text-gray-600">
                • Geschäftskunde (B2B) - automatisch<br/>
                • ODER: 12 Stunden Arbeitszeit<br/>
                • ODER: 800€ Material<br/>
                • ODER: B2C über 1000€
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Info über Fallback */}
      <Card className="border-blue-200 bg-blue-50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-blue-700">
            <AlertCircle className="h-5 w-5" />
            Hinweis
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-blue-700 text-sm">
            Die Einstellungen werden automatisch gespeichert und gelten für alle neuen Projekte.
            Bestehende Projekte können manuell angepasst werden. Bei Problemen mit der Datenbank
            werden Standard-Werte verwendet.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}

export default WorkflowSettingsPanel