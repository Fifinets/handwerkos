
import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Users, Plus, Search, Phone, Mail, MapPin, Calendar, FileText, Euro, TrendingUp, Building2, UserCheck } from "lucide-react";
import { Customer } from "@/types";
import { useCustomers, useCreateCustomer, useUpdateCustomer } from "@/hooks/useApi";
import AddCustomerDialog from "./AddCustomerDialog";
import EditCustomerDialog from "./EditCustomerDialog";

const CustomerModule = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [isAddCustomerOpen, setIsAddCustomerOpen] = useState(false);
  const [isEditCustomerOpen, setIsEditCustomerOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);

  // React Query hooks for data management
  const { data: customersResponse, isLoading, error } = useCustomers(
    undefined, // No pagination for now
    searchTerm.length >= 2 ? { search: searchTerm } : undefined
  );

  const createCustomerMutation = useCreateCustomer();
  const updateCustomerMutation = useUpdateCustomer();

  const customers = customersResponse?.items || [];

  const recentOrders = [
    { id: 'A2024-001', customer: 'Müller GmbH', project: 'Büroerweiterung', amount: '€12.500', status: 'In Bearbeitung', date: '15.01.2024' },
    { id: 'A2024-002', customer: 'Schmidt AG', project: 'Werkshalle Elektrik', amount: '€8.750', status: 'Abgeschlossen', date: '10.01.2024' },
    { id: 'A2024-003', customer: 'Weber Bau', project: 'Wohnanlage Phase 2', amount: '€28.900', status: 'Angebot', date: '20.01.2024' }
  ];


  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Aktiv': return 'bg-green-100 text-green-800';
      case 'Premium': return 'bg-blue-100 text-blue-800';
      case 'Inaktiv': return 'bg-gray-100 text-gray-800';
      case 'In Bearbeitung': return 'bg-yellow-100 text-yellow-800';
      case 'Abgeschlossen': return 'bg-green-100 text-green-800';
      case 'Angebot': return 'bg-orange-100 text-orange-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const handleAddCustomer = async (newCustomerData: any) => {
    createCustomerMutation.mutate(newCustomerData);
  };

  const handleEditCustomer = (customer: Customer) => {
    setSelectedCustomer(customer);
    setIsEditCustomerOpen(true);
  };

  const handleUpdateCustomer = async (updatedCustomer: Customer) => {
    if (!selectedCustomer) return;
    
    const { id, created_at, updated_at, ...updateData } = updatedCustomer;
    updateCustomerMutation.mutate({ 
      id: selectedCustomer.id, 
      data: updateData 
    });
  };

  const handleShowCustomerDetails = (customer: Customer) => {
    // Für jetzt als einfacher Alert - später kann hier ein Detail-Dialog geöffnet werden
    alert(`Details für ${customer.company_name}:\n\nKontakt: ${customer.contact_person}\nE-Mail: ${customer.email}\nStatus: ${customer.status}`);
  };

  // For search terms less than 2 characters, filter locally. For longer terms, server-side search is used
  const filteredCustomers = searchTerm.length >= 2 ? customers : customers.filter(customer =>
    customer.company_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    customer.contact_person.toLowerCase().includes(searchTerm.toLowerCase()) ||
    customer.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const formatAddress = (customer: Customer) => {
    const parts = [customer.address, customer.postal_code, customer.city, customer.country].filter(Boolean);
    return parts.join(', ');
  };

  return (
    <div className="p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Kunden & Aufträge</h1>
        <Button
          onClick={() => setIsAddCustomerOpen(true)}
          className="bg-blue-600 hover:bg-blue-700 rounded-full"
        >
          <Plus className="h-4 w-4 mr-2" />
          Neuer Kunde
        </Button>
      </div>

      {/* KPI Bar */}
      <div className="grid grid-cols-4 gap-4">
        <Card className="shadow-soft rounded-2xl">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Aktive Kunden</p>
                <p className="text-2xl font-bold">{customers.filter(c => c.status === 'Aktiv').length}</p>
              </div>
              <Users className="h-8 w-8 text-blue-500 opacity-50" />
            </div>
          </CardContent>
        </Card>
        <Card className="shadow-soft rounded-2xl">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Premium Kunden</p>
                <p className="text-2xl font-bold">{customers.filter(c => c.status === 'Premium').length}</p>
              </div>
              <UserCheck className="h-8 w-8 text-green-500 opacity-50" />
            </div>
          </CardContent>
        </Card>
        <Card className="shadow-soft rounded-2xl">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Neue diesen Monat</p>
                <p className="text-2xl font-bold">0</p>
              </div>
              <TrendingUp className="h-8 w-8 text-purple-500 opacity-50" />
            </div>
          </CardContent>
        </Card>
        <Card className="shadow-soft rounded-2xl">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Gesamt Umsatz</p>
                <p className="text-2xl font-bold">€0</p>
              </div>
              <Euro className="h-8 w-8 text-yellow-500 opacity-50" />
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="customers" className="space-y-6">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="customers">Kundenstamm</TabsTrigger>
          <TabsTrigger value="orders">Aufträge</TabsTrigger>
          <TabsTrigger value="offers">Angebote</TabsTrigger>
        </TabsList>

        <TabsContent value="customers" className="space-y-4">
          {/* Search Bar */}
          <Card className="shadow-soft rounded-2xl overflow-hidden">
            <CardContent className="p-4">
              <div className="flex items-center gap-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="Kunde suchen..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10 rounded-xl"
                  />
                </div>
                <Button variant="outline" className="rounded-xl">Filter</Button>
              </div>
            </CardContent>
          </Card>

          {/* Customer List */}
          {isLoading ? (
            <div className="grid gap-4">
              {Array(3).fill(0).map((_, i) => (
                <Card key={i}>
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <Skeleton className="h-5 w-32" />
                          <Skeleton className="h-6 w-16" />
                        </div>
                        <Skeleton className="h-4 w-24 mb-3" />
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <Skeleton className="h-4 w-28" />
                          <Skeleton className="h-4 w-36" />
                          <Skeleton className="h-4 w-40" />
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Skeleton className="h-8 w-20" />
                        <Skeleton className="h-8 w-24" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : error ? (
            <Card>
              <CardContent className="p-6 text-center">
                <p className="text-red-500">Fehler beim Laden der Kunden: {error.message}</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {filteredCustomers.length === 0 ? (
                <Card>
                  <CardContent className="p-6 text-center">
                    <p className="text-gray-500">
                      {searchTerm ? 'Keine Kunden gefunden.' : 'Noch keine Kunden vorhanden.'}
                    </p>
                  </CardContent>
                </Card>
              ) : (
                filteredCustomers.map((customer) => (
                  <Card key={customer.id} className="shadow-soft rounded-2xl hover:shadow-md transition-shadow">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <h3 className="text-base font-semibold">{customer.company_name}</h3>
                            <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs ${getStatusColor(customer.status)}`}>
                              {customer.status}
                            </span>
                          </div>
                          <p className="text-gray-600 mb-3">{customer.contact_person}</p>
                          
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                            <div className="flex items-center gap-2">
                              <Phone className="h-4 w-4 text-gray-400" />
                              <span>{customer.phone || 'Nicht angegeben'}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <Mail className="h-4 w-4 text-gray-400" />
                              <span>{customer.email}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <MapPin className="h-4 w-4 text-gray-400" />
                              <span>{formatAddress(customer) || 'Nicht angegeben'}</span>
                            </div>
                          </div>
                        </div>
                        
                        <div className="text-right">
                          <div className="grid grid-cols-2 gap-4 mb-4">
                            <div className="text-center">
                              <p className="text-2xl font-bold text-blue-600">0</p>
                              <p className="text-xs text-gray-500">Projekte</p>
                            </div>
                            <div className="text-center">
                              <p className="text-2xl font-bold text-green-600">€0</p>
                              <p className="text-xs text-gray-500">Umsatz</p>
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <Button
                              size="sm" 
                              variant="outline"
                              className="rounded-xl"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                handleShowCustomerDetails(customer);
                              }}
                            >
                              Details
                            </Button>
                            <Button
                              size="sm" 
                              className="rounded-xl"
                              onClick={() => handleEditCustomer(customer)}
                            >
                              Bearbeiten
                            </Button>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          )}
        </TabsContent>

        <TabsContent value="orders" className="space-y-6">
          <div className="grid gap-4">
            {recentOrders.map((order) => (
              <Card key={order.id} className="shadow-soft rounded-2xl hover:shadow-md transition-shadow">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="text-base font-semibold">{order.id}</h3>
                        <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs ${getStatusColor(order.status)}`}>
                          {order.status}
                        </span>
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
                        <Button size="sm" variant="outline" className="rounded-xl">
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

        <TabsContent value="offers" className="space-y-4">
          <Card className="shadow-soft rounded-2xl overflow-hidden">
            <CardHeader className="pb-2">
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
                <Button className="rounded-xl">
                  <FileText className="h-4 w-4 mr-2" />
                  Angebot erstellen
                </Button>
                <Button variant="outline" className="rounded-xl">Vorlage laden</Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <AddCustomerDialog
        isOpen={isAddCustomerOpen}
        onClose={() => setIsAddCustomerOpen(false)}
        onCustomerAdded={handleAddCustomer}
      />

      <EditCustomerDialog
        isOpen={isEditCustomerOpen}
        onClose={() => setIsEditCustomerOpen(false)}
        customer={selectedCustomer as any}
        onCustomerUpdated={handleUpdateCustomer as any}
      />
    </div>
  );
};

export default CustomerModule;
