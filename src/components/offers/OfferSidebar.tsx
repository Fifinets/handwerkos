import React from 'react';
import { Search, History, MessageSquare, Type, Heading, List, Image as ImageIcon, Scissors, Package, Wrench, HardHat, FileText, BadgePercent, SplitSquareHorizontal, MessageSquareText } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { OfferMaterialCatalog } from './OfferMaterialCatalog';
import { AIOfferAssistant } from './AIOfferAssistant';
import type { AIGeneratedPosition } from '@/types/aiOffer';
import { Material } from '@/types';

interface OfferSidebarProps {
    onAddItem: (type: string, data?: any) => void;
    isOpen: boolean;
    projectName?: string;
    customerName?: string;
    onAcceptAIPositions?: (positions: AIGeneratedPosition[]) => void;
}

const POSITION_TYPES = [
    {
        label: 'Leistung', desc: 'Arbeitszeit oder Montageleistung',
        unit: 'Std', price: 75, type: 'labor', icon: HardHat,
        color: 'text-blue-700 bg-blue-50 border-blue-200 hover:bg-blue-100',
    },
    {
        label: 'Pauschale', desc: 'Festpreis für eine Leistung',
        unit: 'psch', price: 0, type: 'lump_sum', icon: Wrench,
        color: 'text-slate-700 bg-slate-50 border-slate-200 hover:bg-slate-100',
    },
    {
        label: 'Optionalposition', desc: 'Zusatzleistung, nicht in Summe',
        unit: 'psch', price: 0, type: 'lump_sum', icon: BadgePercent, optional: true,
        color: 'text-amber-700 bg-amber-50 border-amber-200 hover:bg-amber-100',
    },
    {
        label: 'Alternative', desc: 'Variante zur Auswahl anbieten',
        unit: 'psch', price: 0, type: 'lump_sum', icon: SplitSquareHorizontal, optional: true,
        color: 'text-violet-700 bg-violet-50 border-violet-200 hover:bg-violet-100',
    },
];

const QUICK_ELEMENTS = [
    {
        label: 'Text',
        desc: 'Freier Text im Angebot',
        icon: Type,
        onAdd: (onAddItem: OfferSidebarProps['onAddItem']) => onAddItem('text'),
    },
    {
        label: 'Abschnitt',
        desc: 'Überschrift für Angebotsbereiche',
        icon: Heading,
        onAdd: (onAddItem: OfferSidebarProps['onAddItem']) => onAddItem('title'),
    },
    {
        label: 'Hinweistext',
        desc: 'Nicht enthalten, bauseitige Leistungen',
        icon: MessageSquareText,
        onAdd: (onAddItem: OfferSidebarProps['onAddItem']) => onAddItem('position', {
            description: 'Hinweis: ',
            unit: 'psch',
            unit_price_net: 0,
            item_type: 'text',
            quantity: 1,
        }),
    },
];

