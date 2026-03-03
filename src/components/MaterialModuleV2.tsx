import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import {
    Package,
    AlertTriangle,
    TrendingUp,
    Truck,
    Plus,
    Search,
    Filter,
    MoreHorizontal,
    ArrowRightLeft,
    Settings,
    Download
} from "lucide-react";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface Material {
    id: string;
    name: string;
    sku: string;
    category: string;
    stock: number;
    minStock: number;
    maxStock: number;
    unit: string;
    price: number;
    supplier: string;
    status: 'Verfügbar' | 'Niedrig' | 'Kritisch';
}

const mockMaterials: Material[] = [
    { id: '1', name: 'Zement CEM I 42.5', sku: 'MAT-001', category: 'Baustoffe', stock: 120, minStock: 50, maxStock: 250, unit: 'Sack', price: 8.50, supplier: 'Baustoffhandel Meier', status: 'Verfügbar' },
    { id: '2', name: 'Kupferrohr 15mm', sku: 'MAT-002', category: 'Sanitär', stock: 15, minStock: 50, maxStock: 200, unit: 'm', price: 12.00, supplier: 'Sanitärgroßhandel GmbH', status: 'Kritisch' },
    { id: '3', name: 'Gipskartonplatte 12.5mm', sku: 'MAT-003', category: 'Trockenbau', stock: 45, minStock: 40, maxStock: 150, unit: 'Stk', price: 6.80, supplier: 'Baustoffhandel Meier', status: 'Niedrig' },
    { id: '4', name: 'NYM-J 3x1.5mm²', sku: 'MAT-004', category: 'Elektro', stock: 450, minStock: 100, maxStock: 1000, unit: 'm', price: 0.85, supplier: 'Elektrobedarf Schmidt', status: 'Verfügbar' },
];

const mockOrders = [
    { id: 'ORD-2025-041', supplier: 'Sanitärgroßhandel GmbH', date: 'Heute', amount: '€1.250,00', status: 'Unterwegs' },
    { id: 'ORD-2025-040', supplier: 'Baustoffhandel Meier', date: 'Gestern', amount: '€4.890,50', status: 'Geliefert' },
    { id: 'ORD-2025-039', supplier: 'Elektrobedarf Schmidt', date: 'Vorgestern', amount: '€850,00', status: 'Geliefert' },
];

