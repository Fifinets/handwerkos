
import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { UserCheck, Plus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
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
  const { user } = useAuth();
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isAddEmployeeOpen, setIsAddEmployeeOpen] = useState(false);
  const [isAddingEmployee, setIsAddingEmployee] = useState(false);
  const [loading, setLoading] = useState(true);
  const [employees, setEmployees] = useState<Employee[]>([]);

  useEffect(() => {
    fetchEmployees();
  }, []);

  const fetchEmployees = async () => {
    try {
      setLoading(true);
      console.log('Fetching employees...');

      // Fetch profiles with employee role using a proper join
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select(`
          id,
          email,
          first_name,
          last_name
        `);

      if (profilesError) {
        console.error('Error fetching profiles:', profilesError);
        toast.error('Fehler beim Laden der Profile');
        return;
      }

      console.log('Profiles data:', profilesData);

      // Now fetch user roles separately and filter for employees
      const { data: rolesData, error: rolesError } = await supabase
        .from('user_roles')
        .select('user_id, role')
        .eq('role', 'employee');

      if (rolesError) {
        console.error('Error fetching roles:', rolesError);
        toast.error('Fehler beim Laden der Rollen');
        return;
      }

      console.log('Roles data:', rolesData);

      // Filter profiles to only include employees
      const employeeIds = rolesData?.map(role => role.user_id) || [];
      const employeeProfiles = profilesData?.filter(profile => 
        employeeIds.includes(profile.id)
      ) || [];

      // Transform the data to match the expected format
      const employeeList = employeeProfiles.map(profile => ({
        id: profile.id,
        name: `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || profile.email,
        position: 'Mitarbeiter', // Default position, could be stored in profiles later
        email: profile.email,
        phone: '', // Could be added to profiles table later
        status: 'Aktiv',
        qualifications: [],
        license: '',
        currentProject: '-',
        hoursThisMonth: 0,
        vacationDays: 25
      }));

      setEmployees(employeeList);
      console.log('Loaded employees:', employeeList);

    } catch (error) {
      console.error('Error in fetchEmployees:', error);
      toast.error('Ein unerwarteter Fehler ist aufgetreten');
    } finally {
      setLoading(false);
    }
  };

  const handleAddEmployee = async (newEmployee: NewEmployee) => {
    setIsAddingEmployee(true);

    try {
      console.log('Inviting employee via edge function:', newEmployee.email);

      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('company_id')
        .eq('id', user?.id)
        .single();

      if (profileError || !profile?.company_id) {
        console.error('Error fetching company_id:', profileError);
        toast.error('Konnte Unternehmens-ID nicht abrufen');
        return;
      }

      const { data: inviteData, error } = await supabase.functions.invoke('invite-employee', {
        body: {
          email: newEmployee.email,
          first_name: newEmployee.firstName,
          last_name: newEmployee.lastName,
          company_id: profile.company_id
        }
      });

      if (error) {
        console.error('Invite error:', error);
        toast.error(`Fehler beim Erstellen des Mitarbeiters: ${error.message}`);
        return;
      }

      if (!inviteData?.invite_link) {
        toast.error('Kein Einladungslink erhalten');
        return;
      }

      console.log('Inviting employee via edge function:', newEmployee.email);

      try {
        const { error: emailError } = await supabase.functions.invoke('send-employee-confirmation', {
          body: {
            managerEmail: user?.email || '',
            employeeName: `${newEmployee.firstName} ${newEmployee.lastName}`.trim(),
            employeeEmail: newEmployee.email,
            companyName: 'Ihr Unternehmen',
            registrationUrl: inviteData?.invite_link
          }
        });

        if (emailError) {
          console.error('Email sending error:', emailError);
        } else {
          console.log('Confirmation email sent successfully');
        }
      } catch (emailErr) {
        console.error('Email function error:', emailErr);
      }

      toast.success('Mitarbeiter erfolgreich erstellt! Der Mitarbeiter erhält eine E-Mail zur Bestätigung und Sie erhalten eine Bestätigungsmail.');
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

  const handleSaveEmployee = (editFormData: Record<string, unknown>) => {
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
        {/* Employee List */}
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

        {/* Sidebar */}
        <PersonalSidebar onQuickAction={handleQuickAction} />
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
