import React, { useState, useEffect, useCallback } from 'react';
import { Button } from "@/components/ui/button";
import { UserCheck, Plus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useSupabaseAuth } from "@/hooks/useSupabaseAuth";
import { useEmployees } from "@/hooks/useApi";
import { useQueryClient } from "@tanstack/react-query";
import { QUERY_KEYS } from "@/hooks/useApi";

import PersonalStats from "./personal/PersonalStats";
import EmployeeCard from "./personal/EmployeeCard";
import AddEmployeeDialog from "./personal/AddEmployeeDialog";
import EmployeeDetailsDialog from "./personal/EmployeeDetailsDialog";
import EditEmployeeDialog from "./personal/EditEmployeeDialog";
import PersonalSidebar from "./personal/PersonalSidebar";
import EmployeeWageManagementSimple from "./EmployeeWageManagementSimple";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface Employee {
  id: string;
  name: string;
  position: string;
  email: string;
  phone: string;
  status: string;
  qualifications: string[];
  license: string;
  currentProject: string;
  hoursThisMonth: number;
  vacationDays: number;
}

interface NewEmployee {
  email: string;
  firstName: string;
  lastName: string;
  position: string;
  phone: string;
  license: string;
  qualifications: string[];
}

const PersonalModule = () => {
  const { toast: showToast } = useToast();
  const { user, session, inviteEmployee, companyId } = useSupabaseAuth();
  const queryClient = useQueryClient();
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isAddEmployeeOpen, setIsAddEmployeeOpen] = useState(false);
  const [isAddingEmployee, setIsAddingEmployee] = useState(false);
  
  // Use the centralized useEmployees hook
  const { data: employeesData, isLoading: loading, error: employeesError } = useEmployees();
  const employees = employeesData?.items || [];

  const fetchEmployees = useCallback(async () => {
    try {
      setLoading(true);
      
      console.log('fetchEmployees called with companyId:', companyId);
      
      // Check if company ID is available
      if (!companyId) {
        console.error('No company ID available');
        setLoading(false);
        return;
      }
      
      // First, let's debug by getting ALL employees for this company
      const { data: allEmployeesData, error: debugError } = await supabase
        .from('employees')
        .select('id, email, status, user_id, company_id')
        .eq('company_id', companyId);
      
      console.log('DEBUG - All employees for company:', allEmployeesData);
      
      // Fetch employees (with qualifications and license if columns exist)
      const { data: employeesData, error: employeesError } = await supabase
        .from('employees')
        .select(`
          id,
          user_id,
          first_name,
          last_name,
          email,
          phone,
          position,
          status,
          company_id,
          created_at,
          qualifications,
          license
        `)
        .eq('company_id', companyId)
        .neq('status', 'eingeladen')
        .not('user_id', 'is', null)
        .order('created_at', { ascending: false });

      if (employeesError) {
        console.error('Error fetching employees:', employeesError);
        toast.error(`Fehler beim Laden der Mitarbeiter: ${employeesError.message}`);
        setLoading(false);
        return;
      }

      // Fetch profile names separately for employees with user_id
      const userIds = employeesData?.filter(emp => emp.user_id).map(emp => emp.user_id) || [];
      let profilesData = [];
      
      if (userIds.length > 0) {
        const { data: profiles, error: profilesError } = await supabase
          .from('profiles')
          .select('id, first_name, last_name')
          .in('id', userIds);
        
        if (!profilesError) {
          profilesData = profiles || [];
        }
      }

      // Map employee data - use profile names if available, fallback to employee names
      const employeeList = employeesData?.map(employee => {
        const profile = profilesData.find(p => p.id === employee.user_id);
        const firstName = profile?.first_name || employee.first_name || '';
        const lastName = profile?.last_name || employee.last_name || '';
        
        return {
          id: employee.id,
          name: `${firstName} ${lastName}`.trim() || employee.email,
          position: employee.position || 'Mitarbeiter',
          email: employee.email,
          phone: employee.phone || '',
          status: employee.status === 'eingeladen' ? 'Eingeladen' : 'Aktiv',
          qualifications: employee.qualifications ? 
            (typeof employee.qualifications === 'string' ? 
              JSON.parse(employee.qualifications) : 
              employee.qualifications
            ) : [],
          license: employee.license || '',
          currentProject: '-',
          hoursThisMonth: 0,
          vacationDays: 25
        };
      }) || [];

      console.log('Loaded employees:', employeeList);

      setEmployees(employeeList);
    } catch (error) {
      console.error('Error in fetchEmployees:', error);
      toast.error(`Ein unerwarteter Fehler ist aufgetreten: ${error instanceof Error ? error.message : 'Unbekannter Fehler'}`);
    } finally {
      setLoading(false);
    }
  }, [companyId, showToast]);

  useEffect(() => {
    if (companyId) {
      fetchEmployees();
    }
  }, [companyId, fetchEmployees]);

  const handleAddEmployee = async (newEmployee: NewEmployee) => {
    setIsAddingEmployee(true);

    try {
      console.log('Creating Supabase employee invitation:', newEmployee);

      // Use pure Supabase invitation
      const inviteResult = await inviteEmployee(newEmployee.email, {
        firstName: newEmployee.firstName,
        lastName: newEmployee.lastName,
        position: newEmployee.position,
        phone: newEmployee.phone,
        license: newEmployee.license,
        qualifications: newEmployee.qualifications
      });
      
      if (!inviteResult.success) {
        console.error('Supabase invitation error:', inviteResult.error);
        toast.error(`Fehler beim Senden der Einladung: ${inviteResult.error}`);
        return;
      }

      toast.success(`Mitarbeiter ${newEmployee.firstName} ${newEmployee.lastName} wurde erfolgreich eingeladen! 
        Eine Einladungs-E-Mail wurde an ${newEmployee.email} gesendet.`);

      // Invalidate React Query cache to refresh all employee lists
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.employees });
      setIsAddEmployeeOpen(false);
    } catch (error) {
      console.error('Unexpected error:', error);
      toast.error('Ein unerwarteter Fehler ist aufgetreten');
    } finally {
      setIsAddingEmployee(false);
    }
  };

  const handleShowDetails = (employee: Employee) => {
    setSelectedEmployee(employee);
    setIsDetailsOpen(true);
  };

  const handleEditEmployee = (employee: Employee) => {
    setSelectedEmployee(employee);
    setIsEditOpen(true);
  };

  const handleSaveEmployee = async (editFormData: Partial<Employee>) => {
    if (!selectedEmployee) return;

    try {
      // Extract first and last name from the full name if needed
      const nameParts = editFormData.name?.split(' ') || [];
      const firstName = nameParts[0] || '';
      const lastName = nameParts.slice(1).join(' ') || '';

      // Update employee in database
      const { error } = await supabase
        .from('employees')
        .update({
          first_name: firstName,
          last_name: lastName,
          position: editFormData.position,
          phone: editFormData.phone,
          status: editFormData.status,
          license: editFormData.license,
          qualifications: (editFormData.qualifications ? JSON.stringify(editFormData.qualifications) : '[]') as string
        })
        .eq('id', selectedEmployee.id);

      if (error) {
        console.error('Error updating employee:', error);
        toast.error(`Fehler beim Aktualisieren: ${error.message}`);
        return;
      }

      // Also update profile if user_id exists
      if (selectedEmployee.id && firstName && lastName) {
        await supabase
          .from('profiles')
          .update({
            first_name: firstName,
            last_name: lastName
          })
          .eq('id', selectedEmployee.id);
      }

      // Update local state
      const updatedEmployee = {
        ...selectedEmployee,
        ...editFormData
      };

      setEmployees(prev => prev.map(emp => 
        emp.id === selectedEmployee.id ? updatedEmployee : emp
      ));

      showToast({
        title: "Erfolg",
        description: "Mitarbeiter wurde erfolgreich aktualisiert."
      });

      setIsEditOpen(false);
      setSelectedEmployee(null);
    } catch (error) {
      console.error('Error saving employee:', error);
      toast.error('Fehler beim Speichern der Mitarbeiteränderungen');
    }
  };

  const handleQuickAction = (action: string) => {
    showToast({
      title: "Info",
      description: `${action} wird geöffnet...`
    });
  };

  const activeEmployees = employees.filter(emp => emp.status === 'Aktiv').length;
  const onVacationEmployees = employees.filter(emp => emp.status === 'Urlaub').length;
  const totalHours = employees.reduce((sum, emp) => sum + emp.hoursThisMonth, 0);

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-4xl font-bold text-gray-900">Personalverwaltung</h1>
      </div>

      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="overview">Mitarbeiterübersicht</TabsTrigger>
          <TabsTrigger value="wages">Stundenlohn-Verwaltung</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div className="flex justify-end">
            <Button onClick={() => setIsAddEmployeeOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Mitarbeiter hinzufügen
            </Button>
          </div>

          <PersonalStats
            totalEmployees={employees.length}
            activeEmployees={activeEmployees}
            onVacationEmployees={onVacationEmployees}
            totalHours={totalHours}
          />

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-4">
              <h3 className="text-lg font-semibold">Mitarbeiterliste</h3>
              {loading ? (
                <div className="text-center p-6">
                  <p className="text-gray-500">Mitarbeiter werden geladen...</p>
                </div>
              ) : employees.length === 0 ? (
                <div className="text-center p-6">
                  <p className="text-gray-500">Noch keine Mitarbeiter vorhanden.</p>
                  <p className="text-sm text-gray-400 mt-2">Klicken Sie auf "Mitarbeiter hinzufügen" um den ersten Mitarbeiter einzuladen.</p>
                </div>
              ) : (
                employees.map((employee) => (
                  <EmployeeCard
                    key={employee.id}
                    employee={employee}
                    onShowDetails={handleShowDetails}
                    onEdit={handleEditEmployee}
                  />
                ))
              )}
            </div>

            <PersonalSidebar onQuickAction={handleQuickAction} />
          </div>
        </TabsContent>

        <TabsContent value="wages">
          <EmployeeWageManagementSimple />
        </TabsContent>
      </Tabs>

      <AddEmployeeDialog
        isOpen={isAddEmployeeOpen}
        onClose={() => setIsAddEmployeeOpen(false)}
        onSubmit={handleAddEmployee}
        isLoading={isAddingEmployee}
      />

      <EmployeeDetailsDialog
        isOpen={isDetailsOpen}
        onClose={() => setIsDetailsOpen(false)}
        employee={selectedEmployee}
      />

      <EditEmployeeDialog
        isOpen={isEditOpen}
        onClose={() => setIsEditOpen(false)}
        employee={selectedEmployee}
        onSave={handleSaveEmployee}
      />
    </div>
  );
};

export default PersonalModule;
