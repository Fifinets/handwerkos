import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DollarSign,
  Euro,
  Edit,
  Save,
  X,
  User,
  Mail,
  Phone,
  Briefcase,
  Clock,
  Calculator
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface Employee {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone?: string;
  hourly_wage: number;
  position?: string;
  status: string;
}

export default function EmployeeWageManagement() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({
    hourly_wage: 0,
    position: ''
  });

  const fetchEmployees = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('employees')
        .select('*')
        .eq('status', 'aktiv')
        .order('first_name', { ascending: true });

      if (error) throw error;

      if (data) {
        setEmployees(data);
      }
    } catch (error) {
      console.error('Error fetching employees:', error);
      toast.error('Fehler beim Laden der Mitarbeiterdaten');
    } finally {
      setLoading(false);
    }
  };

  const updateEmployeeWage = async (employeeId: string, updates: Partial<Employee>) => {
    try {
      const { error } = await supabase
        .from('employees')
        .update(updates)
        .eq('id', employeeId);

      if (error) throw error;

      await fetchEmployees();
      toast.success('Mitarbeiterdaten erfolgreich aktualisiert');
      setEditingEmployee(null);
    } catch (error) {
      console.error('Error updating employee:', error);
      toast.error('Fehler beim Aktualisieren der Mitarbeiterdaten');
    }
  };

  const startEditing = (employee: Employee) => {
    setEditingEmployee(employee.id);
    setEditForm({
      hourly_wage: employee.hourly_wage || 0,
      position: employee.position || ''
    });
  };

  const cancelEditing = () => {
    setEditingEmployee(null);
    setEditForm({
      hourly_wage: 0,
      position: ''
    });
  };

  const saveChanges = async () => {
    if (!editingEmployee) return;

    await updateEmployeeWage(editingEmployee, {
      hourly_wage: editForm.hourly_wage,
      position: editForm.position
    });
  };

  const calculateMonthlyWage = (hourlyWage: number, hoursPerWeek: number = 40) => {
    const monthlyHours = hoursPerWeek * 4.33; // Average weeks per month
    return hourlyWage * monthlyHours;
  };

  const calculateYearlyWage = (hourlyWage: number, hoursPerWeek: number = 40) => {
    const yearlyHours = hoursPerWeek * 52; // 52 weeks per year
    return hourlyWage * yearlyHours;
  };

  useEffect(() => {
    fetchEmployees();
  }, []);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Euro className="h-5 w-5" />
            Mitarbeiter Stundenlohn-Verwaltung
          </CardTitle>
          <CardDescription>
            Verwalten Sie Stundenlöhne und Positionen Ihrer aktiven Mitarbeiter
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Mitarbeiter</TableHead>
                  <TableHead>Position</TableHead>
                  <TableHead>Stundenlohn</TableHead>
                  <TableHead>Monatslohn (40h/Woche)</TableHead>
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
                        <div className="font-medium flex items-center gap-2">
                          <User className="h-4 w-4" />
                          {employee.first_name} {employee.last_name}
                        </div>
                        <div className="text-sm text-muted-foreground flex items-center gap-1">
                          <Mail className="h-3 w-3" />
                          {employee.email}
                        </div>
                        {employee.phone && (
                          <div className="text-sm text-muted-foreground flex items-center gap-1">
                            <Phone className="h-3 w-3" />
                            {employee.phone}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    
                    <TableCell>
                      {editingEmployee === employee.id ? (
                        <div className="space-y-2 min-w-[200px]">
                          <Input
                            placeholder="Position"
                            value={editForm.position}
                            onChange={(e) => setEditForm(prev => ({ ...prev, position: e.target.value }))}
                          />
                        </div>
                      ) : (
                        <div className="space-y-1">
                          {employee.position && (
                            <div className="flex items-center gap-1">
                              <Briefcase className="h-3 w-3" />
                              <span className="text-sm font-medium">{employee.position}</span>
                            </div>
                          )}
                        </div>
                      )}
                    </TableCell>

                    <TableCell>
                      {editingEmployee === employee.id ? (
                        <div className="flex items-center gap-2">
                          <Input
                            type="number"
                            step="0.50"
                            min="0"
                            value={editForm.hourly_wage}
                            onChange={(e) => setEditForm(prev => ({ ...prev, hourly_wage: parseFloat(e.target.value) || 0 }))}
                            className="w-24"
                          />
                          <span className="text-sm">€/h</span>
                        </div>
                      ) : (
                        <div className="font-medium">
                          €{employee.hourly_wage?.toFixed(2) || '0.00'}/h
                        </div>
                      )}
                    </TableCell>

                    <TableCell>
                      <div className="text-sm">
                        €{calculateMonthlyWage(employee.hourly_wage || 0).toLocaleString('de-DE', { 
                          minimumFractionDigits: 0,
                          maximumFractionDigits: 0 
                        })}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        (173.2h/Monat)
                      </div>
                    </TableCell>

                    <TableCell>
                      <div className="text-sm font-medium">
                        €{calculateYearlyWage(employee.hourly_wage || 0).toLocaleString('de-DE', {
                          minimumFractionDigits: 0,
                          maximumFractionDigits: 0 
                        })}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        (2080h/Jahr)
                      </div>
                    </TableCell>

                    <TableCell>
                      <Badge 
                        variant={employee.status === 'active' ? 'default' : 'secondary'}
                      >
                        {employee.status === 'active' ? 'Aktiv' : 'Inaktiv'}
                      </Badge>
                    </TableCell>

                    <TableCell>
                      {editingEmployee === employee.id ? (
                        <div className="flex items-center gap-1">
                          <Button
                            size="sm"
                            onClick={saveChanges}
                            disabled={loading}
                          >
                            <Save className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={cancelEditing}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => startEditing(employee)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {employees.length === 0 && !loading && (
            <div className="text-center py-8 text-muted-foreground">
              <User className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>Keine Mitarbeiter gefunden</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Wage Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Calculator className="h-4 w-4" />
              Durchschnittslohn
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              €{employees.length > 0 ? 
                (employees.reduce((sum, emp) => sum + (emp.hourly_wage || 0), 0) / employees.length).toFixed(2) : 
                '0.00'
              }/h
            </div>
            <p className="text-xs text-muted-foreground">
              Durchschnittlicher Stundenlohn
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Euro className="h-4 w-4" />
              Gesamte Lohnkosten/Monat
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              €{employees.reduce((sum, emp) => sum + calculateMonthlyWage(emp.hourly_wage || 0), 0).toLocaleString('de-DE', {
                minimumFractionDigits: 0,
                maximumFractionDigits: 0 
              })}
            </div>
            <p className="text-xs text-muted-foreground">
              Bei 40h/Woche pro Mitarbeiter
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Aktive Mitarbeiter
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {employees.filter(emp => emp.status === 'active').length}
            </div>
            <p className="text-xs text-muted-foreground">
              Von {employees.length} Mitarbeitern
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}