export function OfferSidebar({ onAddItem, isOpen, projectName, customerName, onAcceptAIPositions }: OfferSidebarProps) {
    if (!isOpen) return null;

    return (
        <div className="w-80 border-l bg-white flex flex-col h-full shadow-sm animate-in slide-in-from-right duration-300">
            <Tabs defaultValue="modules" className="w-full flex flex-col h-full">
                <div className="p-4 border-b">
                    <TabsList className="w-full grid grid-cols-5 h-9">
                        <TabsTrigger value="modules" className="px-2" title="Bausteine">
                            <span className="sr-only">Bausteine</span>
                            <List className="h-4 w-4" />
                        </TabsTrigger>
                        <TabsTrigger value="materials" className="px-2" title="Materialkatalog">
                            <span className="sr-only">Materialkatalog</span>
                            <Package className="h-4 w-4" />
                        </TabsTrigger>
                        <TabsTrigger value="search" className="px-2" title="Suche">
                            <span className="sr-only">Suche</span>
                            <Search className="h-4 w-4" />
                        </TabsTrigger>
                        <TabsTrigger value="history" className="px-2" title="Zeiten">
                            <span className="sr-only">Zeiten</span>
                            <History className="h-4 w-4" />
                        </TabsTrigger>
                        <TabsTrigger value="chat" className="px-2" title="Chat">
                            <span className="sr-only">Chat</span>
                            <MessageSquare className="h-4 w-4" />
                        </TabsTrigger>
                    </TabsList>
                </div>

                <TabsContent value="modules" className="flex-1 mt-0">
                    <div className="p-4">
                        <div className="relative">
                            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input placeholder="Suche Bausteine..." className="pl-9" />
                        </div>
                    </div>

                    <ScrollArea className="flex-1 px-4">
                        <div className="space-y-4 pb-4">
                            <div className="space-y-2">
                                <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider">Grundelemente</h3>

                                {QUICK_ELEMENTS.map((element) => (
                                    <SidebarItem
                                        key={element.label}
                                        icon={element.icon}
                                        label={element.label}
                                        description={element.desc}
                                        onClick={() => element.onAdd(onAddItem)}
                                    />
                                ))}

                                {POSITION_TYPES.map((t) => (
                                    <SidebarItem
                                        key={t.label}
                                        icon={t.icon}
                                        label={t.label}
                                        description={t.desc}
                                        className={t.color}
                                        onClick={() => onAddItem('position', {
                                            description: t.desc,
                                            unit: t.unit,
                                            unit_price_net: t.price,
                                            item_type: t.type,
                                            quantity: 1,
                                            is_optional: t.optional ?? false,
                                        })}
                                    />
                                ))}

                                <SidebarItem icon={ImageIcon} label="Bild" onClick={() => onAddItem('image')} />
                                <div className="pt-1"></div>
                                <SidebarItem icon={Scissors} label="Seitenumbruch" onClick={() => onAddItem('page_break')} />
                            </div>

                            <div className="space-y-2 pt-4">
                                <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider">Eigene Bausteine</h3>
                                <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-3 py-4 text-sm text-slate-500">
                                    <p className="font-medium text-slate-700">Noch keine eigenen Bausteine</p>
                                    <p className="mt-1 text-xs">Gespeicherte Firmen-Bausteine erscheinen hier, sobald sie angelegt sind.</p>
                                </div>
                            </div>
                        </div>
                    </ScrollArea>
                </TabsContent>

                <TabsContent value="materials" className="flex-1 mt-0 h-full overflow-hidden">
                    <OfferMaterialCatalog onSelectMaterial={(material) => onAddItem('material', material)} />
                </TabsContent>

                <TabsContent value="search" className="flex-1 mt-0">
                    <div className="p-8 text-center text-sm text-muted-foreground">Suche in Kürze verfügbar</div>
                </TabsContent>

                <TabsContent value="history" className="flex-1 mt-0">
                    <div className="p-8 text-center text-sm text-muted-foreground">Versionen in Kürze verfügbar</div>
                </TabsContent>

                <TabsContent value="chat" className="flex-1 mt-0 h-full overflow-hidden">
                    <AIOfferAssistant
                        projectName={projectName}
                        customerName={customerName}
                        onAcceptPositions={(positions) => {
                            if (onAcceptAIPositions) {
                                onAcceptAIPositions(positions);
                            } else {
                                positions.forEach((pos) => {
                                    onAddItem('position', {
                                        description: pos.description,
                                        quantity: pos.quantity,
                                        unit: pos.unit,
                                        unit_price_net: pos.unit_price_net,
                                        vat_rate: pos.vat_rate,
                                        item_type: pos.item_type,
                                        planned_hours_item: pos.planned_hours_item,
                                        material_purchase_cost: pos.material_purchase_cost,
                                        internal_notes: pos.internal_notes,
                                        is_optional: pos.is_optional,
                                    });
                                });
                            }
                        }}
                    />
                </TabsContent>
            </Tabs>
        </div>
    );
}

function SidebarItem({
    icon: Icon,
    label,
    description,
    className,
    onClick,
}: {
    icon: any;
    label: string;
    description?: string;
    className?: string;
    onClick: () => void;
}) {
    return (
        <button
            onClick={onClick}
            aria-label={label}
            className={`flex items-center justify-between w-full p-3 bg-white border rounded-lg hover:border-primary hover:shadow-sm transition-all group ${className || ''}`}
        >
            <div className="flex items-center gap-3">
                <div className="p-1.5 bg-gray-100 rounded group-hover:bg-primary/10 group-hover:text-primary transition-colors">
                    <Icon className="h-4 w-4" />
                </div>
                <div className="min-w-0 text-left">
                    <span className="block font-medium text-gray-700 group-hover:text-gray-900">{label}</span>
                    {description && <span className="block truncate text-xs text-gray-500">{description}</span>}
                </div>
            </div>
            <div className="text-gray-400 group-hover:text-primary">+</div>
        </button>
    );
}

