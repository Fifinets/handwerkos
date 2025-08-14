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
import { useEmployees } from '@/hooks/useApi';

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
  const [wages, setWages] = useState<EmployeeWage[]>([]);
  const [editingEmployee, setEditingEmployee] = useState<string | null>(null);
  const [editWage, setEditWage] = useState<number>(0);
  const [workingHoursPerWeek, setWorkingHoursPerWeek] = useState<number>(40);

  // Use the working useEmployees hook instead of manual queries
  const { data: employeesResponse, isLoading: loading, error: employeesError } = useEmployees();
  const employees = employeesResponse?.items || [];

  // Debug logging
  console.log('=== WAGE MANAGEMENT DEBUG ===');
  console.log('employeesResponse:', employeesResponse);
  console.log('employees array:', employees);
  console.log('employees length:', employees.length);
  console.log('loading:', loading);
  console.log('error:', employeesError);

  const fetchWorkingHours = async () => {
    try {
      console.log('Fetching company working hours...');
      
      // Get working hours from company settings
      const { data, error } = await supabase
        .from('company_settings')
        .select('default_working_hours_start, default_working_hours_end, default_break_duration')
        .limit(1);

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

  useEffect(() => {
    fetchWorkingHours();
    // Load wages from localStorage
    const savedWages = localStorage.getItem('employeeWages');
    if (savedWages) {
      setWages(JSON.parse(savedWages));
    }
  }, []);

  // Save wages to localStorage whenever wages change
  useEffect(() => {
    localStorage.setItem('employeeWages', JSON.stringify(wages));
  }, [wages]);

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

    // Add new wage if it doesn't exist
    if (!wages.find(w => w.employee_id === employeeId)) {
      updatedWages.push({ employee_id: employeeId, hourly_wage: editWage });
    }

    setWages(updatedWages);
    setEditingEmployee(null);
    setEditWage(0);
    toast.success('Stundenlohn wurde gespeichert');
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center">Lädt Mitarbeiterdaten...</div>
        </CardContent>
      </Card>
    );
  }

  if (employeesError) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center text-red-500">
            Fehler beim Laden der Mitarbeiterdaten: {employeesError.message}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Euro className="h-5 w-5" />
            Mitarbeiter Stundenlohn-Verwaltung (Vereinfacht)
          </CardTitle>
          <CardDescription>
            Verwalten Sie Stundenlöhne Ihrer aktiven Mitarbeiter
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-4 p-3 bg-blue-50 rounded-lg">
            <p className="text-sm text-blue-800">
              📋 <strong>Arbeitszeit werden aus den Firmeneinstellungen berechnet (42.5h/Woche)</strong>
            </p>
            <p className="text-sm text-orange-700 mt-1">
              ⚠️ <strong>Hinweise:</strong> Löhne werden temporär im Browser gespeichert
            </p>
          </div>

          {employees.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              Keine aktiven Mitarbeiter gefunden
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>
                    <User className="h-4 w-4 inline mr-2" />
                    Mitarbeiter
                  </TableHead>
                  <TableHead>
                    <Mail className="h-4 w-4 inline mr-2" />
                    E-Mail
                  </TableHead>
                  <TableHead>
                    <Briefcase className="h-4 w-4 inline mr-2" />
                    Position
                  </TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>
                    <Euro className="h-4 w-4 inline mr-2" />
                    Stundenlohn
                  </TableHead>
                  <TableHead>Wochenlohn (ca.)</TableHead>
                  <TableHead>Aktionen</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {employees.map((employee) => {
                  const currentWage = getEmployeeWage(employee.id);
                  const weeklyWage = currentWage * workingHoursPerWeek;
                  const isEditing = editingEmployee === employee.id;

                  return (
                    <TableRow key={employee.id}>
                      <TableCell>
                        <div>
                          <div className="font-medium">
                            {employee.first_name} {employee.last_name}
                          </div>
                          {employee.phone && (
                            <div className="text-sm text-gray-500 flex items-center gap-1">
                              <Phone className="h-3 w-3" />
                              {employee.phone}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>{employee.email}</TableCell>
                      <TableCell>{employee.position || '-'}</TableCell>
                      <TableCell>
                        <Badge variant={employee.status === 'Aktiv' ? 'default' : 'secondary'}>
                          {employee.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {isEditing ? (
                          <div className="flex items-center gap-2">
                            <Input
                              type="number"
                              step="0.50"
                              min="0"
                              value={editWage}
                              onChange={(e) => setEditWage(parseFloat(e.target.value) || 0)}
                              className="w-20"
                            />
                            <span className="text-sm">€/h</span>
                          </div>
                        ) : (
                          <div className="font-mono">
                            {currentWage > 0 ? `€${currentWage.toFixed(2)}/h` : 'Nicht festgelegt'}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="font-mono text-green-600">
                          {weeklyWage > 0 ? `€${weeklyWage.toFixed(2)}` : '-'}
                        </div>
                        {weeklyWage > 0 && (
                          <div className="text-xs text-gray-500">
                            bei {workingHoursPerWeek}h/Woche
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        {isEditing ? (
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
                  );
                })}
              </TableBody>
            </Table>
          )}

          {employees.length > 0 && (
            <div className="mt-6 p-4 bg-gray-50 rounded-lg">
              <div className="text-sm text-gray-600">
                <strong>Erfolgreich angemeldelt:</strong>
              </div>
              <div className="mt-2 text-sm">
                💼 <strong>{employees.length}</strong> Mitarbeiter geladen
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}