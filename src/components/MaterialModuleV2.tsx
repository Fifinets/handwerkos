import React, { useState, useEffect } from 'react';
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
import { supabase } from '@/integrations/supabase/client';
import { useSupabaseAuth } from '@/hooks/useSupabaseAuth';
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

const MaterialModuleV2 = () => {
    const { companyId } = useSupabaseAuth();
    const { toast } = useToast();
    const [searchTerm, setSearchTerm] = useState('');
    const [materials, setMaterials] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [recentMovements, setRecentMovements] = useState<any[]>([]);
    const [showAddDialog, setShowAddDialog] = useState(false);
    const [showStockDialog, setShowStockDialog] = useState(false);
    const [selectedMaterial, setSelectedMaterial] = useState<any>(null);
    const [stockAdjustment, setStockAdjustment] = useState({ quantity: 0, notes: '' });
    const [newMaterial, setNewMaterial] = useState({
        name: '', category: '', unit: 'Stk', current_stock: 0, min_stock: 0, unit_price: 0, supplier: ''
    });

    const fetchMaterials = async () => {
        if (!companyId) return;
        setIsLoading(true);
        const { data, error } = await supabase
            .from('materials')
            .select('*')
            .eq('company_id', companyId)
            .order('name');
        if (error) console.error('Error loading materials:', error);
        setMaterials(data || []);

        const { data: movements } = await supabase
            .from('material_stock_movements')
            .select('*, materials(name)')
            .order('created_at', { ascending: false })
            .limit(5);
        setRecentMovements(movements || []);

        setIsLoading(false);
    };

    useEffect(() => {
        fetchMaterials();
    }, [companyId]);

    const totalItems = materials.length;
    const lowStock = materials.filter(m => (m.current_stock || 0) <= (m.min_stock || 0)).length;
    const totalValue = materials.reduce((s, m) => s + ((m.current_stock || 0) * (m.unit_price || 0)), 0);

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(amount);
    };

    const getStockStatus = (m: any) => {
        const stock = m.current_stock || 0;
        const min = m.min_stock || 0;
        if (stock <= 0) return 'Kritisch';
        if (stock <= min) return 'Niedrig';
        return 'Verfügbar';
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'Verfügbar': return 'bg-emerald-50 text-emerald-700 border-emerald-200';
            case 'Niedrig': return 'bg-amber-50 text-amber-700 border-amber-200';
            case 'Kritisch': return 'bg-rose-50 text-rose-700 border-rose-200';
            default: return 'bg-slate-100 text-slate-700 border-slate-200';
        }
    };

    const filteredMaterials = materials.filter(m =>
        m.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (m.sku || '').toLowerCase().includes(searchTerm.toLowerCase())
    );

    const handleAddMaterial = async () => {
        if (!newMaterial.name || !companyId) return;
        const { error } = await supabase.from('materials').insert({
            company_id: companyId,
            name: newMaterial.name,
            category: newMaterial.category || null,
            unit: newMaterial.unit,
            current_stock: newMaterial.current_stock,
            min_stock: newMaterial.min_stock,
            unit_price: newMaterial.unit_price || null,
            supplier: newMaterial.supplier || null,
        });
        if (error) {
            toast({ title: 'Fehler', description: error.message, variant: 'destructive' });
            return;
        }
        toast({ title: 'Material angelegt' });
        setShowAddDialog(false);
        setNewMaterial({ name: '', category: '', unit: 'Stk', current_stock: 0, min_stock: 0, unit_price: 0, supplier: '' });
        fetchMaterials();
    };

    const handleStockAdjustment = async () => {
        if (!selectedMaterial || stockAdjustment.quantity === 0 || !companyId) return;
        const { error: moveError } = await supabase.from('material_stock_movements').insert({
            material_id: selectedMaterial.id,
            quantity: stockAdjustment.quantity,
            movement_type: 'adjustment',
            reason: stockAdjustment.notes || null,
        });
        if (moveError) {
            toast({ title: 'Fehler', description: moveError.message, variant: 'destructive' });
            return;
        }
        const newStock = (selectedMaterial.current_stock || 0) + stockAdjustment.quantity;
        await supabase.from('materials').update({ current_stock: newStock }).eq('id', selectedMaterial.id);
        toast({ title: 'Bestand aktualisiert' });
        setShowStockDialog(false);
        setStockAdjustment({ quantity: 0, notes: '' });
        setSelectedMaterial(null);
        fetchMaterials();
    };

    const formatMovementDate = (dateStr: string | null) => {
        if (!dateStr) return '—';
        const date = new Date(dateStr);
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
        if (diffDays === 0) return 'Heute';
        if (diffDays === 1) return 'Gestern';
        if (diffDays === 2) return 'Vorgestern';
        return date.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' });
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
                    <Button className="bg-slate-900 hover:bg-slate-800 text-white w-full sm:w-auto" onClick={() => setShowAddDialog(true)}>
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
                            {isLoading ? (
                                <Skeleton className="h-8 w-16 mt-1" />
                            ) : (
                                <h3 className="text-2xl font-bold text-slate-900 mt-1">{totalItems}</h3>
                            )}
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
                            {isLoading ? (
                                <Skeleton className="h-8 w-24 mt-1" />
                            ) : (
                                <h3 className="text-2xl font-bold text-slate-900 mt-1">{formatCurrency(totalValue)}</h3>
                            )}
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
                            {isLoading ? (
                                <Skeleton className="h-8 w-12 mt-1" />
                            ) : (
                                <h3 className="text-2xl font-bold text-slate-900 mt-1">{lowStock}</h3>
                            )}
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
                            <h3 className="text-2xl font-bold text-slate-900 mt-1">0</h3>
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
                            {isLoading ? (
                                <div className="p-5 space-y-4">
                                    {[1, 2, 3, 4].map(i => (
                                        <div key={i} className="flex gap-4 items-center">
                                            <Skeleton className="h-5 w-40" />
                                            <Skeleton className="h-5 w-20" />
                                            <Skeleton className="h-5 w-24" />
                                            <Skeleton className="h-5 w-16" />
                                            <Skeleton className="h-5 w-20" />
                                        </div>
                                    ))}
                                </div>
                            ) : filteredMaterials.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-16 text-slate-500">
                                    <Package className="h-12 w-12 text-slate-300 mb-3" />
                                    <p className="text-sm font-medium">Noch keine Materialien angelegt.</p>
                                    <p className="text-xs text-slate-400 mt-1">Legen Sie Ihr erstes Material an, um loszulegen.</p>
                                </div>
                            ) : (
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
                                        {filteredMaterials.map((material) => {
                                            const status = getStockStatus(material);
                                            const stockProgress = ((material.current_stock || 0) / (material.max_stock || 100)) * 100;
                                            return (
                                                <tr key={material.id} className="hover:bg-slate-50/50 transition-colors">
                                                    <td className="px-5 py-3">
                                                        <div className="font-medium text-slate-900">{material.name}</div>
                                                        <div className="text-xs text-slate-500">{material.sku || '\u2014'}</div>
                                                    </td>
                                                    <td className="px-5 py-3 text-slate-600">{material.category || '\u2014'}</td>
                                                    <td className="px-5 py-3">
                                                        <div className="flex flex-col gap-1 w-24">
                                                            <div className="flex justify-between text-xs font-medium">
                                                                <span>{material.current_stock || 0} {material.unit}</span>
                                                            </div>
                                                            <Progress
                                                                value={Math.min(stockProgress, 100)}
                                                                className={`h-1.5 ${status === 'Kritisch' ? 'bg-rose-100' :
                                                                        status === 'Niedrig' ? 'bg-amber-100' : 'bg-emerald-100'
                                                                    }`}
                                                            />
                                                        </div>
                                                    </td>
                                                    <td className="px-5 py-3">
                                                        <Badge variant="outline" className={`font-normal text-[10px] px-1.5 py-0 ${getStatusColor(status)}`}>
                                                            {status}
                                                        </Badge>
                                                    </td>
                                                    <td className="px-5 py-3 text-right">
                                                        <div className="font-medium text-slate-900">{'\u20AC'}{(material.unit_price || 0).toFixed(2)}</div>
                                                        <div className="text-xs text-slate-500 truncate max-w-[120px]" title={material.supplier || ''}>{material.supplier || '\u2014'}</div>
                                                    </td>
                                                    <td className="px-5 py-3 text-center">
                                                        <DropdownMenu>
                                                            <DropdownMenuTrigger asChild>
                                                                <Button variant="ghost" className="h-8 w-8 p-0 text-slate-400 hover:text-slate-900">
                                                                    <MoreHorizontal className="h-4 w-4" />
                                                                </Button>
                                                            </DropdownMenuTrigger>
                                                            <DropdownMenuContent align="end">
                                                                <DropdownMenuItem onClick={() => {
                                                                    setSelectedMaterial(material);
                                                                    setStockAdjustment({ quantity: 0, notes: '' });
                                                                    setShowStockDialog(true);
                                                                }}>Bestand buchen</DropdownMenuItem>
                                                                <DropdownMenuItem>Nachbestellen</DropdownMenuItem>
                                                                <DropdownMenuSeparator />
                                                                <DropdownMenuItem>Bearbeiten</DropdownMenuItem>
                                                            </DropdownMenuContent>
                                                        </DropdownMenu>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            )}
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
                            <CardTitle className="text-base font-semibold text-slate-900">Letzte Bewegungen</CardTitle>
                            <Button variant="link" className="text-xs text-slate-500 p-0 h-auto">Alle ansehen</Button>
                        </CardHeader>
                        <CardContent className="p-4">
                            {isLoading ? (
                                <div className="space-y-4">
                                    {[1, 2, 3].map(i => (
                                        <div key={i} className="flex justify-between">
                                            <Skeleton className="h-10 w-32" />
                                            <Skeleton className="h-10 w-16" />
                                        </div>
                                    ))}
                                </div>
                            ) : recentMovements.length === 0 ? (
                                <p className="text-sm text-slate-500 text-center py-4">Keine Bewegungen vorhanden.</p>
                            ) : (
                                <div className="space-y-4">
                                    {recentMovements.map((movement) => (
                                        <div key={movement.id} className="flex justify-between items-start">
                                            <div>
                                                <div className="font-medium text-sm text-slate-900">
                                                    {(movement.materials as { name?: string } | null)?.name || 'Material'}
                                                </div>
                                                <div className="text-xs text-slate-500 mb-1">{movement.movement_type}</div>
                                                <Badge variant="outline" className={`font-normal text-[10px] px-1.5 py-0 ${movement.quantity > 0 ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-rose-50 text-rose-700 border-rose-200'}`}>
                                                    {movement.quantity > 0 ? '+' : ''}{movement.quantity}
                                                </Badge>
                                            </div>
                                            <div className="text-right">
                                                <div className="text-xs text-slate-500">{formatMovementDate(movement.created_at)}</div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>
            </div>

            {/* Add Material Dialog */}
            <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Material anlegen</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label htmlFor="mat-name">Name *</Label>
                            <Input
                                id="mat-name"
                                value={newMaterial.name}
                                onChange={(e) => setNewMaterial({ ...newMaterial, name: e.target.value })}
                                placeholder="z.B. Zement CEM I 42.5"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="mat-category">Kategorie</Label>
                            <Input
                                id="mat-category"
                                value={newMaterial.category}
                                onChange={(e) => setNewMaterial({ ...newMaterial, category: e.target.value })}
                                placeholder="z.B. Baustoffe"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Einheit</Label>
                            <Select value={newMaterial.unit} onValueChange={(v) => setNewMaterial({ ...newMaterial, unit: v })}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="Stk">Stk</SelectItem>
                                    <SelectItem value="m">m</SelectItem>
                                    <SelectItem value="kg">kg</SelectItem>
                                    <SelectItem value="l">l</SelectItem>
                                    <SelectItem value="Sack">Sack</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="mat-stock">Anfangsbestand</Label>
                                <Input
                                    id="mat-stock"
                                    type="number"
                                    value={newMaterial.current_stock}
                                    onChange={(e) => setNewMaterial({ ...newMaterial, current_stock: Number(e.target.value) })}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="mat-min">Mindestbestand</Label>
                                <Input
                                    id="mat-min"
                                    type="number"
                                    value={newMaterial.min_stock}
                                    onChange={(e) => setNewMaterial({ ...newMaterial, min_stock: Number(e.target.value) })}
                                />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="mat-price">Einzelpreis ({'\u20AC'})</Label>
                            <Input
                                id="mat-price"
                                type="number"
                                step="0.01"
                                value={newMaterial.unit_price}
                                onChange={(e) => setNewMaterial({ ...newMaterial, unit_price: Number(e.target.value) })}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="mat-supplier">Lieferant</Label>
                            <Input
                                id="mat-supplier"
                                value={newMaterial.supplier}
                                onChange={(e) => setNewMaterial({ ...newMaterial, supplier: e.target.value })}
                                placeholder="z.B. Baustoffhandel Meier"
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShowAddDialog(false)}>Abbrechen</Button>
                        <Button onClick={handleAddMaterial} disabled={!newMaterial.name}>Anlegen</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Stock Adjustment Dialog */}
            <Dialog open={showStockDialog} onOpenChange={setShowStockDialog}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Bestand buchen: {selectedMaterial?.name}</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="text-sm text-slate-500">
                            Aktueller Bestand: <span className="font-medium text-slate-900">{selectedMaterial?.current_stock || 0} {selectedMaterial?.unit}</span>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="stock-qty">Menge (+/-)</Label>
                            <Input
                                id="stock-qty"
                                type="number"
                                value={stockAdjustment.quantity}
                                onChange={(e) => setStockAdjustment({ ...stockAdjustment, quantity: Number(e.target.value) })}
                                placeholder="z.B. 10 oder -5"
                            />
                            <p className="text-xs text-slate-500">Positive Werte = Zugang, negative Werte = Abgang</p>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="stock-notes">Bemerkung</Label>
                            <Textarea
                                id="stock-notes"
                                value={stockAdjustment.notes}
                                onChange={(e) => setStockAdjustment({ ...stockAdjustment, notes: e.target.value })}
                                placeholder="Grund der Buchung..."
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShowStockDialog(false)}>Abbrechen</Button>
                        <Button onClick={handleStockAdjustment} disabled={stockAdjustment.quantity === 0}>Buchen</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
};

export default MaterialModuleV2;
