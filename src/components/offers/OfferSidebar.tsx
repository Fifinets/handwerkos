import React, { useState } from 'react';
import { Search, History, MessageSquare, GripVertical, Type, Heading, List, Image as ImageIcon, Scissors, Package } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { OfferMaterialCatalog } from './OfferMaterialCatalog';
import { Material } from '@/types';

interface OfferSidebarProps {
    onAddItem: (type: string, data?: any) => void;
    isOpen: boolean;
}

export function OfferSidebar({ onAddItem, isOpen }: OfferSidebarProps) {
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

                                <SidebarItem
                                    icon={Type}
                                    label="Text"
                                    onClick={() => onAddItem('text')}
                                />
                                <SidebarItem
                                    icon={Heading}
                                    label="Titel"
                                    onClick={() => onAddItem('title')}
                                />
                                <SidebarItem
                                    icon={GripVertical}
                                    label="Position"
                                    onClick={() => onAddItem('position')}
                                />
                                <SidebarItem
                                    icon={ImageIcon}
                                    label="Bild"
                                    onClick={() => onAddItem('image')}
                                />
                                <div className="pt-2"></div>
                                <SidebarItem
                                    icon={Scissors}
                                    label="Seitenumbruch"
                                    onClick={() => onAddItem('page_break')}
                                />
                            </div>

                            <div className="space-y-2 pt-4">
                                <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider">Vorlagen</h3>
                                <div className="p-8 text-center border-2 border-dashed rounded-lg text-gray-400 text-sm">
                                    Keine Vorlagen gefunden
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

                <TabsContent value="chat" className="flex-1 mt-0">
                    <div className="p-8 text-center text-sm text-muted-foreground">KI Assistent in Kürze verfügbar</div>
                </TabsContent>
            </Tabs>
        </div>
    );
}

function SidebarItem({ icon: Icon, label, onClick }: { icon: any, label: string, onClick: () => void }) {
    return (
        <button
            onClick={onClick}
            className="flex items-center justify-between w-full p-3 bg-white border rounded-lg hover:border-primary hover:shadow-sm transition-all group"
        >
            <div className="flex items-center gap-3">
                <div className="p-1.5 bg-gray-100 rounded group-hover:bg-primary/10 group-hover:text-primary transition-colors">
                    <Icon className="h-4 w-4" />
                </div>
                <span className="font-medium text-gray-700 group-hover:text-gray-900">{label}</span>
            </div>
            <div className="text-gray-400 group-hover:text-primary">
                +
            </div>
        </button>
    );
}