const MaterialModuleV2 = () => {
    const [searchTerm, setSearchTerm] = useState('');

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'Verfügbar': return 'bg-emerald-50 text-emerald-700 border-emerald-200';
            case 'Niedrig': return 'bg-amber-50 text-amber-700 border-amber-200';
            case 'Kritisch': return 'bg-rose-50 text-rose-700 border-rose-200';
            case 'Unterwegs': return 'bg-slate-50 text-blue-700 border-blue-200';
            case 'Geliefert': return 'bg-slate-100 text-slate-700 border-slate-200';
            default: return 'bg-slate-100 text-slate-700 border-slate-200';
        }
    };

    return (
        <div className="p-6 space-y-6 max-w-[1600px] mx-auto">
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-semibold text-slate-900">Materialwirtschaft</h1>
                    <p className="text-sm text-slate-500 mt-1">Verwalten Sie Lagerbestände, Nachbestellungen und Lieferanten.</p>
                </div>
                <div className="flex gap-2 w-full sm:w-auto">
                    <Button variant="outline" className="bg-white border-slate-200 hidden sm:flex">
                        <Download className="h-4 w-4 mr-2" />
                        Export
                    </Button>
                    <Button variant="outline" className="bg-white border-slate-200 hidden sm:flex">
                        <Truck className="h-4 w-4 mr-2" />
                        Neue Bestellung
                    </Button>
                    <Button className="bg-slate-900 hover:bg-slate-800 text-white w-full sm:w-auto">
                        <Plus className="h-4 w-4 mr-2" />
                        Material anlegen
                    </Button>
                </div>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card className="bg-white border-slate-200 shadow-sm">
                    <CardContent className="p-5 flex items-center justify-between">
                        <div>
                            <p className="text-sm font-medium text-slate-500">Lagerposten Gesamt</p>
                            <h3 className="text-2xl font-bold text-slate-900 mt-1">1.284</h3>
                        </div>
                        <div className="h-12 w-12 rounded-full bg-slate-50 flex items-center justify-center">
                            <Package className="h-6 w-6 text-slate-600" />
                        </div>
                    </CardContent>
                </Card>
                <Card className="bg-white border-slate-200 shadow-sm">
                    <CardContent className="p-5 flex items-center justify-between">
                        <div>
                            <p className="text-sm font-medium text-slate-500">Lagerwert ca.</p>
                            <h3 className="text-2xl font-bold text-slate-900 mt-1">€84.500</h3>
                        </div>
                        <div className="h-12 w-12 rounded-full bg-slate-50 flex items-center justify-center">
              <TrendingUp className="h-6 w-6 text-slate-600" />
                        </div>
                    </CardContent>
                </Card>
                <Card className="bg-white border-slate-200 shadow-sm">
                    <CardContent className="p-5 flex items-center justify-between">
                        <div>
                            <p className="text-sm font-medium text-slate-500">Kritische Bestände</p>
                            <h3 className="text-2xl font-bold text-slate-900 mt-1">12</h3>
                        </div>
                        <div className="h-12 w-12 rounded-full bg-rose-50 flex items-center justify-center">
                            <AlertTriangle className="h-6 w-6 text-rose-600" />
                        </div>
                    </CardContent>
                </Card>
                <Card className="bg-white border-slate-200 shadow-sm">
                    <CardContent className="p-5 flex items-center justify-between">
                        <div>
                            <p className="text-sm font-medium text-slate-500">Offene Bestellungen</p>
                            <h3 className="text-2xl font-bold text-slate-900 mt-1">5</h3>
                        </div>
                        <div className="h-12 w-12 rounded-full bg-slate-50 flex items-center justify-center">
                            <Truck className="h-6 w-6 text-slate-600" />
                        </div>
                    </CardContent>
                </Card>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                {/* Main List */}
                <div className="xl:col-span-2 space-y-4">
                    <Card className="bg-white border-slate-200 shadow-sm h-full flex flex-col">
                        <CardHeader className="p-4 border-b border-slate-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                            <CardTitle className="text-lg font-semibold text-slate-900">Lagerbestand</CardTitle>
                            <div className="flex gap-2 w-full sm:w-auto">
                                <div className="relative flex-1 sm:w-64">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                                    <Input
                                        placeholder="Suchen (Name, Art-Nr)..."
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        className="pl-9 bg-slate-50 border-slate-200 h-9"
                                    />
                                </div>
                                <Button variant="outline" size="sm" className="bg-white border-slate-200 h-9">
                                    <Filter className="h-4 w-4" />
                                </Button>
                            </div>
                        </CardHeader>
                        <CardContent className="p-0 flex-1 overflow-auto">
                            <table className="w-full text-sm text-left whitespace-nowrap">
                                <thead className="bg-slate-50/50 text-slate-500 font-medium border-b border-slate-100 sticky top-0">
                                    <tr>
                                        <th className="px-5 py-3 font-medium">Material</th>
                                        <th className="px-5 py-3 font-medium">Kategorie</th>
                                        <th className="px-5 py-3 font-medium">Bestand</th>
                                        <th className="px-5 py-3 font-medium">Status</th>
                                        <th className="px-5 py-3 font-medium text-right">Bewertung / Stk.</th>
                                        <th className="px-5 py-3 font-medium text-center">Aktionen</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {mockMaterials.map((material) => (
                                        <tr key={material.id} className="hover:bg-slate-50/50 transition-colors">
                                            <td className="px-5 py-3">
                                                <div className="font-medium text-slate-900">{material.name}</div>
                                                <div className="text-xs text-slate-500">{material.sku}</div>
                                            </td>
                                            <td className="px-5 py-3 text-slate-600">{material.category}</td>
                                            <td className="px-5 py-3">
                                                <div className="flex flex-col gap-1 w-24">
                                                    <div className="flex justify-between text-xs font-medium">
                                                        <span>{material.stock} {material.unit}</span>
                                                    </div>
                                                    <Progress
                                                        value={(material.stock / material.maxStock) * 100}
                                                        className={`h-1.5 ${material.status === 'Kritisch' ? 'bg-rose-100' :
                                                                material.status === 'Niedrig' ? 'bg-amber-100' : 'bg-emerald-100'
                                                            }`}
                                                    />
                                                </div>
                                            </td>
                                            <td className="px-5 py-3">
                                                <Badge variant="outline" className={`font-normal text-[10px] px-1.5 py-0 ${getStatusColor(material.status)}`}>
                                                    {material.status}
                                                </Badge>
                                            </td>
                                            <td className="px-5 py-3 text-right">
                                                <div className="font-medium text-slate-900">€{material.price.toFixed(2)}</div>
                                                <div className="text-xs text-slate-500 truncate max-w-[120px]" title={material.supplier}>{material.supplier}</div>
                                            </td>
                                            <td className="px-5 py-3 text-center">
                                                <DropdownMenu>
                                                    <DropdownMenuTrigger asChild>
                                                        <Button variant="ghost" className="h-8 w-8 p-0 text-slate-400 hover:text-slate-900">
                                                            <MoreHorizontal className="h-4 w-4" />
                                                        </Button>
                                                    </DropdownMenuTrigger>
                                                    <DropdownMenuContent align="end">
                                                        <DropdownMenuItem>Bestand buchen</DropdownMenuItem>
                                                        <DropdownMenuItem>Nachbestellen</DropdownMenuItem>
                                                        <DropdownMenuSeparator />
                                                        <DropdownMenuItem>Bearbeiten</DropdownMenuItem>
                                                    </DropdownMenuContent>
                                                </DropdownMenu>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </CardContent>
                    </Card>
                </div>

                {/* Sidebar: Orders & Actions */}
                <div className="space-y-6">
                    <Card className="bg-white border-slate-200 shadow-sm">
                        <CardHeader className="p-4 border-b border-slate-100 flex flex-row items-center justify-between">
                            <CardTitle className="text-base font-semibold text-slate-900">Schnellaktionen</CardTitle>
                        </CardHeader>
                        <CardContent className="p-2">
                            <div className="flex flex-col gap-1">
                                <Button variant="ghost" className="w-full justify-start text-slate-600 font-normal hover:bg-slate-50">
                                    <ArrowRightLeft className="h-4 w-4 mr-3 text-slate-400" />
                                    Wareneingang / Warenausgang
                                </Button>
                                <Button variant="ghost" className="w-full justify-start text-slate-600 font-normal hover:bg-slate-50">
                                    <Package className="h-4 w-4 mr-3 text-slate-400" />
                                    Inventur starten
                                </Button>
                                <Button variant="ghost" className="w-full justify-start text-slate-600 font-normal hover:bg-slate-50">
                                    <Settings className="h-4 w-4 mr-3 text-slate-400" />
                                    Lagerorte verwalten
                                </Button>
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="bg-white border-slate-200 shadow-sm">
                        <CardHeader className="p-4 border-b border-slate-100 flex flex-row items-center justify-between">
                            <CardTitle className="text-base font-semibold text-slate-900">Letzte Bestellungen</CardTitle>
                            <Button variant="link" className="text-xs text-slate-500 p-0 h-auto">Alle ansehen</Button>
                        </CardHeader>
                        <CardContent className="p-4">
                            <div className="space-y-4">
                                {mockOrders.map((order) => (
                                    <div key={order.id} className="flex justify-between items-start">
                                        <div>
                                            <div className="font-medium text-sm text-slate-900">{order.id}</div>
                                            <div className="text-xs text-slate-500 mb-1">{order.supplier}</div>
                                            <Badge variant="outline" className={`font-normal text-[10px] px-1.5 py-0 ${getStatusColor(order.status)}`}>
                                                {order.status}
                                            </Badge>
                                        </div>
                                        <div className="text-right">
                                            <div className="font-semibold text-sm text-slate-900">{order.amount}</div>
                                            <div className="text-xs text-slate-500">{order.date}</div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
};

export default MaterialModuleV2;


