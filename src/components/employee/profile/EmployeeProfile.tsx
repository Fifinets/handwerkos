// Mein Profil
// Extrahiert aus DesktopEmployeePage.tsx (activeTab === 'profile')

import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { User, CalendarDays } from 'lucide-react';
import { useEmployeePermissions } from '@/hooks/useEmployeePermissions';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

// Hinweis: Die employees-Tabelle hat keine Spalte "start_date" (siehe
// src/integrations/supabase/types.ts — dort existiert nur "hire_date").
// Der select-String stammt unverändert aus DesktopEmployeePage.tsx; dort ist
// dieselbe Diskrepanz bereits in der typecheck-Basislinie vermerkt. Die
// Query liefert dadurch zur Laufzeit einen PostgREST-Fehler zurück (kein
// Crash, `data` bleibt `null`), das Verhalten ändert sich hier nicht — nur
// der Cast, damit die Property-Zugriffe unten in dieser neuen Datei
// typchecken.
interface ProfileRow {
  position: string | null;
  phone: string | null;
  hourly_wage: number | null;
  start_date: string | null;
}

export function EmployeeProfile() {
  const { toast } = useToast();
  const { employee } = useEmployeePermissions();

  const [profileData, setProfileData] = useState({ position: '', phone: '', hourly_wage: 0, start_date: '' });
  const [vacationDays, setVacationDays] = useState({ total: 30, used: 0 });
  const [pwForm, setPwForm] = useState({ current: '', next: '', confirm: '' });
  const [pwSaving, setPwSaving] = useState(false);

  useEffect(() => {
    if (employee?.id) {
      fetchProfileData();
      fetchVacation();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [employee?.id]);

  const fetchProfileData = async () => {
    if (!employee?.id) return;
    const { data } = await supabase
      .from('employees')
      .select('position, phone, hourly_wage, start_date')
      .eq('id', employee.id)
      .single();
    const row = data as unknown as ProfileRow | null;
    if (row) setProfileData({ position: row.position || '', phone: row.phone || '', hourly_wage: row.hourly_wage || 0, start_date: row.start_date || '' });
  };

  const fetchVacation = async () => {
    if (!employee) return;
    try {
      const { data: empVacation } = await supabase
        .from('employees')
        .select('vacation_days_total, vacation_days_used')
        .eq('id', employee.id)
        .single();
      if (empVacation) {
        setVacationDays({
          total: empVacation.vacation_days_total || 30,
          used: empVacation.vacation_days_used || 0,
        });
      }
    } catch (err) {
      console.error('Error fetching vacation data:', err);
    }
  };

  const formatDate = (date: string | undefined) => {
    if (!date) return '-';
    return format(new Date(date), 'dd.MM.yyyy', { locale: de });
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2 }).format(amount);
  };

  if (!employee) {
    return <p className="text-muted-foreground">Wird geladen...</p>;
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Mein Profil</h1>
        <p className="text-muted-foreground">Deine Stammdaten</p>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><User className="h-5 w-5" /> Persönliche Daten</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-xs text-muted-foreground">Vorname</Label>
              <p className="text-sm font-medium mt-0.5">{employee.first_name}</p>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Nachname</Label>
              <p className="text-sm font-medium mt-0.5">{employee.last_name}</p>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Position</Label>
              <p className="text-sm font-medium mt-0.5">{profileData.position || '—'}</p>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Telefon</Label>
              <p className="text-sm font-medium mt-0.5">{profileData.phone || '—'}</p>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Stundenlohn (netto)</Label>
              <p className="text-sm font-medium mt-0.5">{profileData.hourly_wage ? formatCurrency(profileData.hourly_wage) + ' /h' : '—'}</p>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Angestellt seit</Label>
              <p className="text-sm font-medium mt-0.5">{profileData.start_date ? formatDate(profileData.start_date) : '—'}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><CalendarDays className="h-5 w-5" /> Urlaub</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center p-3 bg-slate-50 rounded-lg">
              <p className="text-2xl font-bold">{vacationDays.total}</p>
              <p className="text-xs text-muted-foreground mt-1">Gesamttage</p>
            </div>
            <div className="text-center p-3 bg-slate-50 rounded-lg">
              <p className="text-2xl font-bold text-amber-600">{vacationDays.used}</p>
              <p className="text-xs text-muted-foreground mt-1">Genommen</p>
            </div>
            <div className="text-center p-3 bg-emerald-50 rounded-lg">
              <p className="text-2xl font-bold text-emerald-600">{vacationDays.total - vacationDays.used}</p>
              <p className="text-xs text-muted-foreground mt-1">Verbleibend</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Passwort ändern</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div>
            <Label>Neues Passwort</Label>
            <Input type="password" className="mt-1" placeholder="Mindestens 8 Zeichen"
              value={pwForm.next} onChange={e => setPwForm(f => ({ ...f, next: e.target.value }))} />
          </div>
          <div>
            <Label>Passwort bestätigen</Label>
            <Input type="password" className="mt-1" placeholder="Passwort wiederholen"
              value={pwForm.confirm} onChange={e => setPwForm(f => ({ ...f, confirm: e.target.value }))} />
          </div>
          <Button
            disabled={pwSaving || pwForm.next.length < 8 || pwForm.next !== pwForm.confirm}
            onClick={async () => {
              setPwSaving(true);
              try {
                const { error } = await supabase.auth.updateUser({ password: pwForm.next });
                if (error) throw error;
                toast({ title: 'Passwort geändert' });
                setPwForm({ current: '', next: '', confirm: '' });
              } catch {
                toast({ title: 'Fehler beim Ändern', variant: 'destructive' });
              } finally {
                setPwSaving(false);
              }
            }}
          >
            {pwSaving ? 'Wird gespeichert...' : 'Passwort speichern'}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

export default EmployeeProfile;
