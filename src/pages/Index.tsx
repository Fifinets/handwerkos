
import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  Users, 
  Building2, 
  UserCheck, 
  Package, 
  Settings, 
  Calculator,
  FileText,
  TrendingUp,
  Phone,
  Mail,
  MapPin,
  Calendar,
  DollarSign,
  Wrench,
  ClipboardList
} from "lucide-react";
import CustomerModule from "@/components/CustomerModule";
import ProjectModule from "@/components/ProjectModule";
import PersonalModule from "@/components/PersonalModule";
import MaterialModule from "@/components/MaterialModule";
import MachineModule from "@/components/MachineModule";
import FinanceModule from "@/components/FinanceModule";

const Index = () => {
  const [activeModule, setActiveModule] = useState('dashboard');

  const modules = [
    { id: 'dashboard', name: 'Dashboard', icon: TrendingUp, color: 'bg-blue-500' },
    { id: 'customers', name: 'Kunden & Aufträge', icon: Users, color: 'bg-green-500' },
    { id: 'projects', name: 'Projekte & Baustellen', icon: Building2, color: 'bg-orange-500' },
    { id: 'personal', name: 'Personal', icon: UserCheck, color: 'bg-purple-500' },
    { id: 'materials', name: 'Material', icon: Package, color: 'bg-red-500' },
    { id: 'machines', name: 'Maschinen & Geräte', icon: Settings, color: 'bg-indigo-500' },
    { id: 'finance', name: 'Finanzen', icon: Calculator, color: 'bg-cyan-500' }
  ];

  const dashboardStats = [
    { title: 'Aktive Projekte', value: '12', icon: Building2, color: 'text-blue-600' },
    { title: 'Kunden', value: '48', icon: Users, color: 'text-green-600' },
    { title: 'Mitarbeiter', value: '8', icon: UserCheck, color: 'text-purple-600' },
    { title: 'Offene Rechnungen', value: '€15.420', icon: DollarSign, color: 'text-red-600' }
  ];

  const recentActivities = [
    { type: 'Auftrag', description: 'Neuer Auftrag von Müller GmbH', time: '2 Std.' },
    { type: 'Wartung', description: 'DGUV V3 Prüfung bei Schmidt AG fällig', time: '4 Std.' },
    { type: 'Material', description: 'Kabel 5x2.5 mm² unter Mindestbestand', time: '6 Std.' },
    { type: 'Personal', description: 'Urlaub von Max Mustermann genehmigt', time: '1 Tag' }
  ];

  const renderModule = () => {
    switch(activeModule) {
      case 'customers':
        return <CustomerModule />;
      case 'projects':
        return <ProjectModule />;
      case 'personal':
        return <PersonalModule />;
      case 'materials':
        return <MaterialModule />;
      case 'machines':
        return <MachineModule />;
      case 'finance':
        return <FinanceModule />;
      default:
        return (
          <div className="space-y-6">
            {/* Stats Overview */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {dashboardStats.map((stat, index) => (
                <Card key={index} className="hover:shadow-lg transition-shadow">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">{stat.title}</p>
                        <p className="text-2xl font-bold">{stat.value}</p>
                      </div>
                      <stat.icon className={`h-8 w-8 ${stat.color}`} />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Recent Activities & Quick Actions */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <ClipboardList className="h-5 w-5" />
                    Aktuelle Aktivitäten
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {recentActivities.map((activity, index) => (
                      <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div>
                          <span className="inline-block px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded-full mr-2">
                            {activity.type}
                          </span>
                          <span className="text-sm">{activity.description}</span>
                        </div>
                        <span className="text-xs text-gray-500">{activity.time}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Wrench className="h-5 w-5" />
                    Schnellzugriff
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-3">
                    <Button 
                      variant="outline" 
                      className="h-20 flex flex-col gap-2"
                      onClick={() => setActiveModule('customers')}
                    >
                      <Users className="h-6 w-6" />
                      <span className="text-xs">Neuer Kunde</span>
                    </Button>
                    <Button 
                      variant="outline" 
                      className="h-20 flex flex-col gap-2"
                      onClick={() => setActiveModule('projects')}
                    >
                      <Building2 className="h-6 w-6" />
                      <span className="text-xs">Neues Projekt</span>
                    </Button>
                    <Button 
                      variant="outline" 
                      className="h-20 flex flex-col gap-2"
                      onClick={() => setActiveModule('finance')}
                    >
                      <FileText className="h-6 w-6" />
                      <span className="text-xs">Rechnung</span>
                    </Button>
                    <Button 
                      variant="outline" 
                      className="h-20 flex flex-col gap-2"
                      onClick={() => setActiveModule('materials')}
                    >
                      <Package className="h-6 w-6" />
                      <span className="text-xs">Bestellung</span>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        );
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
                <p className="text-sm text-gray-500">Ihr Elektro-Unternehmen Software</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-right">
                <p className="text-sm font-medium">Mustermann Elektro GmbH</p>
                <p className="text-xs text-gray-500">Administrator</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col lg:flex-row gap-8">
          {/* Sidebar Navigation */}
          <div className="w-full lg:w-64 flex-shrink-0">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Module</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <nav className="space-y-1">
                  {modules.map((module) => (
                    <Button
                      key={module.id}
                      variant={activeModule === module.id ? "default" : "ghost"}
                      className={`w-full justify-start gap-3 ${
                        activeModule === module.id ? 'bg-blue-600 text-white' : ''
                      }`}
                      onClick={() => setActiveModule(module.id)}
                    >
                      <module.icon className="h-4 w-4" />
                      {module.name}
                    </Button>
                  ))}
                </nav>
              </CardContent>
            </Card>
          </div>

          {/* Main Content */}
          <div className="flex-1">
            {renderModule()}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Index;
