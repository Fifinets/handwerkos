import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { UserCheck, Calendar, Clock, GraduationCap, Car, Shield, Plus, Mail, Phone, MapPin, Edit } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const PersonalModule = () => {
  const { toast: showToast } = useToast();
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isAddEmployeeOpen, setIsAddEmployeeOpen] = useState(false);
  const [isAddingEmployee, setIsAddingEmployee] = useState(false);
  const [loading, setLoading] = useState(true);

  const [newEmployee, setNewEmployee] = useState({
    email: '',
    firstName: '',
    lastName: '',
    position: '',
    phone: '',
    license: ''
  });

  const [employees, setEmployees] = useState([]);

  const [editFormData, setEditFormData] = useState({
    name: '',
    position: '',
    email: '',
    phone: '',
    status: 'Aktiv',
    license: '',
    currentProject: '',
    hoursThisMonth: 0,
    vacationDays: 0
  });

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

  const upcomingTraining = [
    { employee: 'Keine Schulungen geplant', training: '', date: '', type: 'Info' }
  ];

  const handleAddEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsAddingEmployee(true);

    try {
      console.log('Attempting to register employee with:', newEmployee.email);
      
      // Use normal signUp instead of admin.inviteUserByEmail
      const { data, error } = await supabase.auth.signUp({
        email: newEmployee.email,
        password: 'temp-password-123!', // Temporary password - user will be asked to change it
        options: {
          emailRedirectTo: `${window.location.origin}/auth`,
          data: {
            first_name: newEmployee.firstName,
            last_name: newEmployee.lastName
          }
        }
      });

      if (error) {
        console.error('SignUp error:', error);
        toast.error(`Fehler beim Erstellen des Mitarbeiters: ${error.message}`);
        return;
      }

      if (data.user) {
        console.log('User created successfully:', data.user.id);
        
        // Update the user role to 'employee' (it defaults to 'manager' from the trigger)
        const { error: roleError } = await supabase
          .from('user_roles')
          .update({ role: 'employee' })
          .eq('user_id', data.user.id);

        if (roleError) {
          console.error('Role update error:', roleError);
          toast.error('Mitarbeiter erstellt, aber Rolle konnte nicht gesetzt werden');
        } else {
          console.log('Role updated to employee successfully');
          toast.success('Mitarbeiter erfolgreich erstellt! Der Mitarbeiter erhält eine E-Mail zur Bestätigung.');
          
          // Refresh the employee list
          await fetchEmployees();
          
          setNewEmployee({ email: '', firstName: '', lastName: '', position: '', phone: '', license: '' });
          setIsAddEmployeeOpen(false);
        }
      }
    } catch (error) {
      console.error('Unexpected error:', error);
      toast.error('Ein unerwarteter Fehler ist aufgetreten');
    } finally {
      setIsAddingEmployee(false);
    }
  };

  const handleNewEmployeeChange = (field: string, value: string) => {
    setNewEmployee(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Aktiv': return 'bg-green-100 text-green-800';
      case 'Urlaub': return 'bg-yellow-100 text-yellow-800';
      case 'Krank': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getTrainingTypeColor = (type: string) => {
    switch (type) {
      case 'Pflicht': return 'bg-red-100 text-red-800';
      case 'Weiterbildung': return 'bg-blue-100 text-blue-800';
      case 'Info': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('');
  };

  const handleShowDetails = (employee) => {
    setSelectedEmployee(employee);
    setIsDetailsOpen(true);
  };

  const handleEditEmployee = (employee) => {
    setSelectedEmployee(employee);
    setEditFormData({
      name: employee.name,
      position: employee.position,
      email: employee.email,
      phone: employee.phone,
      status: employee.status,
      license: employee.license,
      currentProject: employee.currentProject,
      hoursThisMonth: employee.hoursThisMonth,
      vacationDays: employee.vacationDays
    });
    setIsEditOpen(true);
  };

  const handleSaveEmployee = (e: React.FormEvent) => {
    e.preventDefault();
    
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

  const handleInputChange = (field: string, value: string | number) => {
    setEditFormData(prev => ({
      ...prev,
      [field]: value
    }));
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
        <Dialog open={isAddEmployeeOpen} onOpenChange={setIsAddEmployeeOpen}>
          <DialogTrigger asChild>
            <Button className="bg-blue-600 hover:bg-blue-700">
              <Plus className="h-4 w-4 mr-2" />
              Mitarbeiter hinzufügen
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Neuen Mitarbeiter erstellen</DialogTitle>
              <DialogDescription>
                Erstelle einen neuen Mitarbeiter. Der Mitarbeiter erhält eine E-Mail zur Bestätigung seines Kontos.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleAddEmployee} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="add-firstName">Vorname</Label>
                  <Input
                    id="add-firstName"
                    type="text"
                    value={newEmployee.firstName}
                    onChange={(e) => handleNewEmployeeChange('firstName', e.target.value)}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="add-lastName">Nachname</Label>
                  <Input
                    id="add-lastName"
                    type="text"
                    value={newEmployee.lastName}
                    onChange={(e) => handleNewEmployeeChange('lastName', e.target.value)}
                    required
                  />
                </div>
              </div>
              
              <div>
                <Label htmlFor="add-email">E-Mail</Label>
                <Input
                  id="add-email"
                  type="email"
                  value={newEmployee.email}
                  onChange={(e) => handleNewEmployeeChange('email', e.target.value)}
                  required
                />
              </div>
              
              <div>
                <Label htmlFor="add-position">Position</Label>
                <Input
                  id="add-position"
                  type="text"
                  value={newEmployee.position}
                  onChange={(e) => handleNewEmployeeChange('position', e.target.value)}
                  placeholder="z.B. Elektriker, Elektroniker"
                />
              </div>

              <div>
                <Label htmlFor="add-phone">Telefon</Label>
                <Input
                  id="add-phone"
                  type="tel"
                  value={newEmployee.phone}
                  onChange={(e) => handleNewEmployeeChange('phone', e.target.value)}
                  placeholder="+49 123 456789"
                />
              </div>

              <div>
                <Label htmlFor="add-license">Führerschein</Label>
                <Input
                  id="add-license"
                  type="text"
                  value={newEmployee.license}
                  onChange={(e) => handleNewEmployeeChange('license', e.target.value)}
                  placeholder="z.B. B, BE"
                />
              </div>
              
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setIsAddEmployeeOpen(false)}>
                  Abbrechen
                </Button>
                <Button type="submit" className="bg-blue-600 hover:bg-blue-700" disabled={isAddingEmployee}>
                  {isAddingEmployee ? 'Wird erstellt...' : 'Mitarbeiter erstellen'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Overview Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Mitarbeiter gesamt</p>
                <p className="text-2xl font-bold">{employees.length}</p>
              </div>
              <UserCheck className="h-8 w-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Aktiv</p>
                <p className="text-2xl font-bold">{activeEmployees}</p>
              </div>
              <UserCheck className="h-8 w-8 text-green-600" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Urlaub</p>
                <p className="text-2xl font-bold">{onVacationEmployees}</p>
              </div>
              <Calendar className="h-8 w-8 text-yellow-600" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Stunden (Monat)</p>
                <p className="text-2xl font-bold">{totalHours}</p>
              </div>
              <Clock className="h-8 w-8 text-purple-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Employee List */}
        <div className="lg:col-span-2 space-y-4">
          <h3 className="text-lg font-semibold">Mitarbeiterliste</h3>
          {loading ? (
            <Card>
              <CardContent className="p-6 text-center">
                <p className="text-gray-500">Mitarbeiter werden geladen...</p>
              </CardContent>
            </Card>
          ) : employees.length === 0 ? (
            <Card>
              <CardContent className="p-6 text-center">
                <p className="text-gray-500">Noch keine Mitarbeiter vorhanden.</p>
                <p className="text-sm text-gray-400 mt-2">Klicken Sie auf "Mitarbeiter hinzufügen" um den ersten Mitarbeiter einzuladen.</p>
              </CardContent>
            </Card>
          ) : (
            employees.map((employee) => (
              <Card key={employee.id} className="hover:shadow-lg transition-shadow">
                <CardContent className="p-6 flex flex-col h-full">
                  <div className="flex items-start gap-4">
                    <Avatar className="h-12 w-12">
                      <AvatarFallback>{getInitials(employee.name)}</AvatarFallback>
                    </Avatar>
                    
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h4 className="text-lg font-semibold">{employee.name}</h4>
                        <Badge className={getStatusColor(employee.status)}>
                          {employee.status}
                        </Badge>
                      </div>
                      <p className="text-gray-600 mb-2">{employee.position}</p>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm mb-4 flex-grow">
                        <div>
                          <p className="text-gray-500">Aktuelles Projekt:</p>
                          <p>{employee.currentProject}</p>
                        </div>
                        <div>
                          <p className="text-gray-500">Stunden (Monat):</p>
                          <p className="flex items-center gap-1">
                            <Clock className="h-4 w-4" />
                            {employee.hoursThisMonth}h
                          </p>
                        </div>
                        <div>
                          <p className="text-gray-500">Führerschein:</p>
                          <p className="flex items-center gap-1">
                            <Car className="h-4 w-4" />
                            {employee.license || 'Nicht angegeben'}
                          </p>
                        </div>
                        <div>
                          <p className="text-gray-500">Resturlaub:</p>
                          <p className="flex items-center gap-1">
                            <Calendar className="h-4 w-4" />
                            {employee.vacationDays} Tage
                          </p>
                        </div>
                      </div>

                      <div className="mb-4">
                        <p className="text-gray-500 text-sm mb-2">Qualifikationen:</p>
                        <div className="flex flex-wrap gap-2">
                          {employee.qualifications.length > 0 ? employee.qualifications.map((qual, index) => (
                            <Badge key={index} variant="outline" className="text-xs">
                              <Shield className="h-3 w-3 mr-1" />
                              {qual}
                            </Badge>
                          )) : (
                            <span className="text-sm text-gray-400">Keine Qualifikationen hinterlegt</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-2 mt-auto">
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => handleShowDetails(employee)}
                    >
                      Details
                    </Button>
                    <Button 
                      size="sm" 
                      className="bg-blue-600 hover:bg-blue-700"
                      onClick={() => handleEditEmployee(employee)}
                    >
                      <Edit className="h-4 w-4 mr-1" />
                      Bearbeiten
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>

        {/* Training & Quick Actions */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <GraduationCap className="h-5 w-5" />
                Anstehende Schulungen
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {upcomingTraining.map((training, index) => (
                  <div key={index} className="p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <Badge className={getTrainingTypeColor(training.type)}>
                        {training.type}
                      </Badge>
                    </div>
                    <p className="font-medium text-sm mb-1">{training.employee}</p>
                    {training.training && <p className="text-sm text-gray-600 mb-1">{training.training}</p>}
                    {training.date && (
                      <p className="text-xs text-gray-500 flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {training.date}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Personalaktionen</CardTitle>
            </CardHeader>
            <CardContent className="p-4">
              <div className="space-y-2">
                <Button 
                  variant="outline" 
                  className="w-full justify-start"
                  onClick={() => handleQuickAction('Urlaub planen')}
                >
                  <Calendar className="h-4 w-4 mr-2" />
                  Urlaub planen
                </Button>
                <Button 
                  variant="outline" 
                  className="w-full justify-start"
                  onClick={() => handleQuickAction('Arbeitszeiten')}
                >
                  <Clock className="h-4 w-4 mr-2" />
                  Arbeitszeiten
                </Button>
                <Button 
                  variant="outline" 
                  className="w-full justify-start"
                  onClick={() => handleQuickAction('Schulung buchen')}
                >
                  <GraduationCap className="h-4 w-4 mr-2" />
                  Schulung buchen
                </Button>
                <Button 
                  variant="outline" 
                  className="w-full justify-start"
                  onClick={() => handleQuickAction('Zertifikate')}
                >
                  <Shield className="h-4 w-4 mr-2" />
                  Zertifikate
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Employee Details Dialog */}
      <Dialog open={isDetailsOpen} onOpenChange={setIsDetailsOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Mitarbeiterdetails</DialogTitle>
            <DialogDescription>
              Detaillierte Informationen über den Mitarbeiter
            </DialogDescription>
          </DialogHeader>
          {selectedEmployee && (
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <Avatar className="h-16 w-16">
                  <AvatarFallback className="text-lg">
                    {getInitials(selectedEmployee.name)}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <h3 className="text-xl font-semibold">{selectedEmployee.name}</h3>
                  <p className="text-gray-600">{selectedEmployee.position}</p>
                  <Badge className={getStatusColor(selectedEmployee.status)}>
                    {selectedEmployee.status}
                  </Badge>
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Mail className="h-4 w-4 text-gray-500" />
                    <span className="text-sm">{selectedEmployee.email}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Phone className="h-4 w-4 text-gray-500" />
                    <span className="text-sm">{selectedEmployee.phone || 'Nicht angegeben'}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Car className="h-4 w-4 text-gray-500" />
                    <span className="text-sm">Führerschein: {selectedEmployee.license || 'Nicht angegeben'}</span>
                  </div>
                </div>
                
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-gray-500" />
                    <span className="text-sm">{selectedEmployee.hoursThisMonth}h diesen Monat</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-gray-500" />
                    <span className="text-sm">{selectedEmployee.vacationDays} Tage Resturlaub</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-gray-500" />
                    <span className="text-sm">{selectedEmployee.currentProject}</span>
                  </div>
                </div>
              </div>
              
              <div>
                <h4 className="font-medium mb-2">Qualifikationen</h4>
                <div className="flex flex-wrap gap-2">
                  {selectedEmployee.qualifications.length > 0 ? selectedEmployee.qualifications.map((qual, index) => (
                    <Badge key={index} variant="outline">
                      <Shield className="h-3 w-3 mr-1" />
                      {qual}
                    </Badge>
                  )) : (
                    <span className="text-sm text-gray-400">Keine Qualifikationen hinterlegt</span>
                  )}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Employee Edit Dialog */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Mitarbeiter bearbeiten</DialogTitle>
            <DialogDescription>
              Mitarbeiterdaten bearbeiten
            </DialogDescription>
          </DialogHeader>
          {selectedEmployee && (
            <form onSubmit={handleSaveEmployee} className="space-y-4">
              <div>
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  value={editFormData.name}
                  onChange={(e) => handleInputChange('name', e.target.value)}
                  required
                />
              </div>

              <div>
                <Label htmlFor="position">Position</Label>
                <Input
                  id="position"
                  value={editFormData.position}
                  onChange={(e) => handleInputChange('position', e.target.value)}
                  required
                />
              </div>

              <div>
                <Label htmlFor="email">E-Mail</Label>
                <Input
                  id="email"
                  type="email"
                  value={editFormData.email}
                  onChange={(e) => handleInputChange('email', e.target.value)}
                  required
                />
              </div>

              <div>
                <Label htmlFor="phone">Telefon</Label>
                <Input
                  id="phone"
                  value={editFormData.phone}
                  onChange={(e) => handleInputChange('phone', e.target.value)}
                />
              </div>

              <div>
                <Label htmlFor="status">Status</Label>
                <Select value={editFormData.status} onValueChange={(value) => handleInputChange('status', value)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Aktiv">Aktiv</SelectItem>
                    <SelectItem value="Urlaub">Urlaub</SelectItem>
                    <SelectItem value="Krank">Krank</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="currentProject">Aktuelles Projekt</Label>
                <Input
                  id="currentProject"
                  value={editFormData.currentProject}
                  onChange={(e) => handleInputChange('currentProject', e.target.value)}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="hoursThisMonth">Stunden (Monat)</Label>
                  <Input
                    id="hoursThisMonth"
                    type="number"
                    value={editFormData.hoursThisMonth}
                    onChange={(e) => handleInputChange('hoursThisMonth', parseInt(e.target.value))}
                  />
                </div>
                <div>
                  <Label htmlFor="vacationDays">Resturlaub</Label>
                  <Input
                    id="vacationDays"
                    type="number"
                    value={editFormData.vacationDays}
                    onChange={(e) => handleInputChange('vacationDays', parseInt(e.target.value))}
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setIsEditOpen(false)}>
                  Abbrechen
                </Button>
                <Button type="submit" className="bg-blue-600 hover:bg-blue-700">
                  Speichern
                </Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PersonalModule;
