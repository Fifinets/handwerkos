import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, MoreVertical, Eye, FileCheck, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { OfferSidebar } from '@/components/offers/OfferSidebar';
import { OfferItemsEditor } from '@/components/offers/OfferItemsEditor';
import { useOffer, useUpdateOffer } from '@/hooks/useApi';
import { OfferItem, OfferItemCreate } from '@/types/offer';

export default function OfferEditorPage() {
    const { id } = useParams();
    const navigate = useNavigate();
    const { toast } = useToast();
    const isNew = id === 'new'; // Special case for new offer simulation

    const [isSidebarOpen, setIsSidebarOpen] = useState(true);
    const [title, setTitle] = useState(isNew ? 'Neues Angebot' : 'Lade...');

    // Mock data for UI development if isNew
    // State for items
    const [items, setItems] = useState<((OfferItem | OfferItemCreate) & { temp_id?: string })[]>([]);

    const handleAddItem = (type: string) => {
        let itemType: OfferItem['item_type'] = 'labor';
        let description = 'Neue Position';
        let unit = 'Stk'; // Default changed to Stk based on feedback or keep logic

        if (type === 'title') {
            itemType = 'title';
            description = '<b>Neue Überschrift</b>';
            unit = 'psch';
        } else if (type === 'text') {
            itemType = 'text';
            description = 'Neuer Textbaustein';
            unit = 'psch';
        } else if (type === 'position') {
            itemType = 'labor';
            description = 'Neue Position';
            unit = 'Std';
        } else if (type === 'page_break') {
            itemType = 'page_break';
            description = '--- Seitenumbruch ---';
            unit = 'psch';
        }

        const newItem: OfferItemCreate & { temp_id?: string } = {
            position_number: items.length + 1,
            description,
            quantity: 1,
            unit,
            unit_price_net: 0,
            vat_rate: 19,
            item_type: itemType,
            is_optional: false,
            temp_id: crypto.randomUUID(), // Generate stable ID for DnD
        };

        setItems([...items, newItem]);

        toast({
            title: "Element hinzugefügt",
            description: `Element vom Typ "${type}" wurde angefügt.`
        });
    };

    return (
        <div className="flex h-screen bg-gray-100 overflow-hidden">
            {/* Main Content Area */}
            <div className="flex-1 flex flex-col min-w-0">

                {/* Top Header */}
                <header className="bg-white border-b px-6 py-3 flex items-center justify-between shadow-sm z-10">
                    <div className="flex items-center gap-4">
                        <Button variant="ghost" size="icon" onClick={() => navigate('/offers/wizard')}>
                            <ArrowLeft className="h-5 w-5" />
                        </Button>
                        <div className="flex flex-col">
                            <div className="flex items-center gap-2">
                                <span className="font-semibold text-gray-900 text-lg">
                                    {isNew ? 'Neues Angebot' : 'Angebot #1234'}
                                </span>
                                <span className="px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-700 text-xs font-medium">
                                    Entwurf
                                </span>
                            </div>
                            <span className="text-xs text-muted-foreground">Zuletzt gespeichert: Gerade eben</span>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <Button variant="ghost" size="sm">
                            <Eye className="mr-2 h-4 w-4" />
                            Vorschau
                        </Button>
                        <Button className="bg-emerald-600 hover:bg-emerald-700 text-white">
                            <FileCheck className="mr-2 h-4 w-4" />
                            Fertigstellen
                        </Button>
                        <Button variant="ghost" size="icon">
                            <MoreVertical className="h-5 w-5" />
                        </Button>
                    </div>
                </header>

                {/* Document Canvas */}
                <main className="flex-1 overflow-y-auto p-8 flex justify-center bg-gray-100">
                    <div className="w-full max-w-4xl pb-20">

                        {/* Header Content Definition */}
                        {(() => {
                            const headerContent = (
                                <>
                                    <div className="grid grid-cols-2 gap-12 pb-8 border-b border-gray-100">
                                        {/* Empfänger */}
                                        <div className="space-y-4 pointer-events-none opacity-50">
                                            <div>
                                                <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Empfänger</span>
                                                <div className="mt-2 text-sm text-gray-600">
                                                    <p>Musterkunde GmbH</p>
                                                    <p>Max Mustermann</p>
                                                    <p>Musterstraße 123</p>
                                                    <p>12345 Musterstadt</p>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Metadata */}
                                        <div className="space-y-4">
                                            <div className="grid grid-cols-[100px_1fr] gap-2 text-sm">
                                                <span className="text-gray-500">Datum</span>
                                                <span className="font-medium">28.01.2026</span>

                                                <span className="text-gray-500">Bearbeiter</span>
                                                <span className="font-medium">Filip (Du)</span>

                                                <span className="text-gray-500">Gültig bis</span>
                                                <span className="font-medium">11.02.2026</span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Title Subject */}
                                    <div className="mt-8 mb-4">
                                        <Input
                                            className="text-2xl font-bold border-none shadow-none px-0 focus-visible:ring-0 placeholder:text-gray-300 h-auto"
                                            placeholder="Betreff eingeben..."
                                            defaultValue="Angebot: Badsanierung Musterstraße"
                                        />
                                        <Input
                                            className="mt-2 border-none shadow-none px-0 focus-visible:ring-0 text-gray-600"
                                            placeholder="Einleitungstext (optional)..."
                                            defaultValue="Sehr geehrte Damen und Herren, anbei erhalten Sie unser Angebot:"
                                        />
                                    </div>
                                </>
                            );

                            const footerContent = (
                                <div className="border-t pt-8 mt-4">
                                    <p>Mit freundlichen Grüßen</p>
                                    <div className="h-16"></div> {/* Returns signature space */}
                                    <p>Filip</p>
                                </div>
                            );

                            return (
                                <OfferItemsEditor
                                    items={items}
                                    onChange={setItems}
                                    header={headerContent}
                                    footer={footerContent}
                                />
                            );
                        })()}

                    </div>
                </main>
            </div>

            {/* Right Sidebar */}
            <OfferSidebar
                isOpen={isSidebarOpen}
                onAddItem={handleAddItem}
            />
        </div>
    );
}
