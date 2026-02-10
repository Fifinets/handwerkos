
import React from 'react';
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Layout, Palette, FileText, Plus } from "lucide-react";

const EditorSidebar = () => {
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

                <TabsContent value="blocks" className="flex-1 overflow-y-auto p-4 space-y-4">
                    <div className="space-y-2">
                        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Structure</h3>
                        <div className="grid grid-cols-2 gap-2">
                            <div className="h-20 border rounded-md flex flex-col items-center justify-center gap-2 hover:border-primary hover:bg-slate-50 cursor-grab active:cursor-grabbing transition-colors">
                                <Layout className="h-5 w-5 text-slate-500" />
                                <span className="text-xs font-medium">Hero</span>
                            </div>
                            <div className="h-20 border rounded-md flex flex-col items-center justify-center gap-2 hover:border-primary hover:bg-slate-50 cursor-grab active:cursor-grabbing transition-colors">
                                <Layout className="h-5 w-5 text-slate-500" />
                                <span className="text-xs font-medium">Features</span>
                            </div>
                        </div>
                    </div>
                </TabsContent>

                <TabsContent value="design" className="flex-1 overflow-y-auto p-4">
                    Themes & Colors (Coming Soon)
                </TabsContent>

                <TabsContent value="pages" className="flex-1 overflow-y-auto p-4">
                    Pages Tree (Coming Soon)
                </TabsContent>
            </Tabs>
        </div>
    );
};

export default EditorSidebar;
