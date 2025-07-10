
import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { 
  Package, 
  Clock, 
  Calendar, 
  LogOut, 
  User,
  Plus,
  Settings,
  MapPin,
  Navigation
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import LocationBasedTimeTracking from "@/components/LocationBasedTimeTracking";
import ManagerTimeView from "@/components/ManagerTimeView";
import { supabase } from "@/integrations/supabase/client";

const Employee = () => {
  const { user, signOut } = useAuth();
  const [activeTab, setActiveTab] = useState('material');
  const [userRole, setUserRole] = useState<string | null>(null);

  useEffect(() => {
    const fetchUserRole = async () => {
      if (!user?.id) return;
      
      const { data } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .single();
      
      setUserRole(data?.role || null);
    };

    fetchUserRole();
  }, [user?.id]);

  const handleSignOut = async () => {
    await signOut();
    toast.success('Erfolgreich abgemeldet');
  };

  const tabs = [
    { id: 'material', name: 'Material verbuchen', icon: Package },
    { id: 'time', name: 'Arbeitszeit', icon: Clock },
    { id: 'vacation', name: 'Urlaub', icon: Calendar },
  ];

  const renderMaterialForm = () => (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Package className="h-5 w-5" />
          Material verbuchen
        </CardTitle>
        <CardDescription>Materialverbrauch für Projekte eintragen</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label htmlFor="project">Projekt</Label>
          <Input id="project" placeholder="Projektname oder -nummer" />
        </div>
        <div>
          <Label htmlFor="material">Material</Label>
          <Input id="material" placeholder="z.B. Kabel 5x2.5 mm²" />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="quantity">Menge</Label>
            <Input id="quantity" type="number" placeholder="0" />
          </div>
          <div>
            <Label htmlFor="unit">Einheit</Label>
            <Input id="unit" placeholder="z.B. Meter, Stück" />
          </div>
        </div>
        <div>
          <Label htmlFor="notes">Notizen</Label>
          <Textarea id="notes" placeholder="Zusätzliche Informationen..." />
        </div>
        <Button className="w-full">
          <Plus className="h-4 w-4 mr-2" />
          Material verbuchen
        </Button>
      </CardContent>
    </Card>
  );

  const renderTimeForm = () => {
    if (userRole === 'manager') {
      return <ManagerTimeView />;
    }
    return <LocationBasedTimeTracking employeeId={user?.id || ''} />;
  };

  const renderVacationForm = () => (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calendar className="h-5 w-5" />
          Urlaub beantragen
        </CardTitle>
        <CardDescription>Urlaubsantrag einreichen</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="start-date">Von</Label>
            <Input id="start-date" type="date" />
          </div>
          <div>
            <Label htmlFor="end-date">Bis</Label>
            <Input id="end-date" type="date" />
          </div>
        </div>
        <div>
          <Label htmlFor="vacation-type">Urlaubsart</Label>
          <select className="w-full p-2 border rounded-md">
            <option value="regular">Jahresurlaub</option>
            <option value="sick">Krankenstand</option>
            <option value="personal">Persönlicher Urlaub</option>
          </select>
        </div>
        <div>
          <Label htmlFor="vacation-notes">Notizen</Label>
          <Textarea id="vacation-notes" placeholder="Zusätzliche Informationen..." />
        </div>
        <Button className="w-full">
          <Plus className="h-4 w-4 mr-2" />
          Urlaub beantragen
        </Button>
      </CardContent>
    </Card>
  );

  const renderContent = () => {
    switch (activeTab) {
      case 'material':
        return renderMaterialForm();
      case 'time':
        return renderTimeForm();
      case 'vacation':
        return renderVacationForm();
      default:
        return renderMaterialForm();
    }
  };

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
                <p className="text-sm text-gray-500">Mitarbeiter Portal</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-right">
                <p className="text-sm font-medium flex items-center gap-2">
                  <User className="h-4 w-4" />
                  {user?.email}
                </p>
                <p className="text-xs text-gray-500">Mitarbeiter</p>
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
        <div className="flex flex-col lg:flex-row gap-8">
          {/* Sidebar Navigation */}
          <div className="w-full lg:w-64 flex-shrink-0">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Funktionen</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <nav className="space-y-1">
                  {tabs.map((tab) => (
                    <Button
                      key={tab.id}
                      variant={activeTab === tab.id ? "default" : "ghost"}
                      className={`w-full justify-start gap-3 ${
                        activeTab === tab.id ? 'bg-blue-600 text-white' : ''
                      }`}
                      onClick={() => setActiveTab(tab.id)}
                    >
                      <tab.icon className="h-4 w-4" />
                      {tab.name}
                    </Button>
                  ))}
                </nav>
              </CardContent>
            </Card>
          </div>

          {/* Main Content */}
          <div className="flex-1">
            {renderContent()}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Employee;
