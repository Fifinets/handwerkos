import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Building2, Users, DollarSign, CheckSquare, Wrench, Mail, FileText, Euro, Clock, Calendar, UserCheck, LucideIcon } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';

/**
 * DashboardStatsWithKpis fetches real data from Supabase and displays
 * the most important KPIs for the company on the dashboard. It replaces
 * the static dashboard cards with dynamic values like number of open
 * projects, active employees and open invoices. An optional callback
 * can be provided to navigate to a module when a card is clicked.
 */
interface DashboardCard {
  title: string;
  description: string;
  icon: LucideIcon;
  buttonText: string;
  onClick?: () => void;
}

interface KPIData {
  openOrders: number;
  unreadEmails: number;
  openQuotes: number;
  openInvoices: number;
  totalOpenAmount: number;
  todayHours: number;
  activeEmployees: { name: string; status: 'active' | 'paused' | 'offline'; hours: number }[];
  todayAppointments: { project: string; time: string; employees: number }[];
  recentEmails: { subject: string; from: string; category: string; time: string }[];
}

const DashboardStatsWithKpis: React.FC<{ onNavigate?: (moduleId: string) => void }> = ({ onNavigate }) => {
  const [kpiData, setKpiData] = useState<KPIData>({
    openOrders: 0,
    unreadEmails: 0,
    openQuotes: 0,
    openInvoices: 0,
    totalOpenAmount: 0,
    todayHours: 0,
    activeEmployees: [],
    todayAppointments: [],
    recentEmails: []
  });
  const [loading, setLoading] = useState(true);
  const [currentUserRole, setCurrentUserRole] = useState<string | null>(null);

  useEffect(() => {
    const loadKpis = async () => {
      try {
        const { data: currentUserProfile } = await supabase.auth.getUser();
        if (!currentUserProfile?.user) return;

        const { data: profile } = await supabase
          .from('profiles')
          .select('company_id')
          .eq('id', currentUserProfile.user.id)
          .single();

        if (!profile?.company_id) return;

        // Fetch user role from user_roles
        const { data: roleRow } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', currentUserProfile.user.id)
          .maybeSingle();
        const role = roleRow?.role || null;
        setCurrentUserRole(role);
        const companyId = profile.company_id;
        const today = new Date().toISOString().split('T')[0];

        // 1. Offene Aufträge
        const { data: ordersData } = await supabase
          .from('projects')
          .select('id, status')
          .eq('company_id', companyId)
          .neq('status', 'abgeschlossen');

        // 2. Ungelesene E-Mails
        const { data: emailsData } = await supabase
          .from('emails')
          .select('id, subject, sender_name, created_at, is_read')
          .eq('company_id', companyId)
          .eq('is_read', false)
          .order('created_at', { ascending: false })
          .limit(5);

        // 3. Offene Angebote
        const { data: quotesData } = await supabase
          .from('quotes')
          .select('id, status')
          .eq('company_id', companyId)
          .eq('status', 'versendet');

        // 4. Offene Rechnungen
        const { data: invoicesData } = await supabase
          .from('invoices')
          .select('id, total_amount')
          .eq('company_id', companyId)
          .eq('status', 'offen');

        // 5. Heutige Arbeitsstunden
        const { data: timeEntriesData } = await supabase
          .from('time_entries')
          .select('start_time, end_time, break_duration')
          .eq('company_id', companyId)
          .gte('start_time', today + 'T00:00:00')
          .lt('start_time', today + 'T23:59:59');

        // 6. Mitarbeiter-Status (nur für Manager)
        interface Employee {
          first_name: string;
          last_name: string;
          status: string;
        }
        let employeesData: Employee[] = [];
        if (role === 'manager') {
          const { data } = await supabase
            .from('employees')
            .select('first_name, last_name, status')
            .eq('company_id', companyId)
            .neq('status', 'eingeladen');
          employeesData = data || [];
        }

        // 7. Heutige Termine
        const { data: appointmentsData } = await supabase
          .from('projects')
          .select('name, start_date')
          .eq('company_id', companyId)
          .gte('start_date', today)
          .lt('start_date', new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0]);

        const totalOpenAmount = invoicesData?.reduce((sum, inv) => sum + (inv.total_amount || 0), 0) || 0;
        interface TimeEntry {
          start_time?: string;
          end_time?: string;
          break_duration?: number;
        }
        const todayMinutes = (timeEntriesData || []).reduce((sum, entry: TimeEntry) => {
          const start = entry.start_time ? new Date(entry.start_time).getTime() : 0;
          const end = entry.end_time ? new Date(entry.end_time).getTime() : 0;
          if (!start || !end) return sum;
          const diffMin = Math.max(0, (end - start) / 60000 - (entry.break_duration || 0));
          return sum + diffMin;
        }, 0);
        
        setKpiData({
          openOrders: ordersData?.length || 0,
          unreadEmails: emailsData?.length || 0,
          openQuotes: quotesData?.length || 0,
          openInvoices: invoicesData?.length || 0,
          totalOpenAmount,
          todayHours: Math.round(todayMinutes / 60 * 10) / 10,
          activeEmployees: employeesData.map((emp) => ({
            name: `${emp.first_name || ''} ${emp.last_name || ''}`.trim(),
            status: emp.status === 'aktiv' ? 'active' : 'offline',
            hours: 0
          })),
          todayAppointments: appointmentsData?.map(apt => ({
            project: apt.name,
            time: format(new Date(apt.start_date), 'HH:mm', { locale: de }),
            employees: 1
          })) || [],
          recentEmails: (emailsData as Array<{subject: string; sender_name: string; created_at: string}>)?.map((email) => ({
            subject: email.subject,
            from: email.sender_name,
            category: 'Allgemein',
            time: format(new Date(email.created_at), 'HH:mm', { locale: de })
          })) || []
        });
      } catch (error) {
        console.error('Fehler beim Laden der KPIs:', error);
      } finally {
        setLoading(false);
      }
    };
    loadKpis();
  }, []);

  return (
    <div className="space-y-6">
      {/* 1. Aktuelle Kennzahlen (KPIs) */}
      <div>
        <h2 className="text-xl font-semibold mb-4">📊 Aktuelle Kennzahlen</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
          <Card className="cursor-pointer hover:bg-muted/50" onClick={() => onNavigate?.('projects')}>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <Wrench className="w-5 h-5 text-blue-600" />
                <span className="font-medium">Offene Aufträge</span>
              </div>
              <p className="text-2xl font-bold text-blue-600">{loading ? '…' : kpiData.openOrders}</p>
              <p className="text-sm text-muted-foreground">in Bearbeitung</p>
            </CardContent>
          </Card>

          <Card className="cursor-pointer hover:bg-muted/50" onClick={() => onNavigate?.('emails')}>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <Mail className="w-5 h-5 text-green-600" />
                <span className="font-medium">Ungelesene E-Mails</span>
              </div>
              <p className="text-2xl font-bold text-green-600">{loading ? '…' : kpiData.unreadEmails}</p>
              <p className="text-sm text-muted-foreground">neue Anfragen</p>
            </CardContent>
          </Card>

          <Card className="cursor-pointer hover:bg-muted/50" onClick={() => onNavigate?.('finance')}>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <FileText className="w-5 h-5 text-orange-600" />
                <span className="font-medium">Offene Angebote</span>
              </div>
              <p className="text-2xl font-bold text-orange-600">{loading ? '…' : kpiData.openQuotes}</p>
              <p className="text-sm text-muted-foreground">versendet</p>
            </CardContent>
          </Card>

          <Card className="cursor-pointer hover:bg-muted/50" onClick={() => onNavigate?.('finance')}>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <Euro className="w-5 h-5 text-red-600" />
                <span className="font-medium">Offene Rechnungen</span>
              </div>
              <p className="text-2xl font-bold text-red-600">{loading ? '…' : kpiData.openInvoices}</p>
              <p className="text-sm text-muted-foreground">{loading ? '' : `${kpiData.totalOpenAmount.toFixed(0)} €`}</p>
            </CardContent>
          </Card>

          <Card className="cursor-pointer hover:bg-muted/50" onClick={() => onNavigate?.('timetracking')}>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <Clock className="w-5 h-5 text-purple-600" />
                <span className="font-medium">Stunden heute</span>
              </div>
              <p className="text-2xl font-bold text-purple-600">{loading ? '…' : kpiData.todayHours}</p>
              <p className="text-sm text-muted-foreground">gearbeitet</p>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* 2. Heute / Nächste Termine */}
      <div>
        <h2 className="text-xl font-semibold mb-4">📅 Heute / Nächste Termine</h2>
        <Card>
          <CardContent className="p-4">
            {loading ? (
              <p className="text-muted-foreground">Lade Termine...</p>
            ) : kpiData.todayAppointments.length === 0 ? (
              <p className="text-muted-foreground">Keine Termine für heute</p>
            ) : (
              <div className="space-y-3">
                {kpiData.todayAppointments.map((appointment, index) => (
                  <div key={index} className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                    <div className="flex items-center gap-3">
                      <Calendar className="w-5 h-5 text-blue-600" />
                      <div>
                        <p className="font-medium">{appointment.project}</p>
                        <p className="text-sm text-muted-foreground">{appointment.time} Uhr ({appointment.employees} Mitarbeiter)</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* 3. Mitarbeiterübersicht & 4. Letzte E-Mails nebeneinander */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {currentUserRole === 'manager' && (
          <div>
            <h2 className="text-lg font-semibold mb-3">👥 Mitarbeiterübersicht</h2>
            <Card>
              <CardContent className="p-3">
                {loading ? (
                  <p className="text-sm text-muted-foreground">Lade Mitarbeiter...</p>
                ) : kpiData.activeEmployees.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Keine aktiven Mitarbeiter</p>
                ) : (
                  <div className="space-y-2">
                    {kpiData.activeEmployees.map((employee, index) => (
                      <div key={index} className="flex items-center justify-between p-2 bg-muted/30 rounded-lg">
                        <div className="flex items-center gap-3">
                          <div className={`w-2.5 h-2.5 rounded-full ${
                            employee.status === 'active' ? 'bg-green-500' :
                            employee.status === 'paused' ? 'bg-yellow-500' : 'bg-red-500'
                          }`} />
                          <span className="font-medium text-sm">{employee.name}</span>
                        </div>
                        <Button variant="outline" size="sm" onClick={() => onNavigate?.('timetracking')}>
                          Zeitbericht
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        <div>
          <h2 className="text-lg font-semibold mb-3">📨 Letzte E-Mails / Kundenanfragen</h2>
          <Card>
            <CardContent className="p-3">
              {loading ? (
                <p className="text-sm text-muted-foreground">Lade E-Mails...</p>
              ) : kpiData.recentEmails.length === 0 ? (
                <p className="text-sm text-muted-foreground">Keine neuen E-Mails</p>
              ) : (
                <div className="space-y-2">
                  {kpiData.recentEmails.map((email, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between p-2 bg-muted/30 rounded-lg hover:bg-muted/50 cursor-pointer"
                      onClick={() => onNavigate?.('emails')}
                    >
                      <div className="flex items-center gap-3">
                        <Mail className="w-4 h-4 text-blue-600" />
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate text-sm">{email.subject}</p>
                          <p className="text-xs text-muted-foreground">von {email.from} • {email.time}</p>
                        </div>
                      </div>
                      <Badge variant={email.category === 'Anfrage' ? 'default' : 'secondary'}>
                        {email.category}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default DashboardStatsWithKpis;
