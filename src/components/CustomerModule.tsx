
import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Users, Plus, Search, Phone, Mail, MapPin, Calendar, FileText, Euro } from "lucide-react";

const CustomerModule = () => {
  const [searchTerm, setSearchTerm] = useState('');

  const customers = [
    {
      id: 1,
      name: 'Müller GmbH',
      contact: 'Hans Müller',
      email: 'mueller@firma.de',
      phone: '+49 123 456789',
      address: 'Hauptstraße 123, 12345 Berlin',
      projects: 3,
      revenue: '€25.400',
      status: 'Aktiv'
    },
    {
      id: 2,
      name: 'Schmidt AG',
      contact: 'Anna Schmidt',
      email: 'schmidt@ag.de',
      phone: '+49 987 654321',
      address: 'Industriestr. 45, 54321 Hamburg',
      projects: 1,
      revenue: '€8.750',
      status: 'Aktiv'
    },
    {
      id: 3,
      name: 'Weber Bau',
      contact: 'Peter Weber',
      email: 'weber@bau.de',
      phone: '+49 555 123456',
      address: 'Bahnhofstr. 78, 98765 München',
      projects: 5,
      revenue: '€45.200',
      status: 'Premium'
    }
  ];

  const recentOrders = [
    { id: 'A2024-001', customer: 'Müller GmbH', project: 'Büroerweiterung', amount: '€12.500', status: 'In Bearbeitung', date: '15.01.2024' },
    { id: 'A2024-002', customer: 'Schmidt AG', project: 'Werkshalle Elektrik', amount: '€8.750', status: 'Abgeschlossen', date: '10.01.2024' },
    { id: 'A2024-003', customer: 'Weber Bau', project: 'Wohnanlage Phase 2', amount: '€28.900', status: 'Angebot', date: '20.01.2024' }
  ];

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Aktiv': return 'bg-green-100 text-green-800';
      case 'Premium': return 'bg-blue-100 text-blue-800';
      case 'In Bearbeitung': return 'bg-yellow-100 text-yellow-800';
      case 'Abgeschlossen': return 'bg-green-100 text-green-800';
      case 'Angebot': return 'bg-orange-100 text-orange-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Users className="h-6 w-6 text-blue-600" />
            Kunden & Aufträge
          </h2>
          <p className="text-gray-600">Verwalten Sie Ihre Kunden und Auftragsdaten</p>
        </div>
        <Button className="bg-blue-600 hover:bg-blue-700">
          <Plus className="h-4 w-4 mr-2" />
          Neuer Kunde
        </Button>
      </div>

      <Tabs defaultValue="customers" className="space-y-6">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="customers">Kundenstamm</TabsTrigger>
          <TabsTrigger value="orders">Aufträge</TabsTrigger>
          <TabsTrigger value="offers">Angebote</TabsTrigger>
        </TabsList>

        <TabsContent value="customers" className="space-y-6">
          {/* Search Bar */}
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="Kunde suchen..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
                <Button variant="outline">Filter</Button>
              </div>
            </CardContent>
          </Card>

          {/* Customer List */}
          <div className="grid gap-4">
            {customers.map((customer) => (
              <Card key={customer.id} className="hover:shadow-lg transition-shadow">
                <CardContent className="p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-lg font-semibold">{customer.name}</h3>
                        <Badge className={getStatusColor(customer.status)}>
                          {customer.status}
                        </Badge>
                      </div>
                      <p className="text-gray-600 mb-3">{customer.contact}</p>
                      
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                        <div className="flex items-center gap-2">
                          <Phone className="h-4 w-4 text-gray-400" />
                          <span>{customer.phone}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Mail className="h-4 w-4 text-gray-400" />
                          <span>{customer.email}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <MapPin className="h-4 w-4 text-gray-400" />
                          <span>{customer.address}</span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="text-right">
                      <div className="grid grid-cols-2 gap-4 mb-4">
                        <div className="text-center">
                          <p className="text-2xl font-bold text-blue-600">{customer.projects}</p>
                          <p className="text-xs text-gray-500">Projekte</p>
                        </div>
                        <div className="text-center">
                          <p className="text-2xl font-bold text-green-600">{customer.revenue}</p>
                          <p className="text-xs text-gray-500">Umsatz</p>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline">Details</Button>
                        <Button size="sm" className="bg-blue-600 hover:bg-blue-700">Bearbeiten</Button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="orders" className="space-y-6">
          <div className="grid gap-4">
            {recentOrders.map((order) => (
              <Card key={order.id} className="hover:shadow-lg transition-shadow">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-lg font-semibold">{order.id}</h3>
                        <Badge className={getStatusColor(order.status)}>
                          {order.status}
                        </Badge>
                      </div>
                      <p className="text-gray-600 mb-1">{order.customer}</p>
                      <p className="text-sm text-gray-500">{order.project}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xl font-bold text-green-600">{order.amount}</p>
                      <p className="text-sm text-gray-500 flex items-center gap-1">
                        <Calendar className="h-4 w-4" />
                        {order.date}
                      </p>
                      <div className="flex gap-2 mt-2">
                        <Button size="sm" variant="outline">
                          <FileText className="h-4 w-4 mr-1" />
                          Details
                        </Button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="offers" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Angebote erstellen</CardTitle>
              <CardDescription>Neue Angebote für Ihre Kunden erstellen</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="customer">Kunde auswählen</Label>
                  <Input id="customer" placeholder="Kunde eingeben oder auswählen" />
                </div>
                <div>
                  <Label htmlFor="project">Projekt</Label>
                  <Input id="project" placeholder="Projektbezeichnung" />
                </div>
                <div>
                  <Label htmlFor="amount">Angebotssumme</Label>
                  <Input id="amount" placeholder="€ 0,00" />
                </div>
                <div>
                  <Label htmlFor="deadline">Gültig bis</Label>
                  <Input id="deadline" type="date" />
                </div>
              </div>
              <div className="flex gap-2 mt-6">
                <Button className="bg-blue-600 hover:bg-blue-700">
                  <FileText className="h-4 w-4 mr-2" />
                  Angebot erstellen
                </Button>
                <Button variant="outline">Vorlage laden</Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default CustomerModule;
