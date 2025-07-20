
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Users, Plus, Search, Phone, Mail, MapPin, Calendar, FileText, Euro } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import AddCustomerDialog from "./AddCustomerDialog";
import EditCustomerDialog from "./EditCustomerDialog";

interface Customer {
  id: string;
  company_name: string;
  contact_person: string;
  email: string;
  phone?: string;
  address?: string;
  city?: string;
  postal_code?: string;
  country?: string;
  tax_number?: string;
  customer_number?: string;
  status: string;
  created_at: string;
  updated_at: string;
}

const CustomerModule = () => {
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState('');
  const [isAddCustomerOpen, setIsAddCustomerOpen] = useState(false);
  const [isEditCustomerOpen, setIsEditCustomerOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);

  const recentOrders = [
    { id: 'A2024-001', customer: 'Müller GmbH', project: 'Büroerweiterung', amount: '€12.500', status: 'In Bearbeitung', date: '15.01.2024' },
    { id: 'A2024-002', customer: 'Schmidt AG', project: 'Werkshalle Elektrik', amount: '€8.750', status: 'Abgeschlossen', date: '10.01.2024' },
    { id: 'A2024-003', customer: 'Weber Bau', project: 'Wohnanlage Phase 2', amount: '€28.900', status: 'Angebot', date: '20.01.2024' }
  ];

  useEffect(() => {
    fetchCustomers();
  }, []);

  const fetchCustomers = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('customers')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching customers:', error);
        toast({
          title: "Fehler",
          description: "Kunden konnten nicht geladen werden.",
          variant: "destructive"
        });
        return;
      }

      setCustomers(data || []);
    } catch (error) {
      console.error('Error fetching customers:', error);
      toast({
        title: "Fehler",
        description: "Ein unerwarteter Fehler ist aufgetreten.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

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

  const handleAddCustomer = async (newCustomerData: Omit<Customer, 'id' | 'created_at' | 'updated_at'>) => {
    try {
      const { data, error } = await supabase
        .from('customers')
        .insert([newCustomerData])
        .select()
        .single();

      if (error) {
        console.error('Error adding customer:', error);
        toast({
          title: "Fehler",
          description: "Kunde konnte nicht hinzugefügt werden.",
          variant: "destructive"
        });
        return;
      }

      setCustomers(prev => [data, ...prev]);
      toast({
        title: "Erfolg",
        description: "Kunde wurde erfolgreich hinzugefügt."
      });
    } catch (error) {
      console.error('Error adding customer:', error);
      toast({
        title: "Fehler",
        description: "Ein unerwarteter Fehler ist aufgetreten.",
        variant: "destructive"
      });
    }
  };

  const handleEditCustomer = (customer: Customer) => {
    setSelectedCustomer(customer);
    setIsEditCustomerOpen(true);
  };

  const handleUpdateCustomer = async (updatedCustomer: Customer) => {
    try {
      const { error } = await supabase
        .from('customers')
        .update({
          company_name: updatedCustomer.company_name,
          contact_person: updatedCustomer.contact_person,
          email: updatedCustomer.email,
          phone: updatedCustomer.phone,
          address: updatedCustomer.address,
          city: updatedCustomer.city,
          postal_code: updatedCustomer.postal_code,
          country: updatedCustomer.country,
          tax_number: updatedCustomer.tax_number,
          status: updatedCustomer.status
        })
        .eq('id', updatedCustomer.id);

      if (error) {
        console.error('Error updating customer:', error);
        toast({
          title: "Fehler",
          description: "Kunde konnte nicht aktualisiert werden.",
          variant: "destructive"
        });
        return;
      }

      setCustomers(prev => 
        prev.map(customer => 
          customer.id === updatedCustomer.id ? updatedCustomer : customer
        )
      );
      
      toast({
        title: "Erfolg",
        description: "Kunde wurde erfolgreich aktualisiert."
      });
    } catch (error) {
      console.error('Error updating customer:', error);
      toast({
        title: "Fehler",
        description: "Ein unerwarteter Fehler ist aufgetreten.",
        variant: "destructive"
      });
    }
  };

  const handleShowCustomerDetails = (customer: Customer) => {
    // Für jetzt als einfacher Alert - später kann hier ein Detail-Dialog geöffnet werden
    alert(`Details für ${customer.company_name}:\n\nKontakt: ${customer.contact_person}\nE-Mail: ${customer.email}\nStatus: ${customer.status}`);
  };

  const filteredCustomers = customers.filter(customer =>
    customer.company_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    customer.contact_person.toLowerCase().includes(searchTerm.toLowerCase()) ||
    customer.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const formatAddress = (customer: Customer) => {
    const parts = [customer.address, customer.postal_code, customer.city, customer.country].filter(Boolean);
    return parts.join(', ');
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
        <Button 
          className="bg-blue-600 hover:bg-blue-700"
          onClick={() => setIsAddCustomerOpen(true)}
        >
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
          {loading ? (
            <div className="text-center py-8">
              <p className="text-gray-500">Lade Kunden...</p>
            </div>
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
                  <Card key={customer.id} className="hover:shadow-lg transition-shadow">
                    <CardContent className="p-6">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <h3 className="text-lg font-semibold">{customer.company_name}</h3>
                            <Badge className={getStatusColor(customer.status)}>
                              {customer.status}
                            </Badge>
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
                              onClick={() => handleShowCustomerDetails(customer)}
                            >
                              Details
                            </Button>
                            <Button 
                              size="sm" 
                              className="bg-blue-600 hover:bg-blue-700"
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

      <AddCustomerDialog
        isOpen={isAddCustomerOpen}
        onClose={() => setIsAddCustomerOpen(false)}
        onCustomerAdded={handleAddCustomer}
      />

      <EditCustomerDialog
        isOpen={isEditCustomerOpen}
        onClose={() => setIsEditCustomerOpen(false)}
        customer={selectedCustomer}
        onCustomerUpdated={handleUpdateCustomer}
      />
    </div>
  );
};

export default CustomerModule;
