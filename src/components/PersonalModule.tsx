import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Users, Plus, Mail, Phone } from 'lucide-react';
import AddPersonDialog from './AddPersonDialog';

const PersonalModule = () => {
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [teamMembers, setTeamMembers] = useState([
    {
      id: 1,
      name: "Anna Schmidt",
      role: "Projektleiterin",
      email: "anna.schmidt@example.com",
      phone: "+49 123 456789",
      department: "Projektmanagement",
      salary: "€65.000",
      status: "Aktiv",
      projects: [
        { name: "Büroerweiterung Müller GmbH", startDate: "01.03.2024", endDate: "15.05.2024" },
        { name: "Lagerhalle Wagner KG", startDate: "20.05.2024", endDate: "30.07.2024" }
      ]
    },
    {
      id: 2,
      name: "Hans-Peter Weber",
      role: "Architekt",
      email: "hans-peter.weber@example.com",
      phone: "+49 987 654321",
      department: "Architektur",
      salary: "€72.000",
      status: "Aktiv",
      projects: [
        { name: "Neubau Verwaltungsgebäude", startDate: "10.01.2024", endDate: "30.06.2024" }
      ]
    },
    {
      id: 3,
      name: "Maria Schulz",
      role: "Ingenieurin",
      email: "maria.schulz@example.com",
      phone: "+49 555 123456",
      department: "Bauingenieurwesen",
      salary: "€68.000",
      status: "Aktiv",
      projects: [
        { name: "Brückensanierung", startDate: "15.02.2024", endDate: "28.04.2024" },
        { name: "Wohnanlage Sonnenblick", startDate: "01.05.2024", endDate: "31.12.2024" }
      ]
    },
  ]);

  const handleAddPerson = (newPerson: any) => {
    setTeamMembers(prev => [...prev, newPerson]);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-3xl font-bold tracking-tight">Personal</h2>
        <Button 
          onClick={() => setIsAddDialogOpen(true)}
          className="bg-blue-600 hover:bg-blue-700"
        >
          <Plus className="mr-2 h-4 w-4" />
          Neuer Mitarbeiter
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {teamMembers.map((member) => (
          <Card key={member.id}>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">{member.name}</CardTitle>
                <Badge variant={member.status === 'Aktiv' ? 'default' : 'secondary'}>
                  {member.status}
                </Badge>
              </div>
              <CardDescription>{member.role}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex items-center text-sm text-gray-600">
                  <Mail className="mr-2 h-4 w-4" />
                  {member.email}
                </div>
                <div className="flex items-center text-sm text-gray-600">
                  <Phone className="mr-2 h-4 w-4" />
                  {member.phone}
                </div>
                <div className="text-sm">
                  <span className="font-medium">Abteilung:</span> {member.department}
                </div>
                <div className="text-sm">
                  <span className="font-medium">Gehalt:</span> {member.salary}
                </div>
                <div className="text-sm">
                  <span className="font-medium">Aktuelle Projekte:</span> {member.projects?.length || 0}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <AddPersonDialog
        isOpen={isAddDialogOpen}
        onClose={() => setIsAddDialogOpen(false)}
        onPersonAdded={handleAddPerson}
      />
    </div>
  );
};

export default PersonalModule;
