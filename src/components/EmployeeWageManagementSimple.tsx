import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Euro,
  Edit,
  Save,
  X,
  User,
  Mail,
  Phone,
  Briefcase,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface Employee {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone?: string;
  position?: string;
  status: string;
}

// Simple wage data that we'll store separately or in localStorage for demo
interface EmployeeWage {
  employee_id: string;
  hourly_wage: number;
}

export default function EmployeeWageManagementSimple() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [wages, setWages] = useState<EmployeeWage[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<string | null>(null);
  const [editWage, setEditWage] = useState<number>(0);
  const [workingHoursPerWeek, setWorkingHoursPerWeek] = useState<number>(40);

  const fetchWorkingHours = async () => {
    try {
      console.log('Fetching company working hours...');
      const { data, error } = await supabase
        .from('company_settings')
        .select('default_working_hours_start, default_working_hours_end, default_break_duration')
        .limit(1)
        .maybeSingle();

      if (error) {
        console.error('Error fetching working hours:', error);
        return;
      }

      if (data) {
        console.log('Working hours data:', data);
        // Calculate working hours per day
        const startTime = data.default_working_hours_start || '08:00';
        const endTime = data.default_working_hours_end || '17:00';
        const breakDuration = data.default_break_duration || 60; // minutes

        const [startHour, startMinute] = startTime.split(':').map(Number);
        const [endHour, endMinute] = endTime.split(':').map(Number);

        const startMinutes = startHour * 60 + startMinute;
        const endMinutes = endHour * 60 + endMinute;
        
        const workMinutesPerDay = (endMinutes - startMinutes) - breakDuration;
        const workHoursPerDay = workMinutesPerDay / 60;
        const workHoursPerWeek = workHoursPerDay * 5; // 5 Arbeitstage

        console.log(`Calculated: ${workHoursPerDay}h/Tag, ${workHoursPerWeek}h/Woche`);
        setWorkingHoursPerWeek(workHoursPerWeek);
      }
    } catch (error: any) {
      console.error('Error calculating working hours:', error);
      // Fallback to 40 hours
      setWorkingHoursPerWeek(40);
    }
  };

  const fetchEmployees = async () => {
    setLoading(true);
    try {
      console.log('Fetching employees...');
      
      // Get current user session to determine company_id
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        console.log('No session found');
        setLoading(false);
        return;
      }

      // Try multiple ways to get company_id
      const companyId = session.user.user_metadata?.company_id || 
                       session.user.app_metadata?.company_id || 
                       session.user.id;
      
      console.log('Using company_id:', companyId);

      if (!companyId) {
        console.error('No company ID available');
        setLoading(false);
        return;
      }
      
      // Fetch working hours first
      await fetchWorkingHours();
      
      // First check what status values exist
      const { data: debugData } = await supabase
        .from('employees')
        .select('id, first_name, last_name, status')
        .eq('company_id', companyId);
      
      console.log('=== EMPLOYEE STATUS DEBUG ===');
      debugData?.forEach(emp => {
        console.log(`Employee: ${emp.first_name} ${emp.last_name}, Status: "${emp.status}" (type: ${typeof emp.status})`);
      });

      const { data, error } = await supabase
        .from('employees')
        .select('id, first_name, last_name, email, phone, position, status')
        .eq('company_id', companyId)
        .order('first_name', { ascending: true });

      console.log('Employees result:', { data, error });

      if (error) {
        throw error;
      }

      if (data) {
        setEmployees(data);
        // Load wages from localStorage or initialize with 0
        const savedWages = localStorage.getItem('employee_wages');
        if (savedWages) {
          setWages(JSON.parse(savedWages));
        } else {
          // Initialize with 0 wage for all employees
          const initialWages = data.map(emp => ({
            employee_id: emp.id,
            hourly_wage: 0
          }));
          setWages(initialWages);
          localStorage.setItem('employee_wages', JSON.stringify(initialWages));
        }
      }
    } catch (error: any) {
      console.error('Error fetching employees:', error);
      toast.error('Fehler beim Laden der Mitarbeiterdaten: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEmployees();
  }, []);

  const getEmployeeWage = (employeeId: string): number => {
    const wage = wages.find(w => w.employee_id === employeeId);
    return wage?.hourly_wage || 0;
  };

  const startEditing = (employee: Employee) => {
    setEditingEmployee(employee.id);
    setEditWage(getEmployeeWage(employee.id));
  };

  const cancelEditing = () => {
    setEditingEmployee(null);
    setEditWage(0);
  };

  const saveWage = (employeeId: string) => {
    const updatedWages = wages.map(w => 
      w.employee_id === employeeId 
        ? { ...w, hourly_wage: editWage }
        : w
    );
    
    // If employee wage doesn't exist, add it
    if (!wages.find(w => w.employee_id === employeeId)) {
      updatedWages.push({
        employee_id: employeeId,
        hourly_wage: editWage
      });
    }
    
    setWages(updatedWages);
    localStorage.setItem('employee_wages', JSON.stringify(updatedWages));
    
    setEditingEmployee(null);
    setEditWage(0);
    
    toast.success('Stundenlohn wurde gespeichert');
  };

  const calculateMonthlyWage = (hourlyWage: number) => {
    const monthlyHours = workingHoursPerWeek * 4.33; // 4.33 Wochen pro Monat
    return hourlyWage * monthlyHours;
  };

  const calculateYearlyWage = (hourlyWage: number) => {
    const yearlyHours = workingHoursPerWeek * 52; // 52 Wochen pro Jahr
    return hourlyWage * yearlyHours;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-muted-foreground">Lade Mitarbeiterdaten...</div>
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Euro className="h-5 w-5" />
          Mitarbeiter Stundenlohn-Verwaltung (Vereinfacht)
        </CardTitle>
        <CardDescription>
          Verwalten Sie Stundenlöhne Ihrer aktiven Mitarbeiter
          <br />
          <small className="text-blue-600">
            📊 Arbeitszeiten werden aus den Firmeneinstellungen berechnet ({workingHoursPerWeek}h/Woche)
          </small>
          <br />
          <small className="text-yellow-600">
            ⚠️ Hinweis: Löhne werden temporär im Browser gespeichert
          </small>
        </CardDescription>
      </CardHeader>
      <CardContent>
        {employees.length === 0 ? (
          <div className="text-center p-6">
            <p className="text-muted-foreground">Keine aktiven Mitarbeiter gefunden</p>
          </div>
        ) : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Mitarbeiter</TableHead>
                  <TableHead>Position</TableHead>
                  <TableHead>Stundenlohn</TableHead>
                  <TableHead>Monatslohn ({workingHoursPerWeek}h/Woche)</TableHead>
                  <TableHead>Jahreslohn</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Aktionen</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {employees.map((employee) => (
                  <TableRow key={employee.id}>
                    <TableCell>
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4" />
                          <span className="font-medium">
                            {employee.first_name} {employee.last_name}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Mail className="h-3 w-3" />
                          <span>{employee.email}</span>
                        </div>
                        {employee.phone && (
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Phone className="h-3 w-3" />
                            <span>{employee.phone}</span>
                          </div>
                        )}
                      </div>
                    </TableCell>
                    
                    <TableCell>
                      {employee.position && (
                        <div className="flex items-center gap-1">
                          <Briefcase className="h-3 w-3" />
                          <span className="text-sm font-medium">{employee.position}</span>
                        </div>
                      )}
                    </TableCell>

                    <TableCell>
                      {editingEmployee === employee.id ? (
                        <div className="flex items-center gap-2">
                          <Input
                            type="number"
                            value={editWage}
                            onChange={(e) => setEditWage(Number(e.target.value))}
                            className="w-24"
                            step="0.50"
                            min="0"
                          />
                          <span className="text-sm">€/h</span>
                        </div>
                      ) : (
                        <div className="font-medium">
                          {getEmployeeWage(employee.id).toFixed(2)} €/h
                        </div>
                      )}
                    </TableCell>

                    <TableCell>
                      <div className="font-medium">
                        {calculateMonthlyWage(getEmployeeWage(employee.id)).toLocaleString('de-DE', {
                          style: 'currency',
                          currency: 'EUR'
                        })}
                      </div>
                    </TableCell>

                    <TableCell>
                      <div className="font-medium">
                        {calculateYearlyWage(getEmployeeWage(employee.id)).toLocaleString('de-DE', {
                          style: 'currency',
                          currency: 'EUR'
                        })}
                      </div>
                    </TableCell>

                    <TableCell>
                      <Badge variant="outline" className="bg-green-50 text-green-700">
                        {employee.status}
                      </Badge>
                    </TableCell>

                    <TableCell>
                      {editingEmployee === employee.id ? (
                        <div className="flex gap-1">
                          <Button
                            size="sm"
                            onClick={() => saveWage(employee.id)}
                            className="h-8 w-8 p-0"
                          >
                            <Save className="h-3 w-3" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={cancelEditing}
                            className="h-8 w-8 p-0"
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => startEditing(employee)}
                          className="h-8 w-8 p-0"
                        >
                          <Edit className="h-3 w-3" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}