import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
    Users,
    Plus,
    Search,
    Phone,
    Mail,
    MapPin,
    Calendar,
    FileText,
    Euro,
    TrendingUp,
    Building2,
    UserCheck,
    Filter,
    MoreHorizontal
} from "lucide-react";
import { Customer } from "@/types";
import { useCustomers, useCreateCustomer, useUpdateCustomer } from "@/hooks/useApi";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import AddCustomerDialog from "./AddCustomerDialog";
import EditCustomerDialog from "./EditCustomerDialog";

const CustomerModuleV2 = () => {
    const [searchTerm, setSearchTerm] = useState('');
    const [isAddCustomerOpen, setIsAddCustomerOpen] = useState(false);
    const [isEditCustomerOpen, setIsEditCustomerOpen] = useState(false);
    const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);

    // React Query hooks for data management
    const { data: customersResponse, isLoading, error } = useCustomers(
        undefined,
        searchTerm.length >= 2 ? { search: searchTerm } : undefined
    );

    const createCustomerMutation = useCreateCustomer();
    const updateCustomerMutation = useUpdateCustomer();

    const customers = customersResponse?.items || [];

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'Aktiv': return 'bg-emerald-50 text-emerald-700 border-emerald-200';
            case 'Premium': return 'bg-slate-50 text-purple-700 border-purple-200';
            case 'Inaktiv': return 'bg-slate-100 text-slate-700 border-slate-200';
            default: return 'bg-slate-100 text-slate-700 border-slate-200';
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

    const filteredCustomers = searchTerm.length >= 2 ? customers : customers.filter(customer =>
        (customer.company_name && customer.company_name.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (customer.contact_person && customer.contact_person.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (customer.email && customer.email.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    const formatAddress = (customer: Customer) => {
        const parts = [customer.address, customer.postal_code, customer.city, customer.country].filter(Boolean);
        return parts.join(', ');
    };

    return (
        <div className="p-6 space-y-6 max-w-[1600px] mx-auto">
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-semibold text-slate-900">Kundenstamm</h1>
                    <p className="text-sm text-slate-500 mt-1">Verwalten Sie Ihre Firmen- und Privatkunden.</p>
                </div>
                <div className="flex items-center gap-3 w-full sm:w-auto">
                    <Button variant="outline" className="bg-white border-slate-200 hidden sm:flex">
                        <FileText className="h-4 w-4 mr-2" />
                        Exportieren
                    </Button>
                    <Button
                        onClick={() => setIsAddCustomerOpen(true)}
                        className="bg-slate-900 hover:bg-slate-800 text-white w-full sm:w-auto"
                    >
                        <Plus className="h-4 w-4 mr-2" />
                        Neuer Kunde
                    </Button>
                </div>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card className="bg-white border-slate-200 shadow-sm">
                    <CardContent className="p-5 flex items-center justify-between">
                        <div>
                            <p className="text-sm font-medium text-slate-500">Aktive Kunden</p>
                            <h3 className="text-2xl font-bold text-slate-900 mt-1">{customers.filter(c => c.status === 'Aktiv' || c.status === 'Premium').length}</h3>
                        </div>
                        <div className="h-12 w-12 rounded-full bg-slate-50 flex items-center justify-center">
                            <Users className="h-6 w-6 text-slate-600" />
                        </div>
                    </CardContent>
                </Card>
                <Card className="bg-white border-slate-200 shadow-sm">
                    <CardContent className="p-5 flex items-center justify-between">
                        <div>
                            <p className="text-sm font-medium text-slate-500">Premium Kunden</p>
                            <h3 className="text-2xl font-bold text-slate-900 mt-1">{customers.filter(c => c.status === 'Premium').length}</h3>
                        </div>
                        <div className="h-12 w-12 rounded-full bg-slate-50 flex items-center justify-center">
                            <UserCheck className="h-6 w-6 text-slate-600" />
                        </div>
                    </CardContent>
                </Card>
                <Card className="bg-white border-slate-200 shadow-sm">
                    <CardContent className="p-5 flex items-center justify-between">
                        <div>
                            <p className="text-sm font-medium text-slate-500">Neu im Monat</p>
                            <h3 className="text-2xl font-bold text-slate-900 mt-1">12</h3>
                        </div>
                        <div className="h-12 w-12 rounded-full bg-emerald-50 flex items-center justify-center">
                            <TrendingUp className="h-6 w-6 text-emerald-600" />
                        </div>
                    </CardContent>
                </Card>
                <Card className="bg-white border-slate-200 shadow-sm">
                    <CardContent className="p-5 flex items-center justify-between">
                        <div>
                            <p className="text-sm font-medium text-slate-500">Kundenumfang</p>
                            <h3 className="text-2xl font-bold text-slate-900 mt-1">€124.5K</h3>
                        </div>
                        <div className="h-12 w-12 rounded-full bg-amber-50 flex items-center justify-center">
                            <Euro className="h-6 w-6 text-amber-600" />
                        </div>
                    </CardContent>
                </Card>
            </div>

            <Tabs defaultValue="customers" className="space-y-6">
                <TabsList className="bg-slate-100/50 p-1 border border-slate-200">
                    <TabsTrigger value="customers" className="data-[state=active]:bg-white data-[state=active]:shadow-sm">Kundenübersicht</TabsTrigger>
                    <TabsTrigger value="map" className="data-[state=active]:bg-white data-[state=active]:shadow-sm">Kundenkarte</TabsTrigger>
                </TabsList>

                <TabsContent value="customers" className="space-y-4 m-0">
                    {/* Search Bar */}
                    <div className="flex gap-4">
                        <div className="relative flex-1 max-w-md">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                            <Input
                                placeholder="Firmenname, Kontakt oder E-Mail suchen..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="pl-9 bg-white border-slate-200"
                            />
                        </div>
                        <Button variant="outline" className="bg-white border-slate-200">
                            <Filter className="h-4 w-4 mr-2" />
                            Filter
                        </Button>
                    </div>

                    <Card className="bg-white border-slate-200 shadow-sm overflow-hidden">
                        <CardContent className="p-0">
                            {isLoading ? (
                                <div className="p-6 space-y-4">
                                    {Array(4).fill(0).map((_, i) => (
                                        <div key={i} className="flex flex-col space-y-3">
                                            <Skeleton className="h-[70px] w-full rounded-lg" />
                                        </div>
                                    ))}
                                </div>
                            ) : filteredCustomers.length === 0 ? (
                                <div className="p-12 text-center flex flex-col items-center">
                                    <div className="h-16 w-16 bg-slate-50 rounded-full flex items-center justify-center mb-4">
                                        <Users className="h-8 w-8 text-slate-400" />
                                    </div>
                                    <h3 className="text-lg font-medium text-slate-900 mb-1">Keine Kunden gefunden</h3>
                                    <p className="text-sm text-slate-500 max-w-sm">
                                        {searchTerm ? `Keine Ergebnisse für "${searchTerm}" gefunden.` : 'Sie haben noch keine Kunden angelegt.'}
                                    </p>
                                </div>
                            ) : (
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm text-left">
                                        <thead className="bg-slate-50 text-slate-500 font-medium border-b border-slate-100">
                                            <tr>
                                                <th className="px-5 py-3 font-medium">Unternehmen / Kontakt</th>
                                                <th className="px-5 py-3 font-medium">Kontaktdaten</th>
                                                <th className="px-5 py-3 font-medium">Adresse</th>
                                                <th className="px-5 py-3 font-medium text-center">Status</th>
                                                <th className="px-5 py-3 font-medium text-right">Aktionen</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {filteredCustomers.map((customer) => (
                                                <tr key={customer.id} className="hover:bg-slate-50 transition-colors cursor-pointer" onClick={() => handleEditCustomer(customer)}>
                                                    <td className="px-5 py-4">
                                                        <div className="flex items-start gap-3">
                                                            <div className="h-10 w-10 flex-shrink-0 bg-slate-100 rounded-full flex items-center justify-center text-slate-500 font-semibold">
                                                                {(customer.company_name || customer.contact_person || 'U')[0].toUpperCase()}
                                                            </div>
                                                            <div>
                                                                <div className="font-semibold text-slate-900">{customer.company_name || 'Privatkunde'}</div>
                                                                <div className="text-slate-500">{customer.contact_person}</div>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="px-5 py-4 text-slate-600">
                                                        <div className="flex flex-col gap-1">
                                                            {customer.email && (
                                                                <div className="flex items-center gap-1.5"><Mail className="h-3.5 w-3.5 text-slate-400 flex-shrink-0" /><span className="truncate max-w-[150px]">{customer.email}</span></div>
                                                            )}
                                                            {customer.phone && (
                                                                <div className="flex items-center gap-1.5"><Phone className="h-3.5 w-3.5 text-slate-400 flex-shrink-0" />{customer.phone}</div>
                                                            )}
                                                        </div>
                                                    </td>
                                                    <td className="px-5 py-4 text-slate-600">
                                                        <div className="flex items-start gap-1.5 max-w-[250px]">
                                                            <MapPin className="h-3.5 w-3.5 text-slate-400 flex-shrink-0 mt-0.5" />
                                                            <span className="line-clamp-2 leading-relaxed">{formatAddress(customer) || '-'}</span>
                                                        </div>
                                                    </td>
                                                    <td className="px-5 py-4 text-center">
                                                        <Badge variant="outline" className={`font-normal ${getStatusColor(customer.status || 'Aktiv')}`}>
                                                            {customer.status || 'Aktiv'}
                                                        </Badge>
                                                    </td>
                                                    <td className="px-5 py-4 text-right" onClick={(e) => e.stopPropagation()}>
                                                        <DropdownMenu>
                                                            <DropdownMenuTrigger asChild>
                                                                <Button variant="ghost" className="h-8 w-8 p-0">
                                                                    <MoreHorizontal className="h-4 w-4" />
                                                                </Button>
                                                            </DropdownMenuTrigger>
                                                            <DropdownMenuContent align="end">
                                                                <DropdownMenuItem onClick={() => handleEditCustomer(customer)}>Bearbeiten</DropdownMenuItem>
                                                                <DropdownMenuItem>Projekte ansehen</DropdownMenuItem>
                                                                <DropdownMenuSeparator />
                                                                <DropdownMenuItem className="text-rose-600">Löschen</DropdownMenuItem>
                                                            </DropdownMenuContent>
                                                        </DropdownMenu>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="map" className="m-0">
                    <Card className="bg-white border-slate-200 shadow-sm p-12 text-center text-slate-500">
                        Kundenkarte wird geladen...
                    </Card>
                </TabsContent>
            </Tabs>

            <AddCustomerDialog
                isOpen={isAddCustomerOpen}
                onClose={() => setIsAddCustomerOpen(false)}
                onCustomerAdded={handleAddCustomer}
            />

            {selectedCustomer && (
                <EditCustomerDialog
                    isOpen={isEditCustomerOpen}
                    onClose={() => setIsEditCustomerOpen(false)}
                    customer={selectedCustomer}
                    onCustomerUpdated={handleUpdateCustomer}
                />
            )}
        </div>
    );
};

export default CustomerModuleV2;

