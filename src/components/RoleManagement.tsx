import { useState, useEffect } from 'react';
import { useHybridAuth } from '@/hooks/useHybridAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { toast } from '@/hooks/use-toast';
import { UserPlus, Users, Settings } from 'lucide-react';

interface Employee {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  status: string;
  user_id?: string;
}

interface UserRole {
  id: string;
  user_id: string;
  role: string;
}

export function RoleManagement() {
  const { organization, canInviteMembers, inviteToOrganization, updateMemberRole, user } = useHybridAuth();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [userRoles, setUserRoles] = useState<UserRole[]>([]);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteFirstName, setInviteFirstName] = useState('');
  const [inviteLastName, setInviteLastName] = useState('');
  const [isInviteDialogOpen, setIsInviteDialogOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  // Load employees and roles
  useEffect(() => {
    loadEmployeesAndRoles();
  }, [user]);

  const loadEmployeesAndRoles = async () => {
    if (!user) return;

    try {
      // Get user's company_id
      const { data: profile } = await supabase
        .from('profiles')
        .select('company_id')
        .eq('id', user.id)
        .single();

      if (!profile?.company_id) return;

      // Load employees
      const { data: employeeData, error: employeeError } = await supabase
        .from('employees')
        .select('*')
        .eq('company_id', profile.company_id);

      if (employeeError) {
        console.error('Error loading employees:', employeeError);
      } else {
        setEmployees(employeeData || []);
      }

      // Load user roles
      const { data: roleData, error: roleError } = await supabase
        .from('user_roles')
        .select('*');

      if (roleError) {
        console.error('Error loading roles:', roleError);
      } else {
        setUserRoles(roleData || []);
      }
    } catch (error) {
      console.error('Error in loadEmployeesAndRoles:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleInviteEmployee = async () => {
    if (!inviteEmail || !inviteFirstName || !inviteLastName) {
      toast({
        title: "Fehler",
        description: "Bitte füllen Sie alle Felder aus.",
        variant: "destructive",
      });
      return;
    }

    try {
      // Invite via Clerk Organizations
      const result = await inviteToOrganization(inviteEmail, 'basic_member');
      
      if (!result.success) {
        throw new Error(result.error);
      }

      // Also create employee record in Supabase
      const { data: profile } = await supabase
        .from('profiles')
        .select('company_id')
        .eq('id', user?.id)
        .single();

      if (profile?.company_id) {
        const { error } = await supabase.from('employees').insert({
          email: inviteEmail,
          first_name: inviteFirstName,
          last_name: inviteLastName,
          company_id: profile.company_id,
          status: 'eingeladen'
        });

        if (error) throw error;
      }

      toast({
        title: "Einladung versendet",
        description: `Einladung wurde an ${inviteEmail} gesendet.`,
      });

      setInviteEmail('');
      setInviteFirstName('');
      setInviteLastName('');
      setIsInviteDialogOpen(false);
      loadEmployeesAndRoles();
    } catch (error) {
      toast({
        title: "Fehler beim Einladen",
        description: error instanceof Error ? error.message : "Unbekannter Fehler",
        variant: "destructive",
      });
    }
  };

  const handleRoleChange = async (userId: string, newRole: string) => {
    try {
      const result = await updateMemberRole(userId, newRole);
      
      if (!result.success) {
        throw new Error(result.error);
      }

      toast({
        title: "Rolle aktualisiert",
        description: "Die Rolle wurde erfolgreich geändert.",
      });

      loadEmployeesAndRoles();
    } catch (error) {
      toast({
        title: "Fehler beim Aktualisieren",
        description: error instanceof Error ? error.message : "Unbekannter Fehler",
        variant: "destructive",
      });
    }
  };

  const getEmployeeRole = (employee: Employee) => {
    if (!employee.user_id) return 'Nicht aktiviert';
    const userRole = userRoles.find(role => role.user_id === employee.user_id);
    return userRole?.role || 'employee';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!canInviteMembers) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="w-5 h-5" />
            Rollen-Management
          </CardTitle>
          <CardDescription>
            Sie haben keine Berechtigung, Mitarbeiter zu verwalten.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Users className="w-5 h-5" />
                Team-Management
              </CardTitle>
              <CardDescription>
                Verwalten Sie Ihr Team und weisen Sie Rollen zu.
              </CardDescription>
            </div>
            <Dialog open={isInviteDialogOpen} onOpenChange={setIsInviteDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <UserPlus className="w-4 h-4 mr-2" />
                  Mitarbeiter einladen
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Mitarbeiter einladen</DialogTitle>
                  <DialogDescription>
                    Laden Sie einen neuen Mitarbeiter in Ihr Team ein.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="email">E-Mail-Adresse</Label>
                    <Input
                      id="email"
                      type="email"
                      value={inviteEmail}
                      onChange={(e) => setInviteEmail(e.target.value)}
                      placeholder="mitarbeiter@beispiel.de"
                    />
                  </div>
                  <div>
                    <Label htmlFor="firstName">Vorname</Label>
                    <Input
                      id="firstName"
                      value={inviteFirstName}
                      onChange={(e) => setInviteFirstName(e.target.value)}
                      placeholder="Max"
                    />
                  </div>
                  <div>
                    <Label htmlFor="lastName">Nachname</Label>
                    <Input
                      id="lastName"
                      value={inviteLastName}
                      onChange={(e) => setInviteLastName(e.target.value)}
                      placeholder="Mustermann"
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsInviteDialogOpen(false)}>
                    Abbrechen
                  </Button>
                  <Button onClick={handleInviteEmployee}>
                    Einladung senden
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {employees.length === 0 ? (
              <p className="text-muted-foreground text-center py-4">
                Noch keine Mitarbeiter eingeladen.
              </p>
            ) : (
              employees.map((employee) => (
                <div key={employee.id} className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center space-x-4">
                    <div>
                      <p className="font-medium">
                        {employee.first_name} {employee.last_name}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {employee.email}
                      </p>
                    </div>
                    <Badge variant={employee.status === 'aktiv' ? 'default' : 'secondary'}>
                      {employee.status}
                    </Badge>
                  </div>
                  <div className="flex items-center space-x-2">
                    {employee.user_id ? (
                      <Select
                        value={getEmployeeRole(employee)}
                        onValueChange={(value) => handleRoleChange(employee.user_id!, value)}
                      >
                        <SelectTrigger className="w-32">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="employee">Mitarbeiter</SelectItem>
                          <SelectItem value="manager">Manager</SelectItem>
                        </SelectContent>
                      </Select>
                    ) : (
                      <Badge variant="outline">Nicht aktiviert</Badge>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      {organization && (
        <Card>
          <CardHeader>
            <CardTitle>Organisation: {organization.name}</CardTitle>
            <CardDescription>
              Clerk Organization ID: {organization.id}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Diese Organisation wird für die Team-Verwaltung verwendet.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}