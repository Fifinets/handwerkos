import React, { useState } from 'react';
import { Package, Plus } from 'lucide-react';
import { useMaterials } from '@/hooks/useApi';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Material } from '@/types';

interface OfferMaterialCatalogProps {
    onSelectMaterial: (material: Material) => void;
}

export function OfferMaterialCatalog({ onSelectMaterial }: OfferMaterialCatalogProps) {
    const [searchQuery, setSearchQuery] = useState('');

    // Wir nutzen den hook "useMaterials" um auf die zentrale Tabelle zuzugreifen
    const { data: materialsResponse, isLoading, error } = useMaterials(
        { page: 1, limit: 50 },
        { search: searchQuery }
    );

    const materials = materialsResponse?.items || [];

    return (
        <div className="flex flex-col h-full bg-white animate-in slide-in-from-right duration-300">
            <div className="p-4 border-b">
                <Input
                    placeholder="Material suchen..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full text-sm"
                />
            </div>

            <ScrollArea className="flex-1">
                <div className="p-4 space-y-3">
                    {isLoading ? (
                        <div className="text-sm text-center text-muted-foreground p-4">Lade Materialien...</div>
                    ) : error ? (
                        <div className="text-sm text-center text-red-500 p-4">Fehler beim Laden.</div>
                    ) : materials.length === 0 ? (
                        <div className="text-sm text-center text-muted-foreground p-4">Keine Materialien gefunden.</div>
                    ) : (
                        materials.map((material) => (
                            <div
                                key={material.id}
                                className="border rounded-lg p-3 bg-white hover:border-emerald-500 hover:shadow-sm transition-all group flex flex-col gap-2"
                            >
                                <div className="flex items-start justify-between gap-2">
                                    <div>
                                        <div className="font-medium text-sm text-gray-900 line-clamp-2">
                                            {material.name}
                                        </div>
                                        <div className="text-xs text-muted-foreground mt-1 line-clamp-1">
                                            {material.category || 'Allgemein'} • {material.sku || 'Keine Art. Nr.'}
                                        </div>
                                    </div>
                                    <div className="p-1.5 bg-gray-100 rounded group-hover:bg-emerald-50 group-hover:text-emerald-600 transition-colors">
                                        <Package className="h-4 w-4" />
                                    </div>
                                </div>
                                <div className="flex items-center justify-between mt-2 pt-2 border-t">
                                    <div className="font-semibold text-sm text-gray-900">
                                        {new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(material.unit_price || 0)} <span className="text-xs text-muted-foreground font-normal">/{material.unit || 'Stk'}</span>
                                    </div>
                                    <Button
                                        size="sm"
                                        variant="ghost"
                                        className="h-7 text-xs bg-emerald-50 text-emerald-700 hover:bg-emerald-100 opacity-0 group-hover:opacity-100 transition-opacity"
                                        onClick={() => onSelectMaterial(material)}
                                    >
                                        <Plus className="mr-1 h-3 w-3" />
                                        Einfügen
                                    </Button>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </ScrollArea>
        </div>
    );
}
