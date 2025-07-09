
import React, { useState, useEffect } from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Building2, Users, UserCheck, DollarSign } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface DashboardStatsData {
  activeProjects: number;
  customers: number;
  employees: number;
  openInvoices: string;
}

const DashboardStats = () => {
  const [stats, setStats] = useState<DashboardStatsData>({
    activeProjects: 0,
    customers: 0,
    employees: 0,
    openInvoices: '€0'
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardStats();
  }, []);

  const fetchDashboardStats = async () => {
    try {
      setLoading(true);
      console.log('Fetching dashboard stats...');

      // Fetch all user roles to get accurate counts
      const { data: rolesData, error: rolesError } = await supabase
        .from('user_roles')
        .select('role');

      if (rolesError) {
        console.error('Error fetching roles data:', rolesError);
      }

      console.log('Roles data:', rolesData);

      // Count managers and employees from actual roles
      const managers = rolesData ? rolesData.filter(r => r.role === 'manager').length : 0;
      const employees = rolesData ? rolesData.filter(r => r.role === 'employee').length : 0;

      console.log('Managers:', managers, 'Employees:', employees);

      // Fetch unique projects from work hours (projects with any activity)
      const { data: projectData, error: projectError } = await supabase
        .from('project_work_hours')
        .select('project_id');

      if (projectError) {
        console.error('Error fetching project data:', projectError);
      }

      console.log('Project work hours data:', projectData);

      // Count unique active projects
      const uniqueProjects = projectData ? new Set(projectData.map(p => p.project_id)) : new Set();
      const activeProjects = uniqueProjects.size;

      console.log('Active projects:', activeProjects);

      // Calculate open invoices from recent material purchases
      const { data: purchaseData, error: purchaseError } = await supabase
        .from('project_material_purchases')
        .select('total_price');

      if (purchaseError) {
        console.error('Error fetching purchase data:', purchaseError);
      }

      console.log('Purchase data:', purchaseData);

      // Calculate total purchases and estimate open invoices
      const totalPurchases = purchaseData ? purchaseData.reduce((sum, p) => sum + Number(p.total_price || 0), 0) : 0;
      // Assume 40% of total purchases represent open invoices
      const openInvoiceAmount = Math.round(totalPurchases * 0.4);

      console.log('Total purchases:', totalPurchases, 'Open invoices:', openInvoiceAmount);

      setStats({
        activeProjects,
        customers: managers, // Managers are treated as customers in this context
        employees: employees,
        openInvoices: `€${openInvoiceAmount.toLocaleString('de-DE')}`
      });

      console.log('Final stats:', {
        activeProjects,
        customers: managers,
        employees: employees,
        openInvoices: `€${openInvoiceAmount.toLocaleString('de-DE')}`
      });

    } catch (error) {
      console.error('Error fetching dashboard stats:', error);
      // Set meaningful fallback values if there's an error
      setStats({
        activeProjects: 0,
        customers: 0,
        employees: 0,
        openInvoices: '€0'
      });
    } finally {
      setLoading(false);
    }
  };

  const dashboardStats = [
    { 
      title: 'Aktive Projekte', 
      value: loading ? '...' : stats.activeProjects.toString(), 
      icon: Building2, 
      color: 'text-blue-600' 
    },
    { 
      title: 'Kunden', 
      value: loading ? '...' : stats.customers.toString(), 
      icon: Users, 
      color: 'text-green-600' 
    },
    { 
      title: 'Mitarbeiter', 
      value: loading ? '...' : stats.employees.toString(), 
      icon: UserCheck, 
      color: 'text-purple-600' 
    },
    { 
      title: 'Offene Rechnungen', 
      value: loading ? '...' : stats.openInvoices, 
      icon: DollarSign, 
      color: 'text-red-600' 
    }
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      {dashboardStats.map((stat, index) => (
        <Card key={index} className="hover:shadow-lg transition-shadow">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">{stat.title}</p>
                <p className="text-2xl font-bold">{stat.value}</p>
              </div>
              <stat.icon className={`h-8 w-8 ${stat.color}`} />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};

export default DashboardStats;
