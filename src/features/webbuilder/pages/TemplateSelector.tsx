import React, { useEffect, useState, useRef } from 'react';
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useWebBuilderStore } from '../context/useWebBuilderStore';
import { useNavigate } from 'react-router-dom';
import { Badge } from "@/components/ui/badge";
import { Loader2, Check, Layout, MousePointer2, ArrowDown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import MiniWebsitePreview from '../components/MiniWebsitePreview';
import { TEMPLATES, Template } from '../data/templates';

// Template interface imported from data/templates.ts

const TemplateSelector = () => {
    const navigate = useNavigate();
    const { setSelectedTemplate, setStep } = useWebBuilderStore();
    const [templates, setTemplates] = useState<Template[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Simulating fetch
        setTimeout(() => {
            setTemplates(TEMPLATES);
            setLoading(false);
        }, 500);
    }, []);

    const handleSelect = (template: Template) => {
        setSelectedTemplate(template as any);
        setStep(2);
        navigate('/webbuilder/onboarding/style');
    };

    return (
        <div className="h-screen w-full flex flex-col overflow-hidden bg-slate-50 relative">
            {/* 1. Compact Header */}
            <div className="shrink-0 py-6 text-center z-10 bg-slate-50/90 backdrop-blur-sm">
                <div className="flex items-center justify-center gap-3 mb-2">
                    <Badge variant="outline" className="text-blue-500 border-blue-200 bg-blue-50">Schritt 1 von 4</Badge>
                </div>
                <h1 className="text-3xl font-bold tracking-tight text-slate-900 mb-1">
                    Wählen Sie den Stil Ihrer Website
                </h1>
                <p className="text-slate-500 text-sm max-w-xl mx-auto flex items-center justify-center gap-2">
                    Designs sind später vollständig anpassbar
                    <span className="w-1 h-1 rounded-full bg-slate-300"></span>
                    <Layout size={12} />
                </p>
            </div>

            {/* 2. Main Grid Area - Centered 16:9 Cards */}
            <div className="flex-1 min-h-0 w-full px-6 xl:px-32 pb-8 flex flex-col justify-center overflow-y-auto">
                {loading ? (
                    <div className="flex justify-center items-center h-full">
                        <Loader2 className="h-10 w-10 animate-spin text-blue-600" />
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 w-full max-w-[1700px] mx-auto my-auto">
                        {templates.map((template) => (
                            <TemplateCard key={template.id} template={template} onSelect={handleSelect} />
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};


const TemplateCard = ({ template, onSelect }: { template: Template, onSelect: (t: Template) => void }) => {
    const scrollRef = useRef<HTMLDivElement>(null);
    const [isHovering, setIsHovering] = useState(false);

    // Auto-scroll on hover logic
    useEffect(() => {
        let animationFrameId: number;
        let startTime: number;

        const scroll = (time: number) => {
            if (!isHovering || !scrollRef.current) return;
            if (!startTime) startTime = time;

            // Slower, smoother scroll
            const scrollSpeed = 0.05; // pixels per ms
            const elapsed = time - startTime;
            const newPos = elapsed * scrollSpeed;

            // Loop it
            const maxScroll = scrollRef.current.scrollHeight - scrollRef.current.clientHeight;
            if (scrollRef.current.scrollTop >= maxScroll) {
                startTime = time; // Reset
                scrollRef.current.scrollTop = 0;
            } else {
                scrollRef.current.scrollTop = newPos;
            }

            animationFrameId = requestAnimationFrame(scroll);
        };

        if (isHovering) {
            // Uncomment to enable auto-scroll
            // animationFrameId = requestAnimationFrame(scroll);
        } else if (scrollRef.current) {
            scrollRef.current.scrollTo({ top: 0, behavior: 'smooth' });
        }

        return () => {
            if (animationFrameId) cancelAnimationFrame(animationFrameId);
        };
    }, [isHovering]);

    return (
        <div className="group relative flex flex-col w-full">
            <Card
                className="overflow-hidden border-0 shadow-lg group-hover:shadow-2xl transition-all duration-300 group-hover:scale-[1.02] ring-1 ring-slate-200 cursor-pointer flex flex-col bg-slate-50/50"
                onMouseEnter={() => setIsHovering(true)}
                onMouseLeave={() => setIsHovering(false)}
                onClick={() => onSelect(template)}
            >
                {/* Scrollable Preview Container - 16:9 Fixed Ratio */}
                <div className="relative w-full aspect-video bg-white overflow-hidden group/preview border-b border-slate-100">

                    {/* Browser Toolbar Decoration */}
                    <div className="absolute top-0 left-0 right-0 h-5 bg-slate-100 border-b flex items-center px-2 gap-1 z-20 shrink-0">
                        <div className="w-1.5 h-1.5 rounded-full bg-red-300"></div>
                        <div className="w-1.5 h-1.5 rounded-full bg-amber-300"></div>
                        <div className="w-1.5 h-1.5 rounded-full bg-green-300"></div>
                        <div className="flex-1 mx-2 h-3 bg-white rounded border border-slate-200 text-[6px] flex items-center px-2 text-slate-400">
                            handwerkos.de
                        </div>
                    </div>

                    {/* The Scrolling Viewport */}
                    <div
                        ref={scrollRef}
                        className="absolute top-5 left-0 right-0 bottom-0 overflow-y-auto scrollbar-hide scroll-smooth bg-white"
                        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
                    >
                        {/* THE MINI WEBSITE COMPONENT */}
                        {/* 
                            WRAPPER FIX: 
                            The content is 2000px tall. Scaled 0.5x -> 1000px visual.
                            We force the container to be 1000px tall so the scrollbar matches the visual size. 
                        */}
                        <div style={{ height: '1000px', width: '100%', position: 'relative' }}>
                            <div className="absolute top-0 left-0 w-[200%] origin-top-left scale-[0.5]">
                                <MiniWebsitePreview templateId={template.id} />
                            </div>
                        </div>
                    </div>

                    {/* Scroll Hint (Simplified) */}
                    <div className="absolute bottom-2 left-1/2 -translate-x-1/2 text-slate-800 z-20 opacity-40 group-hover/preview:opacity-0 pointer-events-none">
                        <ArrowDown size={12} className="animate-bounce" />
                    </div>

                    {/* CTA Overlay */}
                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300 bg-slate-900/10 backdrop-blur-[1px] pointer-events-none top-5">
                        <Button className="h-8 text-xs bg-white text-slate-900 hover:bg-blue-50 font-semibold shadow-xl transform translate-y-4 group-hover:translate-y-0 transition-transform pointer-events-auto">
                            Wählen
                        </Button>
                    </div>
                </div>

                {/* Card Content - Normal Footer */}
                <div className="p-4 flex-1 flex flex-col bg-white">
                    <div className="flex justify-between items-start mb-3">
                        <div>
                            <h3 className="text-lg font-bold text-slate-900">{template.name}</h3>
                            <Badge variant="secondary" className="mt-1 text-[10px] font-normal text-slate-500 bg-slate-100 hover:bg-slate-100">
                                {template.badge}
                            </Badge>
                        </div>
                    </div>

                    <div className="mt-auto space-y-1.5 pt-2">
                        {template.features.map((feature, i) => (
                            <div key={i} className="flex items-center gap-2 text-[10px] text-slate-500">
                                <Check size={12} className="text-blue-500" />
                                {feature}
                            </div>
                        ))}
                    </div>
                </div>
            </Card>
        </div>
    );
};

// Data moved to data/templates.ts
export default TemplateSelector;
