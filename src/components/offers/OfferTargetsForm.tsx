import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { CalendarIcon, Target, Clock, Euro, Users } from 'lucide-react';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import { OfferTargetCreate, OfferComplexity } from '@/types/offer';

interface Employee {
  id: string;
  first_name: string;
  last_name: string;
}

interface OfferTargetsFormProps {
  targets: OfferTargetCreate;
  onChange: (targets: OfferTargetCreate) => void;
  employees?: Employee[];
  disabled?: boolean;
}

const COMPLEXITY_OPTIONS: { value: OfferComplexity; label: string; description: string }[] = [
  { value: 'simple', label: 'Einfach', description: 'Standardarbeit, bekannte Abläufe' },
  { value: 'medium', label: 'Mittel', description: 'Normaler Aufwand, teilweise Anpassungen' },
  { value: 'complex', label: 'Komplex', description: 'Hoher Aufwand, viele Unbekannte' },
];

export function OfferTargetsForm({
  targets,
  onChange,
  employees = [],
  disabled = false,
}: OfferTargetsFormProps) {

  const updateField = (field: keyof OfferTargetCreate, value: any) => {
    onChange({ ...targets, [field]: value });
  };

  // Calculate estimated values
  const estimatedLaborCost = (targets.planned_hours_total || 0) * (targets.internal_hourly_rate || 0);
  const estimatedRevenue = (targets.planned_hours_total || 0) * (targets.billable_hourly_rate || 0);
  const totalCost = estimatedLaborCost + (targets.planned_material_cost_total || 0) + (targets.planned_other_cost || 0);
  const estimatedMargin = estimatedRevenue - totalCost;
  const marginPercent = estimatedRevenue > 0 ? (estimatedMargin / estimatedRevenue) * 100 : 0;

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('de-DE', {
      style: 'currency',
      currency: 'EUR',
    }).format(value);
  };

  return (
    <div className="space-y-6">
      {/* Time Planning */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Zeitplanung
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="planned_hours">Geplante Stunden (optional)</Label>
            <Input
              id="planned_hours"
              type="number"
              step="0.5"
              min="0"
              value={targets.planned_hours_total || ''}
              onChange={(e) => updateField('planned_hours_total', e.target.value ? parseFloat(e.target.value) : undefined)}
              disabled={disabled}
              placeholder="z.B. 40"
            />
            <p className="text-xs text-muted-foreground">
              Interne Kalkulation für Projektsteuerung – nicht sichtbar für Kunden
            </p>
          </div>
          <div className="space-y-2">
            <Label>Komplexität</Label>
            <Select
              value={targets.complexity || 'medium'}
              onValueChange={(value) => updateField('complexity', value as OfferComplexity)}
              disabled={disabled}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {COMPLEXITY_OPTIONS.map(({ value, label, description }) => (
                  <SelectItem key={value} value={value}>
                    <div>
                      <div className="font-medium">{label}</div>
                      <div className="text-xs text-muted-foreground">{description}</div>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Cost Planning */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Euro className="h-4 w-4" />
            Kostenplanung
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="internal_rate">Interner Stundensatz</Label>
              <Input
                id="internal_rate"
                type="number"
                step="0.01"
                min="0"
                value={targets.internal_hourly_rate || ''}
                onChange={(e) => updateField('internal_hourly_rate', e.target.value ? parseFloat(e.target.value) : undefined)}
                disabled={disabled}
                placeholder="z.B. 45.00"
              />
              <p className="text-xs text-muted-foreground">Kosten pro Stunde (intern)</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="billable_rate">Verrechnungssatz</Label>
              <Input
                id="billable_rate"
                type="number"
                step="0.01"
                min="0"
                value={targets.billable_hourly_rate || ''}
                onChange={(e) => updateField('billable_hourly_rate', e.target.value ? parseFloat(e.target.value) : undefined)}
                disabled={disabled}
                placeholder="z.B. 75.00"
              />
              <p className="text-xs text-muted-foreground">Abrechnung pro Stunde (extern)</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="material_cost">Geplante Materialkosten</Label>
              <Input
                id="material_cost"
                type="number"
                step="0.01"
                min="0"
                value={targets.planned_material_cost_total || ''}
                onChange={(e) => updateField('planned_material_cost_total', e.target.value ? parseFloat(e.target.value) : undefined)}
                disabled={disabled}
                placeholder="z.B. 500.00"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="other_cost">Sonstige Kosten</Label>
              <Input
                id="other_cost"
                type="number"
                step="0.01"
                min="0"
                value={targets.planned_other_cost || ''}
                onChange={(e) => updateField('planned_other_cost', e.target.value ? parseFloat(e.target.value) : undefined)}
                disabled={disabled}
                placeholder="z.B. 100.00"
              />
            </div>
          </div>

          {/* Calculated Summary */}
          {(targets.planned_hours_total || 0) > 0 && (targets.internal_hourly_rate || 0) > 0 && (
            <div className="mt-4 p-3 bg-muted rounded-lg space-y-2">
              <div className="flex justify-between text-sm">
                <span>Geschätzte Personalkosten:</span>
                <span>{formatCurrency(estimatedLaborCost)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Gesamtkosten (geschätzt):</span>
                <span>{formatCurrency(totalCost)}</span>
              </div>
              {(targets.billable_hourly_rate || 0) > 0 && (
                <>
                  <div className="flex justify-between text-sm">
                    <span>Geschätzter Umsatz:</span>
                    <span>{formatCurrency(estimatedRevenue)}</span>
                  </div>
                  <div className={`flex justify-between text-sm font-semibold ${marginPercent >= 20 ? 'text-green-600' : marginPercent >= 10 ? 'text-yellow-600' : 'text-red-600'}`}>
                    <span>Geschätzte Marge:</span>
                    <span>{formatCurrency(estimatedMargin)} ({marginPercent.toFixed(1)}%)</span>
                  </div>
                </>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Timeline & Responsibility */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Target className="h-4 w-4" />
            Zeitrahmen & Verantwortung
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Ziel-Startdatum</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className="w-full justify-start text-left font-normal"
                  disabled={disabled}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {targets.target_start_date ? (
                    format(new Date(targets.target_start_date), 'dd.MM.yyyy', { locale: de })
                  ) : (
                    <span className="text-muted-foreground">Datum wählen</span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={targets.target_start_date ? new Date(targets.target_start_date) : undefined}
                  onSelect={(date) => updateField('target_start_date', date?.toISOString().split('T')[0])}
                  locale={de}
                />
              </PopoverContent>
            </Popover>
          </div>
          <div className="space-y-2">
            <Label>Ziel-Enddatum</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className="w-full justify-start text-left font-normal"
                  disabled={disabled}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {targets.target_end_date ? (
                    format(new Date(targets.target_end_date), 'dd.MM.yyyy', { locale: de })
                  ) : (
                    <span className="text-muted-foreground">Datum wählen</span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={targets.target_end_date ? new Date(targets.target_end_date) : undefined}
                  onSelect={(date) => updateField('target_end_date', date?.toISOString().split('T')[0])}
                  locale={de}
                />
              </PopoverContent>
            </Popover>
          </div>
          <div className="col-span-2 space-y-2">
            <Label className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              Projektleiter
            </Label>
            <Select
              value={targets.project_manager_id || 'none'}
              onValueChange={(value) => updateField('project_manager_id', value === 'none' ? undefined : value)}
              disabled={disabled}
            >
              <SelectTrigger>
                <SelectValue placeholder="Projektleiter auswählen" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Kein Projektleiter</SelectItem>
                {employees.map((employee) => (
                  <SelectItem key={employee.id} value={employee.id}>
                    {employee.first_name} {employee.last_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default OfferTargetsForm;
