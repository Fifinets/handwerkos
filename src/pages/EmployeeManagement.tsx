
import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { 
  Users, 
  UserPlus, 
  Settings,
  LogOut,
  User
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

const EmployeeManagement = () => {
  const { user, userRole, signOut } = useAuth();
  const navigate = useNavigate();
  const [isAddingEmployee, setIsAddingEmployee] = useState(false);
  const [newEmployee, setNewEmployee] = useState({
    email: '',
    firstName: '',
    lastName: '',
    password: ''
  });

  // Redirect if not manager
  React.useEffect(() => {
    if (userRole && userRole !== 'manager') {
      navigate('/employee');
    }
  }, [userRole, navigate]);

  const handleSignOut = async () => {
    await signOut();
    toast.success('Erfolgreich abgemeldet');
  };

  const handleAddEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsAddingEmployee(true);

    try {
      // Create employee account with employee role
      const { data, error } = await supabase.auth.admin.createUser({
        email: newEmployee.email,
        password: newEmployee.password,
        user_metadata: {
          first_name: newEmployee.firstName,
          last_name: newEmployee.lastName
        }
      });

      if (error) {
        toast.error(`Fehler beim Erstellen des Mitarbeiters: ${error.message}`);
        return;
      }

      if (data.user) {
        // Update user role to employee (override the default manager role)
        const { error: roleError } = await supabase
          .from('user_roles')
          .update({ role: 'employee' })
          .eq('user_id', data.user.id);

        if (roleError) {
          toast.error('Mitarbeiter erstellt, aber Rolle konnte nicht gesetzt werden');
        } else {
          toast.success('Mitarbeiter erfolgreich erstellt!');
          setNewEmployee({ email: '', firstName: '', lastName: '', password: '' });
        }
      }
    } catch (error) {
      toast.error('Ein Fehler ist aufgetreten');
    } finally {
      setIsAddingEmployee(false);
    }
  };

  if (userRole !== 'manager') {
    return <div>Zugriff verweigert - Nur für Manager</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center gap-3">
              <div className="bg-blue-600 text-white p-2 rounded-lg">
                <Settings className="h-6 w-6" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">ElektroManager Pro</h1>
                <p className="text-sm text-gray-500">Mitarbeiterverwaltung</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <Button variant="outline" onClick={() => navigate('/')}>
                Zurück zum Dashboard
              </Button>
              <div className="text-right">
                <p className="text-sm font-medium flex items-center gap-2">
                  <User className="h-4 w-4" />
                  {user?.email}
                </p>
                <p className="text-xs text-gray-500">Manager</p>
              </div>
              <Button variant="outline" onClick={handleSignOut}>
                <LogOut className="h-4 w-4 mr-2" />
                Abmelden
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="space-y-8">
          {/* Add Employee Section */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <UserPlus className="h-5 w-5" />
                Neuen Mitarbeiter hinzufügen
              </CardTitle>
              <CardDescription>
                Erstelle einen neuen Mitarbeiter-Account für dein Team
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleAddEmployee} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="firstName">Vorname</Label>
                    <Input
                      id="firstName"
                      type="text"
                      value={newEmployee.firstName}
                      onChange={(e) => setNewEmployee(prev => ({ ...prev, firstName: e.target.value }))}
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="lastName">Nachname</Label>
                    <Input
                      id="lastName"
                      type="text"
                      value={newEmployee.lastName}
                      onChange={(e) => setNewEmployee(prev => ({ ...prev, lastName: e.target.value }))}
                      required
                    />
                  </div>
                </div>
                
                <div>
                  <Label htmlFor="email">E-Mail</Label>
                  <Input
                    id="email"
                    type="email"
                    value={newEmployee.email}
                    onChange={(e) => setNewEmployee(prev => ({ ...prev, email: e.target.value }))}
                    required
                  />
                </div>
                
                <div>
                  <Label htmlFor="password">Passwort</Label>
                  <Input
                    id="password"
                    type="password"
                    value={newEmployee.password}
                    onChange={(e) => setNewEmployee(prev => ({ ...prev, password: e.target.value }))}
                    required
                    minLength={6}
                  />
                </div>
                
                <Button type="submit" className="w-full" disabled={isAddingEmployee}>
                  {isAddingEmployee ? 'Wird erstellt...' : 'Mitarbeiter erstellen'}
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* Future: Employee List */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Mitarbeiterliste
              </CardTitle>
              <CardDescription>
                Kommende Funktion: Übersicht aller Mitarbeiter
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-gray-500 text-center py-8">
                Mitarbeiterliste wird in einer zukünftigen Version implementiert
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default EmployeeManagement;
