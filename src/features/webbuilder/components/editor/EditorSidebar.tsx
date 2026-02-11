import React from 'react';
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Layout, Palette, FileText, Plus, Hammer, CheckCircle, Image, MessageSquare, Phone, Type, LayoutTemplate } from "lucide-react";
import { useWebBuilderStore } from '../../context/useWebBuilderStore';
import { BLOCK_TEMPLATES, BlockTemplate } from '../../data/block-templates';
import { cn } from "@/lib/utils";

// Map string icon names to Lucide components
const ICON_MAP: Record<string, React.ComponentType<any>> = {
    LayoutTemplate,
    Hammer,
    CheckCircle,
    Image,
    MessageSquare,
    Phone,
    Type
};

const EditorSidebar = () => {
    const { addBlock, activePageId } = useWebBuilderStore();

    const handleAddBlock = (template: BlockTemplate) => {
        if (!activePageId) return;
        addBlock(activePageId, template.type as any, template.defaultContent);
    };

    return (
        <div className="w-[300px] border-r bg-white h-full fixed left-0 top-16 bottom-0 overflow-hidden flex flex-col z-40">
            <Tabs defaultValue="blocks" className="h-full flex flex-col">
                <div className="p-4 border-b">
                    <TabsList className="w-full grid grid-cols-3">
                        <TabsTrigger value="blocks"><Plus className="h-4 w-4 mr-2" />Blocks</TabsTrigger>
                        <TabsTrigger value="design"><Palette className="h-4 w-4 mr-2" />Design</TabsTrigger>
                        <TabsTrigger value="pages"><FileText className="h-4 w-4 mr-2" />Pages</TabsTrigger>
                    </TabsList>
                </div>

                <TabsContent value="blocks" className="flex-1 overflow-y-auto p-4 space-y-6">
                    {['structure', 'content', 'media'].map((category) => (
                        <div key={category} className="space-y-2">
                            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                                {category.charAt(0).toUpperCase() + category.slice(1)}
                            </h3>
                            <div className="grid grid-cols-2 gap-2">
                                {BLOCK_TEMPLATES.filter(b => b.category === category).map((block) => {
                                    const IconInfo = ICON_MAP[block.icon] || Layout;
                                    return (
                                        <button
                                            key={block.type}
                                            onClick={() => handleAddBlock(block)}
                                            className="h-24 border rounded-md flex flex-col items-center justify-center gap-2 hover:border-blue-500 hover:bg-blue-50 transition-all group text-center p-2"
                                            disabled={!activePageId}
                                        >
                                            <IconInfo className="h-6 w-6 text-slate-500 group-hover:text-blue-500" />
                                            <span className="text-xs font-medium text-slate-700 group-hover:text-blue-700 leading-tight">
                                                {block.label}
                                            </span>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    ))}
                    {!activePageId && (
                        <div className="text-xs text-red-500 text-center mt-4">
                            Select a page to add blocks
                        </div>
                    )}
                </TabsContent>

                <TabsContent value="design" className="flex-1 overflow-y-auto p-4">
                    <div className="text-sm text-slate-500 text-center mt-10">
                        Global Design Settings<br />(Coming Soon)
                    </div>
                </TabsContent>

                <TabsContent value="pages" className="flex-1 overflow-y-auto p-4">
                    <div className="text-sm text-slate-500 text-center mt-10">
                        Page Management<br />(Coming Soon)
                    </div>
                </TabsContent>
            </Tabs>
        </div>
    );
};

export default EditorSidebar;
