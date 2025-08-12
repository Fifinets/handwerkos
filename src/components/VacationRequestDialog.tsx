import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Calendar, Clock } from "lucide-react";

interface VacationRequestDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

interface CompanySettings {
  default_vacation_days: number;
}

export function VacationRequestDialog({
  open,
  onOpenChange,
  onSuccess
}: VacationRequestDialogProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [availableVacationDays, setAvailableVacationDays] = useState(0);
  const [formData, setFormData] = useState({
    startDate: "",
    endDate: "",
    reason: "",
    type: "vacation" as "vacation" | "sick" | "personal"
  });

  useEffect(() => {
    if (open) {
      loadVacationBalance();
    }
  }, [open]);

  const loadVacationBalance = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Get employee info
      const { data: employee } = await supabase
        .from('employees')
        .select('id, vacation_days_total, vacation_days_used')
        .eq('user_id', user.id)
        .single();

      if (employee) {
        const available = (employee.vacation_days_total || 0) - (employee.vacation_days_used || 0);
        setAvailableVacationDays(Math.max(0, available));
      } else {
        // If no employee record, get default from company settings
        const { data: settings } = await supabase
          .from('company_settings')
          .select('default_vacation_days')
          .single();

        setAvailableVacationDays(settings?.default_vacation_days || 25);
      }
    } catch (error) {
      console.error('Error loading vacation balance:', error);
      setAvailableVacationDays(0);
    }
  };

  const calculateDaysBetween = (startDate: string, endDate: string): number => {
    if (!startDate || !endDate) return 0;
    
    const start = new Date(startDate);
    const end = new Date(endDate);
    const timeDiff = end.getTime() - start.getTime();
    const daysDiff = Math.ceil(timeDiff / (1000 * 3600 * 24)) + 1; // +1 to include both start and end date
    
    return Math.max(0, daysDiff);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.startDate || !formData.endDate) {
      toast({
        title: "Fehler",
        description: "Bitte wählen Sie Start- und Enddatum aus",
        variant: "destructive"
      });
      return;
    }

    const startDate = new Date(formData.startDate);
    const endDate = new Date(formData.endDate);
    
    if (startDate > endDate) {
      toast({
        title: "Fehler",
        description: "Das Enddatum muss nach dem Startdatum liegen",
        variant: "destructive"
      });
      return;
    }

    const requestedDays = calculateDaysBetween(formData.startDate, formData.endDate);
    
    if (formData.type === "vacation" && requestedDays > availableVacationDays) {
      toast({
        title: "Fehler",
        description: `Sie haben nur noch ${availableVacationDays} Urlaubstage verfügbar`,
        variant: "destructive"
      });
      return;
    }

    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Nicht angemeldet');

      // Get employee ID
      const { data: employee, error: employeeError } = await supabase
        .from('employees')
        .select('id')
        .eq('user_id', user.id)
        .single();

      if (employeeError || !employee) {
        throw new Error('Mitarbeiterdaten nicht gefunden');
      }

      // Create vacation request
      const { error } = await supabase
        .from('vacation_requests')
        .insert({
          employee_id: employee.id,
          start_date: formData.startDate,
          end_date: formData.endDate,
          days_requested: requestedDays,
          request_type: formData.type,
          reason: formData.reason || null,
          status: 'pending',
          created_by: user.id
        });

      if (error) throw error;

      toast({
        title: "Antrag eingereicht",
        description: `Ihr ${formData.type === 'vacation' ? 'Urlaubs' : 'Abwesenheits'}antrag wurde erfolgreich eingereicht`,
      });

      // Reset form
      setFormData({
        startDate: "",
        endDate: "",
        reason: "",
        type: "vacation"
      });

      onOpenChange(false);
      onSuccess?.();

    } catch (error: any) {
      console.error('Error submitting vacation request:', error);
      toast({
        title: "Fehler",
        description: error.message || "Antrag konnte nicht eingereicht werden",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const requestedDays = calculateDaysBetween(formData.startDate, formData.endDate);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Urlaubsantrag stellen
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Vacation balance display */}
          <div className="bg-blue-50 p-3 rounded-lg">
            <div className="flex items-center justify-between text-sm">
              <span>Verfügbare Urlaubstage:</span>
              <span className="font-semibold text-blue-600">{availableVacationDays} Tage</span>
            </div>
          </div>

          {/* Request type */}
          <div className="space-y-2">
            <Label>Art der Abwesenheit</Label>
            <select
              value={formData.type}
              onChange={(e) => setFormData(prev => ({ 
                ...prev, 
                type: e.target.value as "vacation" | "sick" | "personal" 
              }))}
              className="w-full p-2 border rounded-md"
            >
              <option value="vacation">Urlaub</option>
              <option value="sick">Krankmeldung</option>
              <option value="personal">Persönliche Angelegenheiten</option>
            </select>
          </div>

          {/* Date selection */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="startDate">Von</Label>
              <Input
                id="startDate"
                type="date"
                value={formData.startDate}
                onChange={(e) => setFormData(prev => ({ ...prev, startDate: e.target.value }))}
                min={new Date().toISOString().split('T')[0]}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="endDate">Bis</Label>
              <Input
                id="endDate"
                type="date"
                value={formData.endDate}
                onChange={(e) => setFormData(prev => ({ ...prev, endDate: e.target.value }))}
                min={formData.startDate || new Date().toISOString().split('T')[0]}
                required
              />
            </div>
          </div>

          {/* Days calculation */}
          {requestedDays > 0 && (
            <div className="bg-gray-50 p-3 rounded-lg">
              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-1">
                  <Clock className="h-4 w-4" />
                  Beantragte Tage:
                </span>
                <span className={`font-semibold ${
                  formData.type === "vacation" && requestedDays > availableVacationDays 
                    ? "text-red-600" 
                    : "text-green-600"
                }`}>
                  {requestedDays} {requestedDays === 1 ? "Tag" : "Tage"}
                </span>
              </div>
              {formData.type === "vacation" && requestedDays > availableVacationDays && (
                <p className="text-xs text-red-600 mt-1">
                  Nicht genügend Urlaubstage verfügbar
                </p>
              )}
            </div>
          )}

          {/* Reason */}
          <div className="space-y-2">
            <Label htmlFor="reason">
              Begründung {formData.type !== "vacation" && "(erforderlich)"}
            </Label>
            <Textarea
              id="reason"
              value={formData.reason}
              onChange={(e) => setFormData(prev => ({ ...prev, reason: e.target.value }))}
              placeholder={
                formData.type === "vacation" 
                  ? "Optionale Begründung für den Urlaub..." 
                  : "Bitte geben Sie eine Begründung an..."
              }
              rows={3}
              required={formData.type !== "vacation"}
            />
          </div>

          {/* Submit buttons */}
          <div className="flex gap-2 pt-2">
            <Button
              type="submit"
              disabled={loading || !formData.startDate || !formData.endDate}
              className="flex-1"
            >
              {loading ? "Wird eingereicht..." : "Antrag stellen"}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Abbrechen
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}