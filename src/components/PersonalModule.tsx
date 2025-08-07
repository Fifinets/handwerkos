import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { UserCheck, Plus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useSupabaseAuth } from "@/hooks/useSupabaseAuth";

import PersonalStats from "./personal/PersonalStats";
import EmployeeCard from "./personal/EmployeeCard";
import AddEmployeeDialog from "./personal/AddEmployeeDialog";
import EmployeeDetailsDialog from "./personal/EmployeeDetailsDialog";
import EditEmployeeDialog from "./personal/EditEmployeeDialog";
import PersonalSidebar from "./personal/PersonalSidebar";

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
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isAddEmployeeOpen, setIsAddEmployeeOpen] = useState(false);
  const [isAddingEmployee, setIsAddingEmployee] = useState(false);
  const [loading, setLoading] = useState(true);
  const [employees, setEmployees] = useState<Employee[]>([]);

  useEffect(() => {
    if (companyId) {
      fetchEmployees();
    }
  }, [companyId]);

  const fetchEmployees = async () => {
    try {
      setLoading(true);
      
      console.log('fetchEmployees called with companyId:', companyId);
      
      // Check if company ID is available
      if (!companyId) {
        console.error('No company ID available');
        setLoading(false);
        return;
      }
      
      // Fetch employees filtered by company (without qualifications/license for now to avoid column errors)
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
          created_at
        `)
        .eq('company_id', companyId)
        .order('created_at', { ascending: false });

      if (employeesError) {
        console.error('Error fetching employees:', employeesError);
        toast.error(`Fehler beim Laden der Mitarbeiter: ${employeesError.message}`);
        setLoading(false);
        return;
      }

      // Map employee data - set default values for qualifications and license until DB migration runs
      const employeeList = employeesData?.map(employee => ({
        id: employee.id,
        name: `${employee.first_name || ''} ${employee.last_name || ''}`.trim() || employee.email,
        position: employee.position || 'Mitarbeiter',
        email: employee.email,
        phone: employee.phone || '',
        status: employee.status === 'eingeladen' ? 'Eingeladen' : 'Aktiv',
        qualifications: [], // Default empty array until DB is updated
        license: '', // Default empty string until DB is updated
        currentProject: '-',
        hoursThisMonth: 0,
        vacationDays: 25
      })) || [];

      console.log('Loaded employees:', employeeList);

      setEmployees(employeeList);
    } catch (error) {
      console.error('Error in fetchEmployees:', error);
      toast.error(`Ein unerwarteter Fehler ist aufgetreten: ${error instanceof Error ? error.message : 'Unbekannter Fehler'}`);
    } finally {
      setLoading(false);
    }
  };

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

      await fetchEmployees();
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

  const handleSaveEmployee = (editFormData: Partial<Employee>) => {
    if (!selectedEmployee) return;

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
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <UserCheck className="h-6 w-6 text-blue-600" />
            Personalverwaltung
          </h2>
          <p className="text-gray-600">Mitarbeiterdaten und Qualifikationen verwalten</p>
        </div>
      </div>

      <div className="space-y-6">
          <div className="flex justify-end">
            <Button 
              className="bg-blue-600 hover:bg-blue-700"
              onClick={() => setIsAddEmployeeOpen(true)}
            >
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
      </div>

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
