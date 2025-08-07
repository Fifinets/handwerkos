import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Building2, Users, DollarSign, CheckSquare } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

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
  icon: any;
  buttonText: string;
  onClick?: () => void;
}

const DashboardStatsWithKpis: React.FC<{ onNavigate?: (moduleId: string) => void }> = ({ onNavigate }) => {
  const [openProjects, setOpenProjects] = useState(0);
  const [activeEmployees, setActiveEmployees] = useState(0);
  const [openInvoices, setOpenInvoices] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadKpis = async () => {
      // Open projects: status not 'abgeschlossen'
      const { data: projectData, error: projectError } = await supabase
        .from('projects')
        .select('status');
      if (!projectError && projectData) {
        setOpenProjects(projectData.filter((p) => p.status !== 'abgeschlossen').length);
      }
      // Active employees (only registered employees from same company)
      const { data: currentUserProfile } = await supabase.auth.getUser();
      if (currentUserProfile?.user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('company_id')
          .eq('id', currentUserProfile.user.id)
          .single();

        if (profile?.company_id) {
          const { data: employeeData, error: employeeError } = await supabase
            .from('employees')
            .select('id')
            .eq('company_id', profile.company_id)
            .neq('status', 'eingeladen')
            .not('user_id', 'is', null);
          
          if (!employeeError && employeeData) {
            setActiveEmployees(employeeData.length);
          }
        }
      }
      // Open invoices (status == 'offen')
      const { data: invoiceData, error: invoiceError } = await supabase
        .from('invoices')
        .select('id')
        .eq('status', 'offen');
      if (!invoiceError && invoiceData) {
        setOpenInvoices(invoiceData.length);
      }
      setLoading(false);
    };
    loadKpis();
  }, []);

  const cards: DashboardCard[] = [
    {
      title: 'Aktive Projekte',
      description: loading ? '…' : `${openProjects} laufende Projekte`,
      icon: Building2,
      buttonText: 'Projekte',
      onClick: () => onNavigate?.('projects'),
    },
    {
      title: 'Auslastung',
      description: loading ? '…' : `${activeEmployees} aktive Mitarbeiter`,
      icon: Users,
      buttonText: 'Mitarbeiter',
      onClick: () => onNavigate?.('employees'),
    },
    {
      title: 'Offene Rechnungen',
      description: loading ? '…' : `${openInvoices} offen`,
      icon: DollarSign,
      buttonText: 'Buchhaltung',
      onClick: () => onNavigate?.('finance'),
    },
    {
      title: 'Neue Aufgabe',
      description: 'Leg eine Aufgabe oder einen Zeitstempel an',
      icon: CheckSquare,
      buttonText: 'Aufgabe',
      onClick: () => onNavigate?.('tasks'),
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((card) => (
        <Card
          key={card.title}
          className="flex flex-col justify-between cursor-pointer"
          onClick={card.onClick}
        >
          <CardHeader className="flex flex-row items-center gap-3">
            <card.icon className="w-6 h-6 text-blue-500" />
            <CardTitle>{card.title}</CardTitle>
          </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-600 mb-4">{card.description}</p>
              <Button variant="outline" className="w-full">
                {card.buttonText}
              </Button>
            </CardContent>
        </Card>
      ))}
    </div>
  );
};

export default DashboardStatsWithKpis;
